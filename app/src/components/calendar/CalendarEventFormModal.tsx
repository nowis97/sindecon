import { useState } from 'react'
import {
  AlertTriangle,
  CalendarPlus,
  ExternalLink,
  Lock,
  Repeat,
  Trash2,
} from 'lucide-react'
import type {
  CalendarEventDraft,
  CalendarEventRow,
  CalendarListRow,
} from '../../db/db'
import type { Theme } from '../../hooks/useTheme'
import {
  addDaysToYmd,
  buildDraftIsoRange,
  formatLocalDateTimeInput,
  formatLocalDateYmd,
} from '../../pwa/googleCalendar'
import {
  BaseModal,
  CLINICAL_FIELD_CLASS,
  PILL_BTN_DANGER,
  PILL_BTN_PRIMARY,
  PILL_BTN_SECONDARY,
} from '../common/DialogModal'
import { isCalendarWritable } from './CalendarModal'

export interface CalendarEventFormModalProps {
  isOpen: boolean
  onClose: () => void
  calendars: CalendarListRow[]
  event?: CalendarEventRow | null
  defaultDateYmd?: string
  theme?: Theme
  isOnline?: boolean
  onSubmit: (draft: CalendarEventDraft, existingEventId?: string) => Promise<void> | void
  onDelete?: (eventId: string) => Promise<void> | void
}

interface FormInitialState {
  calendarId: string
  summary: string
  location: string
  description: string
  allDay: boolean
  startDate: string
  endDate: string
  startDateTime: string
  endDateTime: string
}

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/

function computeInclusiveEndDate(startIso: string, endIso: string, startMs: number): string {
  try {
    const prev = addDaysToYmd(endIso, -1)
    return prev >= startIso ? prev : startIso
  } catch {
    return formatLocalDateYmd(startMs)
  }
}

function buildInitialFormState(
  event: CalendarEventRow | null | undefined,
  calendars: CalendarListRow[],
  defaultDateYmd?: string,
): FormInitialState {
  if (event) {
    const safeStartDate = YMD_RE.test(event.startIso)
      ? event.startIso
      : formatLocalDateYmd(event.startMs)
    const safeEndDate = event.allDay
      ? computeInclusiveEndDate(safeStartDate, event.endIso, event.startMs)
      : formatLocalDateYmd(Math.max(event.startMs, event.endMs))

    return {
      calendarId: event.calendarId,
      summary: event.summary,
      location: event.location,
      description: event.description,
      allDay: event.allDay,
      startDate: safeStartDate,
      endDate: safeEndDate,
      startDateTime: event.allDay
        ? `${safeStartDate}T09:00`
        : formatLocalDateTimeInput(event.startMs),
      endDateTime: event.allDay
        ? `${safeEndDate}T10:00`
        : formatLocalDateTimeInput(Math.max(event.startMs, event.endMs)),
    }
  }

  const writable = calendars.filter(isCalendarWritable)
  const defaultCalId =
    writable.find((c) => c.primary)?.id ??
    writable[0]?.id ??
    calendars[0]?.id ??
    'primary'

  if (defaultDateYmd && YMD_RE.test(defaultDateYmd)) {
    return {
      calendarId: defaultCalId,
      summary: '',
      location: '',
      description: '',
      allDay: false,
      startDate: defaultDateYmd,
      endDate: defaultDateYmd,
      startDateTime: `${defaultDateYmd}T09:00`,
      endDateTime: `${defaultDateYmd}T10:00`,
    }
  }

  const now = new Date()
  const nextHour = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours() + 1,
    0,
    0,
    0,
  )
  const endHour = new Date(nextHour.getTime() + 60 * 60 * 1000)

  return {
    calendarId: defaultCalId,
    summary: '',
    location: '',
    description: '',
    allDay: false,
    startDate: formatLocalDateYmd(nextHour),
    endDate: formatLocalDateYmd(endHour),
    startDateTime: formatLocalDateTimeInput(nextHour),
    endDateTime: formatLocalDateTimeInput(endHour),
  }
}

interface CalendarEventFormBodyProps {
  calendars: CalendarListRow[]
  event?: CalendarEventRow | null
  defaultDateYmd?: string
  theme: Theme
  isOnline: boolean
  onClose: () => void
  onSubmit: (draft: CalendarEventDraft, existingEventId?: string) => Promise<void> | void
  onDelete?: (eventId: string) => Promise<void> | void
}

