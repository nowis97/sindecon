/**
 * Cliente de Google Drive API v3 para el espacio privado `appDataFolder`.
 * Permite almacenar y sincronizar `sync-manifest.json`, `cuaderno-backup.zip` y `ai-config.json`.
 */

import type { AiConfig } from '../db/db'

export const AI_CONFIG_FILE_NAME = 'ai-config.json'
export const DEFAULT_RESUMABLE_CHUNK_SIZE = 2 * 1024 * 1024 // 2 MB (múltiplo de 256 KB)

const RESUMABLE_SESSION_KEY_PREFIX = 'cuaderno-gdrive-resumable-session:'
const RESUMABLE_SESSION_TTL_MS = 24 * 60 * 60 * 1000 // 24 horas

export interface GoogleDriveFile {
  id: string
  name: string
  mimeType: string
  modifiedTime?: string
}

export interface UploadAppDataOptions {
  onUploadProgress?: (uploadedBytes: number, totalBytes: number) => void
  chunkSize?: number
  maxRetries?: number
  retryDelayMs?: number
}

interface StoredResumableSession {
  sessionUri: string
  name: string
  existingFileId?: string
  totalBytes: number
  createdAt: number
}

export interface SyncManifest {
  version: number
  timestamp: number
  deviceId: string
  nodeCount: number
  updatedAtIso: string
}

const GDRIVE_TOKEN_KEY = 'cuaderno-gdrive-token'
const GDRIVE_EXPIRY_KEY = 'cuaderno-gdrive-expiry'
const GDRIVE_EMAIL_KEY = 'cuaderno-gdrive-email'
const GDRIVE_CLIENT_ID_KEY = 'cuaderno-gdrive-client-id'
const GDRIVE_ENABLED_KEY = 'cuaderno-gdrive-enabled'

// Client ID configurado mediante variable de entorno VITE_GOOGLE_CLIENT_ID o localStorage
export const DEFAULT_GOOGLE_CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || ''

export function getStoredClientId(): string {
  return localStorage.getItem(GDRIVE_CLIENT_ID_KEY) || DEFAULT_GOOGLE_CLIENT_ID
}

export function setStoredClientId(clientId: string) {
  localStorage.setItem(GDRIVE_CLIENT_ID_KEY, clientId)
}

export function isGoogleSyncEnabled(): boolean {
  return localStorage.getItem(GDRIVE_ENABLED_KEY) === 'true'
}

export function setGoogleSyncEnabled(enabled: boolean) {
  if (enabled) {
    localStorage.setItem(GDRIVE_ENABLED_KEY, 'true')
  } else {
    localStorage.removeItem(GDRIVE_ENABLED_KEY)
  }
}

export function isTokenExpired(marginMinutes = 2): boolean {
  const expiryStr = localStorage.getItem(GDRIVE_EXPIRY_KEY)
  if (!expiryStr) return true
  const expiry = Number.parseInt(expiryStr, 10)
  return Date.now() >= expiry - marginMinutes * 60 * 1000
}

export function getStoredToken(): string | null {
  const token = localStorage.getItem(GDRIVE_TOKEN_KEY)
  const expiryStr = localStorage.getItem(GDRIVE_EXPIRY_KEY)
  if (!token) return null

  if (expiryStr) {
    const expiry = Number.parseInt(expiryStr, 10)
    if (Date.now() > expiry) {
      // Token expirado: NO borramos email ni la bandera gdrive-enabled para permitir renovación silenciosa
      localStorage.removeItem(GDRIVE_TOKEN_KEY)
      return null
    }
  }
  return token
}

export function setStoredToken(token: string, expiresInSeconds = 3600, email?: string) {
  localStorage.setItem(GDRIVE_TOKEN_KEY, token)
  localStorage.setItem(GDRIVE_EXPIRY_KEY, (Date.now() + expiresInSeconds * 1000).toString())
  localStorage.setItem(GDRIVE_ENABLED_KEY, 'true')
  if (email) {
    localStorage.setItem(GDRIVE_EMAIL_KEY, email)
  }
}

export function getStoredEmail(): string | null {
  return localStorage.getItem(GDRIVE_EMAIL_KEY)
}

export function clearStoredToken(disconnectExplicit = false) {
  localStorage.removeItem(GDRIVE_TOKEN_KEY)
  localStorage.removeItem(GDRIVE_EXPIRY_KEY)
  if (disconnectExplicit) {
    localStorage.removeItem(GDRIVE_EMAIL_KEY)
    localStorage.removeItem(GDRIVE_ENABLED_KEY)
  }
}

