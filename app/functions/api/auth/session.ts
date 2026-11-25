import { jsonResponse, validateEnv, validateSameOriginPost, type CfPagesContext } from '../oauth/_shared'
import { clearAuthCookieHeader, readAuthSessionCookie } from './_session'

/** Valida la cookie HttpOnly sindecon_auth_session cuando el terminal consulta su sesión en red. */
export async function onRequest(context: CfPagesContext): Promise<Response> {
  const originError = validateSameOriginPost(context.request)
  if (originError) return originError

  const envCheck = validateEnv(context.env)
  if (!envCheck.ok) return envCheck.response

  const session = await readAuthSessionCookie(context.request, envCheck.cookieSecret)
  if (!session) {
    return jsonResponse({ authenticated: false }, 401, {
      'Set-Cookie': clearAuthCookieHeader(context.request.url),
    })
  }

  return jsonResponse({ authenticated: true, user: session.user }, 200)
}
