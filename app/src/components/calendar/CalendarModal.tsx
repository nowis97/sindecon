import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Info,
  KeyRound,
  LogOut,
  MapPin,
  Plus,
  RefreshCw,
  Repeat,
  WifiOff,
  X,
} from 'lucide-react'
import type { CalendarEventRow, CalendarListRow } from '../../db/db'
import type { Theme } from '../../hooks/useTheme'
import {
  addDaysToYmd,
  eventOverlapsRange,
  formatLocalDateYmd,
  parseLocalDateYmd,
} from '../../pwa/googleCalendar'
import type { SyncState } from '../../pwa/syncEngine'
import {
  BaseModal,
  PILL_BTN_DANGER,
  PILL_BTN_PRIMARY,
  PILL_BTN_SECONDARY,
} from '../common/DialogModal'

export type CalendarViewMode = 'agenda' | 'week' | 'month'

export interface CalendarGridDay {
  ymd: string
  date: Date
  dayOfMonth: number
  inCurrentMonth: boolean
  isToday: boolean
  startMs: number
  endMs: number
}

export interface CalendarAgendaGroup {
  ymd: string
  label: string
  isToday: boolean
  startMs: number
  endMs: number
  events: CalendarEventRow[]
}

const DEFAULT_CALENDAR_COLOR = '#0f766e'

const MONTH_NAMES_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

const MONTH_SHORT_ES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
]

const WEEKDAY_SHORT_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const WEEKDAY_MONDAY_HEADERS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function getLocalDayStart(dateOrMs: Date | number): Date {
  const source = typeof dateOrMs === 'number' ? new Date(dateOrMs) : dateOrMs
  return new Date(source.getFullYear(), source.getMonth(), source.getDate(), 0, 0, 0, 0)
}

function sortDayEvents(events: CalendarEventRow[]): CalendarEventRow[] {
  return [...events].sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
    if (a.startMs !== b.startMs) return a.startMs - b.startMs
    return a.summary.localeCompare(b.summary)
  })
}

function getDayEvents(
  events: CalendarEventRow[],
  visibleCalendarIds: Set<string>,
  startMs: number,
  endMs: number,
): CalendarEventRow[] {
  return sortDayEvents(
    events.filter(
      (ev) =>
        visibleCalendarIds.has(ev.calendarId) &&
        eventOverlapsRange(ev, startMs, endMs),
    ),
  )
}

export function isCalendarWritable(calendar?: Pick<CalendarListRow, 'accessRole'>): boolean {
  return calendar?.accessRole === 'owner' || calendar?.accessRole === 'writer'
}

export function buildCalendarLookup(calendars: CalendarListRow[]): Map<string, CalendarListRow> {
  return new Map(calendars.map((cal) => [cal.id, cal]))
}

export function getCalendarColor(
  calendarMap: Map<string, CalendarListRow>,
  calendarId: string,
): string {
  return calendarMap.get(calendarId)?.backgroundColor || DEFAULT_CALENDAR_COLOR
}

