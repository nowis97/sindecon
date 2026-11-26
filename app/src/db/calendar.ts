import {
  db,
  type CalendarEventDraft,
  type CalendarEventRow,
  type CalendarListRow,
  type CalendarOutboxRow,
} from './db'

const YMD_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Parsea estrictamente una fecha `YYYY-MM-DD` en hora local (medianoche 00:00:00.000)
 * para evitar el corrimiento de día que produce `new Date('YYYY-MM-DD')` (UTC).
 */
export function parseLocalDateYmd(ymd: string): number {
  const match = YMD_PATTERN.exec(ymd)
  if (!match) {
    throw new Error(`Fecha local inválida (esperado YYYY-MM-DD): "${ymd}"`)
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day, 0, 0, 0, 0)
  date.setFullYear(year)

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error(`Fecha calendario inválida: "${ymd}"`)
  }
  return date.getTime()
}

/** Calcula `startMs` y `endMs` en milisegundos locales a partir de un borrador de evento. */
export function computeDraftEventTimes(draft: CalendarEventDraft): {
  startMs: number
  endMs: number
} {
  let startMs: number
  let endMs: number

  if (draft.allDay) {
    startMs = parseLocalDateYmd(draft.startIso)
    endMs = parseLocalDateYmd(draft.endIso)
  } else {
    startMs = Date.parse(draft.startIso)
    endMs = Date.parse(draft.endIso)
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
      throw new Error(`Rango horario inválido: "${draft.startIso}" - "${draft.endIso}"`)
    }
  }

  if (endMs < startMs) {
    throw new Error('La fecha/hora de fin no puede ser anterior al inicio')
  }
  return { startMs, endMs }
}

/** Crea un evento `local-*` en caché y encola su creación en el outbox offline. */
export async function enqueueCreateEvent(draft: CalendarEventDraft): Promise<CalendarEventRow> {
  const { startMs, endMs } = computeDraftEventTimes(draft)
  const now = Date.now()
  const summary = draft.summary.trim()
  const row: CalendarEventRow = {
    id: `local-${crypto.randomUUID()}`,
    calendarId: draft.calendarId,
    summary,
    description: draft.description,
    location: draft.location,
    startIso: draft.startIso,
    endIso: draft.endIso,
    startMs,
    endMs,
    allDay: draft.allDay,
    status: 'confirmed',
    updatedAt: now,
    syncStatus: 'pending',
  }

  await db.transaction('rw', db.calendar_events, db.calendar_outbox, async () => {
    await db.calendar_events.put(row)
    await db.calendar_outbox.add({
      op: 'create',
      eventId: row.id,
      calendarId: row.calendarId,
      payload: { ...draft, summary },
      createdAt: now,
      attempts: 0,
    })
  })
  return row
}

/** Actualiza un evento localmente y coalescea la operación pendiente en el outbox. */
export async function enqueueUpdateEvent(
  eventId: string,
  draft: CalendarEventDraft,
): Promise<CalendarEventRow> {
  const { startMs, endMs } = computeDraftEventTimes(draft)
  const now = Date.now()
  const summary = draft.summary.trim()
  const payload: CalendarEventDraft = { ...draft, summary }

  return db.transaction('rw', db.calendar_events, db.calendar_outbox, async () => {
    const existing = await db.calendar_events.get(eventId)
    const row: CalendarEventRow = {
      id: eventId,
      calendarId: draft.calendarId,
      summary,
      description: draft.description,
      location: draft.location,
      startIso: draft.startIso,
      endIso: draft.endIso,
      startMs,
      endMs,
      allDay: draft.allDay,
      status: existing?.status ?? 'confirmed',
      ...(existing?.recurringEventId ? { recurringEventId: existing.recurringEventId } : {}),
      ...(existing?.htmlLink ? { htmlLink: existing.htmlLink } : {}),
      updatedAt: now,
      syncStatus: 'pending',
    }

    const existingOutbox = await db.calendar_outbox.where('eventId').equals(eventId).toArray()
    const createItem = existingOutbox.find((item) => item.op === 'create')

    if (createItem?.id !== undefined) {
      await db.calendar_outbox.update(createItem.id, {
        calendarId: draft.calendarId,
        payload,
        lastError: undefined,
      })
    } else {
      const updateItem = existingOutbox.find((item) => item.op === 'update')
      if (updateItem?.id !== undefined) {
        await db.calendar_outbox.update(updateItem.id, {
          calendarId: draft.calendarId,
          payload,
          lastError: undefined,
        })
      } else {
        await db.calendar_outbox.add({
          op: 'update',
          eventId,
          calendarId: draft.calendarId,
          payload,
          createdAt: now,
          attempts: 0,
        })
      }
    }

    await db.calendar_events.put(row)
    return row
  })
}

/**
 * Elimina un evento localmente y encola `'delete'` solo si ya existía en el servidor;
 * si era un borrador `local-*` con `'create'` pendiente, cancela ambos sin tráfico HTTP.
 */
