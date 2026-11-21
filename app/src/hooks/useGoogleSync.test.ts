import { describe, it, expect, vi } from 'vitest'
import { computeIsSessionExpired, syncWithAutoRefresh } from './useGoogleSync'
import type { SyncEngineResult } from '../pwa/syncEngine'

const OK_SYNC: SyncEngineResult = {
  action: 'uploaded',
  timestamp: 1730000000000,
  message: 'OK',
}

describe('useGoogleSync orchestration helpers', () => {
  it('mantiene isSessionExpired en false mientras isRefreshing está activo', () => {
    expect(computeIsSessionExpired(true, true, null, true)).toBe(false)
    expect(computeIsSessionExpired(true, false, null, true)).toBe(true)
    expect(computeIsSessionExpired(true, false, 'ya29.ok', false)).toBe(false)
    expect(computeIsSessionExpired(false, false, null, true)).toBe(false)
    expect(computeIsSessionExpired(true, false, 'ya29.stale', true)).toBe(true)
    expect(computeIsSessionExpired(true, false, null, false)).toBe(true)
  })

  it('refresca silenciosamente antes de sincronizar si no hay token vigente', async () => {
    const ensureToken = vi.fn().mockResolvedValue('ya29.refreshed')
    const runSync = vi.fn().mockResolvedValue(OK_SYNC)

    const result = await syncWithAutoRefresh({
      getToken: () => null,
      ensureToken,
      runSync,
      isSessionError: (msg) => msg.includes('401') || msg.includes('expirada'),
    })

    expect(ensureToken).toHaveBeenCalledWith(false)
    expect(runSync).toHaveBeenCalledWith('ya29.refreshed')
    expect(result).toEqual(OK_SYNC)
  })

  it('retorna null sin ejecutar runSync si no hay token ni se pudo renovar silenciosamente', async () => {
    const ensureToken = vi.fn().mockResolvedValue(null)
    const runSync = vi.fn()

    const result = await syncWithAutoRefresh({
      getToken: () => null,
      ensureToken,
      runSync,
      isSessionError: (msg) => msg.includes('401') || msg.includes('expirada'),
    })

    expect(ensureToken).toHaveBeenCalledWith(false)
    expect(runSync).not.toHaveBeenCalled()
    expect(result).toBeNull()
  })

  it('reintenta una sola vez tras 401 forzando ensureToken(true)', async () => {
    const ensureToken = vi.fn().mockResolvedValue('ya29.rotated')
    const runSync = vi
      .fn()
      .mockRejectedValueOnce(new Error('Sesión de Google Drive expirada'))
      .mockResolvedValueOnce(OK_SYNC)

    const result = await syncWithAutoRefresh({
      getToken: () => 'ya29.stale',
      ensureToken,
      runSync,
      isSessionError: (msg) => msg.includes('401') || msg.includes('expirada'),
    })

    expect(ensureToken).toHaveBeenCalledWith(true)
    expect(runSync).toHaveBeenCalledTimes(2)
    expect(runSync).toHaveBeenNthCalledWith(1, 'ya29.stale')
    expect(runSync).toHaveBeenNthCalledWith(2, 'ya29.rotated')
    expect(result).toEqual(OK_SYNC)
  })

  it('retorna null sin propagar error si el refresco tras 401 indica sesión expirada', async () => {
    const ensureToken = vi.fn().mockResolvedValue(null)
    const runSync = vi.fn().mockRejectedValueOnce(new Error('Sesión de Google Drive expirada'))

    const result = await syncWithAutoRefresh({
      getToken: () => 'ya29.stale',
      ensureToken,
      runSync,
      isSessionError: (msg) => msg.includes('401') || msg.includes('expirada'),
    })

    expect(ensureToken).toHaveBeenCalledWith(true)
    expect(result).toBeNull()
  })

  it('propaga errores que no son de sesión sin reintentar ni forzar refresh', async () => {
    const ensureToken = vi.fn()
    const runSync = vi.fn().mockRejectedValueOnce(new Error('Error 500 Internal Server Error'))

    await expect(
      syncWithAutoRefresh({
        getToken: () => 'ya29.ok',
        ensureToken,
        runSync,
        isSessionError: (msg) => msg.includes('401') || msg.includes('expirada'),
      }),
    ).rejects.toThrow('Error 500 Internal Server Error')

    expect(ensureToken).not.toHaveBeenCalled()
    expect(runSync).toHaveBeenCalledTimes(1)
  })

  it('no entra en bucle infinito si el segundo intento tras refresh también devuelve 401', async () => {
    const ensureToken = vi.fn().mockResolvedValue('ya29.rotated')
    const runSync = vi
      .fn()
      .mockRejectedValueOnce(new Error('Sesión de Google Drive expirada'))
      .mockRejectedValueOnce(new Error('HTTP 401 Unauthorized'))

    await expect(
      syncWithAutoRefresh({
        getToken: () => 'ya29.stale',
        ensureToken,
        runSync,
        isSessionError: (msg) => msg.includes('401') || msg.includes('expirada'),
      }),
    ).rejects.toThrow('HTTP 401 Unauthorized')

    expect(ensureToken).toHaveBeenCalledTimes(1)
    expect(ensureToken).toHaveBeenCalledWith(true)
    expect(runSync).toHaveBeenCalledTimes(2)
  })
})