/** Construye una grilla lunes-domingo de 35 o 42 días locales sin saltos DST. */
export function getMonthGridDays(
  anchorDate: Date | number,
  todayMs: number = Date.now(),
): CalendarGridDay[] {
  const anchor = getLocalDayStart(anchorDate)
  const year = anchor.getFullYear()
  const month = anchor.getMonth()
  const firstOfMonth = new Date(year, month, 1, 0, 0, 0, 0)
  const leadingDays = (firstOfMonth.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const totalCells = Math.max(35, Math.ceil((leadingDays + daysInMonth) / 7) * 7)
  const todayYmd = formatLocalDateYmd(todayMs)

  const days: CalendarGridDay[] = []
  for (let i = 0; i < totalCells; i += 1) {
    const cellDate = new Date(year, month, 1 - leadingDays + i, 0, 0, 0, 0)
    const nextDate = new Date(year, month, 1 - leadingDays + i + 1, 0, 0, 0, 0)
    const ymd = formatLocalDateYmd(cellDate)
    days.push({
      ymd,
      date: cellDate,
      dayOfMonth: cellDate.getDate(),
      inCurrentMonth: cellDate.getFullYear() === year && cellDate.getMonth() === month,
      isToday: ymd === todayYmd,
      startMs: cellDate.getTime(),
      endMs: nextDate.getTime(),
    })
  }
  return days
}

/** Construye exactamente 7 días locales de lunes a domingo para la semana de `anchorDate`. */
export function getWeekDays(
  anchorDate: Date | number,
  todayMs: number = Date.now(),
): CalendarGridDay[] {
  const anchor = getLocalDayStart(anchorDate)
  const year = anchor.getFullYear()
  const month = anchor.getMonth()
  const offsetFromMonday = (anchor.getDay() + 6) % 7
  const mondayDate = anchor.getDate() - offsetFromMonday
  const todayYmd = formatLocalDateYmd(todayMs)

  const days: CalendarGridDay[] = []
  for (let i = 0; i < 7; i += 1) {
    const cellDate = new Date(year, month, mondayDate + i, 0, 0, 0, 0)
    const nextDate = new Date(year, month, mondayDate + i + 1, 0, 0, 0, 0)
    const ymd = formatLocalDateYmd(cellDate)
    days.push({
      ymd,
      date: cellDate,
      dayOfMonth: cellDate.getDate(),
      inCurrentMonth: cellDate.getFullYear() === year && cellDate.getMonth() === month,
      isToday: ymd === todayYmd,
      startMs: cellDate.getTime(),
      endMs: nextDate.getTime(),
    })
  }
  return days
}

/** Filtra calendarios ocultos y eventos pasados/cancelados, ordenando cronológicamente. */
export function getUpcomingEventsPreview(
  events: CalendarEventRow[],
  calendars: CalendarListRow[],
  nowMs: number = Date.now(),
  limit = 4,
): CalendarEventRow[] {
  const visibleIds = new Set(calendars.filter((c) => c.selected).map((c) => c.id))
  return events
    .filter(
      (ev) =>
        visibleIds.has(ev.calendarId) &&
        eventOverlapsRange(ev, nowMs, Number.POSITIVE_INFINITY),
    )
    .sort((a, b) => {
      if (a.startMs !== b.startMs) return a.startMs - b.startMs
      if (a.endMs !== b.endMs) return a.endMs - b.endMs
      return a.summary.localeCompare(b.summary)
    })
    .slice(0, Math.max(0, limit))
}

/** Formatea un rango horario local (`Todo el día` o `HH:mm – HH:mm`). */
export function formatEventTimeRange(
  ev: Pick<CalendarEventRow, 'allDay' | 'startMs' | 'endMs'>,
): string {
  if (ev.allDay) return 'Todo el día'
  const start = new Date(ev.startMs)
  const startHm = `${pad2(start.getHours())}:${pad2(start.getMinutes())}`
  if (ev.endMs <= ev.startMs) return startHm
  const end = new Date(ev.endMs)
  const endHm = `${pad2(end.getHours())}:${pad2(end.getMinutes())}`
  if (formatLocalDateYmd(start) !== formatLocalDateYmd(end)) {
    return `${startHm} – ${endHm} (${end.getDate()} ${MONTH_SHORT_ES[end.getMonth()]})`
  }
  return `${startHm} – ${endHm}`
}

/** Formatea una etiqueta legible relativa al día actual (`Hoy · 26 nov`, `Mañana · ...`, `Jue · ...`). */
export function formatRelativeDayLabel(
  dateOrMs: Date | number,
  nowMs: number = Date.now(),
): string {
  const dayStart = getLocalDayStart(dateOrMs)
  const targetYmd = formatLocalDateYmd(dayStart)
  const todayYmd = formatLocalDateYmd(nowMs)
  const tomorrowYmd = addDaysToYmd(todayYmd, 1)
  const yesterdayYmd = addDaysToYmd(todayYmd, -1)
  const nowYear = new Date(nowMs).getFullYear()
  const yearSuffix = dayStart.getFullYear() !== nowYear ? ` ${dayStart.getFullYear()}` : ''
  const datePart = `${dayStart.getDate()} ${MONTH_SHORT_ES[dayStart.getMonth()]}${yearSuffix}`

  if (targetYmd === todayYmd) return `Hoy · ${datePart}`
  if (targetYmd === tomorrowYmd) return `Mañana · ${datePart}`
  if (targetYmd === yesterdayYmd) return `Ayer · ${datePart}`
  return `${WEEKDAY_SHORT_ES[dayStart.getDay()]} · ${datePart}`
}

/** Agrupa eventos visibles por día local dentro de `[rangeStartMs, rangeEndMs)`. */
export function groupAgendaDays(
  events: CalendarEventRow[],
  calendars: CalendarListRow[],
  rangeStartMs?: number,
  rangeEndMs?: number,
  todayMs: number = Date.now(),
): CalendarAgendaGroup[] {
  const defaultStart = getLocalDayStart(todayMs)
  const startMs = rangeStartMs ?? defaultStart.getTime()
  const endMs =
    rangeEndMs ??
    new Date(
      defaultStart.getFullYear(),
      defaultStart.getMonth(),
      defaultStart.getDate() + 30,
      0,
      0,
      0,
      0,
    ).getTime()

  if (endMs <= startMs) return []

  const visibleIds = new Set(calendars.filter((c) => c.selected).map((c) => c.id))
  const visibleEvents = events.filter(
    (ev) => visibleIds.has(ev.calendarId) && eventOverlapsRange(ev, startMs, endMs),
  )
  const todayYmd = formatLocalDateYmd(todayMs)
  const groups: CalendarAgendaGroup[] = []

  let cursor = getLocalDayStart(startMs)
  while (cursor.getTime() < endMs) {
    const nextCursor = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate() + 1,
      0,
      0,
      0,
      0,
    )
    const dayStartMs = cursor.getTime()
    const dayEndMs = nextCursor.getTime()
    const dayEvents = sortDayEvents(
      visibleEvents.filter((ev) => eventOverlapsRange(ev, dayStartMs, dayEndMs)),
    )

    if (dayEvents.length > 0) {
      const ymd = formatLocalDateYmd(cursor)
      groups.push({
        ymd,
        label: formatRelativeDayLabel(dayStartMs, todayMs),
        isToday: ymd === todayYmd,
        startMs: dayStartMs,
        endMs: dayEndMs,
        events: dayEvents,
      })
    }

    cursor = nextCursor
  }

  return groups
}

