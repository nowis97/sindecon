import { useCallback, useEffect, useMemo, useState } from 'react'
import { db } from '../db/db'
import {
  AUTH_USER_KEY,
  DEFAULT_PIN,
  SAVED_PIN_KEY,
  SECURITY_STATE_KEY,
  canGoogleUnlockDevice,
  createEmptySecurityProfile,
  createFidoUser,
  createGoogleUser,
  createOfflineEmergencyUser,
  createPinUser,
  isProtectionConfigured,
  validateCredentials,
  type AuthMethod,
  type AuthUser,
  type DeviceSecurityProfile,
  type StoredPasskey,
} from '../domain/auth'
import { authenticateWithPasskey, registerPasskey } from '../domain/fidoAuth'
import {
  evaluatePinAttempt,
  hashPin,
  isValidPinFormat,
  verifyPinHash,
  type PinRecord,
} from '../domain/pinAuth'
import { logoutServerAuthSession, type GoogleIdentityProfile } from '../pwa/googleAuth'

export { type AuthUser, DEFAULT_PIN }

export const AUTH_CHANGE_EVENT = 'sindecon_auth_change'
export const SECURITY_CHANGE_EVENT = 'sindecon_security_change'
const DB_META_SECURITY_KEY = 'security_profile'

const VALID_AUTH_METHODS: ReadonlySet<string> = new Set<AuthMethod>([
  'pin',
  'credentials',
  'google',
  'offline',
  'fido',
])

export interface StorageLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

export interface SecurityMirrorStore {
  load: () => Promise<DeviceSecurityProfile | null>
  save: (profile: DeviceSecurityProfile) => Promise<void>
  clear: () => Promise<void>
}

export interface AuthControllerDeps {
  storage?: StorageLike | null
  mirror?: SecurityMirrorStore
  fetchFn?: typeof fetch
  credentialsApi?: CredentialsContainer
  notify?: () => void
}

export interface PinLoginResult {
  success: boolean
  error?: string
  lockedUntil?: number | null
  user?: AuthUser
}

const pendingMigrations = new WeakMap<StorageLike, Promise<DeviceSecurityProfile>>()
const pendingHydrations = new WeakMap<StorageLike, Promise<void>>()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getSafeLocalStorage(): StorageLike | null {
  try {
    if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') {
      return null
    }
    return localStorage
  } catch {
    return null
  }
}

function safeGetItem(storage: StorageLike | null, key: string): string | null {
  if (!storage) return null
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function safeSetItem(storage: StorageLike | null, key: string, value: string): void {
  if (!storage) return
  try {
    storage.setItem(key, value)
  } catch {
    // Silencioso en modos privados o cuotas restringidas.
  }
}

function safeRemoveItem(storage: StorageLike | null, key: string): void {
  if (!storage) return
  try {
    storage.removeItem(key)
  } catch {
    // Silencioso.
  }
}

function dispatchBrowserEvent(name: string): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(name))
  }
}

function normalizePinRecord(raw: unknown): PinRecord | null {
  if (!isRecord(raw)) return null
  if (raw.version !== 2) return null
  if (raw.pinLength !== 4 && raw.pinLength !== 6) return null
  if (typeof raw.saltB64 !== 'string' || raw.saltB64.length === 0) return null
  if (typeof raw.hashB64 !== 'string' || raw.hashB64.length === 0) return null
  if (typeof raw.iterations !== 'number' || !Number.isFinite(raw.iterations) || raw.iterations <= 0) {
    return null
  }
  const failedAttempts =
    typeof raw.failedAttempts === 'number' &&
    Number.isFinite(raw.failedAttempts) &&
    raw.failedAttempts >= 0
      ? raw.failedAttempts
      : 0
  const lockedUntil =
    typeof raw.lockedUntil === 'number' && Number.isFinite(raw.lockedUntil)
      ? raw.lockedUntil
      : null
  const updatedAt =
    typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt) ? raw.updatedAt : 0

  return {
    version: 2,
    pinLength: raw.pinLength,
    saltB64: raw.saltB64,
    hashB64: raw.hashB64,
    iterations: raw.iterations,
    failedAttempts,
    lockedUntil,
    updatedAt,
  }
}

