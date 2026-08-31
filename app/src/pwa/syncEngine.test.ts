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
})