export async function enqueueDeleteEvent(eventId: string): Promise<void> {
  await db.transaction('rw', db.calendar_events, db.calendar_outbox, async () => {
    const existingOutbox = await db.calendar_outbox.where('eventId').equals(eventId).toArray()
    if (existingOutbox.some((item) => item.op === 'create')) {
      await db.calendar_events.delete(eventId)
      await db.calendar_outbox.where('eventId').equals(eventId).delete()
      return
    }

    const existingEvent = await db.calendar_events.get(eventId)
    const calendarId = existingEvent?.calendarId || existingOutbox[0]?.calendarId || 'primary'

    const updateIds = existingOutbox
      .filter((item) => item.op === 'update' && item.id !== undefined)
      .map((item) => item.id!)
    if (updateIds.length > 0) {
      await db.calendar_outbox.bulkDelete(updateIds)
    }

    await db.calendar_events.delete(eventId)
    if (!existingOutbox.some((item) => item.op === 'delete')) {
      await db.calendar_outbox.add({
        op: 'delete',
        eventId,
        calendarId,
        createdAt: Date.now(),
        attempts: 0,
      })
    }
  })
}

/** Actualiza la visibilidad local (`selected`) de un calendario. */
export async function toggleCalendarSelected(calendarId: string, selected: boolean): Promise<void> {
  await db.calendar_list.update(calendarId, { selected })
}

/** Lista las operaciones pendientes en el outbox en orden FIFO. */
export async function getPendingOutboxItems(): Promise<CalendarOutboxRow[]> {
  return db.calendar_outbox.orderBy('id').toArray()
}

/** Limpia toda la caché y cola offline local de Google Calendar. */
export async function clearLocalCalendarData(): Promise<void> {
  await db.transaction('rw', db.calendar_list, db.calendar_events, db.calendar_outbox, async () => {
    await Promise.all([
      db.calendar_list.clear(),
      db.calendar_events.clear(),
      db.calendar_outbox.clear(),
    ])
  })
}

/**
 * Sincroniza la lista local de calendarios preservando la preferencia `selected`
 * previamente elegida por el usuario para los IDs conocidos.
 */
export async function upsertCalendarList(
  remoteCalendars: Array<Omit<CalendarListRow, 'selected'> & { selected?: boolean }>,
): Promise<CalendarListRow[]> {
  return db.transaction('rw', db.calendar_list, async () => {
    const existing = await db.calendar_list.toArray()
    const selectedById = new Map(existing.map((cal) => [cal.id, cal.selected]))

    const rows: CalendarListRow[] = remoteCalendars.map((remote) => ({
      id: remote.id,
      summary: remote.summary,
      primary: remote.primary,
      backgroundColor: remote.backgroundColor,
      accessRole: remote.accessRole,
      selected: selectedById.get(remote.id) ?? remote.selected ?? remote.primary,
      ...(remote.timeZone !== undefined ? { timeZone: remote.timeZone } : {}),
    }))

    await db.calendar_list.clear()
    if (rows.length > 0) {
      await db.calendar_list.bulkPut(rows)
    }
    return rows
  })
}

function overlapsWindow(
  ev: Pick<CalendarEventRow, 'startMs' | 'endMs'>,
  windowStartMs: number,
  windowEndMs: number,
): boolean {
  if (ev.endMs <= ev.startMs) {
    return ev.startMs >= windowStartMs && ev.startMs < windowEndMs
  }
  return ev.startMs < windowEndMs && ev.endMs > windowStartMs
}

/**
 * Reconcilia los eventos remotos de un calendario dentro de `[windowStartMs, windowEndMs]`.
 * Elimina eventos `synced` obsoletos dentro de la ventana, conserva los de fuera de ventana,
 * y nunca sobrescribe ni elimina eventos locales `pending` o `error` ni borrados pendientes en outbox.
 */
export async function reconcileRemoteEventsWindow(params: {
  calendarId: string
  windowStartMs: number
  windowEndMs: number
  remoteEvents: Omit<CalendarEventRow, 'syncStatus' | 'syncError'>[]
}): Promise<void> {
  const { calendarId, windowStartMs, windowEndMs, remoteEvents } = params

  await db.transaction('rw', db.calendar_events, db.calendar_outbox, async () => {
    const [existingEvents, outboxRows] = await Promise.all([
      db.calendar_events.where('calendarId').equals(calendarId).toArray(),
      db.calendar_outbox.toArray(),
    ])

    const pendingOutboxIds = new Set(outboxRows.map((item) => item.eventId))
    const localById = new Map(existingEvents.map((ev) => [ev.id, ev]))
    const activeRemoteById = new Map<string, Omit<CalendarEventRow, 'syncStatus' | 'syncError'>>()
    const cancelledRemoteIds = new Set<string>()

    for (const remote of remoteEvents) {
      if (remote.status === 'cancelled') {
        cancelledRemoteIds.add(remote.id)
      } else {
        activeRemoteById.set(remote.id, remote)
      }
    }

    const idsToDelete: string[] = []
    for (const local of existingEvents) {
      if (local.syncStatus !== 'synced' || pendingOutboxIds.has(local.id)) continue
      if (cancelledRemoteIds.has(local.id)) {
        idsToDelete.push(local.id)
        continue
      }
      if (overlapsWindow(local, windowStartMs, windowEndMs) && !activeRemoteById.has(local.id)) {
        idsToDelete.push(local.id)
      }
    }

    const rowsToPut: CalendarEventRow[] = []
    for (const remote of activeRemoteById.values()) {
      const local = localById.get(remote.id)
      if (local && local.syncStatus !== 'synced') continue
      if (pendingOutboxIds.has(remote.id)) continue
      rowsToPut.push({
        ...remote,
        syncStatus: 'synced',
      })
    }

    if (idsToDelete.length > 0) {
      await db.calendar_events.bulkDelete(idsToDelete)
    }
    if (rowsToPut.length > 0) {
      await db.calendar_events.bulkPut(rowsToPut)
    }
  })
}
