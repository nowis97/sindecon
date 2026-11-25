import { describe, it, expect } from 'vitest'
import {
  toBase64Url,
  fromBase64Url,
  constantTimeEqual,
  verifyWebAuthnAssertion,
  extractP256SpkiFromAuthData,
} from './webauthnCrypto'

const enc = new TextEncoder()

function p1363ToDer(sig: Uint8Array): Uint8Array<ArrayBuffer> {
  const toAsn1Int = (slice: Uint8Array): Uint8Array => {
    let i = 0
    while (i < slice.length - 1 && slice[i] === 0) i++
    let trimmed = slice.slice(i)
    if (trimmed[0]! >= 0x80) {
      const padded = new Uint8Array(trimmed.length + 1)
      padded.set(trimmed, 1)
      trimmed = padded
    }
    const out = new Uint8Array(2 + trimmed.length)
    out[0] = 0x02
    out[1] = trimmed.length
    out.set(trimmed, 2)
    return out
  }
  const r = toAsn1Int(sig.slice(0, 32))
  const s = toAsn1Int(sig.slice(32, 64))
  const totalLen = r.length + s.length
  const der = new Uint8Array(2 + totalLen)
  der[0] = 0x30
  der[1] = totalLen
  der.set(r, 2)
  der.set(s, 2 + r.length)
  return der
}

async function buildSignedAssertion(opts?: {
  alg?: -7 | -257
  type?: string
  challenge?: string
  origin?: string
  rpId?: string
  flags?: number
  signCount?: number
  tamperSig?: boolean
}) {
  const alg = opts?.alg ?? -7
  const keyPair =
    alg === -257
      ? await crypto.subtle.generateKey(
          {
            name: 'RSASSA-PKCS1-v1_5',
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: 'SHA-256',
          },
          true,
          ['sign', 'verify'],
        )
      : await crypto.subtle.generateKey(
          { name: 'ECDSA', namedCurve: 'P-256' },
          true,
          ['sign', 'verify'],
        )
  const spkiBuf = await crypto.subtle.exportKey('spki', keyPair.publicKey)
  const spkiB64 = toBase64Url(new Uint8Array(spkiBuf))

  const expectedChallenge = opts?.challenge ?? 'test-challenge-b64url'
  const expectedOrigin = opts?.origin ?? 'https://sindecon.pages.dev'
  const expectedRpId = opts?.rpId ?? 'sindecon.pages.dev'

  const clientDataBytes = enc.encode(
    JSON.stringify({
      type: opts?.type ?? 'webauthn.get',
      challenge: expectedChallenge,
      origin: expectedOrigin,
    }),
  )
  const clientDataHash = new Uint8Array(await crypto.subtle.digest('SHA-256', clientDataBytes))

  const rpIdHash = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(expectedRpId)))
  const authData = new Uint8Array(37)
  authData.set(rpIdHash, 0)
  authData[32] = opts?.flags ?? 0x05 // UP (0x01) + UV (0x04)
  new DataView(authData.buffer).setUint32(33, opts?.signCount ?? 7, false)

  const signedPayload = new Uint8Array(authData.length + clientDataHash.length)
  signedPayload.set(authData, 0)
  signedPayload.set(clientDataHash, authData.length)

  const sigBytes =
    alg === -257
      ? new Uint8Array(
          await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, keyPair.privateKey, signedPayload),
        )
      : p1363ToDer(
          new Uint8Array(
            await crypto.subtle.sign(
              { name: 'ECDSA', hash: 'SHA-256' },
              keyPair.privateKey,
              signedPayload,
            ),
          ),
        )
  if (opts?.tamperSig) {
    sigBytes[sigBytes.length - 1] ^= 0xff
  }

  return {
    publicKeySpkiB64: spkiB64,
    clientDataJSONB64: toBase64Url(clientDataBytes),
    authenticatorDataB64: toBase64Url(authData),
    signatureB64: toBase64Url(sigBytes),
  }
}

