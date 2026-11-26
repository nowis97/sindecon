import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, type CalendarEventDraft, type CalendarEventRow } from '../db/db'
import {
  enqueueCreateEvent,
  enqueueDeleteEvent,
  enqueueUpdateEvent,
  getPendingOutboxItems,
} from '../db/calendar'
import { CalendarApiError } from './googleCalendar'
import {
  flushCalendarOutbox,
  getLastCalendarSyncTime,
  performGoogleCalendarSync,
  pullGoogleCalendarWindow,
  setLastCalendarSyncTime,
} from './calendarSync'
import { canWriteCalendar, isCalendarSessionError } from '../hooks/useGoogleCalendar'
import { syncWithAutoRefresh } from '../hooks/useGoogleSync'

const store: Record<string, string> = {}
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => {
    store[key] = String(value)
  },
  removeItem: (key: string) => {
    delete store[key]
  },
  clear: () => {
    for (const key of Object.keys(store)) delete store[key]
  },
}

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
})

function makeDraft(overrides: Partial<CalendarEventDraft> = {}): CalendarEventDraft {
  return {
    calendarId: 'primary',
    summary: 'Guardia UCI',
    description: 'Cobertura clínica',
    location: 'UCI Adultos',
    startIso: '2026-11-26T08:00:00-03:00',
    endIso: '2026-11-26T20:00:00-03:00',
    allDay: false,
    timeZone: 'America/Santiago',
    ...overrides,
  }
}

function makeSyncedEvent(
  id: string,
  overrides: Partial<CalendarEventRow> = {},
): CalendarEventRow {
  return {
    id,
    calendarId: 'primary',
    summary: `Evento ${id}`,
    description: '',
    location: '',
    startIso: '2026-11-26T10:00:00-03:00',
    endIso: '2026-11-26T11:00:00-03:00',
    startMs: Date.parse('2026-11-26T10:00:00-03:00'),
    endMs: Date.parse('2026-11-26T11:00:00-03:00'),
    allDay: false,
    status: 'confirmed',
    updatedAt: 1000,
    syncStatus: 'synced',
    ...overrides,
  }
}

beforeEach(async () => {
  localStorageMock.clear()
  await Promise.all([
    db.calendar_list.clear(),
    db.calendar_events.clear(),
    db.calendar_outbox.clear(),
  ])
})

