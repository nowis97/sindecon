import { useCallback, useEffect, useState } from 'react'
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
  type CalendarSyncResult,
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

export interface CalendarSyncRange {
  startMs: number
  endMs: number
}

export interface CalendarCoordinatorCallbacks {
  setIsEnabled: (value: boolean) => void
  setToken: (value: string | null) => void
  setHasScopes: (value: boolean) => void
  setInsufficientScopeError: (value: boolean) => void
  setServerSessionExpired: (value: boolean) => void
  setIsOnline: (value: boolean) => void
  setIsRefreshing: (value: boolean) => void
  setSyncState: (value: SyncState) => void
  setLastSyncedTime: (value: number) => void
  setErrorMessage: (value: string | null) => void
  setNoticeMessage: (value: string | null) => void
}

export interface CalendarCoordinatorRuntime {
  isCalendarSyncEnabled?: typeof isCalendarSyncEnabled
  setCalendarSyncEnabled?: typeof setCalendarSyncEnabled
  isGoogleSyncEnabled?: typeof isGoogleSyncEnabled
  getStoredToken?: typeof getStoredToken
  isTokenExpired?: typeof isTokenExpired
  ensureValidAccessToken?: typeof ensureValidAccessToken
  fetchGoogleUserEmail?: typeof fetchGoogleUserEmail
  hasCalendarScopes?: typeof hasCalendarScopes
  shouldUseServerOAuth?: typeof shouldUseServerOAuth
  clearStoredToken?: typeof clearStoredToken
  setStoredToken?: typeof setStoredToken
  revokeServerOAuthSession?: typeof revokeServerOAuthSession
  getDefaultSyncWindow?: typeof getDefaultSyncWindow
  performGoogleCalendarSync?: typeof performGoogleCalendarSync
  getLastCalendarSyncTime?: typeof getLastCalendarSyncTime
  setLastCalendarSyncTime?: typeof setLastCalendarSyncTime
  clearLocalCalendarData?: typeof clearLocalCalendarData
  isOnline?: () => boolean
  now?: () => number
}

function mergeRange(
  a: CalendarSyncRange | null,
  b: CalendarSyncRange | null,
): CalendarSyncRange | null {
  if (!a) return b
  if (!b) return a
  return {
    startMs: Math.min(a.startMs, b.startMs),
    endMs: Math.max(a.endMs, b.endMs),
  }
}

function isRangeCovered(
  range: CalendarSyncRange | null,
  target: CalendarSyncRange,
): boolean {
  return Boolean(range && target.startMs >= range.startMs && target.endMs <= range.endMs)
}

/**
 * Coordina sincronizaciones serializadas de Google Calendar, coalescing de rangos/mutaciones
 * concurrentes y limpieza segura ante desconexión.
 */
