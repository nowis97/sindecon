import {
  COOKIE_MAX_AGE_SECONDS,
  buildScopedCookieHeader,
  decryptSealedPayload,
  encryptSealedPayload,
  readCookieByName,
} from '../oauth/_shared'

export const AUTH_COOKIE_NAME = 'sindecon_auth_session'
// Path /api (no /api/auth) para que la cookie llegue también a /api/decks.
// Mismo origen y HttpOnly: no se amplía la exposición fuera del Worker.
export const AUTH_COOKIE_PATH = '/api'

export interface AuthSessionUser {
  sub: string
  email: string
  name: string
  picture?: string
  method: 'google' | 'fido'
}

export interface AuthSessionPayload {
  user: AuthSessionUser
  iat: number
}

export async function createAuthCookieHeader(
  user: AuthSessionUser,
  secret: string,
  requestUrl: string,
): Promise<string> {
  const encrypted = await encryptSealedPayload<AuthSessionPayload>(
    { user, iat: Date.now() },
    secret,
  )
  return buildScopedCookieHeader({
    name: AUTH_COOKIE_NAME,
    value: encrypted,
    path: AUTH_COOKIE_PATH,
    maxAgeSeconds: COOKIE_MAX_AGE_SECONDS,
    requestUrl,
  })
}

export async function readAuthSessionCookie(
  request: Request,
  secret: string,
): Promise<AuthSessionPayload | null> {
  const raw = readCookieByName(request, AUTH_COOKIE_NAME)
  if (!raw) return null
  const payload = await decryptSealedPayload<unknown>(raw, secret)
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null
  }
  const obj = payload as Partial<AuthSessionPayload>
  if (
    !obj.user ||
    typeof obj.user !== 'object' ||
    Array.isArray(obj.user) ||
    typeof obj.user.email !== 'string' ||
    typeof obj.user.sub !== 'string' ||
    typeof obj.user.name !== 'string' ||
    (obj.user.method !== 'google' && obj.user.method !== 'fido') ||
    typeof obj.iat !== 'number'
  ) {
    return null
  }
  return obj as AuthSessionPayload
}

export function clearAuthCookieHeader(requestUrl: string): string {
  return buildScopedCookieHeader({
    name: AUTH_COOKIE_NAME,
    value: '',
    path: AUTH_COOKIE_PATH,
    maxAgeSeconds: 0,
    requestUrl,
  })
}
