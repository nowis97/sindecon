import {
  extractP256SpkiFromAuthData,
  fromBase64Url,
  toBase64Url,
  verifyWebAuthnAssertion,
} from '../../shared/webauthnCrypto'
import { createFidoUser, type AuthUser, type StoredPasskey } from './auth'

const textEncoder = new TextEncoder()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isWebAuthnSupported(): boolean {
  return (
    typeof globalThis.navigator !== 'undefined' &&
    Boolean(globalThis.navigator.credentials) &&
    typeof globalThis.PublicKeyCredential !== 'undefined'
  )
}

function getDefaultRpId(): string {
  return typeof location !== 'undefined' && location.hostname ? location.hostname : 'localhost'
}

function getDefaultOrigin(): string {
  return typeof location !== 'undefined' && location.origin ? location.origin : 'https://localhost'
}

function mapWebAuthnError(err: unknown, mode: 'register' | 'authenticate'): string {
  if (err && typeof err === 'object' && 'name' in err) {
    const name = String((err as { name: unknown }).name)
    if (name === 'NotAllowedError') {
      return mode === 'register'
        ? 'Registro biométrico cancelado por el usuario o sin confirmación.'
        : 'Verificación biométrica cancelada por el usuario.'
    }
    if (name === 'InvalidStateError') {
      return 'Esta llave de seguridad FIDO ya estaba registrada en este dispositivo.'
    }
    if (name === 'SecurityError') {
      return 'WebAuthn requiere contexto seguro HTTPS o localhost.'
    }
  }
  return mode === 'register'
    ? 'No se pudo completar el registro de la llave biométrica.'
    : 'No se pudo completar la verificación biométrica FIDO.'
}

async function fetchChallengeOrLocal(
  isOnline: boolean,
  fetchFn: typeof fetch,
): Promise<{ challengeB64: string; challengeBytes: Uint8Array<ArrayBuffer>; isServerChallenge: boolean }> {
  if (isOnline) {
    try {
      const res = await fetchFn('/api/auth/fido/challenge', {
        method: 'POST',
        credentials: 'include',
      })
      if (res.ok) {
        const data: unknown = await res.json()
        if (isRecord(data) && typeof data.challenge === 'string' && data.challenge.length > 0) {
          const bytes = fromBase64Url(data.challenge)
          if (bytes) {
            return { challengeB64: data.challenge, challengeBytes: bytes, isServerChallenge: true }
          }
        }
      }
    } catch {
      // Sin red o Worker ausente: degradar limpiamente a challenge local.
    }
  }
  const challengeBytes = crypto.getRandomValues(new Uint8Array(32))
  return {
    challengeB64: toBase64Url(challengeBytes),
    challengeBytes,
    isServerChallenge: false,
  }
}

export interface RegisterPasskeyOptions {
  label?: string
  ownerEmail?: string | null
  ownerSub?: string | null
  displayName?: string | null
  rpId?: string
  isOnline?: boolean
  fetchFn?: typeof fetch
  credentialsApi?: CredentialsContainer
}

export type RegisterPasskeyResult =
  | { ok: true; passkey: StoredPasskey }
  | { ok: false; error: string }

type ExtendedAttestationResponse = AuthenticatorAttestationResponse & {
  getPublicKey?: () => ArrayBuffer | null
  getPublicKeyAlgorithm?: () => number
  getAuthenticatorData?: () => ArrayBuffer
}

