const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

// Prefijo ASN.1 SPKI estándar para clave pública ECDSA P-256 (26 bytes) + 0x04 || X(32) || Y(32)
const P256_SPKI_PREFIX = new Uint8Array([
  0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86,
  0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a,
  0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03,
  0x42, 0x00,
])

export function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  if (!value) return null
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4)
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  } catch {
    return null
  }
}

export async function sha256(data: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const safeCopy = new Uint8Array(data)
  return new Uint8Array(await crypto.subtle.digest('SHA-256', safeCopy))
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a[i]! ^ b[i]!
  }
  return diff === 0
}

/** Convierte firma ECDSA P-256 ASN.1 DER (WebAuthn) a IEEE P1363 raw 64 bytes `(r || s)`. */
export function ecdsaDerToP1363(derSig: Uint8Array): Uint8Array<ArrayBuffer> | null {
  if (derSig.length < 8 || derSig[0] !== 0x30) return null
  let offset = 2
  if ((derSig[1]! & 0x80) !== 0) {
    const lenBytes = derSig[1]! & 0x7f
    if (lenBytes !== 1 || derSig.length < 10) return null
    offset = 3
  }
  if (derSig[offset] !== 0x02) return null
  const rLen = derSig[offset + 1]!
  const rStart = offset + 2
  const rEnd = rStart + rLen
  if (rLen === 0 || rEnd + 2 > derSig.length || derSig[rEnd] !== 0x02) return null
  const sLen = derSig[rEnd + 1]!
  const sStart = rEnd + 2
  const sEnd = sStart + sLen
  if (sLen === 0 || sEnd !== derSig.length) return null

  const copyCoord = (src: Uint8Array): Uint8Array | null => {
    let i = 0
    while (i < src.length - 1 && src[i] === 0) i++
    const trimmed = src.slice(i)
    if (trimmed.length > 32) return null
    const out = new Uint8Array(32)
    out.set(trimmed, 32 - trimmed.length)
    return out
  }

  const r = copyCoord(derSig.slice(rStart, rEnd))
  const s = copyCoord(derSig.slice(sStart, sEnd))
  if (!r || !s) return null

  const p1363 = new Uint8Array(64)
  p1363.set(r, 0)
  p1363.set(s, 32)
  return p1363
}

/** Parser CBOR mínimo suficiente para leer mapa COSE EC2 P-256 (`-2` = x, `-3` = y). */
function decodeCoseP256Coords(cbor: Uint8Array): { x: Uint8Array; y: Uint8Array } | null {
  let pos = 0
  const readHead = (): { major: number; val: number } | null => {
    if (pos >= cbor.length) return null
    const b = cbor[pos++]!
    const major = b >> 5
    const ai = b & 0x1f
    if (ai < 24) return { major, val: ai }
    if (ai === 24 && pos < cbor.length) return { major, val: cbor[pos++]! }
    if (ai === 25 && pos + 1 < cbor.length) {
      const v = (cbor[pos]! << 8) | cbor[pos + 1]!
      pos += 2
      return { major, val: v }
    }
    return null
  }

  const readItem = (): unknown => {
    const h = readHead()
    if (!h) return undefined
    if (h.major === 0) return h.val
    if (h.major === 1) return -1 - h.val
    if (h.major === 2 || h.major === 3) {
      if (pos + h.val > cbor.length) return undefined
      const slice = cbor.slice(pos, pos + h.val)
      pos += h.val
      return h.major === 2 ? slice : textDecoder.decode(slice)
    }
    if (h.major === 4) {
      const arr: unknown[] = []
      for (let i = 0; i < h.val; i++) {
        const item = readItem()
        if (item === undefined) return undefined
        arr.push(item)
      }
      return arr
    }
    if (h.major === 5) {
      const map = new Map<unknown, unknown>()
      for (let i = 0; i < h.val; i++) {
        const k = readItem()
        if (k === undefined) return undefined
        const v = readItem()
        if (v === undefined) return undefined
        map.set(k, v)
      }
      return map
    }
    return undefined
  }

  const parsed = readItem()
  if (!(parsed instanceof Map)) return null
  const kty = parsed.get(1)
  const alg = parsed.get(3)
  const crv = parsed.get(-1)
  const x = parsed.get(-2)
  const y = parsed.get(-3)
  if (
    kty !== 2 ||
    alg !== -7 ||
    crv !== 1 ||
    !(x instanceof Uint8Array) ||
    !(y instanceof Uint8Array) ||
    x.length !== 32 ||
    y.length !== 32
  ) {
    return null
  }
  return { x, y }
}

/** Extrae credentialId y clave pública SPKI P-256 desde `authenticatorData` de `navigator.credentials.create`. */
export function extractP256SpkiFromAuthData(authData: Uint8Array): {
  credentialId: Uint8Array<ArrayBuffer>
  publicKeySpki: Uint8Array<ArrayBuffer>
  alg: -7
} | null {
  if (authData.length < 55) return null
  const hasAttestedData = (authData[32]! & 0x40) !== 0
  if (!hasAttestedData) return null

  const credIdLen = (authData[53]! << 8) | authData[54]!
  const credStart = 55
  const credEnd = credStart + credIdLen
  if (credIdLen === 0 || credEnd >= authData.length) return null

  const credentialId = new Uint8Array(authData.slice(credStart, credEnd))
  const coords = decodeCoseP256Coords(authData.slice(credEnd))
  if (!coords) return null

  const spki = new Uint8Array(P256_SPKI_PREFIX.length + 65)
  spki.set(P256_SPKI_PREFIX, 0)
  spki[P256_SPKI_PREFIX.length] = 0x04
  spki.set(coords.x, P256_SPKI_PREFIX.length + 1)
  spki.set(coords.y, P256_SPKI_PREFIX.length + 33)

  return { credentialId, publicKeySpki: spki, alg: -7 }
}

