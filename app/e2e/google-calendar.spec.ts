import { test, expect, type Page } from '@playwright/test'

interface MockGoogleEvent {
  id: string
  calendarId: string
  summary: string
  description?: string
  location?: string
  start: { date?: string; dateTime?: string; timeZone?: string }
  end: { date?: string; dateTime?: string; timeZone?: string }
  status: string
  htmlLink?: string
  updated: string
}

interface CalendarMockState {
  calendars: Array<{
    id: string
    summary: string
    primary?: boolean
    backgroundColor?: string
    accessRole: string
    selected?: boolean
    timeZone?: string
  }>
  events: MockGoogleEvent[]
  postPayloads: Array<Record<string, unknown>>
  patchPayloads: Array<{ eventId: string; body: Record<string, unknown> }>
  deleteRequests: Array<{ calendarId: string; eventId: string }>
  driveCalls: string[]
}

const CALENDAR_SCOPES =
  'openid email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly'

async function installGoogleCalendarMocks(page: Page): Promise<CalendarMockState> {
  const now = Date.now()
  const seedStart = new Date(now - 5 * 60_000).toISOString()
  const seedEnd = new Date(now + 2 * 60 * 60_000).toISOString()

  const state: CalendarMockState = {
    calendars: [
      {
        id: 'primary',
        summary: 'Guardias UCI',
        primary: true,
        backgroundColor: '#0f766e',
        accessRole: 'owner',
        selected: true,
        timeZone: 'America/Santiago',
      },
      {
        id: 'feriados@group.calendar.google.com',
        summary: 'Feriados Clínicos',
        primary: false,
        backgroundColor: '#6366f1',
        accessRole: 'reader',
        selected: true,
      },
    ],
    events: [
      {
        id: 'gcal-seed-1',
        calendarId: 'primary',
        summary: 'Guardia UCI Noche',
        description: 'Entrega de turno nocturno UCI',
        location: 'UCI Adultos Piso 3',
        start: { dateTime: seedStart, timeZone: 'America/Santiago' },
        end: { dateTime: seedEnd, timeZone: 'America/Santiago' },
        status: 'confirmed',
        htmlLink: 'https://calendar.google.com/event?eid=seed1',
        updated: new Date(now).toISOString(),
      },
    ],
    postPayloads: [],
    patchPayloads: [],
    deleteRequests: [],
    driveCalls: [],
  }

  let nextId = 1

  await page.addInitScript(() => {
    const oauth2 = {
      initCodeClient: (config: {
        callback: (res: { code?: string; error?: string }) => void
      }) => ({
        requestCode: () => {
          setTimeout(() => {
            config.callback({ code: 'mock-gcal-auth-code' })
          }, 0)
        },
      }),
      initTokenClient: (config: {
        scope: string
        callback: (res: { access_token?: string; expires_in?: number; scope?: string }) => void
      }) => ({
        requestAccessToken: () => {
          setTimeout(() => {
            config.callback({
              access_token: 'mock-gcal-access-token',
              expires_in: 3600,
              scope: config.scope,
            })
          }, 0)
        },
      }),
    }

    ;(window as unknown as { google?: unknown }).google = {
      accounts: { oauth2 },
    }
  })

  await page.route('https://accounts.google.com/gsi/client', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: '/* GIS mocked for Playwright E2E */',
    })
  })

  await page.route('**/api/oauth/exchange', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'mock-gcal-access-token',
        expires_in: 3600,
        email: 'medico.uci@hospital.cl',
        persistent: true,
        scope: CALENDAR_SCOPES,
      }),
    })
  })

  await page.route('**/api/oauth/refresh', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'mock-gcal-access-token',
        expires_in: 3600,
        email: 'medico.uci@hospital.cl',
        scope: CALENDAR_SCOPES,
      }),
    })
  })

  await page.route('**/api/oauth/logout', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    })
  })

  await page.route('https://www.googleapis.com/oauth2/v3/userinfo', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ email: 'medico.uci@hospital.cl' }),
    })
  })

  await page.route('https://www.googleapis.com/drive/**', async (route) => {
    state.driveCalls.push(`${route.request().method()} ${route.request().url()}`)
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: 'Drive should not be called by Calendar E2E' } }),
    })
  })

  await page.route('https://www.googleapis.com/calendar/v3/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname

    if (path.endsWith('/users/me/calendarList') && req.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: state.calendars }),
      })
      return
    }

    const eventsMatch = /^\/calendar\/v3\/calendars\/([^/]+)\/events(?:\/([^/]+))?$/.exec(path)
    if (eventsMatch) {
      const calendarId = decodeURIComponent(eventsMatch[1])
      const eventId = eventsMatch[2] ? decodeURIComponent(eventsMatch[2]) : null

      if (req.method() === 'GET' && !eventId) {
        const items = state.events
          .filter((ev) => ev.calendarId === calendarId)
          .map(({ calendarId: _calId, ...apiEvent }) => apiEvent)
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items }),
        })
        return
      }

      if (req.method() === 'POST' && !eventId) {
        const body = req.postDataJSON() as Record<string, unknown>
        state.postPayloads.push(body)
        const created: MockGoogleEvent = {
          id: `gcal-created-${nextId++}`,
          calendarId,
          summary: String(body.summary ?? ''),
          description: typeof body.description === 'string' ? body.description : '',
          location: typeof body.location === 'string' ? body.location : '',
          start: (body.start as MockGoogleEvent['start']) ?? {},
          end: (body.end as MockGoogleEvent['end']) ?? {},
          status: 'confirmed',
          htmlLink: `https://calendar.google.com/event?eid=created${nextId}`,
          updated: new Date().toISOString(),
        }
        state.events.push(created)
        const { calendarId: _calId, ...apiEvent } = created
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(apiEvent),
        })
        return
      }

      if (req.method() === 'PATCH' && eventId) {
        const body = req.postDataJSON() as Record<string, unknown>
        state.patchPayloads.push({ eventId, body })
        const target = state.events.find(
          (ev) => ev.calendarId === calendarId && ev.id === eventId,
        )
        if (!target) {
          await route.fulfill({ status: 404, body: JSON.stringify({ error: { code: 404 } }) })
          return
        }
        if (typeof body.summary === 'string') target.summary = body.summary
        if (typeof body.description === 'string') target.description = body.description
        if (typeof body.location === 'string') target.location = body.location
        if (body.start) target.start = body.start as MockGoogleEvent['start']
        if (body.end) target.end = body.end as MockGoogleEvent['end']
        target.updated = new Date().toISOString()
        const { calendarId: _calId, ...apiEvent } = target
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(apiEvent),
        })
        return
      }

      if (req.method() === 'DELETE' && eventId) {
        state.deleteRequests.push({ calendarId, eventId })
        state.events = state.events.filter(
          (ev) => !(ev.calendarId === calendarId && ev.id === eventId),
        )
        await route.fulfill({ status: 204, body: '' })
        return
      }
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: `Unhandled mock route: ${req.method()} ${path}` } }),
    })
  })

  return state
}

