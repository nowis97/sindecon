/**
 * Cliente REST de Google Calendar API v3 y utilidades de fechas locales.
 */

import { parseLocalDateYmd } from '../db/calendar'
import type {
  CalendarAccessRole,
  CalendarEventDraft,
  CalendarEventRow,
  CalendarEventStatus,
  CalendarListRow,
} from '../db/db'

export { parseLocalDateYmd }

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3'
const DEFAULT_CALENDAR_COLOR = '#1a73e8'
const LOCAL_DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/

export type CalendarApiErrorReason =
  | 'unauthorized'
  | 'insufficient_scope'
  | 'not_found'
  | 'gone'
  | 'rate_limited'
  | 'transient'
  | 'bad_request'

/** Error tipado para respuestas HTTP fallidas de Google Calendar API v3. */
export class CalendarApiError extends Error {
  readonly status: number
  readonly reason: CalendarApiErrorReason

  constructor(status: number, reason: CalendarApiErrorReason, message: string) {
    super(message)
    this.name = 'CalendarApiError'
    this.status = status
    this.reason = reason
  }
}

export interface GoogleEventTime {
  date?: string
  dateTime?: string
  timeZone?: string
}

interface GoogleCalendarListItem {
  id: string
  summary?: string
  summaryOverride?: string
  primary?: boolean
  backgroundColor?: string
  accessRole?: string
  selected?: boolean
  timeZone?: string
}

interface GoogleCalendarListResponse {
  items?: GoogleCalendarListItem[]
  nextPageToken?: string
}

interface GoogleCalendarEventItem {
  id: string
  summary?: string
  description?: string
  location?: string
  start?: GoogleEventTime
  end?: GoogleEventTime
  status?: string
  recurringEventId?: string
  htmlLink?: string
  updated?: string
}

