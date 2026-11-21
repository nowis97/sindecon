import {
  buildClearCookieHeader,
  decryptCookiePayload,
  jsonResponse,
  readSessionCookie,
  validateSameOriginPost,
  type CfPagesContext,
} from './_shared'

/** Revoca en Google (best-effort) el refresh_token de la cookie y limpia la cookie de sesión local. */
export async function onRequest(context: CfPagesContext): Promise<Response> {
  const originError = validateSameOriginPost(context.request)
  if (originError) return originError

  const rawCookie = readSessionCookie(context.request)
  const secret = context.env.OAUTH_COOKIE_SECRET?.trim()

  if (rawCookie && secret) {
    const payload = await decryptCookiePayload(rawCookie, secret)
    if (payload?.rt) {
      try {
        await fetch('https://oauth2.googleapis.com/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token: payload.rt }).toString(),
          signal: AbortSignal.timeout(3000),
        })
      } catch {
        // Best-effort: el borrado local de la cookie siempre debe ejecutarse
      }
    }
  }

  return jsonResponse({ ok: true }, 200, {
    'Set-Cookie': buildClearCookieHeader(context.request.url),
  })
}
