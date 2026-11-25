import { describe, it, expect } from 'vitest'
import worker from '../../worker'
import { toBase64Url } from '../../shared/webauthnCrypto'
import { encryptSealedPayload, type OAuthEnv } from '../../functions/api/oauth/_shared'

const TEST_ENV: OAuthEnv = {
  GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'client-secret',
  OAUTH_COOKIE_SECRET: '0123456789abcdef0123456789abcdef',
}

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

function getCookieVal(header: string | null, name: string): string {
  const match = header?.match(new RegExp(`${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]!) : ''
}

async function createSignedAssertion(opts: {
  keyPair: CryptoKeyPair
  alg?: -7 | -257
  challenge: string
  origin?: string
  rpId?: string
  flags?: number
  signCount?: number
}) {
  const alg = opts.alg ?? -7
  const clientData = enc.encode(
    JSON.stringify({
      type: 'webauthn.get',
      challenge: opts.challenge,
      origin: opts.origin ?? 'https://sindecon.pages.dev',
    }),
  )
  const clientHash = new Uint8Array(await crypto.subtle.digest('SHA-256', clientData))
  const rpHash = new Uint8Array(
    await crypto.subtle.digest('SHA-256', enc.encode(opts.rpId ?? 'sindecon.pages.dev')),
  )
  const authData = new Uint8Array(37)
  authData.set(rpHash, 0)
  authData[32] = opts.flags ?? 0x05 // UP + UV
  new DataView(authData.buffer).setUint32(33, opts.signCount ?? 2, false)

  const payload = new Uint8Array(authData.length + clientHash.length)
  payload.set(authData, 0)
  payload.set(clientHash, authData.length)
  const sig =
    alg === -257
      ? new Uint8Array(
          await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, opts.keyPair.privateKey, payload),
        )
      : p1363ToDer(
          new Uint8Array(
            await crypto.subtle.sign(
              { name: 'ECDSA', hash: 'SHA-256' },
              opts.keyPair.privateKey,
              payload,
            ),
          ),
        )

  return {
    clientDataJSONB64: toBase64Url(clientData),
    authenticatorDataB64: toBase64Url(authData),
    signatureB64: toBase64Url(sig),
    sigBytes: sig,
  }
}

async function requestChallenge() {
  const chReq = new Request('https://sindecon.pages.dev/api/auth/fido/challenge', {
    method: 'POST',
    headers: { Origin: 'https://sindecon.pages.dev' },
  })
  return await worker.fetch(chReq, TEST_ENV)
}

async function enrollTestKey(
  keyPair: CryptoKeyPair,
  opts?: {
    alg?: number
    rpId?: string
    origin?: string
    type?: string
    challengeOverride?: string
    cookieOverride?: string | null
    omitClientData?: boolean
  },
) {
  const chRes = await requestChallenge()
  const { challenge } = (await chRes.json()) as { challenge: string }
  const chCookie = getCookieVal(chRes.headers.get('Set-Cookie'), 'sindecon_fido_challenge')

  const spkiB64 = toBase64Url(
    new Uint8Array(await crypto.subtle.exportKey('spki', keyPair.publicKey)),
  )
  const clientDataJSONB64 = opts?.omitClientData
    ? undefined
    : toBase64Url(
        enc.encode(
          JSON.stringify({
            type: opts?.type ?? 'webauthn.create',
            challenge: opts?.challengeOverride ?? challenge,
            origin: opts?.origin ?? 'https://sindecon.pages.dev',
          }),
        ),
      )
  const cookieValue = opts?.cookieOverride === undefined ? chCookie : opts.cookieOverride
  const headers: Record<string, string> = {
    Origin: 'https://sindecon.pages.dev',
    'Content-Type': 'application/json',
  }
  if (cookieValue !== null) {
    headers.Cookie = `sindecon_fido_challenge=${encodeURIComponent(cookieValue)}`
  }
  const enrollReq = new Request('https://sindecon.pages.dev/api/auth/fido/enroll', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      credentialId: 'cred-id-1',
      publicKeySpkiB64: spkiB64,
      alg: opts?.alg ?? -7,
      rpId: opts?.rpId ?? 'sindecon.pages.dev',
      ownerEmail: 'dra.martinez@gmail.com',
      ...(clientDataJSONB64 !== undefined ? { clientDataJSONB64 } : {}),
    }),
  })
  return await worker.fetch(enrollReq, TEST_ENV)
}

describe('/api/auth/fido/*', () => {
  it('registra clave pública FIDO sellada, verifica aserción ECDSA y limpia cookie de challenge', async () => {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    )

    const enrollRes = await enrollTestKey(keyPair)
    expect(enrollRes.status).toBe(200)
    expect(enrollRes.headers.get('Cache-Control')).toBe('no-store, private')
    expect(enrollRes.headers.get('Vary')).toBe('Cookie')
    const enrollSetCookie = enrollRes.headers.get('Set-Cookie') || ''
    expect(enrollSetCookie).toContain('sindecon_fido_challenge=;')
    expect(enrollSetCookie).toContain('Path=/api/auth/fido')
    expect(enrollSetCookie).toContain('Max-Age=0')
    const { sealedToken } = (await enrollRes.json()) as { sealedToken: string }
    expect(sealedToken).toContain('.')

    const chRes = await requestChallenge()
    expect(chRes.status).toBe(200)
    expect(chRes.headers.get('Cache-Control')).toBe('no-store, private')
    expect(chRes.headers.get('Vary')).toBe('Cookie')
    const chSetCookie = chRes.headers.get('Set-Cookie')
    expect(chSetCookie).toContain('sindecon_fido_challenge=')
    expect(chSetCookie).toContain('HttpOnly')
    expect(chSetCookie).toContain('SameSite=Lax')
    expect(chSetCookie).toContain('Path=/api/auth/fido')
    expect(chSetCookie).toContain('Max-Age=180')
    expect(chSetCookie).toContain('Secure')

    const { challenge } = (await chRes.json()) as { challenge: string }
    const chCookie = getCookieVal(chSetCookie, 'sindecon_fido_challenge')
    expect(chCookie).toBeTruthy()

    const assertion = await createSignedAssertion({ keyPair, challenge, signCount: 2 })

    const verifyReq = new Request('https://sindecon.pages.dev/api/auth/fido/verify', {
      method: 'POST',
      headers: {
        Origin: 'https://sindecon.pages.dev',
        'Content-Type': 'application/json',
        Cookie: `sindecon_fido_challenge=${encodeURIComponent(chCookie)}`,
      },
      body: JSON.stringify({
        credentialId: 'cred-id-1',
        clientDataJSONB64: assertion.clientDataJSONB64,
        authenticatorDataB64: assertion.authenticatorDataB64,
        signatureB64: assertion.signatureB64,
        sealedToken,
      }),
    })
    const verifyRes = await worker.fetch(verifyReq, TEST_ENV)
    expect(verifyRes.status).toBe(200)
    expect(verifyRes.headers.get('Cache-Control')).toBe('no-store, private')
    expect(verifyRes.headers.get('Vary')).toBe('Cookie')
    expect(await verifyRes.json()).toMatchObject({
      verified: true,
      signCount: 2,
      user: {
        sub: 'cred-id-1',
        email: 'dra.martinez@gmail.com',
        name: 'dra.martinez',
        method: 'fido',
      },
    })

    const setCookies = verifyRes.headers.get('Set-Cookie') || ''
    expect(setCookies).toContain('sindecon_fido_challenge=;')
    expect(setCookies).toContain('Path=/api/auth/fido')
    expect(setCookies).toContain('Max-Age=0')
    expect(setCookies).toContain('sindecon_auth_session=')

    const authCookie = getCookieVal(setCookies, 'sindecon_auth_session')
    const sessionRes = await worker.fetch(
      new Request('https://sindecon.pages.dev/api/auth/session', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
          Cookie: `sindecon_auth_session=${encodeURIComponent(authCookie)}`,
        },
      }),
      TEST_ENV,
    )
    expect(sessionRes.status).toBe(200)
    expect(await sessionRes.json()).toMatchObject({
      authenticated: true,
      user: { sub: 'cred-id-1', method: 'fido' },
    })

    // Simula replay sin cookie de challenge (ya limpiada por Set-Cookie Max-Age=0)
    const replayRes = await worker.fetch(
      new Request('https://sindecon.pages.dev/api/auth/fido/verify', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credentialId: 'cred-id-1',
          clientDataJSONB64: assertion.clientDataJSONB64,
          authenticatorDataB64: assertion.authenticatorDataB64,
          signatureB64: assertion.signatureB64,
          sealedToken,
        }),
      }),
      TEST_ENV,
    )
    expect(replayRes.status).toBe(401)
    expect(await replayRes.json()).toMatchObject({ verified: false, error: 'challenge_missing' })
  })

  it('rechaza challenge faltante, expirado o sealedToken alterado con 401 y limpia cookie', async () => {
    const missingRes = await worker.fetch(
      new Request('https://sindecon.pages.dev/api/auth/fido/verify', {
        method: 'POST',
        headers: { Origin: 'https://sindecon.pages.dev', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credentialId: 'c1',
          clientDataJSONB64: 'e30',
          authenticatorDataB64: 'e30',
          signatureB64: 'e30',
          sealedToken: 'bad.token',
        }),
      }),
      TEST_ENV,
    )
    expect(missingRes.status).toBe(401)
    expect(missingRes.headers.get('Set-Cookie')).toContain('sindecon_fido_challenge=;')
    expect(missingRes.headers.get('Set-Cookie')).toContain('Max-Age=0')

    const expiredCookie = await encryptSealedPayload(
      {
        challenge: 'expired-challenge-1',
        origin: 'https://sindecon.pages.dev',
        exp: Date.now() - 1000,
      },
      TEST_ENV.OAUTH_COOKIE_SECRET!,
    )
    const expiredRes = await worker.fetch(
      new Request('https://sindecon.pages.dev/api/auth/fido/verify', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
          'Content-Type': 'application/json',
          Cookie: `sindecon_fido_challenge=${encodeURIComponent(expiredCookie)}`,
        },
        body: JSON.stringify({
          credentialId: 'c1',
          clientDataJSONB64: 'e30',
          authenticatorDataB64: 'e30',
          signatureB64: 'e30',
          sealedToken: 'bad.token',
        }),
      }),
      TEST_ENV,
    )
    expect(expiredRes.status).toBe(401)
    expect(await expiredRes.json()).toMatchObject({ verified: false, error: 'challenge_expired' })
    expect(expiredRes.headers.get('Set-Cookie')).toContain('sindecon_fido_challenge=;')

    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    )
    const enrollRes = await enrollTestKey(keyPair)
    const { sealedToken } = (await enrollRes.json()) as { sealedToken: string }

    const chRes = await requestChallenge()
    const { challenge } = (await chRes.json()) as { challenge: string }
    const chCookie = getCookieVal(chRes.headers.get('Set-Cookie'), 'sindecon_fido_challenge')

    const assertion = await createSignedAssertion({ keyPair, challenge })

    // Tampered sealedToken
    const tamperedTokenRes = await worker.fetch(
      new Request('https://sindecon.pages.dev/api/auth/fido/verify', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
          'Content-Type': 'application/json',
          Cookie: `sindecon_fido_challenge=${encodeURIComponent(chCookie)}`,
        },
        body: JSON.stringify({
          credentialId: 'cred-id-1',
          clientDataJSONB64: assertion.clientDataJSONB64,
          authenticatorDataB64: assertion.authenticatorDataB64,
          signatureB64: assertion.signatureB64,
          sealedToken: `${sealedToken.slice(0, -4)}AAAA`,
        }),
      }),
      TEST_ENV,
    )
    expect(tamperedTokenRes.status).toBe(401)
    expect(tamperedTokenRes.headers.get('Set-Cookie')).toContain('sindecon_fido_challenge=;')
    expect(tamperedTokenRes.headers.get('Set-Cookie')).not.toContain('sindecon_auth_session=')
  })

  it('rechaza firma alterada o bandera UV=0 con 401 y limpia cookie de challenge', async () => {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    )
    const enrollRes = await enrollTestKey(keyPair)
    const { sealedToken } = (await enrollRes.json()) as { sealedToken: string }

    // Bad signature
    const ch1Res = await requestChallenge()
    const { challenge: ch1 } = (await ch1Res.json()) as { challenge: string }
    const ch1Cookie = getCookieVal(ch1Res.headers.get('Set-Cookie'), 'sindecon_fido_challenge')
    const validAssertion = await createSignedAssertion({ keyPair, challenge: ch1 })
    const badSig = new Uint8Array(validAssertion.sigBytes)
    badSig[badSig.length - 1] ^= 0xff

    const badSigRes = await worker.fetch(
      new Request('https://sindecon.pages.dev/api/auth/fido/verify', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
          'Content-Type': 'application/json',
          Cookie: `sindecon_fido_challenge=${encodeURIComponent(ch1Cookie)}`,
        },
        body: JSON.stringify({
          credentialId: 'cred-id-1',
          clientDataJSONB64: validAssertion.clientDataJSONB64,
          authenticatorDataB64: validAssertion.authenticatorDataB64,
          signatureB64: toBase64Url(badSig),
          sealedToken,
        }),
      }),
      TEST_ENV,
    )
    expect(badSigRes.status).toBe(401)
    expect(await badSigRes.json()).toMatchObject({ verified: false, error: 'bad_signature' })
    expect(badSigRes.headers.get('Set-Cookie')).toContain('sindecon_fido_challenge=;')
    expect(badSigRes.headers.get('Set-Cookie')).not.toContain('sindecon_auth_session=')

    // UV=0 (only UP=1 -> 0x01)
    const ch2Res = await requestChallenge()
    const { challenge: ch2 } = (await ch2Res.json()) as { challenge: string }
    const ch2Cookie = getCookieVal(ch2Res.headers.get('Set-Cookie'), 'sindecon_fido_challenge')
    const noUvAssertion = await createSignedAssertion({ keyPair, challenge: ch2, flags: 0x01 })

    const noUvRes = await worker.fetch(
      new Request('https://sindecon.pages.dev/api/auth/fido/verify', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
          'Content-Type': 'application/json',
          Cookie: `sindecon_fido_challenge=${encodeURIComponent(ch2Cookie)}`,
        },
        body: JSON.stringify({
          credentialId: 'cred-id-1',
          clientDataJSONB64: noUvAssertion.clientDataJSONB64,
          authenticatorDataB64: noUvAssertion.authenticatorDataB64,
          signatureB64: noUvAssertion.signatureB64,
          sealedToken,
        }),
      }),
      TEST_ENV,
    )
    expect(noUvRes.status).toBe(401)
    expect(await noUvRes.json()).toMatchObject({
      verified: false,
      error: 'user_verification_required',
    })
    expect(noUvRes.headers.get('Set-Cookie')).toContain('sindecon_fido_challenge=;')
    expect(noUvRes.headers.get('Set-Cookie')).not.toContain('sindecon_auth_session=')
  })

  it('maneja JSON no-objeto, payloads descifrados inválidos y CSRF sin lanzar TypeError', async () => {
    for (const rawBody of ['null', '[]', '"text"', '{bad']) {
      const enrollBad = await worker.fetch(
        new Request('https://sindecon.pages.dev/api/auth/fido/enroll', {
          method: 'POST',
          headers: { Origin: 'https://sindecon.pages.dev', 'Content-Type': 'application/json' },
          body: rawBody,
        }),
        TEST_ENV,
      )
      expect(enrollBad.status).toBe(400)

      const verifyBad = await worker.fetch(
        new Request('https://sindecon.pages.dev/api/auth/fido/verify', {
          method: 'POST',
          headers: { Origin: 'https://sindecon.pages.dev', 'Content-Type': 'application/json' },
          body: rawBody,
        }),
        TEST_ENV,
      )
      expect(verifyBad.status).toBe(400)
      expect(verifyBad.headers.get('Set-Cookie')).toContain('sindecon_fido_challenge=;')
    }

    const nonObjectChallenge = await encryptSealedPayload(null, TEST_ENV.OAUTH_COOKIE_SECRET!)
    const badChallengeRes = await worker.fetch(
      new Request('https://sindecon.pages.dev/api/auth/fido/verify', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
          'Content-Type': 'application/json',
          Cookie: `sindecon_fido_challenge=${encodeURIComponent(nonObjectChallenge)}`,
        },
        body: JSON.stringify({ credentialId: 'c1', sealedToken: 'x.y' }),
      }),
      TEST_ENV,
    )
    expect(badChallengeRes.status).toBe(401)
    expect(await badChallengeRes.json()).toMatchObject({
      verified: false,
      error: 'challenge_expired',
    })

    const validChallenge = await encryptSealedPayload(
      { challenge: 'ch-1', origin: 'https://sindecon.pages.dev', exp: Date.now() + 60_000 },
      TEST_ENV.OAUTH_COOKIE_SECRET!,
    )
    const nonObjectCred = await encryptSealedPayload(['not-an-object'], TEST_ENV.OAUTH_COOKIE_SECRET!)
    const badCredRes = await worker.fetch(
      new Request('https://sindecon.pages.dev/api/auth/fido/verify', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
          'Content-Type': 'application/json',
          Cookie: `sindecon_fido_challenge=${encodeURIComponent(validChallenge)}`,
        },
        body: JSON.stringify({ credentialId: 'c1', sealedToken: nonObjectCred }),
      }),
      TEST_ENV,
    )
    expect(badCredRes.status).toBe(401)
    expect(await badCredRes.json()).toMatchObject({
      verified: false,
      error: 'invalid_credential_token',
    })

    const getRes = await worker.fetch(
      new Request('https://sindecon.pages.dev/api/auth/fido/challenge', {
        method: 'GET',
        headers: { Origin: 'https://sindecon.pages.dev' },
      }),
      TEST_ENV,
    )
    expect(getRes.status).toBe(405)

    const crossOriginRes = await worker.fetch(
      new Request('https://sindecon.pages.dev/api/auth/fido/challenge', {
        method: 'POST',
        headers: { Origin: 'https://evil.example' },
      }),
      TEST_ENV,
    )
    expect(crossOriginRes.status).toBe(403)
  })

  it('rechaza /enroll con 401 y limpia cookie si falta challenge, expira o clientDataJSON no coincide', async () => {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    )

    const noCookie = await enrollTestKey(keyPair, { cookieOverride: null })
    expect(noCookie.status).toBe(401)
    expect(await noCookie.json()).toMatchObject({ error: 'challenge_missing' })
    expect(noCookie.headers.get('Set-Cookie')).toContain('sindecon_fido_challenge=;')
    expect(noCookie.headers.get('Set-Cookie')).toContain('Max-Age=0')

    const expiredCookie = await encryptSealedPayload(
      {
        challenge: 'exp-enroll-ch',
        origin: 'https://sindecon.pages.dev',
        exp: Date.now() - 1000,
      },
      TEST_ENV.OAUTH_COOKIE_SECRET!,
    )
    const expiredRes = await enrollTestKey(keyPair, {
      cookieOverride: expiredCookie,
      challengeOverride: 'exp-enroll-ch',
    })
    expect(expiredRes.status).toBe(401)
    expect(await expiredRes.json()).toMatchObject({ error: 'challenge_expired' })
    expect(expiredRes.headers.get('Set-Cookie')).toContain('Max-Age=0')

    const missingClientData = await enrollTestKey(keyPair, { omitClientData: true })
    expect(missingClientData.status).toBe(401)
    expect(missingClientData.headers.get('Set-Cookie')).toContain('Max-Age=0')

    const wrongType = await enrollTestKey(keyPair, { type: 'webauthn.get' })
    expect(wrongType.status).toBe(401)
    expect(await wrongType.json()).toMatchObject({ error: 'invalid_ceremony_type' })
    expect(wrongType.headers.get('Set-Cookie')).toContain('Max-Age=0')

    const wrongChallenge = await enrollTestKey(keyPair, { challengeOverride: 'other-challenge' })
    expect(wrongChallenge.status).toBe(401)
    expect(await wrongChallenge.json()).toMatchObject({ error: 'challenge_mismatch' })
    expect(wrongChallenge.headers.get('Set-Cookie')).toContain('Max-Age=0')

    const wrongOrigin = await enrollTestKey(keyPair, { origin: 'https://evil.example' })
    expect(wrongOrigin.status).toBe(401)
    expect(await wrongOrigin.json()).toMatchObject({ error: 'origin_mismatch' })
    expect(wrongOrigin.headers.get('Set-Cookie')).toContain('Max-Age=0')

    const badRpId = await enrollTestKey(keyPair, { rpId: 'evil.example' })
    expect(badRpId.status).toBe(400)
    expect(badRpId.headers.get('Set-Cookie')).toContain('Max-Age=0')

    const badAlg = await enrollTestKey(keyPair, { alg: -8 })
    expect(badAlg.status).toBe(400)
    expect(badAlg.headers.get('Set-Cookie')).toContain('Max-Age=0')
  })

  it('registra y verifica passkey RS256 (alg: -257) y rechaza clonación por previousSignCount en /verify', async () => {
    const rsaPair = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify'],
    )

    const enrollRes = await enrollTestKey(rsaPair, { alg: -257 })
    expect(enrollRes.status).toBe(200)
    expect(enrollRes.headers.get('Set-Cookie')).toContain('sindecon_fido_challenge=;')
    const { sealedToken } = (await enrollRes.json()) as { sealedToken: string }

    const ch1Res = await requestChallenge()
    const { challenge: ch1 } = (await ch1Res.json()) as { challenge: string }
    const ch1Cookie = getCookieVal(ch1Res.headers.get('Set-Cookie'), 'sindecon_fido_challenge')
    const okAssertion = await createSignedAssertion({
      keyPair: rsaPair,
      alg: -257,
      challenge: ch1,
      signCount: 5,
    })

    const verifyOk = await worker.fetch(
      new Request('https://sindecon.pages.dev/api/auth/fido/verify', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
          'Content-Type': 'application/json',
          Cookie: `sindecon_fido_challenge=${encodeURIComponent(ch1Cookie)}`,
        },
        body: JSON.stringify({
          credentialId: 'cred-id-1',
          clientDataJSONB64: okAssertion.clientDataJSONB64,
          authenticatorDataB64: okAssertion.authenticatorDataB64,
          signatureB64: okAssertion.signatureB64,
          sealedToken,
          previousSignCount: 2,
        }),
      }),
      TEST_ENV,
    )
    expect(verifyOk.status).toBe(200)
    expect(await verifyOk.json()).toMatchObject({
      verified: true,
      signCount: 5,
      user: { sub: 'cred-id-1', method: 'fido' },
    })

    // Simular clonación con signCount menor o igual a previousSignCount
    const ch2Res = await requestChallenge()
    const { challenge: ch2 } = (await ch2Res.json()) as { challenge: string }
    const ch2Cookie = getCookieVal(ch2Res.headers.get('Set-Cookie'), 'sindecon_fido_challenge')
    const clonedAssertion = await createSignedAssertion({
      keyPair: rsaPair,
      alg: -257,
      challenge: ch2,
      signCount: 3,
    })

    const verifyCloned = await worker.fetch(
      new Request('https://sindecon.pages.dev/api/auth/fido/verify', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
          'Content-Type': 'application/json',
          Cookie: `sindecon_fido_challenge=${encodeURIComponent(ch2Cookie)}`,
        },
        body: JSON.stringify({
          credentialId: 'cred-id-1',
          clientDataJSONB64: clonedAssertion.clientDataJSONB64,
          authenticatorDataB64: clonedAssertion.authenticatorDataB64,
          signatureB64: clonedAssertion.signatureB64,
          sealedToken,
          previousSignCount: 5,
        }),
      }),
      TEST_ENV,
    )
    expect(verifyCloned.status).toBe(401)
    expect(await verifyCloned.json()).toMatchObject({
      verified: false,
      error: 'cloned_authenticator_detected',
    })
    expect(verifyCloned.headers.get('Set-Cookie')).toContain('sindecon_fido_challenge=;')
    expect(verifyCloned.headers.get('Set-Cookie')).not.toContain('sindecon_auth_session=')
  })
})
