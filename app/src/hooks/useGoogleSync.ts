import { useCallback, useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
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
  shouldUseServerOAuth,
  GOOGLE_AUTH_CHANGE_EVENT,
} from '../pwa/googleDrive'
import {
  performGoogleDriveSync,
  getLastSyncTime,
  getLastCheckTime,
  setLastCheckTime,
  getLocalMaxTimestamp,
  type SyncState,
  type SyncProgress,
  type SyncEngineResult,
} from '../pwa/syncEngine'

const PROACTIVE_REFRESH_INTERVAL_MS = 10 * 60 * 1000
const PROACTIVE_REFRESH_MARGIN_MINUTES = 12
const SYNC_INTERVAL_MS = 5 * 60 * 1000
const PASSIVE_SYNC_COOLDOWN_MS = 60 * 1000
const AUTO_SYNC_DEBOUNCE_MS = 15 * 1000

export interface SessionExpiredInput {
  enabled: boolean
  isRefreshing: boolean
  isOnline: boolean
  usesServerOAuth: boolean
  serverSessionExpired: boolean
  token: string | null
  tokenExpired: boolean
}

function isSessionExpiredMessage(msg: string): boolean {
  return msg.includes('expirada') || msg.includes('401')
}

/**
 * Determina si la sesión debe mostrarse como expirada sin confundir estado offline o errores transitorios.
 */
export function computeIsSessionExpired(input: SessionExpiredInput): boolean {
  if (!input.enabled || input.isRefreshing || !input.isOnline) return false
  if (input.usesServerOAuth) {
    return input.serverSessionExpired && (!input.token || input.tokenExpired)
  }
  return !input.token || input.tokenExpired
}

/**
 * Decide si un disparador pasivo (foco, reconexión o intervalo) debe intentar sincronizar en segundo plano.
 */
export function shouldAttemptBackgroundSync(input: {
  enabled: boolean
  isOnline: boolean
  usesServerOAuth: boolean
  serverSessionExpired: boolean
  hasValidToken: boolean
  now?: number
  lastAttemptAt?: number
  cooldownMs?: number
}): boolean {
  if (!input.isOnline) return false
  if (input.cooldownMs && input.lastAttemptAt && input.lastAttemptAt > 0) {
    const elapsed = (input.now ?? Date.now()) - input.lastAttemptAt
    if (elapsed >= 0 && elapsed < input.cooldownMs) {
      return false
    }
  }
  if (input.usesServerOAuth) {
    if (input.serverSessionExpired) return false
    return input.hasValidToken || input.enabled
  }
  return input.hasValidToken
}

/**
 * Determina si existen cambios locales más recientes que el último respaldo sincronizado.
 */
export function computeHasPendingChanges(input: {
  isConnected: boolean
  localMaxTimestamp: number
  lastSyncedTime: number
}): boolean {
  return (
    input.isConnected &&
    input.localMaxTimestamp > 0 &&
    input.localMaxTimestamp > input.lastSyncedTime
  )
}

/**
 * Decide si corresponde programar una sincronización automática tras una edición local.
 */
export function shouldScheduleAutoSync(input: {
  isConnected: boolean
  hasPendingChanges: boolean
  isOnline: boolean
  isSessionExpired: boolean
  syncState: SyncState
}): boolean {
  return (
    input.isConnected &&
    input.hasPendingChanges &&
    input.isOnline &&
    !input.isSessionExpired &&
    input.syncState === 'idle'
  )
}

/**
 * Activa confirmación de salida en el navegador si hay Drive conectado con cambios pendientes o subida activa.
 */
export function shouldWarnBeforeUnload(input: {
  isConnected: boolean
  hasPendingChanges: boolean
  syncState: SyncState
}): boolean {
  return input.isConnected && (input.hasPendingChanges || input.syncState === 'syncing')
}

/**
 * Ejecuta una sincronización renovando el token antes si falta y reintentando una vez ante 401.
 */