export interface CalendarEventItemCardProps {
  event: CalendarEventRow
  calendar?: CalendarListRow
  subtitle: string
  showLocation?: boolean
  compact?: boolean
  onSelect?: (event: CalendarEventRow) => void
}

/** Tarjeta compartida de evento para `CalendarGuardCard` y `CalendarModal`. */
export function CalendarEventItemCard({
  event,
  calendar,
  subtitle,
  showLocation = false,
  compact = false,
  onSelect,
}: CalendarEventItemCardProps) {
  const color = calendar?.backgroundColor || DEFAULT_CALENDAR_COLOR
  return (
    <button
      type="button"
      onClick={() => onSelect?.(event)}
      className={`w-full rounded-lg border border-[var(--cl-border-soft)] bg-[var(--cl-surface-muted)] hover:border-[var(--cl-accent)] hover:bg-[var(--cl-surface-warm)]/60 flex items-stretch gap-2.5 text-left cursor-pointer transition-colors ${
        compact ? 'px-2.5 py-2' : 'px-3 py-2.5'
      }`}
    >
      <span
        className="w-1 rounded-full shrink-0"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-semibold text-[var(--cl-fg)]">
            {event.summary || '(Sin título)'}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {event.recurringEventId && (
              <Repeat
                className="w-3 h-3 text-[var(--cl-muted)]"
                aria-label="Evento recurrente"
              />
            )}
            {event.syncStatus === 'pending' && (
              <span className="px-1.5 py-0.5 rounded-full border border-[var(--cl-warn-border)] bg-[var(--cl-warn-soft)] font-mono text-[10px] font-semibold leading-none text-[var(--cl-warn)]">
                Pendiente
              </span>
            )}
            {event.syncStatus === 'error' && (
              <span className="px-1.5 py-0.5 rounded-full border border-[var(--cl-danger-border)] bg-[var(--cl-danger-soft)] font-mono text-[10px] font-semibold leading-none text-[var(--cl-danger)]">
                Error
              </span>
            )}
          </div>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--cl-muted)]">
          <span className="font-mono tabular-nums">{subtitle}</span>
          {calendar && !compact && (
            <span className="truncate">· {calendar.summary}</span>
          )}
          {showLocation && event.location && (
            <span className="inline-flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{event.location}</span>
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

export interface CalendarModalProps {
  isOpen: boolean
  onClose: () => void
  initialView?: CalendarViewMode
  theme?: Theme
  isOnline: boolean
  isSessionExpired?: boolean
  needsCalendarConsent?: boolean
  syncState: SyncState
  pendingCount?: number
  lastSyncedAt?: Date | null
  errorMessage?: string | null
  noticeMessage?: string | null
  calendars: CalendarListRow[]
  events: CalendarEventRow[]
  nowMs?: number
  onSync: () => void
  onReconnect?: () => void
  onDisconnect: () => Promise<void> | void
  onToggleCalendar: (calendarId: string, selected: boolean) => Promise<void> | void
  onCreateEvent: (defaultDateYmd?: string) => void
  onSelectEvent: (event: CalendarEventRow) => void
  onEnsureRangeLoaded?: (startMs: number, endMs: number) => Promise<void> | void
  onClearNotice?: () => void
}

function getViewRange(
  view: CalendarViewMode,
  anchorDate: Date,
  todayMs: number,
): { startMs: number; endMs: number } {
  if (view === 'week') {
    const days = getWeekDays(anchorDate, todayMs)
    return { startMs: days[0].startMs, endMs: days[days.length - 1].endMs }
  }
  if (view === 'month') {
    const days = getMonthGridDays(anchorDate, todayMs)
    return { startMs: days[0].startMs, endMs: days[days.length - 1].endMs }
  }
  const start = getLocalDayStart(anchorDate)
  const end = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() + 30,
    0,
    0,
    0,
    0,
  )
  return { startMs: start.getTime(), endMs: end.getTime() }
}

function shiftAnchorDate(
  view: CalendarViewMode,
  anchor: Date,
  direction: -1 | 1,
): Date {
  if (view === 'month') {
    return new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1, 0, 0, 0, 0)
  }
  const deltaDays = view === 'week' ? 7 * direction : 14 * direction
  return new Date(
    anchor.getFullYear(),
    anchor.getMonth(),
    anchor.getDate() + deltaDays,
    0,
    0,
    0,
    0,
  )
}

