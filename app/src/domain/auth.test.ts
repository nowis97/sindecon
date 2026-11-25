import { describe, it, expect } from 'vitest'
import {
  validatePin,
  createPinUser,
  validateCredentials,
  createOfflineEmergencyUser,
  createGoogleUser,
  DEFAULT_PIN,
  SECURITY_STATE_KEY,
  createEmptySecurityProfile,
  isProtectionConfigured,
  canGoogleUnlockDevice,
  createFidoUser,
} from './auth'
import { hashPin } from './pinAuth'

describe('Domain Auth Logic', () => {
  describe('validatePin', () => {
    it('valida exitosamente el PIN correcto', () => {
      const res = validatePin(DEFAULT_PIN, DEFAULT_PIN)
      expect(res.isValid).toBe(true)
      expect(res.error).toBeUndefined()
    })

    it('falla con un PIN vacío o incorrecto', () => {
      const emptyRes = validatePin('')
      expect(emptyRes.isValid).toBe(false)
      expect(emptyRes.error).toContain('Ingresa tu PIN')

      const wrongRes = validatePin('0000', '1234')
      expect(wrongRes.isValid).toBe(false)
      expect(wrongRes.error).toContain('PIN incorrecto')
    })
  })

  describe('createPinUser', () => {
    it('crea usuario con rol de guardia y método pin', () => {
      const user = createPinUser()
      expect(user.method).toBe('pin')
      expect(user.name).toBe('Médico de Guardia')
      expect(user.role).toContain('Urgencias')
    })
  })

  describe('validateCredentials', () => {
    it('rechaza inputs vacíos', () => {
      expect(validateCredentials('', '1234').isValid).toBe(false)
      expect(validateCredentials('doctor@hospital.cl', '').isValid).toBe(false)
      expect(validateCredentials('doctor@hospital.cl', '12').isValid).toBe(false)
    })

    it('acepta credenciales y formatea el nombre médico', () => {
      const res = validateCredentials('valenzuela@hospital.cl', 'segura123')
      expect(res.isValid).toBe(true)
      expect(res.user?.name).toBe('Dr. Valenzuela')
      expect(res.user?.method).toBe('credentials')
    })
  })

  describe('createOfflineEmergencyUser', () => {
    it('crea un usuario de emergencia offline', () => {
      const user = createOfflineEmergencyUser()
      expect(user.method).toBe('offline')
      expect(user.name).toBe('Modo Urgencias')
    })
  })

  describe('createGoogleUser', () => {
    it('crea un usuario sincronizado con Google', () => {
      const user = createGoogleUser('medico@gmail.com')
      expect(user.method).toBe('google')
      expect(user.name).toBe('medico')
    })
  })
})

describe('DeviceSecurityProfile y reglas de propiedad Google', () => {
  it('expone clave de estado de seguridad y crea perfil vacío', () => {
    expect(SECURITY_STATE_KEY).toBe('sindecon_security_state')
    const empty = createEmptySecurityProfile()
    expect(empty).toMatchObject({
      version: 1,
      ownerEmail: null,
      ownerName: null,
      ownerSub: null,
      ownerAvatarUrl: null,
      pinRecord: null,
      passkeys: [],
    })
  })

  it('considera protectionConfigured=false en perfil vacío/nulo y true con PIN o FIDO', async () => {
    expect(isProtectionConfigured(null)).toBe(false)
    expect(isProtectionConfigured(undefined)).toBe(false)

    const empty = createEmptySecurityProfile()
    expect(isProtectionConfigured(empty)).toBe(false)

    const withPin = { ...empty, pinRecord: await hashPin('5920') }
    expect(isProtectionConfigured(withPin)).toBe(true)

    const withFido = {
      ...empty,
      passkeys: [
        {
          credentialId: 'cred-1',
          publicKeySpkiB64: 'spki',
          alg: -7,
          rpId: 'sindecon.pages.dev',
          label: 'Touch ID',
          signCount: 0,
          createdAt: Date.now(),
        },
      ],
    }
    expect(isProtectionConfigured(withFido)).toBe(true)
  })

  it('restringe desbloqueo Google al correo dueño cuando el terminal está protegido', async () => {
    const empty = createEmptySecurityProfile()
    expect(canGoogleUnlockDevice('alguien@gmail.com', empty)).toEqual({ allowed: true })

    const protectedWithOwner = {
      ...empty,
      ownerEmail: 'Dra.Martinez@gmail.com',
      pinRecord: await hashPin('482910'),
    }
    expect(canGoogleUnlockDevice(' dra.martinez@gmail.com ', protectedWithOwner)).toEqual({ allowed: true })
    expect(canGoogleUnlockDevice('intruso@gmail.com', protectedWithOwner)).toEqual({
      allowed: false,
      reason: 'owner_mismatch',
    })

    const protectedLocalOnly = {
      ...empty,
      pinRecord: await hashPin('482910'),
    }
    expect(canGoogleUnlockDevice('alguien@gmail.com', protectedLocalOnly)).toEqual({
      allowed: false,
      reason: 'local_protection_no_google',
    })
  })

  it('crea usuarios FIDO y Google con metadatos clínicos', () => {
    const fido = createFidoUser({ id: 'pk-1', email: 'doc@hospital.cl' })
    expect(fido.method).toBe('fido')
    expect(fido.name).toBe('doc')
    expect(fido.email).toBe('doc@hospital.cl')

    const fidoDefault = createFidoUser()
    expect(fidoDefault.id).toBe('fido-passkey-user')
    expect(fidoDefault.name).toBe('Médico (FIDO2)')

    const google = createGoogleUser('doc@hospital.cl', 'Dr. House', 'https://avatar.test/a.png')
    expect(google.method).toBe('google')
    expect(google.email).toBe('doc@hospital.cl')
    expect(google.name).toBe('Dr. House')
    expect(google.avatarUrl).toBe('https://avatar.test/a.png')
  })
})