export function createCalendarSyncCoordinator(
  cb: CalendarCoordinatorCallbacks,
  runtime?: CalendarCoordinatorRuntime,
) {
  const rt = {
    isCalendarSyncEnabled: runtime?.isCalendarSyncEnabled ?? isCalendarSyncEnabled,
    setCalendarSyncEnabled: runtime?.setCalendarSyncEnabled ?? setCalendarSyncEnabled,
    isGoogleSyncEnabled: runtime?.isGoogleSyncEnabled ?? isGoogleSyncEnabled,
    getStoredToken: runtime?.getStoredToken ?? getStoredToken,
    isTokenExpired: runtime?.isTokenExpired ?? isTokenExpired,
    ensureValidAccessToken: runtime?.ensureValidAccessToken ?? ensureValidAccessToken,
    fetchGoogleUserEmail: runtime?.fetchGoogleUserEmail ?? fetchGoogleUserEmail,
    hasCalendarScopes: runtime?.hasCalendarScopes ?? hasCalendarScopes,
    shouldUseServerOAuth: runtime?.shouldUseServerOAuth ?? shouldUseServerOAuth,
    clearStoredToken: runtime?.clearStoredToken ?? clearStoredToken,
    setStoredToken: runtime?.setStoredToken ?? setStoredToken,
    revokeServerOAuthSession: runtime?.revokeServerOAuthSession ?? revokeServerOAuthSession,
    getDefaultSyncWindow: runtime?.getDefaultSyncWindow ?? getDefaultSyncWindow,
    performGoogleCalendarSync: runtime?.performGoogleCalendarSync ?? performGoogleCalendarSync,
    getLastCalendarSyncTime: runtime?.getLastCalendarSyncTime ?? getLastCalendarSyncTime,
    setLastCalendarSyncTime: runtime?.setLastCalendarSyncTime ?? setLastCalendarSyncTime,
    clearLocalCalendarData: runtime?.clearLocalCalendarData ?? clearLocalCalendarData,
    isOnline: runtime?.isOnline ?? getNavigatorOnline,
    now: runtime?.now ?? Date.now,
  }

  let syncInFlight: Promise<void> | null = null
  let lastSyncAttemptAt = 0
  let loadedRange: CalendarSyncRange | null = null
  let activeRange: CalendarSyncRange | null = null
  let sessionEpoch = 0
  let needsFollowupSync = false
  let pendingMutationFollowup = false
  let pendingRange: CalendarSyncRange | null = null

  async function refreshSilently(
    forceRefresh = false,
  ): Promise<{ token: string | null; transientError: string | null }> {
    const epoch = sessionEpoch
    const isStale = () => sessionEpoch !== epoch || !rt.isCalendarSyncEnabled()

    if (isStale()) {
      cb.setIsRefreshing(false)
      return { token: null, transientError: null }
    }
    if (!rt.isOnline()) {
      cb.setIsOnline(false)
      cb.setIsRefreshing(false)
      return { token: null, transientError: null }
    }

    cb.setIsRefreshing(true)
    try {
      const nextToken = await rt.ensureValidAccessToken(forceRefresh)
      if (isStale()) {
        return { token: null, transientError: null }
      }
      cb.setToken(rt.getStoredToken())
      const scopesOk = rt.hasCalendarScopes()
      cb.setHasScopes(scopesOk)
      if (scopesOk) {
        cb.setInsufficientScopeError(false)
      }
      if (nextToken) {
        cb.setServerSessionExpired(false)
        cb.setErrorMessage(null)
        return { token: nextToken, transientError: null }
      }
      if (rt.shouldUseServerOAuth() && rt.isOnline()) {
        cb.setServerSessionExpired(true)
      }
      return { token: null, transientError: null }
    } catch (e) {
      if (isStale()) {
        return { token: null, transientError: null }
      }
      if (!rt.isOnline()) {
        cb.setIsOnline(false)
        return { token: null, transientError: null }
      }
      const msg = (e as Error)?.message || 'Error temporal renovando sesión de Google Calendar'
      cb.setErrorMessage(msg)
      return { token: null, transientError: msg }
    } finally {
      if (!isStale()) {
        cb.setIsRefreshing(false)
      }
    }
  }

  async function triggerSync(range?: { startMs?: number; endMs?: number }): Promise<void> {
    if (!rt.isCalendarSyncEnabled()) return

    if (!rt.isOnline()) {
      cb.setIsOnline(false)
      cb.setIsRefreshing(false)
      cb.setSyncState('offline')
      return
    }

    const hasExplicitRange = range?.startMs !== undefined && range?.endMs !== undefined
    const explicitRange = hasExplicitRange
      ? { startMs: range.startMs!, endMs: range.endMs! }
      : null

    if (!syncInFlight && explicitRange && isRangeCovered(loadedRange, explicitRange)) {
      return
    }

    if (syncInFlight) {
      if (explicitRange) {
        if (!isRangeCovered(activeRange, explicitRange) && !isRangeCovered(loadedRange, explicitRange)) {
          pendingRange = mergeRange(pendingRange, explicitRange)
          needsFollowupSync = true
        }
      } else {
        pendingMutationFollowup = true
        needsFollowupSync = true
      }

      while (syncInFlight) {
        try {
          await syncInFlight
        } catch {
          // El runner serializado drenará las operaciones pendientes antes de limpiar syncInFlight
        }
      }
      return
    }

    if (explicitRange) {
      pendingRange = mergeRange(pendingRange, explicitRange)
    }

    const jobEpoch = sessionEpoch
    let job!: Promise<void>
    job = (async () => {
      try {
        while (true) {
          if (sessionEpoch !== jobEpoch || !rt.isCalendarSyncEnabled() || !rt.isOnline()) {
            needsFollowupSync = false
            pendingRange = null
            pendingMutationFollowup = false
            break
          }

          const requestedRange = pendingRange
          const isMutationFollowup = pendingMutationFollowup
          pendingRange = null
          pendingMutationFollowup = false
          needsFollowupSync = false

          if (
            !isMutationFollowup &&
            requestedRange &&
            isRangeCovered(loadedRange, requestedRange)
          ) {
            if (!needsFollowupSync) break
            continue
          }

          const defaultWin = rt.getDefaultSyncWindow()
          const syncWindow: CalendarSyncRange = {
            startMs: Math.min(
              requestedRange?.startMs ?? defaultWin.startMs,
              loadedRange?.startMs ?? defaultWin.startMs,
            ),
            endMs: Math.max(
              requestedRange?.endMs ?? defaultWin.endMs,
              loadedRange?.endMs ?? defaultWin.endMs,
            ),
          }

          activeRange = syncWindow
          lastSyncAttemptAt = rt.now()

          const shouldAbort = () =>
            sessionEpoch !== jobEpoch || !rt.isCalendarSyncEnabled()
          const attemptState: {
            transientError: string | null
            syncOutcome: CalendarSyncResult | null
            calendarError: unknown
          } = {
            transientError: null,
            syncOutcome: null,
            calendarError: null,
          }
          let canContinueFollowup = true

          try {
            cb.setErrorMessage(null)

            const res = await syncWithAutoRefresh({
              getToken: () => {
                const t = rt.getStoredToken()
                return t && !rt.isTokenExpired(2) ? t : null
              },
              ensureToken: async (force = false) => {
                if (shouldAbort()) return null
                const outcome = await refreshSilently(force)
                attemptState.transientError = outcome.transientError
                return outcome.token
              },
              runSync: async (activeToken: string): Promise<SyncEngineResult> => {
                if (shouldAbort()) {
                  return { action: 'skipped', timestamp: rt.now() }
                }
                cb.setSyncState('syncing')
                try {
                  const outcome = await rt.performGoogleCalendarSync(activeToken, {
                    startMs: syncWindow.startMs,
                    endMs: syncWindow.endMs,
                    deps: { shouldAbort },
                  })
                  attemptState.syncOutcome = outcome
                  attemptState.calendarError = null
                  return {
                    action: 'up-to-date',
                    timestamp: outcome.timestamp,
                  }
                } catch (err) {
                  attemptState.calendarError = err
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
                if (shouldAbort()) return
                rt.clearStoredToken(false)
                cb.setToken(null)
                if (rt.shouldUseServerOAuth()) {
                  cb.setServerSessionExpired(true)
                }
              },
            })

            if (shouldAbort()) {
              canContinueFollowup = false
            } else if (!res) {
              cb.setToken(rt.getStoredToken())
              if (!rt.isOnline()) {
                cb.setIsOnline(false)
                cb.setSyncState('offline')
                canContinueFollowup = false
              } else if (attemptState.transientError) {
                cb.setSyncState('error')
                cb.setErrorMessage(attemptState.transientError)
                canContinueFollowup = pendingMutationFollowup
              } else {
                cb.setSyncState('idle')
                canContinueFollowup = false
              }
            } else {
              loadedRange = syncWindow
              cb.setLastSyncedTime(
                attemptState.syncOutcome?.timestamp ?? rt.getLastCalendarSyncTime(),
              )
              cb.setInsufficientScopeError(false)
              if (attemptState.syncOutcome && attemptState.syncOutcome.notices.length > 0) {
                cb.setNoticeMessage(attemptState.syncOutcome.notices.join(' · '))
              }
              cb.setSyncState('idle')
            }
          } catch (e) {
            if (shouldAbort()) {
              canContinueFollowup = false
            } else if (!rt.isOnline()) {
              cb.setIsOnline(false)
              cb.setSyncState('offline')
              canContinueFollowup = false
            } else {
              const apiErr =
                e instanceof CalendarApiError
                  ? e
                  : attemptState.calendarError instanceof CalendarApiError
                    ? attemptState.calendarError
                    : null

              if (apiErr?.reason === 'insufficient_scope') {
                cb.setInsufficientScopeError(true)
                cb.setSyncState('error')
                cb.setErrorMessage(
                  apiErr.message ||
                    'Faltan permisos de Google Calendar. Vuelve a autorizar el acceso.',
                )
                canContinueFollowup = false
              } else {
                const msg = (e as Error)?.message || ''
                if (isCalendarSessionError(msg)) {
                  rt.clearStoredToken(false)
                  cb.setToken(null)
                  if (rt.shouldUseServerOAuth()) {
                    cb.setServerSessionExpired(true)
                  }
                  cb.setSyncState('idle')
                  cb.setErrorMessage(null)
                  canContinueFollowup = false
                } else {
                  cb.setSyncState('error')
                  cb.setErrorMessage(msg || 'Error sincronizando Google Calendar')
                  canContinueFollowup = pendingMutationFollowup
                }
              }
            }
          } finally {
            activeRange = null
          }

          if (!canContinueFollowup || !needsFollowupSync) {
            needsFollowupSync = false
            pendingRange = null
            pendingMutationFollowup = false
            break
          }
        }
      } finally {
        if (syncInFlight === job) {
          syncInFlight = null
        }
      }
    })()

    syncInFlight = job
    await job
  }

  async function ensureRangeLoaded(startMs: number, endMs: number): Promise<void> {
    if (!rt.isCalendarSyncEnabled() || !rt.isOnline()) return

    if (isRangeCovered(loadedRange, { startMs, endMs })) {
      return
    }

    const base = loadedRange ?? rt.getDefaultSyncWindow()
    await triggerSync({
      startMs: Math.min(base.startMs, startMs),
      endMs: Math.max(base.endMs, endMs),
    })
  }

  async function disconnect(): Promise<void> {
    const disconnectEpoch = ++sessionEpoch
    lastSyncAttemptAt = 0
    loadedRange = null
    activeRange = null
    needsFollowupSync = false
    pendingRange = null
    pendingMutationFollowup = false

    rt.setCalendarSyncEnabled(false)
    rt.setLastCalendarSyncTime(0)
    cb.setIsEnabled(false)
    cb.setLastSyncedTime(0)
    cb.setInsufficientScopeError(false)
    cb.setNoticeMessage(null)
    cb.setErrorMessage(null)
    cb.setSyncState('idle')
    cb.setIsRefreshing(false)

    await rt.clearLocalCalendarData()

    while (syncInFlight) {
      try {
        await syncInFlight
      } catch {
        // Esperar cierre ordenado del sync en curso antes de limpiar definitivamente
      }
    }

    if (sessionEpoch !== disconnectEpoch || rt.isCalendarSyncEnabled()) {
      return
    }

    await rt.clearLocalCalendarData()
    rt.setLastCalendarSyncTime(0)

    if (!rt.isGoogleSyncEnabled()) {
      rt.clearStoredToken(true)
      cb.setToken(null)
      cb.setHasScopes(false)
      cb.setServerSessionExpired(false)
      void rt.revokeServerOAuthSession()
    }
  }

  async function handleOAuthSuccess(
    accessToken: string,
    expiresIn: number,
    email?: string,
    scope?: string,
  ): Promise<void> {
    const startEpoch = sessionEpoch
    let finalEmail = email
    if (!finalEmail) {
      finalEmail = (await rt.fetchGoogleUserEmail(accessToken)) || undefined
    }
    if (sessionEpoch !== startEpoch) {
      return
    }

    const resolvedScope = scope ?? GOOGLE_CALENDAR_SCOPES
    rt.setStoredToken(accessToken, expiresIn, finalEmail, {
      enableCalendar: true,
      scope: resolvedScope,
    })

    const scopesOk = rt.hasCalendarScopes()
    sessionEpoch += 1
    needsFollowupSync = false
    pendingRange = null
    pendingMutationFollowup = false

    cb.setIsEnabled(true)
    cb.setToken(accessToken)
    cb.setHasScopes(scopesOk)
    cb.setInsufficientScopeError(!scopesOk)
    cb.setServerSessionExpired(false)
    cb.setIsRefreshing(false)
    cb.setErrorMessage(null)
    cb.setSyncState('idle')

    while (syncInFlight) {
      try {
        await syncInFlight
      } catch {
        // Continuar con el token recién otorgado
      }
    }

    if (scopesOk) {
      await triggerSync()
    } else {
      cb.setSyncState('error')
      cb.setErrorMessage(
        'No se otorgaron todos los permisos de Google Calendar necesarios. Autoriza nuevamente el acceso a la agenda.',
      )
    }
  }

  return {
    refreshSilently,
    triggerSync,
    ensureRangeLoaded,
    disconnect,
    handleOAuthSuccess,
    isSyncing: () => Boolean(syncInFlight),
    getLastSyncAttemptAt: () => lastSyncAttemptAt,
    getLoadedRange: () => loadedRange,
  }
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

  const [coordinator] = useState(() =>
    createCalendarSyncCoordinator({
      setIsEnabled,
      setToken,
      setHasScopes,
      setInsufficientScopeError,
      setServerSessionExpired,
      setIsOnline,
      setIsRefreshing,
      setSyncState,
      setLastSyncedTime,
      setErrorMessage,
      setNoticeMessage,
    }),
  )

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

  const triggerSync = useCallback(
    (range?: { startMs?: number; endMs?: number }) => coordinator.triggerSync(range),
    [coordinator],
  )

  const connectCalendar = useCallback(() => {
    setErrorMessage(null)
    const loginHint = getStoredEmail() || fallbackEmail || undefined

    initiateGoogleOAuthFlow({
      scopes: GOOGLE_CALENDAR_SCOPES,
      includeGrantedScopes: true,
      loginHint,
      onSuccess: (accessToken, expiresIn, email, scope) => {
        void coordinator.handleOAuthSuccess(accessToken, expiresIn, email, scope)
      },
      onError: (msg) => {
        setSyncState('error')
        setErrorMessage(msg)
      },
    })
  }, [coordinator, fallbackEmail])

  const disconnectCalendar = useCallback(() => coordinator.disconnect(), [coordinator])

  // Sincronización inicial al montar si Calendar ya estaba habilitado
  useEffect(() => {
    if (!isCalendarSyncEnabled() || !getNavigatorOnline() || !hasCalendarScopes()) {
      return
    }
    const timer = setTimeout(() => {
      void coordinator.triggerSync()
    }, 0)
    return () => clearTimeout(timer)
  }, [coordinator])

  // Sincronización pasiva al recuperar foco, conexión o periódicamente
  useEffect(() => {
    if (!isEnabled || typeof window === 'undefined') return

    const ensureAndSync = (respectCooldown = true) => {
      if (!getNavigatorOnline() || coordinator.isSyncing() || needsCalendarConsent) return
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
          lastAttemptAt: coordinator.getLastSyncAttemptAt(),
          cooldownMs: respectCooldown ? PASSIVE_SYNC_COOLDOWN_MS : 0,
        })
      ) {
        void coordinator.triggerSync()
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
        void coordinator.refreshSilently(true)
      }
    }, PROACTIVE_REFRESH_INTERVAL_MS)

    return () => {
      window.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('online', handleOnline)
      clearInterval(syncInterval)
      clearInterval(proactiveRefreshInterval)
    }
  }, [coordinator, isEnabled, needsCalendarConsent, serverSessionExpired])

  const createEvent = useCallback(
    async (draft: CalendarEventDraft): Promise<CalendarEventRow> => {
      const row = await enqueueCreateEvent(draft)
      if (
        isCalendarSyncEnabled() &&
        getNavigatorOnline() &&
        !isSessionExpired &&
        !needsCalendarConsent
      ) {
        void coordinator.triggerSync()
      }
      return row
    },
    [coordinator, isSessionExpired, needsCalendarConsent],
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
        void coordinator.triggerSync()
      }
      return row
    },
    [coordinator, isSessionExpired, needsCalendarConsent],
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
        void coordinator.triggerSync()
      }
    },
    [coordinator, isSessionExpired, needsCalendarConsent],
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
        void coordinator.triggerSync()
      }
    },
    [coordinator, isSessionExpired, needsCalendarConsent],
  )

  const ensureRangeLoaded = useCallback(
    async (startMs: number, endMs: number): Promise<void> => {
      if (isSessionExpired || needsCalendarConsent) return
      await coordinator.ensureRangeLoaded(startMs, endMs)
    },
    [coordinator, isSessionExpired, needsCalendarConsent],
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
