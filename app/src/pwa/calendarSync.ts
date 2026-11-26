import { db, type CalendarEventDraft, type CalendarOutboxRow } from '../db/db'
import {
  getPendingOutboxItems,
  reconcileRemoteEventsWindow,
  upsertCalendarList,
} from '../db/calendar'
import {
  CalendarApiError,
  createRemoteCalendarEvent,
  deleteRemoteCalendarEvent,
  fetchCalendarEventsWindow,
  fetchCalendarList,
  getDefaultSyncWindow,
  patchRemoteCalendarEvent,
} from './googleCalendar'

const GCAL_LAST_SYNC_KEY = 'sindecon-gcal-last-sync'

export interface CalendarSyncDeps {
  fetchFn?: typeof fetch
  now?: () => number
  fetchCalendarList?: typeof fetchCalendarList
  fetchCalendarEventsWindow?: typeof fetchCalendarEventsWindow
  createRemoteCalendarEvent?: typeof createRemoteCalendarEvent
  patchRemoteCalendarEvent?: typeof patchRemoteCalendarEvent
  deleteRemoteCalendarEvent?: typeof deleteRemoteCalendarEvent
}

export interface FlushOutboxResult {
  syncedCount: number
  notices: string[]
}

export interface PullCalendarWindowResult {
  calendarsCount: number
  eventsCount: number
}

export interface CalendarSyncResult {
  timestamp: number
  syncedOutboxCount: number
  eventsCount: number
  notices: string[]
}

