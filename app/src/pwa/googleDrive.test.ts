import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  GOOGLE_AUTH_CHANGE_EVENT,
  GOOGLE_CALENDAR_SCOPES,
  GCAL_ENABLED_KEY,
  GOOGLE_SCOPES_KEY,
  setStoredClientId,
  setStoredToken,
  clearStoredToken,
  getStoredToken,
  getStoredEmail,
  isGoogleSyncEnabled,
  isCalendarSyncEnabled,
  setCalendarSyncEnabled,
  getStoredScopes,
  mergeStoredScopes,
  hasCalendarScopes,
  shouldUseServerOAuth,
  ensureValidAccessToken,
  exchangeOAuthCode,
  revokeServerOAuthSession,
  fetchGoogleUserEmail,
  initiateGoogleOAuthFlow,
  resetOAuthRuntimeStateForTests,
} from './googleDrive'

const store: Record<string, string> = {}
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => {
    store[key] = value.toString()
  },
  removeItem: (key: string) => {
    delete store[key]
  },
  clear: () => {
    for (const k of Object.keys(store)) delete store[k]
  },
}

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
})

Object.defineProperty(globalThis, 'navigator', {
  value: { onLine: true },
  writable: true,
  configurable: true,
})

describe('googleDrive OAuth BFF & fallback helpers', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    localStorageMock.clear()
    resetOAuthRuntimeStateForTests()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: true },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('reutiliza token vigente en localStorage sin llamar a /api/oauth/refresh', async () => {
    setStoredToken('ya29.vigente', 3600, 'doc@hospital.cl')
    const token = await ensureValidAccessToken()
    expect(token).toBe('ya29.vigente')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('usa single-flight mutex cuando dos llamadas piden refresco simultáneo', async () => {
    setStoredToken('ya29.por-vencer', 30, 'doc@hospital.cl')

    let resolveFetch!: (res: Response) => void
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve
        }),
    )

    const p1 = ensureValidAccessToken()
    const p2 = ensureValidAccessToken()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/oauth/refresh',
      expect.objectContaining({ method: 'POST', credentials: 'same-origin' }),
    )

    resolveFetch(
      new Response(
        JSON.stringify({
          access_token: 'ya29.nuevo-bff',
          expires_in: 3600,
          email: 'doc@hospital.cl',
        }),
        { status: 200 },
      ),
    )

    const [t1, t2] = await Promise.all([p1, p2])
    expect(t1).toBe('ya29.nuevo-bff')
    expect(t2).toBe('ya29.nuevo-bff')
    expect(getStoredToken()).toBe('ya29.nuevo-bff')
  })

  it('en 401 limpia solo el access_token preservando email y cuaderno-gdrive-enabled', async () => {
    setStoredToken('ya29.expirado', -10, 'doc@hospital.cl')
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'session_expired' }), { status: 401 }),
    )

    const token = await ensureValidAccessToken(true)
    expect(token).toBeNull()
    expect(getStoredToken()).toBeNull()
    expect(isGoogleSyncEnabled()).toBe(true)
    expect(getStoredEmail()).toBe('doc@hospital.cl')
  })

  it('en offline no llama a /api/oauth/refresh y preserva la configuración', async () => {
    setStoredToken('ya29.expirado', -10, 'doc@hospital.cl')
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: false },
      writable: true,
      configurable: true,
    })

    const token = await ensureValidAccessToken(true)
    expect(token).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(isGoogleSyncEnabled()).toBe(true)
  })

  it('marca BFF no disponible tras 404 (entorno Vite sin Wrangler) y evita reintentar', async () => {
    setStoredToken('ya29.expirado', -10)
    fetchMock.mockResolvedValueOnce(new Response('Not Found', { status: 404 }))

    const first = await ensureValidAccessToken(true)
    expect(first).toBeNull()
    expect(shouldUseServerOAuth()).toBe(false)

    const second = await ensureValidAccessToken(true)
    expect(second).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('en error 5xx de /api/oauth/refresh lanza error sin desactivar BFF y libera el mutex para reintentar', async () => {
    setStoredToken('ya29.expirado', -10, 'doc@hospital.cl')
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'upstream_unavailable' }), { status: 502 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'ya29.recuperado',
            expires_in: 3600,
            email: 'doc@hospital.cl',
          }),
          { status: 200 },
        ),
      )

    await expect(ensureValidAccessToken(true)).rejects.toThrow('502')
    expect(shouldUseServerOAuth()).toBe(true)
    expect(isGoogleSyncEnabled()).toBe(true)

    const retried = await ensureValidAccessToken(true)
    expect(retried).toBe('ya29.recuperado')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('desactiva modo BFF cuando hay un Client ID personalizado distinto al default y lo reactiva al limpiarlo', () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'env-client.apps.googleusercontent.com')
    setStoredClientId('custom-selfhosted-id.apps.googleusercontent.com')
    expect(shouldUseServerOAuth()).toBe(false)

    setStoredClientId('env-client.apps.googleusercontent.com')
    expect(shouldUseServerOAuth()).toBe(true)

    setStoredClientId('otro-custom.apps.googleusercontent.com')
    expect(shouldUseServerOAuth()).toBe(false)
    setStoredClientId('')
    expect(shouldUseServerOAuth()).toBe(true)
  })

  it('emite evento de cambio de autenticación al guardar o limpiar el token', () => {
    const dispatched: Event[] = []
    vi.stubGlobal('window', {
      dispatchEvent: (event: Event) => {
        dispatched.push(event)
        return true
      },
    })

    setStoredToken('ya29.tok', 3600, 'doc@hospital.cl')
    clearStoredToken(false)

    expect(dispatched).toHaveLength(2)
    expect(dispatched[0]?.type).toBe(GOOGLE_AUTH_CHANGE_EVENT)
    expect(dispatched[0]?.type).toBe('sindecon-google-auth-change')
    expect(dispatched[1]?.type).toBe('sindecon-google-auth-change')
  })

  it('exchangeOAuthCode devuelve null en 404/405 y datos de sesión en 200', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'ya29.exchanged',
          expires_in: 3600,
          email: 'med@gmail.com',
          persistent: true,
        }),
        { status: 200 },
      ),
    )

    const res = await exchangeOAuthCode('4/code')
    expect(res).toEqual({
      accessToken: 'ya29.exchanged',
      expiresIn: 3600,
      email: 'med@gmail.com',
      persistent: true,
    })

    fetchMock.mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
    expect(await exchangeOAuthCode('4/code-2')).toBeNull()
    expect(shouldUseServerOAuth()).toBe(false)

    resetOAuthRuntimeStateForTests()
    fetchMock.mockResolvedValueOnce(new Response('Method Not Allowed', { status: 405 }))
    expect(await exchangeOAuthCode('4/code-3')).toBeNull()
    expect(shouldUseServerOAuth()).toBe(false)
  })

  it('fetchGoogleUserEmail cae a drive/v3/about si userinfo falla por scopes', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('Forbidden', { status: 403 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ user: { emailAddress: 'fallback@gmail.com' } }),
          { status: 200 },
        ),
      )

    const email = await fetchGoogleUserEmail('ya29.token')
    expect(email).toBe('fallback@gmail.com')
  })

  it('initiateGoogleOAuthFlow usa initCodeClient con prompt consent + select_account y cae a initTokenClient si BFF devuelve 404', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'env-client.apps.googleusercontent.com')
    const requestCodeMock = vi.fn()
    const requestAccessTokenMock = vi.fn()
    let codeCallback: ((res: { code?: string; error?: string }) => void) | null = null
    const initCodeClientMock = vi.fn((cfg: { callback: (res: { code?: string }) => void }) => {
      codeCallback = cfg.callback
      return { requestCode: requestCodeMock }
    })

    vi.stubGlobal('window', {
      dispatchEvent: vi.fn(),
      google: {
        accounts: {
          oauth2: {
            initCodeClient: initCodeClientMock,
            initTokenClient: vi.fn(() => ({
              requestAccessToken: requestAccessTokenMock,
            })),
          },
        },
      },
    })

    const onSuccess = vi.fn()
    const onError = vi.fn()

    fetchMock.mockResolvedValueOnce(new Response('Not Found', { status: 404 }))

    initiateGoogleOAuthFlow({ onSuccess, onError })
    expect(initCodeClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: 'env-client.apps.googleusercontent.com',
        ux_mode: 'popup',
        prompt: 'select_account consent',
      }),
    )
    expect(requestCodeMock).toHaveBeenCalledTimes(1)
    expect(codeCallback).toBeTruthy()
    codeCallback!({ code: 'auth-code-fallback' })
    await Promise.resolve()
    await Promise.resolve()
    expect(requestAccessTokenMock).toHaveBeenCalledTimes(1)
  })

  it('initiateGoogleOAuthFlow pasa login_hint y prompt consent con email previo y entrega sesión en 200', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'env-client.apps.googleusercontent.com')
    setStoredToken('ya29.viejo', -10, 'prev@hospital.cl')

    const requestCodeMock = vi.fn()
    let codeCallback: ((res: { code?: string; error?: string }) => void) | null = null
    const initCodeClientMock = vi.fn((cfg: { callback: (res: { code?: string }) => void }) => {
      codeCallback = cfg.callback
      return { requestCode: requestCodeMock }
    })

    vi.stubGlobal('window', {
      dispatchEvent: vi.fn(),
      google: {
        accounts: {
          oauth2: {
            initCodeClient: initCodeClientMock,
            initTokenClient: vi.fn(),
          },
        },
      },
    })

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'ya29.renovado',
          expires_in: 3599,
          email: 'prev@hospital.cl',
          persistent: true,
        }),
        { status: 200 },
      ),
    )

    const onSuccess = vi.fn()
    const onError = vi.fn()

    initiateGoogleOAuthFlow({ onSuccess, onError })
    expect(initCodeClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        login_hint: 'prev@hospital.cl',
        prompt: 'consent',
      }),
    )

    codeCallback!({ code: 'auth-code-ok' })
    await vi.waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith('ya29.renovado', 3599, 'prev@hospital.cl')
    })
    expect(onError).not.toHaveBeenCalled()
  })

  it('initiateGoogleOAuthFlow reporta errores si falta Client ID, falta GIS, o falla el canje de código', async () => {
    const onSuccess = vi.fn()
    const onError = vi.fn()

    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '')
    initiateGoogleOAuthFlow({ onSuccess, onError })
    expect(onError).toHaveBeenCalledWith('No hay Client ID de Google configurado')

    onError.mockClear()
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'env-client.apps.googleusercontent.com')
    vi.stubGlobal('window', { dispatchEvent: vi.fn() })
    initiateGoogleOAuthFlow({ onSuccess, onError })
    expect(onError).toHaveBeenCalledWith('Google Identity Services no está disponible en este navegador')

    onError.mockClear()
    let codeCallback: ((res: { code?: string; error?: string }) => void) | null = null
    vi.stubGlobal('window', {
      dispatchEvent: vi.fn(),
      google: {
        accounts: {
          oauth2: {
            initCodeClient: vi.fn((cfg: { callback: (res: { code?: string; error?: string }) => void }) => {
              codeCallback = cfg.callback
              return { requestCode: vi.fn() }
            }),
            initTokenClient: vi.fn(),
          },
        },
      },
    })

    fetchMock.mockResolvedValueOnce(new Response('Server Error', { status: 500 }))
    initiateGoogleOAuthFlow({ onSuccess, onError })
    codeCallback!({ code: 'auth-code-fail' })
    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith('No se pudo completar la autenticación con Google (500)')
    })
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('revokeServerOAuthSession llama a /api/oauth/logout en best-effort sin lanzar errores y omite llamada si BFF está deshabilitado', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    await expect(revokeServerOAuthSession()).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/oauth/logout',
      expect.objectContaining({ method: 'POST', credentials: 'same-origin' }),
    )

    fetchMock.mockClear()
    setStoredClientId('custom-client.apps.googleusercontent.com')
    await expect(revokeServerOAuthSession()).resolves.toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('separa bandera de Calendar de Drive y acumula scopes incrementales con setStoredToken', () => {
    setStoredToken('ya29.cal', 3600, 'med@hospital.cl', {
      enableDrive: false,
      enableCalendar: true,
      scope:
        'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly',
    })

    expect(isCalendarSyncEnabled()).toBe(true)
    expect(hasCalendarScopes()).toBe(true)
    expect(isGoogleSyncEnabled()).toBe(false)
    expect(localStorageMock.getItem(GCAL_ENABLED_KEY)).toBe('true')

    mergeStoredScopes('https://www.googleapis.com/auth/drive.file')
    const scopes = getStoredScopes()
    expect(scopes).toContain('https://www.googleapis.com/auth/calendar.events')
    expect(scopes).toContain('https://www.googleapis.com/auth/calendar.calendarlist.readonly')
    expect(scopes).toContain('https://www.googleapis.com/auth/drive.file')

    setCalendarSyncEnabled(false)
    expect(isCalendarSyncEnabled()).toBe(false)
  })

  it('ensureValidAccessToken(true) solo con Calendar habilitado refresca y preserva isGoogleSyncEnabled() === false', async () => {
    setStoredToken('ya29.cal-exp', -10, 'med@hospital.cl', {
      enableDrive: false,
      enableCalendar: true,
      scope: 'https://www.googleapis.com/auth/calendar.events',
    })

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'ya29.cal-refreshed',
          expires_in: 3600,
          email: 'med@hospital.cl',
          scope:
            'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly',
        }),
        { status: 200 },
      ),
    )

    const token = await ensureValidAccessToken(true)
    expect(token).toBe('ya29.cal-refreshed')
    expect(isGoogleSyncEnabled()).toBe(false)
    expect(isCalendarSyncEnabled()).toBe(true)
    expect(hasCalendarScopes()).toBe(true)
  })

  it('initiateGoogleOAuthFlow envía scopes, include_granted_scopes, login_hint y reenvía scope a onSuccess, con fallback a initTokenClient en 404', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'env-client.apps.googleusercontent.com')
    const requestCodeMock = vi.fn()
    const requestAccessTokenMock = vi.fn()
    let codeCallback: ((res: { code?: string; error?: string }) => void) | null = null
    let tokenCallback: ((res: { access_token?: string; expires_in?: number; scope?: string }) => void) | null = null

    const initCodeClientMock = vi.fn((cfg: { callback: (res: { code?: string; error?: string }) => void }) => {
      codeCallback = cfg.callback
      return { requestCode: requestCodeMock }
    })
    const initTokenClientMock = vi.fn(
      (cfg: { callback: (res: { access_token?: string; expires_in?: number; scope?: string }) => void }) => {
        tokenCallback = cfg.callback
        return { requestAccessToken: requestAccessTokenMock }
      },
    )

    vi.stubGlobal('window', {
      dispatchEvent: vi.fn(),
      google: {
        accounts: {
          oauth2: {
            initCodeClient: initCodeClientMock,
            initTokenClient: initTokenClientMock,
          },
        },
      },
    })

    const onSuccess = vi.fn()
    const onError = vi.fn()

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'ya29.cal-code',
          expires_in: 3600,
          email: 'doc@uci.cl',
          persistent: true,
          scope: GOOGLE_CALENDAR_SCOPES,
        }),
        { status: 200 },
      ),
    )

    initiateGoogleOAuthFlow({
      scopes: GOOGLE_CALENDAR_SCOPES,
      includeGrantedScopes: true,
      loginHint: 'doc@uci.cl',
      onSuccess,
      onError,
    })

    expect(initCodeClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: GOOGLE_CALENDAR_SCOPES,
        include_granted_scopes: true,
        login_hint: 'doc@uci.cl',
      }),
    )

    codeCallback!({ code: 'cal-code-200' })
    await vi.waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(
        'ya29.cal-code',
        3600,
        'doc@uci.cl',
        GOOGLE_CALENDAR_SCOPES,
      )
    })

    onSuccess.mockClear()
    fetchMock.mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
    initiateGoogleOAuthFlow({
      scopes: GOOGLE_CALENDAR_SCOPES,
      includeGrantedScopes: true,
      loginHint: 'doc@uci.cl',
      onSuccess,
      onError,
    })

    codeCallback!({ code: 'cal-code-404' })
    await vi.waitFor(() => {
      expect(initTokenClientMock).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: GOOGLE_CALENDAR_SCOPES,
          include_granted_scopes: true,
          login_hint: 'doc@uci.cl',
        }),
      )
    })
    expect(requestAccessTokenMock).toHaveBeenCalledTimes(1)
    tokenCallback!({ access_token: 'ya29.cal-legacy', expires_in: 1800 })
    expect(onSuccess).toHaveBeenCalledWith(
      'ya29.cal-legacy',
      1800,
      undefined,
      GOOGLE_CALENDAR_SCOPES,
    )
    expect(onError).not.toHaveBeenCalled()
  })

  it('clearStoredToken(true) limpia GCAL_ENABLED_KEY y GOOGLE_SCOPES_KEY', () => {
    setStoredToken('ya29.cal', 3600, 'med@hospital.cl', {
      enableDrive: false,
      enableCalendar: true,
      scope: GOOGLE_CALENDAR_SCOPES,
    })
    expect(localStorageMock.getItem(GCAL_ENABLED_KEY)).toBe('true')
    expect(localStorageMock.getItem(GOOGLE_SCOPES_KEY)).toBeTruthy()

    clearStoredToken(false)
    expect(localStorageMock.getItem(GCAL_ENABLED_KEY)).toBe('true')
    expect(localStorageMock.getItem(GOOGLE_SCOPES_KEY)).toBeTruthy()

    clearStoredToken(true)
    expect(localStorageMock.getItem(GCAL_ENABLED_KEY)).toBeNull()
    expect(localStorageMock.getItem(GOOGLE_SCOPES_KEY)).toBeNull()
    expect(isCalendarSyncEnabled()).toBe(false)
    expect(hasCalendarScopes()).toBe(false)
  })
})