describe('webauthnCrypto', () => {
  it('hace roundtrip de base64url correctamente', () => {
    const src = new Uint8Array([0, 1, 255, 128, 63, 62])
    const encoded = toBase64Url(src)
    expect(encoded).not.toMatch(/[+/=]/)
    expect(Array.from(fromBase64Url(encoded)!)).toEqual(Array.from(src))
  })

  it('verifica una aserción WebAuthn ES256 válida (DER -> P1363)', async () => {
    const signed = await buildSignedAssertion()
    const res = await verifyWebAuthnAssertion({
      ...signed,
      alg: -7,
      expectedChallenge: 'test-challenge-b64url',
      expectedOrigin: 'https://sindecon.pages.dev',
      expectedRpId: 'sindecon.pages.dev',
      previousSignCount: 3,
    })
    expect(res).toEqual({ valid: true, signCount: 7 })
  })

  it('rechaza firma alterada, challenge distinto, UV=0 o signCount regresivo', async () => {
    const tampered = await buildSignedAssertion({ tamperSig: true })
    expect(
      (
        await verifyWebAuthnAssertion({
          ...tampered,
          alg: -7,
          expectedChallenge: 'test-challenge-b64url',
          expectedOrigin: 'https://sindecon.pages.dev',
          expectedRpId: 'sindecon.pages.dev',
        })
      ).valid,
    ).toBe(false)

    const validSigned = await buildSignedAssertion({ signCount: 5 })
    expect(
      (
        await verifyWebAuthnAssertion({
          ...validSigned,
          alg: -7,
          expectedChallenge: 'otro-challenge',
          expectedOrigin: 'https://sindecon.pages.dev',
          expectedRpId: 'sindecon.pages.dev',
        })
      ).valid,
    ).toBe(false)

    const noUv = await buildSignedAssertion({ flags: 0x01 }) // sin UV (0x04)
    expect(
      (
        await verifyWebAuthnAssertion({
          ...noUv,
          alg: -7,
          expectedChallenge: 'test-challenge-b64url',
          expectedOrigin: 'https://sindecon.pages.dev',
          expectedRpId: 'sindecon.pages.dev',
        })
      ).valid,
    ).toBe(false)

    const cloned = await buildSignedAssertion({ signCount: 4 })
    expect(
      (
        await verifyWebAuthnAssertion({
          ...cloned,
          alg: -7,
          expectedChallenge: 'test-challenge-b64url',
          expectedOrigin: 'https://sindecon.pages.dev',
          expectedRpId: 'sindecon.pages.dev',
          previousSignCount: 5,
        })
      ).valid,
    ).toBe(false)
  })

  it('extrae clave pública SPKI P-256 desde authenticatorData con credencial COSE (fallback CBOR)', () => {
    // Construir authenticatorData mínimo con bandera AT (0x40), credIdLen=4 e inline COSE map P-256
    const x = new Uint8Array(32).fill(0x11)
    const y = new Uint8Array(32).fill(0x22)
    // CBOR map(5): { 1: 2, 3: -7, -1: 1, -2: bstr(32), -3: bstr(32) }
    const cose = new Uint8Array([
      0xa5,
      0x01, 0x02,
      0x03, 0x26,
      0x20, 0x01,
      0x21, 0x58, 0x20, ...x,
      0x22, 0x58, 0x20, ...y,
    ])
    const authData = new Uint8Array(37 + 16 + 2 + 4 + cose.length)
    authData[32] = 0x45 // UP + UV + AT
    authData[37 + 16] = 0x00
    authData[37 + 17] = 0x04
    authData.set([1, 2, 3, 4], 37 + 18)
    authData.set(cose, 37 + 22)

    const extracted = extractP256SpkiFromAuthData(authData)
    expect(extracted).not.toBeNull()
    expect(Array.from(extracted!.credentialId)).toEqual([1, 2, 3, 4])
    expect(extracted!.alg).toBe(-7)
    // Header SPKI P-256 estándar mide 26 bytes + 65 bytes uncompressed point (0x04 || x || y) = 91 bytes
    expect(extracted!.publicKeySpki.length).toBe(91)
    expect(extracted!.publicKeySpki[26]).toBe(0x04)
  })

  it('rechaza clientDataJSON cuando JSON.parse devuelve null, array o primitivo sin lanzar excepción', async () => {
    const signed = await buildSignedAssertion()
    for (const rawJson of ['null', '123', '"texto"', '[]']) {
      const res = await verifyWebAuthnAssertion({
        ...signed,
        clientDataJSONB64: toBase64Url(enc.encode(rawJson)),
        alg: -7,
        expectedChallenge: 'test-challenge-b64url',
        expectedOrigin: 'https://sindecon.pages.dev',
        expectedRpId: 'sindecon.pages.dev',
      })
      expect(res).toEqual({ valid: false, reason: 'invalid_client_data_json' })
    }
  })

  it('verifica una aserción WebAuthn RS256 (alg: -257) válida y rechaza firma alterada', async () => {
    const signed = await buildSignedAssertion({ alg: -257, signCount: 9 })
    const res = await verifyWebAuthnAssertion({
      ...signed,
      alg: -257,
      expectedChallenge: 'test-challenge-b64url',
      expectedOrigin: 'https://sindecon.pages.dev',
      expectedRpId: 'sindecon.pages.dev',
      previousSignCount: 4,
    })
    expect(res).toEqual({ valid: true, signCount: 9 })

    const tampered = await buildSignedAssertion({ alg: -257, tamperSig: true })
    expect(
      await verifyWebAuthnAssertion({
        ...tampered,
        alg: -257,
        expectedChallenge: 'test-challenge-b64url',
        expectedOrigin: 'https://sindecon.pages.dev',
        expectedRpId: 'sindecon.pages.dev',
      }),
    ).toEqual({ valid: false, reason: 'bad_signature' })
  })

  it('rechaza origin_mismatch, rpid_mismatch, invalid_ceremony_type y UP=0', async () => {
    const valid = await buildSignedAssertion()

    expect(
      await verifyWebAuthnAssertion({
        ...valid,
        alg: -7,
        expectedChallenge: 'test-challenge-b64url',
        expectedOrigin: 'https://evil.example',
        expectedRpId: 'sindecon.pages.dev',
      }),
    ).toEqual({ valid: false, reason: 'origin_mismatch' })

    expect(
      await verifyWebAuthnAssertion({
        ...valid,
        alg: -7,
        expectedChallenge: 'test-challenge-b64url',
        expectedOrigin: 'https://sindecon.pages.dev',
        expectedRpId: 'evil.example',
      }),
    ).toEqual({ valid: false, reason: 'rpid_mismatch' })

    const wrongType = await buildSignedAssertion({ type: 'webauthn.create' })
    expect(
      await verifyWebAuthnAssertion({
        ...wrongType,
        alg: -7,
        expectedChallenge: 'test-challenge-b64url',
        expectedOrigin: 'https://sindecon.pages.dev',
        expectedRpId: 'sindecon.pages.dev',
      }),
    ).toEqual({ valid: false, reason: 'invalid_ceremony_type' })

    const noUp = await buildSignedAssertion({ flags: 0x04 }) // UV=1 pero UP=0
    expect(
      await verifyWebAuthnAssertion({
        ...noUp,
        alg: -7,
        expectedChallenge: 'test-challenge-b64url',
        expectedOrigin: 'https://sindecon.pages.dev',
        expectedRpId: 'sindecon.pages.dev',
      }),
    ).toEqual({ valid: false, reason: 'user_verification_required' })
  })

  it('detecta caída de signCount a 0 cuando previousSignCount > 0 (W3C §7.2 paso 21) y permite 0->0', async () => {
    const zeroCounter = await buildSignedAssertion({ signCount: 0 })
    expect(
      await verifyWebAuthnAssertion({
        ...zeroCounter,
        alg: -7,
        expectedChallenge: 'test-challenge-b64url',
        expectedOrigin: 'https://sindecon.pages.dev',
        expectedRpId: 'sindecon.pages.dev',
        previousSignCount: 5,
      }),
    ).toEqual({ valid: false, reason: 'cloned_authenticator_detected' })

    expect(
      await verifyWebAuthnAssertion({
        ...zeroCounter,
        alg: -7,
        expectedChallenge: 'test-challenge-b64url',
        expectedOrigin: 'https://sindecon.pages.dev',
        expectedRpId: 'sindecon.pages.dev',
        previousSignCount: 0,
      }),
    ).toEqual({ valid: true, signCount: 0 })
  })

  it('exporta constantTimeEqual para comparación en tiempo constante', () => {
    expect(constantTimeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true)
    expect(constantTimeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false)
    expect(constantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3]))).toBe(false)
  })
})
