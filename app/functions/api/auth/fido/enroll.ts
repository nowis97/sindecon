import { fromBase64Url } from '../../../../shared/webauthnCrypto'
import {
  encryptSealedPayload,
  jsonResponse,
  validateEnv,
  validateSameOriginPost,
  type CfPagesContext,
} from '../../oauth/_shared'
import { isPlainObject } from './challenge'

export interface SealedFidoCredential {
  credentialId: string
  publicKeySpkiB64: string
  alg: number
  rpId: string
  ownerEmail?: string
  enrolledAt: number
}

/** Valida una clave pública WebAuthn SPKI (P-256 o RSA) y devuelve un token sellado con AES-256-GCM. */
export async function onRequest(context: CfPagesContext): Promise<Response> {
  const originError = validateSameOriginPost(context.request)
  if (originError) return originError

  const envCheck = validateEnv(context.env)
  if (!envCheck.ok) return envCheck.response

  let rawBody: unknown
  try {
    rawBody = await context.request.json()
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400)
  }
  if (!isPlainObject(rawBody)) {
    return jsonResponse({ error: 'invalid_json' }, 400)
  }

  const expectedRpId = new URL(context.request.url).hostname
  const credentialId = typeof rawBody.credentialId === 'string' ? rawBody.credentialId.trim() : ''
  const publicKeySpkiB64 =
    typeof rawBody.publicKeySpkiB64 === 'string' ? rawBody.publicKeySpkiB64.trim() : ''
  const alg = typeof rawBody.alg === 'number' ? rawBody.alg : -7
  const rpId = typeof rawBody.rpId === 'string' ? rawBody.rpId.trim() : expectedRpId
  const rawEmail = typeof rawBody.ownerEmail === 'string' ? rawBody.ownerEmail.trim() : ''
  const ownerEmail = rawEmail || undefined

  if (!credentialId || !publicKeySpkiB64 || rpId !== expectedRpId || (alg !== -7 && alg !== -257)) {
    return jsonResponse({ error: 'invalid_fido_enrollment' }, 400)
  }

  const spkiBytes = fromBase64Url(publicKeySpkiB64)
  if (!spkiBytes) return jsonResponse({ error: 'invalid_public_key' }, 400)

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
    return jsonResponse({ error: 'invalid_public_key' }, 400)
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

  return jsonResponse({ sealedToken }, 200)
}
