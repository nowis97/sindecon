import { toBase64Url } from '../../../../shared/webauthnCrypto'
import {
  buildScopedCookieHeader,
  encryptSealedPayload,
  jsonResponse,
  validateEnv,
  validateSameOriginPost,
  type CfPagesContext,
} from '../../oauth/_shared'

export const FIDO_CHALLENGE_COOKIE = 'sindecon_fido_challenge'
export const FIDO_CHALLENGE_PATH = '/api/auth/fido'
export const FIDO_CHALLENGE_TTL_MS = 180_000

export interface FidoChallengePayload {
  challenge: string
  origin: string
  exp: number
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/** Emite un challenge aleatorio de 32 bytes y lo guarda en cookie HttpOnly cifrada de un solo uso. */
export async function onRequest(context: CfPagesContext): Promise<Response> {
  const originError = validateSameOriginPost(context.request)
  if (originError) return originError

  const envCheck = validateEnv(context.env)
  if (!envCheck.ok) return envCheck.response

  const challenge = toBase64Url(crypto.getRandomValues(new Uint8Array(32)))
  const origin = new URL(context.request.url).origin
  const encrypted = await encryptSealedPayload<FidoChallengePayload>(
    { challenge, origin, exp: Date.now() + FIDO_CHALLENGE_TTL_MS },
    envCheck.cookieSecret,
  )

  return jsonResponse({ challenge }, 200, {
    'Set-Cookie': buildScopedCookieHeader({
      name: FIDO_CHALLENGE_COOKIE,
      value: encrypted,
      path: FIDO_CHALLENGE_PATH,
      maxAgeSeconds: 180,
      requestUrl: context.request.url,
    }),
  })
}