/**
 * Solicita silenciosamente un nuevo Access Token a Google Identity Services (GIS)
 * sin abrir pop-ups ni requerir clics del usuario si ya ha concedido permisos previamente.
 */
export function requestSilentAccessToken(
  clientId: string,
  onSuccess: (token: string, expiresIn: number) => void,
  onError?: (err: string) => void,
): void {
  const win = window as unknown as {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            prompt?: string
            callback: (res: { access_token?: string; expires_in?: number; error?: string }) => void
          }) => { requestAccessToken: (opts?: { prompt?: string }) => void }
        }
      }
    }
  }

  if (!win.google?.accounts?.oauth2) {
    onError?.('Google Identity Services no está listo')
    return
  }

  try {
    const client = win.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.appdata',
      prompt: '',
      callback: (response) => {
        if (response.access_token) {
          onSuccess(response.access_token, response.expires_in || 3600)
        } else if (response.error) {
          onError?.(response.error)
        }
      },
    })
    client.requestAccessToken({ prompt: '' })
  } catch (err) {
    onError?.((err as Error).message)
  }
}

/**
 * Busca un archivo por nombre dentro del espacio privado `appDataFolder`.
 */
export async function getAppDataFileByName(
  token: string,
  name: string,
): Promise<GoogleDriveFile | null> {
  const url = new URL('https://www.googleapis.com/drive/v3/files')
  url.searchParams.set('spaces', 'appDataFolder')
  url.searchParams.set('q', `name = '${name}' and trashed = false`)
  url.searchParams.set('fields', 'files(id, name, mimeType, modifiedTime)')

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    if (res.status === 401) {
      clearStoredToken()
      throw new Error('Sesión de Google Drive expirada')
    }
    throw new Error(`Error consultando Google Drive: ${res.statusText}`)
  }

  const data = (await res.json()) as { files?: GoogleDriveFile[] }
  if (data.files && data.files.length > 0) {
    return data.files[0]
  }
  return null
}

/**
 * Descarga el contenido binario o de texto de un archivo en `appDataFolder`.
 */
export async function downloadAppDataFile(token: string, fileId: string): Promise<Blob> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    throw new Error(`Error descargando archivo de Google Drive: ${res.statusText}`)
  }

  return await res.blob()
}

function getResumableSessionStorageKey(name: string): string {
  return `${RESUMABLE_SESSION_KEY_PREFIX}${name}`
}

export function getCachedResumableSession(
  name: string,
  existingFileId: string | undefined,
  totalBytes: number,
): string | null {
  try {
    const raw = localStorage.getItem(getResumableSessionStorageKey(name))
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredResumableSession
    if (
      parsed.sessionUri &&
      parsed.name === name &&
      parsed.existingFileId === existingFileId &&
      parsed.totalBytes === totalBytes &&
      Date.now() - parsed.createdAt < RESUMABLE_SESSION_TTL_MS
    ) {
      return parsed.sessionUri
    }
    localStorage.removeItem(getResumableSessionStorageKey(name))
  } catch {
    // Ignorar errores de parseo
  }
  return null
}

function setCachedResumableSession(
  name: string,
  existingFileId: string | undefined,
  totalBytes: number,
  sessionUri: string,
): void {
  try {
    const session: StoredResumableSession = {
      sessionUri,
      name,
      existingFileId,
      totalBytes,
      createdAt: Date.now(),
    }
    localStorage.setItem(getResumableSessionStorageKey(name), JSON.stringify(session))
  } catch {
    // Ignorar si localStorage no está disponible
  }
}

export function clearCachedResumableSession(name: string): void {
  try {
    localStorage.removeItem(getResumableSessionStorageKey(name))
  } catch {
    // Ignorar
  }
}

/**
 * Extrae el siguiente offset de bytes a partir de la cabecera `Range: bytes=0-12345`.
 * Retorna `upperBound + 1`, o `null` si la cabecera no está presente o no coincide.
 */
