import { useCallback, useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  db,
  type CalendarEventDraft,
  type CalendarEventRow,
  type CalendarListRow,
} from '../db/db'
import {
  clearLocalCalendarData,
  enqueueCreateEvent,
  enqueueDeleteEvent,
  enqueueUpdateEvent,
  toggleCalendarSelected,
} from '../db/calendar'
import { CalendarApiError, getDefaultSyncWindow } from '../pwa/googleCalendar'
import {
  getLastCalendarSyncTime,
  performGoogleCalendarSync,
  setLastCalendarSyncTime,
} from '../pwa/calendarSync'
import type { SyncEngineResult, SyncState } from '../pwa/syncEngine'
import {
  GOOGLE_AUTH_CHANGE_EVENT,
  GOOGLE_CALENDAR_SCOPES,
  clearStoredToken,
  ensureValidAccessToken,
  fetchGoogleUserEmail,
  getStoredEmail,
  getStoredToken,
  hasCalendarScopes,
  initiateGoogleOAuthFlow,
  isCalendarSyncEnabled,
  isGoogleSyncEnabled,
  isTokenExpired,
  revokeServerOAuthSession,
  setCalendarSyncEnabled,
  setStoredToken,
  shouldUseServerOAuth,
} from '../pwa/googleDrive'
import {
  computeIsSessionExpired,
  shouldAttemptBackgroundSync,
  syncWithAutoRefresh,
} from './useGoogleSync'

const PROACTIVE_REFRESH_INTERVAL_MS = 10 * 60 * 1000
const PROACTIVE_REFRESH_MARGIN_MINUTES = 12
const SYNC_INTERVAL_MS = 5 * 60 * 1000
const PASSIVE_SYNC_COOLDOWN_MS = 60 * 1000

/**
 * Identifica si un mensaje de error de Google Calendar representa expiración o falta de credenciales (401).
 * Excluye explícitamente errores de permisos/scopes (403 insufficient_scope) y fallos transitorios (5xx).
 */
export function isCalendarSessionError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('401') ||
    lower.includes('unauthorized') ||
    lower.includes('unauthenticated') ||
    lower.includes('expirada') ||
    lower.includes('expirado') ||
    lower.includes('invalid credentials') ||
    lower.includes('invalid authentication credentials')
  )
}

/**
 * Indica si el calendario permite crear, editar o eliminar eventos (`owner` o `writer`).
 */
export function canWriteCalendar(calendar?: Pick<CalendarListRow, 'accessRole'>): boolean {
  return calendar?.accessRole === 'owner' || calendar?.accessRole === 'writer'
}

function getNavigatorOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

export interface UseGoogleCalendarOptions {
  fallbackEmail?: string | null
}

export interface UseGoogleCalendarReturn {
  isEnabled: boolean
  isOnline: boolean
  isSessionExpired: boolean
  needsCalendarConsent: boolean
  syncState: SyncState
  lastSyncedAt: Date | null
  errorMessage: string | null
  noticeMessage: string | null
  pendingCount: number
  calendars: CalendarListRow[]
  events: CalendarEventRow[]
  connectCalendar: () => void
  disconnectCalendar: () => Promise<void>
  triggerSync: (range?: { startMs?: number; endMs?: number }) => Promise<void>
  createEvent: (draft: CalendarEventDraft) => Promise<CalendarEventRow>
  updateEvent: (eventId: string, draft: CalendarEventDraft) => Promise<CalendarEventRow>
  deleteEvent: (eventId: string) => Promise<void>
  toggleCalendarVisibility: (calendarId: string, selected: boolean) => Promise<void>
  ensureRangeLoaded: (startMs: number, endMs: number) => Promise<void>
  clearNotice: () => void
}