describe('flushCalendarOutbox', () => {
  it('replays FIFO [create local-1, update existing-2, delete existing-3], replaces local-1 id, marks synced, and empties outbox', async () => {
    await db.calendar_events.bulkPut([
      makeSyncedEvent('existing-2', { summary: 'Original 2' }),
      makeSyncedEvent('existing-3', { summary: 'Para borrar 3' }),
    ])

    const local1 = await enqueueCreateEvent(makeDraft({ summary: 'Nuevo turno' }))
    await enqueueUpdateEvent('existing-2', makeDraft({ summary: 'Editado 2' }))
    await enqueueDeleteEvent('existing-3')

    const callOrder: string[] = []
    const createRemoteCalendarEvent = vi.fn(async (_token, calendarId, draft) => {
      callOrder.push(`create:${draft.summary}`)
      return {
        ...makeSyncedEvent('remote-gcal-1', { calendarId, summary: draft.summary }),
      }
    })
    const patchRemoteCalendarEvent = vi.fn(async (_token, calendarId, eventId, draft) => {
      callOrder.push(`update:${eventId}:${draft.summary}`)
      return {
        ...makeSyncedEvent(eventId, { calendarId, summary: draft.summary }),
      }
    })
    const deleteRemoteCalendarEvent = vi.fn(async (_token, _calendarId, eventId) => {
      callOrder.push(`delete:${eventId}`)
    })

    const result = await flushCalendarOutbox('tok-ok', {
      createRemoteCalendarEvent,
      patchRemoteCalendarEvent,
      deleteRemoteCalendarEvent,
    })

    expect(callOrder).toEqual([
      'create:Nuevo turno',
      'update:existing-2:Editado 2',
      'delete:existing-3',
    ])
    expect(result).toEqual({ syncedCount: 3, notices: [] })

    expect(await db.calendar_events.get(local1.id)).toBeUndefined()
    const createdRemote = await db.calendar_events.get('remote-gcal-1')
    expect(createdRemote).toMatchObject({
      id: 'remote-gcal-1',
      summary: 'Nuevo turno',
      syncStatus: 'synced',
    })

    const updatedRemote = await db.calendar_events.get('existing-2')
    expect(updatedRemote).toMatchObject({
      id: 'existing-2',
      summary: 'Editado 2',
      syncStatus: 'synced',
    })
    expect(updatedRemote?.syncError).toBeUndefined()
    expect(await db.calendar_events.get('existing-3')).toBeUndefined()
    expect(await getPendingOutboxItems()).toHaveLength(0)
  })

  it('on 404/410 during update or delete, clears stale outbox item and stale event, collects notices, and continues FIFO', async () => {
    await db.calendar_events.bulkPut([
      makeSyncedEvent('stale-update-404', { summary: 'Evento borrado en Google' }),
      makeSyncedEvent('stale-delete-410', { summary: 'Ya eliminado' }),
    ])

    await enqueueUpdateEvent(
      'stale-update-404',
      makeDraft({ summary: 'Evento borrado en Google' }),
    )
    await enqueueDeleteEvent('stale-delete-410')
    const localAfter = await enqueueCreateEvent(makeDraft({ summary: 'Turno válido' }))

    const patchRemoteCalendarEvent = vi
      .fn()
      .mockRejectedValueOnce(new CalendarApiError(404, 'not_found', 'Not Found'))
    const deleteRemoteCalendarEvent = vi
      .fn()
      .mockRejectedValueOnce(new CalendarApiError(410, 'gone', 'Gone'))
    const createRemoteCalendarEvent = vi.fn(async (_token, calendarId, draft) =>
      makeSyncedEvent('remote-after-stale', { calendarId, summary: draft.summary }),
    )

    const result = await flushCalendarOutbox('tok-ok', {
      patchRemoteCalendarEvent,
      deleteRemoteCalendarEvent,
      createRemoteCalendarEvent,
    })

    expect(result.syncedCount).toBe(1)
    expect(result.notices).toHaveLength(2)
    expect(result.notices[0]).toContain('Evento borrado en Google')
    expect(result.notices[1]).toMatch(/Google Calendar|cola/i)

    expect(await db.calendar_events.get('stale-update-404')).toBeUndefined()
    expect(await db.calendar_events.get('stale-delete-410')).toBeUndefined()
    expect(await db.calendar_events.get(localAfter.id)).toBeUndefined()
    expect((await db.calendar_events.get('remote-after-stale'))?.syncStatus).toBe('synced')
    expect(await getPendingOutboxItems()).toHaveLength(0)
  })

  it('on 401 unauthorized or 403 insufficient_scope, aborts immediately keeping remaining outbox items intact and rethrows CalendarApiError', async () => {
    const local1 = await enqueueCreateEvent(makeDraft({ summary: 'Op 1' }))
    await db.calendar_events.put(makeSyncedEvent('existing-2'))
    await enqueueUpdateEvent('existing-2', makeDraft({ summary: 'Op 2' }))

    const create401 = vi
      .fn()
      .mockRejectedValueOnce(new CalendarApiError(401, 'unauthorized', 'Invalid Credentials'))
    const patchMock = vi.fn()

    let err401: unknown
    try {
      await flushCalendarOutbox('bad-tok', {
        createRemoteCalendarEvent: create401,
        patchRemoteCalendarEvent: patchMock,
      })
    } catch (err) {
      err401 = err
    }

    expect(err401).toBeInstanceOf(CalendarApiError)
    expect((err401 as CalendarApiError).status).toBe(401)
    expect((err401 as CalendarApiError).reason).toBe('unauthorized')
    expect(patchMock).not.toHaveBeenCalled()

    const outboxAfter401 = await getPendingOutboxItems()
    expect(outboxAfter401).toHaveLength(2)
    expect(outboxAfter401[0]?.attempts).toBe(0)
    expect(outboxAfter401[0]?.lastError).toBeUndefined()
    expect((await db.calendar_events.get(local1.id))?.syncStatus).toBe('pending')

    const create403 = vi
      .fn()
      .mockRejectedValueOnce(
        new CalendarApiError(403, 'insufficient_scope', 'Insufficient Permission'),
      )

    let err403: unknown
    try {
      await flushCalendarOutbox('no-scope-tok', {
        createRemoteCalendarEvent: create403,
        patchRemoteCalendarEvent: patchMock,
      })
    } catch (err) {
      err403 = err
    }

    expect(err403).toBeInstanceOf(CalendarApiError)
    expect((err403 as CalendarApiError).status).toBe(403)
    expect((err403 as CalendarApiError).reason).toBe('insufficient_scope')
    expect(patchMock).not.toHaveBeenCalled()
    expect(await getPendingOutboxItems()).toHaveLength(2)
  })

  it('on 503 transient, increments attempts, stores lastError, marks event syncStatus error, stops following ops, and recovers on later edit/retry', async () => {
    await db.calendar_events.put(makeSyncedEvent('existing-1', { summary: 'Pase UCI' }))
    await db.calendar_events.put(makeSyncedEvent('existing-2', { summary: 'Segundo evento' }))

    await enqueueUpdateEvent('existing-1', makeDraft({ summary: 'Pase UCI actualizado' }))
    await enqueueDeleteEvent('existing-2')

    const patch503 = vi
      .fn()
      .mockRejectedValueOnce(new CalendarApiError(503, 'transient', 'Service Unavailable'))
    const deleteMock = vi.fn()

    await expect(
      flushCalendarOutbox('tok-ok', {
        patchRemoteCalendarEvent: patch503,
        deleteRemoteCalendarEvent: deleteMock,
      }),
    ).rejects.toThrow('Service Unavailable')

    expect(deleteMock).not.toHaveBeenCalled()

    const outboxAfter503 = await getPendingOutboxItems()
    expect(outboxAfter503).toHaveLength(2)
    expect(outboxAfter503[0]?.attempts).toBe(1)
    expect(outboxAfter503[0]?.lastError).toBe('Service Unavailable')

    const erroredEvent = await db.calendar_events.get('existing-1')
    expect(erroredEvent?.syncStatus).toBe('error')
    expect(erroredEvent?.syncError).toBe('Service Unavailable')

    // Re-editing the errored event clears lastError while keeping attempts: 1; next flush must still retry it
    await enqueueUpdateEvent('existing-1', makeDraft({ summary: 'Pase UCI v3' }))
    const outboxBeforeRetry = await getPendingOutboxItems()
    expect(outboxBeforeRetry[0]?.attempts).toBe(1)
    expect(outboxBeforeRetry[0]?.lastError).toBeUndefined()

    const patchOk = vi.fn(async (_token, calendarId, eventId, draft) =>
      makeSyncedEvent(eventId, { calendarId, summary: draft.summary }),
    )
    const deleteOk = vi.fn(async () => {})

    const retryRes = await flushCalendarOutbox('tok-ok', {
      patchRemoteCalendarEvent: patchOk,
      deleteRemoteCalendarEvent: deleteOk,
    })

    expect(retryRes).toEqual({ syncedCount: 2, notices: [] })
    expect(await getPendingOutboxItems()).toHaveLength(0)
    expect((await db.calendar_events.get('existing-1'))?.syncStatus).toBe('synced')
  })
})