async function onboardWithPin4(page: Page) {
  await page.goto('/')
  await page.evaluate(async () => {
    localStorage.clear()
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('cuaderno-medico')
      req.onsuccess = () => resolve()
      req.onerror = () => resolve()
      req.onblocked = () => resolve()
    })
  })
  await page.reload()

  await expect(page.getByTestId('login-screen')).toBeVisible()
  await page.getByTestId('setup-pin-input').fill('1234')
  await page.getByTestId('setup-pin-confirm-input').fill('1234')
  await page.getByTestId('setup-pin-submit-btn').click()

  await expect(page.getByTestId('header-security-btn')).toBeVisible({ timeout: 10000 })
}

test.describe('Google Calendar E2E: Conexión, Vistas, Temas, Outbox Offline y Eliminación', () => {
  test('conecta Calendar aislado de Drive, alterna vistas y temas, coalescea outbox offline, persiste al recargar y elimina', async ({
    page,
  }) => {
    const mockState = await installGoogleCalendarMocks(page)
    await onboardWithPin4(page)

    // 1. Panel clínico de guardia muestra calendar-guard-card desconectada y sin activar Drive
    const guardCard = page.getByTestId('calendar-guard-card')
    await expect(guardCard).toBeVisible()
    await expect(page.getByTestId('calendar-connect-btn')).toBeVisible()
    await expect(page.getByTestId('calendar-connect-btn')).toContainText('Conectar Google Calendar')
    await expect(page.getByTestId('header-calendar-btn')).toBeVisible()

    expect(await page.evaluate(() => localStorage.getItem('cuaderno-gdrive-enabled'))).toBeNull()

    // 2. Conectar Calendar: muestra evento semilla inmediatamente sin activar Drive
    await page.getByTestId('calendar-connect-btn').click()
    await expect(page.getByTestId('calendar-open-modal-btn')).toBeVisible({ timeout: 10000 })
    await expect(guardCard).toContainText('Guardia UCI Noche')
    expect(await page.evaluate(() => localStorage.getItem('cuaderno-gdrive-enabled'))).toBeNull()
    expect(await page.evaluate(() => localStorage.getItem('sindecon-gcal-enabled'))).toBe('true')
    expect(mockState.driveCalls).toHaveLength(0)

    // 3. Abrir CalendarModal: alternar Agenda, Semana, Mes en tema claro y tema oscuro Guardia UCI
    await page.getByTestId('calendar-open-modal-btn').click()
    const calendarModal = page.getByTestId('calendar-modal')
    await expect(calendarModal).toBeVisible()
    await expect(calendarModal).toContainText('Guardia UCI Noche')

    await page.getByTestId('calendar-view-week').click()
    await expect(page.getByTestId('calendar-view-week')).toHaveAttribute('aria-selected', 'true')
    await expect(calendarModal).toContainText('Guardia UCI Noche')

    await page.getByTestId('calendar-view-month').click()
    await expect(page.getByTestId('calendar-view-month')).toHaveAttribute('aria-selected', 'true')
    await expect(calendarModal).toContainText('Guardia UCI Noche')

    await page.getByTestId('calendar-view-agenda').click()
    await calendarModal.getByRole('button', { name: 'Cerrar' }).click()
    await expect(calendarModal).not.toBeVisible()

    // Activar tema oscuro Guardia UCI y verificar card + modal en sus 3 vistas
    await page.getByRole('button', { name: 'Cambiar entre modo diurno y guardia UCI' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(guardCard).toHaveAttribute('data-home-theme', 'dark')
    await expect(guardCard).toContainText('Guardia UCI Noche')

    await page.getByTestId('calendar-open-modal-btn').click()
    await expect(calendarModal).toBeVisible()
    await expect(calendarModal).toHaveAttribute('data-home-theme', 'dark')
    await expect(calendarModal).toContainText('Guardia UCI Noche')

    await page.getByTestId('calendar-view-week').click()
    await expect(calendarModal).toContainText('Guardia UCI Noche')

    await page.getByTestId('calendar-view-month').click()
    await expect(calendarModal).toContainText('Guardia UCI Noche')

    await calendarModal.getByRole('button', { name: 'Cerrar' }).click()
    await expect(calendarModal).not.toBeVisible()

    // 4. Outbox offline: crear offline -> ver Pendiente -> editar offline (coalescing) -> reconectar -> POST único -> recargar
    await page.context().setOffline(true)
    await expect(guardCard).toContainText('Sin conexión')

    await page.getByTestId('calendar-quick-add-btn').click()
    const eventForm = page.getByTestId('calendar-event-form-modal')
    await expect(eventForm).toBeVisible()
    await page.getByTestId('calendar-event-title-input').fill('Pase de Sala UCI')
    await page.getByTestId('calendar-event-submit-btn').click()
    await expect(eventForm).not.toBeVisible()

    await expect(guardCard).toContainText('Pase de Sala UCI')
    await expect(guardCard).toContainText('Pendiente')
    await expect(guardCard).toContainText('Pendiente (1)')
    expect(mockState.postPayloads).toHaveLength(0)

    // Editar mientras sigue offline y confirmar coalescing en una única operación pendiente
    await guardCard.getByRole('button', { name: /Pase de Sala UCI/ }).click()
    await expect(eventForm).toBeVisible()
    await expect(eventForm).toContainText('Pendiente de sincronización')
    await page.getByTestId('calendar-event-title-input').fill('Pase de Sala UCI Actualizado')
    await page.getByTestId('calendar-event-submit-btn').click()
    await expect(eventForm).not.toBeVisible()

    await expect(guardCard).toContainText('Pase de Sala UCI Actualizado')
    await expect(guardCard).toContainText('Pendiente (1)')
    expect(mockState.postPayloads).toHaveLength(0)
    expect(mockState.patchPayloads).toHaveLength(0)

    // Reconectar y confirmar flush único de POST con el título actualizado y limpieza de Pendiente
    await page.context().setOffline(false)
    await expect.poll(() => mockState.postPayloads.length, { timeout: 10000 }).toBe(1)
    expect(mockState.postPayloads[0]?.summary).toBe('Pase de Sala UCI Actualizado')
    expect(mockState.patchPayloads).toHaveLength(0)

    await expect(guardCard.getByText(/Pendiente/)).toHaveCount(0, { timeout: 10000 })
    await expect(guardCard).toContainText('Pase de Sala UCI Actualizado')

    // Recargar página y comprobar persistencia en caché y sincronización sin activar Drive
    await page.reload()
    await expect(guardCard).toBeVisible({ timeout: 10000 })
    await expect(guardCard).toContainText('Pase de Sala UCI Actualizado')
    await expect(guardCard).toContainText('Guardia UCI Noche')
    expect(await page.evaluate(() => localStorage.getItem('cuaderno-gdrive-enabled'))).toBeNull()
    expect(mockState.driveCalls).toHaveLength(0)

    // 5. Eliminar evento desde el modal y verificar borrado local + DELETE remoto
    await page.getByTestId('calendar-open-modal-btn').click()
    await expect(calendarModal).toBeVisible()
    await calendarModal.getByRole('button', { name: /Pase de Sala UCI Actualizado/ }).click()
    await expect(eventForm).toBeVisible()

    await page.getByTestId('calendar-event-delete-btn').click()
    await page.getByTestId('calendar-event-confirm-delete-btn').click()
    await expect(eventForm).not.toBeVisible()

    await expect.poll(() => mockState.deleteRequests.length, { timeout: 10000 }).toBe(1)
    await expect(calendarModal).not.toContainText('Pase de Sala UCI Actualizado')

    await calendarModal.getByRole('button', { name: 'Cerrar' }).click()
    await expect(guardCard).not.toContainText('Pase de Sala UCI Actualizado')
  })

  test('abre Agenda desde ClinicalStationHeader en Dashboard y Carpeta y crea evento Todo el día sin desfase local', async ({
    page,
  }) => {
    const mockState = await installGoogleCalendarMocks(page)
    await onboardWithPin4(page)

    // Conectar desde el botón Agenda en ClinicalStationHeader
    await page.getByTestId('header-calendar-btn').click()
    await expect(page.getByTestId('calendar-open-modal-btn')).toBeVisible({ timeout: 10000 })

    // Abrir Inbox para verificar header-calendar-btn dentro de FolderExplorerView
    await page.getByRole('button', { name: 'Abrir Inbox' }).click()
    await expect(page.getByTestId('header-calendar-btn')).toBeVisible()

    await page.getByTestId('header-calendar-btn').click()
    const calendarModal = page.getByTestId('calendar-modal')
    await expect(calendarModal).toBeVisible()

    await page.getByTestId('calendar-modal-add-btn').click()
    const eventForm = page.getByTestId('calendar-event-form-modal')
    await expect(eventForm).toBeVisible()

    const todayYmd = await page.evaluate(() => {
      const d = new Date()
      const y = String(d.getFullYear()).padStart(4, '0')
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    })

    await page.getByTestId('calendar-event-title-input').fill('Congreso Medicina Crítica')
    await page.getByTestId('calendar-event-allday-toggle').check()
    await expect(page.getByTestId('calendar-event-start-input')).toHaveValue(todayYmd)
    await expect(page.getByTestId('calendar-event-end-input')).toHaveValue(todayYmd)
    await page.getByTestId('calendar-event-submit-btn').click()

    await expect.poll(() => mockState.postPayloads.length, { timeout: 10000 }).toBe(1)
    expect((mockState.postPayloads[0]?.start as { date?: string })?.date).toBe(todayYmd)
    await expect(calendarModal).toContainText('Congreso Medicina Crítica')
    await expect(calendarModal).toContainText('Todo el día')

    // Cerrar modal, bloquear terminal y restablecer terminal local: debe limpiar tablas y flags de Calendar
    await calendarModal.getByRole('button', { name: 'Cerrar' }).click()
    await page.getByTestId('header-lock-btn').click()
    await expect(page.getByTestId('login-screen')).toBeVisible()
    await page.getByTestId('reset-local-terminal-btn').click()
    await page.getByRole('button', { name: 'Confirmar restablecimiento' }).click()
    await expect(page.getByTestId('setup-pin-input')).toBeVisible()

    const cleanupCheck = await page.evaluate(async () => {
      const counts = await new Promise<{ lists: number; events: number; outbox: number }>(
        (resolve, reject) => {
          const req = indexedDB.open('cuaderno-medico')
          req.onerror = () => reject(req.error)
          req.onsuccess = () => {
            const db = req.result
            const tx = db.transaction(
              ['calendar_list', 'calendar_events', 'calendar_outbox'],
              'readonly',
            )
            const r1 = tx.objectStore('calendar_list').count()
            const r2 = tx.objectStore('calendar_events').count()
            const r3 = tx.objectStore('calendar_outbox').count()
            tx.oncomplete = () => {
              db.close()
              resolve({ lists: r1.result, events: r2.result, outbox: r3.result })
            }
            tx.onerror = () => reject(tx.error)
          }
        },
      )
      return {
        gcalEnabled: localStorage.getItem('sindecon-gcal-enabled'),
        googleScopes: localStorage.getItem('sindecon-google-scopes'),
        gcalLastSync: localStorage.getItem('sindecon-gcal-last-sync'),
        counts,
      }
    })

    expect(cleanupCheck).toEqual({
      gcalEnabled: null,
      googleScopes: null,
      gcalLastSync: null,
      counts: { lists: 0, events: 0, outbox: 0 },
    })
  })
})
