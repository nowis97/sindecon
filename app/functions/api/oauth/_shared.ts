export interface OAuthEnv {
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  OAUTH_COOKIE_SECRET?: string
}

export interface CfPagesContext {
  request: Request
  env: OAuthEnv
}

export interface EncryptedSessionPayload {
  rt: string
  email?: string
  iat: number
}

export const COOKIE_NAME = 'sindecon_gdrive_rt'
export const COOKIE_PATH = '/api/oauth'
export const COOKIE_MAX_AGE_SECONDS = 15_552_000 // 180 días

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  if (!value) return null
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4)
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  } catch {
    return null
  }
}

async function deriveAesKey(secret: string): Promise<CryptoKey> {
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(secret))
  return await crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ])
}

/** Construye una respuesta JSON con cabeceras de no-caché para endpoints OAuth. */
export function jsonResponse(
  data: unknown,
  status = 200,
  extraHeaders?: HeadersInit,
): Response {
  const headers = new Headers(extraHeaders)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  headers.set('Cache-Control', 'no-store, private')
  headers.set('Vary', 'Cookie')
  return new Response(JSON.stringify(data), { status, headers })
}

/** Verifica método POST y mismo origen (Origin o Sec-Fetch-Site) para mitigar CSRF. */
export function validateSameOriginPost(request: Request): Response | null {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405, { Allow: 'POST' })
  }

  const expectedOrigin = new URL(request.url).origin
  const originHeader = request.headers.get('Origin')
  if (originHeader !== null) {
    if (originHeader !== expectedOrigin) {
      return jsonResponse({ error: 'forbidden_origin' }, 403)
    }
    return null
  }

  const fetchSite = request.headers.get('Sec-Fetch-Site')
  if (fetchSite === 'same-origin') {
    return null
  }

  return jsonResponse({ error: 'forbidden_origin' }, 403)
}

/** Valida que las variables de entorno requeridas para OAuth estén configuradas. */
export function validateEnv(
  env: OAuthEnv,
):
  | { ok: true; clientId: string; clientSecret: string; cookieSecret: string }
  | { ok: false; response: Response } {
  const clientId = env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim()
  const cookieSecret = env.OAUTH_COOKIE_SECRET?.trim()

  if (!clientId || !clientSecret || !cookieSecret) {
    return {
      ok: false,
      response: jsonResponse({ error: 'server_not_configured' }, 500),
    }
  }

  return { ok: true, clientId, clientSecret, cookieSecret }
}

/** Cifra el payload de sesión con AES-256-GCM usando un IV aleatorio de 96 bits. */
export async function encryptCookiePayload(
  payload: EncryptedSessionPayload,
  secret: string,
): Promise<string> {
  const key = await deriveAesKey(secret)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = encoder.encode(JSON.stringify(payload))
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext),
  )
  return `${toBase64Url(iv)}.${toBase64Url(ciphertext)}`
}

/** Descifra y valida la estructura del payload de sesión; retorna null si falla o fue manipulado. */
export async function decryptCookiePayload(
  cookieValue: string,
  secret: string,
): Promise<EncryptedSessionPayload | null> {
  if (!cookieValue || !secret) return null
  const parts = cookieValue.split('.')
  if (parts.length !== 2) return null

  const iv = fromBase64Url(parts[0]!)
  const ciphertext = fromBase64Url(parts[1]!)
  if (!iv || !ciphertext || iv.length !== 12) return null

  try {
    const key = await deriveAesKey(secret)
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext,
    )
    const parsed = JSON.parse(decoder.decode(decrypted)) as Partial<EncryptedSessionPayload>
    if (
      parsed &&
      typeof parsed.rt === 'string' &&
      parsed.rt.length > 0 &&
      typeof parsed.iat === 'number'
    ) {
      return {
        rt: parsed.rt,
        email: typeof parsed.email === 'string' ? parsed.email : undefined,
        iat: parsed.iat,
      }
    }
    return null
  } catch {
    return null
  }
}

/** Extrae y decodifica la cookie de sesión OAuth desde la cabecera Cookie de la petición. */
export function readSessionCookie(request: Request): string | null {
  const header = request.headers.get('Cookie')
  if (!header) return null
  const cookies = header.split(';')
  for (const part of cookies) {
    const eqIndex = part.indexOf('=')
    if (eqIndex <= 0) continue
    const name = part.slice(0, eqIndex).trim()
    if (name === COOKIE_NAME) {
      const raw = part.slice(eqIndex + 1).trim()
      try {
        return decodeURIComponent(raw)
      } catch {
        return raw
      }
    }
  }
  return null
}

function shouldSetSecureFlag(requestUrl: string): boolean {
  const url = new URL(requestUrl)
  if (url.protocol === 'https:') return true
  return url.hostname !== 'localhost' && url.hostname !== '127.0.0.1'
}

function formatSessionCookie(
  value: string,
  maxAgeSeconds: number,
  requestUrl: string,
): string {
  const attrs = [
    `${COOKIE_NAME}=${value}`,
    'HttpOnly',
    'SameSite=Lax',
    `Path=${COOKIE_PATH}`,
    `Max-Age=${maxAgeSeconds}`,
  ]
  if (shouldSetSecureFlag(requestUrl)) {
    attrs.push('Secure')
  }
  return attrs.join('; ')
}

/** Construye la cabecera Set-Cookie persistente HttpOnly/SameSite=Lax para guardar la sesión. */
export function buildSessionSetCookieHeader(
  encryptedValue: string,
  requestUrl: string,
): string {
  return formatSessionCookie(encodeURIComponent(encryptedValue), COOKIE_MAX_AGE_SECONDS, requestUrl)
}

/** Construye la cabecera Set-Cookie con Max-Age=0 para revocar la cookie de sesión en el navegador. */
export function buildClearCookieHeader(requestUrl: string): string {
  return formatSessionCookie('', 0, requestUrl)
}
