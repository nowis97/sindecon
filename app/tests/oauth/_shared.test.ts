import { describe, it, expect } from 'vitest'
import {
  COOKIE_NAME,
  COOKIE_MAX_AGE_SECONDS,
  encryptCookiePayload,
  decryptCookiePayload,
  readSessionCookie,
  buildSessionSetCookieHeader,
  buildClearCookieHeader,
  validateSameOriginPost,
  validateEnv,
  jsonResponse,
} from '../../functions/api/oauth/_shared'

describe('oauth _shared helpers', () => {
  const secret = 'super-secret-32-bytes-minimum-key-for-aes-gcm'

  it('cifra y descifra el payload de refresh_token con AES-256-GCM', async () => {
    const payload = {
      rt: '1//0g-refresh-token-de-prueba',
      email: 'medico@hospital.cl',
      iat: 1730000000000,
    }

    const encrypted = await encryptCookiePayload(payload, secret)
    expect(encrypted.split('.')).toHaveLength(2)
    expect(encrypted).not.toContain(payload.rt)

    const decrypted = await decryptCookiePayload(encrypted, secret)
    expect(decrypted).toEqual(payload)
  })

  it('rechaza cookies manipuladas, malformadas o con secreto distinto', async () => {
    const encrypted = await encryptCookiePayload(
      { rt: '1//0g-token', iat: 1730000000000 },
      secret,
    )

    expect(await decryptCookiePayload(encrypted, 'otro-secreto-distinto')).toBeNull()
    expect(await decryptCookiePayload(`${encrypted}x`, secret)).toBeNull()
    expect(await decryptCookiePayload('sin-punto', secret)).toBeNull()
    expect(await decryptCookiePayload('', secret)).toBeNull()
    expect(await decryptCookiePayload('shortiv.ciphertext', secret)).toBeNull()
  })

  it('lee correctamente la cookie desde el header Cookie con múltiples cookies', () => {
    const req = new Request('https://sindecon.pages.dev/api/oauth/refresh', {
      method: 'POST',
      headers: {
        Cookie: `otra=123; ${COOKIE_NAME}=abc.def%3D; theme=dark`,
      },
    })
    expect(readSessionCookie(req)).toBe('abc.def=')

    const missingReq = new Request('https://sindecon.pages.dev/api/oauth/refresh', {
      method: 'POST',
    })
    expect(readSessionCookie(missingReq)).toBeNull()

    const otherOnlyReq = new Request('https://sindecon.pages.dev/api/oauth/refresh', {
      method: 'POST',
      headers: { Cookie: 'otra=123; theme=dark' },
    })
    expect(readSessionCookie(otherOnlyReq)).toBeNull()
  })

  it('construye Set-Cookie con Secure en HTTPS y sin Secure en http://localhost', () => {
    const httpsCookie = buildSessionSetCookieHeader('iv.cipher', 'https://sindecon.pages.dev/api/oauth/exchange')
    expect(httpsCookie).toContain(`${COOKIE_NAME}=iv.cipher`)
    expect(httpsCookie).toContain('HttpOnly')
    expect(httpsCookie).toContain('SameSite=Lax')
    expect(httpsCookie).toContain('Path=/api/oauth')
    expect(httpsCookie).toContain(`Max-Age=${COOKIE_MAX_AGE_SECONDS}`)
    expect(httpsCookie).toContain('Secure')

    const localCookie = buildSessionSetCookieHeader('iv.cipher', 'http://localhost:8788/api/oauth/exchange')
    expect(localCookie).not.toContain('Secure')

    const loopbackCookie = buildSessionSetCookieHeader('iv.cipher', 'http://127.0.0.1:8788/api/oauth/exchange')
    expect(loopbackCookie).not.toContain('Secure')

    const clearCookie = buildClearCookieHeader('https://sindecon.pages.dev/api/oauth/logout')
    expect(clearCookie).toContain(`${COOKIE_NAME}=;`)
    expect(clearCookie).toContain('Max-Age=0')
    expect(clearCookie).toContain('Path=/api/oauth')
    expect(clearCookie).toContain('Secure')
  })

  it('valida método POST y mismo origen contra CSRF', () => {
    const getReq = new Request('https://sindecon.pages.dev/api/oauth/refresh', {
      method: 'GET',
      headers: { Origin: 'https://sindecon.pages.dev' },
    })
    const getRes = validateSameOriginPost(getReq)
    expect(getRes?.status).toBe(405)
    expect(getRes?.headers.get('Allow')).toBe('POST')

    const crossOriginReq = new Request('https://sindecon.pages.dev/api/oauth/refresh', {
      method: 'POST',
      headers: { Origin: 'https://evil.example' },
    })
    expect(validateSameOriginPost(crossOriginReq)?.status).toBe(403)

    const crossSiteFetchReq = new Request('https://sindecon.pages.dev/api/oauth/refresh', {
      method: 'POST',
      headers: { 'Sec-Fetch-Site': 'cross-site' },
    })
    expect(validateSameOriginPost(crossSiteFetchReq)?.status).toBe(403)

    const missingHeadersReq = new Request('https://sindecon.pages.dev/api/oauth/refresh', {
      method: 'POST',
    })
    expect(validateSameOriginPost(missingHeadersReq)?.status).toBe(403)

    const emptyOriginReq = new Request('https://sindecon.pages.dev/api/oauth/refresh', {
      method: 'POST',
      headers: { Origin: '' },
    })
    expect(validateSameOriginPost(emptyOriginReq)?.status).toBe(403)

    const emptyOriginSameSiteReq = new Request('https://sindecon.pages.dev/api/oauth/refresh', {
      method: 'POST',
      headers: { Origin: '', 'Sec-Fetch-Site': 'same-origin' },
    })
    expect(validateSameOriginPost(emptyOriginSameSiteReq)?.status).toBe(403)

    const sameOriginReq = new Request('https://sindecon.pages.dev/api/oauth/refresh', {
      method: 'POST',
      headers: { Origin: 'https://sindecon.pages.dev' },
    })
    expect(validateSameOriginPost(sameOriginReq)).toBeNull()

    const fetchSiteReq = new Request('https://sindecon.pages.dev/api/oauth/refresh', {
      method: 'POST',
      headers: { 'Sec-Fetch-Site': 'same-origin' },
    })
    expect(validateSameOriginPost(fetchSiteReq)).toBeNull()
  })

  it('valida presencia de variables de entorno requeridas y agrega cabeceras no-store', async () => {
    const missing = validateEnv({ GOOGLE_CLIENT_ID: 'id' })
    expect(missing.ok).toBe(false)
    if (!missing.ok) {
      expect(missing.response.status).toBe(500)
      expect(await missing.response.json()).toEqual({ error: 'server_not_configured' })
    }

    const blank = validateEnv({
      GOOGLE_CLIENT_ID: 'id',
      GOOGLE_CLIENT_SECRET: '   ',
      OAUTH_COOKIE_SECRET: 'secret',
    })
    expect(blank.ok).toBe(false)

    const valid = validateEnv({
      GOOGLE_CLIENT_ID: ' id ',
      GOOGLE_CLIENT_SECRET: ' secret ',
      OAUTH_COOKIE_SECRET: ' cookie-secret ',
    })
    expect(valid).toEqual({
      ok: true,
      clientId: 'id',
      clientSecret: 'secret',
      cookieSecret: 'cookie-secret',
    })

    const res = jsonResponse({ ok: true }, 200, { 'X-Custom': '1' })
    expect(res.headers.get('Content-Type')).toBe('application/json; charset=utf-8')
    expect(res.headers.get('Cache-Control')).toBe('no-store, private')
    expect(res.headers.get('Vary')).toBe('Cookie')
    expect(res.headers.get('X-Custom')).toBe('1')
  })
})
