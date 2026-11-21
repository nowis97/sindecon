import { useCallback, useEffect, useState } from 'react'
import {
  getStoredToken,
  getStoredEmail,
  setStoredToken,
  clearStoredToken,
  fetchGoogleUserEmail,
  isGoogleSyncEnabled,
  isTokenExpired,
  ensureValidAccessToken,
  initiateGoogleOAuthFlow,
  revokeServerOAuthSession,
  GOOGLE_AUTH_CHANGE_EVENT,
} from '../pwa/googleDrive'
import {
  performGoogleDriveSync,
  getLastSyncTime,
  type SyncState,
  type SyncProgress,
  type SyncEngineResult,
} from '../pwa/syncEngine'

const PROACTIVE_REFRESH_INTERVAL_MS = 45 * 60 * 1000
const SYNC_INTERVAL_MS = 5 * 60 * 1000

function isSessionExpiredMessage(msg: string): boolean {
  return msg.includes('expirada') || msg.includes('401')
}

/**
 * Determina si la sesión debe mostrarse como expirada sin parpadear durante un refresco silencioso.
 */
export function computeIsSessionExpired(
  enabled: boolean,
  isRefreshing: boolean,
  token: string | null,
  tokenExpired: boolean,
): boolean {
  if (!enabled || isRefreshing) return false
  return !token || tokenExpired
}

/**
 * Ejecuta una sincronización renovando el token antes si falta y reintentando una vez ante 401.
 */
export async function syncWithAutoRefresh(deps: {
  getToken: () => string | null
  ensureToken: (forceRefresh?: boolean) => Promise<string | null>
  runSync: (token: string) => Promise<SyncEngineResult>
  isSessionError: (msg: string) => boolean
}): Promise<SyncEngineResult | null> {
  let currentToken = deps.getToken()
  if (!currentToken) {
    currentToken = await deps.ensureToken(false)
  }
  if (!currentToken) return null

  try {
    return await deps.runSync(currentToken)
  } catch (err) {
    const msg = (err as Error)?.message || ''
    if (!deps.isSessionError(msg)) {
      throw err
    }

    const refreshedToken = await deps.ensureToken(true)
    if (!refreshedToken) {
      return null
    }
    return await deps.runSync(refreshedToken)
  }
}

