import {
  buildClearCookieHeader,
  buildSessionSetCookieHeader,
  decryptCookiePayload,
  encryptCookiePayload,
  jsonResponse,
  readSessionCookie,
  validateEnv,
  validateSameOriginPost,
  type CfPagesContext,
} from './_shared'

interface GoogleRefreshResponse {
  access_token?: string
  expires_in?: number
  refresh_token?: string
  error?: string
}

function sessionExpiredResponse(requestUrl: string): Response {
  return jsonResponse({ error: 'session_expired' }, 401, {
    'Set-Cookie': buildClearCookieHeader(requestUrl),
  })
}

/** Renueva el access_token usando el refresh_token cifrado en cookie y desliza la expiración de la sesión. */
export async function onRequest(context: CfPagesContext): Promise<Response> {
  const originError = validateSameOriginPost(context.request)
  if (originError) return originError

  const envCheck = validateEnv(context.env)
  if (!envCheck.ok) return envCheck.response

  const rawCookie = readSessionCookie(context.request)
  const payload = rawCookie
    ? await decryptCookiePayload(rawCookie, envCheck.cookieSecret)
    : null

  if (!payload) {
    return sessionExpiredResponse(context.request.url)
  }

  let googleRes: Response
  try {
    googleRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: envCheck.clientId,
        client_secret: envCheck.clientSecret,
        refresh_token: payload.rt,
        grant_type: 'refresh_token',
      }).toString(),
    })
  } catch {
    return jsonResponse({ error: 'upstream_unavailable' }, 502)
  }

  if (!googleRes.ok) {
    if (googleRes.status === 400 || googleRes.status === 401) {
      let errCode = ''
      try {
        const errBody = (await googleRes.json()) as { error?: string }
        errCode = errBody.error || ''
      } catch {
        errCode = ''
      }
      if (errCode === 'invalid_grant' || errCode === 'unauthorized_client' || !errCode) {
        return sessionExpiredResponse(context.request.url)
      }
    }
    return jsonResponse({ error: 'upstream_unavailable' }, 502)
  }

  let tokenData: GoogleRefreshResponse
  try {
    tokenData = (await googleRes.json()) as GoogleRefreshResponse
  } catch {
    return jsonResponse({ error: 'upstream_unavailable' }, 502)
  }

  if (!tokenData?.access_token) {
    return jsonResponse({ error: 'upstream_unavailable' }, 502)
  }

  const nextRt = tokenData.refresh_token || payload.rt
  const encrypted = await encryptCookiePayload(
    {
      rt: nextRt,
      email: payload.email,
      iat: Date.now(),
    },
    envCheck.cookieSecret,
  )

  return jsonResponse(
    {
      access_token: tokenData.access_token,
      expires_in: typeof tokenData.expires_in === 'number' ? tokenData.expires_in : 3600,
      email: payload.email,
    },
    200,
    {
      'Set-Cookie': buildSessionSetCookieHeader(encrypted, context.request.url),
    },
  )
}