function normalizePasskeys(raw: unknown): StoredPasskey[] {
  if (!Array.isArray(raw)) return []
  const valid: StoredPasskey[] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    if (typeof item.credentialId !== 'string' || item.credentialId.length === 0) continue
    if (typeof item.publicKeySpkiB64 !== 'string' || item.publicKeySpkiB64.length === 0) continue
    if (typeof item.alg !== 'number' || !Number.isFinite(item.alg)) continue
    if (typeof item.rpId !== 'string' || item.rpId.length === 0) continue

    valid.push({
      credentialId: item.credentialId,
      publicKeySpkiB64: item.publicKeySpkiB64,
      alg: item.alg,
      rpId: item.rpId,
      label:
        typeof item.label === 'string' && item.label.length > 0 ? item.label : 'Passkey Biométrica',
      signCount:
        typeof item.signCount === 'number' &&
        Number.isFinite(item.signCount) &&
        item.signCount >= 0
          ? item.signCount
          : 0,
      sealedToken: typeof item.sealedToken === 'string' ? item.sealedToken : undefined,
      ownerEmail: typeof item.ownerEmail === 'string' ? item.ownerEmail : undefined,
      createdAt:
        typeof item.createdAt === 'number' && Number.isFinite(item.createdAt)
          ? item.createdAt
          : 0,
      lastUsedAt:
        typeof item.lastUsedAt === 'number' && Number.isFinite(item.lastUsedAt)
          ? item.lastUsedAt
          : undefined,
    })
  }
  return valid
}

function normalizeSecurityProfile(raw: unknown): DeviceSecurityProfile | null {
  if (!isRecord(raw)) return null
  if (raw.version !== undefined && raw.version !== 1) return null

  return {
    version: 1,
    ownerEmail:
      typeof raw.ownerEmail === 'string' && raw.ownerEmail.trim().length > 0
        ? raw.ownerEmail
        : null,
    ownerName: typeof raw.ownerName === 'string' && raw.ownerName.length > 0 ? raw.ownerName : null,
    ownerSub: typeof raw.ownerSub === 'string' && raw.ownerSub.length > 0 ? raw.ownerSub : null,
    ownerAvatarUrl:
      typeof raw.ownerAvatarUrl === 'string' && raw.ownerAvatarUrl.length > 0
        ? raw.ownerAvatarUrl
        : null,
    pinRecord: normalizePinRecord(raw.pinRecord),
    passkeys: normalizePasskeys(raw.passkeys),
    updatedAt:
      typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt) ? raw.updatedAt : 0,
  }
}

function readNormalizedSecurityProfile(storage: StorageLike | null): DeviceSecurityProfile | null {
  const raw = safeGetItem(storage, SECURITY_STATE_KEY)
  if (!raw) return null
  try {
    return normalizeSecurityProfile(JSON.parse(raw))
  } catch {
    return null
  }
}

function createDexieMirror(): SecurityMirrorStore {
  return {
    async load() {
      if (typeof indexedDB === 'undefined') return null
      try {
        const row = await db.meta.get(DB_META_SECURITY_KEY)
        return normalizeSecurityProfile(row?.value)
      } catch {
        return null
      }
    },
    async save(profile) {
      if (typeof indexedDB === 'undefined') return
      try {
        await db.meta.put({ key: DB_META_SECURITY_KEY, value: profile })
      } catch {
        // Silencioso en entornos restringidos.
      }
    },
    async clear() {
      if (typeof indexedDB === 'undefined') return
      try {
        await db.meta.delete(DB_META_SECURITY_KEY)
      } catch {
        // Silencioso.
      }
    },
  }
}

export function readStoredUser(storage: StorageLike | null): AuthUser | null {
  const raw = safeGetItem(storage, AUTH_USER_KEY)
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return null
    if (typeof parsed.id !== 'string' || parsed.id.length === 0) return null
    if (typeof parsed.name !== 'string') return null
    if (typeof parsed.method !== 'string' || !VALID_AUTH_METHODS.has(parsed.method)) return null
    if (typeof parsed.loggedAt !== 'number' || !Number.isFinite(parsed.loggedAt)) return null

    return {
      id: parsed.id,
      name: parsed.name,
      method: parsed.method as AuthMethod,
      loggedAt: parsed.loggedAt,
      role: typeof parsed.role === 'string' ? parsed.role : undefined,
      email: typeof parsed.email === 'string' ? parsed.email : undefined,
      avatarUrl: typeof parsed.avatarUrl === 'string' ? parsed.avatarUrl : undefined,
    }
  } catch {
    return null
  }
}

