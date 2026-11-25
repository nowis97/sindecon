import { describe, it, expect, vi } from 'vitest'
import { toBase64Url } from '../../shared/webauthnCrypto'
import {
  AUTH_USER_KEY,
  SAVED_PIN_KEY,
  SECURITY_STATE_KEY,
  type DeviceSecurityProfile,
} from '../domain/auth'
import {
  createAuthController,
  readSecurityProfile,
  readStoredUser,
  type SecurityMirrorStore,
  type StorageLike,
} from './useAuth'

const textEncoder = new TextEncoder()

function makeMemoryStorage(initial: Record<string, string> = {}): StorageLike {
  const map = new Map<string, string>(Object.entries(initial))
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v)
    },
    removeItem: (k) => {
      map.delete(k)
    },
  }
}

function makeMemoryMirror(initial: DeviceSecurityProfile | null = null): SecurityMirrorStore & {
  readRaw: () => DeviceSecurityProfile | null
} {
  let stored = initial
  return {
    load: async () => stored,
    save: async (profile) => {
      stored = profile
    },
    clear: async () => {
      stored = null
    },
    readRaw: () => stored,
  }
}

function p1363ToDer(sig: Uint8Array): Uint8Array<ArrayBuffer> {
  const intPart = (slice: Uint8Array) => {
    let i = 0
    while (i < slice.length - 1 && slice[i] === 0) i++
    let b = slice.slice(i)
    if (b[0]! >= 0x80) {
      const padded = new Uint8Array(b.length + 1)
      padded.set(b, 1)
      b = padded
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

async function createFakePasskeyCredentials(opts: {
  credentialId: string
  rpId?: string
  origin?: string
  initialSignCount?: number
}) {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  )
  const spkiBuf = await crypto.subtle.exportKey('spki', keyPair.publicKey)
  const rawId = new Uint8Array([1, 2, 3, 4]).buffer
  const rpId = opts.rpId ?? 'localhost'
  const origin = opts.origin ?? 'https://localhost'
  let signCount = opts.initialSignCount ?? 0

  const credentialsApi = {
    create: vi.fn(async () => ({
      id: opts.credentialId,
      rawId,
      type: 'public-key',
      response: {
        getPublicKey: () => spkiBuf,
        getPublicKeyAlgorithm: () => -7,
      },
    })),
    get: vi.fn(async (req?: CredentialRequestOptions) => {
      signCount += 1
      const challenge = new Uint8Array((req?.publicKey?.challenge as ArrayBuffer) || new ArrayBuffer(0))
      const clientDataJSON = textEncoder.encode(
        JSON.stringify({ type: 'webauthn.get', challenge: toBase64Url(challenge), origin }),
      )
      const clientHash = new Uint8Array(await crypto.subtle.digest('SHA-256', clientDataJSON))
      const rpHash = new Uint8Array(await crypto.subtle.digest('SHA-256', textEncoder.encode(rpId)))
      const authData = new Uint8Array(37)
      authData.set(rpHash, 0)
      authData[32] = 0x05 // UP + UV
      new DataView(authData.buffer).setUint32(33, signCount, false)

      const signed = new Uint8Array(authData.length + clientHash.length)
      signed.set(authData, 0)
      signed.set(clientHash, authData.length)
      const rawSig = new Uint8Array(
        await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keyPair.privateKey, signed),
      )
      const signature = p1363ToDer(rawSig)
      return {
        id: opts.credentialId,
        rawId,
        type: 'public-key',
        response: {
          clientDataJSON: clientDataJSON.buffer,
          authenticatorData: authData.buffer,
          signature: signature.buffer,
        },
      }
    }),
  } as unknown as CredentialsContainer

  return { credentialsApi, setSignCount: (n: number) => { signCount = n } }
}

describe('useAuth controller (migración, lockout, Google owner, FIDO, logout vs reset)', () => {
  it('mantiene modo demo sin protección cuando sindecon_saved_pin es 1234 y valida credenciales/urgencias', async () => {
    const storage = makeMemoryStorage({ [SAVED_PIN_KEY]: '1234' })
    const auth = createAuthController({ storage })

    expect(auth.getState().protectionConfigured).toBe(false)
    expect(auth.getState().pinEnabled).toBe(true)

    const badPin = await auth.loginWithPin('0000')
    expect(badPin.success).toBe(false)

    const okDemo = await auth.loginWithPin('1234')
    expect(okDemo.success).toBe(true)
    expect(okDemo.user?.method).toBe('pin')
    expect(storage.getItem(AUTH_USER_KEY)).toBeTruthy()
    auth.logout()

    const badCred = auth.loginWithCredentials('', '12')
    expect(badCred.success).toBe(false)

    const okCred = auth.loginWithCredentials('valenzuela@hospital.cl', 'clave123')
    expect(okCred.success).toBe(true)
    expect(okCred.user?.method).toBe('credentials')
    expect(okCred.user?.name).toBe('Dr. Valenzuela')
    auth.logout()

    const okOffline = auth.loginOfflineEmergency()
    expect(okOffline.success).toBe(true)
    expect(okOffline.user?.method).toBe('offline')
  })

  it('migra PIN personalizado legado a PinRecord PBKDF2 y activa protectionConfigured', async () => {
    const storage = makeMemoryStorage({ [SAVED_PIN_KEY]: '9876' })
    const auth = createAuthController({ storage })

    expect(auth.getState().protectionConfigured).toBe(true)
    expect(auth.loginWithCredentials('doc@cl.org', '1234').success).toBe(false)
    expect(auth.loginOfflineEmergency().success).toBe(false)

    const bad = await auth.loginWithPin('1234')
    expect(bad.success).toBe(false)
    expect(storage.getItem(SAVED_PIN_KEY)).toBeNull()

    const good = await auth.loginWithPin('9876')
    expect(good.success).toBe(true)
    expect(good.user?.method).toBe('pin')
    expect(auth.getState().securityProfile.pinRecord?.version).toBe(2)
    expect(auth.getState().securityProfile.pinRecord?.pinLength).toBe(4)
  })

  it('persiste lockout tras 5 fallos entre almacenamiento local y mirror en hidratación', async () => {
    const storage = makeMemoryStorage()
    const mirror = makeMemoryMirror()
    const auth = createAuthController({ storage, mirror })

    await auth.loginWithPin('1234')
    const setupRes = await auth.setupOrChangePin('482910')
    expect(setupRes.success).toBe(true)
    expect(auth.getState().pinLength).toBe(6)
    auth.logout()

    for (let i = 0; i < 4; i++) {
      const attempt = await auth.loginWithPin('000000')
      expect(attempt.success).toBe(false)
      expect(attempt.lockedUntil ?? null).toBeNull()
    }

    const fifth = await auth.loginWithPin('000000')
    expect(fifth.success).toBe(false)
    expect(fifth.lockedUntil).toBeGreaterThan(Date.now())
    expect(auth.getState().lockedUntil).toBe(fifth.lockedUntil)

    // Incluso el PIN correcto queda bloqueado durante lockedUntil
    const blockedGood = await auth.loginWithPin('482910')
    expect(blockedGood.success).toBe(false)

    // Simular borrado de localStorage y re-hidratación desde IndexedDB mirror
    storage.removeItem(SECURITY_STATE_KEY)
    const freshAuth = createAuthController({ storage, mirror })
    await freshAuth.hydrateFromMirror()

    expect(freshAuth.getState().protectionConfigured).toBe(true)
    expect(freshAuth.getState().lockedUntil).toBe(fifth.lockedUntil)
    expect((await freshAuth.loginWithPin('482910')).success).toBe(false)

    // Simular manipulación de localStorage con updatedAt más reciente pero lockedUntil: null
    const tampered: DeviceSecurityProfile = {
      ...freshAuth.getState().securityProfile,
      updatedAt: Date.now() + 60_000,
      pinRecord: freshAuth.getState().securityProfile.pinRecord
        ? { ...freshAuth.getState().securityProfile.pinRecord!, failedAttempts: 0, lockedUntil: null }
        : null,
    }
    storage.setItem(SECURITY_STATE_KEY, JSON.stringify(tampered))
    await freshAuth.hydrateFromMirror()
    expect(freshAuth.getState().lockedUntil).toBe(fifth.lockedUntil)
  })

  it('exige mismo correo Google cuando el equipo está protegido y permite recuperación', async () => {
    const storage = makeMemoryStorage()
    const auth = createAuthController({ storage })

    const firstGoogle = auth.completeGoogleLogin({
      sub: 's1',
      email: 'dra.ana@gmail.com',
      name: 'Dra. Ana',
    })
    expect(firstGoogle.success).toBe(true)
    expect(firstGoogle.user?.method).toBe('google')

    await auth.setupOrChangePin('482910')
    auth.logout()

    // logout NO borra el perfil de seguridad
    expect(auth.getState().protectionConfigured).toBe(true)
    expect(auth.getState().user).toBeNull()

    // Intruso bloqueado
    const wrong = auth.completeGoogleLogin({ sub: 's2', email: 'otro@gmail.com', name: 'Otro' })
    expect(wrong.success).toBe(false)

    // Dueña autorizada recupera acceso y obtiene opción de cambiar PIN sin recordar el anterior
    const recovered = auth.completeGoogleLogin(
      { sub: 's1', email: 'Dra.Ana@gmail.com', name: 'Dra. Ana' },
      { allowRecovery: true },
    )
    expect(recovered.success).toBe(true)
    expect(recovered.user?.email).toBe('Dra.Ana@gmail.com')
    expect(recovered.needsPinResetOption).toBe(true)

    const changeWrongCurrent = await auth.setupOrChangePin('1122', { currentPin: '000000' })
    expect(changeWrongCurrent.success).toBe(false)

    const recoveryReset = await auth.setupOrChangePin('1122')
    expect(recoveryReset.success).toBe(true)
    expect(auth.getState().pinLength).toBe(4)

    const removed = auth.removePin()
    expect(removed.success).toBe(true)
    expect(auth.getState().protectionConfigured).toBe(false)
  })

  it('rechaza Google si hay protección local sin dueño Google y permite linkGoogleAccount autenticado', async () => {
    const storage = makeMemoryStorage()
    const auth = createAuthController({ storage })

    expect(auth.linkGoogleAccount({ sub: 's1', email: 'doc@cl.org', name: 'Doc' }).success).toBe(false)
    expect((await auth.setupOrChangePin('1234')).success).toBe(false)

    await auth.loginWithPin('1234')
    expect((await auth.setupOrChangePin('12a4')).success).toBe(false)
    expect((await auth.setupOrChangePin('4829')).success).toBe(true)
    auth.logout()

    const blockedGoogle = auth.completeGoogleLogin({ sub: 's1', email: 'doc@cl.org', name: 'Doc' })
    expect(blockedGoogle.success).toBe(false)
    expect(blockedGoogle.error).toContain('no tiene cuenta Google vinculada')

    await auth.loginWithPin('4829')
    expect(auth.linkGoogleAccount({ sub: 's1', email: 'doc@cl.org', name: 'Doc' }).success).toBe(true)
    expect(auth.getState().securityProfile.ownerEmail).toBe('doc@cl.org')
  })

  it('registra passkey FIDO, actualiza signCount al autenticar, desbloquea lockout y permite eliminarla', async () => {
    const storage = makeMemoryStorage()
    const mirror = makeMemoryMirror()
    const fetchMock = vi.fn(async () => new Response('not found', { status: 404 })) as unknown as typeof fetch
    const { credentialsApi, setSignCount } = await createFakePasskeyCredentials({
      credentialId: 'cred-fido-1',
    })
    const auth = createAuthController({ storage, mirror, fetchFn: fetchMock, credentialsApi })

    await auth.loginWithPin('1234')
    await auth.setupOrChangePin('4829')
    const enrolled = await auth.registerDevicePasskey('Huella Guardia')
    expect(enrolled.success).toBe(true)
    expect(enrolled.passkey?.signCount).toBe(0)
    expect(auth.getState().hasPasskeys).toBe(true)
    expect(auth.getState().protectionConfigured).toBe(true)
    auth.logout()

    for (let i = 0; i < 5; i++) {
      await auth.loginWithPin('0000')
    }
    expect(auth.getState().lockedUntil).toBeGreaterThan(Date.now())

    setSignCount(4)
    const fidoLogin = await auth.loginWithFido()
    expect(fidoLogin.success).toBe(true)
    expect(fidoLogin.user?.method).toBe('fido')
    expect(auth.getState().lockedUntil).toBeNull()
    expect(auth.getState().securityProfile.passkeys[0]?.signCount).toBe(5)
    expect(auth.getState().securityProfile.passkeys[0]?.lastUsedAt).toBeTypeOf('number')

    auth.removeDevicePasskey('cred-fido-1')
    expect(auth.getState().hasPasskeys).toBe(false)
    expect(auth.getState().protectionConfigured).toBe(true) // PIN sigue activo
  })

  it('logout conserva perfil de seguridad mientras resetLocalTerminalSecurity limpia todo sin lanzar error', async () => {
    const storage = makeMemoryStorage()
    const mirror = makeMemoryMirror()
    const fetchMock = vi.fn(async () => new Response('{"ok":true}', { status: 200 })) as unknown as typeof fetch
    const auth = createAuthController({ storage, mirror, fetchFn: fetchMock })

    auth.completeGoogleLogin({ sub: 's1', email: 'doc@cl.org', name: 'Doc' })
    await auth.setupOrChangePin('7391')
    expect(storage.getItem(SECURITY_STATE_KEY)).toBeTruthy()
    expect(mirror.readRaw()?.ownerEmail).toBe('doc@cl.org')

    auth.logout()
    expect(auth.getState().user).toBeNull()
    expect(auth.getState().isAuthenticated).toBe(false)
    expect(auth.getState().protectionConfigured).toBe(true)
    expect(storage.getItem(SECURITY_STATE_KEY)).toBeTruthy()
    expect(storage.getItem(AUTH_USER_KEY)).toBeNull()

    await auth.resetLocalTerminalSecurity()
    expect(auth.getState().protectionConfigured).toBe(false)
    expect(auth.getState().user).toBeNull()
    expect(storage.getItem(SECURITY_STATE_KEY)).toBeNull()
    expect(storage.getItem(AUTH_USER_KEY)).toBeNull()
    expect(mirror.readRaw()).toBeNull()
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST' }))
  })

  it('valida JSON corrupto o malformado al leer usuario y perfil de seguridad', () => {
    const badStorage = makeMemoryStorage({
      [AUTH_USER_KEY]: JSON.stringify(['not', 'a', 'user']),
      [SECURITY_STATE_KEY]: JSON.stringify({
        version: 1,
        ownerEmail: 42,
        pinRecord: { broken: true },
        passkeys: ['bad-entry'],
      }),
    })

    expect(readStoredUser(badStorage)).toBeNull()
    const profile = readSecurityProfile(badStorage)
    expect(profile.ownerEmail).toBeNull()
    expect(profile.pinRecord).toBeNull()
    expect(profile.passkeys).toEqual([])
  })

  it('opera de forma segura en entorno Node sin indexedDB usando mirror por defecto', async () => {
    const fetchMock = vi.fn(async () => new Response('{"ok":true}', { status: 200 })) as unknown as typeof fetch
    const storage = makeMemoryStorage()
    const auth = createAuthController({ storage, fetchFn: fetchMock })

    await expect(auth.hydrateFromMirror()).resolves.toBeUndefined()
    await auth.loginWithPin('1234')
    await auth.setupOrChangePin('5678')
    await expect(auth.resetLocalTerminalSecurity()).resolves.toBeUndefined()
    expect(auth.getState().protectionConfigured).toBe(false)
  })
})