function CalendarEventFormBody({
  calendars,
  event,
  defaultDateYmd,
  theme,
  isOnline,
  onClose,
  onSubmit,
  onDelete,
}: CalendarEventFormBodyProps) {
  const initial = buildInitialFormState(event, calendars, defaultDateYmd)
  const [calendarId, setCalendarId] = useState(initial.calendarId)
  const [summary, setSummary] = useState(initial.summary)
  const [location, setLocation] = useState(initial.location)
  const [description, setDescription] = useState(initial.description)
  const [allDay, setAllDay] = useState(initial.allDay)
  const [startDate, setStartDate] = useState(initial.startDate)
  const [endDate, setEndDate] = useState(initial.endDate)
  const [startDateTime, setStartDateTime] = useState(initial.startDateTime)
  const [endDateTime, setEndDateTime] = useState(initial.endDateTime)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isEdit = Boolean(event)
  const writableCalendars = calendars.filter(isCalendarWritable)
  const activeCalendar = calendars.find((c) => c.id === calendarId)
  const noWritableOnCreate = !isEdit && calendars.length > 0 && writableCalendars.length === 0
  const isReadOnlyEvent = Boolean(isEdit && activeCalendar && !isCalendarWritable(activeCalendar))
  const isReadOnly = isReadOnlyEvent || noWritableOnCreate

  const handleToggleAllDay = (checked: boolean) => {
    setAllDay(checked)
    setValidationError(null)
    if (checked) {
      const startPart = startDateTime.slice(0, 10)
      const endPart = endDateTime.slice(0, 10)
      if (YMD_RE.test(startPart)) {
        setStartDate(startPart)
        setEndDate(YMD_RE.test(endPart) && endPart >= startPart ? endPart : startPart)
      }
      return
    }

    const startTimePart = startDateTime.length >= 16 ? startDateTime.slice(11, 16) : '09:00'
    const endTimePart = endDateTime.length >= 16 ? endDateTime.slice(11, 16) : '10:00'
    if (YMD_RE.test(startDate)) setStartDateTime(`${startDate}T${startTimePart}`)
    if (YMD_RE.test(endDate)) setEndDateTime(`${endDate}T${endTimePart}`)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isReadOnly || busy) return

    const trimmedTitle = summary.trim()
    if (!trimmedTitle) {
      setValidationError('El título del evento es obligatorio.')
      return
    }

    const startValue = allDay ? startDate : startDateTime
    const endValue = allDay ? endDate : endDateTime

    let range: { startIso: string; endIso: string; timeZone: string }
    try {
      range = buildDraftIsoRange({ allDay, startValue, endValue })
    } catch (err) {
      setValidationError((err as Error).message || 'El rango de fecha u hora no es válido.')
      return
    }

    setValidationError(null)
    setBusy(true)
    try {
      await onSubmit(
        {
          calendarId,
          summary: trimmedTitle,
          description: description.trim(),
          location: location.trim(),
          startIso: range.startIso,
          endIso: range.endIso,
          allDay,
          timeZone: range.timeZone,
        },
        event?.id,
      )
      onClose()
    } catch (err) {
      setValidationError((err as Error).message || 'No se pudo guardar el evento.')
    } finally {
      setBusy(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!event || !onDelete || isReadOnly || busy) return
    setBusy(true)
    setValidationError(null)
    try {
      await onDelete(event.id)
      onClose()
    } catch (err) {
      setValidationError((err as Error).message || 'No se pudo eliminar el evento.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      data-testid="calendar-event-form-modal"
      data-home-theme={theme === 'dark' ? 'dark' : undefined}
      onSubmit={(e) => void handleSubmit(e)}
      noValidate
      className="flex flex-col gap-3.5"
    >
      {/* Avisos contextuales */}
      {isReadOnly && (
        <div className="flex items-start gap-2 rounded-xl border border-[var(--cl-border)] bg-[var(--cl-surface-muted)] px-3.5 py-2.5 text-xs text-[var(--cl-fg-2)]">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cl-muted)]" />
          <span>
            {noWritableOnCreate
              ? 'No tienes calendarios con permisos de escritura en esta cuenta.'
              : `Calendario de solo lectura (${activeCalendar?.summary || 'Google Calendar'}): no puedes editar ni eliminar este evento.`}
          </span>
        </div>
      )}

      {event?.recurringEventId && (
        <div className="flex items-start gap-2 rounded-xl border border-[var(--cl-warn-border)] bg-[var(--cl-warn-soft)] px-3.5 py-2.5 text-xs text-[var(--cl-warn)]">
          <Repeat className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Este evento pertenece a una serie recurrente. Las modificaciones aplican únicamente a
            esta instancia.
          </span>
        </div>
      )}

      {event?.syncStatus === 'pending' && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--cl-warn-border)] bg-[var(--cl-warn-soft)] px-3.5 py-2 text-xs text-[var(--cl-warn)]">
          <span>
            Pendiente de sincronización{!isOnline ? ' (se subirá al recuperar conexión)' : ''}.
          </span>
        </div>
      )}

      {event?.syncStatus === 'error' && event.syncError && (
        <div className="flex items-start gap-2 rounded-xl border border-[var(--cl-danger-border)] bg-[var(--cl-danger-soft)] px-3.5 py-2.5 text-xs text-[var(--cl-danger)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Error de sincronización: {event.syncError}</span>
        </div>
      )}

      {/* Título */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="calendar-event-title"
          className="text-xs font-semibold text-[var(--cl-fg-2)]"
        >
          Título del evento *
        </label>
        <input
          id="calendar-event-title"
          data-testid="calendar-event-title-input"
          type="text"
          className={CLINICAL_FIELD_CLASS}
          value={summary}
          onChange={(e) => {
            setSummary(e.target.value)
            if (validationError) setValidationError(null)
          }}
          placeholder="Ej. Guardia UCI Torre A, Pase de sala..."
          disabled={isReadOnly || busy}
          autoFocus={!isReadOnly}
        />
      </div>

      {/* Selector de calendario al crear; badge en edición */}
      {!isEdit && writableCalendars.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="calendar-event-calendar"
            className="text-xs font-semibold text-[var(--cl-fg-2)]"
          >
            Calendario destino
          </label>
          <select
            id="calendar-event-calendar"
            data-testid="calendar-event-calendar-select"
            className={CLINICAL_FIELD_CLASS}
            value={calendarId}
            onChange={(e) => setCalendarId(e.target.value)}
            disabled={busy}
          >
            {writableCalendars.map((cal) => (
              <option key={cal.id} value={cal.id}>
                {cal.summary}
                {cal.primary ? ' (Principal)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {isEdit && activeCalendar && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--cl-border-soft)] bg-[var(--cl-surface-muted)] px-3 py-2 text-xs">
          <span className="inline-flex items-center gap-2 font-medium text-[var(--cl-fg)]">
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: activeCalendar.backgroundColor }}
              aria-hidden="true"
            />
            <span>{activeCalendar.summary}</span>
          </span>
          {event?.htmlLink && (
            <a
              href={event.htmlLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-[var(--cl-diagnostic)] hover:underline"
            >
              <span>Google Calendar</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}

      {/* Toggle Todo el día */}
      <label
        htmlFor="calendar-event-allday"
        className="flex items-center justify-between gap-3 rounded-xl border border-[var(--cl-border-soft)] bg-[var(--cl-surface-muted)] px-3.5 py-2.5 cursor-pointer"
      >
        <span className="text-xs font-semibold text-[var(--cl-fg)]">Todo el día</span>
        <input
          id="calendar-event-allday"
          data-testid="calendar-event-allday-toggle"
          type="checkbox"
          checked={allDay}
          onChange={(e) => handleToggleAllDay(e.target.checked)}
          disabled={isReadOnly || busy}
          className="h-4 w-4 accent-[var(--cl-accent)] cursor-pointer"
        />
      </label>

      {/* Inicio y Fin */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="calendar-event-start"
            className="text-xs font-semibold text-[var(--cl-fg-2)]"
          >
            Inicio
          </label>
          <input
            id="calendar-event-start"
            data-testid="calendar-event-start-input"
            type={allDay ? 'date' : 'datetime-local'}
            className={CLINICAL_FIELD_CLASS}
            value={allDay ? startDate : startDateTime}
            onChange={(e) => {
              const val = e.target.value
              if (allDay) {
                setStartDate(val)
                if (endDate < val) setEndDate(val)
              } else {
                setStartDateTime(val)
              }
              if (validationError) setValidationError(null)
            }}
            disabled={isReadOnly || busy}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="calendar-event-end"
            className="text-xs font-semibold text-[var(--cl-fg-2)]"
          >
            Fin
          </label>
          <input
            id="calendar-event-end"
            data-testid="calendar-event-end-input"
            type={allDay ? 'date' : 'datetime-local'}
            className={CLINICAL_FIELD_CLASS}
            value={allDay ? endDate : endDateTime}
            onChange={(e) => {
              const val = e.target.value
              if (allDay) {
                setEndDate(val)
              } else {
                setEndDateTime(val)
              }
              if (validationError) setValidationError(null)
            }}
            disabled={isReadOnly || busy}
          />
        </div>
      </div>

      {/* Ubicación */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="calendar-event-location"
          className="text-xs font-semibold text-[var(--cl-fg-2)]"
        >
          Ubicación
        </label>
        <input
          id="calendar-event-location"
          data-testid="calendar-event-location-input"
          type="text"
          className={CLINICAL_FIELD_CLASS}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Ej. Hospital Central, UCI piso 3"
          disabled={isReadOnly || busy}
        />
      </div>

      {/* Notas / Descripción */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="calendar-event-description"
          className="text-xs font-semibold text-[var(--cl-fg-2)]"
        >
          Notas clínicas / descripción
        </label>
        <textarea
          id="calendar-event-description"
          data-testid="calendar-event-description-input"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Indicaciones, equipo de turno o recordatorios..."
          disabled={isReadOnly || busy}
          className="w-full rounded-xl border border-[var(--ch-border-strong)] bg-[var(--ch-bg-primary)] px-3.5 py-2.5 text-xs font-medium text-[var(--ch-text-primary)] outline-none transition placeholder:text-[var(--ch-text-muted)] focus:border-[var(--ch-accent)] focus:ring-2 focus:ring-[var(--ch-accent)]/20 disabled:opacity-50"
        />
      </div>

      {validationError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-[var(--cl-danger-border)] bg-[var(--cl-danger-soft)] px-3.5 py-2.5 text-xs font-medium text-[var(--cl-danger)]"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Confirmación inline de borrado */}
      {confirmDelete && isEdit && !isReadOnly && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--cl-danger-border)] bg-[var(--cl-danger-soft)] px-3.5 py-2.5 text-xs">
          <span className="font-semibold text-[var(--cl-danger)]">
            ¿Eliminar este evento de tu agenda?
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              disabled={busy}
              className="rounded-full border border-[var(--cl-border)] bg-[var(--cl-surface)] px-3 py-1 text-xs font-semibold text-[var(--cl-fg)] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              data-testid="calendar-event-confirm-delete-btn"
              onClick={() => void handleConfirmDelete()}
              disabled={busy}
              className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 cursor-pointer disabled:opacity-50"
            >
              {busy ? 'Eliminando…' : 'Confirmar eliminación'}
            </button>
          </div>
        </div>
      )}

      {/* Acciones del formulario */}
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--cl-border-soft)] pt-3.5">
        <div>
          {isEdit && !isReadOnly && onDelete && !confirmDelete && (
            <button
              type="button"
              data-testid="calendar-event-delete-btn"
              onClick={() => setConfirmDelete(true)}
              disabled={busy}
              className={PILL_BTN_DANGER}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Eliminar</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={PILL_BTN_SECONDARY}
          >
            {isReadOnly ? 'Cerrar' : 'Cancelar'}
          </button>

          {!isReadOnly && (
            <button
              type="submit"
              data-testid="calendar-event-submit-btn"
              disabled={busy}
              className={PILL_BTN_PRIMARY}
            >
              {busy ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear evento'}
            </button>
          )}
        </div>
      </div>
    </form>
  )
}

export function CalendarEventFormModal({
  isOpen,
  onClose,
  calendars,
  event = null,
  defaultDateYmd,
  theme = 'light',
  isOnline = true,
  onSubmit,
  onDelete,
}: CalendarEventFormModalProps) {
  const activeCalendar = event ? calendars.find((c) => c.id === event.calendarId) : undefined
  const isReadOnly = Boolean(event && activeCalendar && !isCalendarWritable(activeCalendar))
  const modalTitle = event
    ? isReadOnly
      ? 'Detalle del evento'
      : 'Editar evento'
    : 'Nuevo evento clínico'

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      subtitle={
        event
          ? 'Los cambios se guardan localmente de inmediato y se sincronizan con Google Calendar.'
          : 'Agenda guardias, pases o recordatorios clínicos offline-first.'
      }
      icon={<CalendarPlus className="h-5 w-5" />}
      maxWidthClass="max-w-lg"
    >
      <CalendarEventFormBody
        key={`${event?.id ?? 'new'}:${defaultDateYmd ?? ''}:${isOpen ? '1' : '0'}`}
        calendars={calendars}
        event={event}
        defaultDateYmd={defaultDateYmd}
        theme={theme}
        isOnline={isOnline}
        onClose={onClose}
        onSubmit={onSubmit}
        onDelete={onDelete}
      />
    </BaseModal>
  )
}
