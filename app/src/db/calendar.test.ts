import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, type CalendarEventDraft, type CalendarEventRow } from './db'
import {
  clearLocalCalendarData,
  computeDraftEventTimes,
  enqueueCreateEvent,
  enqueueDeleteEvent,
  enqueueUpdateEvent,
  getPendingOutboxItems,
  parseLocalDateYmd,
  reconcileRemoteEventsWindow,
  toggleCalendarSelected,
  upsertCalendarList,
} from './calendar'

async function clearCalendarTables() {
  await Promise.all([
    db.calendar_list.clear(),
    db.calendar_events.clear(),
    db.calendar_outbox.clear(),
  ])
}

beforeEach(clearCalendarTables)

describe('parseLocalDateYmd & computeDraftEventTimes', () => {
  it('parsea YYYY-MM-DD estrictamente como medianoche local sin corrimiento UTC', () => {
    const expected = new Date(2026, 10, 26, 0, 0, 0, 0).getTime()
    expect(parseLocalDateYmd('2026-11-26')).toBe(expected)
  })

  it('lanza error claro con formato inválido o fecha calendario inexistente', () => {
    expect(() => parseLocalDateYmd('2026/11/26')).toThrow(/YYYY-MM-DD/i)
    expect(() => parseLocalDateYmd('2026-11')).toThrow(/YYYY-MM-DD/i)
    expect(() => parseLocalDateYmd('2026-02-30')).toThrow(/inválida/i)
    expect(() => parseLocalDateYmd('2026-13-01')).toThrow(/inválida/i)
  })

  it('calcula startMs y endMs para allDay y con horario, y rechaza fin < inicio', () => {
    const allDay = computeDraftEventTimes({
      calendarId: 'primary',
      summary: 'Congreso UCI',
      description: '',
      location: '',
      startIso: '2026-11-26',
      endIso: '2026-11-27',
      allDay: true,
    })
    expect(allDay.startMs).toBe(new Date(2026, 10, 26, 0, 0, 0, 0).getTime())
    expect(allDay.endMs).toBe(new Date(2026, 10, 27, 0, 0, 0, 0).getTime())

    const timed = computeDraftEventTimes({
      calendarId: 'primary',
      summary: 'Pase de sala',
      description: '',
      location: '',
      startIso: '2026-11-26T08:00:00-03:00',
      endIso: '2026-11-26T10:00:00-03:00',
      allDay: false,
    })
    expect(timed.endMs - timed.startMs).toBe(2 * 60 * 60 * 1000)

    expect(() =>
      computeDraftEventTimes({
        calendarId: 'primary',
        summary: 'Invertido',
        description: '',
        location: '',
        startIso: '2026-11-27',
        endIso: '2026-11-26',
        allDay: true,
      }),
    ).toThrow()
  })
})

