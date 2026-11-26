import { describe, expect, it, vi } from 'vitest'
import {
  CalendarApiError,
  addDaysToYmd,
  buildDraftIsoRange,
  createRemoteCalendarEvent,
  deleteRemoteCalendarEvent,
  eventOverlapsRange,
  fetchCalendarEventsWindow,
  fetchCalendarList,
  formatLocalDateTimeInput,
  formatLocalDateYmd,
  getDefaultSyncWindow,
  parseCalendarEventTimes,
  parseLocalDateYmd,
  patchRemoteCalendarEvent,
} from './googleCalendar'

function makeJsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('local date helpers', () => {
  it('re-exporta parseLocalDateYmd y formatea YYYY-MM-DD / datetime-local en hora local', () => {
    const ms = parseLocalDateYmd('2026-11-26')
    expect(ms).toBe(new Date(2026, 10, 26, 0, 0, 0, 0).getTime())
    expect(formatLocalDateYmd(ms)).toBe('2026-11-26')

    const dt = new Date(2026, 10, 26, 8, 5, 0, 0)
    expect(formatLocalDateTimeInput(dt)).toBe('2026-11-26T08:05')
  })

  it('addDaysToYmd suma y resta días cruzando fin de mes y año bisiesto sin desfase', () => {
    expect(addDaysToYmd('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDaysToYmd('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDaysToYmd('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('getDefaultSyncWindow abarca -30 días (00:00:00.000) a +120 días (23:59:59.999) locales', () => {
    const now = new Date(2026, 10, 26, 14, 30, 0, 0).getTime()
    const win = getDefaultSyncWindow(now)
    expect(win.startMs).toBe(new Date(2026, 9, 27, 0, 0, 0, 0).getTime())
    expect(win.endMs).toBe(new Date(2027, 2, 26, 23, 59, 59, 999).getTime())
  })
})

describe('parseCalendarEventTimes & buildDraftIsoRange', () => {
  it('parsea eventos allDay { date } estrictamente en medianoche local sin corrimiento UTC', () => {
    const parsed = parseCalendarEventTimes(
      { date: '2026-11-26' },
      { date: '2026-11-27' },
    )
    expect(parsed.allDay).toBe(true)
    expect(parsed.startIso).toBe('2026-11-26')
    expect(parsed.endIso).toBe('2026-11-27')
    expect(parsed.startMs).toBe(new Date(2026, 10, 26, 0, 0, 0, 0).getTime())
    expect(parsed.endMs).toBe(new Date(2026, 10, 27, 0, 0, 0, 0).getTime())
  })

  it('parsea eventos con dateTime RFC3339 y allDay: false', () => {
    const parsed = parseCalendarEventTimes(
      { dateTime: '2026-11-26T22:00:00-03:00' },
      { dateTime: '2026-11-27T08:00:00-03:00' },
    )
    expect(parsed.allDay).toBe(false)
    expect(parsed.startMs).toBe(Date.parse('2026-11-26T22:00:00-03:00'))
    expect(parsed.endMs).toBe(Date.parse('2026-11-27T08:00:00-03:00'))
  })

  it('buildDraftIsoRange convierte endValue inclusivo UI a endIso exclusivo cuando allDay: true', () => {
    const range = buildDraftIsoRange({
      allDay: true,
      startValue: '2026-11-26',
      endValue: '2026-11-26',
    })
    expect(range.startIso).toBe('2026-11-26')
    expect(range.endIso).toBe('2026-11-27')
    expect(range.timeZone.length).toBeGreaterThan(0)

    expect(() =>
      buildDraftIsoRange({
        allDay: true,
        startValue: '2026-11-27',
        endValue: '2026-11-26',
      }),
    ).toThrow()
  })

  it('buildDraftIsoRange genera timestamps RFC3339 cuando allDay: false y rechaza rangos invertidos', () => {
    const range = buildDraftIsoRange({
      allDay: false,
      startValue: '2026-11-26T09:00',
      endValue: '2026-11-26T11:30',
    })
    expect(range.startIso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/)
    expect(range.endIso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/)
    expect(Date.parse(range.startIso)).toBe(new Date(2026, 10, 26, 9, 0, 0, 0).getTime())
    expect(Date.parse(range.endIso)).toBe(new Date(2026, 10, 26, 11, 30, 0, 0).getTime())

    expect(() =>
      buildDraftIsoRange({
        allDay: false,
        startValue: '2026-11-26T12:00',
        endValue: '2026-11-26T10:00',
      }),
    ).toThrow()
  })
})

describe('eventOverlapsRange', () => {
  const dayNStart = new Date(2026, 10, 26, 0, 0, 0, 0).getTime()
  const dayNEnd = new Date(2026, 10, 27, 0, 0, 0, 0).getTime()
  const dayN1Start = dayNEnd
  const dayN1End = new Date(2026, 10, 28, 0, 0, 0, 0).getTime()
  const dayNPrevStart = new Date(2026, 10, 25, 0, 0, 0, 0).getTime()

  it('detecta guardias nocturnas (22:00 día N a 08:00 día N+1) tanto en día N como en día N+1', () => {
    const overnight = {
      startMs: new Date(2026, 10, 26, 22, 0, 0, 0).getTime(),
      endMs: new Date(2026, 10, 27, 8, 0, 0, 0).getTime(),
      status: 'confirmed' as const,
    }
    expect(eventOverlapsRange(overnight, dayNPrevStart, dayNStart)).toBe(false)
    expect(eventOverlapsRange(overnight, dayNStart, dayNEnd)).toBe(true)
    expect(eventOverlapsRange(overnight, dayN1Start, dayN1End)).toBe(true)
  })

  it('asigna eventos allDay de un día solo a su día calendario local exacto', () => {
    const allDay = {
      startMs: dayNStart,
      endMs: dayNEnd,
      status: 'confirmed' as const,
    }
    expect(eventOverlapsRange(allDay, dayNPrevStart, dayNStart)).toBe(false)
    expect(eventOverlapsRange(allDay, dayNStart, dayNEnd)).toBe(true)
    expect(eventOverlapsRange(allDay, dayN1Start, dayN1End)).toBe(false)
  })

  it('ignora eventos con status cancelled', () => {
    const cancelled = {
      startMs: new Date(2026, 10, 26, 10, 0, 0, 0).getTime(),
      endMs: new Date(2026, 10, 26, 11, 0, 0, 0).getTime(),
      status: 'cancelled' as const,
    }
    expect(eventOverlapsRange(cancelled, dayNStart, dayNEnd)).toBe(false)
  })
})

describe('fetchCalendarList & fetchCalendarEventsWindow', () => {
  it('fetchCalendarList pagina y ordena el calendario primary primero', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        makeJsonResponse(200, {
          items: [
            {
              id: 'uci-team@group.calendar.google.com',
              summary: 'Guardias UCI',
              primary: false,
              backgroundColor: '#d50000',
              accessRole: 'reader',
              selected: true,
              timeZone: 'America/Argentina/Buenos_Aires',
            },
          ],
          nextPageToken: 'page-2',
        }),
      )
      .mockResolvedValueOnce(
        makeJsonResponse(200, {
          items: [
            {
              id: 'med@example.com',
              summary: 'Personal',
              primary: true,
              backgroundColor: '#039be5',
              accessRole: 'owner',
              selected: true,
            },
          ],
        }),
      )

    const result = await fetchCalendarList('tok-123', fetchMock)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/users/me/calendarList')
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('pageToken=page-2')
    expect(result.map((c) => c.id)).toEqual([
      'med@example.com',
      'uci-team@group.calendar.google.com',
    ])
    expect(result[0]?.defaultSelected).toBe(true)
    expect(result[1]?.defaultSelected).toBe(true)
  })

  it('fetchCalendarEventsWindow pasa singleEvents=true, orderBy=startTime, timeMin, timeMax y sigue nextPageToken', async () => {
    const calId = 'team+uci/1@group.calendar.google.com'
    const tMin = Date.UTC(2026, 10, 1, 0, 0, 0)
    const tMax = Date.UTC(2026, 11, 1, 0, 0, 0)

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        makeJsonResponse(200, {
          items: [
            {
              id: 'ev-1',
              summary: 'Pase de sala',
              description: 'Cama 1-8',
              location: 'UCI A',
              start: { dateTime: '2026-11-10T08:00:00Z' },
              end: { dateTime: '2026-11-10T10:00:00Z' },
              status: 'confirmed',
              updated: '2026-11-01T12:00:00Z',
            },
          ],
          nextPageToken: 'ev-page-2',
        }),
      )
      .mockResolvedValueOnce(
        makeJsonResponse(200, {
          items: [
            {
              id: 'ev-2',
              summary: 'Congreso',
              start: { date: '2026-11-26' },
              end: { date: '2026-11-27' },
              status: 'confirmed',
              recurringEventId: 'rec-root',
              htmlLink: 'https://calendar.google.com/event?eid=ev-2',
            },
          ],
        }),
      )

    const events = await fetchCalendarEventsWindow('tok-abc', calId, tMin, tMax, fetchMock)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const firstUrl = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(firstUrl.pathname).toBe(`/calendar/v3/calendars/${encodeURIComponent(calId)}/events`)
    expect(firstUrl.searchParams.get('singleEvents')).toBe('true')
    expect(firstUrl.searchParams.get('orderBy')).toBe('startTime')
    expect(firstUrl.searchParams.get('timeMin')).toBe(new Date(tMin).toISOString())
    expect(firstUrl.searchParams.get('timeMax')).toBe(new Date(tMax).toISOString())

    const secondUrl = new URL(String(fetchMock.mock.calls[1]?.[0]))
    expect(secondUrl.searchParams.get('pageToken')).toBe('ev-page-2')

    expect(events).toHaveLength(2)
    expect(events[0]?.calendarId).toBe(calId)
    expect(events[0]?.allDay).toBe(false)
    expect(events[1]?.allDay).toBe(true)
    expect(events[1]?.recurringEventId).toBe('rec-root')
    expect(events[1]?.htmlLink).toBe('https://calendar.google.com/event?eid=ev-2')
  })
})

