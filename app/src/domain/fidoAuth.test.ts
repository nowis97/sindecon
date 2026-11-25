import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { toBase64Url } from '../../shared/webauthnCrypto'
import type { StoredPasskey } from './auth'
import { isWebAuthnSupported, registerPasskey, authenticateWithPasskey } from './fidoAuth'

const enc = new TextEncoder()

function p1363ToDer(sig: Uint8Array): Uint8Array<ArrayBuffer> {
  const intPart = (slice: Uint8Array) => {
    let i = 0
    while (i < slice.length - 1 && slice[i] === 0) i++
    let b = slice.slice(i)
    if (b[0]! >= 0x80) {
      const p = new Uint8Array(b.length + 1)
      p.set(b, 1)
      b = p
    }
    const out = new Uint8Array(2 + b.length)
    out[0] = 0x02
    out[1] = b.length
    out.set(b, 2)
    return out
  }
  const r = intPart(sig.slice(0, 32))
  const s = intPart(sig.slice(32, 64))
  const der = new Uint8Array(2 + r.length + s.length)
  der[0] = 0x30
  der[1] = r.length + s.length
  der.set(r, 2)
  der.set(s, 2 + r.length)
  return der
}

async function buildFakeAuthenticatorAssertion(
  keyPair: CryptoKeyPair,
  opts: { challenge: Uint8Array; origin: string; rpId: string; signCount: number },
) {
  const challengeB64 = toBase64Url(opts.challenge)
  const clientDataJSON = enc.encode(
    JSON.stringify({ type: 'webauthn.get', challenge: challengeB64, origin: opts.origin }),
  )
  const clientHash = new Uint8Array(await crypto.subtle.digest('SHA-256', clientDataJSON))
  const rpHash = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(opts.rpId)))

  const authData = new Uint8Array(37)
  authData.set(rpHash, 0)
  authData[32] = 0x05 // UP + UV
  new DataView(authData.buffer).setUint32(33, opts.signCount, false)

  const signed = new Uint8Array(authData.length + clientHash.length)
  signed.set(authData, 0)
  signed.set(clientHash, authData.length)

  const rawSig = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keyPair.privateKey, signed),
  )
  const signature = p1363ToDer(rawSig)

  return {
    clientDataJSON: clientDataJSON.buffer,
    authenticatorData: authData.buffer,
    signature: signature.buffer,
  }
}

async function buildAttestedAuthDataP256(
  publicKey: CryptoKey,
  credIdBytes: Uint8Array,
  rpId: string,
): Promise<ArrayBuffer> {
  const rawPub = new Uint8Array(await crypto.subtle.exportKey('raw', publicKey))
  const x = rawPub.slice(1, 33)
  const y = rawPub.slice(33, 65)
  const rpHash = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(rpId)))

  // COSE EC2 P-256 map: {1: 2, 3: -7, -1: 1, -2: x, -3: y}
  const coseKey = new Uint8Array([
    0xa5,
    0x01, 0x02,
    0x03, 0x26,
    0x20, 0x01,
    0x21, 0x58, 0x20, ...x,
    0x22, 0x58, 0x20, ...y,
  ])

  const authData = new Uint8Array(37 + 16 + 2 + credIdBytes.length + coseKey.length)
  authData.set(rpHash, 0)
  authData[32] = 0x45 // UP + UV + AT
  // bytes 33..36 signCount=0, bytes 37..52 aaguid=0
  authData[53] = (credIdBytes.length >> 8) & 0xff
  authData[54] = credIdBytes.length & 0xff
  authData.set(credIdBytes, 55)
  authData.set(coseKey, 55 + credIdBytes.length)
  return authData.buffer
}

