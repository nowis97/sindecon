import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import worker from '../../worker'
import { onRequest as exchangeOnRequest } from '../../functions/api/oauth/exchange'
import { onRequest as refreshOnRequest } from '../../functions/api/oauth/refresh'
import { onRequest as logoutOnRequest } from '../../functions/api/oauth/logout'
import {
  COOKIE_NAME,
  encryptCookiePayload,
  decryptCookiePayload,
  type OAuthEnv,
} from '../../functions/api/oauth/_shared'

const TEST_ENV: OAuthEnv = {
  GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'client-secret',
  OAUTH_COOKIE_SECRET: '0123456789abcdef0123456789abcdef',
}

function extractCookieValue(setCookie: string | null): string {
  expect(setCookie).toBeTruthy()
  const prefix = `${COOKIE_NAME}=`
  const start = setCookie!.indexOf(prefix)
  expect(start).toBeGreaterThanOrEqual(0)
  const rest = setCookie!.slice(start + prefix.length)
  const end = rest.indexOf(';')
  return decodeURIComponent(end >= 0 ? rest.slice(0, end) : rest)
}

function makeFakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
  return `${header}.${body}.sig`
}

describe('oauth endpoints (exchange, refresh, logout)', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('POST /api/oauth/exchange', () => {
    it('rechaza peticiones que no son POST o de distinto origen', async () => {
      const getReq = new Request('https://sindecon.pages.dev/api/oauth/exchange', {
        method: 'GET',
        headers: { Origin: 'https://sindecon.pages.dev' },
      })
      expect((await exchangeOnRequest({ request: getReq, env: TEST_ENV })).status).toBe(405)

      const crossReq = new Request('https://sindecon.pages.dev/api/oauth/exchange', {
        method: 'POST',
        headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'auth-code' }),
      })
      expect((await exchangeOnRequest({ request: crossReq, env: TEST_ENV })).status).toBe(403)
    })

    it('devuelve 500 si faltan variables de entorno del servidor', async () => {
      const req = new Request('https://sindecon.pages.dev/api/oauth/exchange', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: 'auth-code' }),
      })

      const res = await exchangeOnRequest({ request: req, env: {} })
      expect(res.status).toBe(500)
      expect(await res.json()).toEqual({ error: 'server_not_configured' })
    })

    it('devuelve 400 si el JSON es inválido o falta code en el cuerpo', async () => {
      const badJsonReq = new Request('https://sindecon.pages.dev/api/oauth/exchange', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
          'Content-Type': 'application/json',
        },
        body: '{bad-json',
      })
      const badJsonRes = await exchangeOnRequest({ request: badJsonReq, env: TEST_ENV })
      expect(badJsonRes.status).toBe(400)
      expect(await badJsonRes.json()).toEqual({ error: 'invalid_json' })

      const req = new Request('https://sindecon.pages.dev/api/oauth/exchange', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: '   ' }),
      })

      const res = await exchangeOnRequest({ request: req, env: TEST_ENV })
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'missing_code' })
    })

    it('canjea code con Google, extrae email de Drive y guarda refresh_token cifrado en cookie HttpOnly', async () => {
      fetchMock
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              access_token: 'ya29.access-new',
              expires_in: 3599,
              refresh_token: '1//0g-new-refresh',
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ user: { emailAddress: 'dra.perez@gmail.com' } }),
            { status: 200 },
          ),
        )

      const req = new Request('https://sindecon.pages.dev/api/oauth/exchange', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: '4/0AcvD-auth-code' }),
      })

      const res = await exchangeOnRequest({ request: req, env: TEST_ENV })
      expect(res.status).toBe(200)

      const body = (await res.json()) as Record<string, unknown>
      expect(body).toEqual({
        access_token: 'ya29.access-new',
        expires_in: 3599,
        email: 'dra.perez@gmail.com',
        persistent: true,
      })

      const encryptedCookie = extractCookieValue(res.headers.get('Set-Cookie'))
      const decrypted = await decryptCookiePayload(
        encryptedCookie,
        TEST_ENV.OAUTH_COOKIE_SECRET!,
      )
      expect(decrypted?.rt).toBe('1//0g-new-refresh')
      expect(decrypted?.email).toBe('dra.perez@gmail.com')

      const [tokenUrl, tokenInit] = fetchMock.mock.calls[0]!
      expect(tokenUrl).toBe('https://oauth2.googleapis.com/token')
      const sentParams = new URLSearchParams(String(tokenInit?.body))
      expect(sentParams.get('redirect_uri')).toBe('postmessage')
      expect(sentParams.get('grant_type')).toBe('authorization_code')
      expect(sentParams.get('client_secret')).toBe(TEST_ENV.GOOGLE_CLIENT_SECRET)
    })

    it('preserva refresh_token previo de la cookie si Google omite refresh_token y lee email de id_token', async () => {
      const existingCookie = await encryptCookiePayload(
        { rt: '1//0g-existing-rt', email: 'JWT.User@gmail.com', iat: 1000 },
        TEST_ENV.OAUTH_COOKIE_SECRET!,
      )

      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'ya29.access-reauth',
            expires_in: 3600,
            id_token: makeFakeJwt({ email: 'jwt.user@gmail.com' }),
          }),
          { status: 200 },
        ),
      )

      const req = new Request('https://sindecon.pages.dev/api/oauth/exchange', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
          'Content-Type': 'application/json',
          Cookie: `${COOKIE_NAME}=${encodeURIComponent(existingCookie)}`,
        },
        body: JSON.stringify({ code: '4/0AcvD-reauth' }),
      })

      const res = await exchangeOnRequest({ request: req, env: TEST_ENV })
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({
        access_token: 'ya29.access-reauth',
        expires_in: 3600,
        email: 'jwt.user@gmail.com',
        persistent: true,
      })

      const encryptedCookie = extractCookieValue(res.headers.get('Set-Cookie'))
      const decrypted = await decryptCookiePayload(
        encryptedCookie,
        TEST_ENV.OAUTH_COOKIE_SECRET!,
      )
      expect(decrypted?.rt).toBe('1//0g-existing-rt')
      expect(decrypted?.email).toBe('jwt.user@gmail.com')
    })

    it('limpia cookie previa y devuelve persistent=false si el email no coincide con la cookie y Google omite refresh_token', async () => {
      const existingCookie = await encryptCookiePayload(
        { rt: '1//0g-user-a-rt', email: 'userA@gmail.com', iat: 1000 },
        TEST_ENV.OAUTH_COOKIE_SECRET!,
      )

      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'ya29.user-b-access',
            expires_in: 3600,
            id_token: makeFakeJwt({ email: 'userB@gmail.com' }),
          }),
          { status: 200 },
        ),
      )

      const req = new Request('https://sindecon.pages.dev/api/oauth/exchange', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
          'Content-Type': 'application/json',
          Cookie: `${COOKIE_NAME}=${encodeURIComponent(existingCookie)}`,
        },
        body: JSON.stringify({ code: '4/0AcvD-user-b' }),
      })

      const res = await exchangeOnRequest({ request: req, env: TEST_ENV })
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({
        access_token: 'ya29.user-b-access',
        expires_in: 3600,
        email: 'userB@gmail.com',
        persistent: false,
      })
      expect(res.headers.get('Set-Cookie')).toContain('Max-Age=0')
    })

    it('limpia cookie previa y devuelve persistent=false si Google omite refresh_token y no se puede resolver el email (fail-closed)', async () => {
      const existingCookie = await encryptCookiePayload(
        { rt: '1//0g-user-a-rt', email: 'userA@gmail.com', iat: 1000 },
        TEST_ENV.OAUTH_COOKIE_SECRET!,
      )

      fetchMock
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              access_token: 'ya29.unknown-user-access',
              expires_in: 3600,
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(new Response('Internal Server Error', { status: 500 }))

      const req = new Request('https://sindecon.pages.dev/api/oauth/exchange', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
          'Content-Type': 'application/json',
          Cookie: `${COOKIE_NAME}=${encodeURIComponent(existingCookie)}`,
        },
        body: JSON.stringify({ code: '4/0AcvD-no-email' }),
      })

      const res = await exchangeOnRequest({ request: req, env: TEST_ENV })
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({
        access_token: 'ya29.unknown-user-access',
        expires_in: 3600,
        email: undefined,
        persistent: false,
      })
      expect(res.headers.get('Set-Cookie')).toContain('Max-Age=0')
    })

    it('devuelve 401 oauth_exchange_failed si Google responde 200 con JSON literal null', async () => {
      fetchMock.mockResolvedValueOnce(new Response('null', { status: 200 }))

      const req = new Request('https://sindecon.pages.dev/api/oauth/exchange', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: 'auth-code' }),
      })

      const res = await exchangeOnRequest({ request: req, env: TEST_ENV })
      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ error: 'oauth_exchange_failed' })
    })

    it('devuelve persistent=false sin Set-Cookie si no hay refresh_token ni cookie previa', async () => {
      fetchMock
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ access_token: 'ya29.temp', expires_in: 3600 }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(new Response('{}', { status: 403 }))

      const req = new Request('https://sindecon.pages.dev/api/oauth/exchange', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: '4/0AcvD-temp' }),
      })

      const res = await exchangeOnRequest({ request: req, env: TEST_ENV })
      expect(res.status).toBe(200)
      expect(res.headers.get('Set-Cookie')).toBeNull()
      expect(await res.json()).toEqual({
        access_token: 'ya29.temp',
        expires_in: 3600,
        email: undefined,
        persistent: false,
      })
    })

    it('devuelve 401 si Google rechaza el code y 502 si Google/red no está disponible', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }),
      )
      const invalidReq = new Request('https://sindecon.pages.dev/api/oauth/exchange', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: 'expired-code' }),
      })
      const invalidRes = await exchangeOnRequest({ request: invalidReq, env: TEST_ENV })
      expect(invalidRes.status).toBe(401)
      expect(await invalidRes.json()).toEqual({ error: 'oauth_exchange_failed' })

      fetchMock.mockResolvedValueOnce(new Response('Too Many Requests', { status: 429 }))
      const rateLimitReq = new Request('https://sindecon.pages.dev/api/oauth/exchange', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: 'auth-code' }),
      })
      const rateLimitRes = await exchangeOnRequest({ request: rateLimitReq, env: TEST_ENV })
      expect(rateLimitRes.status).toBe(502)
      expect(await rateLimitRes.json()).toEqual({ error: 'upstream_unavailable' })

      fetchMock.mockRejectedValueOnce(new Error('network error'))
      const netErrReq = new Request('https://sindecon.pages.dev/api/oauth/exchange', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: 'auth-code' }),
      })
      const netErrRes = await exchangeOnRequest({ request: netErrReq, env: TEST_ENV })
      expect(netErrRes.status).toBe(502)
      expect(await netErrRes.json()).toEqual({ error: 'upstream_unavailable' })
    })
  })

  describe('POST /api/oauth/refresh', () => {
    it('rechaza método/origen inválido y valida configuración del servidor', async () => {
      const crossReq = new Request('https://sindecon.pages.dev/api/oauth/refresh', {
        method: 'POST',
        headers: { Origin: 'https://evil.example' },
      })
      expect((await refreshOnRequest({ request: crossReq, env: TEST_ENV })).status).toBe(403)

      const unconfiguredReq = new Request('https://sindecon.pages.dev/api/oauth/refresh', {
        method: 'POST',
        headers: { Origin: 'https://sindecon.pages.dev' },
      })
      const unconfiguredRes = await refreshOnRequest({ request: unconfiguredReq, env: {} })
      expect(unconfiguredRes.status).toBe(500)
      expect(await unconfiguredRes.json()).toEqual({ error: 'server_not_configured' })
    })

    it('devuelve 401 y limpia cookie cuando falta la cookie o está corrupta', async () => {
      const missingReq = new Request('https://sindecon.pages.dev/api/oauth/refresh', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
        },
      })
      const missingRes = await refreshOnRequest({ request: missingReq, env: TEST_ENV })
      expect(missingRes.status).toBe(401)
      expect(await missingRes.json()).toEqual({ error: 'session_expired' })
      expect(missingRes.headers.get('Set-Cookie')).toContain('Max-Age=0')

      const req = new Request('https://sindecon.pages.dev/api/oauth/refresh', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
          Cookie: `${COOKIE_NAME}=basura-corrupta`,
        },
      })

      const res = await refreshOnRequest({ request: req, env: TEST_ENV })
      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ error: 'session_expired' })
      expect(res.headers.get('Set-Cookie')).toContain('Max-Age=0')
    })

    it('refresca access_token, rota refresh_token si Google entrega uno nuevo y renueva cookie', async () => {
      const existingCookie = await encryptCookiePayload(
        { rt: '1//0g-old-rt', email: 'dr@hospital.cl', iat: 1000 },
        TEST_ENV.OAUTH_COOKIE_SECRET!,
      )

      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'ya29.refreshed',
            expires_in: 3599,
            refresh_token: '1//0g-rotated-rt',
          }),
          { status: 200 },
        ),
      )

      const req = new Request('https://sindecon.pages.dev/api/oauth/refresh', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
          Cookie: `${COOKIE_NAME}=${encodeURIComponent(existingCookie)}`,
        },
      })

      const res = await refreshOnRequest({ request: req, env: TEST_ENV })
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({
        access_token: 'ya29.refreshed',
        expires_in: 3599,
        email: 'dr@hospital.cl',
      })

      const updatedCookie = extractCookieValue(res.headers.get('Set-Cookie'))
      const decrypted = await decryptCookiePayload(
        updatedCookie,
        TEST_ENV.OAUTH_COOKIE_SECRET!,
      )
      expect(decrypted?.rt).toBe('1//0g-rotated-rt')
      expect(decrypted?.email).toBe('dr@hospital.cl')
    })

    it('mantiene refresh_token actual cuando Google no entrega rotación al refrescar', async () => {
      const existingCookie = await encryptCookiePayload(
        { rt: '1//0g-keep-rt', email: 'dr@hospital.cl', iat: 1000 },
        TEST_ENV.OAUTH_COOKIE_SECRET!,
      )

      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'ya29.refreshed-same-rt',
            expires_in: 3600,
          }),
          { status: 200 },
        ),
      )

      const req = new Request('https://sindecon.pages.dev/api/oauth/refresh', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
          Cookie: `${COOKIE_NAME}=${encodeURIComponent(existingCookie)}`,
        },
      })

      const res = await refreshOnRequest({ request: req, env: TEST_ENV })
      expect(res.status).toBe(200)
      const updatedCookie = extractCookieValue(res.headers.get('Set-Cookie'))
      const decrypted = await decryptCookiePayload(
        updatedCookie,
        TEST_ENV.OAUTH_COOKIE_SECRET!,
      )
      expect(decrypted?.rt).toBe('1//0g-keep-rt')
      expect(decrypted?.iat).toBeGreaterThan(1000)
    })

    it('limpia cookie y devuelve 401 si Google responde invalid_grant', async () => {
      const existingCookie = await encryptCookiePayload(
        { rt: '1//0g-revoked', iat: 1000 },
        TEST_ENV.OAUTH_COOKIE_SECRET!,
      )

      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }),
      )

      const req = new Request('https://sindecon.pages.dev/api/oauth/refresh', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
          Cookie: `${COOKIE_NAME}=${encodeURIComponent(existingCookie)}`,
        },
      })

      const res = await refreshOnRequest({ request: req, env: TEST_ENV })
      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ error: 'session_expired' })
      expect(res.headers.get('Set-Cookie')).toContain('Max-Age=0')
    })

    it('devuelve 502 SIN borrar cookie cuando Google responde 503 o falla la red', async () => {
      const existingCookie = await encryptCookiePayload(
        { rt: '1//0g-valid', iat: 1000 },
        TEST_ENV.OAUTH_COOKIE_SECRET!,
      )

      fetchMock.mockResolvedValueOnce(new Response('Service Unavailable', { status: 503 }))

      const req503 = new Request('https://sindecon.pages.dev/api/oauth/refresh', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
          Cookie: `${COOKIE_NAME}=${encodeURIComponent(existingCookie)}`,
        },
      })

      const res503 = await refreshOnRequest({ request: req503, env: TEST_ENV })
      expect(res503.status).toBe(502)
      expect(await res503.json()).toEqual({ error: 'upstream_unavailable' })
      expect(res503.headers.get('Set-Cookie')).toBeNull()

      fetchMock.mockRejectedValueOnce(new Error('network down'))

      const reqNet = new Request('https://sindecon.pages.dev/api/oauth/refresh', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
          Cookie: `${COOKIE_NAME}=${encodeURIComponent(existingCookie)}`,
        },
      })

      const resNet = await refreshOnRequest({ request: reqNet, env: TEST_ENV })
      expect(resNet.status).toBe(502)
      expect(await resNet.json()).toEqual({ error: 'upstream_unavailable' })
      expect(resNet.headers.get('Set-Cookie')).toBeNull()
    })

    it('devuelve 502 SIN borrar cookie cuando Google responde 200 con JSON literal null', async () => {
      const existingCookie = await encryptCookiePayload(
        { rt: '1//0g-valid', iat: 1000 },
        TEST_ENV.OAUTH_COOKIE_SECRET!,
      )

      fetchMock.mockResolvedValueOnce(new Response('null', { status: 200 }))

      const req = new Request('https://sindecon.pages.dev/api/oauth/refresh', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
          Cookie: `${COOKIE_NAME}=${encodeURIComponent(existingCookie)}`,
        },
      })

      const res = await refreshOnRequest({ request: req, env: TEST_ENV })
      expect(res.status).toBe(502)
      expect(await res.json()).toEqual({ error: 'upstream_unavailable' })
      expect(res.headers.get('Set-Cookie')).toBeNull()
    })
  })

  describe('POST /api/oauth/logout', () => {
    it('rechaza peticiones de distinto origen', async () => {
      const crossReq = new Request('https://sindecon.pages.dev/api/oauth/logout', {
        method: 'POST',
        headers: { Origin: 'https://evil.example' },
      })
      expect((await logoutOnRequest({ request: crossReq, env: TEST_ENV })).status).toBe(403)
    })

    it('revoca refresh_token en Google (best-effort) y siempre limpia la cookie', async () => {
      const existingCookie = await encryptCookiePayload(
        { rt: '1//0g-to-revoke', iat: 1000 },
        TEST_ENV.OAUTH_COOKIE_SECRET!,
      )

      fetchMock.mockRejectedValueOnce(new Error('network down'))

      const req = new Request('https://sindecon.pages.dev/api/oauth/logout', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
          Cookie: `${COOKIE_NAME}=${encodeURIComponent(existingCookie)}`,
        },
      })

      const res = await logoutOnRequest({ request: req, env: TEST_ENV })
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ ok: true })
      expect(res.headers.get('Set-Cookie')).toContain('Max-Age=0')
      expect(fetchMock).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/revoke',
        expect.objectContaining({ method: 'POST' }),
      )
      const [, revokeInit] = fetchMock.mock.calls[0]!
      const revokeParams = new URLSearchParams(String(revokeInit?.body))
      expect(revokeParams.get('token')).toBe('1//0g-to-revoke')
      expect(revokeInit?.signal).toBeInstanceOf(AbortSignal)
    })

    it('limpia la cookie sin llamar a Google si no hay cookie presente', async () => {
      const req = new Request('https://sindecon.pages.dev/api/oauth/logout', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
        },
      })

      const res = await logoutOnRequest({ request: req, env: {} })
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ ok: true })
      expect(res.headers.get('Set-Cookie')).toContain('Max-Age=0')
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  describe('Cloudflare Worker entrypoint (worker.ts)', () => {
    it('enruta /api/oauth/{exchange,refresh,logout} al handler correspondiente sin delegar a ASSETS', async () => {
      const assetsFetch = vi.fn<typeof fetch>()

      const exchangeReq = new Request('https://sindecon.workers.dev/api/oauth/exchange', {
        method: 'GET',
        headers: { Origin: 'https://sindecon.workers.dev' },
      })
      const exchangeRes = await worker.fetch(exchangeReq, {
        ...TEST_ENV,
        ASSETS: { fetch: assetsFetch },
      })
      expect(exchangeRes.status).toBe(405)
      expect(await exchangeRes.json()).toEqual({ error: 'method_not_allowed' })

      const refreshReq = new Request('https://sindecon.workers.dev/api/oauth/refresh', {
        method: 'POST',
        headers: { Origin: 'https://sindecon.workers.dev' },
      })
      const refreshRes = await worker.fetch(refreshReq, {
        ...TEST_ENV,
        ASSETS: { fetch: assetsFetch },
      })
      expect(refreshRes.status).toBe(401)
      expect(await refreshRes.json()).toEqual({ error: 'session_expired' })

      const logoutReq = new Request('https://sindecon.workers.dev/api/oauth/logout', {
        method: 'POST',
        headers: { Origin: 'https://sindecon.workers.dev' },
      })
      const logoutRes = await worker.fetch(logoutReq, {
        ...TEST_ENV,
        ASSETS: { fetch: assetsFetch },
      })
      expect(logoutRes.status).toBe(200)
      expect(await logoutRes.json()).toEqual({ ok: true })

      expect(assetsFetch).not.toHaveBeenCalled()
    })

    it('responde 404 JSON en rutas /api/* desconocidas y delega rutas estáticas a env.ASSETS', async () => {
      const assetsFetch = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(new Response('<html>SPA</html>', { status: 200 }))

      const apiMissingReq = new Request('https://sindecon.workers.dev/api/unknown', {
        method: 'GET',
      })
      const apiMissingRes = await worker.fetch(apiMissingReq, {
        ...TEST_ENV,
        ASSETS: { fetch: assetsFetch },
      })
      expect(apiMissingRes.status).toBe(404)
      expect(await apiMissingRes.json()).toEqual({ error: 'not_found' })
      expect(assetsFetch).not.toHaveBeenCalled()

      const appReq = new Request('https://sindecon.workers.dev/', { method: 'GET' })
      const appRes = await worker.fetch(appReq, {
        ...TEST_ENV,
        ASSETS: { fetch: assetsFetch },
      })
      expect(appRes.status).toBe(200)
      expect(await appRes.text()).toBe('<html>SPA</html>')
      expect(assetsFetch).toHaveBeenCalledTimes(1)
    })
  })
})
