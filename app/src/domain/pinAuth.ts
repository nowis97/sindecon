import { fromBase64Url, toBase64Url } from '../../shared/webauthnCrypto'

export const PIN_ITERATIONS = 150_000
const textEncoder = new TextEncoder()

export interface PinRecord {
  version: 2
  pinLength: 4 | 6
  saltB64: string
  hashB64: string
  iterations: number
  failedAttempts: number
  lockedUntil: number | null
  updatedAt: number
}

export function isValidPinFormat(pin: string): boolean {
  return /^(?:\d{4}|\d{6})$/.test(pin)
}

async function derivePinBits(
  pin: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    baseKey,
    256,
  )
  return new Uint8Array(bits)
}

function constantTimeBytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a[i]! ^ b[i]!
  }
  return diff === 0
}

/** Genera hash PBKDF2-SHA256 con salt aleatorio de 16 bytes para PIN de 4 o 6 dígitos. */
export async function hashPin(pin: string): Promise<PinRecord> {
  if (!isValidPinFormat(pin)) {
    throw new Error('El PIN debe tener exactamente 4 o 6 dígitos numéricos.')
  }
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derivePinBits(pin, salt, PIN_ITERATIONS)
  return {
    version: 2,
    pinLength: pin.length as 4 | 6,
    saltB64: toBase64Url(salt),
    hashB64: toBase64Url(hash),
    iterations: PIN_ITERATIONS,
    failedAttempts: 0,
    lockedUntil: null,
    updatedAt: Date.now(),
  }
}

export async function verifyPinHash(pin: string, record: PinRecord): Promise<boolean> {
  const salt = fromBase64Url(record.saltB64)
  const expected = fromBase64Url(record.hashB64)
  if (!salt || !expected || salt.length === 0 || expected.length === 0) return false
  const iterations =
    typeof record.iterations === 'number' && record.iterations > 0
      ? record.iterations
      : PIN_ITERATIONS
  const candidate = await derivePinBits(pin, salt, iterations)
  return constantTimeBytesEqual(candidate, expected)
}

export function computeLockoutAfterFailure(
  failedAttempts: number,
  now = Date.now(),
): { failedAttempts: number; lockedUntil: number | null; lockSeconds: number } {
  const schedule: Record<number, number> = { 5: 30, 6: 120, 7: 300 }
  const lockSeconds = failedAttempts < 5 ? 0 : (schedule[failedAttempts] ?? 900)
  return {
    failedAttempts,
    lockedUntil: lockSeconds > 0 ? now + lockSeconds * 1000 : null,
    lockSeconds,
  }
}

export async function evaluatePinAttempt(
  inputPin: string,
  record: PinRecord,
  now = Date.now(),
): Promise<{
  ok: boolean
  error?: string
  lockedRemainingSeconds: number
  nextRecord: PinRecord
}> {
  if (record.lockedUntil && now < record.lockedUntil) {
    const secs = Math.max(1, Math.ceil((record.lockedUntil - now) / 1000))
    return {
      ok: false,
      error: `Terminal bloqueado temporalmente. Reintenta en ${secs} s.`,
      lockedRemainingSeconds: secs,
      nextRecord: record,
    }
  }

  const matched = await verifyPinHash(inputPin, record)
  if (matched) {
    return {
      ok: true,
      lockedRemainingSeconds: 0,
      nextRecord: {
        ...record,
        failedAttempts: 0,
        lockedUntil: null,
        updatedAt: now,
      },
    }
  }

  const nextFailed = record.failedAttempts + 1
  const lock = computeLockoutAfterFailure(nextFailed, now)
  const nextRecord: PinRecord = {
    ...record,
    failedAttempts: lock.failedAttempts,
    lockedUntil: lock.lockedUntil,
    updatedAt: now,
  }

  const remaining = Math.max(0, 5 - nextFailed)
  const error =
    lock.lockSeconds > 0
      ? `Demasiados intentos fallidos. Espera ${lock.lockSeconds} s (o usa FIDO / Google).`
      : `PIN incorrecto. Quedan ${remaining} ${remaining === 1 ? 'intento' : 'intentos'} antes de pausa temporal.`

  return {
    ok: false,
    error,
    lockedRemainingSeconds: lock.lockSeconds,
    nextRecord,
  }
}
