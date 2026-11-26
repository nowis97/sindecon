import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { CalendarEventRow, CalendarListRow } from '../../db/db'
import { CalendarGuardCard } from './CalendarGuardCard'
import { CalendarEventFormModal } from './CalendarEventFormModal'
import {
  CalendarModal,
  formatEventTimeRange,
  formatRelativeDayLabel,
  getMonthGridDays,
  getUpcomingEventsPreview,
  getWeekDays,
  groupAgendaDays,
} from './CalendarModal'

function makeCalendar(overrides: Partial<CalendarListRow> = {}): CalendarListRow {
  return {
    id: 'primary',
    summary: 'Guardias UCI',
    primary: true,
    backgroundColor: '#0f766e',
    accessRole: 'owner',
    selected: true,
    ...overrides,
  }
}

function makeEvent(overrides: Partial<CalendarEventRow> = {}): CalendarEventRow {
  const start = new Date(2026, 10, 26, 8, 0, 0, 0)
  const end = new Date(2026, 10, 26, 20, 0, 0, 0)
  return {
    id: 'ev-1',
    calendarId: 'primary',
    summary: 'Guardia UCI Torre A',
    description: 'Entrega de turno 08:00',
    location: 'UCI Adultos',
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    startMs: start.getTime(),
    endMs: end.getTime(),
    allDay: false,
    status: 'confirmed',
    updatedAt: start.getTime(),
    syncStatus: 'synced',
    ...overrides,
  }
}