interface GoogleCalendarEventsResponse {
  items?: GoogleCalendarEventItem[]
  nextPageToken?: string
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function toValidDate(dateOrMs: Date | number): Date {
  const date = typeof dateOrMs === 'number' ? new Date(dateOrMs) : new Date(dateOrMs.getTime())
  if (Number.isNaN(date.getTime())) {
    throw new Error('Fecha/hora inválida')
  }
  return date
}

/** Formatea una fecha o timestamp en `YYYY-MM-DD` usando la zona horaria local. */
export function formatLocalDateYmd(dateOrMs: Date | number): string {
  const date = toValidDate(dateOrMs)
  const year = String(date.getFullYear()).padStart(4, '0')
  return `${year}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** Suma o resta días calendario locales a una fecha `YYYY-MM-DD` de forma segura ante DST. */
export function addDaysToYmd(ymd: string, days: number): string {
  const date = new Date(parseLocalDateYmd(ymd))
  date.setDate(date.getDate() + days)
  return formatLocalDateYmd(date)
}

/** Formatea una fecha o timestamp para inputs `<input type="datetime-local">` (`YYYY-MM-DDTHH:mm`). */
export function formatLocalDateTimeInput(dateOrMs: Date | number): string {
  const date = toValidDate(dateOrMs)
  return `${formatLocalDateYmd(date)}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

function parseDateTimeInput(raw: string): Date {
  const trimmed = raw.trim()
  const localMatch = LOCAL_DATETIME_PATTERN.exec(trimmed)
  if (localMatch) {
    const year = Number(localMatch[1])
    const month = Number(localMatch[2])
    const day = Number(localMatch[3])
    const hour = Number(localMatch[4])
    const minute = Number(localMatch[5])
    const second = localMatch[6] ? Number(localMatch[6]) : 0
    const date = new Date(year, month - 1, day, hour, minute, second, 0)
    date.setFullYear(year)
    if (
      Number.isNaN(date.getTime()) ||
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day ||
      date.getHours() !== hour ||
      date.getMinutes() !== minute ||
      date.getSeconds() !== second
    ) {
      throw new Error(`Fecha y hora inválidas: "${raw}"`)
    }
    return date
  }

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Fecha y hora inválidas: "${raw}"`)
  }
  return parsed
}

function formatLocalRfc3339(date: Date): string {
  const offsetMinutes = -date.getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const absMinutes = Math.abs(offsetMinutes)
  const offsetHours = pad2(Math.floor(absMinutes / 60))
  const offsetMins = pad2(absMinutes % 60)
  return (
    `${formatLocalDateYmd(date)}T${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}` +
    `${sign}${offsetHours}:${offsetMins}`
  )
}

/**
 * Valida entradas del formulario y construye el rango ISO requerido por Google Calendar v3:
 * - Si `allDay: true`, convierte `endValue` inclusivo (UI) a `endIso` exclusivo (`+1 día`).
 * - Si `allDay: false`, devuelve timestamps RFC3339 con la zona horaria local.
 */
export function buildDraftIsoRange(input: {
  allDay: boolean
  startValue: string
  endValue: string
}): { startIso: string; endIso: string; timeZone: string } {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

  if (input.allDay) {
    const startMs = parseLocalDateYmd(input.startValue)
    const endInclusiveMs = parseLocalDateYmd(input.endValue)
    if (endInclusiveMs < startMs) {
      throw new Error('La fecha de fin no puede ser anterior a la fecha de inicio')
    }
    return {
      startIso: input.startValue,
      endIso: addDaysToYmd(input.endValue, 1),
      timeZone,
    }
  }

  const startDate = parseDateTimeInput(input.startValue)
  const endDate = parseDateTimeInput(input.endValue)
  if (endDate.getTime() < startDate.getTime()) {
    throw new Error('La hora de fin no puede ser anterior a la hora de inicio')
  }
  return {
    startIso: formatLocalRfc3339(startDate),
    endIso: formatLocalRfc3339(endDate),
    timeZone,
  }
}

/**
 * Normaliza los objetos `start` y `end` de Google Calendar v3 a timestamps locales.
 * Los eventos `allDay` (`start.date`) se parsean estrictamente en medianoche local.
 */
export function parseCalendarEventTimes(
  start: GoogleEventTime,
  end: GoogleEventTime,
): { startIso: string; endIso: string; startMs: number; endMs: number; allDay: boolean } {
  if (start.date) {
    const startIso = start.date
    const endIso = end.date ?? addDaysToYmd(startIso, 1)
    return {
      startIso,
      endIso,
      startMs: parseLocalDateYmd(startIso),
      endMs: parseLocalDateYmd(endIso),
      allDay: true,
    }
  }

  if (start.dateTime) {
    const startIso = start.dateTime
    const endIso = end.dateTime ?? startIso
    const startMs = Date.parse(startIso)
    const endMs = Date.parse(endIso)
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
      throw new Error(`Timestamps inválidos en evento de Google Calendar: "${startIso}" - "${endIso}"`)
    }
    return {
      startIso,
      endIso,
      startMs,
      endMs,
      allDay: false,
    }
  }

  throw new Error('El evento de Google Calendar no contiene start.date ni start.dateTime')
}

/**
 * Determina si un evento activo se solapa con el rango `[rangeStartMs, rangeEndMs)`.
 * Ignora eventos con `status === 'cancelled'`.
 */
export function eventOverlapsRange(
  ev: Pick<CalendarEventRow, 'startMs' | 'endMs' | 'status'>,
  rangeStartMs: number,
  rangeEndMs: number,
): boolean {
  if (ev.status === 'cancelled') return false
  if (ev.endMs <= ev.startMs) {
    return ev.startMs >= rangeStartMs && ev.startMs < rangeEndMs
  }
  return ev.startMs < rangeEndMs && ev.endMs > rangeStartMs
}

/** Ventana de sincronización por defecto: `-30 días` (00:00 local) a `+120 días` (23:59:59.999 local). */
export function getDefaultSyncWindow(nowMs: number = Date.now()): {
  startMs: number
  endMs: number
} {
  const base = new Date(nowMs)
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 30, 0, 0, 0, 0)
  const end = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 120, 23, 59, 59, 999)
  return {
    startMs: start.getTime(),
    endMs: end.getTime(),
  }
}

function mapStatusToErrorReason(
  status: number,
  apiReasons: string[],
  message: string,
): CalendarApiErrorReason {
  if (status === 401) return 'unauthorized'
  if (status === 403) {
    const lowerReasons = apiReasons.map((r) => r.toLowerCase())
    const lowerMsg = message.toLowerCase()
    if (
      lowerReasons.some(
        (r) =>
          r === 'ratelimitexceeded' ||
          r === 'userratelimitexceeded' ||
          r === 'quotaexceeded' ||
          r === 'dailylimitexceeded',
      )
    ) {
      return 'rate_limited'
    }
    if (
      lowerReasons.some(
        (r) => r === 'insufficientpermissions' || r === 'insufficientscope' || r === 'forbidden',
      ) ||
      lowerMsg.includes('insufficient') ||
      lowerMsg.includes('permission') ||
      lowerMsg.includes('scope')
    ) {
      return 'insufficient_scope'
    }
    return 'insufficient_scope'
  }
  if (status === 404) return 'not_found'
  if (status === 410) return 'gone'
  if (status === 429) return 'rate_limited'
  if (status >= 500) return 'transient'
  return 'bad_request'
}

async function throwIfCalendarApiError(res: Response): Promise<never> {
  const status = res.status
  let message = res.statusText || `Error de Google Calendar API (${status})`
  const apiReasons: string[] = []

  try {
    const text = await res.text()
    if (text) {
      try {
        const parsed = JSON.parse(text) as {
          error?: {
            message?: string
            status?: string
            errors?: Array<{ reason?: string }>
          }
        }
        if (parsed.error?.message) {
          message = parsed.error.message
        }
        if (parsed.error?.status) {
          apiReasons.push(parsed.error.status)
        }
        if (Array.isArray(parsed.error?.errors)) {
          for (const err of parsed.error.errors) {
            if (err.reason) apiReasons.push(err.reason)
          }
        }
      } catch {
        message = text
      }
    }
  } catch {
    // Ignorar error de lectura de cuerpo en respuesta fallida
  }

  throw new CalendarApiError(status, mapStatusToErrorReason(status, apiReasons, message), message)
}

async function calendarFetch(
  url: string,
  token: string,
  init: RequestInit = {},
  fetchFn?: typeof fetch,
): Promise<Response> {
  const execFetch = fetchFn ?? ((input: RequestInfo | URL, reqInit?: RequestInit) => globalThis.fetch(input, reqInit))
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)
  const res = await execFetch(url, { ...init, headers })
  if (!res.ok) {
    await throwIfCalendarApiError(res)
  }
  return res
}

function normalizeAccessRole(role?: string): CalendarAccessRole {
  switch (role) {
    case 'owner':
    case 'writer':
    case 'reader':
    case 'freeBusyReader':
      return role
    default:
      return 'reader'
  }
}

function normalizeEventStatus(status?: string): CalendarEventStatus {
  switch (status) {
    case 'confirmed':
    case 'tentative':
    case 'cancelled':
      return status
    default:
      return 'confirmed'
  }
}

function mapGoogleEventToRow(
  item: GoogleCalendarEventItem,
  calendarId: string,
): Omit<CalendarEventRow, 'syncStatus' | 'syncError'> {
  const status = normalizeEventStatus(item.status)
  const parsedTimes =
    item.start && (item.start.date || item.start.dateTime)
      ? parseCalendarEventTimes(item.start, item.end ?? item.start)
      : { startIso: '', endIso: '', startMs: 0, endMs: 0, allDay: false }

  const updatedParsed = item.updated ? Date.parse(item.updated) : Number.NaN
  const updatedAt = Number.isNaN(updatedParsed) ? Date.now() : updatedParsed

  return {
    id: item.id,
    calendarId,
    summary: item.summary ?? '',
    description: item.description ?? '',
    location: item.location ?? '',
    startIso: parsedTimes.startIso,
    endIso: parsedTimes.endIso,
    startMs: parsedTimes.startMs,
    endMs: parsedTimes.endMs,
    allDay: parsedTimes.allDay,
    status,
    ...(item.recurringEventId ? { recurringEventId: item.recurringEventId } : {}),
    ...(item.htmlLink ? { htmlLink: item.htmlLink } : {}),
    updatedAt,
  }
}

function buildGoogleEventBody(draft: CalendarEventDraft): Record<string, unknown> {
  const timeZoneObj = draft.timeZone ? { timeZone: draft.timeZone } : {}
  const start: GoogleEventTime = draft.allDay
    ? { date: draft.startIso }
    : { dateTime: draft.startIso, ...timeZoneObj }
  const end: GoogleEventTime = draft.allDay
    ? { date: draft.endIso }
    : { dateTime: draft.endIso, ...timeZoneObj }

  return {
    summary: draft.summary,
    description: draft.description,
    location: draft.location,
    start,
    end,
  }
}

/** Lista todos los calendarios del usuario ordenando el primario primero. */
export async function fetchCalendarList(
  token: string,
  fetchFn?: typeof fetch,
): Promise<Array<Omit<CalendarListRow, 'selected'> & { defaultSelected: boolean }>> {
  const results: Array<Omit<CalendarListRow, 'selected'> & { defaultSelected: boolean }> = []
  let pageToken: string | undefined

  do {
    const url = new URL(`${CALENDAR_API_BASE}/users/me/calendarList`)
    url.searchParams.set('maxResults', '250')
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken)
    }

    const res = await calendarFetch(url.toString(), token, { method: 'GET' }, fetchFn)
    const data = (await res.json()) as GoogleCalendarListResponse
    for (const item of data.items ?? []) {
      const primary = Boolean(item.primary)
      results.push({
        id: item.id,
        summary: item.summaryOverride || item.summary || item.id,
        primary,
        backgroundColor: item.backgroundColor || DEFAULT_CALENDAR_COLOR,
        accessRole: normalizeAccessRole(item.accessRole),
        defaultSelected: primary || item.selected === true,
        ...(item.timeZone ? { timeZone: item.timeZone } : {}),
      })
    }
    pageToken = data.nextPageToken
  } while (pageToken)

  results.sort((a, b) => {
    if (a.primary !== b.primary) return a.primary ? -1 : 1
    return a.summary.localeCompare(b.summary)
  })

  return results
}

/** Obtiene instancias expandidas (`singleEvents=true`) dentro de `[timeMinMs, timeMaxMs]`. */
export async function fetchCalendarEventsWindow(
  token: string,
  calendarId: string,
  timeMinMs: number,
  timeMaxMs: number,
  fetchFn?: typeof fetch,
): Promise<Array<Omit<CalendarEventRow, 'syncStatus' | 'syncError'>>> {
  const results: Array<Omit<CalendarEventRow, 'syncStatus' | 'syncError'>> = []
  const encodedCalendarId = encodeURIComponent(calendarId)
  const timeMinIso = new Date(timeMinMs).toISOString()
  const timeMaxIso = new Date(timeMaxMs).toISOString()
  let pageToken: string | undefined

  do {
    const url = new URL(`${CALENDAR_API_BASE}/calendars/${encodedCalendarId}/events`)
    url.searchParams.set('singleEvents', 'true')
    url.searchParams.set('orderBy', 'startTime')
    url.searchParams.set('timeMin', timeMinIso)
    url.searchParams.set('timeMax', timeMaxIso)
    url.searchParams.set('maxResults', '250')
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken)
    }

    const res = await calendarFetch(url.toString(), token, { method: 'GET' }, fetchFn)
    const data = (await res.json()) as GoogleCalendarEventsResponse
    for (const item of data.items ?? []) {
      results.push(mapGoogleEventToRow(item, calendarId))
    }
    pageToken = data.nextPageToken
  } while (pageToken)

  return results
}

/** Crea un evento remoto en el calendario indicado. */
export async function createRemoteCalendarEvent(
  token: string,
  calendarId: string,
  draft: CalendarEventDraft,
  fetchFn?: typeof fetch,
): Promise<Omit<CalendarEventRow, 'syncStatus' | 'syncError'>> {
  const url = `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`
  const res = await calendarFetch(
    url,
    token,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildGoogleEventBody(draft)),
    },
    fetchFn,
  )
  const item = (await res.json()) as GoogleCalendarEventItem
  return mapGoogleEventToRow(item, calendarId)
}

/** Actualiza parcialmente un evento remoto mediante PATCH. */
export async function patchRemoteCalendarEvent(
  token: string,
  calendarId: string,
  eventId: string,
  draft: CalendarEventDraft,
  fetchFn?: typeof fetch,
): Promise<Omit<CalendarEventRow, 'syncStatus' | 'syncError'>> {
  const url =
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}` +
    `/events/${encodeURIComponent(eventId)}`
  const res = await calendarFetch(
    url,
    token,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildGoogleEventBody(draft)),
    },
    fetchFn,
  )
  const item = (await res.json()) as GoogleCalendarEventItem
  return mapGoogleEventToRow(item, calendarId)
}

/** Elimina un evento remoto en Google Calendar. */
export async function deleteRemoteCalendarEvent(
  token: string,
  calendarId: string,
  eventId: string,
  fetchFn?: typeof fetch,
): Promise<void> {
  const url =
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}` +
    `/events/${encodeURIComponent(eventId)}`
  await calendarFetch(url, token, { method: 'DELETE' }, fetchFn)
}