function parseRangeNextOffset(rangeHeader: string | null): number | null {
  if (!rangeHeader) return null
  const match = /bytes=\d+-(\d+)/i.exec(rangeHeader)
  if (!match) return null
  const upperBound = Number.parseInt(match[1], 10)
  return Number.isNaN(upperBound) ? null : upperBound + 1
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Inicia una sesión de subida resumable (`uploadType=resumable`) en Google Drive AppData
 * y devuelve la URI de sesión (`Location`).
 */
async function initiateResumableUploadSession(
  token: string,
  name: string,
  mimeType: string,
  totalBytes: number,
  existingFileId?: string,
): Promise<string> {
  const metadata: { name: string; mimeType: string; parents?: string[] } = {
    name,
    mimeType,
  }
  if (!existingFileId) {
    metadata.parents = ['appDataFolder']
  }

  const url = existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=resumable`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable'

  const res = await fetch(url, {
    method: existingFileId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': mimeType,
      'X-Upload-Content-Length': totalBytes.toString(),
    },
    body: JSON.stringify(metadata),
  })

  if (!res.ok) {
    if (res.status === 401) {
      clearStoredToken()
      throw new Error('Sesión de Google Drive expirada')
    }
    throw new Error(`Error iniciando subida resumable a Google Drive: ${res.statusText}`)
  }

  const sessionUri = res.headers.get('Location') || res.headers.get('location')
  if (!sessionUri) {
    throw new Error('Google Drive no devolvió URI de sesión resumable (Location)')
  }

  setCachedResumableSession(name, existingFileId, totalBytes, sessionUri)
  return sessionUri
}

/**
 * Consulta a Google Drive cuántos bytes se han recibido realmente en una sesión resumable activa.
 */
async function queryResumableUploadStatus(
  sessionUri: string,
  totalBytes: number,
): Promise<
  | { status: 'incomplete'; offset: number }
  | { status: 'completed'; file: GoogleDriveFile }
  | { status: 'expired' }
> {
  const res = await fetch(sessionUri, {
    method: 'PUT',
    headers: {
      'Content-Length': '0',
      'Content-Range': `bytes */${totalBytes}`,
    },
  })

  if (res.status === 308) {
    const rangeHeader = res.headers.get('Range') || res.headers.get('range')
    const nextOffset = parseRangeNextOffset(rangeHeader) ?? 0
    return { status: 'incomplete', offset: nextOffset }
  }

  if (res.status === 200 || res.status === 201) {
    const file = (await res.json()) as GoogleDriveFile
    return { status: 'completed', file }
  }

  if (res.status === 404 || res.status === 410) {
    return { status: 'expired' }
  }

  if (res.status === 401) {
    clearStoredToken()
    throw new Error('Sesión de Google Drive expirada')
  }

  throw new Error(`Error consultando estado de sesión resumable: ${res.statusText}`)
}

/**
 * Sube o actualiza un archivo en `appDataFolder` usando el protocolo Resumable Upload
 * por bloques (`uploadType=resumable`), con reanudación automática ante cortes de red
 * y reporte de progreso en tiempo real.
 */
export async function uploadAppDataFile(
  token: string,
  name: string,
  mimeType: string,
  content: Blob | string,
  existingFileId?: string,
  options?: UploadAppDataOptions,
): Promise<GoogleDriveFile> {
  const fileBody =
    typeof content === 'string' ? new Blob([content], { type: mimeType }) : content
  const totalBytes = fileBody.size
  const chunkSize = options?.chunkSize ?? DEFAULT_RESUMABLE_CHUNK_SIZE
  const maxRetries = options?.maxRetries ?? 3
  const retryDelayMs = options?.retryDelayMs ?? 250

  let sessionUri = getCachedResumableSession(name, existingFileId, totalBytes)
  let offset = 0

  // Si existe una sesión previa en caché, consultar en qué byte quedó
  if (sessionUri) {
    try {
      const status = await queryResumableUploadStatus(sessionUri, totalBytes)
      if (status.status === 'completed') {
        clearCachedResumableSession(name)
        options?.onUploadProgress?.(totalBytes, totalBytes)
        return status.file
      }
      if (status.status === 'incomplete') {
        offset = status.offset
        options?.onUploadProgress?.(offset, totalBytes)
      } else {
        clearCachedResumableSession(name)
        sessionUri = null
      }
    } catch {
      clearCachedResumableSession(name)
      sessionUri = null
    }
  }

  if (!sessionUri) {
    sessionUri = await initiateResumableUploadSession(
      token,
      name,
      mimeType,
      totalBytes,
      existingFileId,
    )
    options?.onUploadProgress?.(0, totalBytes)
  }

  // Caso especial: archivo vacío (0 bytes)
  if (totalBytes === 0) {
    const res = await fetch(sessionUri, {
      method: 'PUT',
      headers: {
        'Content-Length': '0',
        'Content-Range': 'bytes */0',
      },
    })
    if (!res.ok) {
      clearCachedResumableSession(name)
      throw new Error(`Error subiendo archivo vacío a Google Drive: ${res.statusText}`)
    }
    clearCachedResumableSession(name)
    options?.onUploadProgress?.(0, 0)
    return (await res.json()) as GoogleDriveFile
  }

  let consecutiveFailures = 0
  let sessionRestarts = 0

  while (offset < totalBytes) {
    const endExclusive = Math.min(offset + chunkSize, totalBytes)
    const chunkBlob = fileBody.slice(offset, endExclusive)
    const currentChunkLength = endExclusive - offset

    try {
      const res = await fetch(sessionUri, {
        method: 'PUT',
        headers: {
          'Content-Length': currentChunkLength.toString(),
          'Content-Range': `bytes ${offset}-${endExclusive - 1}/${totalBytes}`,
        },
        body: chunkBlob,
      })

      if (res.status === 308) {
        consecutiveFailures = 0
        const rangeHeader = res.headers.get('Range') || res.headers.get('range')
        const confirmedOffset = parseRangeNextOffset(rangeHeader)
        offset = confirmedOffset !== null ? confirmedOffset : endExclusive
        options?.onUploadProgress?.(offset, totalBytes)
        continue
      }

      if (res.status === 200 || res.status === 201) {
        clearCachedResumableSession(name)
        options?.onUploadProgress?.(totalBytes, totalBytes)
        return (await res.json()) as GoogleDriveFile
      }

      if (res.status === 404 || res.status === 410) {
        clearCachedResumableSession(name)
        if (sessionRestarts >= 1) {
          throw new Error('La sesión de subida resumable expiró repetidamente')
        }
        sessionRestarts++
        sessionUri = await initiateResumableUploadSession(
          token,
          name,
          mimeType,
          totalBytes,
          existingFileId,
        )
        offset = 0
        consecutiveFailures = 0
        options?.onUploadProgress?.(0, totalBytes)
        continue
      }

      if (res.status === 401) {
        clearStoredToken()
        throw new Error('Sesión de Google Drive expirada')
      }

      // Cualquier error 5xx u otro código no exitoso activa el flujo de recuperación
      throw new Error(`Error subiendo bloque a Google Drive (${res.status}): ${res.statusText}`)
    } catch (err) {
      if ((err as Error).message === 'Sesión de Google Drive expirada' || (err as Error).message === 'La sesión de subida resumable expiró repetidamente') {
        throw err
      }

      consecutiveFailures++
      if (consecutiveFailures > maxRetries) {
        throw err
      }

      await sleep(retryDelayMs * Math.pow(2, consecutiveFailures - 1))

      // Consultar a Google Drive el último byte recibido antes de reintentar
      const status = await queryResumableUploadStatus(sessionUri, totalBytes)
      if (status.status === 'completed') {
        clearCachedResumableSession(name)
        options?.onUploadProgress?.(totalBytes, totalBytes)
        return status.file
      }
      if (status.status === 'expired') {
        clearCachedResumableSession(name)
        if (sessionRestarts >= 1) {
          throw new Error('La sesión de subida resumable expiró repetidamente')
        }
        sessionRestarts++
        sessionUri = await initiateResumableUploadSession(
          token,
          name,
          mimeType,
          totalBytes,
          existingFileId,
        )
        offset = 0
        options?.onUploadProgress?.(0, totalBytes)
        continue
      }

      offset = status.offset
      options?.onUploadProgress?.(offset, totalBytes)
    }
  }

  throw new Error('La subida resumable terminó sin respuesta de confirmación final')
}

/**
 * Obtiene el email del usuario usando Google UserInfo endpoint.
 */
export async function fetchGoogleUserEmail(token: string): Promise<string | null> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const data = (await res.json()) as { email?: string }
      return data.email ?? null
    }
  } catch {
    // Ignorar si falla
  }
  return null
}

/**
 * Obtiene la configuración de IA guardada en `appDataFolder` de Google Drive.
 */
export async function fetchAiConfigFromDrive(token: string): Promise<AiConfig | null> {
  const file = await getAppDataFileByName(token, AI_CONFIG_FILE_NAME)
  if (!file) return null
  try {
    const blob = await downloadAppDataFile(token, file.id)
    const text = await blob.text()
    const parsed = JSON.parse(text) as AiConfig
    if (parsed && typeof parsed === 'object' && parsed.provider) {
      return parsed
    }
  } catch (err) {
    console.warn('Error leyendo ai-config.json de Google Drive:', err)
  }
  return null
}

/**
 * Sube o actualiza la configuración de IA en `appDataFolder` de Google Drive.
 */
export async function uploadAiConfigToDrive(
  token: string,
  config: AiConfig,
): Promise<GoogleDriveFile> {
  const existing = await getAppDataFileByName(token, AI_CONFIG_FILE_NAME)
  const jsonString = JSON.stringify(config, null, 2)
  return await uploadAppDataFile(
    token,
    AI_CONFIG_FILE_NAME,
    'application/json',
    jsonString,
    existing?.id,
  )
}
