import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import worker from '../../worker'
import {
  COOKIE_NAME as GDRIVE_COOKIE_NAME,
  encryptCookiePayload,
  type OAuthEnv,
} from '../../functions/api/oauth/_shared'

const TEST_ENV: OAuthEnv = {
  GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'client-secret',
  OAUTH_COOKIE_SECRET: '0123456789abcdef0123456789abcdef',
}

function makeFakeIdToken(payload: unknown): string {
  const encodeJsonB64Url = (obj: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(obj))
    let bin = ''
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  }
  return `${encodeJsonB64Url({ alg: 'RS256', typ: 'JWT' })}.${encodeJsonB64Url(payload)}.sig`
}

function extractCookie(setCookie: string | null, name: string): string | null {
  if (!setCookie) return null
  const prefix = `${name}=`
  const idx = setCookie.indexOf(prefix)
  if (idx < 0) return null
  const rest = setCookie.slice(idx + prefix.length)
  const end = rest.indexOf(';')
  return decodeURIComponent(end >= 0 ? rest.slice(0, end) : rest)
}

describe('/api/auth/google, /session y /logout', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('canjea code de Google, valida id_token y emite cookie HttpOnly sindecon_auth_session', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'ya29.identity-only',
          expires_in: 3600,
          id_token: makeFakeIdToken({
            sub: 'google-sub-123',
            email: 'dra.martinez@gmail.com',
            email_verified: true,
            name: 'Dra. Martínez',
            picture: 'https://lh3.googleusercontent.com/a/avatar',
            aud: TEST_ENV.GOOGLE_CLIENT_ID,
            iss: 'https://accounts.google.com',
            exp: Math.floor(Date.now() / 1000) + 3600,
          }),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const loginReq = new Request('https://sindecon.pages.dev/api/auth/google', {
      method: 'POST',
      headers: { Origin: 'https://sindecon.pages.dev', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'auth-code-123' }),
    })

    const res = await worker.fetch(loginReq, TEST_ENV)
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store, private')
    expect(res.headers.get('Vary')).toBe('Cookie')

    const json = (await res.json()) as {
      user: { sub: string; email: string; name: string; method: string }
      driveConnected: boolean
    }
    expect(json.user).toMatchObject({
      sub: 'google-sub-123',
      email: 'dra.martinez@gmail.com',
      name: 'Dra. Martínez',
      method: 'google',
    })
    expect(json.driveConnected).toBe(false)

    const cookieHeader = res.headers.get('Set-Cookie')
    expect(cookieHeader).toContain('sindecon_auth_session=')
    expect(cookieHeader).toContain('HttpOnly')
    expect(cookieHeader).toContain('SameSite=Lax')
    expect(cookieHeader).toContain('Path=/api')
    expect(cookieHeader).toContain('Secure')
    const cookieVal = extractCookie(cookieHeader, 'sindecon_auth_session')!

    const sessionReq = new Request('https://sindecon.pages.dev/api/auth/session', {
      method: 'POST',
      headers: {
        Origin: 'https://sindecon.pages.dev',
        Cookie: `sindecon_auth_session=${encodeURIComponent(cookieVal)}`,
      },
    })
    const sessionRes = await worker.fetch(sessionReq, TEST_ENV)
    expect(sessionRes.status).toBe(200)
    expect(await sessionRes.json()).toMatchObject({
      authenticated: true,
      user: { email: 'dra.martinez@gmail.com', sub: 'google-sub-123' },
    })

    const logoutReq = new Request('https://sindecon.pages.dev/api/auth/logout', {
      method: 'POST',
      headers: { Origin: 'https://sindecon.pages.dev' },
    })
    const logoutRes = await worker.fetch(logoutReq, TEST_ENV)
    expect(logoutRes.status).toBe(200)
    expect(await logoutRes.json()).toEqual({ ok: true })
    expect(logoutRes.headers.get('Set-Cookie')).toContain('Max-Age=0')
    expect(logoutRes.headers.get('Set-Cookie')).toContain('Path=/api')
  })

  it('detecta cookie pasiva de Drive si coincide el email sin re-emitirla', async () => {
    const gdriveCookie = await encryptCookiePayload(
      { rt: '1//0g-drive-rt', email: 'Dra.Martinez@gmail.com', iat: 1000 },
      TEST_ENV.OAUTH_COOKIE_SECRET!,
    )

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'ya29.identity',
          id_token: makeFakeIdToken({
            sub: 'google-sub-123',
            email: 'dra.martinez@gmail.com',
            email_verified: true,
            aud: TEST_ENV.GOOGLE_CLIENT_ID,
            iss: 'accounts.google.com',
            exp: Math.floor(Date.now() / 1000) + 3600,
          }),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const req = new Request('https://sindecon.pages.dev/api/auth/google', {
      method: 'POST',
      headers: {
        Origin: 'https://sindecon.pages.dev',
        'Content-Type': 'application/json',
        Cookie: `${GDRIVE_COOKIE_NAME}=${encodeURIComponent(gdriveCookie)}`,
      },
      body: JSON.stringify({ code: 'auth-code-drive' }),
    })

    const res = await worker.fetch(req, TEST_ENV)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { driveConnected: boolean; user: { name: string } }
    expect(body.driveConnected).toBe(true)
    expect(body.user.name).toBe('dra.martinez')
    expect(res.headers.get('Set-Cookie')).not.toContain(GDRIVE_COOKIE_NAME)
  })

  it('rechaza id_token con aud distinto, email no verificado o claims no-objeto', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'ya29.bad-aud',
          id_token: makeFakeIdToken({
            sub: 'sub-9',
            email: 'otro@gmail.com',
            email_verified: false,
            aud: 'otro-client.apps.googleusercontent.com',
            iss: 'https://accounts.google.com',
            exp: Math.floor(Date.now() / 1000) + 3600,
          }),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const req = new Request('https://sindecon.pages.dev/api/auth/google', {
      method: 'POST',
      headers: { Origin: 'https://sindecon.pages.dev', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'bad-code' }),
    })

    const res = await worker.fetch(req, TEST_ENV)
    expect(res.status).toBe(401)

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id_token: makeFakeIdToken(null),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const nullClaimsReq = new Request('https://sindecon.pages.dev/api/auth/google', {
      method: 'POST',
      headers: { Origin: 'https://sindecon.pages.dev', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'bad-code' }),
    })
    const nullClaimsRes = await worker.fetch(nullClaimsReq, TEST_ENV)
    expect(nullClaimsRes.status).toBe(401)
  })

  it('valida CSRF, cuerpo JSON no-objeto y errores de upstream en /api/auth/google', async () => {
    const getReq = new Request('https://sindecon.pages.dev/api/auth/google', {
      method: 'GET',
      headers: { Origin: 'https://sindecon.pages.dev' },
    })
    expect((await worker.fetch(getReq, TEST_ENV)).status).toBe(405)

    const crossReq = new Request('https://sindecon.pages.dev/api/auth/google', {
      method: 'POST',
      headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'abc' }),
    })
    expect((await worker.fetch(crossReq, TEST_ENV)).status).toBe(403)

    const nullBodyReq = new Request('https://sindecon.pages.dev/api/auth/google', {
      method: 'POST',
      headers: { Origin: 'https://sindecon.pages.dev', 'Content-Type': 'application/json' },
      body: 'null',
    })
    const nullBodyRes = await worker.fetch(nullBodyReq, TEST_ENV)
    expect(nullBodyRes.status).toBe(400)
    expect(await nullBodyRes.json()).toEqual({ error: 'missing_code' })

    fetchMock.mockResolvedValueOnce(new Response('null', { status: 200 }))
    const validReq = new Request('https://sindecon.pages.dev/api/auth/google', {
      method: 'POST',
      headers: { Origin: 'https://sindecon.pages.dev', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'code-1' }),
    })
    const nullUpstreamRes = await worker.fetch(validReq, TEST_ENV)
    expect(nullUpstreamRes.status).toBe(401)
    expect(await nullUpstreamRes.json()).toEqual({ error: 'oauth_exchange_failed' })

    fetchMock.mockRejectedValueOnce(new Error('network down'))
    const netErrReq = new Request('https://sindecon.pages.dev/api/auth/google', {
      method: 'POST',
      headers: { Origin: 'https://sindecon.pages.dev', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'code-2' }),
    })
    const netErrRes = await worker.fetch(netErrReq, TEST_ENV)
    expect(netErrRes.status).toBe(502)
    expect(await netErrRes.json()).toEqual({ error: 'upstream_unavailable' })
  })

  it('rechaza /api/auth/session sin cookie válida y limpia la cookie', async () => {
    const req = new Request('https://sindecon.pages.dev/api/auth/session', {
      method: 'POST',
      headers: {
        Origin: 'https://sindecon.pages.dev',
        Cookie: 'sindecon_auth_session=tampered.value',
      },
    })
    const res = await worker.fetch(req, TEST_ENV)
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ authenticated: false })
    expect(res.headers.get('Set-Cookie')).toContain('Max-Age=0')
    expect(res.headers.get('Set-Cookie')).toContain('Path=/api')
  })
})

