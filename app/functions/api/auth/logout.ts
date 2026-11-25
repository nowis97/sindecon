import { jsonResponse, validateSameOriginPost, type CfPagesContext } from '../oauth/_shared'
import { clearAuthCookieHeader } from './_session'

/** Limpia la cookie HttpOnly de identidad al desvincular el dispositivo. */
export async function onRequest(context: CfPagesContext): Promise<Response> {
  const originError = validateSameOriginPost(context.request)
  if (originError) return originError

  return jsonResponse({ ok: true }, 200, {
    'Set-Cookie': clearAuthCookieHeader(context.request.url),
  })
}