describe('CalendarModal pure layout & date helpers', () => {
  it('getMonthGridDays construye una grilla lunes-domingo de 35 o 42 días sin saltos DST', () => {
    // Noviembre 2026: 1 nov es domingo -> 6 días previos (26..31 oct) + 30 nov + 6 dic = 42 días
    const novDays = getMonthGridDays(new Date(2026, 10, 15), new Date(2026, 10, 26, 10, 0).getTime())
    expect(novDays).toHaveLength(42)
    expect(novDays[0].ymd).toBe('2026-10-26')
    expect(novDays[0].inCurrentMonth).toBe(false)
    expect(novDays[6].ymd).toBe('2026-11-01')
    expect(novDays[6].inCurrentMonth).toBe(true)
    expect(novDays[35].ymd).toBe('2026-11-30')
    expect(novDays[35].inCurrentMonth).toBe(true)
    expect(novDays[41].ymd).toBe('2026-12-06')
    expect(novDays[41].inCurrentMonth).toBe(false)

    const todayCell = novDays.find((d) => d.ymd === '2026-11-26')
    expect(todayCell?.isToday).toBe(true)
    expect(novDays.filter((d) => d.isToday)).toHaveLength(1)

    // Todos los días deben tener fechas únicas consecutivas sin saltos
    const uniqueYmds = new Set(novDays.map((d) => d.ymd))
    expect(uniqueYmds.size).toBe(42)
    for (let i = 1; i < novDays.length; i += 1) {
      expect(novDays[i].startMs).toBe(novDays[i - 1].endMs)
    }

    // Diciembre 2026: 1 dic es martes -> 1 previo (30 nov) + 31 dic + 3 ene = 35 días
    const decDays = getMonthGridDays(new Date(2026, 11, 15))
    expect(decDays).toHaveLength(35)
    expect(decDays[0].ymd).toBe('2026-11-30')
    expect(decDays[34].ymd).toBe('2027-01-03')
  })

  it('getWeekDays construye exactamente 7 días de lunes a domingo incluyendo ancla domingo', () => {
    const wedWeek = getWeekDays(new Date(2026, 10, 18), new Date(2026, 10, 18, 9, 0).getTime())
    expect(wedWeek).toHaveLength(7)
    expect(wedWeek.map((d) => d.ymd)).toEqual([
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
      '2026-11-22',
    ])
    expect(wedWeek[2].isToday).toBe(true)

    const sunWeek = getWeekDays(new Date(2026, 10, 22))
    expect(sunWeek[0].ymd).toBe('2026-11-16')
    expect(sunWeek[6].ymd).toBe('2026-11-22')
  })

  it('getUpcomingEventsPreview filtra calendarios ocultos, eventos pasados/cancelados y limita cronológicamente', () => {
    const calendars: CalendarListRow[] = [
      makeCalendar({ id: 'primary', selected: true }),
      makeCalendar({ id: 'hidden', summary: 'Oculto', selected: false }),
    ]
    const nowMs = new Date(2026, 10, 26, 12, 0, 0, 0).getTime()

    const events: CalendarEventRow[] = [
      makeEvent({
        id: 'past',
        summary: 'Pase matutino finalizado',
        startMs: new Date(2026, 10, 26, 7, 0).getTime(),
        endMs: new Date(2026, 10, 26, 11, 0).getTime(),
      }),
      makeEvent({
        id: 'cancelled',
        summary: 'Reunión cancelada',
        status: 'cancelled',
        startMs: new Date(2026, 10, 26, 14, 0).getTime(),
        endMs: new Date(2026, 10, 26, 15, 0).getTime(),
      }),
      makeEvent({
        id: 'hidden-ev',
        calendarId: 'hidden',
        summary: 'Evento oculto',
        startMs: new Date(2026, 10, 26, 13, 0).getTime(),
        endMs: new Date(2026, 10, 26, 14, 0).getTime(),
      }),
      makeEvent({
        id: 'ongoing',
        summary: 'Guardia en curso',
        startMs: new Date(2026, 10, 26, 8, 0).getTime(),
        endMs: new Date(2026, 10, 26, 20, 0).getTime(),
      }),
      makeEvent({
        id: 'later-5',
        summary: 'Quinto evento fuera de límite',
        startMs: new Date(2026, 10, 30, 10, 0).getTime(),
        endMs: new Date(2026, 10, 30, 12, 0).getTime(),
      }),
      makeEvent({
        id: 'later-2',
        summary: 'Segundo evento',
        startMs: new Date(2026, 10, 27, 9, 0).getTime(),
        endMs: new Date(2026, 10, 27, 10, 0).getTime(),
      }),
      makeEvent({
        id: 'later-4',
        summary: 'Cuarto evento',
        startMs: new Date(2026, 10, 29, 9, 0).getTime(),
        endMs: new Date(2026, 10, 29, 10, 0).getTime(),
      }),
      makeEvent({
        id: 'later-3',
        summary: 'Tercer evento',
        startMs: new Date(2026, 10, 28, 9, 0).getTime(),
        endMs: new Date(2026, 10, 28, 10, 0).getTime(),
      }),
    ]

    const preview = getUpcomingEventsPreview(events, calendars, nowMs, 4)
    expect(preview.map((e) => e.id)).toEqual(['ongoing', 'later-2', 'later-3', 'later-4'])
  })

  it('groupAgendaDays agrupa por día local, ordena allDay primero y excluye calendarios ocultos', () => {
    const calendars: CalendarListRow[] = [
      makeCalendar({ id: 'primary', selected: true }),
      makeCalendar({ id: 'hidden', selected: false }),
    ]
    const nowMs = new Date(2026, 10, 26, 9, 0).getTime()
    const rangeStartMs = new Date(2026, 10, 26, 0, 0).getTime()
    const rangeEndMs = new Date(2026, 10, 29, 0, 0).getTime()

    const events: CalendarEventRow[] = [
      makeEvent({
        id: 'timed-morning',
        summary: 'Pase de sala',
        startMs: new Date(2026, 10, 26, 8, 30).getTime(),
        endMs: new Date(2026, 10, 26, 9, 30).getTime(),
      }),
      makeEvent({
        id: 'all-day-congress',
        summary: 'Jornada Medicina Crítica',
        allDay: true,
        startIso: '2026-11-26',
        endIso: '2026-11-28',
        startMs: new Date(2026, 10, 26, 0, 0).getTime(),
        endMs: new Date(2026, 10, 28, 0, 0).getTime(),
      }),
      makeEvent({
        id: 'hidden-ev',
        calendarId: 'hidden',
        summary: 'No mostrar',
        startMs: new Date(2026, 10, 27, 10, 0).getTime(),
        endMs: new Date(2026, 10, 27, 11, 0).getTime(),
      }),
    ]

    const groups = groupAgendaDays(events, calendars, rangeStartMs, rangeEndMs, nowMs)
    expect(groups).toHaveLength(2)
    expect(groups[0].ymd).toBe('2026-11-26')
    expect(groups[0].isToday).toBe(true)
    expect(groups[0].label).toContain('Hoy')
    expect(groups[0].events.map((e) => e.id)).toEqual(['all-day-congress', 'timed-morning'])

    expect(groups[1].ymd).toBe('2026-11-27')
    expect(groups[1].label).toContain('Mañana')
    expect(groups[1].events.map((e) => e.id)).toEqual(['all-day-congress'])
  })

  it('formatEventTimeRange y formatRelativeDayLabel formatean correctamente todo el día y horarios locales', () => {
    expect(
      formatEventTimeRange({
        allDay: true,
        startMs: new Date(2026, 10, 26, 0, 0).getTime(),
        endMs: new Date(2026, 10, 27, 0, 0).getTime(),
      }),
    ).toBe('Todo el día')

    expect(
      formatEventTimeRange({
        allDay: false,
        startMs: new Date(2026, 10, 26, 8, 5).getTime(),
        endMs: new Date(2026, 10, 26, 20, 30).getTime(),
      }),
    ).toBe('08:05 – 20:30')

    expect(
      formatEventTimeRange({
        allDay: false,
        startMs: new Date(2026, 10, 26, 8, 0).getTime(),
        endMs: new Date(2026, 10, 27, 8, 0).getTime(),
      }),
    ).toBe('08:00 – 08:00 (27 nov)')

    const nowMs = new Date(2026, 10, 26, 10, 0).getTime()
    expect(formatRelativeDayLabel(new Date(2026, 10, 26, 8, 0), nowMs)).toContain('Hoy')
    expect(formatRelativeDayLabel(new Date(2026, 10, 27, 8, 0), nowMs)).toContain('Mañana')
    expect(formatRelativeDayLabel(new Date(2026, 10, 25, 8, 0), nowMs)).toContain('Ayer')
  })
})

