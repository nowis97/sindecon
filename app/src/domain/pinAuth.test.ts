import { describe, it, expect } from 'vitest'
import {
  PIN_ITERATIONS,
  hashPin,
  verifyPinHash,
  computeLockoutAfterFailure,
  isValidPinFormat,
  evaluatePinAttempt,
} from './pinAuth'

describe('pinAuth (PBKDF2-SHA256 & Lockout)', () => {
  it('acepta PIN de 4 o 6 dígitos numéricos y rechaza otros largos', () => {
    expect(isValidPinFormat('1234')).toBe(true)
    expect(isValidPinFormat('482910')).toBe(true)
    expect(isValidPinFormat('123')).toBe(false)
    expect(isValidPinFormat('12345')).toBe(false)
    expect(isValidPinFormat('12ab')).toBe(false)
    expect(isValidPinFormat('')).toBe(false)
  })

  it('deriva hash PBKDF2-SHA256 con salt único y verifica PIN correcto e incorrecto', async () => {
    const rec1 = await hashPin('482910')
    const rec2 = await hashPin('482910')

    expect(rec1.iterations).toBe(PIN_ITERATIONS)
    expect(rec1.pinLength).toBe(6)
    expect(rec1.saltB64).not.toBe(rec2.saltB64)
    expect(rec1.hashB64).not.toContain('482910')
    expect(await verifyPinHash('482910', rec1)).toBe(true)
    expect(await verifyPinHash('000000', rec1)).toBe(false)
  })

  it('rechaza registros con salt o hash vacío o malformado', async () => {
    const rec = await hashPin('1234')
    expect(await verifyPinHash('1234', { ...rec, saltB64: '' })).toBe(false)
    expect(await verifyPinHash('1234', { ...rec, hashB64: '' })).toBe(false)
    expect(await verifyPinHash('1234', { ...rec, saltB64: '!!!' })).toBe(false)
    expect(await verifyPinHash('1234', { ...rec, iterations: Number.NaN })).toBe(true)
    expect(await verifyPinHash('1234', { ...rec, iterations: Number.POSITIVE_INFINITY })).toBe(true)
    await expect(hashPin('123')).rejects.toThrow()
  })

  it('aplica espera exponencial persistente a partir del 5to fallo', () => {
    const t0 = 1_700_000_000_000
    expect(computeLockoutAfterFailure(4, t0)).toMatchObject({ failedAttempts: 4, lockedUntil: null, lockSeconds: 0 })
    expect(computeLockoutAfterFailure(5, t0)).toMatchObject({ failedAttempts: 5, lockedUntil: t0 + 30_000, lockSeconds: 30 })
    expect(computeLockoutAfterFailure(6, t0)).toMatchObject({ failedAttempts: 6, lockedUntil: t0 + 120_000, lockSeconds: 120 })
    expect(computeLockoutAfterFailure(7, t0)).toMatchObject({ failedAttempts: 7, lockedUntil: t0 + 300_000, lockSeconds: 300 })
    expect(computeLockoutAfterFailure(8, t0)).toMatchObject({ failedAttempts: 8, lockedUntil: t0 + 900_000, lockSeconds: 900 })
  })

  it('bloquea intentos mientras lockedUntil está activo e incrementa failedAttempts en fallos', async () => {
    const record = await hashPin('7391')
    const t0 = 1_700_000_000_000

    let state = record
    for (let i = 0; i < 5; i++) {
      const res = await evaluatePinAttempt('0000', state, t0 + i)
      expect(res.ok).toBe(false)
      state = res.nextRecord
    }

    expect(state.failedAttempts).toBe(5)
    expect(state.lockedUntil).toBeGreaterThan(t0)

    // Incluso con el PIN correcto, mientras siga bloqueado no permite entrar
    const lockedRes = await evaluatePinAttempt('7391', state, t0 + 5_000)
    expect(lockedRes.ok).toBe(false)
    expect(lockedRes.lockedRemainingSeconds).toBeGreaterThan(20)

    // Tras expirar el lockout, el PIN correcto resetea fallos
    const unlockedRes = await evaluatePinAttempt('7391', state, state.lockedUntil! + 1)
    expect(unlockedRes.ok).toBe(true)
    expect(unlockedRes.nextRecord.failedAttempts).toBe(0)
    expect(unlockedRes.nextRecord.lockedUntil).toBeNull()
  })
})