export function readSecurityProfile(storage: StorageLike | null): DeviceSecurityProfile {
  return readNormalizedSecurityProfile(storage) ?? createEmptySecurityProfile()
}

function hasPendingCustomLegacyPin(
  storage: StorageLike | null,
  profile: DeviceSecurityProfile,
): boolean {
  if (!storage || profile.pinRecord !== null) return false
  const legacy = safeGetItem(storage, SAVED_PIN_KEY)?.trim()
  return Boolean(legacy && legacy !== DEFAULT_PIN && isValidPinFormat(legacy))
}

export function createAuthController(deps: AuthControllerDeps = {}) {
  const storage = deps.storage === undefined ? getSafeLocalStorage() : deps.storage
  const mirror = deps.mirror ?? createDexieMirror()
  const fetchFn = deps.fetchFn ?? fetch

  const notifyAll = () => {
    dispatchBrowserEvent(AUTH_CHANGE_EVENT)
    dispatchBrowserEvent(SECURITY_CHANGE_EVENT)
    deps.notify?.()
  }

  const persistUser = (user: AuthUser | null) => {
    if (storage) {
      if (user) safeSetItem(storage, AUTH_USER_KEY, JSON.stringify(user))
      else safeRemoveItem(storage, AUTH_USER_KEY)
    }
    notifyAll()
  }

  const persistProfile = (profile: DeviceSecurityProfile): DeviceSecurityProfile => {
    const stamped = { ...profile, updatedAt: Date.now() }
    safeSetItem(storage, SECURITY_STATE_KEY, JSON.stringify(stamped))
    void Promise.resolve(mirror.save(stamped)).catch(() => {})
    notifyAll()
    return stamped
  }

  const runEnsureLegacyPinMigrated = async (): Promise<DeviceSecurityProfile> => {
    const profile = readSecurityProfile(storage)
    const legacyRaw = safeGetItem(storage, SAVED_PIN_KEY)?.trim()
    if (!legacyRaw || !storage) return profile

    if (legacyRaw === DEFAULT_PIN) {
      safeRemoveItem(storage, SAVED_PIN_KEY)
      return profile
    }
    if (profile.pinRecord === null && isValidPinFormat(legacyRaw)) {
      const record = await hashPin(legacyRaw)
      const latest = readSecurityProfile(storage)
      safeRemoveItem(storage, SAVED_PIN_KEY)
      return persistProfile({ ...latest, pinRecord: latest.pinRecord ?? record })
    }
    safeRemoveItem(storage, SAVED_PIN_KEY)
    return profile
  }

  const ensureLegacyPinMigrated = (): Promise<DeviceSecurityProfile> => {
    if (!storage) return runEnsureLegacyPinMigrated()
    const existing = pendingMigrations.get(storage)
    if (existing) return existing
    const promise = runEnsureLegacyPinMigrated().finally(() => {
      if (pendingMigrations.get(storage) === promise) {
        pendingMigrations.delete(storage)
      }
    })
    pendingMigrations.set(storage, promise)
    return promise
  }

  const runHydrateFromMirror = async (): Promise<void> => {
    await ensureLegacyPinMigrated()
    let mirrored: DeviceSecurityProfile | null = null
    try {
      mirrored = normalizeSecurityProfile(await mirror.load())
    } catch {
      mirrored = null
    }
    if (!mirrored) return

    const storedLocal = readNormalizedSecurityProfile(storage)
    const hasLocalPersisted = storedLocal !== null
    const local = storedLocal ?? createEmptySecurityProfile()
    const now = Date.now()
    const localLockedUntil = local.pinRecord?.lockedUntil ?? 0
    const mirrorLockedUntil = mirrored.pinRecord?.lockedUntil ?? 0
    const activeLocalLock = localLockedUntil > now ? localLockedUntil : 0
    const activeMirrorLock = mirrorLockedUntil > now ? mirrorLockedUntil : 0
    const maxLockedUntil = Math.max(activeLocalLock, activeMirrorLock) || null

    if (
      !hasLocalPersisted ||
      mirrored.updatedAt > local.updatedAt ||
      (!isProtectionConfigured(local) && isProtectionConfigured(mirrored))
    ) {
      const mergedPinRecord = mirrored.pinRecord
        ? {
            ...mirrored.pinRecord,
            failedAttempts:
              activeLocalLock > activeMirrorLock
                ? Math.max(local.pinRecord?.failedAttempts ?? 0, mirrored.pinRecord.failedAttempts)
                : mirrored.pinRecord.failedAttempts,
            lockedUntil: maxLockedUntil,
          }
        : local.pinRecord && localLockedUntil > now
          ? local.pinRecord
          : null

      const merged: DeviceSecurityProfile = {
        ...mirrored,
        pinRecord: mergedPinRecord,
      }
      safeSetItem(storage, SECURITY_STATE_KEY, JSON.stringify(merged))
      if (activeLocalLock > activeMirrorLock) {
        void Promise.resolve(mirror.save(merged)).catch(() => {})
      }
      notifyAll()
    } else if (activeMirrorLock > activeLocalLock && local.pinRecord) {
      persistProfile({
        ...local,
        pinRecord: {
          ...local.pinRecord,
          failedAttempts: Math.max(
            local.pinRecord.failedAttempts,
            mirrored.pinRecord?.failedAttempts ?? 0,
          ),
          lockedUntil: mirrorLockedUntil,
        },
      })
    }
  }

  const hydrateFromMirror = (): Promise<void> => {
    if (!storage) return runHydrateFromMirror()
    const existing = pendingHydrations.get(storage)
    if (existing) return existing
    const promise = runHydrateFromMirror().finally(() => {
      if (pendingHydrations.get(storage) === promise) {
        pendingHydrations.delete(storage)
      }
    })
    pendingHydrations.set(storage, promise)
    return promise
  }

  const getState = () => {
    const user = readStoredUser(storage)
    const securityProfile = readSecurityProfile(storage)
    const protectionConfigured =
      isProtectionConfigured(securityProfile) || hasPendingCustomLegacyPin(storage, securityProfile)
    const pinEnabled =
      !protectionConfigured ||
      securityProfile.pinRecord !== null ||
      hasPendingCustomLegacyPin(storage, securityProfile)
    const pinLength: 4 | 6 = securityProfile.pinRecord?.pinLength ?? 4
    const lockedUntil = securityProfile.pinRecord?.lockedUntil ?? null
    const hasPasskeys = securityProfile.passkeys.length > 0
    return {
      user,
      isAuthenticated: Boolean(user),
      securityProfile,
      protectionConfigured,
      pinEnabled,
      pinLength,
      lockedUntil,
      hasPasskeys,
    }
  }

  const loginWithPin = async (inputPin: string): Promise<PinLoginResult> => {
    const profile = await ensureLegacyPinMigrated()
    if (profile.pinRecord) {
      const attempt = await evaluatePinAttempt(inputPin.trim(), profile.pinRecord)
      persistProfile({ ...profile, pinRecord: attempt.nextRecord })
      if (!attempt.ok) {
        return { success: false, error: attempt.error, lockedUntil: attempt.nextRecord.lockedUntil }
      }
      const user = createPinUser()
      persistUser(user)
      return { success: true, user }
    }

    if (isProtectionConfigured(profile)) {
      return {
        success: false,
        error: 'El ingreso por PIN está deshabilitado. Usa tu llave FIDO o Google.',
      }
    }

    if (inputPin.trim() === DEFAULT_PIN) {
      const user = createPinUser()
      persistUser(user)
      return { success: true, user }
    }

    return {
      success: false,
      error: 'PIN incorrecto. El PIN inicial de demostración es 1234.',
    }
  }

  const loginWithCredentials = (
    username: string,
    password: string,
  ): { success: boolean; error?: string; user?: AuthUser } => {
    if (getState().protectionConfigured) {
      return {
        success: false,
        error: 'El modo credenciales demo está deshabilitado en equipos protegidos.',
      }
    }
    const check = validateCredentials(username, password)
    if (!check.isValid || !check.user) {
      return { success: false, error: check.error || 'Usuario o contraseña incorrectos.' }
    }
    persistUser(check.user)
    return { success: true, user: check.user }
  }

  const loginOfflineEmergency = (): { success: boolean; error?: string; user?: AuthUser } => {
    if (getState().protectionConfigured) {
      return {
        success: false,
        error: 'El ingreso rápido de urgencias está bloqueado al tener PIN o FIDO.',
      }
    }
    const user = createOfflineEmergencyUser()
    persistUser(user)
    return { success: true, user }
  }

  const loginWithFido = async (): Promise<{
    success: boolean
    error?: string
    user?: AuthUser
  }> => {
    const profile = readSecurityProfile(storage)
    const res = await authenticateWithPasskey(profile.passkeys, {
      displayName: profile.ownerName ?? undefined,
      fetchFn,
      credentialsApi: deps.credentialsApi,
    })
    if (!res.ok) return { success: false, error: res.error }

    const updatedPasskeys = profile.passkeys.map((pk) =>
      pk.credentialId === res.matchedCredentialId
        ? { ...pk, signCount: Math.max(pk.signCount, res.nextSignCount), lastUsedAt: Date.now() }
        : pk,
    )
    const nextPinRecord =
      profile.pinRecord && (profile.pinRecord.lockedUntil || profile.pinRecord.failedAttempts > 0)
        ? { ...profile.pinRecord, failedAttempts: 0, lockedUntil: null }
        : profile.pinRecord

    persistProfile({ ...profile, passkeys: updatedPasskeys, pinRecord: nextPinRecord })
    const user = createFidoUser({
      id: res.user.id,
      name: profile.ownerName || res.user.name,
      email: profile.ownerEmail || res.user.email,
    })
    persistUser(user)
    return { success: true, user }
  }

  const completeGoogleLogin = (
    googleProfile: GoogleIdentityProfile,
    opts?: { allowRecovery?: boolean },
  ): { success: boolean; error?: string; needsPinResetOption?: boolean; user?: AuthUser } => {
    const profile = readSecurityProfile(storage)
    if (hasPendingCustomLegacyPin(storage, profile)) {
      if (!profile.ownerEmail) {
        return {
          success: false,
          error: 'Este equipo está protegido solo con PIN/FIDO local y no tiene cuenta Google vinculada.',
        }
      }
      if (googleProfile.email.trim().toLowerCase() !== profile.ownerEmail.trim().toLowerCase()) {
        return {
          success: false,
          error: `Este terminal está vinculado a ${profile.ownerEmail}. Usa esa cuenta o restablece el terminal local.`,
        }
      }
    }

    const check = canGoogleUnlockDevice(googleProfile.email, profile)
    if (!check.allowed) {
      return {
        success: false,
        error:
          check.reason === 'local_protection_no_google'
            ? 'Este equipo está protegido solo con PIN/FIDO local y no tiene cuenta Google vinculada.'
            : `Este terminal está vinculado a ${profile.ownerEmail}. Usa esa cuenta o restablece el terminal local.`,
      }
    }

    const hadPin = profile.pinRecord !== null
    const nextPinRecord =
      profile.pinRecord &&
      (opts?.allowRecovery || profile.pinRecord.lockedUntil || profile.pinRecord.failedAttempts > 0)
        ? { ...profile.pinRecord, failedAttempts: 0, lockedUntil: null }
        : profile.pinRecord

    persistProfile({
      ...profile,
      ownerEmail: googleProfile.email,
      ownerName: googleProfile.name,
      ownerSub: googleProfile.sub,
      ownerAvatarUrl: googleProfile.avatarUrl ?? null,
      pinRecord: nextPinRecord,
    })
    const user = createGoogleUser(googleProfile.email, googleProfile.name, googleProfile.avatarUrl)
    persistUser(user)
    return {
      success: true,
      needsPinResetOption: Boolean(opts?.allowRecovery && hadPin),
      user,
    }
  }

  const linkGoogleAccount = (
    googleProfile: GoogleIdentityProfile,
  ): { success: boolean; error?: string } => {
    if (!readStoredUser(storage)) {
      return { success: false, error: 'Debes estar autenticado para vincular una cuenta Google.' }
    }
    const profile = readSecurityProfile(storage)
    persistProfile({
      ...profile,
      ownerEmail: googleProfile.email,
      ownerName: googleProfile.name,
      ownerSub: googleProfile.sub,
      ownerAvatarUrl: googleProfile.avatarUrl ?? null,
    })
    return { success: true }
  }

  const setupOrChangePin = async (
    newPin: string,
    opts?: { currentPin?: string },
  ): Promise<{ success: boolean; error?: string }> => {
    const currentUser = readStoredUser(storage)
    if (!currentUser) return { success: false, error: 'Sesión requerida para configurar el PIN.' }
    if (!isValidPinFormat(newPin)) {
      return { success: false, error: 'El PIN debe tener exactamente 4 o 6 dígitos numéricos.' }
    }
    const profile = await ensureLegacyPinMigrated()
    if (profile.pinRecord && opts?.currentPin !== undefined) {
      const okOld = await verifyPinHash(opts.currentPin, profile.pinRecord)
      if (!okOld) return { success: false, error: 'El PIN actual ingresado no coincide.' }
    }
    const nextRecord = await hashPin(newPin)
    safeRemoveItem(storage, SAVED_PIN_KEY)
    persistProfile({ ...profile, pinRecord: nextRecord })
    return { success: true }
  }

  const removePin = (): { success: boolean; error?: string } => {
    if (!readStoredUser(storage)) return { success: false, error: 'Sesión requerida.' }
    const profile = readSecurityProfile(storage)
    safeRemoveItem(storage, SAVED_PIN_KEY)
    persistProfile({ ...profile, pinRecord: null })
    return { success: true }
  }

  const registerDevicePasskey = async (
    label: string,
  ): Promise<{ success: boolean; error?: string; passkey?: StoredPasskey }> => {
    const user = readStoredUser(storage)
    if (!user) {
      return { success: false, error: 'Debes iniciar sesión antes de registrar una passkey.' }
    }
    const profile = readSecurityProfile(storage)
    const res = await registerPasskey({
      label,
      ownerEmail: profile.ownerEmail,
      ownerSub: profile.ownerSub,
      displayName: profile.ownerName || user.name,
      fetchFn,
      credentialsApi: deps.credentialsApi,
    })
    if (!res.ok) return { success: false, error: res.error }

    const deduped = profile.passkeys.filter((p) => p.credentialId !== res.passkey.credentialId)
    persistProfile({ ...profile, passkeys: [...deduped, res.passkey] })
    return { success: true, passkey: res.passkey }
  }

  const removeDevicePasskey = (credentialId: string): void => {
    const profile = readSecurityProfile(storage)
    persistProfile({
      ...profile,
      passkeys: profile.passkeys.filter((p) => p.credentialId !== credentialId),
    })
  }

  const logout = (): void => {
    persistUser(null)
  }

  const resetLocalTerminalSecurity = async (): Promise<void> => {
    safeRemoveItem(storage, SECURITY_STATE_KEY)
    safeRemoveItem(storage, SAVED_PIN_KEY)
    safeRemoveItem(storage, AUTH_USER_KEY)
    try {
      await mirror.clear()
    } catch {
      // Silencioso en entornos sin almacenamiento persistente.
    }
    await logoutServerAuthSession(fetchFn)
    notifyAll()
  }

  return {
    getState,
    hydrateFromMirror,
    ensureLegacyPinMigrated,
    loginWithPin,
    loginWithCredentials,
    loginOfflineEmergency,
    loginWithFido,
    completeGoogleLogin,
    linkGoogleAccount,
    setupOrChangePin,
    removePin,
    registerDevicePasskey,
    removeDevicePasskey,
    logout,
    resetLocalTerminalSecurity,
  }
}