export function getLastCalendarSyncTime(): number {
  if (typeof localStorage === 'undefined') return 0
  const raw = localStorage.getItem(GCAL_LAST_SYNC_KEY)
  const parsed = raw ? Number.parseInt(raw, 10) : 0
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

export function setLastCalendarSyncTime(timestamp: number): void {
  if (typeof localStorage === 'undefined') return
  if (timestamp > 0) {
    localStorage.setItem(GCAL_LAST_SYNC_KEY, String(timestamp))
  } else {
    localStorage.removeItem(GCAL_LAST_SYNC_KEY)
  }
}

function sameDraft(a?: CalendarEventDraft, b?: CalendarEventDraft): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

function isAuthOrScopeError(err: unknown): err is CalendarApiError {
  return (
    err instanceof CalendarApiError &&
    (err.status === 401 || err.reason === 'unauthorized' || err.reason === 'insufficient_scope')
  )
}

function isStaleNotFoundError(err: unknown): err is CalendarApiError {
  return (
    err instanceof CalendarApiError &&
    (err.status === 404 || err.status === 410 || err.reason === 'not_found' || err.reason === 'gone')
  )
}

function buildStaleNotice(item: CalendarOutboxRow): string {
  if (item.op === 'update') {
    const title = item.payload?.summary?.trim()
    return title
      ? `El evento "${title}" ya no existe en Google Calendar y se descartó de la cola local.`
      : 'Un evento editado ya no existe en Google Calendar y se descartó de la cola local.'
  }
  return 'Un evento eliminado ya no estaba en Google Calendar y se limpió de la cola local.'
}

/**
 * Envía en orden FIFO las operaciones pendientes de `calendar_outbox` hacia Google Calendar.
 */
export async function flushCalendarOutbox(
  token: string,
  deps?: CalendarSyncDeps,
): Promise<FlushOutboxResult> {
  const createRemote = deps?.createRemoteCalendarEvent ?? createRemoteCalendarEvent
  const patchRemote = deps?.patchRemoteCalendarEvent ?? patchRemoteCalendarEvent
  const deleteRemote = deps?.deleteRemoteCalendarEvent ?? deleteRemoteCalendarEvent
  const nowFn = deps?.now ?? Date.now

  const items = await getPendingOutboxItems()
  let syncedCount = 0
  const notices: string[] = []

  for (const item of items) {
    try {
      if (item.op === 'create') {
        if (!item.payload) {
          if (item.id !== undefined) await db.calendar_outbox.delete(item.id)
          continue
        }
        const remote = await createRemote(token, item.calendarId, item.payload, deps?.fetchFn)

        await db.transaction('rw', db.calendar_events, db.calendar_outbox, async () => {
          const currentOutbox =
            item.id !== undefined ? await db.calendar_outbox.get(item.id) : undefined

          if (item.id !== undefined && !currentOutbox) {
            await db.calendar_outbox.add({
              op: 'delete',
              eventId: remote.id,
              calendarId: item.calendarId,
              createdAt: nowFn(),
              attempts: 0,
            })
            return
          }

          if (
            currentOutbox &&
            currentOutbox.payload &&
            (currentOutbox.calendarId !== item.calendarId ||
              !sameDraft(currentOutbox.payload, item.payload))
          ) {
            const localRow = await db.calendar_events.get(item.eventId)
            await db.calendar_events.delete(item.eventId)
            if (localRow) {
              await db.calendar_events.put({
                ...localRow,
                id: remote.id,
                syncStatus: 'pending',
              })
            }
            if (currentOutbox.id !== undefined) {
              await db.calendar_outbox.delete(currentOutbox.id)
            }
            await db.calendar_outbox.add({
              op: 'update',
              eventId: remote.id,
              calendarId: currentOutbox.calendarId,
              payload: currentOutbox.payload,
              createdAt: nowFn(),
              attempts: 0,
            })
            return
          }

          await db.calendar_events.delete(item.eventId)
          await db.calendar_events.put({ ...remote, syncStatus: 'synced' })
          if (item.id !== undefined) {
            await db.calendar_outbox.delete(item.id)
          }
        })

        syncedCount += 1
        continue
      }

      if (item.op === 'update') {
        if (!item.payload) {
          if (item.id !== undefined) await db.calendar_outbox.delete(item.id)
          continue
        }
        const remote = await patchRemote(
          token,
          item.calendarId,
          item.eventId,
          item.payload,
          deps?.fetchFn,
        )

        await db.transaction('rw', db.calendar_events, db.calendar_outbox, async () => {
          const currentOutbox =
            item.id !== undefined ? await db.calendar_outbox.get(item.id) : undefined

          if (item.id !== undefined && !currentOutbox) {
            return
          }

          if (
            currentOutbox &&
            (currentOutbox.op !== 'update' ||
              currentOutbox.calendarId !== item.calendarId ||
              !sameDraft(currentOutbox.payload, item.payload))
          ) {
            return
          }

          await db.calendar_events.put({ ...remote, syncStatus: 'synced' })
          if (item.id !== undefined) {
            await db.calendar_outbox.delete(item.id)
          }
        })

        syncedCount += 1
        continue
      }

      await deleteRemote(token, item.calendarId, item.eventId, deps?.fetchFn)
      await db.transaction('rw', db.calendar_events, db.calendar_outbox, async () => {
        await db.calendar_events.delete(item.eventId)
        if (item.id !== undefined) {
          await db.calendar_outbox.delete(item.id)
        }
      })
      syncedCount += 1
    } catch (err) {
      if (isAuthOrScopeError(err)) {
        throw err
      }

      if (isStaleNotFoundError(err) && (item.op === 'update' || item.op === 'delete')) {
        await db.transaction('rw', db.calendar_events, db.calendar_outbox, async () => {
          if (item.id !== undefined) {
            await db.calendar_outbox.delete(item.id)
          }
          await db.calendar_events.delete(item.eventId)
        })
        notices.push(buildStaleNotice(item))
        continue
      }

      const errMsg = err instanceof Error ? err.message : String(err)
      await db.transaction('rw', db.calendar_events, db.calendar_outbox, async () => {
        if (item.id !== undefined) {
          await db.calendar_outbox.update(item.id, {
            attempts: (item.attempts ?? 0) + 1,
            lastError: errMsg,
          })
        }
        await db.calendar_events.update(item.eventId, {
          syncStatus: 'error',
          syncError: errMsg,
        })
      })
      throw err
    }
  }

  return { syncedCount, notices }
}

/**
 * Descarga la lista de calendarios y reconcilia los eventos de los calendarios seleccionados en la ventana dada.
 */
export async function pullGoogleCalendarWindow(
  token: string,
  windowRange?: { startMs: number; endMs: number },
  deps?: CalendarSyncDeps,
): Promise<PullCalendarWindowResult> {
  const listFn = deps?.fetchCalendarList ?? fetchCalendarList
  const eventsFn = deps?.fetchCalendarEventsWindow ?? fetchCalendarEventsWindow
  const nowFn = deps?.now ?? Date.now

  const range = windowRange ?? getDefaultSyncWindow(nowFn())
  const remoteCalendars = await listFn(token, deps?.fetchFn)

  const savedCalendars = await upsertCalendarList(
    remoteCalendars.map(({ defaultSelected, ...cal }) => ({
      ...cal,
      selected: defaultSelected,
    })),
  )

  const selectedCalendars = savedCalendars.filter((cal) => cal.selected)
  let eventsCount = 0

  for (const cal of selectedCalendars) {
    const remoteEvents = await eventsFn(token, cal.id, range.startMs, range.endMs, deps?.fetchFn)
    await reconcileRemoteEventsWindow({
      calendarId: cal.id,
      windowStartMs: range.startMs,
      windowEndMs: range.endMs,
      remoteEvents,
    })
    eventsCount += remoteEvents.filter((ev) => ev.status !== 'cancelled').length
  }

  return {
    calendarsCount: savedCalendars.length,
    eventsCount,
  }
}

/**
 * Sincroniza primero la cola local saliente (push) y luego descarga la ventana de eventos (pull).
 */
export async function performGoogleCalendarSync(
  token: string,
  options?: {
    startMs?: number
    endMs?: number
    deps?: CalendarSyncDeps
  },
): Promise<CalendarSyncResult> {
  const deps = options?.deps
  const nowFn = deps?.now ?? Date.now

  const pushResult = await flushCalendarOutbox(token, deps)

  const defaultWin = getDefaultSyncWindow(nowFn())
  const windowRange = {
    startMs: options?.startMs ?? defaultWin.startMs,
    endMs: options?.endMs ?? defaultWin.endMs,
  }

  const pullResult = await pullGoogleCalendarWindow(token, windowRange, deps)
  const timestamp = nowFn()
  setLastCalendarSyncTime(timestamp)

  return {
    timestamp,
    syncedOutboxCount: pushResult.syncedCount,
    eventsCount: pullResult.eventsCount,
    notices: pushResult.notices,
  }
}