export async function registerPasskey(opts: RegisterPasskeyOptions = {}): Promise<RegisterPasskeyResult> {
  const credentials = opts.credentialsApi ?? globalThis.navigator?.credentials
  if (!credentials) {
    return { ok: false, error: 'Tu navegador o dispositivo no soporta llaves biométricas FIDO2.' }
  }

  const rpId = opts.rpId || getDefaultRpId()
  const fetchFn = opts.fetchFn ?? fetch
  const isOnline = opts.isOnline ?? (typeof navigator !== 'undefined' ? navigator.onLine : true)
  const { challengeBytes, isServerChallenge } = await fetchChallengeOrLocal(isOnline, fetchFn)

  const userIdentifier = opts.ownerEmail || opts.ownerSub || 'sindecon-local-user'
  const userIdBytes = textEncoder.encode(userIdentifier)

  let credential: Credential | null
  try {
    credential = await credentials.create({
      publicKey: {
        challenge: challengeBytes,
        rp: { name: 'SINDECON', id: rpId },
        user: {
          id: userIdBytes,
          name: userIdentifier,
          displayName: opts.displayName || opts.ownerEmail || 'Médico SINDECON',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: {
          userVerification: 'required',
          residentKey: 'preferred',
        },
        attestation: 'none',
        timeout: 60_000,
      },
    })
  } catch (err) {
    return { ok: false, error: mapWebAuthnError(err, 'register') }
  }

  if (!credential || credential.type !== 'public-key') {
    return { ok: false, error: 'El navegador no devolvió una credencial FIDO2 válida.' }
  }

  const pkCred = credential as PublicKeyCredential
  const credentialId = pkCred.id || toBase64Url(new Uint8Array(pkCred.rawId))
  const attResp = pkCred.response as ExtendedAttestationResponse
  const clientDataJSONB64 = attResp.clientDataJSON
    ? toBase64Url(new Uint8Array(attResp.clientDataJSON))
    : ''

  let publicKeySpkiB64 = ''
  let alg = -7

  const directSpki = attResp.getPublicKey?.()
  if (directSpki) {
    publicKeySpkiB64 = toBase64Url(new Uint8Array(directSpki))
    alg = attResp.getPublicKeyAlgorithm?.() ?? -7
  } else {
    const authDataBuf = attResp.getAuthenticatorData?.()
    if (authDataBuf) {
      const extracted = extractP256SpkiFromAuthData(new Uint8Array(authDataBuf))
      if (extracted) {
        publicKeySpkiB64 = toBase64Url(extracted.publicKeySpki)
        alg = extracted.alg
      }
    }
  }

  if (!publicKeySpkiB64 || (alg !== -7 && alg !== -257)) {
    return { ok: false, error: 'El autenticador no expuso una clave pública compatible (ES256/RS256).' }
  }

  let sealedToken: string | undefined
  if (isOnline && isServerChallenge) {
    try {
      const enrollRes = await fetchFn('/api/auth/fido/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          credentialId,
          publicKeySpkiB64,
          alg,
          rpId,
          ownerEmail: opts.ownerEmail ?? undefined,
          clientDataJSONB64,
        }),
      })
      if (enrollRes.ok) {
        const data: unknown = await enrollRes.json()
        if (isRecord(data) && typeof data.sealedToken === 'string' && data.sealedToken.length > 0) {
          sealedToken = data.sealedToken
        }
      }
    } catch {
      sealedToken = undefined
    }
  }

  return {
    ok: true,
    passkey: {
      credentialId,
      publicKeySpkiB64,
      alg,
      rpId,
      label: opts.label?.trim() || 'Passkey Biométrica',
      signCount: 0,
      sealedToken,
      ownerEmail: opts.ownerEmail ?? undefined,
      createdAt: Date.now(),
    },
  }
}

export interface AuthenticatePasskeyOptions {
  rpId?: string
  origin?: string
  isOnline?: boolean
  displayName?: string
  fetchFn?: typeof fetch
  credentialsApi?: CredentialsContainer
}

export type AuthenticatePasskeyResult =
  | { ok: true; user: AuthUser; matchedCredentialId: string; nextSignCount: number; verifiedOffline: boolean }
  | { ok: false; error: string }