describe('pullGoogleCalendarWindow & performGoogleCalendarSync', () => {
  it('performGoogleCalendarSync pushes outbox first, pulls calendar list and selected calendars only, and preserves concurrent pending items', async () => {
    await db.calendar_list.put({
      id: 'hidden-cal',
      summary: 'Feriados',
      primary: false,
      backgroundColor: '#7986cb',
      accessRole: 'reader',
      selected: false,
    })

    await db.calendar_events.put(
      makeSyncedEvent('obsolete-on-server', {
        summary: 'Borrado remotamente',
      }),
    )

    const localInitial = await enqueueCreateEvent(makeDraft({ summary: 'Push primero' }))
    const eventsOrder: string[] = []
    const serverEvents: Array<Omit<CalendarEventRow, 'syncStatus' | 'syncError'>> = [
      {
        id: 'remote-pulled-1',
        calendarId: 'primary',
        summary: 'Guardia Remota',
        description: '',
        location: '',
        startIso: '2026-11-28T08:00:00-03:00',
        endIso: '2026-11-28T20:00:00-03:00',
        startMs: Date.parse('2026-11-28T08:00:00-03:00'),
        endMs: Date.parse('2026-11-28T20:00:00-03:00'),
        allDay: false,
        status: 'confirmed',
        updatedAt: 5000,
      },
    ]

    const createRemoteCalendarEvent = vi.fn(async (_token, calendarId, draft) => {
      eventsOrder.push('push')
      const created = makeSyncedEvent('remote-pushed', { calendarId, summary: draft.summary })
      serverEvents.push(created)
      return created
    })

    const fetchCalendarList = vi.fn(async () => {
      eventsOrder.push('list')
      return [
        {
          id: 'primary',
          summary: 'Personal',
          primary: true,
          backgroundColor: '#039be5',
          accessRole: 'owner' as const,
          defaultSelected: true,
        },
        {
          id: 'hidden-cal',
          summary: 'Feriados',
          primary: false,
          backgroundColor: '#7986cb',
          accessRole: 'reader' as const,
          defaultSelected: true,
        },
      ]
    })

    let concurrentPendingId = ''
    const fetchCalendarEventsWindow = vi.fn(async (_token, calendarId) => {
      eventsOrder.push(`events:${calendarId}`)
      // Simulate user adding a local pending event while pull is in flight
      const pendingRow = await enqueueCreateEvent(
        makeDraft({ calendarId, summary: 'Concurrente offline' }),
      )
      concurrentPendingId = pendingRow.id
      return [...serverEvents]
    })

    const fixedNow = 1795700000000
    const res = await performGoogleCalendarSync('tok-ok', {
      startMs: Date.parse('2026-11-01T00:00:00-03:00'),
      endMs: Date.parse('2026-12-31T23:59:59-03:00'),
      deps: {
        now: () => fixedNow,
        createRemoteCalendarEvent,
        fetchCalendarList,
        fetchCalendarEventsWindow,
      },
    })

    expect(eventsOrder).toEqual(['push', 'list', 'events:primary'])
    expect(fetchCalendarEventsWindow).toHaveBeenCalledTimes(1)
    expect(res).toEqual({
      timestamp: fixedNow,
      syncedOutboxCount: 1,
      eventsCount: 2,
      notices: [],
    })

    expect(getLastCalendarSyncTime()).toBe(fixedNow)
    expect(localStorageMock.getItem('sindecon-gcal-last-sync')).toBe(String(fixedNow))

    expect((await db.calendar_list.get('hidden-cal'))?.selected).toBe(false)
    expect((await db.calendar_list.get('primary'))?.selected).toBe(true)

    expect(await db.calendar_events.get(localInitial.id)).toBeUndefined()
    expect(await db.calendar_events.get('obsolete-on-server')).toBeUndefined()
    expect((await db.calendar_events.get('remote-pushed'))?.syncStatus).toBe('synced')
    expect((await db.calendar_events.get('remote-pulled-1'))?.syncStatus).toBe('synced')
    expect((await db.calendar_events.get(concurrentPendingId))?.syncStatus).toBe('pending')
    expect(await getPendingOutboxItems()).toHaveLength(1)
  })

  it('getLastCalendarSyncTime y setLastCalendarSyncTime persisten y limpian clave sindecon-gcal-last-sync', () => {
    expect(getLastCalendarSyncTime()).toBe(0)
    setLastCalendarSyncTime(1795701234567)
    expect(getLastCalendarSyncTime()).toBe(1795701234567)
    expect(localStorageMock.getItem('sindecon-gcal-last-sync')).toBe('1795701234567')
    setLastCalendarSyncTime(0)
    expect(getLastCalendarSyncTime()).toBe(0)
    expect(localStorageMock.getItem('sindecon-gcal-last-sync')).toBeNull()
  })

  it('pullGoogleCalendarWindow funciona de forma independiente con ventana explícita', async () => {
    const fetchCalendarList = vi.fn(async () => [
      {
        id: 'primary',
        summary: 'Principal',
        primary: true,
        backgroundColor: '#039be5',
        accessRole: 'owner' as const,
        defaultSelected: true,
      },
    ])
    const fetchCalendarEventsWindow = vi.fn(async () => [])

    const res = await pullGoogleCalendarWindow(
      'tok-ok',
      { startMs: 1000, endMs: 2000 },
      { fetchCalendarList, fetchCalendarEventsWindow },
    )

    expect(res).toEqual({ calendarsCount: 1, eventsCount: 0 })
    expect(fetchCalendarEventsWindow).toHaveBeenCalledWith('tok-ok', 'primary', 1000, 2000, undefined)
  })
})

