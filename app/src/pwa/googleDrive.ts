/**
 * Cliente de Google Drive API v3 para el espacio privado `appDataFolder`.
 * Permite almacenar y sincronizar `sync-manifest.json` y `cuaderno-backup.zip`.
 */

export interface GoogleDriveFile {
  id: string
  name: string
  mimeType: string
  modifiedTime?: string
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

// Client ID por defecto para la PWA de Cuaderno Médico (sindecon.app)
export const DEFAULT_GOOGLE_CLIENT_ID =
  '538691015189-7etnuoh6rmuo6koo53jpghh0ujc3gs18.apps.googleusercontent.com'

export function getStoredClientId(): string {
  return localStorage.getItem(GDRIVE_CLIENT_ID_KEY) || DEFAULT_GOOGLE_CLIENT_ID
}

export function setStoredClientId(clientId: string) {
  localStorage.setItem(GDRIVE_CLIENT_ID_KEY, clientId)
}

export function getStoredToken(): string | null {
  const token = localStorage.getItem(GDRIVE_TOKEN_KEY)
  const expiryStr = localStorage.getItem(GDRIVE_EXPIRY_KEY)
  if (!token) return null

  if (expiryStr) {
    const expiry = Number.parseInt(expiryStr, 10)
    if (Date.now() > expiry) {
      // Token expirado
      clearStoredToken()
      return null
    }
  }
  return token
}

export function setStoredToken(token: string, expiresInSeconds = 3600, email?: string) {
  localStorage.setItem(GDRIVE_TOKEN_KEY, token)
  localStorage.setItem(GDRIVE_EXPIRY_KEY, (Date.now() + expiresInSeconds * 1000).toString())
  if (email) {
    localStorage.setItem(GDRIVE_EMAIL_KEY, email)
  }
}

export function getStoredEmail(): string | null {
  return localStorage.getItem(GDRIVE_EMAIL_KEY)
}

export function clearStoredToken() {
  localStorage.removeItem(GDRIVE_TOKEN_KEY)
  localStorage.removeItem(GDRIVE_EXPIRY_KEY)
  localStorage.removeItem(GDRIVE_EMAIL_KEY)
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

/**
 * Sube o actualiza un archivo en `appDataFolder` usando multipart/related.
 */
export async function uploadAppDataFile(
  token: string,
  name: string,
  mimeType: string,
  content: Blob | string,
  existingFileId?: string,
): Promise<GoogleDriveFile> {
  const metadata = {
    name,
    mimeType,
    parents: existingFileId ? undefined : ['appDataFolder'],
  }

  const boundary = '-------314159265358979323846'
  const delimiter = `\r\n--${boundary}\r\n`
  const closeDelimiter = `\r\n--${boundary}--`

  let fileBody: Blob
  if (typeof content === 'string') {
    fileBody = new Blob([content], { type: mimeType })
  } else {
    fileBody = content
  }

  const metadataBlob = new Blob([JSON.stringify(metadata)], {
    type: 'application/json; charset=UTF-8',
  })

  const multipartBody = new Blob(
    [
      delimiter,
      'Content-Type: application/json; charset=UTF-8\r\n\r\n',
      metadataBlob,
      delimiter,
      `Content-Type: ${mimeType}\r\n\r\n`,
      fileBody,
      closeDelimiter,
    ],
    { type: `multipart/related; boundary=${boundary}` },
  )

  const url = existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'

  const res = await fetch(url, {
    method: existingFileId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  })

  if (!res.ok) {
    throw new Error(`Error subiendo archivo a Google Drive: ${res.statusText}`)
  }

  return (await res.json()) as GoogleDriveFile
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