export async function syncWithAutoRefresh(deps: {
  getToken: () => string | null
  ensureToken: (forceRefresh?: boolean) => Promise<string | null>
  runSync: (token: string) => Promise<SyncEngineResult>
  isSessionError: (msg: string) => boolean
  onSessionExpired?: () => void
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
      deps.onSessionExpired?.()
      return null
    }
    return await deps.runSync(refreshedToken)
  }
}

export function useGoogleSync() {
  const [token, setToken] = useState<string | null>(() => getStoredToken())
  const [userEmail, setUserEmail] = useState<string | null>(() => getStoredEmail())
  const [serverSessionExpired, setServerSessionExpired] = useState(false)
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )
  const [isRefreshing, setIsRefreshing] = useState<boolean>(
    () =>
      isGoogleSyncEnabled() &&
      (typeof navigator === 'undefined' || navigator.onLine) &&
      (!getStoredToken() || isTokenExpired(2)),
  )
  const [syncState, setSyncState] = useState<SyncState>(() =>
    isGoogleSyncEnabled() && typeof navigator !== 'undefined' && !navigator.onLine
      ? 'offline'
      : 'idle',
  )
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null)
  const [lastSyncedTime, setLastSyncedTime] = useState<number>(() => getLastSyncTime())
  const [lastCheckedTime, setLastCheckedTime] = useState<number>(() => getLastCheckTime())
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const syncInFlightRef = useRef<Promise<void> | null>(null)
  const lastSyncAttemptAtRef = useRef<number>(0)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
  }, [])

  useEffect(() => clearIdleTimer, [clearIdleTimer])

  const syncEnabled = isGoogleSyncEnabled()
  const isConnected = Boolean(token) || syncEnabled
  const localMaxTimestamp = useLiveQuery(() => getLocalMaxTimestamp(), [], 0) ?? 0
  const hasPendingChanges = computeHasPendingChanges({
    isConnected,
    localMaxTimestamp,
    lastSyncedTime,
  })
  const isSessionExpired = computeIsSessionExpired({
    enabled: syncEnabled,
    isRefreshing,
    isOnline,
    usesServerOAuth: shouldUseServerOAuth(),
    serverSessionExpired,
    token,
    tokenExpired: isTokenExpired(0),
  })

  useEffect(() => {
    const syncLocalState = () => {
      const nextToken = getStoredToken()
      setToken(nextToken)
      setUserEmail(getStoredEmail())
      if (nextToken && !isTokenExpired(0)) {
        setServerSessionExpired(false)
      }
    }
    window.addEventListener(GOOGLE_AUTH_CHANGE_EVENT, syncLocalState)
    return () => window.removeEventListener(GOOGLE_AUTH_CHANGE_EVENT, syncLocalState)
  }, [])

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setSyncState((prev) => (prev === 'offline' ? 'idle' : prev))
    }
    const handleOffline = () => {
      setIsOnline(false)
      setIsRefreshing(false)
      setSyncState((prev) => (isGoogleSyncEnabled() && prev !== 'syncing' ? 'offline' : prev))
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const runDriveSyncWithProgress = useCallback(
    async (activeToken: string) => {
      clearIdleTimer()
      setSyncState('syncing')
      setSyncProgress({ phase: 'checking', percent: 5, message: 'Iniciando sincronización…' })
      const res = await performGoogleDriveSync(activeToken, (p) => setSyncProgress(p))
      setLastSyncedTime(getLastSyncTime())
      setLastCheckedTime(res.checkedAt ?? getLastCheckTime())
      idleTimerRef.current = setTimeout(() => {
        idleTimerRef.current = null
        setSyncProgress(null)
        setSyncState('idle')
      }, 500)
      return res
    },
    [clearIdleTimer],
  )

  const trackSyncJob = useCallback(async (task: () => Promise<void>) => {
    lastSyncAttemptAtRef.current = Date.now()
    let job!: Promise<void>
    job = (async () => {
      try {
        await task()
      } finally {
        if (syncInFlightRef.current === job) {
          syncInFlightRef.current = null
        }
      }
    })()
    syncInFlightRef.current = job
    await job
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
      setServerSessionExpired(false)
      setIsRefreshing(false)
      clearIdleTimer()
      setSyncState('idle')
      setErrorMessage(null)

      if (syncInFlightRef.current) {
        try {
          await syncInFlightRef.current
        } catch {
          // Continuar con el token recién emitido tras cerrar la sincronización previa
        }
      }

      await trackSyncJob(async () => {
        try {
          await runDriveSyncWithProgress(newToken)
        } catch (e) {
          clearIdleTimer()
          setSyncProgress(null)
          setSyncState('error')
          setErrorMessage((e as Error)?.message || '')
        }
      })
    },
    [clearIdleTimer, runDriveSyncWithProgress, trackSyncJob],
  )

  const refreshSilently = useCallback(
    async (
      forceRefresh = false,
    ): Promise<{ token: string | null; transientError: string | null }> => {
      if (!isGoogleSyncEnabled()) {
        setIsRefreshing(false)
        return { token: null, transientError: null }
      }
      if (!navigator.onLine) {
        setIsOnline(false)
        setIsRefreshing(false)
        return { token: null, transientError: null }
      }

      setIsRefreshing(true)
      try {
        const nextToken = await ensureValidAccessToken(forceRefresh)
        setToken(getStoredToken())
        setUserEmail(getStoredEmail())
        if (nextToken) {
          setServerSessionExpired(false)
          setErrorMessage(null)
          return { token: nextToken, transientError: null }
        }
        if (shouldUseServerOAuth() && navigator.onLine) {
          setServerSessionExpired(true)
        }
        return { token: null, transientError: null }
      } catch (e) {
        if (!navigator.onLine) {
          setIsOnline(false)
          return { token: null, transientError: null }
        }
        // Error transitorio (5xx / 429 / red): mantener configuración y no expulsar usuario
        const msg = (e as Error)?.message || 'Error temporal de sincronización'
        setErrorMessage(msg)
        return { token: null, transientError: msg }
      } finally {
        setIsRefreshing(false)
      }
    },
    [],
  )

  const triggerSync = useCallback(async () => {
    if (!navigator.onLine) {
      setIsOnline(false)
      setIsRefreshing(false)
      setSyncState('offline')
      return
    }

    if (syncInFlightRef.current) {
      return await syncInFlightRef.current
    }

    let lastTransientError: string | null = null

    await trackSyncJob(async () => {
      try {
        setErrorMessage(null)

        const res = await syncWithAutoRefresh({
          getToken: () => {
            const t = getStoredToken()
            return t && !isTokenExpired(2) ? t : null
          },
          ensureToken: async (force = false) => {
            const outcome = await refreshSilently(force)
            lastTransientError = outcome.transientError
            return outcome.token
          },
          runSync: runDriveSyncWithProgress,
          isSessionError: isSessionExpiredMessage,
          onSessionExpired: () => {
            clearStoredToken(false)
            setToken(null)
            if (shouldUseServerOAuth()) {
              setServerSessionExpired(true)
            }
          },
        })

        if (!res) {
          clearIdleTimer()
          setSyncProgress(null)
          setToken(getStoredToken())
          if (!navigator.onLine) {
            setIsOnline(false)
            setSyncState('offline')
            return
          }
          if (lastTransientError) {
            setSyncState('error')
            setErrorMessage(lastTransientError)
            return
          }
          setSyncState('idle')
        }
      } catch (e) {
        clearIdleTimer()
        setSyncProgress(null)
        if (!navigator.onLine) {
          setIsOnline(false)
          setSyncState('offline')
          return
        }
        const msg = (e as Error)?.message || ''
        if (isSessionExpiredMessage(msg)) {
          clearStoredToken(false)
          setToken(null)
          if (shouldUseServerOAuth()) {
            setServerSessionExpired(true)
          }
          setSyncState('idle')
          setErrorMessage(null)
          return
        }
        setSyncState('error')
        setErrorMessage(msg)
      }
    })
  }, [clearIdleTimer, refreshSilently, runDriveSyncWithProgress, trackSyncJob])

  const disconnect = useCallback(() => {
    clearIdleTimer()
    lastSyncAttemptAtRef.current = 0
    clearStoredToken(true)
    setLastCheckTime(0)
    void revokeServerOAuthSession()
    setToken(null)
    setUserEmail(null)
    setLastCheckedTime(0)
    setServerSessionExpired(false)
    setIsRefreshing(false)
    setSyncProgress(null)
    setSyncState('idle')
    setErrorMessage(null)
  }, [clearIdleTimer])

  // Sincronización y renovación automática silenciosa al montar
  useEffect(() => {
    if (!isGoogleSyncEnabled()) {
      setIsRefreshing(false)
      return
    }
    if (!navigator.onLine) {
      setIsRefreshing(false)
      setSyncState('offline')
      return
    }

    void triggerSync()
  }, [triggerSync])

  // Sincronización y refresco proactivo al recuperar foco, conexión o periódicamente
  useEffect(() => {
    if (!isConnected) return

    const ensureAndSync = (respectCooldown = true) => {
      if (!navigator.onLine || syncInFlightRef.current) return
      const activeToken = getStoredToken()
      const usesServerOAuth = shouldUseServerOAuth()
      const hasValidToken = Boolean(activeToken && !isTokenExpired(usesServerOAuth ? 5 : 2))
      if (
        shouldAttemptBackgroundSync({
          enabled: isGoogleSyncEnabled(),
          isOnline: navigator.onLine,
          usesServerOAuth,
          serverSessionExpired,
          hasValidToken,
          now: Date.now(),
          lastAttemptAt: lastSyncAttemptAtRef.current,
          cooldownMs: respectCooldown ? PASSIVE_SYNC_COOLDOWN_MS : 0,
        })
      ) {
        void triggerSync()
      }
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        ensureAndSync(true)
      }
    }

    const handleOnline = () => {
      setIsOnline(true)
      setSyncState((prev) => (prev === 'offline' ? 'idle' : prev))
      ensureAndSync(false)
    }

    window.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('online', handleOnline)

    const syncInterval = setInterval(() => {
      if (navigator.onLine && document.visibilityState === 'visible') {
        ensureAndSync(true)
      }
    }, SYNC_INTERVAL_MS)

    const proactiveRefreshInterval = setInterval(() => {
      if (
        navigator.onLine &&
        isGoogleSyncEnabled() &&
        shouldUseServerOAuth() &&
        !serverSessionExpired &&
        isTokenExpired(PROACTIVE_REFRESH_MARGIN_MINUTES)
      ) {
        void refreshSilently(true)
      }
    }, PROACTIVE_REFRESH_INTERVAL_MS)

    return () => {
      window.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('online', handleOnline)
      clearInterval(syncInterval)
      clearInterval(proactiveRefreshInterval)
    }
  }, [isConnected, serverSessionExpired, triggerSync, refreshSilently])

  // Auto-sync tras ediciones locales con debounce corto
  useEffect(() => {
    if (
      !shouldScheduleAutoSync({
        isConnected,
        hasPendingChanges,
        isOnline,
        isSessionExpired,
        syncState,
      })
    ) {
      return
    }

    const timer = setTimeout(() => {
      void triggerSync()
    }, AUTO_SYNC_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [
    isConnected,
    hasPendingChanges,
    localMaxTimestamp,
    isOnline,
    isSessionExpired,
    syncState,
    triggerSync,
  ])

  // Recordatorio antes de cerrar o recargar si hay cambios sin sincronizar o subida en curso
  useEffect(() => {
    if (!shouldWarnBeforeUnload({ isConnected, hasPendingChanges, syncState })) {
      return
    }

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isConnected, hasPendingChanges, syncState])

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
    hasPendingChanges,
    syncState,
    syncProgress,
    lastSyncedAt: lastSyncedTime ? new Date(lastSyncedTime) : null,
    lastCheckedAt: lastCheckedTime ? new Date(lastCheckedTime) : null,
    errorMessage,
    userEmail,
    connectWithToken,
    disconnect,
    triggerSync,
    initiateOAuthLogin,
  }
}