export function parseAuthenticatorData(authData: Uint8Array): {
  rpIdHash: Uint8Array<ArrayBuffer>
  userPresent: boolean
  userVerified: boolean
  signCount: number
} | null {
  if (authData.length < 37) return null
  const flags = authData[32]!
  const view = new DataView(authData.buffer, authData.byteOffset, authData.byteLength)
  return {
    rpIdHash: new Uint8Array(authData.slice(0, 32)),
    userPresent: (flags & 0x01) !== 0,
    userVerified: (flags & 0x04) !== 0,
    signCount: view.getUint32(33, false),
  }
}

export interface VerifyAssertionInput {
  publicKeySpkiB64: string
  alg: number
  clientDataJSONB64: string
  authenticatorDataB64: string
  signatureB64: string
  expectedChallenge: string
  expectedOrigin: string
  expectedRpId: string
  previousSignCount?: number
}

export type VerifyAssertionResult =
  | { valid: true; signCount: number }
  | { valid: false; reason: string }

/** Verifica criptográficamente una aserción WebAuthn (`ES256` o `RS256`). */
export async function verifyWebAuthnAssertion(
  input: VerifyAssertionInput,
): Promise<VerifyAssertionResult> {
  const clientDataBytes = fromBase64Url(input.clientDataJSONB64)
  const authDataBytes = fromBase64Url(input.authenticatorDataB64)
  const signatureBytes = fromBase64Url(input.signatureB64)
  const spkiBytes = fromBase64Url(input.publicKeySpkiB64)

  if (!clientDataBytes || !authDataBytes || !signatureBytes || !spkiBytes) {
    return { valid: false, reason: 'malformed_payload' }
  }

  let clientData: { type?: string; challenge?: string; origin?: string }
  try {
    clientData = JSON.parse(textDecoder.decode(clientDataBytes)) as {
      type?: string
      challenge?: string
      origin?: string
    }
  } catch {
    return { valid: false, reason: 'invalid_client_data_json' }
  }

  if (clientData.type !== 'webauthn.get') {
    return { valid: false, reason: 'invalid_ceremony_type' }
  }
  if (clientData.challenge !== input.expectedChallenge) {
    return { valid: false, reason: 'challenge_mismatch' }
  }
  if (clientData.origin !== input.expectedOrigin) {
    return { valid: false, reason: 'origin_mismatch' }
  }

  const parsedAuth = parseAuthenticatorData(authDataBytes)
  if (!parsedAuth) {
    return { valid: false, reason: 'invalid_auth_data' }
  }

  const expectedRpIdHash = await sha256(textEncoder.encode(input.expectedRpId))
  if (!constantTimeEqual(parsedAuth.rpIdHash, expectedRpIdHash)) {
    return { valid: false, reason: 'rpid_mismatch' }
  }
  if (!parsedAuth.userPresent || !parsedAuth.userVerified) {
    return { valid: false, reason: 'user_verification_required' }
  }

  if (
    typeof input.previousSignCount === 'number' &&
    input.previousSignCount > 0 &&
    parsedAuth.signCount > 0 &&
    parsedAuth.signCount <= input.previousSignCount
  ) {
    return { valid: false, reason: 'cloned_authenticator_detected' }
  }

  const clientHash = await sha256(clientDataBytes)
  const signedPayload = new Uint8Array(authDataBytes.length + clientHash.length)
  signedPayload.set(authDataBytes, 0)
  signedPayload.set(clientHash, authDataBytes.length)

  try {
    if (input.alg === -7) {
      const p1363Sig = ecdsaDerToP1363(signatureBytes)
      if (!p1363Sig) return { valid: false, reason: 'invalid_ecdsa_signature_encoding' }
      const cryptoKey = await crypto.subtle.importKey(
        'spki',
        spkiBytes,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify'],
      )
      const ok = await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        cryptoKey,
        p1363Sig,
        signedPayload,
      )
      return ok ? { valid: true, signCount: parsedAuth.signCount } : { valid: false, reason: 'bad_signature' }
    }

    if (input.alg === -257) {
      const cryptoKey = await crypto.subtle.importKey(
        'spki',
        spkiBytes,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify'],
      )
      const ok = await crypto.subtle.verify(
        { name: 'RSASSA-PKCS1-v1_5' },
        cryptoKey,
        signatureBytes,
        signedPayload,
      )
      return ok ? { valid: true, signCount: parsedAuth.signCount } : { valid: false, reason: 'bad_signature' }
    }

    return { valid: false, reason: 'unsupported_algorithm' }
  } catch {
    return { valid: false, reason: 'verification_error' }
  }
}