describe('calendar offline outbox coalescing', () => {
  const baseDraft: CalendarEventDraft = {
    calendarId: 'primary',
    summary: '  Guardia UCI Noche  ',
    description: 'Cobertura piso 3',
    location: 'UCI Adultos',
    startIso: '2026-11-26T20:00:00-03:00',
    endIso: '2026-11-27T08:00:00-03:00',
    allDay: false,
    timeZone: 'America/Santiago',
  }

  it('enqueueCreateEvent crea evento local-* pending y entrada create en outbox', async () => {
    const created = await enqueueCreateEvent(baseDraft)

    expect(created.id.startsWith('local-')).toBe(true)
    expect(created.summary).toBe('Guardia UCI Noche')
    expect(created.syncStatus).toBe('pending')

    const storedEvent = await db.calendar_events.get(created.id)
    expect(storedEvent).toEqual(created)

    const outbox = await getPendingOutboxItems()
    expect(outbox).toHaveLength(1)
    expect(outbox[0]).toMatchObject({
      op: 'create',
      eventId: created.id,
      calendarId: 'primary',
      attempts: 0,
      payload: {
        ...baseDraft,
        summary: 'Guardia UCI Noche',
      },
    })
  })

  it('enqueueUpdateEvent sobre evento local-* coalescea payload y calendarId en la entrada create', async () => {
    const created = await enqueueCreateEvent(baseDraft)

    const updatedDraft: CalendarEventDraft = {
      ...baseDraft,
      calendarId: 'guardias@group.calendar.google.com',
      summary: 'Guardia UCI Noche (confirmada)',
      location: 'UCI B',
    }
    const updated = await enqueueUpdateEvent(created.id, updatedDraft)

    expect(updated.id).toBe(created.id)
    expect(updated.calendarId).toBe('guardias@group.calendar.google.com')
    expect(updated.summary).toBe('Guardia UCI Noche (confirmada)')
    expect(updated.syncStatus).toBe('pending')

    const outbox = await getPendingOutboxItems()
    expect(outbox).toHaveLength(1)
    expect(outbox[0].op).toBe('create')
    expect(outbox[0].calendarId).toBe('guardias@group.calendar.google.com')
    expect(outbox[0].payload?.summary).toBe('Guardia UCI Noche (confirmada)')
    expect(outbox[0].payload?.location).toBe('UCI B')
  })

  it('enqueueDeleteEvent sobre evento local-* elimina evento y entrada create (net zero)', async () => {
    const created = await enqueueCreateEvent(baseDraft)
    await enqueueDeleteEvent(created.id)

    expect(await db.calendar_events.get(created.id)).toBeUndefined()
    expect(await getPendingOutboxItems()).toHaveLength(0)
  })

  it('enqueueUpdateEvent seguido de enqueueDeleteEvent en evento sincronizado reemplaza update por un solo delete', async () => {
    const syncedEvent: CalendarEventRow = {
      id: 'gcal-evt-42',
      calendarId: 'work-cal',
      summary: 'Reunión clínica',
      description: '',
      location: 'Sala 2',
      startIso: '2026-11-26T12:00:00-03:00',
      endIso: '2026-11-26T13:00:00-03:00',
      startMs: Date.parse('2026-11-26T12:00:00-03:00'),
      endMs: Date.parse('2026-11-26T13:00:00-03:00'),
      allDay: false,
      status: 'confirmed',
      updatedAt: 1000,
      syncStatus: 'error',
      syncError: 'Error previo 503',
    }
    await db.calendar_events.put(syncedEvent)

    const updated1 = await enqueueUpdateEvent('gcal-evt-42', {
      calendarId: 'work-cal',
      summary: 'Reunión clínica v1',
      description: '',
      location: 'Sala 2',
      startIso: '2026-11-26T12:00:00-03:00',
      endIso: '2026-11-26T13:00:00-03:00',
      allDay: false,
    })
    expect(updated1.syncStatus).toBe('pending')
    expect(updated1.syncError).toBeUndefined()

    await enqueueUpdateEvent('gcal-evt-42', {
      calendarId: 'work-cal',
      summary: 'Reunión clínica v2',
      description: 'Notas',
      location: 'Sala 3',
      startIso: '2026-11-26T12:00:00-03:00',
      endIso: '2026-11-26T13:00:00-03:00',
      allDay: false,
    })

    const outboxBeforeDelete = await getPendingOutboxItems()
    expect(outboxBeforeDelete).toHaveLength(1)
    expect(outboxBeforeDelete[0].op).toBe('update')
    expect(outboxBeforeDelete[0].payload?.summary).toBe('Reunión clínica v2')

    await enqueueDeleteEvent('gcal-evt-42')

    expect(await db.calendar_events.get('gcal-evt-42')).toBeUndefined()
    const outboxAfterDelete = await getPendingOutboxItems()
    expect(outboxAfterDelete).toHaveLength(1)
    expect(outboxAfterDelete[0]).toMatchObject({
      op: 'delete',
      eventId: 'gcal-evt-42',
      calendarId: 'work-cal',
      attempts: 0,
    })
  })
})