export function useGoogleSync() {
  const [token, setToken] = useState<string | null>(() => getStoredToken())
  const [userEmail, setUserEmail] = useState<string | null>(() => getStoredEmail())
  const [isRefreshing, setIsRefreshing] = useState<boolean>(
    () =>
      isGoogleSyncEnabled() &&
      navigator.onLine &&
      (!getStoredToken() || isTokenExpired(2)),
  )
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null)
  const [lastSyncedTime, setLastSyncedTime] = useState<number>(() => getLastSyncTime())
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const syncEnabled = isGoogleSyncEnabled()
  const isConnected = Boolean(token) || syncEnabled
  const isSessionExpired = computeIsSessionExpired(
    syncEnabled,
    isRefreshing,
    token,
    isTokenExpired(0),
  )

  useEffect(() => {
    const syncLocalState = () => {
      setToken(getStoredToken())
      setUserEmail(getStoredEmail())
    }
    window.addEventListener(GOOGLE_AUTH_CHANGE_EVENT, syncLocalState)
    return () => window.removeEventListener(GOOGLE_AUTH_CHANGE_EVENT, syncLocalState)
  }, [])

  const connectWithToken = useCallback(
    async (newToken: string, expiresInSeconds = 3600, email?: string) => {
      let finalEmail = email
      if (!finalEmail) {
        finalEmail = (await fetchGoogleUserEmail(newToken)) || undefined
      }
      setStoredToken(newToken, expiresInSeconds, finalEmail)
      setToken(newToken)
      if (finalEmail) {
        setUserEmail(finalEmail)
      }
      setIsRefreshing(false)
      setSyncState('idle')
      setErrorMessage(null)

      try {
        setSyncState('syncing')
        setSyncProgress({ phase: 'checking', percent: 5, message: 'Iniciando sincronización…' })
        const res = await performGoogleDriveSync(newToken, (p) => setSyncProgress(p))
        setLastSyncedTime(res.timestamp)
        setTimeout(() => {
          setSyncProgress(null)
          setSyncState('idle')
        }, 500)
      } catch (e) {
        setSyncProgress(null)
        setSyncState('error')
        setErrorMessage((e as Error).message)
      }
    },
    [],
  )

  const refreshSilently = useCallback(async (forceRefresh = false): Promise<string | null> => {
    if (!isGoogleSyncEnabled()) return null
    if (!navigator.onLine) {
      setIsRefreshing(false)
      return null
    }

    setIsRefreshing(true)
    try {
      const nextToken = await ensureValidAccessToken(forceRefresh)
      setToken(getStoredToken())
      setUserEmail(getStoredEmail())
      if (nextToken) {
        setErrorMessage(null)
      }
      return nextToken
    } catch (e) {
      // Error transitorio (5xx / red): mantener configuración y no expulsar usuario
      setErrorMessage((e as Error).message)
      return null
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  const triggerSync = useCallback(async () => {
    if (!navigator.onLine) {
      setSyncState('offline')
      return
    }

    try {
      setSyncState('syncing')
      setSyncProgress({ phase: 'checking', percent: 5, message: 'Iniciando sincronización…' })
      setErrorMessage(null)

      const res = await syncWithAutoRefresh({
        getToken: () => {
          const t = getStoredToken()
          return t && !isTokenExpired(2) ? t : null
        },
        ensureToken: refreshSilently,
        runSync: (activeToken) =>
          performGoogleDriveSync(activeToken, (p) => setSyncProgress(p)),
        isSessionError: isSessionExpiredMessage,
      })

      if (!res) {
        setSyncProgress(null)
        setToken(getStoredToken())
        setSyncState('idle')
        return
      }

      setLastSyncedTime(res.timestamp)
      setTimeout(() => {
        setSyncProgress(null)
        setSyncState('idle')
      }, 500)
    } catch (e) {
      setSyncProgress(null)
      const msg = (e as Error).message
      if (isSessionExpiredMessage(msg)) {
        clearStoredToken(false)
        setToken(null)
        setSyncState('idle')
        setErrorMessage(null)
        return
      }
      setSyncState('error')
      setErrorMessage(msg)
    }
  }, [refreshSilently])

  const disconnect = useCallback(() => {
    clearStoredToken(true)
    void revokeServerOAuthSession()
    setToken(null)
    setUserEmail(null)
    setIsRefreshing(false)
    setSyncProgress(null)
    setSyncState('idle')
    setErrorMessage(null)
  }, [])

  // Sincronización y renovación automática silenciosa al montar
  useEffect(() => {
    if (!isGoogleSyncEnabled() || !navigator.onLine) {
      return
    }

    void triggerSync()
  }, [triggerSync])

  // Sincronización y refresco proactivo al recuperar foco, conexión o cada 45 min
  useEffect(() => {
    if (!isConnected) return

    const ensureAndSync = () => {
      if (!navigator.onLine) return
      const activeToken = getStoredToken()
      if ((activeToken && !isTokenExpired(5)) || isGoogleSyncEnabled()) {
        void triggerSync()
      }
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        ensureAndSync()
      }
    }

    const handleOnline = () => {
      ensureAndSync()
    }

    window.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('online', handleOnline)

    const syncInterval = setInterval(() => {
      if (navigator.onLine && document.visibilityState === 'visible') {
        ensureAndSync()
      }
    }, SYNC_INTERVAL_MS)

    const proactiveRefreshInterval = setInterval(() => {
      if (navigator.onLine && isGoogleSyncEnabled() && isTokenExpired(10)) {
        void refreshSilently(true)
      }
    }, PROACTIVE_REFRESH_INTERVAL_MS)

    return () => {
      window.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('online', handleOnline)
      clearInterval(syncInterval)
      clearInterval(proactiveRefreshInterval)
    }
  }, [isConnected, triggerSync, refreshSilently])

  const initiateOAuthLogin = useCallback(() => {
    initiateGoogleOAuthFlow({
      onSuccess: (accessToken, expiresIn, email) => {
        void connectWithToken(accessToken, expiresIn, email)
      },
      onError: (msg) => {
        setErrorMessage(msg)
      },
    })
  }, [connectWithToken])

  return {
    isConnected,
    isSessionExpired,
    syncState,
    syncProgress,
    lastSyncedAt: lastSyncedTime ? new Date(lastSyncedTime) : null,
    errorMessage,
    userEmail,
    connectWithToken,
    disconnect,
    triggerSync,
    initiateOAuthLogin,
  }
}