export function useAuth() {
  const [, setRevision] = useState(0)
  const bump = useCallback(() => setRevision((r) => r + 1), [])

  const controller = useMemo(() => createAuthController({ notify: bump }), [bump])

  useEffect(() => {
    void controller.hydrateFromMirror()
    const onSync = () => bump()
    window.addEventListener(AUTH_CHANGE_EVENT, onSync)
    window.addEventListener(SECURITY_CHANGE_EVENT, onSync)
    window.addEventListener('storage', onSync)
    return () => {
      window.removeEventListener(AUTH_CHANGE_EVENT, onSync)
      window.removeEventListener(SECURITY_CHANGE_EVENT, onSync)
      window.removeEventListener('storage', onSync)
    }
  }, [controller, bump])

  const state = controller.getState()

  return {
    ...state,
    loginWithPin: controller.loginWithPin,
    loginWithCredentials: controller.loginWithCredentials,
    loginOfflineEmergency: controller.loginOfflineEmergency,
    loginWithFido: controller.loginWithFido,
    completeGoogleLogin: controller.completeGoogleLogin,
    linkGoogleAccount: controller.linkGoogleAccount,
    setupOrChangePin: controller.setupOrChangePin,
    removePin: controller.removePin,
    registerDevicePasskey: controller.registerDevicePasskey,
    removeDevicePasskey: controller.removeDevicePasskey,
    resetLocalTerminalSecurity: controller.resetLocalTerminalSecurity,
    logout: controller.logout,
  }
}
