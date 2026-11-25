import { verifyWebAuthnAssertion } from '../../../../shared/webauthnCrypto'
import {
  decryptSealedPayload,
  jsonResponse,
  readCookieByName,
  validateEnv,
  validateSameOriginPost,
  type CfPagesContext,
} from '../../oauth/_shared'
import { createAuthCookieHeader, type AuthSessionUser } from '../_session'
import {
  FIDO_CHALLENGE_COOKIE,
  buildClearChallengeCookie,
  isPlainObject,
  isValidChallengePayload,
} from './challenge'
import type { SealedFidoCredential } from './enroll'

function isValidSealedCredential(
  value: unknown,
  credentialId: string,
  expectedRpId: string,
): value is SealedFidoCredential {
  if (!isPlainObject(value)) return false
  return (
    typeof value.credentialId === 'string' &&
    value.credentialId.length > 0 &&
    value.credentialId === credentialId &&
    typeof value.publicKeySpkiB64 === 'string' &&
    value.publicKeySpkiB64.length > 0 &&
    typeof value.alg === 'number' &&
    value.rpId === expectedRpId
  )
}

/** Verifica firma FIDO2 contra token sellado y consume la cookie de challenge de un solo uso. */
export async function onRequest(context: CfPagesContext): Promise<Response> {
  const originError = validateSameOriginPost(context.request)
  if (originError) return originError

  const envCheck = validateEnv(context.env)
  if (!envCheck.ok) return envCheck.response

  const clearChallengeCookie = buildClearChallengeCookie(context.request.url)

  const reject = (error: string, status = 401) => {
    const res = jsonResponse({ verified: false, error }, status)
    res.headers.append('Set-Cookie', clearChallengeCookie)
    return res
  }

  let body: Record<string, unknown>
  try {
    const rawBody: unknown = await context.request.json()
    if (!isPlainObject(rawBody)) {
      return reject('invalid_json', 400)
    }
    body = rawBody
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

  if (typeof body.sealedToken !== 'string' || !body.sealedToken) {
    return reject('missing_sealed_token')
  }
  const credentialId = typeof body.credentialId === 'string' ? body.credentialId.trim() : ''
  const credentialRaw = await decryptSealedPayload<unknown>(
    body.sealedToken,
    envCheck.cookieSecret,
  )
  if (!isValidSealedCredential(credentialRaw, credentialId, expectedRpId)) {
    return reject('invalid_credential_token')
  }

  const assertionRes = await verifyWebAuthnAssertion({
    publicKeySpkiB64: credentialRaw.publicKeySpkiB64,
    alg: credentialRaw.alg,
    clientDataJSONB64: typeof body.clientDataJSONB64 === 'string' ? body.clientDataJSONB64 : '',
    authenticatorDataB64:
      typeof body.authenticatorDataB64 === 'string' ? body.authenticatorDataB64 : '',
    signatureB64: typeof body.signatureB64 === 'string' ? body.signatureB64 : '',
    expectedChallenge: challengeRaw.challenge,
    expectedOrigin,
    expectedRpId,
    previousSignCount:
      typeof body.previousSignCount === 'number' ? body.previousSignCount : undefined,
  })

  if (!assertionRes.valid) {
    return reject(assertionRes.reason)
  }

  const ownerEmail =
    typeof credentialRaw.ownerEmail === 'string' && credentialRaw.ownerEmail.trim()
      ? credentialRaw.ownerEmail.trim()
      : undefined
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : ''

  const user: AuthSessionUser = {
    sub: credentialRaw.credentialId,
    email: ownerEmail || 'fido@local',
    name: displayName || (ownerEmail ? ownerEmail.split('@')[0]! : 'Médico (FIDO)'),
    method: 'fido',
  }

  const authCookie = await createAuthCookieHeader(user, envCheck.cookieSecret, context.request.url)
  const headers = new Headers()
  headers.append('Set-Cookie', clearChallengeCookie)
  headers.append('Set-Cookie', authCookie)
  return jsonResponse({ verified: true, signCount: assertionRes.signCount, user }, 200, headers)
}
