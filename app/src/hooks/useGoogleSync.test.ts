import { describe, it, expect, vi } from 'vitest'
import {
  computeIsSessionExpired,
  shouldAttemptBackgroundSync,
  syncWithAutoRefresh,
} from './useGoogleSync'
import type { SyncEngineResult } from '../pwa/syncEngine'

const OK_SYNC: SyncEngineResult = {
  action: 'uploaded',
  timestamp: 1730000000000,
  message: 'OK',
}

describe('useGoogleSync orchestration helpers', () => {
  describe('computeIsSessionExpired', () => {
    it('mantiene isSessionExpired en false mientras isRefreshing está activo', () => {
      expect(
        computeIsSessionExpired({
          enabled: true,
          isRefreshing: true,
          isOnline: true,
          usesServerOAuth: true,
          serverSessionExpired: true,
          token: null,
          tokenExpired: true,
        }),
      ).toBe(false)
    })

    it('retorna false cuando el dispositivo está offline aunque no haya token vigente', () => {
      expect(
        computeIsSessionExpired({
          enabled: true,
          isRefreshing: false,
          isOnline: false,
          usesServerOAuth: true,
          serverSessionExpired: true,
          token: null,
          tokenExpired: true,
        }),
      ).toBe(false)

      expect(
        computeIsSessionExpired({
          enabled: true,
          isRefreshing: false,
          isOnline: false,
          usesServerOAuth: false,
          serverSessionExpired: false,
          token: null,
          tokenExpired: true,
        }),
      ).toBe(false)
    })

    it('retorna false ante error transitorio 5xx en modo BFF (serverSessionExpired = false)', () => {
      expect(
        computeIsSessionExpired({
          enabled: true,
          isRefreshing: false,
          isOnline: true,
          usesServerOAuth: true,
          serverSessionExpired: false,
          token: null,
          tokenExpired: true,
        }),
      ).toBe(false)
    })

    it('retorna true en modo BFF cuando hubo 401 confirmado y el token falta o expiró', () => {
      expect(
        computeIsSessionExpired({
          enabled: true,
          isRefreshing: false,
          isOnline: true,
          usesServerOAuth: true,
          serverSessionExpired: true,
          token: null,
          tokenExpired: true,
        }),
      ).toBe(true)

      expect(
        computeIsSessionExpired({
          enabled: true,
          isRefreshing: false,
          isOnline: true,
          usesServerOAuth: true,
          serverSessionExpired: true,
          token: 'ya29.ok',
          tokenExpired: false,
        }),
      ).toBe(false)
    })

    it('retorna true en modo no-BFF cuando está online y el token falta o expiró', () => {
      expect(
        computeIsSessionExpired({
          enabled: true,
          isRefreshing: false,
          isOnline: true,
          usesServerOAuth: false,
          serverSessionExpired: false,
          token: null,
          tokenExpired: true,
        }),
      ).toBe(true)

      expect(
        computeIsSessionExpired({
          enabled: true,
          isRefreshing: false,
          isOnline: true,
          usesServerOAuth: false,
          serverSessionExpired: false,
          token: 'ya29.stale',
          tokenExpired: true,
        }),
      ).toBe(true)

      expect(
        computeIsSessionExpired({
          enabled: true,
          isRefreshing: false,
          isOnline: true,
          usesServerOAuth: false,
          serverSessionExpired: false,
          token: 'ya29.ok',
          tokenExpired: false,
        }),
      ).toBe(false)

      expect(
        computeIsSessionExpired({
          enabled: false,
          isRefreshing: false,
          isOnline: true,
          usesServerOAuth: false,
          serverSessionExpired: true,
          token: null,
          tokenExpired: true,
        }),
      ).toBe(false)
    })
  })

  describe('shouldAttemptBackgroundSync', () => {
    it('no dispara refrescos automáticos tras 401 confirmado en modo BFF ni en modo legacy GIS expirado', () => {
      expect(
        shouldAttemptBackgroundSync({
          enabled: true,
          isOnline: true,
          usesServerOAuth: true,
          serverSessionExpired: true,
          hasValidToken: false,
        }),
      ).toBe(false)

      expect(
        shouldAttemptBackgroundSync({
          enabled: true,
          isOnline: true,
          usesServerOAuth: false,
          serverSessionExpired: false,
          hasValidToken: false,
        }),
      ).toBe(false)

      expect(
        shouldAttemptBackgroundSync({
          enabled: true,
          isOnline: false,
          usesServerOAuth: true,
          serverSessionExpired: false,
          hasValidToken: true,
        }),
      ).toBe(false)

      expect(
        shouldAttemptBackgroundSync({
          enabled: true,
          isOnline: true,
          usesServerOAuth: true,
          serverSessionExpired: false,
          hasValidToken: true,
          now: 100_000,
          lastAttemptAt: 70_000,
          cooldownMs: 60_000,
        }),
      ).toBe(false)
    })

    it('permite sincronizar en modo BFF cuando la sesión no está confirmada expirada o con token vigente en modo legacy', () => {
      expect(
        shouldAttemptBackgroundSync({
          enabled: true,
          isOnline: true,
          usesServerOAuth: true,
          serverSessionExpired: false,
          hasValidToken: false,
        }),
      ).toBe(true)

      expect(
        shouldAttemptBackgroundSync({
          enabled: true,
          isOnline: true,
          usesServerOAuth: false,
          serverSessionExpired: false,
          hasValidToken: true,
        }),
      ).toBe(true)

      expect(
        shouldAttemptBackgroundSync({
          enabled: true,
          isOnline: true,
          usesServerOAuth: true,
          serverSessionExpired: false,
          hasValidToken: true,
          now: 130_000,
          lastAttemptAt: 70_000,
          cooldownMs: 60_000,
        }),
      ).toBe(true)

      expect(
        shouldAttemptBackgroundSync({
          enabled: true,
          isOnline: true,
          usesServerOAuth: true,
          serverSessionExpired: false,
          hasValidToken: true,
          now: 10_000,
          lastAttemptAt: 0,
          cooldownMs: 60_000,
        }),
      ).toBe(true)
    })
  })

  describe('syncWithAutoRefresh', () => {
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

    it('retorna null sin propagar error e invoca onSessionExpired si el refresco tras 401 indica sesión expirada', async () => {
      const ensureToken = vi.fn().mockResolvedValue(null)
      const onSessionExpired = vi.fn()
      const runSync = vi.fn().mockRejectedValueOnce(new Error('Sesión de Google Drive expirada'))

      const result = await syncWithAutoRefresh({
        getToken: () => 'ya29.stale',
        ensureToken,
        runSync,
        isSessionError: (msg) => msg.includes('401') || msg.includes('expirada'),
        onSessionExpired,
      })

      expect(ensureToken).toHaveBeenCalledWith(true)
      expect(onSessionExpired).toHaveBeenCalledTimes(1)
      expect(result).toBeNull()
    })

    it('propaga errores transitorios que no son de sesión sin reintentar ni forzar refresh', async () => {
      const ensureToken = vi.fn()
      const onSessionExpired = vi.fn()
      const runSync = vi.fn().mockRejectedValueOnce(new Error('Error 503 Service Unavailable'))

      await expect(
        syncWithAutoRefresh({
          getToken: () => 'ya29.ok',
          ensureToken,
          runSync,
          isSessionError: (msg) => msg.includes('401') || msg.includes('expirada'),
          onSessionExpired,
        }),
      ).rejects.toThrow('Error 503 Service Unavailable')

      expect(ensureToken).not.toHaveBeenCalled()
      expect(onSessionExpired).not.toHaveBeenCalled()
      expect(runSync).toHaveBeenCalledTimes(1)
    })

    it('propaga errores transitorios si ensureToken rechaza al renovar sin marcar sesión expirada', async () => {
      const ensureToken = vi.fn().mockRejectedValueOnce(new Error('Error temporal renovando sesión de Google (502)'))
      const onSessionExpired = vi.fn()
      const runSync = vi.fn()

      await expect(
        syncWithAutoRefresh({
          getToken: () => null,
          ensureToken,
          runSync,
          isSessionError: (msg) => msg.includes('401') || msg.includes('expirada'),
          onSessionExpired,
        }),
      ).rejects.toThrow('Error temporal renovando sesión de Google (502)')

      expect(ensureToken).toHaveBeenCalledWith(false)
      expect(onSessionExpired).not.toHaveBeenCalled()
      expect(runSync).not.toHaveBeenCalled()
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
})
