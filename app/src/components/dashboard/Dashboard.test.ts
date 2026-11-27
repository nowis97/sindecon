import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { CalendarEventRow, CalendarListRow } from '../../db/db'
import { ClinicalStationHeader } from '../common/ClinicalStationHeader'
import { Dashboard, type DashboardProps } from './Dashboard'

describe('Dashboard Component Contract', () => {
  it('exporta Dashboard como componente funcional de React', () => {
    expect(typeof Dashboard).toBe('function')
  })

  it('acepta las props completas de la estación clínica y callbacks de herramientas', () => {
    let captureOpened = false
    let driveOpened = false
    let studyOpened = false

    const props: DashboardProps = {
      nodes: [],
      templates: [],
      onSelectArticle: () => {},
      onOpenQuickCapture: () => {
        captureOpened = true
      },
      onCreateNode: () => {},
      onCreateFromTemplate: () => {},
      onOpenGoogleDriveSync: () => {
        driveOpened = true
      },
      onOpenStudy: () => {
        studyOpened = true
      },
      userName: 'Médico de Guardia',
      theme: 'light',
      dueFlashcardsCount: 4,
      totalFlashcardsCount: 32,
      favoriteIds: [],
      showTemplatesFolder: true,
    }

    expect(props.userName).toBe('Médico de Guardia')
    props.onOpenQuickCapture()
    props.onOpenGoogleDriveSync?.()
    props.onOpenStudy?.()
    expect(captureOpened).toBe(true)
    expect(driveOpened).toBe(true)
    expect(studyOpened).toBe(true)
  })

  it('muestra el acceso a Mazos en la cabecera cuando se pasa onOpenDecks', () => {
    const html = renderToStaticMarkup(
      createElement(Dashboard, {
        nodes: [],
        templates: [],
        onSelectArticle: () => {},
        onOpenQuickCapture: () => {},
        onCreateNode: () => {},
        onCreateFromTemplate: () => {},
        onOpenDecks: () => {},
      }),
    )

    expect(html).toContain('data-testid="header-decks-btn"')
    expect(html).toContain('Mazos')
  })

  it('acepta props opcionales de Google Calendar y renderiza CalendarGuardCard y botón Agenda en cabecera', () => {
    let calendarOpened = false
    let quickCreated = false
    const now = Date.now()

    const calendars: CalendarListRow[] = [
      {
        id: 'primary',
        summary: 'Guardias UCI',
        primary: true,
        backgroundColor: '#0f766e',
        accessRole: 'owner',
        selected: true,
      },
    ]
    const events: CalendarEventRow[] = [
      {
        id: 'ev-guardia',
        calendarId: 'primary',
        summary: 'Guardia UCI Noche',
        description: 'Turno nocturno',
        location: 'UCI Piso 3',
        startIso: new Date(now + 30 * 60_000).toISOString(),
        endIso: new Date(now + 150 * 60_000).toISOString(),
        startMs: now + 30 * 60_000,
        endMs: now + 150 * 60_000,
        allDay: false,
        status: 'confirmed',
        updatedAt: now,
        syncStatus: 'pending',
      },
    ]

    const disconnectedHtml = renderToStaticMarkup(
      createElement(Dashboard, {
        nodes: [],
        templates: [],
        onSelectArticle: () => {},
        onOpenQuickCapture: () => {},
        onCreateNode: () => {},
        onCreateFromTemplate: () => {},
        calendarEnabled: false,
        calendarOnline: true,
        calendarSyncState: 'idle',
        calendarCalendars: [],
        calendarEvents: [],
        onConnectCalendar: () => {},
        onOpenCalendar: () => {
          calendarOpened = true
        },
      }),
    )

    expect(disconnectedHtml).toContain('data-testid="calendar-guard-card"')
    expect(disconnectedHtml).toContain('data-testid="calendar-connect-btn"')
    expect(disconnectedHtml).toContain('Conectar Google Calendar')
    expect(disconnectedHtml).toContain('data-testid="header-calendar-btn"')
    expect(disconnectedHtml).toContain('Agenda')

    const connectedProps: DashboardProps = {
      nodes: [],
      templates: [],
      onSelectArticle: () => {},
      onOpenQuickCapture: () => {},
      onCreateNode: () => {},
      onCreateFromTemplate: () => {},
      calendarEnabled: true,
      calendarOnline: true,
      calendarSessionExpired: false,
      calendarNeedsConsent: false,
      calendarSyncState: 'idle',
      calendarPendingCount: 1,
      calendarCalendars: calendars,
      calendarEvents: events,
      calendarLastSyncedAt: new Date(now),
      calendarErrorMessage: null,
      onConnectCalendar: () => {},
      onSyncCalendar: () => {},
      onOpenCalendar: () => {
        calendarOpened = true
      },
      onQuickCreateCalendarEvent: () => {
        quickCreated = true
      },
      onSelectCalendarEvent: () => {},
    }

    connectedProps.onOpenCalendar?.()
    connectedProps.onQuickCreateCalendarEvent?.()
    expect(calendarOpened).toBe(true)
    expect(quickCreated).toBe(true)

    const connectedHtml = renderToStaticMarkup(createElement(Dashboard, connectedProps))
    expect(connectedHtml).toContain('data-testid="calendar-guard-card"')
    expect(connectedHtml).toContain('data-testid="calendar-open-modal-btn"')
    expect(connectedHtml).toContain('data-testid="calendar-quick-add-btn"')
    expect(connectedHtml).toContain('Guardia UCI Noche')
    expect(connectedHtml).toContain('Pendiente (1)')
  })

  it('muestra advertencia y aria-label accesible en ClinicalStationHeader cuando calendarNeedsConsent es true o está offline', () => {
    const consentHtml = renderToStaticMarkup(
      createElement(Dashboard, {
        nodes: [],
        templates: [],
        onSelectArticle: () => {},
        onOpenQuickCapture: () => {},
        onCreateNode: () => {},
        onCreateFromTemplate: () => {},
        calendarEnabled: true,
        calendarOnline: true,
        calendarNeedsConsent: true,
        calendarSyncState: 'error',
        onOpenCalendar: () => {},
      }),
    )

    expect(consentHtml).toContain('data-testid="header-calendar-btn"')
    expect(consentHtml).toContain('aria-label="Agenda: permisos requeridos"')
    expect(consentHtml).toContain('title="Agenda: faltan permisos de Google Calendar. Haz clic para autorizar."')
    expect(consentHtml).toContain('bg-[var(--cl-warn-soft)]')
    expect(consentHtml).toContain('bg-[var(--cl-warn)]')

    const headerOfflineHtml = renderToStaticMarkup(
      createElement(ClinicalStationHeader, {
        left: createElement('span', null, 'Header'),
        onOpenCalendar: () => {},
        calendarEnabled: true,
        calendarOnline: false,
      }),
    )
    expect(headerOfflineHtml).toContain('aria-label="Agenda offline"')
  })
})