describe('useGoogleCalendar pure helpers & syncWithAutoRefresh integration', () => {
  it('canWriteCalendar permite owner/writer y bloquea reader/freeBusyReader/undefined', () => {
    expect(canWriteCalendar({ accessRole: 'owner' })).toBe(true)
    expect(canWriteCalendar({ accessRole: 'writer' })).toBe(true)
    expect(canWriteCalendar({ accessRole: 'reader' })).toBe(false)
    expect(canWriteCalendar({ accessRole: 'freeBusyReader' })).toBe(false)
    expect(canWriteCalendar(undefined)).toBe(false)
  })

  it('isCalendarSessionError identifica errores 401/expiración sin confundir 403 insufficient_scope ni 503', () => {
    expect(isCalendarSessionError('HTTP 401 Unauthorized')).toBe(true)
    expect(isCalendarSessionError('Invalid Credentials')).toBe(true)
    expect(isCalendarSessionError('Request had invalid authentication credentials.')).toBe(true)
    expect(isCalendarSessionError('Sesión de Google expirada')).toBe(true)
    expect(isCalendarSessionError('403 insufficient_scope')).toBe(false)
    expect(isCalendarSessionError('Insufficient Permission')).toBe(false)
    expect(isCalendarSessionError('Service Unavailable (503)')).toBe(false)
    expect(isCalendarSessionError('')).toBe(false)
  })

  it('syncWithAutoRefresh reintenta 1 vez con token renovado ante 401 Invalid Credentials y no reintenta ante insufficient_scope', async () => {
    const ensureToken = vi.fn().mockResolvedValue('ya29.rotated')
    const runSync = vi
      .fn()
      .mockRejectedValueOnce(new CalendarApiError(401, 'unauthorized', 'Invalid Credentials'))
      .mockResolvedValueOnce({ action: 'up-to-date' as const, timestamp: 123456 })

    const res = await syncWithAutoRefresh({
      getToken: () => 'ya29.stale',
      ensureToken,
      runSync,
      isSessionError: isCalendarSessionError,
    })

    expect(ensureToken).toHaveBeenCalledWith(true)
    expect(runSync).toHaveBeenCalledTimes(2)
    expect(res).toEqual({ action: 'up-to-date', timestamp: 123456 })

    const ensureTokenScope = vi.fn()
    await expect(
      syncWithAutoRefresh({
        getToken: () => 'ya29.no-cal-scope',
        ensureToken: ensureTokenScope,
        runSync: async () => {
          throw new CalendarApiError(403, 'insufficient_scope', 'Insufficient Permission')
        },
        isSessionError: isCalendarSessionError,
      }),
    ).rejects.toThrow('Insufficient Permission')
    expect(ensureTokenScope).not.toHaveBeenCalled()
  })
})
