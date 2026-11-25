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
  it('limpia sindecon_saved_pin 1234 sin proteger el terminal y rechaza ingresos demo (1234, credentials, offline)', async () => {
    const storage = makeMemoryStorage({ [SAVED_PIN_KEY]: '1234' })
    const auth = createAuthController({ storage })

    expect(auth.getState().protectionConfigured).toBe(false)

    const demoPin = await auth.loginWithPin('1234')
    expect(demoPin.success).toBe(false)
    expect(storage.getItem(SAVED_PIN_KEY)).toBeNull()
    expect(storage.getItem(AUTH_USER_KEY)).toBeNull()

    const credRes = auth.loginWithCredentials('valenzuela@hospital.cl', 'clave123')
    expect(credRes.success).toBe(false)

    const offlineRes = auth.loginOfflineEmergency()
    expect(offlineRes.success).toBe(false)
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

    const setupRes = await auth.setupInitialPin('482910')
    expect(setupRes.success).toBe(true)
    expect(setupRes.user?.method).toBe('pin')
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
    expect(auth.getState().protectionConfigured).toBe(true)
  })

  it('rechaza Google si hay protección local sin dueño Google y permite linkGoogleAccount autenticado', async () => {
    const storage = makeMemoryStorage()
    const auth = createAuthController({ storage })

    expect(auth.linkGoogleAccount({ sub: 's1', email: 'doc@cl.org', name: 'Doc' }).success).toBe(false)
    expect((await auth.setupOrChangePin('1234')).success).toBe(false)

    expect((await auth.setupInitialPin('12a4')).success).toBe(false)
    expect((await auth.setupInitialPin('4829')).success).toBe(true)
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

    await auth.setupInitialPin('4829')
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
    await auth.setupInitialPin('5678')
    await expect(auth.resetLocalTerminalSecurity()).resolves.toBeUndefined()
    expect(auth.getState().protectionConfigured).toBe(false)
  })

  it('serializa ensureLegacyPinMigrated e hydrateFromMirror concurrentes sobre el mismo storage sin duplicar PBKDF2', async () => {
    const storage = makeMemoryStorage({ [SAVED_PIN_KEY]: '9876' })
    const mirror = makeMemoryMirror()
    const loadSpy = vi.spyOn(mirror, 'load')
    const deriveSpy = vi.spyOn(crypto.subtle, 'deriveBits')

    const auth1 = createAuthController({ storage, mirror })
    const auth2 = createAuthController({ storage, mirror })

    try {
      const [p1, p2] = await Promise.all([
        auth1.ensureLegacyPinMigrated(),
        auth2.ensureLegacyPinMigrated(),
      ])
      expect(deriveSpy).toHaveBeenCalledTimes(1)
      expect(p1.pinRecord).not.toBeNull()
      expect(p2.pinRecord).toEqual(p1.pinRecord)
      expect(storage.getItem(SAVED_PIN_KEY)).toBeNull()

      // Concurrent hydrateFromMirror también se deduplica por instancia de storage
      await Promise.all([auth1.hydrateFromMirror(), auth2.hydrateFromMirror()])
      expect(loadSpy).toHaveBeenCalledTimes(1)
      expect(auth1.getState().securityProfile.pinRecord).toEqual(auth2.getState().securityProfile.pinRecord)
      expect((await auth2.loginWithPin('9876')).success).toBe(true)
    } finally {
      deriveSpy.mockRestore()
    }
  })

  it('re-lee storage tras mirror.load() para no sobrescribir mutaciones concurrentes y no resucita lockout expirado', async () => {
    const storage = makeMemoryStorage()
    let resolveLoad!: (val: DeviceSecurityProfile | null) => void
    const loadPromise = new Promise<DeviceSecurityProfile | null>((resolve) => {
      resolveLoad = resolve
    })
    const slowMirror: SecurityMirrorStore = {
      load: () => loadPromise,
      save: async () => {},
      clear: async () => {},
    }

    const auth1 = createAuthController({ storage, mirror: slowMirror })
    const auth2 = createAuthController({ storage, mirror: slowMirror })

    const hydrating = auth1.hydrateFromMirror()
    // Mutación concurrente mientras IndexedDB/mirror está cargando
    auth2.completeGoogleLogin({ sub: 's-concurrent', email: 'dra.concurrent@gmail.com', name: 'Dra. C' })
    resolveLoad({
      version: 1,
      ownerEmail: null,
      ownerName: null,
      ownerSub: null,
      ownerAvatarUrl: null,
      pinRecord: null,
      passkeys: [],
      updatedAt: 100,
    })
    await hydrating
    expect(auth1.getState().securityProfile.ownerEmail).toBe('dra.concurrent@gmail.com')

    // Lockout local expirado (lockedUntil <= now) NO impide que mirror más reciente sin PIN limpie pinRecord
    const expiredStorage = makeMemoryStorage({
      [SECURITY_STATE_KEY]: JSON.stringify({
        version: 1,
        ownerEmail: 'dra@cl.org',
        ownerName: 'Dra',
        ownerSub: 's1',
        ownerAvatarUrl: null,
        pinRecord: {
          version: 2,
          pinLength: 4,
          saltB64: 'c2FsdA',
          hashB64: 'aGFzaA',
          iterations: 150_000,
          failedAttempts: 5,
          lockedUntil: Date.now() - 10_000,
          updatedAt: 1000,
        },
        passkeys: [],
        updatedAt: 1000,
      }),
    })
    const newerMirror = makeMemoryMirror({
      version: 1,
      ownerEmail: 'dra@cl.org',
      ownerName: 'Dra',
      ownerSub: 's1',
      ownerAvatarUrl: null,
      pinRecord: null,
      passkeys: [],
      updatedAt: Date.now() + 5000,
    })
    const authExpired = createAuthController({ storage: expiredStorage, mirror: newerMirror })
    await authExpired.hydrateFromMirror()
    expect(authExpired.getState().securityProfile.pinRecord).toBeNull()
  })

  it('removePin borra SAVED_PIN_KEY antes de notificar, completeGoogleLogin limpia lockout activo, FIDO-only rechaza PIN y legacy PIN bloquea Google', async () => {
    // 1. removePin orden de limpieza
    let legacySeenInsideNotify: string | null = 'unset'
    const storage1 = makeMemoryStorage({ [SAVED_PIN_KEY]: '1234' })
    const authNotify = createAuthController({
      storage: storage1,
      notify: () => {
        legacySeenInsideNotify = storage1.getItem(SAVED_PIN_KEY)
      },
    })
    await authNotify.setupInitialPin('4321')
    storage1.setItem(SAVED_PIN_KEY, '4321')
    legacySeenInsideNotify = 'unset'
    authNotify.removePin()
    expect(legacySeenInsideNotify).toBeNull()

    // 2. completeGoogleLogin limpia lockedUntil activo del PIN
    const storage2 = makeMemoryStorage()
    const authGoogle = createAuthController({ storage: storage2 })
    authGoogle.completeGoogleLogin({ sub: 's1', email: 'dra@cl.org', name: 'Dra' })
    await authGoogle.setupOrChangePin('4829')
    authGoogle.logout()
    for (let i = 0; i < 5; i++) {
      await authGoogle.loginWithPin('0000')
    }
    expect(authGoogle.getState().lockedUntil).toBeGreaterThan(Date.now())
    const googleUnlock = authGoogle.completeGoogleLogin({
      sub: 's1',
      email: 'dra@cl.org',
      name: 'Dra',
    })
    expect(googleUnlock.success).toBe(true)
    expect(authGoogle.getState().lockedUntil).toBeNull()
    expect(authGoogle.getState().securityProfile.pinRecord?.failedAttempts).toBe(0)

    // 3. loginWithPin rechaza en dispositivos solo FIDO (sin pinRecord)
    const storage3 = makeMemoryStorage()
    const { credentialsApi } = await createFakePasskeyCredentials({ credentialId: 'fido-only-1' })
    const authFidoOnly = createAuthController({
      storage: storage3,
      fetchFn: vi.fn(async () => new Response('not found', { status: 404 })) as unknown as typeof fetch,
      credentialsApi,
    })
    await authFidoOnly.registerInitialPasskey('Solo Huella')
    authFidoOnly.logout()
    expect(authFidoOnly.getState().protectionConfigured).toBe(true)
    expect(authFidoOnly.getState().pinEnabled).toBe(false)
    const pinAttemptFidoOnly = await authFidoOnly.loginWithPin('1234')
    expect(pinAttemptFidoOnly.success).toBe(false)
    expect(pinAttemptFidoOnly.error).toContain('deshabilitado')

    // 4. hasPendingCustomLegacyPin bloquea completeGoogleLogin sin ownerEmail y con ownerEmail distinto
    const storageLegacyNoOwner = makeMemoryStorage({ [SAVED_PIN_KEY]: '9876' })
    const authLegacyNoOwner = createAuthController({ storage: storageLegacyNoOwner })
    expect(
      authLegacyNoOwner.completeGoogleLogin({ sub: 's1', email: 'intruder@cl.org', name: 'X' })
        .success,
    ).toBe(false)

    const storageLegacyWithOwner = makeMemoryStorage({
      [SAVED_PIN_KEY]: '9876',
      [SECURITY_STATE_KEY]: JSON.stringify({
        version: 1,
        ownerEmail: 'owner@cl.org',
        ownerName: 'Owner',
        ownerSub: 's-owner',
        ownerAvatarUrl: null,
        pinRecord: null,
        passkeys: [],
        updatedAt: 1000,
      }),
    })
    const authLegacyWithOwner = createAuthController({ storage: storageLegacyWithOwner })
    expect(
      authLegacyWithOwner.completeGoogleLogin({ sub: 's2', email: 'intruder@cl.org', name: 'X' })
        .success,
    ).toBe(false)
    expect(
      authLegacyWithOwner.completeGoogleLogin({ sub: 's-owner', email: 'owner@cl.org', name: 'Owner' })
        .success,
    ).toBe(true)
  })

  it('permite setupInitialPin/registerInitialPasskey solo sin protección previa (incluyendo mirror, legacy PIN y TOCTOU) y bloquea sobrescritura', async () => {
    // 1. setupInitialPin y registerInitialPasskey fallan si ya hay protección en localStorage o mirror IndexedDB
    const storageMirror = makeMemoryStorage()
    const protectedMirror = makeMemoryMirror({
      version: 1,
      ownerEmail: 'dueno@hospital.cl',
      ownerName: 'Dueño',
      ownerSub: 'sub-1',
      ownerAvatarUrl: null,
      pinRecord: null,
      passkeys: [],
      updatedAt: Date.now(),
    })
    const { credentialsApi: mirrorCreds } = await createFakePasskeyCredentials({
      credentialId: 'mirror-blocked-fido',
    })
    const authMirror = createAuthController({
      storage: storageMirror,
      mirror: protectedMirror,
      fetchFn: vi.fn(async () => new Response('not found', { status: 404 })) as unknown as typeof fetch,
      credentialsApi: mirrorCreds,
    })
    const blockedByMirror = await authMirror.setupInitialPin('482910')
    expect(blockedByMirror.success).toBe(false)
    expect(authMirror.getState().isAuthenticated).toBe(false)

    const blockedFidoByMirror = await authMirror.registerInitialPasskey('Atacante')
    expect(blockedFidoByMirror.success).toBe(false)
    expect(authMirror.getState().isAuthenticated).toBe(false)
    expect(mirrorCreds.create).not.toHaveBeenCalled()

    // 1b. También bloquean cuando existe un PIN legado personalizado pendiente de migración
    const storageLegacy = makeMemoryStorage({ [SAVED_PIN_KEY]: '9876' })
    const authLegacy = createAuthController({
      storage: storageLegacy,
      fetchFn: vi.fn(async () => new Response('not found', { status: 404 })) as unknown as typeof fetch,
      credentialsApi: mirrorCreds,
    })
    expect((await authLegacy.setupInitialPin('5555')).success).toBe(false)
    expect((await authLegacy.registerInitialPasskey('Atacante')).success).toBe(false)
    expect(authLegacy.getState().isAuthenticated).toBe(false)
    expect(mirrorCreds.create).not.toHaveBeenCalled()

    // 2. Equipo vacío: setupInitialPin protege e inicia sesión, y bloquea segundo setupInitialPin tras logout
    const storagePin = makeMemoryStorage()
    const authPin = createAuthController({ storage: storagePin })
    const initPin = await authPin.setupInitialPin('592014')
    expect(initPin.success).toBe(true)
    expect(initPin.user?.method).toBe('pin')
    expect(authPin.getState().isAuthenticated).toBe(true)
    expect(authPin.getState().protectionConfigured).toBe(true)
    authPin.logout()

    expect((await authPin.setupInitialPin('9999')).success).toBe(false)
    expect((await authPin.registerInitialPasskey('Atacante')).success).toBe(false)

    // 3. Equipo vacío con Passkey inicial
    const storageFido = makeMemoryStorage()
    const { credentialsApi } = await createFakePasskeyCredentials({ credentialId: 'init-fido-1' })
    const authFido = createAuthController({
      storage: storageFido,
      fetchFn: vi.fn(async () => new Response('not found', { status: 404 })) as unknown as typeof fetch,
      credentialsApi,
    })
    const initFido = await authFido.registerInitialPasskey('Huella Turno')
    expect(initFido.success).toBe(true)
    expect(initFido.user?.method).toBe('fido')
    expect(authFido.getState().protectionConfigured).toBe(true)
    authFido.logout()

    expect((await authFido.setupInitialPin('1122')).success).toBe(false)
    expect((await authFido.registerInitialPasskey('Otra')).success).toBe(false)

    // 4. Guardia TOCTOU: si otra operación protege el terminal mientras hashPin / registerPasskey esperan, aborta sin sobrescribir
    const storageRaceFido = makeMemoryStorage()
    const { credentialsApi: baseRaceCreds } = await createFakePasskeyCredentials({
      credentialId: 'race-fido-1',
    })
    let releaseCreate!: () => void
    const createGate = new Promise<void>((resolve) => {
      releaseCreate = resolve
    })
    let notifyCreateStarted!: () => void
    const createStarted = new Promise<void>((resolve) => {
      notifyCreateStarted = resolve
    })
    const slowRaceCreds = {
      ...baseRaceCreds,
      create: vi.fn(async (opts?: CredentialCreationOptions) => {
        notifyCreateStarted()
        await createGate
        return await baseRaceCreds.create(opts)
      }),
    } as unknown as CredentialsContainer
    const authRaceFido = createAuthController({
      storage: storageRaceFido,
      fetchFn: vi.fn(async () => new Response('not found', { status: 404 })) as unknown as typeof fetch,
      credentialsApi: slowRaceCreds,
    })
    const racingFido = authRaceFido.registerInitialPasskey('Passkey Tardia')
    await createStarted
    expect(
      authRaceFido.completeGoogleLogin({ sub: 's-race', email: 'duena@hospital.cl', name: 'Dueña' })
        .success,
    ).toBe(true)
    releaseCreate()
    const racingFidoRes = await racingFido
    expect(racingFidoRes.success).toBe(false)
    expect(authRaceFido.getState().securityProfile.ownerEmail).toBe('duena@hospital.cl')
    expect(authRaceFido.getState().securityProfile.passkeys).toEqual([])
    expect(authRaceFido.getState().user?.method).toBe('google')

    const storageRacePin = makeMemoryStorage()
    const authRacePin = createAuthController({ storage: storageRacePin })
    const origDeriveBits = crypto.subtle.deriveBits.bind(crypto.subtle)
    const deriveSpy = vi.spyOn(crypto.subtle, 'deriveBits').mockImplementation(async (...args) => {
      const result = await origDeriveBits(...args)
      authRacePin.completeGoogleLogin({
        sub: 's-race-pin',
        email: 'duena.pin@hospital.cl',
        name: 'Dueña PIN',
      })
      return result
    })
    try {
      const racingPinRes = await authRacePin.setupInitialPin('482910')
      expect(racingPinRes.success).toBe(false)
      expect(authRacePin.getState().securityProfile.ownerEmail).toBe('duena.pin@hospital.cl')
      expect(authRacePin.getState().securityProfile.pinRecord).toBeNull()
      expect(authRacePin.getState().user?.method).toBe('google')
    } finally {
      deriveSpy.mockRestore()
    }
  })
})