describe('fidoAuth (WebAuthn online + offline)', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('isWebAuthnSupported retorna false sin navigator.credentials y true cuando existe PublicKeyCredential', () => {
    expect(isWebAuthnSupported()).toBe(false)
    vi.stubGlobal('navigator', { credentials: { create: vi.fn(), get: vi.fn() } })
    vi.stubGlobal('PublicKeyCredential', function PublicKeyCredential() {})
    expect(isWebAuthnSupported()).toBe(true)
  })

  it('registra passkey obteniendo publicKey SPKI y sealedToken con clientDataJSONB64 cuando el servidor responde', async () => {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    )
    const spkiBuf = await crypto.subtle.exportKey('spki', keyPair.publicKey)
    const rawId = new Uint8Array([10, 20, 30, 40]).buffer
    const credId = toBase64Url(new Uint8Array(rawId))
    const serverChallenge = toBase64Url(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))
    const clientDataBuf = enc.encode(
      JSON.stringify({
        type: 'webauthn.create',
        challenge: serverChallenge,
        origin: 'https://sindecon.pages.dev',
      }),
    ).buffer

    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ challenge: serverChallenge }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ sealedToken: 'sealed.tok' }), { status: 200 }))

    const mockCredentials = {
      create: vi.fn(async () => ({
        id: credId,
        rawId,
        type: 'public-key',
        response: {
          clientDataJSON: clientDataBuf,
          getPublicKey: () => spkiBuf,
          getPublicKeyAlgorithm: () => -7,
        },
      })),
      get: vi.fn(),
    } as unknown as CredentialsContainer

    const res = await registerPasskey({
      label: 'Huella PC',
      ownerEmail: 'doc@hospital.cl',
      rpId: 'sindecon.pages.dev',
      isOnline: true,
      fetchFn: fetchMock,
      credentialsApi: mockCredentials,
    })

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.passkey.credentialId).toBe(credId)
    expect(res.passkey.sealedToken).toBe('sealed.tok')
    expect(res.passkey.alg).toBe(-7)
    expect(res.passkey.publicKeySpkiB64).toBe(toBase64Url(new Uint8Array(spkiBuf)))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/auth/fido/challenge')
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/auth/fido/enroll')
    const enrollBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as Record<string, unknown>
    expect(enrollBody.clientDataJSONB64).toBe(toBase64Url(new Uint8Array(clientDataBuf)))
    expect(enrollBody.credentialId).toBe(credId)
    expect(enrollBody.rpId).toBe('sindecon.pages.dev')
  })

  it('degrada registerPasskey con sealedToken undefined ante 404, 405 o error de red', async () => {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    )
    const spkiBuf = await crypto.subtle.exportKey('spki', keyPair.publicKey)
    const rawId = new Uint8Array([5, 6, 7, 8]).buffer
    const credId = toBase64Url(new Uint8Array(rawId))
    const clientDataBuf = enc.encode(
      JSON.stringify({
        type: 'webauthn.create',
        challenge: 'srv-ch-fallback',
        origin: 'https://sindecon.pages.dev',
      }),
    ).buffer
    const mockCredentials = {
      create: vi.fn(async () => ({
        id: credId,
        rawId,
        type: 'public-key',
        response: {
          clientDataJSON: clientDataBuf,
          getPublicKey: () => spkiBuf,
          getPublicKeyAlgorithm: () => -7,
        },
      })),
      get: vi.fn(),
    } as unknown as CredentialsContainer

    // Caso 404 en /challenge -> no llama a /enroll y conserva passkey local
    fetchMock.mockResolvedValueOnce(new Response('Not found', { status: 404 }))
    const res404 = await registerPasskey({
      rpId: 'sindecon.pages.dev',
      isOnline: true,
      fetchFn: fetchMock,
      credentialsApi: mockCredentials,
    })
    expect(res404.ok).toBe(true)
    if (res404.ok) expect(res404.passkey.sealedToken).toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // Caso 405 en /enroll tras challenge 200 -> conserva passkey local sin sealedToken
    fetchMock.mockReset()
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ challenge: 'c2h' }), { status: 200 }))
      .mockResolvedValueOnce(new Response('Method Not Allowed', { status: 405 }))
    const res405 = await registerPasskey({
      rpId: 'sindecon.pages.dev',
      isOnline: true,
      fetchFn: fetchMock,
      credentialsApi: mockCredentials,
    })
    expect(res405.ok).toBe(true)
    if (res405.ok) expect(res405.passkey.sealedToken).toBeUndefined()

    // Caso error de red -> conserva passkey local sin sealedToken
    fetchMock.mockReset()
    fetchMock.mockRejectedValueOnce(new Error('network down'))
    const resNet = await registerPasskey({
      rpId: 'sindecon.pages.dev',
      isOnline: true,
      fetchFn: fetchMock,
      credentialsApi: mockCredentials,
    })
    expect(resNet.ok).toBe(true)
    if (resNet.ok) expect(resNet.passkey.sealedToken).toBeUndefined()
  })

  it('registra passkey usando extractP256SpkiFromAuthData como fallback cuando getPublicKey() no está disponible', async () => {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    )
    const expectedSpkiB64 = toBase64Url(
      new Uint8Array(await crypto.subtle.exportKey('spki', keyPair.publicKey)),
    )
    const rawIdBytes = new Uint8Array([11, 22, 33, 44])
    const credId = toBase64Url(rawIdBytes)
    const authDataBuf = await buildAttestedAuthDataP256(
      keyPair.publicKey,
      rawIdBytes,
      'sindecon.pages.dev',
    )

    const mockCredentials = {
      create: vi.fn(async () => ({
        id: credId,
        rawId: rawIdBytes.buffer,
        type: 'public-key',
        response: {
          getPublicKey: () => null,
          getAuthenticatorData: () => authDataBuf,
        },
      })),
      get: vi.fn(),
    } as unknown as CredentialsContainer

    const res = await registerPasskey({
      label: 'Safari iOS',
      rpId: 'sindecon.pages.dev',
      isOnline: false,
      fetchFn: fetchMock,
      credentialsApi: mockCredentials,
    })

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.passkey.credentialId).toBe(credId)
    expect(res.passkey.alg).toBe(-7)
    expect(res.passkey.publicKeySpkiB64).toBe(expectedSpkiB64)
  })

  it('verifica aserción en modo online contra /api/auth/fido/challenge y /api/auth/fido/verify', async () => {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    )
    const spkiB64 = toBase64Url(
      new Uint8Array(await crypto.subtle.exportKey('spki', keyPair.publicKey)),
    )
    const serverChallengeBytes = crypto.getRandomValues(new Uint8Array(32))
    const serverChallengeB64 = toBase64Url(serverChallengeBytes)
    const credId = 'cred-online-01'
    const passkey: StoredPasskey = {
      credentialId: credId,
      publicKeySpkiB64: spkiB64,
      alg: -7,
      rpId: 'sindecon.pages.dev',
      label: 'YubiKey Clínica',
      signCount: 3,
      sealedToken: 'sealed.server.tok',
      ownerEmail: 'medico@sindecon.cl',
      createdAt: Date.now(),
    }

    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ challenge: serverChallengeB64 }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ verified: true, signCount: 4 }), { status: 200 }),
      )

    const mockCredentials = {
      create: vi.fn(),
      get: vi.fn(async (opts?: CredentialRequestOptions) => {
        const challenge = new Uint8Array(
          (opts?.publicKey?.challenge as ArrayBuffer) || new ArrayBuffer(0),
        )
        const assertion = await buildFakeAuthenticatorAssertion(keyPair, {
          challenge,
          origin: 'https://sindecon.pages.dev',
          rpId: 'sindecon.pages.dev',
          signCount: 4,
        })
        return { id: credId, rawId: new Uint8Array([1]).buffer, type: 'public-key', response: assertion }
      }),
    } as unknown as CredentialsContainer

    const res = await authenticateWithPasskey([passkey], {
      rpId: 'sindecon.pages.dev',
      origin: 'https://sindecon.pages.dev',
      isOnline: true,
      fetchFn: fetchMock,
      credentialsApi: mockCredentials,
    })

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.verifiedOffline).toBe(false)
    expect(res.nextSignCount).toBe(4)
    expect(res.user.method).toBe('fido')
    expect(res.user.email).toBe('medico@sindecon.cl')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/auth/fido/challenge')
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/auth/fido/verify')
  })

  it('no degrada a verificación offline cuando /api/auth/fido/verify responde 401 o 403', async () => {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    )
    const spkiB64 = toBase64Url(
      new Uint8Array(await crypto.subtle.exportKey('spki', keyPair.publicKey)),
    )
    const serverChallengeB64 = toBase64Url(crypto.getRandomValues(new Uint8Array(32)))
    const credId = 'cred-online-reject'
    const passkey: StoredPasskey = {
      credentialId: credId,
      publicKeySpkiB64: spkiB64,
      alg: -7,
      rpId: 'sindecon.pages.dev',
      label: 'YubiKey',
      signCount: 1,
      sealedToken: 'sealed.bad',
      createdAt: Date.now(),
    }

    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ challenge: serverChallengeB64 }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ verified: false, error: 'challenge_expired' }), { status: 403 }),
      )

    const mockCredentials = {
      create: vi.fn(),
      get: vi.fn(async (opts?: CredentialRequestOptions) => {
        const challenge = new Uint8Array(
          (opts?.publicKey?.challenge as ArrayBuffer) || new ArrayBuffer(0),
        )
        const assertion = await buildFakeAuthenticatorAssertion(keyPair, {
          challenge,
          origin: 'https://sindecon.pages.dev',
          rpId: 'sindecon.pages.dev',
          signCount: 2,
        })
        return { id: credId, rawId: new Uint8Array([1]).buffer, type: 'public-key', response: assertion }
      }),
    } as unknown as CredentialsContainer

    const res = await authenticateWithPasskey([passkey], {
      rpId: 'sindecon.pages.dev',
      origin: 'https://sindecon.pages.dev',
      isOnline: true,
      fetchFn: fetchMock,
      credentialsApi: mockCredentials,
    })

    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error.toLowerCase()).toContain('rechazada')
    }
  })

  it('rechaza explícitamente si /api/auth/fido/verify responde HTTP 200 con verified === false', async () => {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    )
    const spkiB64 = toBase64Url(
      new Uint8Array(await crypto.subtle.exportKey('spki', keyPair.publicKey)),
    )
    const serverChallengeB64 = toBase64Url(crypto.getRandomValues(new Uint8Array(32)))
    const credId = 'cred-200-false'
    const passkey: StoredPasskey = {
      credentialId: credId,
      publicKeySpkiB64: spkiB64,
      alg: -7,
      rpId: 'sindecon.pages.dev',
      label: 'YubiKey',
      signCount: 1,
      sealedToken: 'sealed.ok',
      createdAt: Date.now(),
    }

    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ challenge: serverChallengeB64 }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ verified: false }), { status: 200 }),
      )

    const mockCredentials = {
      create: vi.fn(),
      get: vi.fn(async (opts?: CredentialRequestOptions) => {
        const challenge = new Uint8Array(
          (opts?.publicKey?.challenge as ArrayBuffer) || new ArrayBuffer(0),
        )
        const assertion = await buildFakeAuthenticatorAssertion(keyPair, {
          challenge,
          origin: 'https://sindecon.pages.dev',
          rpId: 'sindecon.pages.dev',
          signCount: 2,
        })
        return { id: credId, rawId: new Uint8Array([1]).buffer, type: 'public-key', response: assertion }
      }),
    } as unknown as CredentialsContainer

    const res = await authenticateWithPasskey([passkey], {
      rpId: 'sindecon.pages.dev',
      origin: 'https://sindecon.pages.dev',
      isOnline: true,
      fetchFn: fetchMock,
      credentialsApi: mockCredentials,
    })

    expect(res).toEqual({
      ok: false,
      error: 'Verificación FIDO rechazada por el servidor.',
    })
  })

  it('verifica aserción WebAuthn criptográficamente en modo offline y rechaza signCount regresivo', async () => {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    )
    const spkiB64 = toBase64Url(
      new Uint8Array(await crypto.subtle.exportKey('spki', keyPair.publicKey)),
    )
    const credId = 'cred-offline-1'
    const passkey: StoredPasskey = {
      credentialId: credId,
      publicKeySpkiB64: spkiB64,
      alg: -7,
      rpId: 'sindecon.pages.dev',
      label: 'Face ID',
      signCount: 5,
      createdAt: Date.now(),
    }

    let nextCount = 6
    const mockCredentials = {
      create: vi.fn(),
      get: vi.fn(async (opts?: CredentialRequestOptions) => {
        const challenge = new Uint8Array(
          (opts?.publicKey?.challenge as ArrayBuffer) || new ArrayBuffer(0),
        )
        const assertion = await buildFakeAuthenticatorAssertion(keyPair, {
          challenge,
          origin: 'https://sindecon.pages.dev',
          rpId: 'sindecon.pages.dev',
          signCount: nextCount,
        })
        return { id: credId, rawId: new Uint8Array([1]).buffer, type: 'public-key', response: assertion }
      }),
    } as unknown as CredentialsContainer

    const validRes = await authenticateWithPasskey([passkey], {
      rpId: 'sindecon.pages.dev',
      origin: 'https://sindecon.pages.dev',
      isOnline: false,
      fetchFn: fetchMock,
      credentialsApi: mockCredentials,
    })

    expect(validRes.ok).toBe(true)
    if (!validRes.ok) return
    expect(validRes.verifiedOffline).toBe(true)
    expect(validRes.nextSignCount).toBe(6)

    // Simular dispositivo clonado con signCount menor al registrado (4 <= 5)
    nextCount = 4
    const clonedRes = await authenticateWithPasskey([passkey], {
      rpId: 'sindecon.pages.dev',
      origin: 'https://sindecon.pages.dev',
      isOnline: false,
      fetchFn: fetchMock,
      credentialsApi: mockCredentials,
    })
    expect(clonedRes.ok).toBe(false)
    if (!clonedRes.ok) {
      expect(clonedRes.error).toContain('clonada')
    }
  })

  it('mapea NotAllowedError a mensaje claro de cancelación', async () => {
    const mockCredentials = {
      create: vi.fn(),
      get: vi.fn(async () => {
        throw new DOMException('User cancelled', 'NotAllowedError')
      }),
    } as unknown as CredentialsContainer

    const res = await authenticateWithPasskey(
      [
        {
          credentialId: 'c1',
          publicKeySpkiB64: 'spki',
          alg: -7,
          rpId: 'sindecon.pages.dev',
          label: 'Passkey',
          signCount: 0,
          createdAt: 1,
        },
      ],
      { isOnline: false, credentialsApi: mockCredentials },
    )
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error.toLowerCase()).toContain('cancelada')
    }
  })

  it('maneja respuestas JSON no-objeto del servidor sin lanzar TypeError', async () => {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    )
    const spkiBuf = await crypto.subtle.exportKey('spki', keyPair.publicKey)
    const rawId = new Uint8Array([1, 2, 3]).buffer
    const credId = toBase64Url(new Uint8Array(rawId))

    fetchMock
      .mockResolvedValueOnce(new Response('null', { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ challenge: 'srv-ch-null' }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response('null', { status: 200 }))

    const mockCredentials = {
      create: vi.fn(async () => ({
        id: credId,
        rawId,
        type: 'public-key',
        response: {
          clientDataJSON: enc.encode('{}').buffer,
          getPublicKey: () => spkiBuf,
          getPublicKeyAlgorithm: () => -7,
        },
      })),
      get: vi.fn(),
    } as unknown as CredentialsContainer

    const res = await registerPasskey({
      rpId: 'sindecon.pages.dev',
      isOnline: true,
      fetchFn: fetchMock,
      credentialsApi: mockCredentials,
    })

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.passkey.sealedToken).toBeUndefined()

    const res2 = await registerPasskey({
      rpId: 'sindecon.pages.dev',
      isOnline: true,
      fetchFn: fetchMock,
      credentialsApi: mockCredentials,
    })
    expect(res2.ok).toBe(true)
    if (!res2.ok) return
    expect(res2.passkey.sealedToken).toBeUndefined()
  })
})
