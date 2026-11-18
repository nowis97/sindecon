export interface AuthUser {
  id: string
  name: string
  role?: string
  method: 'pin' | 'credentials' | 'google' | 'offline'
  loggedAt: number
}

export const AUTH_USER_KEY = 'sindecon_auth_user'
export const SAVED_PIN_KEY = 'sindecon_saved_pin'
export const DEFAULT_PIN = '1234'

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

export function createGoogleUser(googleEmail?: string): AuthUser {
  return {
    id: googleEmail || 'google-user',
    name: googleEmail ? googleEmail.split('@')[0] : 'Usuario Google Drive',
    role: 'Google Cloud Sync',
    method: 'google',
    loggedAt: Date.now(),
  }
}
