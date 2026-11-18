import { describe, it, expect } from 'vitest'
import {
  validatePin,
  createPinUser,
  validateCredentials,
  createOfflineEmergencyUser,
  createGoogleUser,
  DEFAULT_PIN,
} from './auth'

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