export async function authenticateWithPasskey(
  passkeys: StoredPasskey[],
  opts: AuthenticatePasskeyOptions = {},
): Promise<AuthenticatePasskeyResult> {
  if (passkeys.length === 0) {
    return { ok: false, error: 'No hay llaves FIDO registradas en este dispositivo.' }
  }

  const credentials = opts.credentialsApi ?? globalThis.navigator?.credentials
  if (!credentials) {
    return { ok: false, error: 'Tu navegador no soporta verificación biométrica FIDO2.' }
  }

  const rpId = opts.rpId || getDefaultRpId()
  const origin = opts.origin || getDefaultOrigin()
  const fetchFn = opts.fetchFn ?? fetch
  const isOnline = opts.isOnline ?? (typeof navigator !== 'undefined' ? navigator.onLine : true)

  const { challengeB64, challengeBytes, isServerChallenge } = await fetchChallengeOrLocal(isOnline, fetchFn)

  const allowCredentials: PublicKeyCredentialDescriptor[] = []
  for (const pk of passkeys) {
    const idBytes = fromBase64Url(pk.credentialId)
    if (idBytes) {
      allowCredentials.push({ id: idBytes, type: 'public-key' })
    }
  }
  if (allowCredentials.length === 0) {
    return { ok: false, error: 'Las llaves FIDO guardadas tienen formato inválido.' }
  }

  let assertionCred: Credential | null
  try {
    assertionCred = await credentials.get({
      publicKey: {
        challenge: challengeBytes,
        rpId,
        allowCredentials,
        userVerification: 'required',
        timeout: 60_000,
      },
    })
  } catch (err) {
    return { ok: false, error: mapWebAuthnError(err, 'authenticate') }
  }

  if (!assertionCred || assertionCred.type !== 'public-key') {
    return { ok: false, error: 'No se recibió una aserción biométrica válida.' }
  }

  const pkCred = assertionCred as PublicKeyCredential
  const matchedId = pkCred.id || toBase64Url(new Uint8Array(pkCred.rawId))
  const matched = passkeys.find((p) => p.credentialId === matchedId)
  if (!matched) {
    return { ok: false, error: 'La llave utilizada no coincide con las registradas en este dispositivo.' }
  }

  const assertion = pkCred.response as AuthenticatorAssertionResponse
  const clientDataJSONB64 = toBase64Url(new Uint8Array(assertion.clientDataJSON))
  const authenticatorDataB64 = toBase64Url(new Uint8Array(assertion.authenticatorData))
  const signatureB64 = toBase64Url(new Uint8Array(assertion.signature))

  if (isOnline && isServerChallenge && matched.sealedToken) {
    try {
      const verifyRes = await fetchFn('/api/auth/fido/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          credentialId: matched.credentialId,
          clientDataJSONB64,
          authenticatorDataB64,
          signatureB64,
          sealedToken: matched.sealedToken,
          previousSignCount: matched.signCount,
          displayName: opts.displayName || matched.label,
        }),
      })
      if (verifyRes.ok) {
        const data: unknown = await verifyRes.json()
        if (isRecord(data)) {
          if (data.verified === false) {
            return { ok: false, error: 'Verificación FIDO rechazada por el servidor.' }
          }
          return {
            ok: true,
            user: createFidoUser({
              id: matched.credentialId,
              name: opts.displayName || matched.label,
              email: matched.ownerEmail,
            }),
            matchedCredentialId: matched.credentialId,
            nextSignCount: typeof data.signCount === 'number' ? data.signCount : matched.signCount,
            verifiedOffline: false,
          }
        }
      }
      if (verifyRes.status === 401 || verifyRes.status === 403) {
        return { ok: false, error: 'Verificación FIDO rechazada por el servidor.' }
      }
    } catch {
      // Fallo de red transitorio: continuar con verificación criptográfica offline.
    }
  }

  const localCheck = await verifyWebAuthnAssertion({
    publicKeySpkiB64: matched.publicKeySpkiB64,
    alg: matched.alg,
    clientDataJSONB64,
    authenticatorDataB64,
    signatureB64,
    expectedChallenge: challengeB64,
    expectedOrigin: origin,
    expectedRpId: matched.rpId || rpId,
    previousSignCount: matched.signCount,
  })

  if (!localCheck.valid) {
    return {
      ok: false,
      error:
        localCheck.reason === 'cloned_authenticator_detected'
          ? 'Alerta de seguridad: contador de firma regresivo (posible llave clonada).'
          : 'Firma biométrica FIDO inválida.',
    }
  }

  return {
    ok: true,
    user: createFidoUser({
      id: matched.credentialId,
      name: opts.displayName || matched.label,
      email: matched.ownerEmail,
    }),
    matchedCredentialId: matched.credentialId,
    nextSignCount: localCheck.signCount,
    verifiedOffline: true,
  }
}