describe('CalendarGuardCard SSR contract', () => {
  it('renderiza CTA de conexión cuando está desconectado', () => {
    const html = renderToStaticMarkup(
      createElement(CalendarGuardCard, {
        isEnabled: false,
        isOnline: true,
        syncState: 'idle',
        calendars: [],
        events: [],
        onConnect: () => {},
        onSync: () => {},
        onOpenModal: () => {},
        onQuickAdd: () => {},
      }),
    )

    expect(html).toContain('data-testid="calendar-guard-card"')
    expect(html).toContain('data-testid="calendar-connect-btn"')
    expect(html).toContain('Conectar Google Calendar')
    expect(html).not.toContain('data-testid="calendar-quick-add-btn"')
  })

  it('renderiza próximos eventos, badge Pendiente y pill Sin conexión cuando está conectado offline', () => {
    const nowMs = new Date(2026, 10, 26, 9, 0).getTime()
    const html = renderToStaticMarkup(
      createElement(CalendarGuardCard, {
        theme: 'dark',
        isEnabled: true,
        isOnline: false,
        syncState: 'offline',
        pendingCount: 1,
        nowMs,
        calendars: [
          makeCalendar({ id: 'primary', backgroundColor: '#1a73e8', selected: true }),
          makeCalendar({ id: 'hidden', summary: 'Feriados', selected: false }),
        ],
        events: [
          makeEvent({
            id: 'local-1',
            summary: 'Guardia Nocturna UCI',
            startMs: new Date(2026, 10, 26, 20, 0).getTime(),
            endMs: new Date(2026, 10, 27, 8, 0).getTime(),
            syncStatus: 'pending',
          }),
          makeEvent({
            id: 'hidden-ev',
            calendarId: 'hidden',
            summary: 'Evento calendario oculto',
            startMs: new Date(2026, 10, 26, 15, 0).getTime(),
            endMs: new Date(2026, 10, 26, 16, 0).getTime(),
          }),
        ],
        onConnect: () => {},
        onSync: () => {},
        onOpenModal: () => {},
        onQuickAdd: () => {},
      }),
    )

    expect(html).toContain('data-testid="calendar-guard-card"')
    expect(html).toContain('data-testid="calendar-quick-add-btn"')
    expect(html).toContain('data-testid="calendar-sync-btn"')
    expect(html).toContain('data-testid="calendar-open-modal-btn"')
    expect(html).toContain('Guardia Nocturna UCI')
    expect(html).toContain('Pendiente')
    expect(html).toContain('Sin conexión')
    expect(html).toContain('#1a73e8')
    expect(html).not.toContain('Evento calendario oculto')
  })
})