describe('reconcileRemoteEventsWindow & calendar_list', () => {
  it('reconcilia eventos synced dentro de la ventana y preserva fuera de ventana, pending y error', async () => {
    const winStart = new Date(2026, 10, 10, 0, 0, 0, 0).getTime()
    const winEnd = new Date(2026, 10, 20, 0, 0, 0, 0).getTime()

    await db.calendar_events.bulkPut([
      {
        id: 'outside-before-allday',
        calendarId: 'primary',
        summary: 'Día anterior',
        description: '',
        location: '',
        startIso: '2026-11-09',
        endIso: '2026-11-10',
        startMs: new Date(2026, 10, 9, 0, 0, 0, 0).getTime(),
        endMs: winStart,
        allDay: true,
        status: 'confirmed',
        updatedAt: 1,
        syncStatus: 'synced',
      },
      {
        id: 'outside-after',
        calendarId: 'primary',
        summary: 'Fuera después',
        description: '',
        location: '',
        startIso: '2026-11-22T09:00:00Z',
        endIso: '2026-11-22T10:00:00Z',
        startMs: new Date(2026, 10, 22, 9, 0, 0, 0).getTime(),
        endMs: new Date(2026, 10, 22, 10, 0, 0, 0).getTime(),
        allDay: false,
        status: 'confirmed',
        updatedAt: 1,
        syncStatus: 'synced',
      },
      {
        id: 'obsolete-inside',
        calendarId: 'primary',
        summary: 'Borrado en Google',
        description: '',
        location: '',
        startIso: '2026-11-12T10:00:00Z',
        endIso: '2026-11-12T11:00:00Z',
        startMs: new Date(2026, 10, 12, 10, 0, 0, 0).getTime(),
        endMs: new Date(2026, 10, 12, 11, 0, 0, 0).getTime(),
        allDay: false,
        status: 'confirmed',
        updatedAt: 1,
        syncStatus: 'synced',
      },
      {
        id: 'pending-inside',
        calendarId: 'primary',
        summary: 'Edición local pendiente',
        description: '',
        location: '',
        startIso: '2026-11-13T10:00:00Z',
        endIso: '2026-11-13T11:00:00Z',
        startMs: new Date(2026, 10, 13, 10, 0, 0, 0).getTime(),
        endMs: new Date(2026, 10, 13, 11, 0, 0, 0).getTime(),
        allDay: false,
        status: 'confirmed',
        updatedAt: 2,
        syncStatus: 'pending',
      },
      {
        id: 'error-inside',
        calendarId: 'primary',
        summary: 'Con error previo',
        description: '',
        location: '',
        startIso: '2026-11-14T10:00:00Z',
        endIso: '2026-11-14T11:00:00Z',
        startMs: new Date(2026, 10, 14, 10, 0, 0, 0).getTime(),
        endMs: new Date(2026, 10, 14, 11, 0, 0, 0).getTime(),
        allDay: false,
        status: 'confirmed',
        updatedAt: 2,
        syncStatus: 'error',
        syncError: '503',
      },
    ])

    await db.calendar_outbox.add({
      op: 'delete',
      eventId: 'deleted-locally-pending-push',
      calendarId: 'primary',
      createdAt: 5,
      attempts: 0,
    })

    await reconcileRemoteEventsWindow({
      calendarId: 'primary',
      windowStartMs: winStart,
      windowEndMs: winEnd,
      remoteEvents: [
        {
          id: 'remote-new',
          calendarId: 'primary',
          summary: 'Nuevo remoto',
          description: '',
          location: '',
          startIso: '2026-11-15T10:00:00Z',
          endIso: '2026-11-15T11:00:00Z',
          startMs: new Date(2026, 10, 15, 10, 0, 0, 0).getTime(),
          endMs: new Date(2026, 10, 15, 11, 0, 0, 0).getTime(),
          allDay: false,
          status: 'confirmed',
          updatedAt: 10,
        },
        {
          id: 'pending-inside',
          calendarId: 'primary',
          summary: 'Versión vieja en servidor',
          description: '',
          location: '',
          startIso: '2026-11-13T10:00:00Z',
          endIso: '2026-11-13T11:00:00Z',
          startMs: new Date(2026, 10, 13, 10, 0, 0, 0).getTime(),
          endMs: new Date(2026, 10, 13, 11, 0, 0, 0).getTime(),
          allDay: false,
          status: 'confirmed',
          updatedAt: 1,
        },
        {
          id: 'deleted-locally-pending-push',
          calendarId: 'primary',
          summary: 'No resucitar',
          description: '',
          location: '',
          startIso: '2026-11-16T10:00:00Z',
          endIso: '2026-11-16T11:00:00Z',
          startMs: new Date(2026, 10, 16, 10, 0, 0, 0).getTime(),
          endMs: new Date(2026, 10, 16, 11, 0, 0, 0).getTime(),
          allDay: false,
          status: 'confirmed',
          updatedAt: 1,
        },
      ],
    })

    expect(await db.calendar_events.get('outside-before-allday')).toBeDefined()
    expect(await db.calendar_events.get('outside-after')).toBeDefined()
    expect(await db.calendar_events.get('obsolete-inside')).toBeUndefined()
    expect((await db.calendar_events.get('pending-inside'))?.summary).toBe('Edición local pendiente')
    expect((await db.calendar_events.get('error-inside'))?.syncStatus).toBe('error')
    expect((await db.calendar_events.get('remote-new'))?.syncStatus).toBe('synced')
    expect(await db.calendar_events.get('deleted-locally-pending-push')).toBeUndefined()
  })

  it('upsertCalendarList preserva preferencia local selected y toggleCalendarSelected la actualiza', async () => {
    await db.calendar_list.put({
      id: 'primary',
      summary: 'Personal',
      primary: true,
      backgroundColor: '#039be5',
      accessRole: 'owner',
      selected: false,
    })

    const saved = await upsertCalendarList([
      {
        id: 'primary',
        summary: 'Personal Actualizado',
        primary: true,
        backgroundColor: '#039be5',
        accessRole: 'owner',
        selected: true,
      },
      {
        id: 'uci',
        summary: 'Turnos UCI',
        primary: false,
        backgroundColor: '#d50000',
        accessRole: 'writer',
      },
    ])

    expect(saved.find((c) => c.id === 'primary')?.selected).toBe(false)
    expect(saved.find((c) => c.id === 'uci')?.selected).toBe(false)

    await toggleCalendarSelected('uci', true)
    expect((await db.calendar_list.get('uci'))?.selected).toBe(true)

    await clearLocalCalendarData()
    expect(await db.calendar_list.count()).toBe(0)
    expect(await db.calendar_events.count()).toBe(0)
    expect(await db.calendar_outbox.count()).toBe(0)
  })
})
