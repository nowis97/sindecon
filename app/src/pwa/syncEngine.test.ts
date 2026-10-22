import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getDeviceId,
  getLastSyncTime,
  setLastSyncTime,
  performGoogleDriveSync,
} from './syncEngine'
import { db } from '../db/db'
import * as gdrive from './googleDrive'

// Mock de localStorage para el entorno de test node
const store: Record<string, string> = {}
const localStorageMock = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => {
    store[key] = value.toString()
  },
  removeItem: (key: string) => {
    delete store[key]
  },
  clear: () => {
    for (const k of Object.keys(store)) delete store[k]
  },
}

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

Object.defineProperty(globalThis, 'navigator', {
  value: { onLine: true },
  writable: true,
})

vi.mock('./googleDrive', async () => {
  const actual = await vi.importActual<typeof gdrive>('./googleDrive')
  return {
    ...actual,
    getAppDataFileByName: vi.fn(),
    downloadAppDataFile: vi.fn(),
    uploadAppDataFile: vi.fn(),
    fetchAiConfigFromDrive: vi.fn(),
    uploadAiConfigToDrive: vi.fn(),
  }
})

describe('syncEngine (Google Drive Local-First Sync)', () => {
  beforeEach(async () => {
    localStorageMock.clear()
    await db.nodes.clear()
    await db.articles.clear()
    await db.assets.clear()
    vi.clearAllMocks()
  })

  it('genera y persiste un ID de dispositivo único', () => {
    const id1 = getDeviceId()
    expect(id1).toMatch(/^dev-/)
    const id2 = getDeviceId()
    expect(id1).toBe(id2)
  })

  it('guarda y recupera el último timestamp de sincronización', () => {
    expect(getLastSyncTime()).toBe(0)
    setLastSyncTime(1700000000000)
    expect(getLastSyncTime()).toBe(1700000000000)
  })

  it('realiza subida inicial si no hay archivos en Google Drive AppData', async () => {
    vi.mocked(gdrive.getAppDataFileByName).mockResolvedValue(null)
    vi.mocked(gdrive.uploadAppDataFile).mockResolvedValue({
      id: 'file-123',
      name: 'cuaderno-backup.zip',
      mimeType: 'application/zip',
    })

    const res = await performGoogleDriveSync('mock-token')
    expect(res.action).toBe('uploaded')
    expect(gdrive.uploadAppDataFile).toHaveBeenCalledTimes(2) // zip y manifest
    expect(getLastSyncTime()).toBeGreaterThan(0)
  })

  it('detecta si el cuaderno está al día cuando los timestamps coinciden', async () => {
    const fixedTime = 1710000000000
    setLastSyncTime(fixedTime)

    vi.mocked(gdrive.getAppDataFileByName).mockImplementation(async (_token, name) => {
      if (name === 'sync-manifest.json') {
        return { id: 'manifest-id', name, mimeType: 'application/json' }
      }
      return { id: 'zip-id', name, mimeType: 'application/zip' }
    })

    const manifestData: gdrive.SyncManifest = {
      version: 1,
      timestamp: fixedTime,
      deviceId: 'remote-device',
      nodeCount: 5,
      updatedAtIso: new Date(fixedTime).toISOString(),
    }

    vi.mocked(gdrive.downloadAppDataFile).mockResolvedValue(
      new Blob([JSON.stringify(manifestData)], { type: 'application/json' }),
    )

    const res = await performGoogleDriveSync('mock-token')
    expect(res.action).toBe('up-to-date')
  })

  it('descarga ai-config.json si en local no hay clave pero en Google Drive sí', async () => {
    const remoteAiConfig = {
      provider: 'gemini' as const,
      apiKey: 'AIzaSy-remote-test-key',
      modelName: 'gemini-3.7-flash',
      updated_at: 1715000000000,
    }

    vi.mocked(gdrive.fetchAiConfigFromDrive).mockResolvedValue(remoteAiConfig)

    const { syncAiConfigWithDrive } = await import('./syncEngine')
    const result = await syncAiConfigWithDrive('mock-token')

    expect(result.synced).toBe(true)
    expect(result.action).toBe('downloaded')

    const { getAiConfig } = await import('../db/flashcards')
    const local = await getAiConfig()
    expect(local.apiKey).toBe('AIzaSy-remote-test-key')
    expect(local.modelName).toBe('gemini-3.7-flash')
  })

  it('sube ai-config.json a Google Drive si en local hay clave y en Drive no existe', async () => {
    const { saveAiConfig } = await import('../db/flashcards')
    const localConfig = {
      provider: 'groq' as const,
      apiKey: 'gsk_local_test_key',
      modelName: 'llama-3.3-70b-versatile',
      updated_at: 1716000000000,
    }
    await saveAiConfig(localConfig)

    vi.mocked(gdrive.fetchAiConfigFromDrive).mockResolvedValue(null)
    vi.mocked(gdrive.uploadAiConfigToDrive).mockResolvedValue({
      id: 'new-ai-config-id',
      name: 'ai-config.json',
      mimeType: 'application/json',
    })

    const { syncAiConfigWithDrive } = await import('./syncEngine')
    const result = await syncAiConfigWithDrive('mock-token')

    expect(result.synced).toBe(true)
    expect(result.action).toBe('uploaded')
    expect(gdrive.uploadAiConfigToDrive).toHaveBeenCalledWith(
      'mock-token',
      expect.objectContaining({
        apiKey: 'gsk_local_test_key',
        provider: 'groq',
      }),
    )
  })

  it('gestiona la expiración de tokens sin borrar la cuenta y sin requerir reconexión invasiva', () => {
    // 1. Guardar token temporal
    gdrive.setStoredToken('temp-access-token', 3600, 'dr.house@hospital.org')
    expect(gdrive.isGoogleSyncEnabled()).toBe(true)
    expect(gdrive.getStoredEmail()).toBe('dr.house@hospital.org')
    expect(gdrive.getStoredToken()).toBe('temp-access-token')
    expect(gdrive.isTokenExpired(0)).toBe(false)

    // 2. Invalidación no destructiva (por 401 o expiración): no borra email ni enabled flag
    gdrive.clearStoredToken(false)
    expect(gdrive.getStoredToken()).toBe(null)
    expect(gdrive.isGoogleSyncEnabled()).toBe(true)
    expect(gdrive.getStoredEmail()).toBe('dr.house@hospital.org')

    // 3. Desconexión explícita del usuario: borra toda la configuración
    gdrive.clearStoredToken(true)
    expect(gdrive.isGoogleSyncEnabled()).toBe(false)
    expect(gdrive.getStoredEmail()).toBe(null)
  })

  it('emite secuencialmente eventos de progreso con fases y porcentajes ascendentes', async () => {
    vi.mocked(gdrive.getAppDataFileByName).mockResolvedValue(null)
    vi.mocked(gdrive.uploadAppDataFile).mockResolvedValue({
      id: 'file-123',
      name: 'cuaderno-backup.zip',
      mimeType: 'application/zip',
    })

    const progressEvents: Array<{ phase: string; percent: number; message: string }> = []
    const onProgress = vi.fn((p) => {
      progressEvents.push(p)
    })

    const res = await performGoogleDriveSync('mock-token', onProgress)
    expect(res.action).toBe('uploaded')
    expect(onProgress).toHaveBeenCalled()
    expect(progressEvents.length).toBeGreaterThanOrEqual(3)

    // Verificar que los porcentajes son ascendentes y terminan en 100
    for (let i = 1; i < progressEvents.length; i++) {
      expect(progressEvents[i].percent).toBeGreaterThanOrEqual(progressEvents[i - 1].percent)
    }
    expect(progressEvents[progressEvents.length - 1].percent).toBe(100)
    expect(progressEvents[progressEvents.length - 1].phase).toBe('finalizing')
  })

  it('interpola porcentajes y formatea MB transferidos cuando uploadAppDataFile emite progreso por bloques', async () => {
    vi.mocked(gdrive.getAppDataFileByName).mockResolvedValue(null)
    vi.mocked(gdrive.uploadAppDataFile).mockImplementation(
      async (_token, name, _mimeType, _content, _existingId, options) => {
        if (name === 'cuaderno-backup.zip' && options?.onUploadProgress) {
          const total = 4 * 1024 * 1024 // 4.0 MB
          options.onUploadProgress(0, total)
          options.onUploadProgress(2 * 1024 * 1024, total) // 2.0 MB / 4.0 MB
          options.onUploadProgress(total, total) // 4.0 MB / 4.0 MB
        }
        return {
          id: 'file-123',
          name,
          mimeType: 'application/zip',
        }
      },
    )

    const progressEvents: Array<{ phase: string; percent: number; message: string }> = []
    await performGoogleDriveSync('mock-token', (p) => {
      progressEvents.push(p)
    })

    const mbMessages = progressEvents.filter((p) => p.message.includes('MB /'))
    expect(mbMessages.length).toBeGreaterThanOrEqual(2)
    expect(mbMessages.some((p) => p.message.includes('2.0 MB / 4.0 MB'))).toBe(true)
    expect(mbMessages.some((p) => p.message.includes('4.0 MB / 4.0 MB'))).toBe(true)

    for (let i = 1; i < progressEvents.length; i++) {
      expect(progressEvents[i].percent).toBeGreaterThanOrEqual(progressEvents[i - 1].percent)
    }
  })

  describe('uploadAppDataFile (Protocolo Resumable por Bloques)', () => {
    it('divide un archivo grande en bloques, procesa 308 Resume Incomplete y reporta progreso byte a byte', async () => {
      const actualGdrive = await vi.importActual<typeof gdrive>('./googleDrive')
      const totalSize = 2500
      const chunkSize = 1000 // 3 bloques: 0-999, 1000-1999, 2000-2499
      const blob = new Blob([new Uint8Array(totalSize)], { type: 'application/zip' })

      const fetchSpy = vi.spyOn(globalThis, 'fetch')
      // 1. Respuesta al inicio de sesión resumable (POST)
      fetchSpy.mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: { Location: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=session-abc' },
        }),
      )
      // 2. Bloque 1 (0-999) -> 308
      fetchSpy.mockResolvedValueOnce(
        new Response(null, {
          status: 308,
          headers: { Range: 'bytes=0-999' },
        }),
      )
      // 3. Bloque 2 (1000-1999) -> 308
      fetchSpy.mockResolvedValueOnce(
        new Response(null, {
          status: 308,
          headers: { Range: 'bytes=0-1999' },
        }),
      )
      // 4. Bloque 3 (2000-2499) -> 200 OK
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'drive-zip-999',
            name: 'cuaderno-backup.zip',
            mimeType: 'application/zip',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )

      const progressCalls: Array<[number, number]> = []
      const result = await actualGdrive.uploadAppDataFile(
        'mock-token',
        'cuaderno-backup.zip',
        'application/zip',
        blob,
        undefined,
        {
          chunkSize,
          onUploadProgress: (uploaded, total) => {
            progressCalls.push([uploaded, total])
          },
        },
      )

      expect(result.id).toBe('drive-zip-999')
      expect(fetchSpy).toHaveBeenCalledTimes(4)

      // Verificar cabeceras Content-Range de cada bloque
      const call1Headers = fetchSpy.mock.calls[1][1]?.headers as Record<string, string>
      const call2Headers = fetchSpy.mock.calls[2][1]?.headers as Record<string, string>
      const call3Headers = fetchSpy.mock.calls[3][1]?.headers as Record<string, string>
      expect(call1Headers['Content-Range']).toBe('bytes 0-999/2500')
      expect(call2Headers['Content-Range']).toBe('bytes 1000-1999/2500')
      expect(call3Headers['Content-Range']).toBe('bytes 2000-2499/2500')

      expect(progressCalls).toEqual([
        [0, 2500],
        [1000, 2500],
        [2000, 2500],
        [2500, 2500],
      ])
      // La sesión en caché se limpia al terminar con éxito
      expect(actualGdrive.getCachedResumableSession('cuaderno-backup.zip', undefined, 2500)).toBeNull()

      fetchSpy.mockRestore()
    })

    it('consulta el offset recibido (bytes */total) y reanuda tras un fallo de red o 503 en un bloque intermedio', async () => {
      const actualGdrive = await vi.importActual<typeof gdrive>('./googleDrive')
      const totalSize = 2000
      const chunkSize = 1000 // 2 bloques: 0-999, 1000-1999
      const blob = new Blob([new Uint8Array(totalSize)], { type: 'application/zip' })

      const fetchSpy = vi.spyOn(globalThis, 'fetch')
      // 1. Inicio de sesión resumable
      fetchSpy.mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: { Location: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=session-retry' },
        }),
      )
      // 2. Bloque 1 (0-999) -> 308 OK
      fetchSpy.mockResolvedValueOnce(
        new Response(null, {
          status: 308,
          headers: { Range: 'bytes=0-999' },
        }),
      )
      // 3. Bloque 2 (1000-1999) -> Falla por corte de red
      fetchSpy.mockRejectedValueOnce(new Error('Network connection lost'))
      // 4. Consulta de estado (bytes */2000) -> 308 con Range confirmando bytes 0-999
      fetchSpy.mockResolvedValueOnce(
        new Response(null, {
          status: 308,
          headers: { Range: 'bytes=0-999' },
        }),
      )
      // 5. Reintento del Bloque 2 (1000-1999) -> 200 OK
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'drive-recovered-id',
            name: 'cuaderno-backup.zip',
            mimeType: 'application/zip',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )

      const result = await actualGdrive.uploadAppDataFile(
        'mock-token',
        'cuaderno-backup.zip',
        'application/zip',
        blob,
        'existing-id-1',
        { chunkSize, retryDelayMs: 0 },
      )

      expect(result.id).toBe('drive-recovered-id')
      expect(fetchSpy).toHaveBeenCalledTimes(5)

      // La llamada 4 debe ser la consulta de estado Content-Range: bytes */2000
      const statusCheckHeaders = fetchSpy.mock.calls[3][1]?.headers as Record<string, string>
      expect(statusCheckHeaders['Content-Range']).toBe('bytes */2000')

      // La llamada 5 debe reanudar exactamente desde el byte 1000 sin re-subir el bloque 0-999
      const resumedHeaders = fetchSpy.mock.calls[4][1]?.headers as Record<string, string>
      expect(resumedHeaders['Content-Range']).toBe('bytes 1000-1999/2000')

      fetchSpy.mockRestore()
    })

    it('descarta la sesión expirada (404/410) e inicia una sesión resumable limpia', async () => {
      const actualGdrive = await vi.importActual<typeof gdrive>('./googleDrive')
      const blob = new Blob(['contenido-test'], { type: 'application/json' })

      const fetchSpy = vi.spyOn(globalThis, 'fetch')
      // 1. Primera sesión
      fetchSpy.mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: { Location: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=expired-1' },
        }),
      )
      // 2. Primer PUT devuelve 410 Gone (sesión expirada)
      fetchSpy.mockResolvedValueOnce(new Response(null, { status: 410, statusText: 'Gone' }))
      // 3. Reinicio automático de nueva sesión
      fetchSpy.mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: { Location: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=fresh-2' },
        }),
      )
      // 4. PUT a la nueva sesión -> 200 OK
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'fresh-file-id',
            name: 'sync-manifest.json',
            mimeType: 'application/json',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )

      const result = await actualGdrive.uploadAppDataFile(
        'mock-token',
        'sync-manifest.json',
        'application/json',
        blob,
        undefined,
        { retryDelayMs: 0 },
      )

      expect(result.id).toBe('fresh-file-id')
      expect(fetchSpy).toHaveBeenCalledTimes(4)
      fetchSpy.mockRestore()
    })
  })
})