export function useGoogleCalendar(
  opts?: UseGoogleCalendarOptions,
): UseGoogleCalendarReturn {
  const fallbackEmail = opts?.fallbackEmail ?? null

  const [isEnabled, setIsEnabled] = useState<boolean>(() => isCalendarSyncEnabled())
  const [token, setToken] = useState<string | null>(() => getStoredToken())
  const [hasScopes, setHasScopes] = useState<boolean>(() => hasCalendarScopes())
  const [serverSessionExpired, setServerSessionExpired] = useState(false)
  const [insufficientScopeError, setInsufficientScopeError] = useState(false)
  const [isOnline, setIsOnline] = useState<boolean>(() => getNavigatorOnline())
  const [isRefreshing, setIsRefreshing] = useState<boolean>(
    () =>
      isCalendarSyncEnabled() &&
      getNavigatorOnline() &&
      hasCalendarScopes() &&
      (!getStoredToken() || isTokenExpired(2)),
  )
  const [syncState, setSyncState] = useState<SyncState>(() =>
    isCalendarSyncEnabled() && !getNavigatorOnline() ? 'offline' : 'idle',
  )
  const [lastSyncedTime, setLastSyncedTime] = useState<number>(() => getLastCalendarSyncTime())
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null)

  const syncInFlightRef = useRef<Promise<void> | null>(null)
  const lastSyncAttemptAtRef = useRef<number>(0)
  const loadedRangeRef = useRef<{ startMs: number; endMs: number } | null>(null)
  const disconnectGenRef = useRef<number>(0)

  const calendars =
    useLiveQuery(async () => {
      const rows = await db.calendar_list.toArray()
      rows.sort((a, b) => {
        if (a.primary !== b.primary) return a.primary ? -1 : 1
        return a.summary.localeCompare(b.summary)
      })
      return rows
    }, [], [] as CalendarListRow[]) ?? []

  const events =
    useLiveQuery(
      () => db.calendar_events.orderBy('startMs').toArray(),
      [],
      [] as CalendarEventRow[],
    ) ?? []

  const pendingCount = useLiveQuery(() => db.calendar_outbox.count(), [], 0) ?? 0

  const isSessionExpired = computeIsSessionExpired({
    enabled: isEnabled,
    isRefreshing,
    isOnline,
    usesServerOAuth: shouldUseServerOAuth(),
    serverSessionExpired,
    token,
    tokenExpired: isTokenExpired(0),
  })

  const needsCalendarConsent = isEnabled && (insufficientScopeError || !hasScopes)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const syncLocalState = () => {
      const nextEnabled = isCalendarSyncEnabled()
      const nextToken = getStoredToken()
      const nextHasScopes = hasCalendarScopes()
      setIsEnabled(nextEnabled)
      setToken(nextToken)
      setHasScopes(nextHasScopes)
      if (nextToken && !isTokenExpired(0)) {
        setServerSessionExpired(false)
      }
      if (nextHasScopes) {
        setInsufficientScopeError(false)
      }
    }
    window.addEventListener(GOOGLE_AUTH_CHANGE_EVENT, syncLocalState)
    return () => window.removeEventListener(GOOGLE_AUTH_CHANGE_EVENT, syncLocalState)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleOnline = () => {
      setIsOnline(true)
      setSyncState((prev) => (prev === 'offline' ? 'idle' : prev))
    }
    const handleOffline = () => {
      setIsOnline(false)
      setIsRefreshing(false)
      setSyncState((prev) => (isCalendarSyncEnabled() && prev !== 'syncing' ? 'offline' : prev))
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

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

  const refreshSilently = useCallback(
    async (
      forceRefresh = false,
    ): Promise<{ token: string | null; transientError: string | null }> => {
      if (!isCalendarSyncEnabled()) {
        setIsRefreshing(false)
        return { token: null, transientError: null }
      }
      if (!getNavigatorOnline()) {
        setIsOnline(false)
        setIsRefreshing(false)
        return { token: null, transientError: null }
      }

      setIsRefreshing(true)
      try {
        const nextToken = await ensureValidAccessToken(forceRefresh)
        setToken(getStoredToken())
        const scopesOk = hasCalendarScopes()
        setHasScopes(scopesOk)
        if (scopesOk) {
          setInsufficientScopeError(false)
        }
        if (nextToken) {
          setServerSessionExpired(false)
          setErrorMessage(null)
          return { token: nextToken, transientError: null }
        }
        if (shouldUseServerOAuth() && getNavigatorOnline()) {
          setServerSessionExpired(true)
        }
        return { token: null, transientError: null }
      } catch (e) {
        if (!getNavigatorOnline()) {
          setIsOnline(false)
          return { token: null, transientError: null }
        }
        const msg = (e as Error)?.message || 'Error temporal renovando sesión de Google Calendar'
        setErrorMessage(msg)
        return { token: null, transientError: msg }
      } finally {
        setIsRefreshing(false)
      }
    },
    [],
  )

  const triggerSync = useCallback(
    async (range?: { startMs?: number; endMs?: number }) => {
      if (!isCalendarSyncEnabled()) return

      if (!getNavigatorOnline()) {
        setIsOnline(false)
        setIsRefreshing(false)
        setSyncState('offline')
        return
      }

      if (syncInFlightRef.current) {
        if (!range) {
          return await syncInFlightRef.current
        }
        try {
          await syncInFlightRef.current
        } catch {
          // Continuar evaluando el nuevo rango solicitado tras cerrar el job previo
        }
        if (!isCalendarSyncEnabled() || !getNavigatorOnline()) return
      }

      const defaultWin = getDefaultSyncWindow()
      const currentLoaded = loadedRangeRef.current
      if (
        range?.startMs !== undefined &&
        range?.endMs !== undefined &&
        currentLoaded &&
        range.startMs >= currentLoaded.startMs &&
        range.endMs <= currentLoaded.endMs
      ) {
        return
      }

      const syncWindow = {
        startMs: Math.min(
          range?.startMs ?? defaultWin.startMs,
          currentLoaded?.startMs ?? defaultWin.startMs,
        ),
        endMs: Math.max(
          range?.endMs ?? defaultWin.endMs,
          currentLoaded?.endMs ?? defaultWin.endMs,
        ),
      }

      const jobGen = disconnectGenRef.current
      let lastTransientError: string | null = null
      let lastSyncOutcome: Awaited<ReturnType<typeof performGoogleCalendarSync>> | null = null
      let lastCalendarError: unknown = null

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
            runSync: async (activeToken: string): Promise<SyncEngineResult> => {
              setSyncState('syncing')
              try {
                const outcome = await performGoogleCalendarSync(activeToken, {
                  startMs: syncWindow.startMs,
                  endMs: syncWindow.endMs,
                })
                lastSyncOutcome = outcome
                lastCalendarError = null
                return {
                  action: 'up-to-date',
                  timestamp: outcome.timestamp,
                }
              } catch (err) {
                lastCalendarError = err
                if (
                  err instanceof CalendarApiError &&
                  (err.status === 401 || err.reason === 'unauthorized') &&
                  !isCalendarSessionError(err.message)
                ) {
                  throw new Error(`401 Unauthorized: ${err.message}`)
                }
                throw err
              }
            },
            isSessionError: isCalendarSessionError,
            onSessionExpired: () => {
              clearStoredToken(false)
              setToken(null)
              if (shouldUseServerOAuth()) {
                setServerSessionExpired(true)
              }
            },
          })

          if (disconnectGenRef.current !== jobGen || !isCalendarSyncEnabled()) {
            return
          }

          if (!res) {
            setToken(getStoredToken())
            if (!getNavigatorOnline()) {
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
            return
          }

          loadedRangeRef.current = syncWindow
          setLastSyncedTime(lastSyncOutcome?.timestamp ?? getLastCalendarSyncTime())
          setInsufficientScopeError(false)
          if (lastSyncOutcome && lastSyncOutcome.notices.length > 0) {
            setNoticeMessage(lastSyncOutcome.notices.join(' · '))
          }
          setSyncState('idle')
        } catch (e) {
          if (disconnectGenRef.current !== jobGen || !isCalendarSyncEnabled()) {
            return
          }

          if (!getNavigatorOnline()) {
            setIsOnline(false)
            setSyncState('offline')
            return
          }

          const apiErr =
            e instanceof CalendarApiError
              ? e
              : lastCalendarError instanceof CalendarApiError
                ? lastCalendarError
                : null

          if (apiErr?.reason === 'insufficient_scope') {
            setInsufficientScopeError(true)
            setSyncState('error')
            setErrorMessage(
              apiErr.message ||
                'Faltan permisos de Google Calendar. Vuelve a autorizar el acceso.',
            )
            return
          }

          const msg = (e as Error)?.message || ''
          if (isCalendarSessionError(msg)) {
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
          setErrorMessage(msg || 'Error sincronizando Google Calendar')
        }
      })
    },
    [refreshSilently, trackSyncJob],
  )

  const connectCalendar = useCallback(() => {
    setErrorMessage(null)
    const loginHint = getStoredEmail() || fallbackEmail || undefined

    initiateGoogleOAuthFlow({
      scopes: GOOGLE_CALENDAR_SCOPES,
      includeGrantedScopes: true,
      loginHint,
      onSuccess: (accessToken, expiresIn, email, scope) => {
        void (async () => {
          let finalEmail = email
          if (!finalEmail) {
            finalEmail = (await fetchGoogleUserEmail(accessToken)) || undefined
          }
          const resolvedScope = scope ?? GOOGLE_CALENDAR_SCOPES
          setStoredToken(accessToken, expiresIn, finalEmail, {
            enableCalendar: true,
            scope: resolvedScope,
          })

          const scopesOk = hasCalendarScopes()
          setIsEnabled(true)
          setToken(accessToken)
          setHasScopes(scopesOk)
          setInsufficientScopeError(!scopesOk)
          setServerSessionExpired(false)
          setIsRefreshing(false)
          setErrorMessage(null)
          setSyncState('idle')

          if (syncInFlightRef.current) {
            try {
              await syncInFlightRef.current
            } catch {
              // Continuar con el token recién otorgado
            }
          }

          if (scopesOk) {
            await triggerSync()
          } else {
            setSyncState('error')
            setErrorMessage(
              'No se otorgaron todos los permisos de Google Calendar necesarios. Autoriza nuevamente el acceso a la agenda.',
            )
          }
        })()
      },
      onError: (msg) => {
        setSyncState('error')
        setErrorMessage(msg)
      },
    })
  }, [fallbackEmail, triggerSync])

  const disconnectCalendar = useCallback(async () => {
    disconnectGenRef.current += 1
    lastSyncAttemptAtRef.current = 0
    loadedRangeRef.current = null
    setCalendarSyncEnabled(false)
    setLastCalendarSyncTime(0)
    setIsEnabled(false)
    setLastSyncedTime(0)
    setInsufficientScopeError(false)
    setNoticeMessage(null)
    setErrorMessage(null)
    setSyncState('idle')
    setIsRefreshing(false)

    await clearLocalCalendarData()

    if (!isGoogleSyncEnabled()) {
      clearStoredToken(true)
      setToken(null)
      setHasScopes(false)
      setServerSessionExpired(false)
      void revokeServerOAuthSession()
    }
  }, [])

  // Sincronización inicial al montar si Calendar ya estaba habilitado
  useEffect(() => {
    if (!isCalendarSyncEnabled() || !getNavigatorOnline() || !hasCalendarScopes()) {
      return
    }
    const timer = setTimeout(() => {
      void triggerSync()
    }, 0)
    return () => clearTimeout(timer)
  }, [triggerSync])

  // Sincronización pasiva al recuperar foco, conexión o periódicamente
  useEffect(() => {
    if (!isEnabled || typeof window === 'undefined') return

    const ensureAndSync = (respectCooldown = true) => {
      if (!getNavigatorOnline() || syncInFlightRef.current || needsCalendarConsent) return
      const activeToken = getStoredToken()
      const usesServerOAuth = shouldUseServerOAuth()
      const hasValidToken = Boolean(activeToken && !isTokenExpired(usesServerOAuth ? 5 : 2))
      if (
        shouldAttemptBackgroundSync({
          enabled: isCalendarSyncEnabled(),
          isOnline: getNavigatorOnline(),
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
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        ensureAndSync(true)
      }
    }

    const handleOnline = () => {
      ensureAndSync(false)
    }

    window.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('online', handleOnline)

    const syncInterval = setInterval(() => {
      if (
        getNavigatorOnline() &&
        (typeof document === 'undefined' || document.visibilityState === 'visible')
      ) {
        ensureAndSync(true)
      }
    }, SYNC_INTERVAL_MS)

    const proactiveRefreshInterval = setInterval(() => {
      if (
        getNavigatorOnline() &&
        isCalendarSyncEnabled() &&
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
  }, [isEnabled, needsCalendarConsent, serverSessionExpired, triggerSync, refreshSilently])

  const createEvent = useCallback(
    async (draft: CalendarEventDraft): Promise<CalendarEventRow> => {
      const row = await enqueueCreateEvent(draft)
      if (
        isCalendarSyncEnabled() &&
        getNavigatorOnline() &&
        !isSessionExpired &&
        !needsCalendarConsent
      ) {
        void triggerSync()
      }
      return row
    },
    [isSessionExpired, needsCalendarConsent, triggerSync],
  )

  const updateEvent = useCallback(
    async (eventId: string, draft: CalendarEventDraft): Promise<CalendarEventRow> => {
      const row = await enqueueUpdateEvent(eventId, draft)
      if (
        isCalendarSyncEnabled() &&
        getNavigatorOnline() &&
        !isSessionExpired &&
        !needsCalendarConsent
      ) {
        void triggerSync()
      }
      return row
    },
    [isSessionExpired, needsCalendarConsent, triggerSync],
  )

  const deleteEvent = useCallback(
    async (eventId: string): Promise<void> => {
      await enqueueDeleteEvent(eventId)
      if (
        isCalendarSyncEnabled() &&
        getNavigatorOnline() &&
        !isSessionExpired &&
        !needsCalendarConsent
      ) {
        void triggerSync()
      }
    },
    [isSessionExpired, needsCalendarConsent, triggerSync],
  )

  const toggleCalendarVisibility = useCallback(
    async (calendarId: string, selected: boolean): Promise<void> => {
      await toggleCalendarSelected(calendarId, selected)
      if (
        selected &&
        isCalendarSyncEnabled() &&
        getNavigatorOnline() &&
        !isSessionExpired &&
        !needsCalendarConsent
      ) {
        void triggerSync()
      }
    },
    [isSessionExpired, needsCalendarConsent, triggerSync],
  )

  const ensureRangeLoaded = useCallback(
    async (startMs: number, endMs: number): Promise<void> => {
      if (!isCalendarSyncEnabled() || !getNavigatorOnline()) return
      if (isSessionExpired || needsCalendarConsent) return

      const current = loadedRangeRef.current
      if (current && startMs >= current.startMs && endMs <= current.endMs) {
        return
      }

      const base = current ?? getDefaultSyncWindow()
      await triggerSync({
        startMs: Math.min(base.startMs, startMs),
        endMs: Math.max(base.endMs, endMs),
      })
    },
    [isSessionExpired, needsCalendarConsent, triggerSync],
  )

  const clearNotice = useCallback(() => {
    setNoticeMessage(null)
  }, [])

  return {
    isEnabled,
    isOnline,
    isSessionExpired,
    needsCalendarConsent,
    syncState,
    lastSyncedAt: lastSyncedTime ? new Date(lastSyncedTime) : null,
    errorMessage,
    noticeMessage,
    pendingCount,
    calendars,
    events,
    connectCalendar,
    disconnectCalendar,
    triggerSync,
    createEvent,
    updateEvent,
    deleteEvent,
    toggleCalendarVisibility,
    ensureRangeLoaded,
    clearNotice,
  }
}