describe('CalendarModal SSR contract', () => {
  it('renderiza pestañas Agenda / Semana / Mes, filtros y controles cuando isOpen=true', () => {
    const nowMs = new Date(2026, 10, 26, 9, 0).getTime()
    const html = renderToStaticMarkup(
      createElement(CalendarModal, {
        isOpen: true,
        onClose: () => {},
        theme: 'light',
        isOnline: true,
        syncState: 'idle',
        pendingCount: 0,
        lastSyncedAt: new Date(nowMs),
        noticeMessage: 'Se descartó un evento borrado en remoto.',
        nowMs,
        calendars: [
          makeCalendar({ id: 'primary', summary: 'Guardias UCI', selected: true }),
          makeCalendar({
            id: 'festivos',
            summary: 'Feriados',
            accessRole: 'reader',
            backgroundColor: '#7c3aed',
            selected: true,
          }),
        ],
        events: [
          makeEvent({
            id: 'ev-agenda',
            summary: 'Revista Clínica UCI',
            startMs: new Date(2026, 10, 26, 10, 0).getTime(),
            endMs: new Date(2026, 10, 26, 11, 30).getTime(),
          }),
        ],
        onSync: () => {},
        onDisconnect: () => {},
        onToggleCalendar: () => {},
        onCreateEvent: () => {},
        onSelectEvent: () => {},
      }),
    )

    expect(html).toContain('data-testid="calendar-modal"')
    expect(html).toContain('data-testid="calendar-view-agenda"')
    expect(html).toContain('data-testid="calendar-view-week"')
    expect(html).toContain('data-testid="calendar-view-month"')
    expect(html).toContain('data-testid="calendar-disconnect-btn"')
    expect(html).toContain('Agenda')
    expect(html).toContain('Semana')
    expect(html).toContain('Mes')
    expect(html).toContain('Guardias UCI')
    expect(html).toContain('Feriados')
    expect(html).toContain('Revista Clínica UCI')
    expect(html).toContain('Se descartó un evento borrado en remoto.')
  })

  it('soporta initialView week y month en renderizado estático y oculta cuando isOpen=false', () => {
    const weekHtml = renderToStaticMarkup(
      createElement(CalendarModal, {
        isOpen: true,
        initialView: 'week',
        onClose: () => {},
        isOnline: true,
        syncState: 'idle',
        calendars: [makeCalendar()],
        events: [makeEvent()],
        nowMs: new Date(2026, 10, 26, 9, 0).getTime(),
        onSync: () => {},
        onDisconnect: () => {},
        onToggleCalendar: () => {},
        onCreateEvent: () => {},
        onSelectEvent: () => {},
      }),
    )
    expect(weekHtml).toContain('Guardia UCI Torre A')

    const monthHtml = renderToStaticMarkup(
      createElement(CalendarModal, {
        isOpen: true,
        initialView: 'month',
        onClose: () => {},
        isOnline: false,
        syncState: 'offline',
        isSessionExpired: true,
        calendars: [makeCalendar()],
        events: [makeEvent()],
        nowMs: new Date(2026, 10, 26, 9, 0).getTime(),
        onSync: () => {},
        onDisconnect: () => {},
        onToggleCalendar: () => {},
        onCreateEvent: () => {},
        onSelectEvent: () => {},
      }),
    )
    expect(monthHtml).toContain('Guardia UCI Torre A')
    expect(monthHtml).toContain('Sin conexión')

    const closedHtml = renderToStaticMarkup(
      createElement(CalendarModal, {
        isOpen: false,
        onClose: () => {},
        isOnline: true,
        syncState: 'idle',
        calendars: [],
        events: [],
        onSync: () => {},
        onDisconnect: () => {},
        onToggleCalendar: () => {},
        onCreateEvent: () => {},
        onSelectEvent: () => {},
      }),
    )
    expect(closedHtml).toBe('')
  })
})

