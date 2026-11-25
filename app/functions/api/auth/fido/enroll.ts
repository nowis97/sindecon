import { fromBase64Url, validateClientDataJSON } from '../../../../shared/webauthnCrypto'
import {
  decryptSealedPayload,
  encryptSealedPayload,
  jsonResponse,
  readCookieByName,
  validateEnv,
  validateSameOriginPost,
  type CfPagesContext,
} from '../../oauth/_shared'
import {
  FIDO_CHALLENGE_COOKIE,
  buildClearChallengeCookie,
  isPlainObject,
  isValidChallengePayload,
} from './challenge'

export interface SealedFidoCredential {
  credentialId: string
  publicKeySpkiB64: string
  alg: number
  rpId: string
  ownerEmail?: string
  enrolledAt: number
}

/** Valida challenge + clientDataJSON + clave pública WebAuthn SPKI (P-256 o RSA) y devuelve token sellado. */
export async function onRequest(context: CfPagesContext): Promise<Response> {
  const originError = validateSameOriginPost(context.request)
  if (originError) return originError

  const envCheck = validateEnv(context.env)
  if (!envCheck.ok) return envCheck.response

  const clearChallengeCookie = buildClearChallengeCookie(context.request.url)

  const reject = (error: string, status = 401) => {
    const res = jsonResponse({ error }, status)
    res.headers.append('Set-Cookie', clearChallengeCookie)
    return res
  }

  let rawBody: Record<string, unknown>
  try {
    const parsed: unknown = await context.request.json()
    if (!isPlainObject(parsed)) {
      return reject('invalid_json', 400)
    }
    rawBody = parsed
  } catch {
    return reject('invalid_json', 400)
  }

  const rawChallengeCookie = readCookieByName(context.request, FIDO_CHALLENGE_COOKIE)
  if (!rawChallengeCookie) return reject('challenge_missing')

  const requestUrl = new URL(context.request.url)
  const expectedOrigin = requestUrl.origin
  const expectedRpId = requestUrl.hostname

  const challengeRaw = await decryptSealedPayload<unknown>(
    rawChallengeCookie,
    envCheck.cookieSecret,
  )
  if (!isValidChallengePayload(challengeRaw, expectedOrigin)) {
    return reject('challenge_expired')
  }

  const clientDataJSONB64 =
    typeof rawBody.clientDataJSONB64 === 'string' ? rawBody.clientDataJSONB64.trim() : ''
  if (!clientDataJSONB64) {
    return reject('missing_client_data')
  }

  const clientCheck = validateClientDataJSON({
    clientDataJSONB64,
    expectedType: 'webauthn.create',
    expectedChallenge: challengeRaw.challenge,
    expectedOrigin: challengeRaw.origin,
  })
  if (!clientCheck.valid) {
    return reject(clientCheck.reason)
  }

  const credentialId = typeof rawBody.credentialId === 'string' ? rawBody.credentialId.trim() : ''
  const publicKeySpkiB64 =
    typeof rawBody.publicKeySpkiB64 === 'string' ? rawBody.publicKeySpkiB64.trim() : ''
  const alg = rawBody.alg === undefined ? -7 : typeof rawBody.alg === 'number' ? rawBody.alg : NaN
  const rpId =
    rawBody.rpId === undefined
      ? expectedRpId
      : typeof rawBody.rpId === 'string'
        ? rawBody.rpId.trim()
        : ''
  const rawEmail = typeof rawBody.ownerEmail === 'string' ? rawBody.ownerEmail.trim() : ''
  const ownerEmail = rawEmail || undefined

  if (!credentialId || !publicKeySpkiB64 || rpId !== expectedRpId || (alg !== -7 && alg !== -257)) {
    return reject('invalid_fido_enrollment', 400)
  }

  const spkiBytes = fromBase64Url(publicKeySpkiB64)
  if (!spkiBytes) return reject('invalid_public_key', 400)

  try {
    await crypto.subtle.importKey(
      'spki',
      spkiBytes,
      alg === -7
        ? { name: 'ECDSA', namedCurve: 'P-256' }
        : { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    )
  } catch {
    return reject('invalid_public_key', 400)
  }

  const sealedToken = await encryptSealedPayload<SealedFidoCredential>(
    {
      credentialId,
      publicKeySpkiB64,
      alg,
      rpId,
      ownerEmail,
      enrolledAt: Date.now(),
    },
    envCheck.cookieSecret,
  )

  return jsonResponse({ sealedToken }, 200, {
    'Set-Cookie': clearChallengeCookie,
  })
}
