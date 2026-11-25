import type { PinRecord } from './pinAuth'

export type AuthMethod = 'pin' | 'credentials' | 'google' | 'offline' | 'fido'

export interface AuthUser {
  id: string
  name: string
  role?: string
  method: AuthMethod
  loggedAt: number
  email?: string
  avatarUrl?: string
}

export const AUTH_USER_KEY = 'sindecon_auth_user'
export const SAVED_PIN_KEY = 'sindecon_saved_pin'
export const DEFAULT_PIN = '1234'
export const SECURITY_STATE_KEY = 'sindecon_security_state'

export interface StoredPasskey {
  credentialId: string
  publicKeySpkiB64: string
  alg: number
  rpId: string
  label: string
  signCount: number
  sealedToken?: string
  ownerEmail?: string
  createdAt: number
  lastUsedAt?: number
}

export interface DeviceSecurityProfile {
  version: 1
  ownerEmail: string | null
  ownerName: string | null
  ownerSub: string | null
  ownerAvatarUrl: string | null
  pinRecord: PinRecord | null
  passkeys: StoredPasskey[]
  updatedAt: number
}

export function createEmptySecurityProfile(): DeviceSecurityProfile {
  return {
    version: 1,
    ownerEmail: null,
    ownerName: null,
    ownerSub: null,
    ownerAvatarUrl: null,
    pinRecord: null,
    passkeys: [],
    updatedAt: Date.now(),
  }
}

/** True cuando el equipo tiene PIN personalizado o al menos una llave FIDO2 activa. */
export function isProtectionConfigured(profile: DeviceSecurityProfile | null | undefined): boolean {
  if (!profile) return false
  return profile.pinRecord !== null || profile.passkeys.length > 0
}

/** Controla qué cuenta Google puede desbloquear o recuperar este equipo. */
export function canGoogleUnlockDevice(
  incomingEmail: string,
  profile: DeviceSecurityProfile | null | undefined,
): { allowed: boolean; reason?: 'owner_mismatch' | 'local_protection_no_google' } {
  if (!isProtectionConfigured(profile)) {
    return { allowed: true }
  }
  if (!profile?.ownerEmail) {
    return { allowed: false, reason: 'local_protection_no_google' }
  }
  if (incomingEmail.trim().toLowerCase() === profile.ownerEmail.trim().toLowerCase()) {
    return { allowed: true }
  }
  return { allowed: false, reason: 'owner_mismatch' }
}

export function validatePin(
  inputPin: string,
  expectedPin: string = DEFAULT_PIN,
): { isValid: boolean; error?: string } {
  if (!inputPin || inputPin.length === 0) {
    return { isValid: false, error: 'Ingresa tu PIN de acceso clínico.' }
  }
  if (inputPin === expectedPin) {
    return { isValid: true }
  }
  return { isValid: false, error: `PIN incorrecto. (PIN de prueba: ${expectedPin})` }
}

export function createPinUser(): AuthUser {
  return {
    id: 'clinical-pin-user',
    name: 'Médico de Guardia',
    role: 'Urgencias / Turno',
    method: 'pin',
    loggedAt: Date.now(),
  }
}

export function validateCredentials(
  email: string,
  password: string,
): { isValid: boolean; error?: string; user?: AuthUser } {
  if (!email.trim()) {
    return { isValid: false, error: 'Ingresa tu email institucional o ID médico.' }
  }
  if (!password.trim()) {
    return { isValid: false, error: 'Ingresa tu contraseña.' }
  }
  if (password.length < 4) {
    return { isValid: false, error: 'La contraseña debe tener al menos 4 caracteres.' }
  }
  const cleanName = email.split('@')[0]
  const formattedName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1)
  return {
    isValid: true,
    user: {
      id: email.toLowerCase(),
      name: `Dr. ${formattedName}`,
      role: 'Médico Facultativo',
      method: 'credentials',
      loggedAt: Date.now(),
    },
  }
}

export function createOfflineEmergencyUser(): AuthUser {
  return {
    id: 'offline-emergency',
    name: 'Modo Urgencias',
    role: 'Acceso Local Sin Conexión',
    method: 'offline',
    loggedAt: Date.now(),
  }
}

export function createGoogleUser(
  googleEmail?: string,
  name?: string,
  avatarUrl?: string,
): AuthUser {
  return {
    id: googleEmail || 'google-user',
    name: name?.trim() || (googleEmail ? googleEmail.split('@')[0]! : 'Usuario Google Drive'),
    role: 'Google Cloud Sync',
    method: 'google',
    loggedAt: Date.now(),
    email: googleEmail,
    avatarUrl,
  }
}

export function createFidoUser(opts?: { id?: string; name?: string; email?: string }): AuthUser {
  return {
    id: opts?.id || 'fido-passkey-user',
    name: opts?.name?.trim() || (opts?.email ? opts.email.split('@')[0]! : 'Médico (FIDO2)'),
    role: 'Acceso Biométrico',
    method: 'fido',
    loggedAt: Date.now(),
    email: opts?.email,
  }
}