function formatPeriodTitle(view: CalendarViewMode, anchorDate: Date): string {
  if (view === 'month') {
    return `${MONTH_NAMES_ES[anchorDate.getMonth()]} ${anchorDate.getFullYear()}`
  }
  if (view === 'week') {
    const week = getWeekDays(anchorDate)
    const first = week[0].date
    const last = week[6].date
    if (first.getMonth() === last.getMonth()) {
      return `${first.getDate()}–${last.getDate()} ${MONTH_SHORT_ES[last.getMonth()]} ${last.getFullYear()}`
    }
    return `${first.getDate()} ${MONTH_SHORT_ES[first.getMonth()]} – ${last.getDate()} ${MONTH_SHORT_ES[last.getMonth()]} ${last.getFullYear()}`
  }
  return `Desde ${anchorDate.getDate()} ${MONTH_SHORT_ES[anchorDate.getMonth()]} (30 días)`
}

function CalendarModalBody({
  isOpen,
  onClose,
  initialView = 'agenda',
  theme = 'light',
  isOnline,
  isSessionExpired = false,
  needsCalendarConsent = false,
  syncState,
  pendingCount = 0,
  lastSyncedAt = null,
  errorMessage = null,
  noticeMessage = null,
  calendars,
  events,
  nowMs,
  onSync,
  onReconnect,
  onDisconnect,
  onToggleCalendar,
  onCreateEvent,
  onSelectEvent,
  onEnsureRangeLoaded,
  onClearNotice,
}: CalendarModalProps) {
  const [defaultNowMs, setDefaultNowMs] = useState<number>(() => Date.now())
  const resolvedNowMs = nowMs ?? defaultNowMs
  const [view, setView] = useState<CalendarViewMode>(initialView)
  const [anchorDate, setAnchorDate] = useState<Date>(() =>
    getLocalDayStart(nowMs ?? defaultNowMs),
  )
  const [selectedDayYmd, setSelectedDayYmd] = useState<string>(() =>
    formatLocalDateYmd(nowMs ?? defaultNowMs),
  )

  useEffect(() => {
    if (!isOpen || nowMs !== undefined) return
    const timer = setInterval(() => {
      setDefaultNowMs(Date.now())
    }, 60_000)
    return () => clearInterval(timer)
  }, [isOpen, nowMs])

  const visibleRange = useMemo(
    () => getViewRange(view, anchorDate, resolvedNowMs),
    [view, anchorDate, resolvedNowMs],
  )

  useEffect(() => {
    if (!isOpen || !isOnline || !onEnsureRangeLoaded) return
    void onEnsureRangeLoaded(visibleRange.startMs, visibleRange.endMs)
  }, [isOpen, isOnline, visibleRange.startMs, visibleRange.endMs, onEnsureRangeLoaded])

  const calendarMap = useMemo(() => buildCalendarLookup(calendars), [calendars])
  const visibleCalendarIds = useMemo(
    () => new Set(calendars.filter((c) => c.selected).map((c) => c.id)),
    [calendars],
  )
  const canCreate = calendars.length === 0 || calendars.some(isCalendarWritable)

  const agendaGroups = useMemo(
    () =>
      groupAgendaDays(
        events,
        calendars,
        visibleRange.startMs,
        visibleRange.endMs,
        resolvedNowMs,
      ),
    [events, calendars, visibleRange.startMs, visibleRange.endMs, resolvedNowMs],
  )

  const weekDays = useMemo(
    () => getWeekDays(anchorDate, resolvedNowMs),
    [anchorDate, resolvedNowMs],
  )

  const monthDays = useMemo(
    () => getMonthGridDays(anchorDate, resolvedNowMs),
    [anchorDate, resolvedNowMs],
  )

  const selectedDayEvents = useMemo(() => {
    try {
      const startMs = parseLocalDateYmd(selectedDayYmd)
      const endMs = parseLocalDateYmd(addDaysToYmd(selectedDayYmd, 1))
      return getDayEvents(events, visibleCalendarIds, startMs, endMs)
    } catch {
      return []
    }
  }, [selectedDayYmd, events, visibleCalendarIds])

  const periodTitle = formatPeriodTitle(view, anchorDate)
  const isOffline = !isOnline || syncState === 'offline'
  const showAuthBanner = needsCalendarConsent || isSessionExpired

  const handleToday = () => {
    const baseMs = nowMs ?? Date.now()
    setDefaultNowMs(baseMs)
    setAnchorDate(getLocalDayStart(baseMs))
    setSelectedDayYmd(formatLocalDateYmd(baseMs))
  }

  const handleStep = (direction: -1 | 1) => {
    const nextAnchor = shiftAnchorDate(view, anchorDate, direction)
    setAnchorDate(nextAnchor)
    if (view === 'month') {
      const todayYmd = formatLocalDateYmd(resolvedNowMs)
      const nextYmd = formatLocalDateYmd(nextAnchor)
      setSelectedDayYmd(nextYmd.slice(0, 7) === todayYmd.slice(0, 7) ? todayYmd : nextYmd)
    }
  }

  return (
    <div
      data-testid="calendar-modal"
      data-home-theme={theme === 'dark' ? 'dark' : undefined}
      className="flex flex-col"
    >
        {/* Barra de estado y navegación */}
        <div className="flex flex-col gap-3 border-b border-[var(--cl-border-soft)] bg-[var(--cl-surface-muted)] px-5 py-3.5 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Pestañas Agenda | Semana | Mes */}
            <div
              className="inline-flex rounded-full border border-[var(--cl-border)] bg-[var(--cl-surface)] p-0.5"
              role="tablist"
              aria-label="Vista de calendario"
            >
              {(
                [
                  { id: 'agenda', label: 'Agenda', testId: 'calendar-view-agenda' },
                  { id: 'week', label: 'Semana', testId: 'calendar-view-week' },
                  { id: 'month', label: 'Mes', testId: 'calendar-view-month' },
                ] as const
              ).map((tab) => {
                const active = view === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    data-testid={tab.testId}
                    onClick={() => setView(tab.id)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-semibold cursor-pointer transition-colors ${
                      active
                        ? 'bg-[var(--cl-accent)] text-white shadow-xs'
                        : 'text-[var(--cl-fg-2)] hover:text-[var(--cl-fg)]'
                    }`}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>

            {/* Controles Hoy / < / > + acciones */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1 rounded-full border border-[var(--cl-border)] bg-[var(--cl-surface)] px-1 py-0.5">
                <button
                  type="button"
                  data-testid="calendar-nav-prev"
                  onClick={() => handleStep(-1)}
                  aria-label="Período anterior"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--cl-fg-2)] hover:bg-[var(--cl-surface-warm)] hover:text-[var(--cl-fg)] cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  data-testid="calendar-nav-today"
                  onClick={handleToday}
                  className="rounded-full px-2.5 py-1 text-xs font-semibold text-[var(--cl-fg)] hover:bg-[var(--cl-surface-warm)] cursor-pointer"
                >
                  Hoy
                </button>
                <button
                  type="button"
                  data-testid="calendar-nav-next"
                  onClick={() => handleStep(1)}
                  aria-label="Período siguiente"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--cl-fg-2)] hover:bg-[var(--cl-surface-warm)] hover:text-[var(--cl-fg)] cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <button
                type="button"
                data-testid="calendar-modal-sync-btn"
                onClick={onSync}
                disabled={syncState === 'syncing' || isOffline}
                className={PILL_BTN_SECONDARY}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${syncState === 'syncing' ? 'animate-spin' : ''}`}
                />
                <span>{syncState === 'syncing' ? 'Sincronizando…' : 'Sync'}</span>
              </button>

              <button
                type="button"
                data-testid="calendar-modal-add-btn"
                onClick={() => onCreateEvent(view === 'month' ? selectedDayYmd : undefined)}
                disabled={!canCreate}
                title={
                  canCreate
                    ? 'Crear nuevo evento'
                    : 'No hay calendarios editables disponibles'
                }
                className={PILL_BTN_PRIMARY}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Nuevo evento</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <strong className="text-sm font-bold text-[var(--cl-fg)]">{periodTitle}</strong>
              {isOffline && (
                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--cl-border)] bg-[var(--cl-surface)] px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[var(--cl-muted)]">
                  <WifiOff className="h-3 w-3" />
                  <span>Sin conexión</span>
                </span>
              )}
              {pendingCount > 0 && (
                <span className="inline-flex items-center rounded-full border border-[var(--cl-warn-border)] bg-[var(--cl-warn-soft)] px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[var(--cl-warn)]">
                  {pendingCount} pendiente{pendingCount === 1 ? '' : 's'}
                </span>
              )}
            </div>
            <span className="font-mono text-[11px] text-[var(--cl-muted)]">
              {lastSyncedAt
                ? `Última sync: ${lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'Sin sincronización reciente'}
            </span>
          </div>

          {/* Filtros de calendarios */}
          {calendars.length > 0 && (
            <div
              className="flex flex-wrap items-center gap-1.5"
              aria-label="Filtrar calendarios"
            >
              {calendars.map((cal) => (
                <button
                  key={cal.id}
                  type="button"
                  aria-pressed={cal.selected}
                  onClick={() => void onToggleCalendar(cal.id, !cal.selected)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors ${
                    cal.selected
                      ? 'border-[var(--cl-accent-border)] bg-[var(--cl-surface)] text-[var(--cl-fg)]'
                      : 'border-[var(--cl-border-soft)] bg-transparent text-[var(--cl-muted)] opacity-70 hover:opacity-100'
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: cal.backgroundColor || DEFAULT_CALENDAR_COLOR }}
                    aria-hidden="true"
                  />
                  <span className="max-w-[180px] truncate">{cal.summary}</span>
                  {!isCalendarWritable(cal) && (
                    <span className="font-mono text-[10px] text-[var(--cl-muted)]">
                      (Lectura)
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Banners de alertas y avisos */}
        {(showAuthBanner || errorMessage || noticeMessage) && (
          <div className="flex flex-col gap-2 px-5 pt-4 sm:px-6">
            {showAuthBanner && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--cl-warn-border)] bg-[var(--cl-warn-soft)] px-3.5 py-2.5 text-xs text-[var(--cl-warn)]">
                <div className="flex items-center gap-2 min-w-0">
                  <KeyRound className="h-4 w-4 shrink-0" />
                  <span>
                    {needsCalendarConsent
                      ? 'Faltan permisos de Google Calendar para sincronizar tu agenda.'
                      : 'Tu sesión de Google Calendar expiró. Los cambios locales siguen guardados.'}
                  </span>
                </div>
                {onReconnect && (
                  <button
                    type="button"
                    data-testid="calendar-reconnect-btn"
                    onClick={onReconnect}
                    className="rounded-full border border-[var(--cl-warn-border)] bg-[var(--cl-surface)] px-3 py-1 text-xs font-semibold text-[var(--cl-fg)] hover:border-[var(--cl-accent)] cursor-pointer shrink-0"
                  >
                    Reconectar
                  </button>
                )}
              </div>
            )}

            {errorMessage && (
              <div className="flex items-center gap-2 rounded-xl border border-[var(--cl-danger-border)] bg-[var(--cl-danger-soft)] px-3.5 py-2.5 text-xs font-medium text-[var(--cl-danger)]">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {noticeMessage && (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--cl-accent-border)] bg-[var(--cl-accent-soft)] px-3.5 py-2.5 text-xs text-[var(--cl-fg)]">
                <div className="flex items-center gap-2 min-w-0">
                  <Info className="h-4 w-4 shrink-0 text-[var(--cl-diagnostic)]" />
                  <span>{noticeMessage}</span>
                </div>
                {onClearNotice && (
                  <button
                    type="button"
                    onClick={onClearNotice}
                    aria-label="Descartar aviso"
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[var(--cl-muted)] hover:text-[var(--cl-fg)] cursor-pointer shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Cuerpo principal de vistas */}
        <div className="px-5 py-4 sm:px-6">
          {view === 'agenda' && (
            <div className="flex flex-col gap-4">
              {agendaGroups.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--cl-border)] bg-[var(--cl-surface-muted)] p-6 text-center">
                  <p className="m-0 text-sm font-semibold text-[var(--cl-fg)]">
                    No hay eventos visibles en este período
                  </p>
                  <p className="mt-1 mb-3 text-xs text-[var(--cl-muted)]">
                    Crea un nuevo evento o activa otros calendarios en la barra superior.
                  </p>
                  {canCreate && (
                    <button
                      type="button"
                      onClick={() => onCreateEvent()}
                      className={PILL_BTN_PRIMARY}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Agregar evento</span>
                    </button>
                  )}
                </div>
              ) : (
                agendaGroups.map((group) => (
                  <section key={group.ymd} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between border-b border-[var(--cl-border-soft)] pb-1">
                      <h4
                        className={`m-0 text-xs font-bold uppercase tracking-wide ${
                          group.isToday
                            ? 'text-[var(--cl-diagnostic)]'
                            : 'text-[var(--cl-muted)]'
                        }`}
                      >
                        {group.label}
                      </h4>
                      <span className="font-mono text-[11px] text-[var(--cl-muted)]">
                        {group.events.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {group.events.map((ev) => (
                        <CalendarEventItemCard
                          key={`${group.ymd}-${ev.id}`}
                          event={ev}
                          calendar={calendarMap.get(ev.calendarId)}
                          subtitle={formatEventTimeRange(ev)}
                          showLocation
                          onSelect={onSelectEvent}
                        />
                      ))}
                    </div>
                  </section>
                ))
              )}
            </div>
          )}

          {view === 'week' && (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
              {weekDays.map((day) => {
                const dayEvents = getDayEvents(
                  events,
                  visibleCalendarIds,
                  day.startMs,
                  day.endMs,
                )
                return (
                  <div
                    key={day.ymd}
                    className={`flex min-h-[150px] flex-col gap-1.5 rounded-xl border p-2 ${
                      day.isToday
                        ? 'border-[var(--cl-accent-border)] bg-[var(--cl-accent-soft)]/35'
                        : 'border-[var(--cl-border-soft)] bg-[var(--cl-surface-muted)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 border-b border-[var(--cl-border-soft)] pb-1">
                      <span
                        className={`text-xs font-bold ${
                          day.isToday
                            ? 'text-[var(--cl-diagnostic)]'
                            : 'text-[var(--cl-fg)]'
                        }`}
                      >
                        {WEEKDAY_SHORT_ES[day.date.getDay()]} {day.dayOfMonth}
                      </span>
                      {canCreate && (
                        <button
                          type="button"
                          onClick={() => onCreateEvent(day.ymd)}
                          aria-label={`Crear evento el ${day.ymd}`}
                          className="inline-flex h-5 w-5 items-center justify-center rounded text-[var(--cl-muted)] hover:bg-[var(--cl-surface)] hover:text-[var(--cl-fg)] cursor-pointer"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      {dayEvents.length === 0 ? (
                        <span className="text-[11px] text-[var(--cl-muted)]">Libre</span>
                      ) : (
                        dayEvents.map((ev) => (
                          <button
                            key={`${day.ymd}-${ev.id}`}
                            type="button"
                            onClick={() => onSelectEvent(ev)}
                            className="w-full rounded-md border border-[var(--cl-border-soft)] bg-[var(--cl-surface)] px-1.5 py-1 text-left hover:border-[var(--cl-accent)] cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-1.5">
                              <span
                                className="h-2 w-2 rounded-full shrink-0"
                                style={{
                                  backgroundColor: getCalendarColor(calendarMap, ev.calendarId),
                                }}
                                aria-hidden="true"
                              />
                              <span className="truncate text-[11px] font-semibold text-[var(--cl-fg)]">
                                {ev.summary || '(Sin título)'}
                              </span>
                            </div>
                            <span className="mt-0.5 block font-mono text-[10px] text-[var(--cl-muted)]">
                              {formatEventTimeRange(ev)}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {view === 'month' && (
            <div className="flex flex-col gap-4">
              <div className="overflow-x-auto">
                <div className="min-w-[540px]">
                  <div className="mb-1.5 grid grid-cols-7 gap-1 text-center">
                    {WEEKDAY_MONDAY_HEADERS.map((label) => (
                      <div
                        key={label}
                        className="py-1 font-mono text-[11px] font-bold uppercase text-[var(--cl-muted)]"
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {monthDays.map((day) => {
                      const dayEvents = getDayEvents(
                        events,
                        visibleCalendarIds,
                        day.startMs,
                        day.endMs,
                      )
                      const isSelected = day.ymd === selectedDayYmd
                      const visibleSlice = dayEvents.slice(0, 2)
                      const overflowCount = dayEvents.length - visibleSlice.length

                      return (
                        <div
                          key={day.ymd}
                          onClick={() => setSelectedDayYmd(day.ymd)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setSelectedDayYmd(day.ymd)
                            }
                          }}
                          className={`flex min-h-[84px] flex-col gap-1 rounded-xl border p-1.5 text-left cursor-pointer transition-colors ${
                            isSelected
                              ? 'border-[var(--cl-accent)] bg-[var(--cl-accent-soft)]/30'
                              : day.inCurrentMonth
                                ? 'border-[var(--cl-border-soft)] bg-[var(--cl-surface)] hover:border-[var(--cl-border)]'
                                : 'border-[var(--cl-border-soft)] bg-[var(--cl-surface-muted)]/60 opacity-65'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 font-mono text-[11px] font-bold ${
                                day.isToday
                                  ? 'bg-[var(--cl-accent)] text-white'
                                  : 'text-[var(--cl-fg)]'
                              }`}
                            >
                              {day.dayOfMonth}
                            </span>
                            {dayEvents.length > 0 && (
                              <span className="font-mono text-[10px] text-[var(--cl-muted)]">
                                {dayEvents.length}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-col gap-0.5">
                            {visibleSlice.map((ev) => (
                              <button
                                key={`${day.ymd}-${ev.id}`}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onSelectEvent(ev)
                                }}
                                className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left hover:bg-[var(--cl-surface-warm)] cursor-pointer"
                              >
                                <span
                                  className="h-2 w-1 rounded-full shrink-0"
                                  style={{
                                    backgroundColor: getCalendarColor(calendarMap, ev.calendarId),
                                  }}
                                  aria-hidden="true"
                                />
                                <span className="truncate text-[10px] font-medium text-[var(--cl-fg)]">
                                  {ev.summary || '(Sin título)'}
                                </span>
                              </button>
                            ))}
                            {overflowCount > 0 && (
                              <span className="px-1 font-mono text-[10px] text-[var(--cl-muted)]">
                                +{overflowCount} más
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Detalle del día seleccionado */}
              <div className="rounded-2xl border border-[var(--cl-border)] bg-[var(--cl-surface-muted)] p-3.5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <strong className="text-xs font-bold text-[var(--cl-fg)]">
                    Eventos del {selectedDayYmd}
                  </strong>
                  {canCreate && (
                    <button
                      type="button"
                      onClick={() => onCreateEvent(selectedDayYmd)}
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--cl-border)] bg-[var(--cl-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--cl-fg)] hover:border-[var(--cl-accent)] cursor-pointer"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Agregar este día</span>
                    </button>
                  )}
                </div>

                {selectedDayEvents.length === 0 ? (
                  <p className="m-0 text-xs text-[var(--cl-muted)]">
                    No hay eventos programados para esta fecha.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {selectedDayEvents.map((ev) => (
                      <CalendarEventItemCard
                        key={`sel-${ev.id}`}
                        event={ev}
                        calendar={calendarMap.get(ev.calendarId)}
                        subtitle={formatEventTimeRange(ev)}
                        showLocation
                        onSelect={onSelectEvent}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Pie del modal */}
        <footer className="flex flex-wrap items-center justify-between gap-2.5 border-t border-[var(--cl-border-soft)] bg-[var(--cl-surface-muted)] px-5 py-3.5 sm:px-6">
          <button
            type="button"
            data-testid="calendar-disconnect-btn"
            onClick={() => void onDisconnect()}
            className={PILL_BTN_DANGER}
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Desconectar Agenda</span>
          </button>

          <button type="button" onClick={onClose} className={PILL_BTN_SECONDARY}>
            Cerrar
          </button>
        </footer>
      </div>
  )
}

export function CalendarModal(props: CalendarModalProps) {
  return (
    <BaseModal
      isOpen={props.isOpen}
      onClose={props.onClose}
      title="Agenda Clínica y Guardias"
      subtitle="Sincronización bidireccional con Google Calendar (offline-first)."
      icon={<CalendarIcon className="h-5 w-5" />}
      maxWidthClass="max-w-4xl"
      bodyClassName="p-0 flex flex-col"
    >
      <CalendarModalBody
        key={`${props.initialView ?? 'agenda'}:${props.isOpen ? '1' : '0'}`}
        {...props}
      />
    </BaseModal>
  )
}
