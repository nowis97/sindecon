import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  ChevronRight,
  KeyRound,
  Plus,
  RefreshCw,
  WifiOff,
} from 'lucide-react'
import type { CalendarEventRow, CalendarListRow } from '../../db/db'
import type { Theme } from '../../hooks/useTheme'
import type { SyncState } from '../../pwa/syncEngine'
import {
  CalendarEventItemCard,
  buildCalendarLookup,
  formatEventTimeRange,
  formatRelativeDayLabel,
  getUpcomingEventsPreview,
  isCalendarWritable,
} from './CalendarModal'

export interface CalendarGuardCardProps {
  theme?: Theme
  isEnabled: boolean
  isOnline: boolean
  isSessionExpired?: boolean
  needsCalendarConsent?: boolean
  syncState: SyncState
  pendingCount?: number
  calendars: CalendarListRow[]
  events: CalendarEventRow[]
  lastSyncedAt?: Date | null
  errorMessage?: string | null
  nowMs?: number
  onConnect: () => void
  onSync: () => void
  onOpenModal: () => void
  onQuickAdd: () => void
  onSelectEvent?: (event: CalendarEventRow) => void
}

export function CalendarGuardCard({
  theme = 'light',
  isEnabled,
  isOnline,
  isSessionExpired = false,
  needsCalendarConsent = false,
  syncState,
  pendingCount = 0,
  calendars,
  events,
  lastSyncedAt = null,
  errorMessage = null,
  nowMs,
  onConnect,
  onSync,
  onOpenModal,
  onQuickAdd,
  onSelectEvent,
}: CalendarGuardCardProps) {
  const [defaultNowMs, setDefaultNowMs] = useState<number>(() => Date.now())
  const resolvedNowMs = nowMs ?? defaultNowMs

  useEffect(() => {
    if (nowMs !== undefined) return
    const timer = setInterval(() => {
      setDefaultNowMs(Date.now())
    }, 60_000)
    return () => clearInterval(timer)
  }, [nowMs])

  const isOffline = !isOnline || syncState === 'offline'
  const isDark = theme === 'dark'
  const showAuthBanner = needsCalendarConsent || isSessionExpired

  const calendarMap = useMemo(() => buildCalendarLookup(calendars), [calendars])
  const upcomingEvents = useMemo(
    () => getUpcomingEventsPreview(events, calendars, resolvedNowMs, 4),
    [events, calendars, resolvedNowMs],
  )
  const canCreate = calendars.length === 0 || calendars.some(isCalendarWritable)

  return (
    <section
      data-testid="calendar-guard-card"
      data-home-theme={isDark ? 'dark' : undefined}
      aria-label="Agenda clínica y guardias"
      className="bg-[var(--cl-surface)] border border-[var(--cl-border)] rounded-2xl p-4 flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--cl-accent-soft)] text-[var(--cl-diagnostic)]">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="m-0 text-sm font-bold text-[var(--cl-fg)] truncate">
              Agenda y Guardias
            </h3>
            {isEnabled && lastSyncedAt && (
              <span className="block font-mono text-[10px] text-[var(--cl-muted)]">
                Sync {lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>

        {isEnabled && (
          <div className="flex flex-wrap items-center justify-end gap-1 shrink-0">
            {isOffline && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--cl-border)] bg-[var(--cl-surface-muted)] px-2 py-0.5 font-mono text-[10px] font-semibold text-[var(--cl-muted)]">
                <WifiOff className="h-2.5 w-2.5" aria-hidden="true" />
                <span>Sin conexión</span>
              </span>
            )}
            {pendingCount > 0 && (
              <span className="inline-flex items-center rounded-full border border-[var(--cl-warn-border)] bg-[var(--cl-warn-soft)] px-2 py-0.5 font-mono text-[10px] font-semibold text-[var(--cl-warn)]">
                Pendiente ({pendingCount})
              </span>
            )}
          </div>
        )}
      </div>

      {!isEnabled ? (
        <div className="flex flex-col gap-2.5">
          <p className="m-0 text-xs leading-relaxed text-[var(--cl-muted)]">
            Consulta tus guardias, pases de sala y eventos de Google Calendar incluso sin señal.
          </p>

          {errorMessage && (
            <div className="flex items-center gap-1.5 rounded-lg border border-[var(--cl-danger-border)] bg-[var(--cl-danger-soft)] px-2.5 py-2 text-[11px] text-[var(--cl-danger)]">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            type="button"
            data-testid="calendar-connect-btn"
            onClick={onConnect}
            className="w-full min-h-[40px] rounded-[10px] bg-[var(--cl-accent)] hover:bg-[var(--cl-accent-hover)] px-3 text-xs font-semibold text-white inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            <span>Conectar Google Calendar</span>
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="calendar-quick-add-btn"
              onClick={onQuickAdd}
              disabled={!canCreate}
              title={
                canCreate
                  ? 'Crear evento rápido'
                  : 'Tus calendarios conectados son de solo lectura'
              }
              className="flex-1 min-h-[34px] rounded-lg bg-[var(--cl-accent)] hover:bg-[var(--cl-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed px-2.5 text-xs font-semibold text-white inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>+ Evento</span>
            </button>

            <button
              type="button"
              data-testid="calendar-sync-btn"
              onClick={onSync}
              disabled={syncState === 'syncing' || isOffline}
              aria-label="Sincronizar Google Calendar"
              className="min-h-[34px] rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-muted)] hover:border-[var(--cl-accent)] disabled:opacity-50 disabled:cursor-not-allowed px-2.5 text-xs font-semibold text-[var(--cl-fg-2)] hover:text-[var(--cl-fg)] inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${syncState === 'syncing' ? 'animate-spin' : ''}`}
              />
              <span>{syncState === 'syncing' ? 'Sync…' : 'Sync'}</span>
            </button>
          </div>

          {showAuthBanner && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--cl-warn-border)] bg-[var(--cl-warn-soft)] px-2.5 py-2 text-[11px] text-[var(--cl-warn)]">
              <span className="inline-flex items-center gap-1.5 min-w-0">
                <KeyRound className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {needsCalendarConsent ? 'Permisos requeridos' : 'Sesión expirada'}
                </span>
              </span>
              <button
                type="button"
                onClick={onConnect}
                className="shrink-0 font-semibold underline cursor-pointer"
              >
                Reconectar
              </button>
            </div>
          )}

          {errorMessage && (
            <div className="flex items-center gap-1.5 rounded-lg border border-[var(--cl-danger-border)] bg-[var(--cl-danger-soft)] px-2.5 py-2 text-[11px] text-[var(--cl-danger)]">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span className="line-clamp-2">{errorMessage}</span>
            </div>
          )}

          {upcomingEvents.length === 0 ? (
            <p className="m-0 rounded-lg border border-dashed border-[var(--cl-border-soft)] bg-[var(--cl-surface-muted)] px-3 py-2.5 text-xs text-[var(--cl-muted)]">
              {calendars.length > 0 && calendars.every((c) => !c.selected)
                ? 'Activa un calendario en la agenda para ver próximos eventos.'
                : 'Sin próximos eventos en tu agenda.'}
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {upcomingEvents.map((ev) => (
                <CalendarEventItemCard
                  key={ev.id}
                  event={ev}
                  calendar={calendarMap.get(ev.calendarId)}
                  subtitle={`${formatRelativeDayLabel(ev.startMs, resolvedNowMs)} · ${formatEventTimeRange(ev)}`}
                  compact
                  onSelect={onSelectEvent ?? (() => onOpenModal())}
                />
              ))}
            </div>
          )}

          <button
            type="button"
            data-testid="calendar-open-modal-btn"
            onClick={onOpenModal}
            className="w-full min-h-[36px] rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-muted)] hover:border-[var(--cl-accent)] hover:bg-[var(--cl-surface-warm)] px-3 text-xs font-semibold text-[var(--cl-fg)] inline-flex items-center justify-between gap-2 cursor-pointer transition-colors"
          >
            <span>Ver agenda completa</span>
            <ChevronRight className="h-3.5 w-3.5 text-[var(--cl-muted)]" />
          </button>
        </>
      )}
    </section>
  )
}