describe('createRemoteCalendarEvent / patchRemoteCalendarEvent / deleteRemoteCalendarEvent & errores', () => {
  const sampleDraft = {
    calendarId: 'primary',
    summary: 'Guardia UCI',
    description: 'Sector B',
    location: 'Hospital',
    startIso: '2026-11-26',
    endIso: '2026-11-27',
    allDay: true,
  }

  it('crea, actualiza con PATCH y elimina codificando calendarId y eventId', async () => {
    const calId = 'cal/special@group.calendar.google.com'
    const evId = 'ev/123+abc'

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        makeJsonResponse(200, {
          id: evId,
          summary: 'Guardia UCI',
          description: 'Sector B',
          location: 'Hospital',
          start: { date: '2026-11-26' },
          end: { date: '2026-11-27' },
          status: 'confirmed',
        }),
      )
      .mockResolvedValueOnce(
        makeJsonResponse(200, {
          id: evId,
          summary: 'Guardia UCI actualizada',
          start: { dateTime: '2026-11-26T20:00:00Z' },
          end: { dateTime: '2026-11-27T08:00:00Z' },
          status: 'confirmed',
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))

    const created = await createRemoteCalendarEvent('tok', calId, { ...sampleDraft, calendarId: calId }, fetchMock)
    expect(created.id).toBe(evId)
    expect(created.allDay).toBe(true)
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`,
    )
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('POST')

    const patched = await patchRemoteCalendarEvent(
      'tok',
      calId,
      evId,
      {
        calendarId: calId,
        summary: 'Guardia UCI actualizada',
        description: '',
        location: '',
        startIso: '2026-11-26T20:00:00Z',
        endIso: '2026-11-27T08:00:00Z',
        allDay: false,
        timeZone: 'America/Argentina/Buenos_Aires',
      },
      fetchMock,
    )
    expect(patched.summary).toBe('Guardia UCI actualizada')
    expect(patched.allDay).toBe(false)
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(evId)}`,
    )
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe('PATCH')

    await deleteRemoteCalendarEvent('tok', calId, evId, fetchMock)
    expect(String(fetchMock.mock.calls[2]?.[0])).toBe(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(evId)}`,
    )
    expect(fetchMock.mock.calls[2]?.[1]?.method).toBe('DELETE')
  })

  it('mapea 401, 403 insufficientPermissions, 404, 410, 429, 500/503 y 400 a CalendarApiError', async () => {
    const cases: Array<{
      status: number
      body: unknown
      expectedReason: string
      action: (fn: typeof fetch) => Promise<unknown>
    }> = [
      {
        status: 401,
        body: { error: { code: 401, message: 'Invalid Credentials' } },
        expectedReason: 'unauthorized',
        action: (fn) => createRemoteCalendarEvent('bad', 'primary', sampleDraft, fn),
      },
      {
        status: 403,
        body: {
          error: {
            code: 403,
            message: 'Insufficient Permission',
            errors: [{ reason: 'insufficientPermissions', message: 'Insufficient Permission' }],
          },
        },
        expectedReason: 'insufficient_scope',
        action: (fn) => createRemoteCalendarEvent('tok', 'primary', sampleDraft, fn),
      },
      {
        status: 404,
        body: { error: { code: 404, message: 'Not Found' } },
        expectedReason: 'not_found',
        action: (fn) => patchRemoteCalendarEvent('tok', 'primary', 'ev-x', sampleDraft, fn),
      },
      {
        status: 410,
        body: { error: { code: 410, message: 'Resource has been deleted' } },
        expectedReason: 'gone',
        action: (fn) => deleteRemoteCalendarEvent('tok', 'primary', 'ev-x', fn),
      },
      {
        status: 429,
        body: { error: { code: 429, message: 'Rate Limit Exceeded' } },
        expectedReason: 'rate_limited',
        action: (fn) => patchRemoteCalendarEvent('tok', 'primary', 'ev-x', sampleDraft, fn),
      },
      {
        status: 500,
        body: { error: { code: 500, message: 'Backend Error' } },
        expectedReason: 'transient',
        action: (fn) => createRemoteCalendarEvent('tok', 'primary', sampleDraft, fn),
      },
      {
        status: 503,
        body: { error: { code: 503, message: 'Service Unavailable' } },
        expectedReason: 'transient',
        action: (fn) => deleteRemoteCalendarEvent('tok', 'primary', 'ev-x', fn),
      },
      {
        status: 400,
        body: { error: { code: 400, message: 'Bad Request' } },
        expectedReason: 'bad_request',
        action: (fn) => createRemoteCalendarEvent('tok', 'primary', sampleDraft, fn),
      },
    ]

    for (const c of cases) {
      const fn = vi.fn<typeof fetch>().mockResolvedValueOnce(makeJsonResponse(c.status, c.body))
      let caught: unknown
      try {
        await c.action(fn)
      } catch (err) {
        caught = err
      }
      expect(caught).toBeInstanceOf(CalendarApiError)
      const apiErr = caught as CalendarApiError
      expect(apiErr.status).toBe(c.status)
      expect(apiErr.reason).toBe(c.expectedReason)
    }
  })
})
