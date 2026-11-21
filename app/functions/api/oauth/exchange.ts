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

interface GoogleTokenResponse {
  access_token?: string
  expires_in?: number
  refresh_token?: string
  id_token?: string
  error?: string
}

function decodeEmailFromIdToken(idToken?: string): string | undefined {
  if (!idToken) return undefined
  const parts = idToken.split('.')
  if (parts.length < 2) return undefined
  try {
    const raw = parts[1]!
    const padded = raw.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((raw.length + 3) % 4)
    const parsed = JSON.parse(atob(padded)) as { email?: unknown }
    return typeof parsed.email === 'string' && parsed.email ? parsed.email : undefined
  } catch {
    return undefined
  }
}

async function fetchDriveEmail(accessToken: string): Promise<string | undefined> {
  try {
    const res = await fetch(
      'https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)',
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    if (!res.ok) return undefined
    const data = (await res.json()) as { user?: { emailAddress?: string } }
    return data.user?.emailAddress || undefined
  } catch {
    return undefined
  }
}

/** Canjea un authorization code de GIS por tokens de Google y guarda el refresh_token cifrado en cookie HttpOnly. */
export async function onRequest(context: CfPagesContext): Promise<Response> {
  const originError = validateSameOriginPost(context.request)
  if (originError) return originError

  const envCheck = validateEnv(context.env)
  if (!envCheck.ok) return envCheck.response

  let code = ''
  try {
    const body = (await context.request.json()) as { code?: unknown }
    if (typeof body?.code === 'string') {
      code = body.code.trim()
    }
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400)
  }

  if (!code) {
    return jsonResponse({ error: 'missing_code' }, 400)
  }

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
    if (googleRes.status >= 500 || googleRes.status === 429) {
      return jsonResponse({ error: 'upstream_unavailable' }, 502)
    }
    return jsonResponse({ error: 'oauth_exchange_failed' }, 401)
  }

  let tokenData: GoogleTokenResponse
  try {
    tokenData = (await googleRes.json()) as GoogleTokenResponse
  } catch {
    return jsonResponse({ error: 'upstream_unavailable' }, 502)
  }

  if (!tokenData.access_token) {
    return jsonResponse({ error: 'oauth_exchange_failed' }, 401)
  }

  const email =
    decodeEmailFromIdToken(tokenData.id_token) ||
    (await fetchDriveEmail(tokenData.access_token))

  let refreshToken = tokenData.refresh_token
  let fallbackEmail = email
  let clearExistingCookie = false
  if (!refreshToken) {
    // Google puede omitir refresh_token en re-autorizaciones; solo preservamos el previo si pertenece al mismo usuario.
    const existingRaw = readSessionCookie(context.request)
    if (existingRaw) {
      const existing = await decryptCookiePayload(existingRaw, envCheck.cookieSecret)
      if (existing) {
        const sameUser =
          !email ||
          !existing.email ||
          email.toLowerCase() === existing.email.toLowerCase()
        if (sameUser) {
          refreshToken = existing.rt
          fallbackEmail = email || existing.email
        } else {
          clearExistingCookie = true
        }
      }
    }
  }

  const expiresIn = typeof tokenData.expires_in === 'number' ? tokenData.expires_in : 3600

  if (!refreshToken) {
    return jsonResponse(
      {
        access_token: tokenData.access_token,
        expires_in: expiresIn,
        email: fallbackEmail,
        persistent: false,
      },
      200,
      clearExistingCookie
        ? { 'Set-Cookie': buildClearCookieHeader(context.request.url) }
        : undefined,
    )
  }

  const encrypted = await encryptCookiePayload(
    {
      rt: refreshToken,
      email: fallbackEmail,
      iat: Date.now(),
    },
    envCheck.cookieSecret,
  )

  return jsonResponse(
    {
      access_token: tokenData.access_token,
      expires_in: expiresIn,
      email: fallbackEmail,
      persistent: true,
    },
    200,
    {
      'Set-Cookie': buildSessionSetCookieHeader(encrypted, context.request.url),
    },
  )
}