describe('CalendarEventFormModal SSR contract', () => {
  it('renderiza inputs de creación y selector de calendarios escribibles', () => {
    const html = renderToStaticMarkup(
      createElement(CalendarEventFormModal, {
        isOpen: true,
        onClose: () => {},
        defaultDateYmd: '2026-11-26',
        calendars: [
          makeCalendar({ id: 'primary', summary: 'Guardias UCI', accessRole: 'owner' }),
          makeCalendar({ id: 'ro', summary: 'Calendario Solo Lectura', accessRole: 'reader' }),
        ],
        onSubmit: () => {},
      }),
    )

    expect(html).toContain('data-testid="calendar-event-form-modal"')
    expect(html).toContain('data-testid="calendar-event-title-input"')
    expect(html).toContain('data-testid="calendar-event-allday-toggle"')
    expect(html).toContain('data-testid="calendar-event-submit-btn"')
    expect(html).toContain('Todo el día')
    expect(html).toContain('Guardias UCI')
    expect(html).not.toContain('Calendario Solo Lectura')
    expect(html).not.toContain('data-testid="calendar-event-delete-btn"')
  })

  it('renderiza advertencia de instancia recurrente y botón eliminar cuando recurringEventId está presente', () => {
    const html = renderToStaticMarkup(
      createElement(CalendarEventFormModal, {
        isOpen: true,
        onClose: () => {},
        calendars: [makeCalendar({ id: 'primary', accessRole: 'writer' })],
        event: makeEvent({
          id: 'inst-1',
          summary: 'Entrega de guardia',
          recurringEventId: 'series-123',
          allDay: true,
          startIso: '2026-11-26',
          endIso: '2026-11-27',
        }),
        onSubmit: () => {},
        onDelete: () => {},
      }),
    )

    expect(html).toContain('data-testid="calendar-event-form-modal"')
    expect(html).toContain('Entrega de guardia')
    expect(html).toContain('recurrente')
    expect(html).toContain('data-testid="calendar-event-delete-btn"')
  })

  it('convierte endIso exclusivo de eventos allDay a fecha inclusiva en input y renderiza tema oscuro y consentimiento', () => {
    const formHtml = renderToStaticMarkup(
      createElement(CalendarEventFormModal, {
        isOpen: true,
        theme: 'dark',
        isOnline: false,
        onClose: () => {},
        calendars: [makeCalendar({ id: 'primary', accessRole: 'owner' })],
        event: makeEvent({
          id: 'allday-multi',
          summary: 'Congreso Terapia Intensiva',
          allDay: true,
          startIso: '2026-11-26',
          endIso: '2026-11-29',
          syncStatus: 'pending',
        }),
        onSubmit: () => {},
        onDelete: () => {},
      }),
    )

    expect(formHtml).toContain('value="2026-11-26"')
    expect(formHtml).toContain('value="2026-11-28"')
    expect(formHtml).toContain('Pendiente de sincronización')

    const modalAuthHtml = renderToStaticMarkup(
      createElement(CalendarModal, {
        isOpen: true,
        theme: 'dark',
        onClose: () => {},
        isOnline: true,
        needsCalendarConsent: true,
        syncState: 'error',
        errorMessage: 'Falta autorización de escritura.',
        calendars: [makeCalendar()],
        events: [],
        onSync: () => {},
        onReconnect: () => {},
        onDisconnect: () => {},
        onToggleCalendar: () => {},
        onCreateEvent: () => {},
        onSelectEvent: () => {},
      }),
    )

    expect(modalAuthHtml).toContain('data-testid="calendar-reconnect-btn"')
    expect(modalAuthHtml).toContain('Falta autorización de escritura.')
    expect(modalAuthHtml).toContain('Faltan permisos de Google Calendar')
  })

  it('bloquea edición y eliminación cuando el calendario es reader o freeBusyReader', () => {
    const html = renderToStaticMarkup(
      createElement(CalendarEventFormModal, {
        isOpen: true,
        onClose: () => {},
        calendars: [
          makeCalendar({
            id: 'shared-ro',
            summary: 'Turnos Jefatura',
            accessRole: 'freeBusyReader',
          }),
        ],
        event: makeEvent({
          id: 'ro-1',
          calendarId: 'shared-ro',
          summary: 'Bloqueo Quirúrgico',
        }),
        onSubmit: () => {},
        onDelete: () => {},
      }),
    )

    expect(html).toContain('solo lectura')
    expect(html).toContain('Turnos Jefatura')
    expect(html).not.toContain('data-testid="calendar-event-submit-btn"')
    expect(html).not.toContain('data-testid="calendar-event-delete-btn"')
  })
})
