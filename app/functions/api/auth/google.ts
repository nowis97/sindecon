import { fromBase64Url } from '../../../shared/webauthnCrypto'
import {
  COOKIE_NAME as GDRIVE_COOKIE_NAME,
  decryptCookiePayload,
  jsonResponse,
  readCookieByName,
  validateEnv,
  validateSameOriginPost,
  type CfPagesContext,
} from '../oauth/_shared'
import { createAuthCookieHeader, type AuthSessionUser } from './_session'

interface GoogleIdTokenClaims {
  sub?: string
  email?: string
  email_verified?: boolean
  name?: string
  picture?: string
  aud?: string
  iss?: string
  exp?: number
}

const decoder = new TextDecoder()

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parseJwtClaims(idToken: string): GoogleIdTokenClaims | null {
  const parts = idToken.split('.')
  if (parts.length < 2) return null
  const payloadBytes = fromBase64Url(parts[1]!)
  if (!payloadBytes) return null
  try {
    const parsed: unknown = JSON.parse(decoder.decode(payloadBytes))
    return isPlainObject(parsed) ? (parsed as GoogleIdTokenClaims) : null
  } catch {
    return null
  }
}

function isValidGoogleIdentity(claims: GoogleIdTokenClaims, clientId: string): boolean {
  const validIss =
    claims.iss === 'https://accounts.google.com' || claims.iss === 'accounts.google.com'
  const notExpired =
    typeof claims.exp !== 'number' || claims.exp * 1000 > Date.now() - 60_000
  return Boolean(
    validIss &&
      notExpired &&
      claims.aud === clientId &&
      claims.email_verified === true &&
      typeof claims.email === 'string' &&
      claims.email.length > 0 &&
      typeof claims.sub === 'string' &&
      claims.sub.length > 0,
  )
}

/** Canjea authorization code de GIS (`openid email profile`), verifica identidad Google y emite sesión HttpOnly. */
export async function onRequest(context: CfPagesContext): Promise<Response> {
  const originError = validateSameOriginPost(context.request)
  if (originError) return originError

  const envCheck = validateEnv(context.env)
  if (!envCheck.ok) return envCheck.response

  let code = ''
  try {
    const body: unknown = await context.request.json()
    if (isPlainObject(body) && typeof body.code === 'string') {
      code = body.code.trim()
    }
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400)
  }
  if (!code) return jsonResponse({ error: 'missing_code' }, 400)

  let googleRes: Response
  try {
    googleRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: envCheck.clientId,
        client_secret: envCheck.clientSecret,
        redirect_uri: 'postmessage',
        grant_type: 'authorization_code',
      }).toString(),
    })
  } catch {
    return jsonResponse({ error: 'upstream_unavailable' }, 502)
  }

  if (!googleRes.ok) {
    return googleRes.status >= 500 || googleRes.status === 429
      ? jsonResponse({ error: 'upstream_unavailable' }, 502)
      : jsonResponse({ error: 'oauth_exchange_failed' }, 401)
  }

  let tokenDataRaw: unknown
  try {
    tokenDataRaw = await googleRes.json()
  } catch {
    return jsonResponse({ error: 'oauth_exchange_failed' }, 401)
  }
  if (!isPlainObject(tokenDataRaw)) {
    return jsonResponse({ error: 'oauth_exchange_failed' }, 401)
  }
  const tokenData = tokenDataRaw as { access_token?: unknown; id_token?: unknown }

  let claims =
    typeof tokenData.id_token === 'string' ? parseJwtClaims(tokenData.id_token) : null
  if (!claims && typeof tokenData.access_token === 'string' && tokenData.access_token.length > 0) {
    try {
      const uiRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      })
      if (uiRes.ok) {
        const ui: unknown = await uiRes.json()
        if (isPlainObject(ui)) {
          claims = {
            ...(ui as GoogleIdTokenClaims),
            aud: envCheck.clientId,
            iss: 'https://accounts.google.com',
          }
        }
      }
    } catch {
      claims = null
    }
  }

  if (!claims || !isValidGoogleIdentity(claims, envCheck.clientId)) {
    return jsonResponse({ error: 'invalid_google_identity' }, 401)
  }

  const email = claims.email!
  const user: AuthSessionUser = {
    sub: claims.sub!,
    email,
    name: typeof claims.name === 'string' && claims.name.trim() ? claims.name.trim() : email.split('@')[0]!,
    picture: typeof claims.picture === 'string' ? claims.picture : undefined,
    method: 'google',
  }

  // Verificar de forma pasiva si ya existe cookie Drive previa del mismo usuario (sin emitirla si no existía)
  const gdriveRaw = readCookieByName(context.request, GDRIVE_COOKIE_NAME)
  const gdriveSession = gdriveRaw
    ? await decryptCookiePayload(gdriveRaw, envCheck.cookieSecret)
    : null
  const driveConnected = Boolean(
    gdriveSession?.email && gdriveSession.email.toLowerCase() === email.toLowerCase(),
  )

  const setCookie = await createAuthCookieHeader(
    user,
    envCheck.cookieSecret,
    context.request.url,
  )

  return jsonResponse({ user, driveConnected }, 200, { 'Set-Cookie': setCookie })
}
