# Autenticación Clínica con Google, FIDO2/WebAuthn y PIN Seguro — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar autenticación real con Google (`openid email profile` + conexión opcional de Drive), passkeys biométricas FIDO2/WebAuthn con verificación criptográfica online/offline, y PIN de guardia con hash `PBKDF2-SHA256`, bloqueo por intentos y recuperación vía Google manteniendo el costo en \$0/mes.

**Architecture:** Modelo híbrido *stateless* sobre el Worker gratuito de Cloudflare (`app/worker.ts`) sin bases de datos ni KV. Un núcleo WebCrypto puro compartido en `app/shared/webauthnCrypto.ts` verifica aserciones WebAuthn (`ES256`/`RS256`) tanto en los nuevos endpoints `/api/auth/fido/*` como localmente en modo offline (`app/src/domain/fidoAuth.ts`). Google Login usa `POST /api/auth/google` con cookie `HttpOnly` cifrada en `AES-256-GCM` (`sindecon_auth_session`) y respaldo GIS client-only cuando `vite dev` corre sin Wrangler; el PIN se deriva con `PBKDF2-SHA256` (`150.000` iteraciones) en `app/src/domain/pinAuth.ts`, activando el bloqueo estricto de `LoginView` al configurar protección.

**Tech Stack:** Cloudflare Workers / Pages Functions (`ES2023`, `WebWorker` Web APIs), WebAuthn (`navigator.credentials`), WebCrypto (`crypto.subtle`), Google Identity Services (`initCodeClient` / `initTokenClient`), React 19, TypeScript 6 (`verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals`, `noUnusedParameters`), Vite 8, Vitest (`environment: 'node'`), Playwright / Chrome DevTools Virtual Authenticator, Oxlint.

**Spec:** `docs/superpowers/specs/2026-11-25-google-fido-pin-auth-design.md`

## Global Constraints

- **Costo \$0/mes sin BD:** Prohibido agregar dependencias npm de auth, bases de datos externas o almacenamiento pagado. Toda criptografía en servidor y cliente usa Web APIs estándar (`crypto.subtle`, `TextEncoder`, `fetch`, `btoa`/`atob`).
- **TypeScript 6 estricto (`tsconfig.app.json` y `tsconfig.functions.json`):** Respetar `verbatimModuleSyntax: true`, `erasableSyntaxOnly: true` (sin `enum` ni propiedades en constructor), `noUnusedLocals: true` y `noUnusedParameters: true`.
- **`app/shared/` libre de DOM y Node:** Todo módulo en `app/shared/` debe compilar bajo `lib: ["ES2023", "WebWorker"]` y `lib: ["ES2023", "DOM"]` sin `window`, `document` ni `Buffer`.
- **Cookies *stateless* cifradas AES-256-GCM:** Clave derivada con `SHA-256(OAUTH_COOKIE_SECRET)`. Todas las cookies usan `HttpOnly; SameSite=Lax`, `Secure` en HTTPS (omitido en `localhost` / `127.0.0.1`), respuestas `POST` únicamente, validación CSRF por `Origin` / `Sec-Fetch-Site: same-origin` y cabeceras `Cache-Control: no-store, private` + `Vary: Cookie`.
- **Vitest en Node (`environment: 'node'`):** Las pruebas unitarias que usen almacenamiento (`localStorage`) deben aceptar o inyectar un `StorageLike` o stubear `globalThis.localStorage`.
- **Git atómico:** Cada tarea cierra con tests en verde y `git add <archivos específicos>` + `git commit` (nunca `git add -A`).

---

## Mapa de Archivos

| Archivo | Responsabilidad |
| :--- | :--- |
| `app/tsconfig.app.json`, `app/tsconfig.functions.json` | Incluir `shared/` en compilación de cliente y Worker/tests. |
| `app/shared/webauthnCrypto.ts`, `app/shared/webauthnCrypto.test.ts` | Utilidades base64url, SHA-256, conversión DER→P1363, parser COSE CBOR mínimo para clave P-256, `parseAuthenticatorData` y `verifyWebAuthnAssertion`. |
| `app/functions/api/oauth/_shared.ts` | Generalizar cifrado/lectura de cookies (`encryptSealedPayload`, `decryptSealedPayload`, `readCookieByName`, `buildScopedCookieHeader`) preservando las firmas OAuth existentes. |
| `app/functions/api/auth/_session.ts`, `google.ts`, `session.ts`, `logout.ts` | Cookie `sindecon_auth_session` (`Path=/api/auth`) y endpoints de login/sesión/logout con Google `openid email profile`. |
| `app/functions/api/auth/fido/challenge.ts`, `enroll.ts`, `verify.ts` | Endpoints *stateless* FIDO2 WebAuthn (`sindecon_fido_challenge` de un uso + `sealedToken` AES-GCM). |
| `app/worker.ts` | Registrar las 6 rutas `/api/auth/*` junto a `/api/oauth/*`. |
| `app/tests/oauth/auth.test.ts`, `app/tests/oauth/fido.test.ts` | Cobertura completa de Google Auth y FIDO2 con llaves ECDSA P-256 reales y pruebas anti-replay/CSRF. |
| `app/src/domain/pinAuth.ts`, `app/src/domain/pinAuth.test.ts` | Hash `PBKDF2-SHA256` (`150.000` iters), comparación constante, migración de PIN legado `1234`/custom y bloqueo exponencial persistente (`30s`→`2m`→`5m`→`15m`). |
| `app/src/domain/auth.ts`, `app/src/domain/auth.test.ts` | Modelo `AuthUser`, `DeviceSecurityProfile`, `isProtectionConfigured()`, regla `canGoogleUnlockDevice()` y validación segura de PIN. |
| `app/src/domain/fidoAuth.ts`, `app/src/domain/fidoAuth.test.ts` | Cliente WebAuthn (`registerPasskey`, `authenticateWithPasskey`), fallback offline y control anti-clonación `signCount`. |
| `app/src/pwa/googleAuth.ts`, `app/src/pwa/googleAuth.test.ts` | Flujo GIS `openid email profile` (`initiateGoogleLoginFlow`) con fallback `initTokenClient` en dev local, `checkServerAuthSession`, `logoutServerAuthSession`. |
| `app/src/hooks/useAuth.ts`, `app/src/hooks/useAuth.test.ts` | Hook unificado de autenticación reactivo (`loginWithGoogle`, `loginWithFido`, `loginWithPin`, `setupPin`, `changePin`, `removePin`, `registerDevicePasskey`, `removeDevicePasskey`, `resetDeviceSecurity`). |
| `app/src/components/auth/LoginView.tsx`, `app/src/components/auth/LoginView.test.ts` | Teclado 4/6 dígitos, FIDO real, Google login independiente, lockout con cuenta regresiva, recuperación `"¿Olvidaste tu PIN?"` y ocultación de bypass cuando `protectionConfigured = true`. |
| `app/src/components/auth/SecuritySettingsModal.tsx` | Modal de gestión de PIN, passkeys FIDO, cuenta Google vinculada y activación opcional de Drive. |
| `app/src/components/common/ClinicalStationHeader.tsx`, `Dashboard.tsx`, `FolderExplorerView.tsx`, `App.tsx` | Botón `"Seguridad"` en cabecera global y conexión integral de `useAuth`, `LoginView` y `SecuritySettingsModal`. |

---

### Task 1: Núcleo Compartido WebCrypto / WebAuthn (`app/shared/webauthnCrypto.ts`)

**Files:**
- Modify: `app/tsconfig.app.json:24-26`
- Modify: `app/tsconfig.functions.json:18-20`
- Create: `app/shared/webauthnCrypto.ts`
- Create: `app/shared/webauthnCrypto.test.ts`

**Interfaces:**
- Consumes: Web APIs estándar (`crypto.subtle`, `TextEncoder`, `TextDecoder`, `btoa`, `atob`)
- Produces:
  - `toBase64Url(bytes: Uint8Array): string`
  - `fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null`
  - `sha256(data: Uint8Array): Promise<Uint8Array<ArrayBuffer>>`
  - `ecdsaDerToP1363(derSig: Uint8Array): Uint8Array<ArrayBuffer> | null`
  - `extractP256SpkiFromAuthData(authData: Uint8Array): { credentialId: Uint8Array<ArrayBuffer>; publicKeySpki: Uint8Array<ArrayBuffer>; alg: -7 } | null`
  - `parseAuthenticatorData(authData: Uint8Array): { rpIdHash: Uint8Array<ArrayBuffer>; userPresent: boolean; userVerified: boolean; signCount: number } | null`
  - `verifyWebAuthnAssertion(input: VerifyAssertionInput): Promise<VerifyAssertionResult>`

- [ ] **Step 1: Actualizar `app/tsconfig.app.json` y `app/tsconfig.functions.json` para incluir `shared`**

En `app/tsconfig.app.json` cambiar `"include": ["src"]` a:
```json
  "include": ["src", "shared"]
```

En `app/tsconfig.functions.json` cambiar `"include": ["functions", "tests", "worker.ts"]` a:
```json
  "include": ["functions", "tests", "worker.ts", "shared"]
```

- [ ] **Step 2: Escribir las pruebas unitarias que fallan en `app/shared/webauthnCrypto.test.ts`**

Crear `app/shared/webauthnCrypto.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import {
  toBase64Url,
  fromBase64Url,
  verifyWebAuthnAssertion,
  extractP256SpkiFromAuthData,
} from './webauthnCrypto'

const enc = new TextEncoder()

function p1363ToDer(sig: Uint8Array): Uint8Array<ArrayBuffer> {
  const toAsn1Int = (slice: Uint8Array): Uint8Array => {
    let i = 0
    while (i < slice.length - 1 && slice[i] === 0) i++
    let trimmed = slice.slice(i)
    if (trimmed[0]! >= 0x80) {
      const padded = new Uint8Array(trimmed.length + 1)
      padded.set(trimmed, 1)
      trimmed = padded
    }
    const out = new Uint8Array(2 + trimmed.length)
    out[0] = 0x02
    out[1] = trimmed.length
    out.set(trimmed, 2)
    return out
  }
  const r = toAsn1Int(sig.slice(0, 32))
  const s = toAsn1Int(sig.slice(32, 64))
  const totalLen = r.length + s.length
  const der = new Uint8Array(2 + totalLen)
  der[0] = 0x30
  der[1] = totalLen
  der.set(r, 2)
  der.set(s, 2 + r.length)
  return der
}

async function buildSignedAssertion(opts?: {
  challenge?: string
  origin?: string
  rpId?: string
  flags?: number
  signCount?: number
  tamperSig?: boolean
}) {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  )
  const spkiBuf = await crypto.subtle.exportKey('spki', keyPair.publicKey)
  const spkiB64 = toBase64Url(new Uint8Array(spkiBuf))

  const expectedChallenge = opts?.challenge ?? 'test-challenge-b64url'
  const expectedOrigin = opts?.origin ?? 'https://sindecon.pages.dev'
  const expectedRpId = opts?.rpId ?? 'sindecon.pages.dev'

  const clientDataBytes = enc.encode(
    JSON.stringify({
      type: 'webauthn.get',
      challenge: expectedChallenge,
      origin: expectedOrigin,
    }),
  )
  const clientDataHash = new Uint8Array(await crypto.subtle.digest('SHA-256', clientDataBytes))

  const rpIdHash = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(expectedRpId)))
  const authData = new Uint8Array(37)
  authData.set(rpIdHash, 0)
  authData[32] = opts?.flags ?? 0x05 // UP (0x01) + UV (0x04)
  new DataView(authData.buffer).setUint32(33, opts?.signCount ?? 7, false)

  const signedPayload = new Uint8Array(authData.length + clientDataHash.length)
  signedPayload.set(authData, 0)
  signedPayload.set(clientDataHash, authData.length)

  const rawSig = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keyPair.privateKey, signedPayload),
  )
  const derSig = p1363ToDer(rawSig)
  if (opts?.tamperSig) {
    derSig[derSig.length - 1] ^= 0xff
  }

  return {
    publicKeySpkiB64: spkiB64,
    clientDataJSONB64: toBase64Url(clientDataBytes),
    authenticatorDataB64: toBase64Url(authData),
    signatureB64: toBase64Url(derSig),
  }
}

describe('webauthnCrypto', () => {
  it('hace roundtrip de base64url correctamente', () => {
    const src = new Uint8Array([0, 1, 255, 128, 63, 62])
    const encoded = toBase64Url(src)
    expect(encoded).not.toMatch(/[+/=]/)
    expect(Array.from(fromBase64Url(encoded)!)).toEqual(Array.from(src))
  })

  it('verifica una aserción WebAuthn ES256 válida (DER -> P1363)', async () => {
    const signed = await buildSignedAssertion()
    const res = await verifyWebAuthnAssertion({
      ...signed,
      alg: -7,
      expectedChallenge: 'test-challenge-b64url',
      expectedOrigin: 'https://sindecon.pages.dev',
      expectedRpId: 'sindecon.pages.dev',
      previousSignCount: 3,
    })
    expect(res).toEqual({ valid: true, signCount: 7 })
  })

  it('rechaza firma alterada, challenge distinto, UV=0 o signCount regresivo', async () => {
    const tampered = await buildSignedAssertion({ tamperSig: true })
    expect(
      (
        await verifyWebAuthnAssertion({
          ...tampered,
          alg: -7,
          expectedChallenge: 'test-challenge-b64url',
          expectedOrigin: 'https://sindecon.pages.dev',
          expectedRpId: 'sindecon.pages.dev',
        })
      ).valid,
    ).toBe(false)

    const validSigned = await buildSignedAssertion({ signCount: 5 })
    expect(
      (
        await verifyWebAuthnAssertion({
          ...validSigned,
          alg: -7,
          expectedChallenge: 'otro-challenge',
          expectedOrigin: 'https://sindecon.pages.dev',
          expectedRpId: 'sindecon.pages.dev',
        })
      ).valid,
    ).toBe(false)

    const noUv = await buildSignedAssertion({ flags: 0x01 }) // sin UV (0x04)
    expect(
      (
        await verifyWebAuthnAssertion({
          ...noUv,
          alg: -7,
          expectedChallenge: 'test-challenge-b64url',
          expectedOrigin: 'https://sindecon.pages.dev',
          expectedRpId: 'sindecon.pages.dev',
        })
      ).valid,
    ).toBe(false)

    const cloned = await buildSignedAssertion({ signCount: 4 })
    expect(
      (
        await verifyWebAuthnAssertion({
          ...cloned,
          alg: -7,
          expectedChallenge: 'test-challenge-b64url',
          expectedOrigin: 'https://sindecon.pages.dev',
          expectedRpId: 'sindecon.pages.dev',
          previousSignCount: 5,
        })
      ).valid,
    ).toBe(false)
  })

  it('extrae clave pública SPKI P-256 desde authenticatorData con credencial COSE (fallback CBOR)', () => {
    // Construir authenticatorData mínimo con bandera AT (0x40), credIdLen=4 e inline COSE map P-256
    const x = new Uint8Array(32).fill(0x11)
    const y = new Uint8Array(32).fill(0x22)
    // CBOR map(5): { 1: 2, 3: -7, -1: 1, -2: bstr(32), -3: bstr(32) }
    const cose = new Uint8Array([
      0xa5,
      0x01, 0x02,
      0x03, 0x26,
      0x20, 0x01,
      0x21, 0x58, 0x20, ...x,
      0x22, 0x58, 0x20, ...y,
    ])
    const authData = new Uint8Array(37 + 16 + 2 + 4 + cose.length)
    authData[32] = 0x45 // UP + UV + AT
    authData[37 + 16] = 0x00
    authData[37 + 17] = 0x04
    authData.set([1, 2, 3, 4], 37 + 18)
    authData.set(cose, 37 + 22)

    const extracted = extractP256SpkiFromAuthData(authData)
    expect(extracted).not.toBeNull()
    expect(Array.from(extracted!.credentialId)).toEqual([1, 2, 3, 4])
    expect(extracted!.alg).toBe(-7)
    // Header SPKI P-256 estándar mide 26 bytes + 65 bytes uncompressed point (0x04 || x || y) = 91 bytes
    expect(extracted!.publicKeySpki.length).toBe(91)
    expect(extracted!.publicKeySpki[26]).toBe(0x04)
  })
})
```

- [ ] **Step 3: Ejecutar test para confirmar que falla**

Run: `cd app && npx vitest run shared/webauthnCrypto.test.ts`
Expected: FAIL ("Failed to resolve import ./webauthnCrypto")

- [ ] **Step 4: Implementar `app/shared/webauthnCrypto.ts`**

Crear `app/shared/webauthnCrypto.ts`:
```typescript
const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

// Prefijo ASN.1 SPKI estándar para clave pública ECDSA P-256 (26 bytes) + 0x04 || X(32) || Y(32)
const P256_SPKI_PREFIX = new Uint8Array([
  0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86,
  0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a,
  0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03,
  0x42, 0x00,
])

export function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  if (!value) return null
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4)
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  } catch {
    return null
  }
}

export async function sha256(data: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const safeCopy = new Uint8Array(data)
  return new Uint8Array(await crypto.subtle.digest('SHA-256', safeCopy))
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a[i]! ^ b[i]!
  }
  return diff === 0
}

/** Convierte firma ECDSA P-256 ASN.1 DER (WebAuthn) a IEEE P1363 raw 64 bytes `(r || s)`. */
export function ecdsaDerToP1363(derSig: Uint8Array): Uint8Array<ArrayBuffer> | null {
  if (derSig.length < 8 || derSig[0] !== 0x30) return null
  let offset = 2
  if ((derSig[1]! & 0x80) !== 0) {
    const lenBytes = derSig[1]! & 0x7f
    if (lenBytes !== 1 || derSig.length < 10) return null
    offset = 3
  }
  if (derSig[offset] !== 0x02) return null
  const rLen = derSig[offset + 1]!
  const rStart = offset + 2
  const rEnd = rStart + rLen
  if (rEnd + 2 > derSig.length || derSig[rEnd] !== 0x02) return null
  const sLen = derSig[rEnd + 1]!
  const sStart = rEnd + 2
  const sEnd = sStart + sLen
  if (sEnd !== derSig.length) return null

  const copyCoord = (src: Uint8Array): Uint8Array | null => {
    let i = 0
    while (i < src.length - 1 && src[i] === 0) i++
    const trimmed = src.slice(i)
    if (trimmed.length > 32) return null
    const out = new Uint8Array(32)
    out.set(trimmed, 32 - trimmed.length)
    return out
  }

  const r = copyCoord(derSig.slice(rStart, rEnd))
  const s = copyCoord(derSig.slice(sStart, sEnd))
  if (!r || !s) return null

  const p1363 = new Uint8Array(64)
  p1363.set(r, 0)
  p1363.set(s, 32)
  return p1363
}

/** Parser CBOR mínimo suficiente para leer mapa COSE EC2 P-256 (`-2` = x, `-3` = y). */
function decodeCoseP256Coords(cbor: Uint8Array): { x: Uint8Array; y: Uint8Array } | null {
  let pos = 0
  const readHead = (): { major: number; val: number } | null => {
    if (pos >= cbor.length) return null
    const b = cbor[pos++]!
    const major = b >> 5
    const ai = b & 0x1f
    if (ai < 24) return { major, val: ai }
    if (ai === 24 && pos < cbor.length) return { major, val: cbor[pos++]! }
    if (ai === 25 && pos + 1 < cbor.length) {
      const v = (cbor[pos]! << 8) | cbor[pos + 1]!
      pos += 2
      return { major, val: v }
    }
    return null
  }

  const readItem = (): unknown => {
    const h = readHead()
    if (!h) return undefined
    if (h.major === 0) return h.val
    if (h.major === 1) return -1 - h.val
    if (h.major === 2 || h.major === 3) {
      if (pos + h.val > cbor.length) return undefined
      const slice = cbor.slice(pos, pos + h.val)
      pos += h.val
      return h.major === 2 ? slice : textDecoder.decode(slice)
    }
    if (h.major === 4) {
      const arr: unknown[] = []
      for (let i = 0; i < h.val; i++) arr.push(readItem())
      return arr
    }
    if (h.major === 5) {
      const map = new Map<unknown, unknown>()
      for (let i = 0; i < h.val; i++) {
        const k = readItem()
        const v = readItem()
        map.set(k, v)
      }
      return map
    }
    return undefined
  }

  const parsed = readItem()
  if (!(parsed instanceof Map)) return null
  const kty = parsed.get(1)
  const alg = parsed.get(3)
  const crv = parsed.get(-1)
  const x = parsed.get(-2)
  const y = parsed.get(-3)
  if (
    kty !== 2 ||
    alg !== -7 ||
    crv !== 1 ||
    !(x instanceof Uint8Array) ||
    !(y instanceof Uint8Array) ||
    x.length !== 32 ||
    y.length !== 32
  ) {
    return null
  }
  return { x, y }
}

/** Extrae credentialId y clave pública SPKI P-256 desde `authenticatorData` de `navigator.credentials.create`. */
export function extractP256SpkiFromAuthData(authData: Uint8Array): {
  credentialId: Uint8Array<ArrayBuffer>
  publicKeySpki: Uint8Array<ArrayBuffer>
  alg: -7
} | null {
  if (authData.length < 55) return null
  const hasAttestedData = (authData[32]! & 0x40) !== 0
  if (!hasAttestedData) return null

  const credIdLen = (authData[53]! << 8) | authData[54]!
  const credStart = 55
  const credEnd = credStart + credIdLen
  if (credIdLen === 0 || credEnd >= authData.length) return null

  const credentialId = new Uint8Array(authData.slice(credStart, credEnd))
  const coords = decodeCoseP256Coords(authData.slice(credEnd))
  if (!coords) return null

  const spki = new Uint8Array(P256_SPKI_PREFIX.length + 65)
  spki.set(P256_SPKI_PREFIX, 0)
  spki[P256_SPKI_PREFIX.length] = 0x04
  spki.set(coords.x, P256_SPKI_PREFIX.length + 1)
  spki.set(coords.y, P256_SPKI_PREFIX.length + 33)

  return { credentialId, publicKeySpki: spki, alg: -7 }
}

export function parseAuthenticatorData(authData: Uint8Array): {
  rpIdHash: Uint8Array<ArrayBuffer>
  userPresent: boolean
  userVerified: boolean
  signCount: number
} | null {
  if (authData.length < 37) return null
  const flags = authData[32]!
  const view = new DataView(authData.buffer, authData.byteOffset, authData.byteLength)
  return {
    rpIdHash: new Uint8Array(authData.slice(0, 32)),
    userPresent: (flags & 0x01) !== 0,
    userVerified: (flags & 0x04) !== 0,
    signCount: view.getUint32(33, false),
  }
}

export interface VerifyAssertionInput {
  publicKeySpkiB64: string
  alg: number
  clientDataJSONB64: string
  authenticatorDataB64: string
  signatureB64: string
  expectedChallenge: string
  expectedOrigin: string
  expectedRpId: string
  previousSignCount?: number
}

export type VerifyAssertionResult =
  | { valid: true; signCount: number }
  | { valid: false; reason: string }

/** Verifica criptográficamente una aserción WebAuthn (`ES256` o `RS256`). */
export async function verifyWebAuthnAssertion(
  input: VerifyAssertionInput,
): Promise<VerifyAssertionResult> {
  const clientDataBytes = fromBase64Url(input.clientDataJSONB64)
  const authDataBytes = fromBase64Url(input.authenticatorDataB64)
  const signatureBytes = fromBase64Url(input.signatureB64)
  const spkiBytes = fromBase64Url(input.publicKeySpkiB64)

  if (!clientDataBytes || !authDataBytes || !signatureBytes || !spkiBytes) {
    return { valid: false, reason: 'malformed_payload' }
  }

  let clientData: { type?: string; challenge?: string; origin?: string }
  try {
    clientData = JSON.parse(textDecoder.decode(clientDataBytes)) as {
      type?: string
      challenge?: string
      origin?: string
    }
  } catch {
    return { valid: false, reason: 'invalid_client_data_json' }
  }

  if (clientData.type !== 'webauthn.get') {
    return { valid: false, reason: 'invalid_ceremony_type' }
  }
  if (clientData.challenge !== input.expectedChallenge) {
    return { valid: false, reason: 'challenge_mismatch' }
  }
  if (clientData.origin !== input.expectedOrigin) {
    return { valid: false, reason: 'origin_mismatch' }
  }

  const parsedAuth = parseAuthenticatorData(authDataBytes)
  if (!parsedAuth) {
    return { valid: false, reason: 'invalid_auth_data' }
  }

  const expectedRpIdHash = await sha256(textEncoder.encode(input.expectedRpId))
  if (!constantTimeEqual(parsedAuth.rpIdHash, expectedRpIdHash)) {
    return { valid: false, reason: 'rpid_mismatch' }
  }
  if (!parsedAuth.userPresent || !parsedAuth.userVerified) {
    return { valid: false, reason: 'user_verification_required' }
  }

  if (
    typeof input.previousSignCount === 'number' &&
    input.previousSignCount > 0 &&
    parsedAuth.signCount > 0 &&
    parsedAuth.signCount <= input.previousSignCount
  ) {
    return { valid: false, reason: 'cloned_authenticator_detected' }
  }

  const clientHash = await sha256(clientDataBytes)
  const signedPayload = new Uint8Array(authDataBytes.length + clientHash.length)
  signedPayload.set(authDataBytes, 0)
  signedPayload.set(clientHash, authDataBytes.length)

  try {
    if (input.alg === -7) {
      const p1363Sig = ecdsaDerToP1363(signatureBytes)
      if (!p1363Sig) return { valid: false, reason: 'invalid_ecdsa_signature_encoding' }
      const cryptoKey = await crypto.subtle.importKey(
        'spki',
        spkiBytes,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify'],
      )
      const ok = await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        cryptoKey,
        p1363Sig,
        signedPayload,
      )
      return ok ? { valid: true, signCount: parsedAuth.signCount } : { valid: false, reason: 'bad_signature' }
    }

    if (input.alg === -257) {
      const cryptoKey = await crypto.subtle.importKey(
        'spki',
        spkiBytes,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify'],
      )
      const ok = await crypto.subtle.verify(
        { name: 'RSASSA-PKCS1-v1_5' },
        cryptoKey,
        signatureBytes,
        signedPayload,
      )
      return ok ? { valid: true, signCount: parsedAuth.signCount } : { valid: false, reason: 'bad_signature' }
    }

    return { valid: false, reason: 'unsupported_algorithm' }
  } catch {
    return { valid: false, reason: 'verification_error' }
  }
}
```

- [ ] **Step 5: Ejecutar test y comprobar tipos**

Run: `cd app && npx vitest run shared/webauthnCrypto.test.ts && npx tsc -b`
Expected: PASS (4 tests) y exit code `0`.

- [ ] **Step 6: Commit**

```bash
git add app/tsconfig.app.json app/tsconfig.functions.json app/shared/webauthnCrypto.ts app/shared/webauthnCrypto.test.ts
git commit -m "feat(auth): add shared WebCrypto WebAuthn assertion verifier"
```

---

### Task 2: Generalizar Cookies AES-GCM e Implementar Endpoints `/api/auth/google`, `/session` y `/logout`

**Files:**
- Modify: `app/functions/api/oauth/_shared.ts:1-221`
- Create: `app/functions/api/auth/_session.ts`
- Create: `app/functions/api/auth/google.ts`
- Create: `app/functions/api/auth/session.ts`
- Create: `app/functions/api/auth/logout.ts`
- Modify: `app/worker.ts:1-39`
- Test: `app/tests/oauth/_shared.test.ts` (regresión) y Create: `app/tests/oauth/auth.test.ts`

**Interfaces:**
- Consumes: `toBase64Url`, `fromBase64Url` desde `app/shared/webauthnCrypto.ts` (opcional o mantenido en `_shared.ts` compatible con `_shared.test.ts`)
- Produces:
  - En `_shared.ts`: `encryptSealedPayload<T>(payload: T, secret: string): Promise<string>`, `decryptSealedPayload<T>(token: string, secret: string): Promise<T | null>`, `readCookieByName(request: Request, cookieName: string): string | null`, `buildScopedCookieHeader(opts: { name: string; value: string; path: string; maxAgeSeconds: number; requestUrl: string }): string`
  - En `_session.ts`: `AUTH_COOKIE_NAME = 'sindecon_auth_session'`, `AUTH_COOKIE_PATH = '/api/auth'`, `AuthSessionPayload`
  - Rutas en `app/worker.ts`: `POST /api/auth/google`, `POST /api/auth/session`, `POST /api/auth/logout`

- [ ] **Step 1: Escribir pruebas que fallan en `app/tests/oauth/auth.test.ts`**

Crear `app/tests/oauth/auth.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import worker from '../../worker'
import type { OAuthEnv } from '../../functions/api/oauth/_shared'

const TEST_ENV: OAuthEnv = {
  GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'client-secret',
  OAUTH_COOKIE_SECRET: '0123456789abcdef0123456789abcdef',
}

function makeFakeIdToken(payload: Record<string, unknown>): string {
  const encodeJsonB64Url = (obj: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(obj))
    let bin = ''
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  }
  return `${encodeJsonB64Url({ alg: 'RS256', typ: 'JWT' })}.${encodeJsonB64Url(payload)}.sig`
}

function extractCookie(setCookie: string | null, name: string): string | null {
  if (!setCookie) return null
  const prefix = `${name}=`
  const idx = setCookie.indexOf(prefix)
  if (idx < 0) return null
  const rest = setCookie.slice(idx + prefix.length)
  const end = rest.indexOf(';')
  return decodeURIComponent(end >= 0 ? rest.slice(0, end) : rest)
}

describe('/api/auth/google, /session y /logout', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('canjea code de Google, valida id_token y emite cookie HttpOnly sindecon_auth_session', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'ya29.identity-only',
          expires_in: 3600,
          id_token: makeFakeIdToken({
            sub: 'google-sub-123',
            email: 'dra.martinez@gmail.com',
            email_verified: true,
            name: 'Dra. Martínez',
            picture: 'https://lh3.googleusercontent.com/a/avatar',
            aud: TEST_ENV.GOOGLE_CLIENT_ID,
            iss: 'https://accounts.google.com',
            exp: Math.floor(Date.now() / 1000) + 3600,
          }),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const loginReq = new Request('https://sindecon.pages.dev/api/auth/google', {
      method: 'POST',
      headers: { Origin: 'https://sindecon.pages.dev', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'auth-code-123' }),
    })

    const res = await worker.fetch(loginReq, TEST_ENV)
    expect(res.status).toBe(200)
    const json = (await res.json()) as {
      user: { sub: string; email: string; name: string }
      driveConnected: boolean
    }
    expect(json.user).toMatchObject({
      sub: 'google-sub-123',
      email: 'dra.martinez@gmail.com',
      name: 'Dra. Martínez',
    })
    expect(json.driveConnected).toBe(false)

    const cookieHeader = res.headers.get('Set-Cookie')
    expect(cookieHeader).toContain('sindecon_auth_session=')
    expect(cookieHeader).toContain('HttpOnly')
    expect(cookieHeader).toContain('Path=/api/auth')
    const cookieVal = extractCookie(cookieHeader, 'sindecon_auth_session')!

    const sessionReq = new Request('https://sindecon.pages.dev/api/auth/session', {
      method: 'POST',
      headers: {
        Origin: 'https://sindecon.pages.dev',
        Cookie: `sindecon_auth_session=${encodeURIComponent(cookieVal)}`,
      },
    })
    const sessionRes = await worker.fetch(sessionReq, TEST_ENV)
    expect(sessionRes.status).toBe(200)
    expect(await sessionRes.json()).toMatchObject({
      authenticated: true,
      user: { email: 'dra.martinez@gmail.com', sub: 'google-sub-123' },
    })

    const logoutReq = new Request('https://sindecon.pages.dev/api/auth/logout', {
      method: 'POST',
      headers: { Origin: 'https://sindecon.pages.dev' },
    })
    const logoutRes = await worker.fetch(logoutReq, TEST_ENV)
    expect(logoutRes.status).toBe(200)
    expect(logoutRes.headers.get('Set-Cookie')).toContain('Max-Age=0')
  })

  it('rechaza id_token con aud distinto o email no verificado', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'ya29.bad-aud',
          id_token: makeFakeIdToken({
            sub: 'sub-9',
            email: 'otro@gmail.com',
            email_verified: false,
            aud: 'otro-client.apps.googleusercontent.com',
            iss: 'https://accounts.google.com',
            exp: Math.floor(Date.now() / 1000) + 3600,
          }),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const req = new Request('https://sindecon.pages.dev/api/auth/google', {
      method: 'POST',
      headers: { Origin: 'https://sindecon.pages.dev', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'bad-code' }),
    })

    const res = await worker.fetch(req, TEST_ENV)
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Ejecutar test para confirmar falla (404 del worker actual)**

Run: `cd app && npx vitest run tests/oauth/auth.test.ts`
Expected: FAIL (`expected 404 to be 200`)

- [ ] **Step 3: Generalizar helpers en `app/functions/api/oauth/_shared.ts`**

Manteniendo todas las exportaciones existentes (`COOKIE_NAME`, `encryptCookiePayload`, `decryptCookiePayload`, `readSessionCookie`, `buildSessionSetCookieHeader`, `buildClearCookieHeader`, etc.), agregar en `app/functions/api/oauth/_shared.ts`:
```typescript
/** Cifra un objeto JSON arbitrario con AES-256-GCM y un IV aleatorio de 96 bits. */
export async function encryptSealedPayload<T>(payload: T, secret: string): Promise<string> {
  const key = await deriveAesKey(secret)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = encoder.encode(JSON.stringify(payload))
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext),
  )
  return `${toBase64Url(iv)}.${toBase64Url(ciphertext)}`
}

/** Descifra un payload AES-256-GCM; retorna null si está manipulado o malformado. */
export async function decryptSealedPayload<T>(
  token: string,
  secret: string,
): Promise<T | null> {
  if (!token || !secret) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null

  const iv = fromBase64Url(parts[0]!)
  const ciphertext = fromBase64Url(parts[1]!)
  if (!iv || !ciphertext || iv.length !== 12) return null

  try {
    const key = await deriveAesKey(secret)
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext,
    )
    return JSON.parse(decoder.decode(decrypted)) as T
  } catch {
    return null
  }
}

/** Extrae el valor crudo de una cookie por nombre desde el header Cookie. */
export function readCookieByName(request: Request, cookieName: string): string | null {
  const header = request.headers.get('Cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const eqIndex = part.indexOf('=')
    if (eqIndex <= 0) continue
    if (part.slice(0, eqIndex).trim() === cookieName) {
      const raw = part.slice(eqIndex + 1).trim()
      try {
        return decodeURIComponent(raw)
      } catch {
        return raw
      }
    }
  }
  return null
}

/** Construye una cabecera Set-Cookie parametrizada HttpOnly + SameSite=Lax. */
export function buildScopedCookieHeader(opts: {
  name: string
  value: string
  path: string
  maxAgeSeconds: number
  requestUrl: string
}): string {
  const encoded = opts.value ? encodeURIComponent(opts.value) : ''
  const attrs = [
    `${opts.name}=${encoded}`,
    'HttpOnly',
    'SameSite=Lax',
    `Path=${opts.path}`,
    `Max-Age=${opts.maxAgeSeconds}`,
  ]
  if (shouldSetSecureFlag(opts.requestUrl)) {
    attrs.push('Secure')
  }
  return attrs.join('; ')
}
```
*(Y simplificar `encryptCookiePayload` / `decryptCookiePayload` / `readSessionCookie` / `formatSessionCookie` para que deleguen en estos helpers genéricos sin duplicación).*

- [ ] **Step 4: Crear `app/functions/api/auth/_session.ts`, `google.ts`, `session.ts`, `logout.ts` y registrar en `app/worker.ts`**

Crear `app/functions/api/auth/_session.ts`:
```typescript
import {
  COOKIE_MAX_AGE_SECONDS,
  buildScopedCookieHeader,
  decryptSealedPayload,
  encryptSealedPayload,
  readCookieByName,
} from '../oauth/_shared'

export const AUTH_COOKIE_NAME = 'sindecon_auth_session'
export const AUTH_COOKIE_PATH = '/api/auth'

export interface AuthSessionUser {
  sub: string
  email: string
  name: string
  picture?: string
  method: 'google' | 'fido'
}

export interface AuthSessionPayload {
  user: AuthSessionUser
  iat: number
}

export async function createAuthCookieHeader(
  user: AuthSessionUser,
  secret: string,
  requestUrl: string,
): Promise<string> {
  const encrypted = await encryptSealedPayload<AuthSessionPayload>(
    { user, iat: Date.now() },
    secret,
  )
  return buildScopedCookieHeader({
    name: AUTH_COOKIE_NAME,
    value: encrypted,
    path: AUTH_COOKIE_PATH,
    maxAgeSeconds: COOKIE_MAX_AGE_SECONDS,
    requestUrl,
  })
}

export async function readAuthSessionCookie(
  request: Request,
  secret: string,
): Promise<AuthSessionPayload | null> {
  const raw = readCookieByName(request, AUTH_COOKIE_NAME)
  if (!raw) return null
  const payload = await decryptSealedPayload<AuthSessionPayload>(raw, secret)
  if (
    !payload ||
    !payload.user ||
    typeof payload.user.email !== 'string' ||
    typeof payload.user.sub !== 'string' ||
    typeof payload.iat !== 'number'
  ) {
    return null
  }
  return payload
}

export function clearAuthCookieHeader(requestUrl: string): string {
  return buildScopedCookieHeader({
    name: AUTH_COOKIE_NAME,
    value: '',
    path: AUTH_COOKIE_PATH,
    maxAgeSeconds: 0,
    requestUrl,
  })
}
```

Crear `app/functions/api/auth/google.ts`:
```typescript
import {
  COOKIE_NAME as GDRIVE_COOKIE_NAME,
  decryptCookiePayload,
  jsonResponse,
  readCookieByName,
  validateEnv,
  validateSameOriginPost,
  type CfPagesContext,
} from '../oauth/_shared'
import { createAuthCookieHeader, type AuthSessionUser } from './_session'

interface GoogleIdTokenClaims {
  sub?: string
  email?: string
  email_verified?: boolean
  name?: string
  picture?: string
  aud?: string
  iss?: string
  exp?: number
}

function parseJwtClaims(idToken: string): GoogleIdTokenClaims | null {
  const parts = idToken.split('.')
  if (parts.length < 2) return null
  try {
    const raw = parts[1]!
    const padded = raw.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((raw.length + 3) % 4)
    const bin = atob(padded)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return JSON.parse(new TextDecoder().decode(bytes)) as GoogleIdTokenClaims
  } catch {
    return null
  }
}

function isValidGoogleIdentity(claims: GoogleIdTokenClaims, clientId: string): boolean {
  const validIss =
    claims.iss === 'https://accounts.google.com' || claims.iss === 'accounts.google.com'
  const notExpired =
    typeof claims.exp !== 'number' || claims.exp * 1000 > Date.now() - 60_000
  return Boolean(
    validIss &&
      notExpired &&
      claims.aud === clientId &&
      claims.email_verified === true &&
      typeof claims.email === 'string' &&
      claims.email.length > 0 &&
      typeof claims.sub === 'string' &&
      claims.sub.length > 0,
  )
}

/** Canjea authorization code de GIS (`openid email profile`), verifica identidad Google y emite sesión HttpOnly. */
export async function onRequest(context: CfPagesContext): Promise<Response> {
  const originError = validateSameOriginPost(context.request)
  if (originError) return originError

  const envCheck = validateEnv(context.env)
  if (!envCheck.ok) return envCheck.response

  let code = ''
  try {
    const body = (await context.request.json()) as { code?: unknown }
    if (typeof body?.code === 'string') code = body.code.trim()
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400)
  }
  if (!code) return jsonResponse({ error: 'missing_code' }, 400)

  let googleRes: Response
  try {
    googleRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: envCheck.clientId,
        client_secret: envCheck.clientSecret,
        redirect_uri: 'postmessage',
        grant_type: 'authorization_code',
      }).toString(),
    })
  } catch {
    return jsonResponse({ error: 'upstream_unavailable' }, 502)
  }

  if (!googleRes.ok) {
    return googleRes.status >= 500 || googleRes.status === 429
      ? jsonResponse({ error: 'upstream_unavailable' }, 502)
      : jsonResponse({ error: 'oauth_exchange_failed' }, 401)
  }

  const tokenData = (await googleRes.json()) as {
    access_token?: string
    id_token?: string
  }

  let claims = tokenData.id_token ? parseJwtClaims(tokenData.id_token) : null
  if (!claims && tokenData.access_token) {
    try {
      const uiRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      })
      if (uiRes.ok) {
        const ui = (await uiRes.json()) as GoogleIdTokenClaims
        claims = {
          ...ui,
          aud: envCheck.clientId,
          iss: 'https://accounts.google.com',
        }
      }
    } catch {
      claims = null
    }
  }

  if (!claims || !isValidGoogleIdentity(claims, envCheck.clientId)) {
    return jsonResponse({ error: 'invalid_google_identity' }, 401)
  }

  const email = claims.email!
  const user: AuthSessionUser = {
    sub: claims.sub!,
    email,
    name: claims.name?.trim() || email.split('@')[0]!,
    picture: claims.picture,
    method: 'google',
  }

  // Verificar de forma pasiva si ya existe cookie Drive previa del mismo usuario (sin emitirla si no existía)
  const gdriveRaw = readCookieByName(context.request, GDRIVE_COOKIE_NAME)
  const gdriveSession = gdriveRaw
    ? await decryptCookiePayload(gdriveRaw, envCheck.cookieSecret)
    : null
  const driveConnected = Boolean(
    gdriveSession?.email && gdriveSession.email.toLowerCase() === email.toLowerCase(),
  )

  const setCookie = await createAuthCookieHeader(
    user,
    envCheck.cookieSecret,
    context.request.url,
  )

  return jsonResponse({ user, driveConnected }, 200, { 'Set-Cookie': setCookie })
}
```

Crear `app/functions/api/auth/session.ts` y `logout.ts`:
```typescript
// app/functions/api/auth/session.ts
import { jsonResponse, validateEnv, validateSameOriginPost, type CfPagesContext } from '../oauth/_shared'
import { clearAuthCookieHeader, readAuthSessionCookie } from './_session'

/** Valida la cookie HttpOnly sindecon_auth_session cuando el terminal consulta su sesión en red. */
export async function onRequest(context: CfPagesContext): Promise<Response> {
  const originError = validateSameOriginPost(context.request)
  if (originError) return originError

  const envCheck = validateEnv(context.env)
  if (!envCheck.ok) return envCheck.response

  const session = await readAuthSessionCookie(context.request, envCheck.cookieSecret)
  if (!session) {
    return jsonResponse({ authenticated: false }, 401, {
      'Set-Cookie': clearAuthCookieHeader(context.request.url),
    })
  }

  return jsonResponse({ authenticated: true, user: session.user }, 200)
}
```
```typescript
// app/functions/api/auth/logout.ts
import { jsonResponse, validateSameOriginPost, type CfPagesContext } from '../oauth/_shared'
import { clearAuthCookieHeader } from './_session'

/** Limpia la cookie HttpOnly de identidad al desvincular el dispositivo. */
export async function onRequest(context: CfPagesContext): Promise<Response> {
  const originError = validateSameOriginPost(context.request)
  if (originError) return originError

  return jsonResponse({ ok: true }, 200, {
    'Set-Cookie': clearAuthCookieHeader(context.request.url),
  })
}
```

Actualizar `app/worker.ts` agregando a la tabla de rutas `/api/auth/google`, `/api/auth/session`, `/api/auth/logout`:
```typescript
import { onRequest as handleGoogleAuth } from './functions/api/auth/google'
import { onRequest as handleAuthSession } from './functions/api/auth/session'
import { onRequest as handleAuthLogout } from './functions/api/auth/logout'
```
y en `OAUTH_ROUTES`:
```typescript
  ['/api/auth/google', handleGoogleAuth],
  ['/api/auth/session', handleAuthSession],
  ['/api/auth/logout', handleAuthLogout],
```

- [ ] **Step 5: Ejecutar pruebas y typecheck**

Run: `cd app && npx vitest run tests/oauth/auth.test.ts tests/oauth/_shared.test.ts tests/oauth/handlers.test.ts && npx tsc -b`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/functions/api/oauth/_shared.ts app/functions/api/auth/_session.ts app/functions/api/auth/google.ts app/functions/api/auth/session.ts app/functions/api/auth/logout.ts app/worker.ts app/tests/oauth/auth.test.ts
git commit -m "feat(auth): add stateless Cloudflare Worker endpoints for Google Sign-In"
```

---

### Task 3: Endpoints FIDO2 / WebAuthn *Stateless* (`/api/auth/fido/challenge`, `/enroll`, `/verify`)

**Files:**
- Create: `app/functions/api/auth/fido/challenge.ts`
- Create: `app/functions/api/auth/fido/enroll.ts`
- Create: `app/functions/api/auth/fido/verify.ts`
- Modify: `app/worker.ts:1-39`
- Create: `app/tests/oauth/fido.test.ts`

**Interfaces:**
- Consumes: `verifyWebAuthnAssertion` (`app/shared/webauthnCrypto.ts`), `encryptSealedPayload`/`decryptSealedPayload` (`_shared.ts`), `createAuthCookieHeader` (`_session.ts`)
- Produces:
  - `POST /api/auth/fido/challenge` → `{ challenge: string }` + `Set-Cookie: sindecon_fido_challenge=...` (`Max-Age=180`, un solo uso)
  - `POST /api/auth/fido/enroll` (`{ credentialId, publicKeySpkiB64, alg, rpId, ownerEmail? }`) → `{ sealedToken: string }`
  - `POST /api/auth/fido/verify` (`{ credentialId, clientDataJSONB64, authenticatorDataB64, signatureB64, sealedToken, displayName? }`) → `{ verified: true, signCount, user }` + limpia `sindecon_fido_challenge` + emite `sindecon_auth_session`

- [ ] **Step 1: Escribir pruebas que fallan en `app/tests/oauth/fido.test.ts`**

Crear `app/tests/oauth/fido.test.ts` generando un par `ECDSA P-256` real con `crypto.subtle` y probando:
1. `challenge` + `enroll` → obtiene `sealedToken` cifrado.
2. `verify` con firma ASN.1 DER válida → devuelve `200 { verified: true, signCount }` y emite `sindecon_auth_session` + limpia `sindecon_fido_challenge` (`Max-Age=0`).
3. Replay de `verify` usando el mismo `challenge` sin pedir uno nuevo o tras expirar → falla `401`.
4. `verify` con `sealedToken` alterado o firma alterada o bandera `UV=0` → devuelve `401` y limpia `sindecon_fido_challenge`.

```typescript
import { describe, it, expect } from 'vitest'
import worker from '../../worker'
import { toBase64Url } from '../../shared/webauthnCrypto'
import type { OAuthEnv } from '../../functions/api/oauth/_shared'

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

describe('/api/auth/fido/*', () => {
  it('registra clave pública FIDO sellada, verifica aserción ECDSA y bloquea replay', async () => {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    )
    const spkiB64 = toBase64Url(new Uint8Array(await crypto.subtle.exportKey('spki', keyPair.publicKey)))

    const enrollReq = new Request('https://sindecon.pages.dev/api/auth/fido/enroll', {
      method: 'POST',
      headers: { Origin: 'https://sindecon.pages.dev', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        credentialId: 'cred-id-1',
        publicKeySpkiB64: spkiB64,
        alg: -7,
        rpId: 'sindecon.pages.dev',
        ownerEmail: 'dra.martinez@gmail.com',
      }),
    })
    const enrollRes = await worker.fetch(enrollReq, TEST_ENV)
    expect(enrollRes.status).toBe(200)
    const { sealedToken } = (await enrollRes.json()) as { sealedToken: string }
    expect(sealedToken).toContain('.')

    const chReq = new Request('https://sindecon.pages.dev/api/auth/fido/challenge', {
      method: 'POST',
      headers: { Origin: 'https://sindecon.pages.dev' },
    })
    const chRes = await worker.fetch(chReq, TEST_ENV)
    expect(chRes.status).toBe(200)
    const { challenge } = (await chRes.json()) as { challenge: string }
    const chCookie = getCookieVal(chRes.headers.get('Set-Cookie'), 'sindecon_fido_challenge')
    expect(chCookie).toBeTruthy()

    const clientData = enc.encode(
      JSON.stringify({ type: 'webauthn.get', challenge, origin: 'https://sindecon.pages.dev' }),
    )
    const clientHash = new Uint8Array(await crypto.subtle.digest('SHA-256', clientData))
    const rpHash = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode('sindecon.pages.dev')))
    const authData = new Uint8Array(37)
    authData.set(rpHash, 0)
    authData[32] = 0x05 // UP + UV
    new DataView(authData.buffer).setUint32(33, 2, false)

    const payload = new Uint8Array(authData.length + clientHash.length)
    payload.set(authData, 0)
    payload.set(clientHash, authData.length)
    const sig = p1363ToDer(
      new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keyPair.privateKey, payload)),
    )

    const verifyReq = new Request('https://sindecon.pages.dev/api/auth/fido/verify', {
      method: 'POST',
      headers: {
        Origin: 'https://sindecon.pages.dev',
        'Content-Type': 'application/json',
        Cookie: `sindecon_fido_challenge=${encodeURIComponent(chCookie)}`,
      },
      body: JSON.stringify({
        credentialId: 'cred-id-1',
        clientDataJSONB64: toBase64Url(clientData),
        authenticatorDataB64: toBase64Url(authData),
        signatureB64: toBase64Url(sig),
        sealedToken,
      }),
    })
    const verifyRes = await worker.fetch(verifyReq, TEST_ENV)
    expect(verifyRes.status).toBe(200)
    expect(await verifyRes.json()).toMatchObject({ verified: true, signCount: 2 })
    const setCookies = verifyRes.headers.get('Set-Cookie') || ''
    expect(setCookies).toContain('sindecon_fido_challenge=;')
    expect(setCookies).toContain('sindecon_auth_session=')
  })

  it('rechaza challenge faltante o sealedToken alterado con 401', async () => {
    const req = new Request('https://sindecon.pages.dev/api/auth/fido/verify', {
      method: 'POST',
      headers: { Origin: 'https://sindecon.pages.dev', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        credentialId: 'c1',
        clientDataJSONB64: 'e30',
        authenticatorDataB64: 'e30',
        signatureB64: 'e30',
        sealedToken: 'bad.token',
      }),
    })
    const res = await worker.fetch(req, TEST_ENV)
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Ejecutar test para confirmar que falla**

Run: `cd app && npx vitest run tests/oauth/fido.test.ts`
Expected: FAIL (`expected 404 to be 200`)

- [ ] **Step 3: Implementar `challenge.ts`, `enroll.ts`, `verify.ts` y registrar en `app/worker.ts`**

Crear `app/functions/api/auth/fido/challenge.ts`:
```typescript
import { toBase64Url } from '../../../../shared/webauthnCrypto'
import {
  buildScopedCookieHeader,
  encryptSealedPayload,
  jsonResponse,
  validateEnv,
  validateSameOriginPost,
  type CfPagesContext,
} from '../../oauth/_shared'

export const FIDO_CHALLENGE_COOKIE = 'sindecon_fido_challenge'
export const FIDO_CHALLENGE_PATH = '/api/auth/fido'
export const FIDO_CHALLENGE_TTL_MS = 180_000

export interface FidoChallengePayload {
  challenge: string
  origin: string
  exp: number
}

/** Emite un challenge aleatorio de 32 bytes y lo guarda en cookie HttpOnly cifrada de un solo uso. */
export async function onRequest(context: CfPagesContext): Promise<Response> {
  const originError = validateSameOriginPost(context.request)
  if (originError) return originError

  const envCheck = validateEnv(context.env)
  if (!envCheck.ok) return envCheck.response

  const challenge = toBase64Url(crypto.getRandomValues(new Uint8Array(32)))
  const origin = new URL(context.request.url).origin
  const encrypted = await encryptSealedPayload<FidoChallengePayload>(
    { challenge, origin, exp: Date.now() + FIDO_CHALLENGE_TTL_MS },
    envCheck.cookieSecret,
  )

  return jsonResponse({ challenge }, 200, {
    'Set-Cookie': buildScopedCookieHeader({
      name: FIDO_CHALLENGE_COOKIE,
      value: encrypted,
      path: FIDO_CHALLENGE_PATH,
      maxAgeSeconds: 180,
      requestUrl: context.request.url,
    }),
  })
}
```

Crear `app/functions/api/auth/fido/enroll.ts`:
```typescript
import { fromBase64Url } from '../../../../shared/webauthnCrypto'
import {
  encryptSealedPayload,
  jsonResponse,
  validateEnv,
  validateSameOriginPost,
  type CfPagesContext,
} from '../../oauth/_shared'

export interface SealedFidoCredential {
  credentialId: string
  publicKeySpkiB64: string
  alg: number
  rpId: string
  ownerEmail?: string
  enrolledAt: number
}

/** Valida una clave pública WebAuthn SPKI (P-256 o RSA) y devuelve un token sellado con AES-256-GCM. */
export async function onRequest(context: CfPagesContext): Promise<Response> {
  const originError = validateSameOriginPost(context.request)
  if (originError) return originError

  const envCheck = validateEnv(context.env)
  if (!envCheck.ok) return envCheck.response

  let body: Partial<SealedFidoCredential>
  try {
    body = (await context.request.json()) as Partial<SealedFidoCredential>
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400)
  }

  const expectedRpId = new URL(context.request.url).hostname
  const credentialId = typeof body.credentialId === 'string' ? body.credentialId.trim() : ''
  const publicKeySpkiB64 = typeof body.publicKeySpkiB64 === 'string' ? body.publicKeySpkiB64.trim() : ''
  const alg = typeof body.alg === 'number' ? body.alg : -7
  const rpId = typeof body.rpId === 'string' ? body.rpId.trim() : expectedRpId
  const ownerEmail = typeof body.ownerEmail === 'string' ? body.ownerEmail.trim() : undefined

  if (!credentialId || !publicKeySpkiB64 || rpId !== expectedRpId || (alg !== -7 && alg !== -257)) {
    return jsonResponse({ error: 'invalid_fido_enrollment' }, 400)
  }

  const spkiBytes = fromBase64Url(publicKeySpkiB64)
  if (!spkiBytes) return jsonResponse({ error: 'invalid_public_key' }, 400)

  try {
    await crypto.subtle.importKey(
      'spki',
      spkiBytes,
      alg === -7 ? { name: 'ECDSA', namedCurve: 'P-256' } : { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    )
  } catch {
    return jsonResponse({ error: 'invalid_public_key' }, 400)
  }

  const sealedToken = await encryptSealedPayload<SealedFidoCredential>(
    {
      credentialId,
      publicKeySpkiB64,
      alg,
      rpId,
      ownerEmail,
      enrolledAt: Date.now(),
    },
    envCheck.cookieSecret,
  )

  return jsonResponse({ sealedToken }, 200)
}
```

Crear `app/functions/api/auth/fido/verify.ts`:
```typescript
import { verifyWebAuthnAssertion } from '../../../../shared/webauthnCrypto'
import {
  buildScopedCookieHeader,
  decryptSealedPayload,
  jsonResponse,
  readCookieByName,
  validateEnv,
  validateSameOriginPost,
  type CfPagesContext,
} from '../../oauth/_shared'
import { createAuthCookieHeader, type AuthSessionUser } from '../_session'
import { FIDO_CHALLENGE_COOKIE, FIDO_CHALLENGE_PATH, type FidoChallengePayload } from './challenge'
import type { SealedFidoCredential } from './enroll'

interface VerifyRequestBody {
  credentialId?: string
  clientDataJSONB64?: string
  authenticatorDataB64?: string
  signatureB64?: string
  sealedToken?: string
  previousSignCount?: number
  displayName?: string
}

/** Verifica firma FIDO2 contra token sellado y consume la cookie de challenge de un solo uso. */
export async function onRequest(context: CfPagesContext): Promise<Response> {
  const originError = validateSameOriginPost(context.request)
  if (originError) return originError

  const envCheck = validateEnv(context.env)
  if (!envCheck.ok) return envCheck.response

  const clearChallengeCookie = buildScopedCookieHeader({
    name: FIDO_CHALLENGE_COOKIE,
    value: '',
    path: FIDO_CHALLENGE_PATH,
    maxAgeSeconds: 0,
    requestUrl: context.request.url,
  })

  const reject = (error: string, status = 401) => {
    const res = jsonResponse({ verified: false, error }, status)
    res.headers.append('Set-Cookie', clearChallengeCookie)
    return res
  }

  let body: VerifyRequestBody
  try {
    body = (await context.request.json()) as VerifyRequestBody
  } catch {
    return reject('invalid_json', 400)
  }

  const rawChallengeCookie = readCookieByName(context.request, FIDO_CHALLENGE_COOKIE)
  if (!rawChallengeCookie) return reject('challenge_missing')

  const challengePayload = await decryptSealedPayload<FidoChallengePayload>(
    rawChallengeCookie,
    envCheck.cookieSecret,
  )
  const expectedOrigin = new URL(context.request.url).origin
  if (
    !challengePayload ||
    challengePayload.origin !== expectedOrigin ||
    challengePayload.exp < Date.now()
  ) {
    return reject('challenge_expired')
  }

  if (!body.sealedToken) return reject('missing_sealed_token')
  const credential = await decryptSealedPayload<SealedFidoCredential>(
    body.sealedToken,
    envCheck.cookieSecret,
  )
  if (!credential || credential.credentialId !== body.credentialId) {
    return reject('invalid_credential_token')
  }

  const expectedRpId = new URL(context.request.url).hostname
  const assertionRes = await verifyWebAuthnAssertion({
    publicKeySpkiB64: credential.publicKeySpkiB64,
    alg: credential.alg,
    clientDataJSONB64: body.clientDataJSONB64 || '',
    authenticatorDataB64: body.authenticatorDataB64 || '',
    signatureB64: body.signatureB64 || '',
    expectedChallenge: challengePayload.challenge,
    expectedOrigin,
    expectedRpId,
    previousSignCount: typeof body.previousSignCount === 'number' ? body.previousSignCount : undefined,
  })

  if (!assertionRes.valid) {
    return reject(assertionRes.reason)
  }

  const user: AuthSessionUser = {
    sub: credential.credentialId,
    email: credential.ownerEmail || 'fido@local',
    name: body.displayName?.trim() || (credential.ownerEmail ? credential.ownerEmail.split('@')[0]! : 'Médico (FIDO)'),
    method: 'fido',
  }

  const authCookie = await createAuthCookieHeader(user, envCheck.cookieSecret, context.request.url)
  const headers = new Headers()
  headers.append('Set-Cookie', clearChallengeCookie)
  headers.append('Set-Cookie', authCookie)
  return jsonResponse({ verified: true, signCount: assertionRes.signCount, user }, 200, headers)
}
```

Registrar en `app/worker.ts`:
```typescript
import { onRequest as handleFidoChallenge } from './functions/api/auth/fido/challenge'
import { onRequest as handleFidoEnroll } from './functions/api/auth/fido/enroll'
import { onRequest as handleFidoVerify } from './functions/api/auth/fido/verify'
```
y añadir al `OAUTH_ROUTES` (o `API_ROUTES`):
```typescript
  ['/api/auth/fido/challenge', handleFidoChallenge],
  ['/api/auth/fido/enroll', handleFidoEnroll],
  ['/api/auth/fido/verify', handleFidoVerify],
```

- [ ] **Step 4: Ejecutar pruebas y validar tipos**

Run: `cd app && npx vitest run tests/oauth/fido.test.ts tests/oauth/auth.test.ts && npx tsc -b`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/functions/api/auth/fido/challenge.ts app/functions/api/auth/fido/enroll.ts app/functions/api/auth/fido/verify.ts app/worker.ts app/tests/oauth/fido.test.ts
git commit -m "feat(auth): add stateless Cloudflare FIDO2 WebAuthn challenge, enroll, and verify endpoints"
```

---

### Task 4: Dominio de PIN Seguro (`PBKDF2-SHA256`), Bloqueo Exponencial y Modelo de Seguridad

**Files:**
- Create: `app/src/domain/pinAuth.ts`
- Create: `app/src/domain/pinAuth.test.ts`
- Modify: `app/src/domain/auth.ts:1-81`
- Modify: `app/src/domain/auth.test.ts:1-69`

**Interfaces:**
- Consumes: `toBase64Url`, `fromBase64Url` (`app/shared/webauthnCrypto.ts`)
- Produces:
  - En `pinAuth.ts`: `PinRecord`, `PIN_ITERATIONS = 150_000`, `hashPin(pin: string): Promise<PinRecord>`, `verifyPinHash(pin: string, record: PinRecord): Promise<boolean>`, `computeLockoutAfterFailure(failedAttempts: number, now?: number): { failedAttempts: number; lockedUntil: number | null; lockSeconds: number }`, `evaluatePinAttempt(inputPin: string, record: PinRecord, now?: number)`
  - En `auth.ts`: `StoredPasskey`, `AuthUser` (ampliado con `'fido'`, `email?`, `avatarUrl?`), `DeviceSecurityProfile`, `SECURITY_STATE_KEY`, `createEmptySecurityProfile()`, `isProtectionConfigured(profile)`, `canGoogleUnlockDevice(incomingEmail, profile)`, `createFidoUser()`

- [ ] **Step 1: Escribir pruebas que fallan en `app/src/domain/pinAuth.test.ts`**

Crear `app/src/domain/pinAuth.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import {
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
  })

  it('deriva hash PBKDF2-SHA256 con salt único y verifica PIN correcto e incorrecto', async () => {
    const rec1 = await hashPin('482910')
    const rec2 = await hashPin('482910')

    expect(rec1.pinLength).toBe(6)
    expect(rec1.saltB64).not.toBe(rec2.saltB64)
    expect(rec1.hashB64).not.toContain('482910')
    expect(await verifyPinHash('482910', rec1)).toBe(true)
    expect(await verifyPinHash('000000', rec1)).toBe(false)
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
```

- [ ] **Step 2: Ejecutar test para confirmar que falla**

Run: `cd app && npx vitest run src/domain/pinAuth.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar `app/src/domain/pinAuth.ts` y ampliar `app/src/domain/auth.ts`**

Crear `app/src/domain/pinAuth.ts`:
```typescript
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
  if (!salt || !expected) return false
  const candidate = await derivePinBits(pin, salt, record.iterations || PIN_ITERATIONS)
  return constantTimeBytesEqual(candidate, expected)
}

export function computeLockoutAfterFailure(
  failedAttempts: number,
  now = Date.now(),
): { failedAttempts: number; lockedUntil: number | null; lockSeconds: number } {
  const schedule: Record<number, number> = { 5: 30, 6: 120, 7: 300 }
  const lockSeconds = failedAttempts < 5 ? 0 : schedule[failedAttempts] ?? 900
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
      },
    }
  }

  const nextFailed = record.failedAttempts + 1
  const lock = computeLockoutAfterFailure(nextFailed, now)
  const nextRecord: PinRecord = {
    ...record,
    failedAttempts: lock.failedAttempts,
    lockedUntil: lock.lockedUntil,
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
```

Actualizar `app/src/domain/auth.ts` preservando las exportaciones existentes (`DEFAULT_PIN`, `SAVED_PIN_KEY`, `AUTH_USER_KEY`, `validatePin`, `createPinUser`, `validateCredentials`, `createOfflineEmergencyUser`, `createGoogleUser`) y añadiendo el modelo de seguridad del dispositivo:
```typescript
import type { PinRecord } from './pinAuth'

export const DEFAULT_PIN = '1234'
export const SAVED_PIN_KEY = 'sindecon_saved_pin'
export const AUTH_USER_KEY = 'sindecon_auth_user'
export const SECURITY_STATE_KEY = 'sindecon_security_state'

export type AuthMethod = 'pin' | 'password' | 'google' | 'offline_emergency' | 'fido'

export interface AuthUser {
  id: string
  name: string
  role: string
  method: AuthMethod
  authenticatedAt: number
  email?: string
  avatarUrl?: string
}

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

export function validatePin(inputPin: string, savedPin?: string | null): boolean {
  const expected = savedPin && savedPin.trim().length >= 4 ? savedPin.trim() : DEFAULT_PIN
  return inputPin.trim() === expected
}

export function createPinUser(): AuthUser {
  return {
    id: 'local-pin-user',
    name: 'Médico de Guardia',
    role: 'Médico Clínico',
    method: 'pin',
    authenticatedAt: Date.now(),
  }
}

export function validateCredentials(username: string, password: string): boolean {
  const u = username.trim().toLowerCase()
  const p = password.trim()
  return (u === 'medico' || u === 'admin' || u === 'doctor') && p === 'sindecon'
}

export function createOfflineEmergencyUser(): AuthUser {
  return {
    id: 'offline-emergency',
    name: 'Acceso Urgencias',
    role: 'Modo Local Offline',
    method: 'offline_emergency',
    authenticatedAt: Date.now(),
  }
}

export function createGoogleUser(email?: string, name?: string, avatarUrl?: string): AuthUser {
  return {
    id: email || 'google-user',
    name: name?.trim() || email || 'Médico (Google)',
    role: 'Cuenta Sincronizada',
    method: 'google',
    authenticatedAt: Date.now(),
    email,
    avatarUrl,
  }
}

export function createFidoUser(opts?: { id?: string; name?: string; email?: string }): AuthUser {
  return {
    id: opts?.id || 'fido-passkey-user',
    name: opts?.name?.trim() || (opts?.email ? opts.email.split('@')[0]! : 'Médico (FIDO2)'),
    role: 'Acceso Biométrico',
    method: 'fido',
    authenticatedAt: Date.now(),
    email: opts?.email,
  }
}
```

Agregar pruebas al final de `app/src/domain/auth.test.ts` (importando `createEmptySecurityProfile`, `isProtectionConfigured`, `canGoogleUnlockDevice`, `createFidoUser`, `createGoogleUser` y `hashPin` desde `./pinAuth`):
```typescript
describe('DeviceSecurityProfile y reglas de propiedad Google', () => {
  it('considera protectionConfigured=false en perfil vacío y true con PIN o FIDO', async () => {
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
    expect(canGoogleUnlockDevice('dra.martinez@gmail.com', protectedWithOwner)).toEqual({ allowed: true })
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

    const google = createGoogleUser('doc@hospital.cl', 'Dr. House', 'https://avatar.test/a.png')
    expect(google.method).toBe('google')
    expect(google.email).toBe('doc@hospital.cl')
    expect(google.avatarUrl).toBe('https://avatar.test/a.png')
  })
})
```

- [ ] **Step 4: Ejecutar tests de dominio y verificar tipos**

Run: `cd app && npx vitest run src/domain/pinAuth.test.ts src/domain/auth.test.ts && npx tsc -b`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/domain/pinAuth.ts app/src/domain/pinAuth.test.ts app/src/domain/auth.ts app/src/domain/auth.test.ts
git commit -m "feat(auth): add PBKDF2-SHA256 PIN hashing, exponential lockout, and device ownership rules"
```

---

### Task 5: Cliente FIDO2 WebAuthn (`fidoAuth.ts`) y Google Login (`googleAuth.ts`)

**Files:**
- Create: `app/src/domain/fidoAuth.ts`
- Create: `app/src/domain/fidoAuth.test.ts`
- Create: `app/src/pwa/googleAuth.ts`
- Create: `app/src/pwa/googleAuth.test.ts`

**Interfaces:**
- Consumes: `toBase64Url`, `fromBase64Url`, `extractP256SpkiFromAuthData`, `verifyWebAuthnAssertion` (`app/shared/webauthnCrypto.ts`), `createFidoUser`, `StoredPasskey`, `AuthUser` (`app/src/domain/auth.ts`), `getStoredClientId` (`app/src/pwa/googleDrive.ts`)
- Produces:
  - En `fidoAuth.ts`: `isWebAuthnSupported()`, `registerPasskey(opts)`, `authenticateWithPasskey(passkeys, opts)`
  - En `googleAuth.ts`: `GOOGLE_IDENTITY_SCOPES`, `GoogleIdentityProfile`, `initiateGoogleLoginFlow(callbacks)`, `checkServerAuthSession()`, `logoutServerAuthSession()`

- [ ] **Step 1: Escribir pruebas que fallan en `app/src/domain/fidoAuth.test.ts` y `app/src/pwa/googleAuth.test.ts`**

Crear `app/src/domain/fidoAuth.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { toBase64Url } from '../../shared/webauthnCrypto'
import type { StoredPasskey } from './auth'
import { registerPasskey, authenticateWithPasskey } from './fidoAuth'

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

async function buildFakeAuthenticatorAssertion(
  keyPair: CryptoKeyPair,
  opts: { challenge: Uint8Array; origin: string; rpId: string; signCount: number },
) {
  const challengeB64 = toBase64Url(opts.challenge)
  const clientDataJSON = enc.encode(
    JSON.stringify({ type: 'webauthn.get', challenge: challengeB64, origin: opts.origin }),
  )
  const clientHash = new Uint8Array(await crypto.subtle.digest('SHA-256', clientDataJSON))
  const rpHash = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(opts.rpId)))

  const authData = new Uint8Array(37)
  authData.set(rpHash, 0)
  authData[32] = 0x05 // UP + UV
  new DataView(authData.buffer).setUint32(33, opts.signCount, false)

  const signed = new Uint8Array(authData.length + clientHash.length)
  signed.set(authData, 0)
  signed.set(clientHash, authData.length)

  const rawSig = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keyPair.privateKey, signed),
  )
  const signature = p1363ToDer(rawSig)

  return {
    clientDataJSON: clientDataJSON.buffer,
    authenticatorData: authData.buffer,
    signature: signature.buffer,
  }
}

describe('fidoAuth (WebAuthn online + offline)', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('registra passkey obteniendo publicKey SPKI y sealedToken cuando el servidor responde', async () => {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    )
    const spkiBuf = await crypto.subtle.exportKey('spki', keyPair.publicKey)
    const rawId = new Uint8Array([10, 20, 30, 40]).buffer
    const credId = toBase64Url(new Uint8Array(rawId))

    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ challenge: 'srv-ch-1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ sealedToken: 'sealed.tok' }), { status: 200 }))

    const mockCredentials = {
      create: vi.fn(async () => ({
        id: credId,
        rawId,
        type: 'public-key',
        response: {
          getPublicKey: () => spkiBuf,
          getPublicKeyAlgorithm: () => -7,
        },
      })),
      get: vi.fn(),
    } as unknown as CredentialsContainer

    const res = await registerPasskey({
      label: 'Huella PC',
      ownerEmail: 'doc@hospital.cl',
      rpId: 'sindecon.pages.dev',
      fetchFn: fetchMock,
      credentialsApi: mockCredentials,
    })

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.passkey.credentialId).toBe(credId)
    expect(res.passkey.sealedToken).toBe('sealed.tok')
    expect(res.passkey.alg).toBe(-7)
  })

  it('verifica aserción WebAuthn criptográficamente en modo offline y rechaza signCount regresivo', async () => {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    )
    const spkiB64 = toBase64Url(new Uint8Array(await crypto.subtle.exportKey('spki', keyPair.publicKey)))
    const credId = 'cred-offline-1'
    const passkey: StoredPasskey = {
      credentialId: credId,
      publicKeySpkiB64: spkiB64,
      alg: -7,
      rpId: 'sindecon.pages.dev',
      label: 'Face ID',
      signCount: 5,
      createdAt: Date.now(),
    }

    let nextCount = 6
    const mockCredentials = {
      create: vi.fn(),
      get: vi.fn(async (opts?: CredentialRequestOptions) => {
        const challenge = new Uint8Array((opts?.publicKey?.challenge as ArrayBuffer) || new ArrayBuffer(0))
        const assertion = await buildFakeAuthenticatorAssertion(keyPair, {
          challenge,
          origin: 'https://sindecon.pages.dev',
          rpId: 'sindecon.pages.dev',
          signCount: nextCount,
        })
        return { id: credId, rawId: new Uint8Array([1]).buffer, type: 'public-key', response: assertion }
      }),
    } as unknown as CredentialsContainer

    const validRes = await authenticateWithPasskey([passkey], {
      rpId: 'sindecon.pages.dev',
      origin: 'https://sindecon.pages.dev',
      isOnline: false,
      fetchFn: fetchMock,
      credentialsApi: mockCredentials,
    })

    expect(validRes.ok).toBe(true)
    if (!validRes.ok) return
    expect(validRes.verifiedOffline).toBe(true)
    expect(validRes.nextSignCount).toBe(6)

    // Simular dispositivo clonado con signCount menor al registrado (4 <= 5)
    nextCount = 4
    const clonedRes = await authenticateWithPasskey([passkey], {
      rpId: 'sindecon.pages.dev',
      origin: 'https://sindecon.pages.dev',
      isOnline: false,
      fetchFn: fetchMock,
      credentialsApi: mockCredentials,
    })
    expect(clonedRes.ok).toBe(false)
    if (!clonedRes.ok) {
      expect(clonedRes.error).toContain('clonada')
    }
  })

  it('mapea NotAllowedError a mensaje claro de cancelación', async () => {
    const mockCredentials = {
      create: vi.fn(),
      get: vi.fn(async () => {
        throw new DOMException('User cancelled', 'NotAllowedError')
      }),
    } as unknown as CredentialsContainer

    const res = await authenticateWithPasskey(
      [
        {
          credentialId: 'c1',
          publicKeySpkiB64: 'spki',
          alg: -7,
          rpId: 'sindecon.pages.dev',
          label: 'Passkey',
          signCount: 0,
          createdAt: 1,
        },
      ],
      { isOnline: false, credentialsApi: mockCredentials },
    )
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error.toLowerCase()).toContain('cancelada')
    }
  })
})
```

Crear `app/src/pwa/googleAuth.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  GOOGLE_IDENTITY_SCOPES,
  initiateGoogleLoginFlow,
  checkServerAuthSession,
  logoutServerAuthSession,
} from './googleAuth'

describe('googleAuth (openid email profile + fallback dev)', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('usa initCodeClient con openid email profile y canjea code en /api/auth/google', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          user: {
            sub: 'sub-1',
            email: 'dra.martinez@gmail.com',
            name: 'Dra. Martínez',
            picture: 'https://avatar.test/1.png',
          },
          driveConnected: false,
        }),
        { status: 200 },
      ),
    )

    let capturedScope = ''
    vi.stubGlobal('google', {
      accounts: {
        oauth2: {
          initCodeClient: (cfg: { scope: string; callback: (r: { code?: string }) => void }) => {
            capturedScope = cfg.scope
            return { requestCode: () => void cfg.callback({ code: 'auth-code-99' }) }
          },
        },
      },
    })

    const onSuccess = vi.fn()
    const onError = vi.fn()
    initiateGoogleLoginFlow({
      clientId: 'client-123.apps.googleusercontent.com',
      fetchFn: fetchMock,
      onSuccess,
      onError,
    })

    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
    expect(capturedScope).toBe(GOOGLE_IDENTITY_SCOPES)
    expect(onError).not.toHaveBeenCalled()
    expect(onSuccess.mock.calls[0]?.[0]).toMatchObject({
      email: 'dra.martinez@gmail.com',
      driveConnected: false,
    })
  })

  it('degrada a initTokenClient en 404 (vite dev sin Worker) y consulta userinfo', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('Not found', { status: 404 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            sub: 'sub-dev',
            email: 'dev@hospital.cl',
            name: 'Dev User',
          }),
          { status: 200 },
        ),
      )

    vi.stubGlobal('google', {
      accounts: {
        oauth2: {
          initCodeClient: (cfg: { callback: (r: { code?: string }) => void }) => ({
            requestCode: () => void cfg.callback({ code: 'dev-code' }),
          }),
          initTokenClient: (cfg: { callback: (r: { access_token?: string }) => void }) => ({
            requestAccessToken: () => void cfg.callback({ access_token: 'tok-dev' }),
          }),
        },
      },
    })

    const onSuccess = vi.fn()
    const onError = vi.fn()
    initiateGoogleLoginFlow({
      clientId: 'client-123.apps.googleusercontent.com',
      fetchFn: fetchMock,
      onSuccess,
      onError,
    })

    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
    expect(onSuccess.mock.calls[0]?.[0]).toMatchObject({ email: 'dev@hospital.cl' })
    expect(onError).not.toHaveBeenCalled()
  })

  it('consulta /api/auth/session y cierra sesión en /api/auth/logout', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            authenticated: true,
            user: { sub: 's1', email: 'doc@cl.org', name: 'Dr. S' },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))

    const session = await checkServerAuthSession(fetchMock)
    expect(session?.email).toBe('doc@cl.org')
    await logoutServerAuthSession(fetchMock)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Ejecutar tests para confirmar que fallan**

Run: `cd app && npx vitest run src/domain/fidoAuth.test.ts src/pwa/googleAuth.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar `app/src/domain/fidoAuth.ts` y `app/src/pwa/googleAuth.ts`**

Crear `app/src/domain/fidoAuth.ts`:
```typescript
import {
  extractP256SpkiFromAuthData,
  fromBase64Url,
  toBase64Url,
  verifyWebAuthnAssertion,
} from '../../shared/webauthnCrypto'
import { createFidoUser, type AuthUser, type StoredPasskey } from './auth'

const textEncoder = new TextEncoder()

export function isWebAuthnSupported(): boolean {
  return (
    typeof globalThis.navigator !== 'undefined' &&
    Boolean(globalThis.navigator.credentials) &&
    typeof globalThis.PublicKeyCredential !== 'undefined'
  )
}

function getDefaultRpId(): string {
  return typeof location !== 'undefined' && location.hostname ? location.hostname : 'localhost'
}

function getDefaultOrigin(): string {
  return typeof location !== 'undefined' && location.origin ? location.origin : 'https://localhost'
}

function mapWebAuthnError(err: unknown, mode: 'register' | 'authenticate'): string {
  if (err && typeof err === 'object' && 'name' in err) {
    const name = String((err as { name: unknown }).name)
    if (name === 'NotAllowedError') {
      return mode === 'register'
        ? 'Registro biométrico cancelado por el usuario o sin confirmación.'
        : 'Verificación biométrica cancelada por el usuario.'
    }
    if (name === 'InvalidStateError') {
      return 'Esta llave de seguridad FIDO ya estaba registrada en este dispositivo.'
    }
    if (name === 'SecurityError') {
      return 'WebAuthn requiere contexto seguro HTTPS o localhost.'
    }
  }
  return mode === 'register'
    ? 'No se pudo completar el registro de la llave biométrica.'
    : 'No se pudo completar la verificación biométrica FIDO.'
}

async function fetchChallengeOrLocal(
  isOnline: boolean,
  fetchFn: typeof fetch,
): Promise<{ challengeB64: string; challengeBytes: Uint8Array<ArrayBuffer>; isServerChallenge: boolean }> {
  if (isOnline) {
    try {
      const res = await fetchFn('/api/auth/fido/challenge', {
        method: 'POST',
        credentials: 'include',
      })
      if (res.ok) {
        const data = (await res.json()) as { challenge?: string }
        const bytes = data.challenge ? fromBase64Url(data.challenge) : null
        if (data.challenge && bytes) {
          return { challengeB64: data.challenge, challengeBytes: bytes, isServerChallenge: true }
        }
      }
    } catch {
      // Sin red o Worker ausente: degradar limpiamente a challenge local.
    }
  }
  const challengeBytes = crypto.getRandomValues(new Uint8Array(32))
  return {
    challengeB64: toBase64Url(challengeBytes),
    challengeBytes,
    isServerChallenge: false,
  }
}

export interface RegisterPasskeyOptions {
  label?: string
  ownerEmail?: string | null
  ownerSub?: string | null
  displayName?: string | null
  rpId?: string
  isOnline?: boolean
  fetchFn?: typeof fetch
  credentialsApi?: CredentialsContainer
}

export type RegisterPasskeyResult =
  | { ok: true; passkey: StoredPasskey }
  | { ok: false; error: string }

type ExtendedAttestationResponse = AuthenticatorAttestationResponse & {
  getPublicKey?: () => ArrayBuffer | null
  getPublicKeyAlgorithm?: () => number
  getAuthenticatorData?: () => ArrayBuffer
}

export async function registerPasskey(opts: RegisterPasskeyOptions = {}): Promise<RegisterPasskeyResult> {
  const credentials = opts.credentialsApi ?? globalThis.navigator?.credentials
  if (!credentials) {
    return { ok: false, error: 'Tu navegador o dispositivo no soporta llaves biométricas FIDO2.' }
  }

  const rpId = opts.rpId || getDefaultRpId()
  const fetchFn = opts.fetchFn ?? fetch
  const isOnline = opts.isOnline ?? (typeof navigator !== 'undefined' ? navigator.onLine : true)
  const { challengeBytes } = await fetchChallengeOrLocal(isOnline, fetchFn)

  const userIdentifier = opts.ownerEmail || opts.ownerSub || 'sindecon-local-user'
  const userIdBytes = textEncoder.encode(userIdentifier)

  let credential: Credential | null
  try {
    credential = await credentials.create({
      publicKey: {
        challenge: challengeBytes,
        rp: { name: 'SINDECON', id: rpId },
        user: {
          id: userIdBytes,
          name: userIdentifier,
          displayName: opts.displayName || opts.ownerEmail || 'Médico SINDECON',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: {
          userVerification: 'required',
          residentKey: 'preferred',
        },
        attestation: 'none',
        timeout: 60_000,
      },
    })
  } catch (err) {
    return { ok: false, error: mapWebAuthnError(err, 'register') }
  }

  if (!credential || credential.type !== 'public-key') {
    return { ok: false, error: 'El navegador no devolvió una credencial FIDO2 válida.' }
  }

  const pkCred = credential as PublicKeyCredential
  const credentialId = pkCred.id || toBase64Url(new Uint8Array(pkCred.rawId))
  const attResp = pkCred.response as ExtendedAttestationResponse

  let publicKeySpkiB64 = ''
  let alg = -7

  const directSpki = attResp.getPublicKey?.()
  if (directSpki) {
    publicKeySpkiB64 = toBase64Url(new Uint8Array(directSpki))
    alg = attResp.getPublicKeyAlgorithm?.() ?? -7
  } else {
    const authDataBuf = attResp.getAuthenticatorData?.()
    if (authDataBuf) {
      const extracted = extractP256SpkiFromAuthData(new Uint8Array(authDataBuf))
      if (extracted) {
        publicKeySpkiB64 = toBase64Url(extracted.publicKeySpki)
        alg = extracted.alg
      }
    }
  }

  if (!publicKeySpkiB64 || (alg !== -7 && alg !== -257)) {
    return { ok: false, error: 'El autenticador no expuso una clave pública compatible (ES256/RS256).' }
  }

  let sealedToken: string | undefined
  if (isOnline) {
    try {
      const enrollRes = await fetchFn('/api/auth/fido/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          credentialId,
          publicKeySpkiB64,
          alg,
          rpId,
          ownerEmail: opts.ownerEmail ?? undefined,
        }),
      })
      if (enrollRes.ok) {
        const data = (await enrollRes.json()) as { sealedToken?: string }
        sealedToken = data.sealedToken
      }
    } catch {
      sealedToken = undefined
    }
  }

  return {
    ok: true,
    passkey: {
      credentialId,
      publicKeySpkiB64,
      alg,
      rpId,
      label: opts.label?.trim() || 'Passkey Biométrica',
      signCount: 0,
      sealedToken,
      ownerEmail: opts.ownerEmail ?? undefined,
      createdAt: Date.now(),
    },
  }
}

export interface AuthenticatePasskeyOptions {
  rpId?: string
  origin?: string
  isOnline?: boolean
  displayName?: string
  fetchFn?: typeof fetch
  credentialsApi?: CredentialsContainer
}

export type AuthenticatePasskeyResult =
  | { ok: true; user: AuthUser; matchedCredentialId: string; nextSignCount: number; verifiedOffline: boolean }
  | { ok: false; error: string }

export async function authenticateWithPasskey(
  passkeys: StoredPasskey[],
  opts: AuthenticatePasskeyOptions = {},
): Promise<AuthenticatePasskeyResult> {
  if (passkeys.length === 0) {
    return { ok: false, error: 'No hay llaves FIDO registradas en este dispositivo.' }
  }

  const credentials = opts.credentialsApi ?? globalThis.navigator?.credentials
  if (!credentials) {
    return { ok: false, error: 'Tu navegador no soporta verificación biométrica FIDO2.' }
  }

  const rpId = opts.rpId || getDefaultRpId()
  const origin = opts.origin || getDefaultOrigin()
  const fetchFn = opts.fetchFn ?? fetch
  const isOnline = opts.isOnline ?? (typeof navigator !== 'undefined' ? navigator.onLine : true)

  const { challengeB64, challengeBytes, isServerChallenge } = await fetchChallengeOrLocal(isOnline, fetchFn)

  const allowCredentials: PublicKeyCredentialDescriptor[] = []
  for (const pk of passkeys) {
    const idBytes = fromBase64Url(pk.credentialId)
    if (idBytes) {
      allowCredentials.push({ id: idBytes, type: 'public-key' })
    }
  }
  if (allowCredentials.length === 0) {
    return { ok: false, error: 'Las llaves FIDO guardadas tienen formato inválido.' }
  }

  let assertionCred: Credential | null
  try {
    assertionCred = await credentials.get({
      publicKey: {
        challenge: challengeBytes,
        rpId,
        allowCredentials,
        userVerification: 'required',
        timeout: 60_000,
      },
    })
  } catch (err) {
    return { ok: false, error: mapWebAuthnError(err, 'authenticate') }
  }

  if (!assertionCred || assertionCred.type !== 'public-key') {
    return { ok: false, error: 'No se recibió una aserción biométrica válida.' }
  }

  const pkCred = assertionCred as PublicKeyCredential
  const matchedId = pkCred.id || toBase64Url(new Uint8Array(pkCred.rawId))
  const matched = passkeys.find((p) => p.credentialId === matchedId)
  if (!matched) {
    return { ok: false, error: 'La llave utilizada no coincide con las registradas en este dispositivo.' }
  }

  const assertion = pkCred.response as AuthenticatorAssertionResponse
  const clientDataJSONB64 = toBase64Url(new Uint8Array(assertion.clientDataJSON))
  const authenticatorDataB64 = toBase64Url(new Uint8Array(assertion.authenticatorData))
  const signatureB64 = toBase64Url(new Uint8Array(assertion.signature))

  if (isOnline && isServerChallenge && matched.sealedToken) {
    try {
      const verifyRes = await fetchFn('/api/auth/fido/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          credentialId: matched.credentialId,
          clientDataJSONB64,
          authenticatorDataB64,
          signatureB64,
          sealedToken: matched.sealedToken,
          previousSignCount: matched.signCount,
          displayName: opts.displayName || matched.label,
        }),
      })
      if (verifyRes.ok) {
        const data = (await verifyRes.json()) as { signCount?: number }
        return {
          ok: true,
          user: createFidoUser({
            id: matched.credentialId,
            name: opts.displayName || matched.label,
            email: matched.ownerEmail,
          }),
          matchedCredentialId: matched.credentialId,
          nextSignCount: typeof data.signCount === 'number' ? data.signCount : matched.signCount,
          verifiedOffline: false,
        }
      }
      if (verifyRes.status === 401 || verifyRes.status === 403) {
        return { ok: false, error: 'Verificación FIDO rechazada por el servidor.' }
      }
    } catch {
      // Fallo de red transitorio: continuar con verificación criptográfica offline.
    }
  }

  const localCheck = await verifyWebAuthnAssertion({
    publicKeySpkiB64: matched.publicKeySpkiB64,
    alg: matched.alg,
    clientDataJSONB64,
    authenticatorDataB64,
    signatureB64,
    expectedChallenge: challengeB64,
    expectedOrigin: origin,
    expectedRpId: matched.rpId || rpId,
    previousSignCount: matched.signCount,
  })

  if (!localCheck.valid) {
    return {
      ok: false,
      error:
        localCheck.reason === 'cloned_authenticator_detected'
          ? 'Alerta de seguridad: contador de firma regresivo (posible llave clonada).'
          : 'Firma biométrica FIDO inválida.',
    }
  }

  return {
    ok: true,
    user: createFidoUser({
      id: matched.credentialId,
      name: opts.displayName || matched.label,
      email: matched.ownerEmail,
    }),
    matchedCredentialId: matched.credentialId,
    nextSignCount: localCheck.signCount,
    verifiedOffline: true,
  }
}
```

Crear `app/src/pwa/googleAuth.ts`:
```typescript
import { getStoredClientId } from './googleDrive'

export const GOOGLE_IDENTITY_SCOPES = 'openid email profile'

export interface GoogleIdentityProfile {
  sub: string
  email: string
  name: string
  avatarUrl?: string
  driveConnected?: boolean
}

export interface GoogleLoginCallbacks {
  clientId?: string
  loginHint?: string
  fetchFn?: typeof fetch
  onSuccess: (profile: GoogleIdentityProfile) => void
  onError: (message: string) => void
}

interface GsiGlobal {
  accounts?: {
    oauth2?: {
      initCodeClient?: (config: {
        client_id: string
        scope: string
        ux_mode?: string
        login_hint?: string
        callback: (resp: { code?: string; error?: string; error_description?: string }) => void
      }) => { requestCode: () => void }
      initTokenClient?: (config: {
        client_id: string
        scope: string
        hint?: string
        callback: (resp: { access_token?: string; error?: string; error_description?: string }) => void
      }) => { requestAccessToken: (override?: { prompt?: string }) => void }
    }
  }
}

export async function checkServerAuthSession(
  fetchFn: typeof fetch = fetch,
): Promise<GoogleIdentityProfile | null> {
  try {
    const res = await fetchFn('/api/auth/session', {
      method: 'POST',
      credentials: 'include',
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      authenticated?: boolean
      user?: { sub?: string; email?: string; name?: string; picture?: string }
    }
    if (!data.authenticated || !data.user?.email || !data.user.sub) return null
    return {
      sub: data.user.sub,
      email: data.user.email,
      name: data.user.name || data.user.email,
      avatarUrl: data.user.picture,
    }
  } catch {
    return null
  }
}

export async function logoutServerAuthSession(fetchFn: typeof fetch = fetch): Promise<void> {
  try {
    await fetchFn('/api/auth/logout', { method: 'POST', credentials: 'include' })
  } catch {
    // Offline o sin Worker: la sesión local igual se cierra.
  }
}

export function initiateGoogleLoginFlow(callbacks: GoogleLoginCallbacks): void {
  const clientId = callbacks.clientId || getStoredClientId()
  if (!clientId) {
    callbacks.onError('Falta configurar el Google Client ID en el entorno de la aplicación.')
    return
  }

  const oauth2 = (globalThis as { google?: GsiGlobal }).google?.accounts?.oauth2
  if (!oauth2) {
    callbacks.onError('Servicio Google Identity no disponible (sin conexión o bloqueado).')
    return
  }

  const fetchFn = callbacks.fetchFn ?? fetch

  const runTokenFallback = () => {
    if (typeof oauth2.initTokenClient !== 'function') {
      callbacks.onError('No hay cliente OAuth disponible para iniciar sesión con Google.')
      return
    }
    const tokenClient = oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_IDENTITY_SCOPES,
      hint: callbacks.loginHint,
      callback: async (resp) => {
        if (resp.error || !resp.access_token) {
          callbacks.onError(resp.error_description || 'Inicio de sesión con Google cancelado.')
          return
        }
        try {
          const uiRes = await fetchFn('https://openidconnect.googleapis.com/v1/userinfo', {
            headers: { Authorization: `Bearer ${resp.access_token}` },
          })
          if (!uiRes.ok) {
            callbacks.onError('Google no devolvió los datos del perfil.')
            return
          }
          const ui = (await uiRes.json()) as {
            sub?: string
            email?: string
            name?: string
            picture?: string
          }
          if (!ui.email || !ui.sub) {
            callbacks.onError('La cuenta Google no entregó un correo verificado.')
            return
          }
          callbacks.onSuccess({
            sub: ui.sub,
            email: ui.email,
            name: ui.name || ui.email,
            avatarUrl: ui.picture,
            driveConnected: false,
          })
        } catch {
          callbacks.onError('No se pudo validar tu perfil de Google.')
        }
      },
    })
    tokenClient.requestAccessToken({ prompt: callbacks.loginHint ? '' : 'select_account' })
  }

  if (typeof oauth2.initCodeClient === 'function') {
    const codeClient = oauth2.initCodeClient({
      client_id: clientId,
      scope: GOOGLE_IDENTITY_SCOPES,
      ux_mode: 'popup',
      login_hint: callbacks.loginHint,
      callback: async (resp) => {
        if (resp.error || !resp.code) {
          callbacks.onError(resp.error_description || 'Inicio de sesión con Google cancelado.')
          return
        }
        try {
          const res = await fetchFn('/api/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ code: resp.code }),
          })
          if (res.status === 404 || res.status === 405) {
            runTokenFallback()
            return
          }
          if (!res.ok) {
            callbacks.onError('No se pudo validar el código de Google en el servidor.')
            return
          }
          const data = (await res.json()) as {
            user?: { sub: string; email: string; name: string; picture?: string }
            driveConnected?: boolean
          }
          if (!data.user?.email) {
            callbacks.onError('Respuesta incompleta del servidor de autenticación.')
            return
          }
          callbacks.onSuccess({
            sub: data.user.sub,
            email: data.user.email,
            name: data.user.name,
            avatarUrl: data.user.picture,
            driveConnected: Boolean(data.driveConnected),
          })
        } catch {
          callbacks.onError('Sin conexión para validar el acceso con Google.')
        }
      },
    })
    codeClient.requestCode()
    return
  }

  runTokenFallback()
}
```

- [ ] **Step 4: Ejecutar pruebas y typecheck**

Run: `cd app && npx vitest run src/domain/fidoAuth.test.ts src/pwa/googleAuth.test.ts && npx tsc -b`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/domain/fidoAuth.ts app/src/domain/fidoAuth.test.ts app/src/pwa/googleAuth.ts app/src/pwa/googleAuth.test.ts
git commit -m "feat(auth): add dual online/offline FIDO2 client and Google Identity login client"
```

---

### Task 6: Hook Unificado `useAuth` (`app/src/hooks/useAuth.ts`)

**Files:**
- Modify: `app/src/hooks/useAuth.ts:1-125`
- Create: `app/src/hooks/useAuth.test.ts`

**Interfaces:**
- Consumes: `pinAuth.ts`, `auth.ts`, `fidoAuth.ts`, `googleAuth.ts`, `db` (`app/src/db/db.ts`)
- Produces:
  - `AUTH_CHANGE_EVENT`, `SECURITY_CHANGE_EVENT`, `StorageLike`, `createAuthController(deps?)`
  - Hook `useAuth()` con: `user`, `isAuthenticated`, `securityProfile`, `protectionConfigured`, `pinEnabled`, `pinLength` (`4 | 6`), `lockedUntil`, `hasPasskeys`, `loginWithPin`, `loginWithCredentials`, `loginOfflineEmergency`, `loginWithFido`, `completeGoogleLogin`, `linkGoogleAccount`, `setupOrChangePin`, `removePin`, `registerDevicePasskey`, `removeDevicePasskey`, `resetLocalTerminalSecurity`, `logout`

- [ ] **Step 1: Escribir pruebas que fallan en `app/src/hooks/useAuth.test.ts`**

Crear `app/src/hooks/useAuth.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { AUTH_USER_KEY, SAVED_PIN_KEY, SECURITY_STATE_KEY } from '../domain/auth'
import { createAuthController, type StorageLike } from './useAuth'

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

describe('useAuth controller (migración, lockout, Google owner, FIDO, logout vs reset)', () => {
  it('mantiene modo demo sin protección cuando sindecon_saved_pin es 1234', async () => {
    const storage = makeMemoryStorage({ [SAVED_PIN_KEY]: '1234' })
    const auth = createAuthController({ storage })

    expect(auth.getState().protectionConfigured).toBe(false)
    const okDemo = await auth.loginWithPin('1234')
    expect(okDemo.success).toBe(true)
    expect(storage.getItem(AUTH_USER_KEY)).toBeTruthy()
  })

  it('migra PIN personalizado legado a PinRecord PBKDF2 y activa protectionConfigured', async () => {
    const storage = makeMemoryStorage({ [SAVED_PIN_KEY]: '9876' })
    const auth = createAuthController({ storage })

    expect(auth.getState().protectionConfigured).toBe(true)
    const bad = await auth.loginWithPin('1234')
    expect(bad.success).toBe(false)
    expect(storage.getItem(SAVED_PIN_KEY)).toBeNull()

    const good = await auth.loginWithPin('9876')
    expect(good.success).toBe(true)
    expect(auth.getState().securityProfile.pinRecord?.pinLength).toBe(4)
  })

  it('exige mismo correo Google cuando el equipo está protegido y permite recuperación', async () => {
    const storage = makeMemoryStorage()
    const auth = createAuthController({ storage })

    auth.completeGoogleLogin({ sub: 's1', email: 'dra.ana@gmail.com', name: 'Dra. Ana' })
    await auth.setupOrChangePin('482910')
    auth.logout()

    // logout NO borra el perfil de seguridad
    expect(auth.getState().protectionConfigured).toBe(true)
    expect(auth.getState().user).toBeNull()

    // Intruso bloqueado
    const wrong = auth.completeGoogleLogin({ sub: 's2', email: 'otro@gmail.com', name: 'Otro' })
    expect(wrong.success).toBe(false)

    // Dueña autorizada y recupera opción de cambiar PIN
    const recovered = auth.completeGoogleLogin(
      { sub: 's1', email: 'Dra.Ana@gmail.com', name: 'Dra. Ana' },
      { allowRecovery: true },
    )
    expect(recovered.success).toBe(true)
    expect(recovered.needsPinResetOption).toBe(true)
  })

  it('resetea seguridad local sin lanzar error y limpia credenciales', async () => {
    const storage = makeMemoryStorage()
    const fetchMock = vi.fn(async () => new Response('{"ok":true}', { status: 200 })) as unknown as typeof fetch
    const auth = createAuthController({ storage, fetchFn: fetchMock })

    auth.completeGoogleLogin({ sub: 's1', email: 'doc@cl.org', name: 'Doc' })
    await auth.setupOrChangePin('7391')
    expect(storage.getItem(SECURITY_STATE_KEY)).toBeTruthy()

    await auth.resetLocalTerminalSecurity()
    expect(auth.getState().protectionConfigured).toBe(false)
    expect(auth.getState().user).toBeNull()
    expect(storage.getItem(SECURITY_STATE_KEY)).toBeNull()
    expect(storage.getItem(AUTH_USER_KEY)).toBeNull()
  })
})
```

- [ ] **Step 2: Ejecutar test para confirmar que falla**

Run: `cd app && npx vitest run src/hooks/useAuth.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar `app/src/hooks/useAuth.ts`**

Reemplazar `app/src/hooks/useAuth.ts`:
```typescript
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
} from '../domain/pinAuth'
import { logoutServerAuthSession, type GoogleIdentityProfile } from '../pwa/googleAuth'

export const AUTH_CHANGE_EVENT = 'sindecon_auth_change'
export const SECURITY_CHANGE_EVENT = 'sindecon_security_change'
const DB_META_SECURITY_KEY = 'security_profile'

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

function getSafeLocalStorage(): StorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

function dispatchBrowserEvent(name: string): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(name))
  }
}

function createDexieMirror(): SecurityMirrorStore {
  return {
    async load() {
      if (typeof indexedDB === 'undefined') return null
      try {
        const row = await db.meta.get(DB_META_SECURITY_KEY)
        return (row?.value as DeviceSecurityProfile | undefined) ?? null
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
  if (!storage) return null
  try {
    const raw = storage.getItem(AUTH_USER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthUser
    return parsed && typeof parsed.id === 'string' && typeof parsed.method === 'string' ? parsed : null
  } catch {
    return null
  }
}

export function readSecurityProfile(storage: StorageLike | null): DeviceSecurityProfile {
  if (!storage) return createEmptySecurityProfile()
  try {
    const raw = storage.getItem(SECURITY_STATE_KEY)
    if (!raw) return createEmptySecurityProfile()
    const parsed = JSON.parse(raw) as Partial<DeviceSecurityProfile>
    return {
      ...createEmptySecurityProfile(),
      ...parsed,
      passkeys: Array.isArray(parsed.passkeys) ? parsed.passkeys : [],
    }
  } catch {
    return createEmptySecurityProfile()
  }
}

function hasPendingCustomLegacyPin(storage: StorageLike | null, profile: DeviceSecurityProfile): boolean {
  if (!storage || profile.pinRecord !== null) return false
  const legacy = storage.getItem(SAVED_PIN_KEY)?.trim()
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
      if (user) storage.setItem(AUTH_USER_KEY, JSON.stringify(user))
      else storage.removeItem(AUTH_USER_KEY)
    }
    notifyAll()
  }

  const persistProfile = (profile: DeviceSecurityProfile) => {
    const stamped = { ...profile, updatedAt: Date.now() }
    if (storage) {
      storage.setItem(SECURITY_STATE_KEY, JSON.stringify(stamped))
    }
    void mirror.save(stamped)
    notifyAll()
    return stamped
  }

  const ensureLegacyPinMigrated = async (): Promise<DeviceSecurityProfile> => {
    const profile = readSecurityProfile(storage)
    const legacyRaw = storage?.getItem(SAVED_PIN_KEY)?.trim()
    if (!legacyRaw || !storage) return profile

    if (legacyRaw === DEFAULT_PIN) {
      storage.removeItem(SAVED_PIN_KEY)
      return profile
    }
    if (profile.pinRecord === null && isValidPinFormat(legacyRaw)) {
      const record = await hashPin(legacyRaw)
      storage.removeItem(SAVED_PIN_KEY)
      return persistProfile({ ...profile, pinRecord: record })
    }
    storage.removeItem(SAVED_PIN_KEY)
    return profile
  }

  const hydrateFromMirror = async (): Promise<void> => {
    const local = await ensureLegacyPinMigrated()
    const mirrored = await mirror.load()
    if (!mirrored) return

    const localLockedUntil = local.pinRecord?.lockedUntil ?? 0
    const mirrorLockedUntil = mirrored.pinRecord?.lockedUntil ?? 0

    if (mirrored.updatedAt > local.updatedAt || (!isProtectionConfigured(local) && isProtectionConfigured(mirrored))) {
      const merged: DeviceSecurityProfile = {
        ...mirrored,
        pinRecord: mirrored.pinRecord
          ? {
              ...mirrored.pinRecord,
              lockedUntil: Math.max(localLockedUntil, mirrorLockedUntil) || null,
            }
          : null,
      }
      if (storage) storage.setItem(SECURITY_STATE_KEY, JSON.stringify(merged))
      notifyAll()
    } else if (mirrorLockedUntil > localLockedUntil && local.pinRecord) {
      persistProfile({
        ...local,
        pinRecord: {
          ...local.pinRecord,
          failedAttempts: Math.max(local.pinRecord.failedAttempts, mirrored.pinRecord?.failedAttempts ?? 0),
          lockedUntil: mirrorLockedUntil,
        },
      })
    }
  }

  const getState = () => {
    const user = readStoredUser(storage)
    const securityProfile = readSecurityProfile(storage)
    const protectionConfigured =
      isProtectionConfigured(securityProfile) || hasPendingCustomLegacyPin(storage, securityProfile)
    const pinEnabled = !protectionConfigured || securityProfile.pinRecord !== null || hasPendingCustomLegacyPin(storage, securityProfile)
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

  const loginWithPin = async (
    inputPin: string,
  ): Promise<{ success: boolean; error?: string; lockedUntil?: number | null }> => {
    const profile = await ensureLegacyPinMigrated()
    if (profile.pinRecord) {
      const attempt = await evaluatePinAttempt(inputPin.trim(), profile.pinRecord)
      persistProfile({ ...profile, pinRecord: attempt.nextRecord })
      if (!attempt.ok) {
        return { success: false, error: attempt.error, lockedUntil: attempt.nextRecord.lockedUntil }
      }
      persistUser(createPinUser())
      return { success: true }
    }

    if (isProtectionConfigured(profile)) {
      return {
        success: false,
        error: 'El ingreso por PIN está deshabilitado. Usa tu llave FIDO o Google.',
      }
    }

    if (inputPin.trim() === DEFAULT_PIN) {
      persistUser(createPinUser())
      return { success: true }
    }

    return {
      success: false,
      error: 'PIN incorrecto. El PIN inicial de demostración es 1234.',
    }
  }

  const loginWithCredentials = (username: string, password: string): { success: boolean; error?: string } => {
    if (getState().protectionConfigured) {
      return { success: false, error: 'El modo credenciales demo está deshabilitado en equipos protegidos.' }
    }
    if (!validateCredentials(username, password)) {
      return { success: false, error: 'Usuario o contraseña incorrectos.' }
    }
    persistUser(createPinUser())
    return { success: true }
  }

  const loginOfflineEmergency = (): { success: boolean; error?: string } => {
    if (getState().protectionConfigured) {
      return { success: false, error: 'El ingreso rápido de urgencias está bloqueado al tener PIN o FIDO.' }
    }
    persistUser(createOfflineEmergencyUser())
    return { success: true }
  }

  const loginWithFido = async (): Promise<{ success: boolean; error?: string }> => {
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
    persistProfile({ ...profile, passkeys: updatedPasskeys })
    persistUser(createFidoUser({ id: res.user.id, name: profile.ownerName || res.user.name, email: profile.ownerEmail || res.user.email }))
    return { success: true }
  }

  const completeGoogleLogin = (
    googleProfile: GoogleIdentityProfile,
    opts?: { allowRecovery?: boolean },
  ): { success: boolean; error?: string; needsPinResetOption?: boolean } => {
    const profile = readSecurityProfile(storage)
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
      profile.pinRecord && (opts?.allowRecovery || profile.pinRecord.lockedUntil)
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
    persistUser(createGoogleUser(googleProfile.email, googleProfile.name, googleProfile.avatarUrl))
    return { success: true, needsPinResetOption: Boolean(opts?.allowRecovery && hadPin) }
  }

  const linkGoogleAccount = (googleProfile: GoogleIdentityProfile): { success: boolean; error?: string } => {
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
    storage?.removeItem(SAVED_PIN_KEY)
    persistProfile({ ...profile, pinRecord: nextRecord })
    return { success: true }
  }

  const removePin = (): { success: boolean; error?: string } => {
    if (!readStoredUser(storage)) return { success: false, error: 'Sesión requerida.' }
    const profile = readSecurityProfile(storage)
    persistProfile({ ...profile, pinRecord: null })
    storage?.removeItem(SAVED_PIN_KEY)
    return { success: true }
  }

  const registerDevicePasskey = async (
    label: string,
  ): Promise<{ success: boolean; error?: string; passkey?: StoredPasskey }> => {
    const user = readStoredUser(storage)
    if (!user) return { success: false, error: 'Debes iniciar sesión antes de registrar una passkey.' }
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
    if (storage) {
      storage.removeItem(SECURITY_STATE_KEY)
      storage.removeItem(SAVED_PIN_KEY)
      storage.removeItem(AUTH_USER_KEY)
    }
    await mirror.clear()
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
```

- [ ] **Step 4: Ejecutar pruebas y typecheck**

Run: `cd app && npx vitest run src/hooks/useAuth.test.ts && npx tsc -b`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/hooks/useAuth.ts app/src/hooks/useAuth.test.ts
git commit -m "feat(auth): integrate PBKDF2 PIN, WebAuthn FIDO, and Google Identity in useAuth"
```

---

### Task 7: Interfaz de Usuario (`LoginView`, `SecuritySettingsModal`, `ClinicalStationHeader` y `App.tsx`)

**Files:**
- Modify: `app/src/components/auth/LoginView.tsx`
- Modify: `app/src/components/auth/LoginView.test.ts`
- Create: `app/src/components/auth/SecuritySettingsModal.tsx`
- Modify: `app/src/components/common/ClinicalStationHeader.tsx`
- Modify: `app/src/components/dashboard/Dashboard.tsx`
- Modify: `app/src/components/tree/FolderExplorerView.tsx`
- Modify: `app/src/App.tsx`

**Interfaces:**
- Consumes: `useAuth` (`Task 6`), `BaseModal`, `PILL_BTN_PRIMARY`, `PILL_BTN_SECONDARY`, `PILL_BTN_DANGER`, `CLINICAL_FIELD_CLASS` (`app/src/components/common/DialogModal.tsx`), `initiateGoogleLoginFlow` (`googleAuth.ts`)
- Produces:
  - `LoginView` con soporte de `pinLength` (`4 | 6`), cuenta regresiva en vivo para `lockedUntil`, botón biométrico FIDO real, `"Continuar con Google"`, `"¿Olvidaste tu PIN? Recuperar con Google"` o restablecer terminal local, y ocultación de demo bypasses (`1234`, `Credenciales`, `Urgencias`) cuando `protectionConfigured = true`.
  - `SecuritySettingsModal` con secciones: Cuenta Google (con acceso opcional a respaldo Drive), PIN de guardia (`4` o `6` dígitos), Passkeys FIDO2 y Restablecer seguridad del terminal.
  - Botón `"Seguridad"` en `ClinicalStationHeader`.

- [ ] **Step 1: Ampliar `app/src/components/auth/LoginView.test.ts` con renderizado SSR**

Actualizar `app/src/components/auth/LoginView.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LoginView } from './LoginView'

describe('LoginView Component & Lock Screen Rules', () => {
  it('muestra pista 1234, Credenciales y Urgencias cuando protectionConfigured=false', () => {
    const html = renderToStaticMarkup(
      createElement(LoginView, {
        protectionConfigured: false,
        pinEnabled: true,
        pinLength: 4,
        hasPasskeys: false,
      }),
    )
    expect(html).toContain('1234')
    expect(html).toContain('Credenciales')
    expect(html).toContain('Urgencias')
    expect(html).toContain('Continuar con Google')
  })

  it('oculta 1234, Credenciales y Urgencias y muestra 6 puntos + recuperación Google cuando protectionConfigured=true', () => {
    const html = renderToStaticMarkup(
      createElement(LoginView, {
        protectionConfigured: true,
        pinEnabled: true,
        pinLength: 6,
        hasPasskeys: true,
        ownerEmail: 'dra.martinez@gmail.com',
      }),
    )
    expect(html).not.toContain('1234')
    expect(html).not.toContain('Urgencias')
    expect(html).not.toContain('Credenciales')
    expect(html).toContain('Continuar con Google')
    expect(html).toContain('Huella')
    expect(html).toContain('Recuperar con Google')
    expect(html.match(/data-testid="pin-dot"/g)?.length).toBe(6)
  })
})
```

- [ ] **Step 2: Ejecutar test para confirmar que falla**

Run: `cd app && npx vitest run src/components/auth/LoginView.test.ts`
Expected: FAIL

- [ ] **Step 3: Actualizar `LoginView.tsx`, crear `SecuritySettingsModal.tsx` y conectar `ClinicalStationHeader.tsx`, `Dashboard.tsx`, `FolderExplorerView.tsx` y `App.tsx`**

Actualizar `app/src/components/auth/LoginView.tsx` manteniendo los tokens `.clinical-login` / `--cl-*` y props retrocompatibles:
```typescript
import { useEffect, useState } from 'react'
import {
  Activity,
  Delete,
  Fingerprint,
  KeyRound,
  Lock,
  Moon,
  ShieldAlert,
  ShieldCheck,
  Sun,
  WifiOff,
} from 'lucide-react'
import type { AuthUser } from '../../domain/auth'
import { isWebAuthnSupported } from '../../domain/fidoAuth'
import { useAuth } from '../../hooks/useAuth'

export interface LoginViewProps {
  onLoginSuccess?: (user: AuthUser) => void
  onGoogleSignIn?: () => void
  onOfflineAccess?: () => void
  onRecoverWithGoogle?: () => void
  onResetTerminal?: () => Promise<void> | void
  onPinSubmit?: (pin: string) => Promise<{ success: boolean; error?: string; lockedUntil?: number | null }>
  onFidoLogin?: () => Promise<{ success: boolean; error?: string }>
  onCredentialsSubmit?: (username: string, password: string) => { success: boolean; error?: string }
  protectionConfigured?: boolean
  pinEnabled?: boolean
  pinLength?: 4 | 6
  hasPasskeys?: boolean
  lockedUntil?: number | null
  ownerEmail?: string | null
  externalError?: string | null
  theme?: 'light' | 'dark'
  onToggleTheme?: () => void
}

const KEYPAD_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

export function LoginView(props: LoginViewProps) {
  const auth = useAuth()
  const protectionConfigured = props.protectionConfigured ?? auth.protectionConfigured
  const pinEnabled = props.pinEnabled ?? auth.pinEnabled
  const pinLength = props.pinLength ?? auth.pinLength
  const hasPasskeys = props.hasPasskeys ?? auth.hasPasskeys
  const lockedUntil = props.lockedUntil !== undefined ? props.lockedUntil : auth.lockedUntil
  const ownerEmail = props.ownerEmail !== undefined ? props.ownerEmail : auth.securityProfile.ownerEmail

  const [tab, setTab] = useState<'pin' | 'credentials'>('pin')
  const [pin, setPin] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const remainingLockSeconds =
    lockedUntil && lockedUntil > nowMs ? Math.ceil((lockedUntil - nowMs) / 1000) : 0
  const isLocked = remainingLockSeconds > 0

  useEffect(() => {
    if (!lockedUntil || lockedUntil <= Date.now()) return
    const timer = window.setInterval(() => {
      const current = Date.now()
      setNowMs(current)
      if (current >= lockedUntil) window.clearInterval(timer)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [lockedUntil])

  useEffect(() => {
    if (protectionConfigured && tab === 'credentials') setTab('pin')
  }, [protectionConfigured, tab])

  const displayError = error || props.externalError

  const submitPin = async (candidate: string) => {
    if (busy || isLocked) return
    setBusy(true)
    setError(null)
    try {
      const handler = props.onPinSubmit ?? auth.loginWithPin
      const res = await handler(candidate)
      if (!res.success) {
        setPin('')
        setError(res.error || 'PIN incorrecto.')
      }
    } finally {
      setBusy(false)
    }
  }

  const handleDigitClick = (digit: string) => {
    if (busy || isLocked || pin.length >= pinLength) return
    const next = pin + digit
    setPin(next)
    setError(null)
    if (next.length === pinLength) {
      void submitPin(next)
    }
  }

  const handleBackspace = () => {
    if (busy || isLocked) return
    setPin((prev) => prev.slice(0, -1))
  }

  const handleFidoAccess = async () => {
    if (busy) return
    if (!hasPasskeys && !protectionConfigured) {
      await submitPin('1234')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const handler = props.onFidoLogin ?? auth.loginWithFido
      const res = await handler()
      if (!res.success) {
        setError(res.error || 'No se pudo validar la llave biométrica.')
      }
    } finally {
      setBusy(false)
    }
  }

  const handleCredentialsForm = (e: React.FormEvent) => {
    e.preventDefault()
    if (protectionConfigured) return
    const handler = props.onCredentialsSubmit ?? auth.loginWithCredentials
    const res = handler(username, password)
    if (!res.success) {
      setError(res.error || 'Credenciales incorrectas.')
    }
  }

  const handleEmergencyOffline = () => {
    if (protectionConfigured) return
    if (props.onOfflineAccess) {
      props.onOfflineAccess()
      return
    }
    const res = auth.loginOfflineEmergency()
    if (!res.success) setError(res.error || 'Acceso de urgencias no disponible.')
  }

  const webAuthnCapable = isWebAuthnSupported()

  return (
    <div
      data-testid="login-screen"
      data-login-theme={props.theme === 'dark' ? 'dark' : 'light'}
      className="clinical-login min-h-screen flex flex-col items-center justify-center px-4 py-8"
    >
      <div
        className="w-full max-w-md rounded-3xl border p-6 sm:p-8"
        style={{
          backgroundColor: 'var(--cl-surface)',
          borderColor: 'var(--cl-border)',
          boxShadow: 'var(--cl-shadow-dock)',
        }}
      >
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-2xl"
              style={{ backgroundColor: 'var(--cl-accent-soft)', color: 'var(--cl-accent)' }}
            >
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight" style={{ color: 'var(--cl-fg)' }}>
                SINDECON
              </h1>
              <p className="text-xs font-medium" style={{ color: 'var(--cl-muted)' }}>
                {protectionConfigured
                  ? 'Terminal clínico protegido'
                  : 'Estación clínica offline-first'}
              </p>
            </div>
          </div>
          {props.onToggleTheme && (
            <button
              type="button"
              onClick={props.onToggleTheme}
              aria-label="Cambiar tema visual"
              className="flex h-9 w-9 items-center justify-center rounded-full border transition"
              style={{ borderColor: 'var(--cl-border)', color: 'var(--cl-fg-2)' }}
            >
              {props.theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          )}
        </div>

        {!protectionConfigured && (
          <div
            className="mb-5 grid grid-cols-2 gap-1 rounded-full p-1"
            style={{ backgroundColor: 'var(--cl-bg-subtle)' }}
          >
            <button
              type="button"
              onClick={() => {
                setTab('pin')
                setError(null)
              }}
              className="rounded-full py-2 text-xs font-semibold transition"
              style={
                tab === 'pin'
                  ? { backgroundColor: 'var(--cl-surface)', color: 'var(--cl-fg)', boxShadow: 'var(--cl-shadow-tab)' }
                  : { color: 'var(--cl-muted)' }
              }
            >
              PIN de Guardia
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('credentials')
                setError(null)
              }}
              className="rounded-full py-2 text-xs font-semibold transition"
              style={
                tab === 'credentials'
                  ? { backgroundColor: 'var(--cl-surface)', color: 'var(--cl-fg)', boxShadow: 'var(--cl-shadow-tab)' }
                  : { color: 'var(--cl-muted)' }
              }
            >
              Credenciales
            </button>
          </div>
        )}

        {displayError && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-2 rounded-2xl border px-3.5 py-2.5 text-xs font-medium"
            style={{
              backgroundColor: 'var(--cl-danger-soft)',
              borderColor: 'var(--cl-danger-border)',
              color: 'var(--cl-danger)',
            }}
          >
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {isLocked
                ? `Terminal bloqueado temporalmente (${remainingLockSeconds} s). Usa tu llave FIDO o Google.`
                : displayError}
            </span>
          </div>
        )}

        {isLocked && !displayError && (
          <div
            role="status"
            className="mb-4 flex items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-xs font-semibold"
            style={{
              backgroundColor: 'var(--cl-warn-soft)',
              borderColor: 'var(--cl-warn-border)',
              color: 'var(--cl-warn)',
            }}
          >
            <Lock className="h-4 w-4 shrink-0" />
            <span>Bloqueo temporal activo: espera {remainingLockSeconds} s.</span>
          </div>
        )}

        {tab === 'pin' && pinEnabled && (
          <div>
            <div
              data-testid="pin-dots"
              data-pin-length={pinLength}
              className="mb-3 flex items-center justify-center gap-3 py-2"
            >
              {Array.from({ length: pinLength }).map((_, idx) => {
                const filled = idx < pin.length
                return (
                  <span
                    key={idx}
                    data-testid="pin-dot"
                    className="h-3.5 w-3.5 rounded-full border-2 transition-transform"
                    style={{
                      borderColor: filled ? 'var(--cl-accent)' : 'var(--cl-border)',
                      backgroundColor: filled ? 'var(--cl-accent)' : 'transparent',
                      transform: filled ? 'scale(1.1)' : 'scale(1)',
                    }}
                  />
                )
              })}
            </div>

            {!protectionConfigured && (
              <p className="mb-3 text-center text-[11px] font-medium" style={{ color: 'var(--cl-muted)' }}>
                PIN de guardia inicial: <strong style={{ color: 'var(--cl-fg)' }}>1234</strong>
              </p>
            )}

            <div className="mx-auto grid max-w-[260px] grid-cols-3 gap-2.5">
              {KEYPAD_DIGITS.map((digit) => (
                <button
                  key={digit}
                  type="button"
                  aria-label={`Dígito ${digit}`}
                  disabled={busy || isLocked}
                  onClick={() => handleDigitClick(digit)}
                  className="h-12 rounded-2xl border text-base font-bold transition active:scale-95 disabled:opacity-45"
                  style={{
                    backgroundColor: 'var(--cl-surface-muted)',
                    borderColor: 'var(--cl-border)',
                    color: 'var(--cl-fg)',
                  }}
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                data-testid="fido-unlock-btn"
                title={
                  hasPasskeys
                    ? 'Desbloquear con Huella / Passkey FIDO2'
                    : 'Acceso biométrico de demostración'
                }
                aria-label="Ingresar con Huella o Passkey"
                disabled={busy || (protectionConfigured && !hasPasskeys)}
                onClick={() => void handleFidoAccess()}
                className="flex h-12 items-center justify-center rounded-2xl border transition active:scale-95 disabled:opacity-40"
                style={{
                  backgroundColor: hasPasskeys ? 'var(--cl-accent-soft)' : 'var(--cl-surface-muted)',
                  borderColor: hasPasskeys ? 'var(--cl-accent-border)' : 'var(--cl-border)',
                  color: hasPasskeys ? 'var(--cl-accent)' : 'var(--cl-muted)',
                }}
              >
                <Fingerprint className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Dígito 0"
                disabled={busy || isLocked}
                onClick={() => handleDigitClick('0')}
                className="h-12 rounded-2xl border text-base font-bold transition active:scale-95 disabled:opacity-45"
                style={{
                  backgroundColor: 'var(--cl-surface-muted)',
                  borderColor: 'var(--cl-border)',
                  color: 'var(--cl-fg)',
                }}
              >
                0
              </button>
              <button
                type="button"
                aria-label="Borrar último dígito"
                disabled={busy || isLocked || pin.length === 0}
                onClick={handleBackspace}
                className="flex h-12 items-center justify-center rounded-2xl border transition active:scale-95 disabled:opacity-45"
                style={{
                  backgroundColor: 'var(--cl-surface-muted)',
                  borderColor: 'var(--cl-border)',
                  color: 'var(--cl-fg-2)',
                }}
              >
                <Delete className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {tab === 'pin' && !pinEnabled && hasPasskeys && (
          <div className="mb-4 rounded-2xl border p-4 text-center" style={{ borderColor: 'var(--cl-border)' }}>
            <ShieldCheck className="mx-auto mb-2 h-8 w-8" style={{ color: 'var(--cl-accent)' }} />
            <p className="text-xs font-medium" style={{ color: 'var(--cl-fg-2)' }}>
              Este equipo usa Passkey FIDO2 o cuenta Google (PIN desactivado).
            </p>
          </div>
        )}

        {tab === 'credentials' && !protectionConfigured && (
          <form onSubmit={handleCredentialsForm} className="space-y-3">
            <input
              type="text"
              placeholder="Usuario clínico (ej. medico)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-11 w-full rounded-xl border px-3.5 text-sm outline-none"
              style={{
                backgroundColor: 'var(--cl-surface-muted)',
                borderColor: 'var(--cl-border)',
                color: 'var(--cl-fg)',
              }}
            />
            <input
              type="password"
              placeholder="Contraseña inicial"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 w-full rounded-xl border px-3.5 text-sm outline-none"
              style={{
                backgroundColor: 'var(--cl-surface-muted)',
                borderColor: 'var(--cl-border)',
                color: 'var(--cl-fg)',
              }}
            />
            <button
              type="submit"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-full text-xs font-semibold text-white transition"
              style={{ backgroundColor: 'var(--cl-accent)' }}
            >
              <KeyRound className="h-4 w-4" />
              Ingresar
            </button>
          </form>
        )}

        <div className="mt-5 space-y-2.5 border-t pt-4" style={{ borderColor: 'var(--cl-border-soft)' }}>
          {hasPasskeys && webAuthnCapable && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleFidoAccess()}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-full text-xs font-semibold text-white transition disabled:opacity-50"
              style={{ backgroundColor: 'var(--cl-accent)' }}
            >
              <Fingerprint className="h-4 w-4" />
              Ingresar con Huella / Passkey FIDO2
            </button>
          )}

          {props.onGoogleSignIn && (
            <button
              type="button"
              data-testid="google-login-btn"
              onClick={props.onGoogleSignIn}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-full border text-xs font-semibold transition"
              style={{
                backgroundColor: 'var(--cl-surface-elevated)',
                borderColor: 'var(--cl-border)',
                color: 'var(--cl-fg)',
              }}
            >
              Continuar con Google
            </button>
          )}

          {!protectionConfigured && (
            <button
              type="button"
              data-testid="emergency-offline-btn"
              onClick={handleEmergencyOffline}
              className="flex h-9 w-full items-center justify-center gap-1.5 rounded-full text-[11px] font-semibold transition"
              style={{ color: 'var(--cl-muted)' }}
            >
              <WifiOff className="h-3.5 w-3.5" />
              Ingreso directo — Urgencias (Sin red)
            </button>
          )}

          {protectionConfigured && (
            <div className="pt-1 text-center">
              {ownerEmail && (props.onRecoverWithGoogle || props.onGoogleSignIn) ? (
                <button
                  type="button"
                  data-testid="recover-google-btn"
                  onClick={props.onRecoverWithGoogle ?? props.onGoogleSignIn}
                  className="text-[11px] font-semibold underline-offset-2 hover:underline"
                  style={{ color: 'var(--cl-accent)' }}
                >
                  ¿Olvidaste tu PIN? Recuperar con Google ({ownerEmail})
                </button>
              ) : !confirmReset ? (
                <button
                  type="button"
                  data-testid="reset-local-terminal-btn"
                  onClick={() => setConfirmReset(true)}
                  className="text-[11px] font-semibold underline-offset-2 hover:underline"
                  style={{ color: 'var(--cl-muted)' }}
                >
                  ¿Olvidaste tu PIN? Restablecer terminal local
                </button>
              ) : (
                <div
                  className="mt-2 rounded-2xl border p-3 text-left text-[11px]"
                  style={{
                    backgroundColor: 'var(--cl-warn-soft)',
                    borderColor: 'var(--cl-warn-border)',
                    color: 'var(--cl-fg)',
                  }}
                >
                  <p className="mb-2 font-medium">
                    Esto quitará el bloqueo local (PIN/FIDO) sin borrar tus notas clínicas ni PDFs.
                  </p>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="rounded-full px-3 py-1 font-semibold"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmReset(false)
                        void (props.onResetTerminal ? props.onResetTerminal() : auth.resetLocalTerminalSecurity())
                      }}
                      className="rounded-full bg-red-600 px-3 py-1 font-semibold text-white"
                    >
                      Confirmar restablecimiento
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

Crear `app/src/components/auth/SecuritySettingsModal.tsx`:
```typescript
import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  Cloud,
  Fingerprint,
  KeyRound,
  ShieldCheck,
  Trash2,
  UserCheck,
} from 'lucide-react'
import type { AuthUser, DeviceSecurityProfile } from '../../domain/auth'
import { isWebAuthnSupported } from '../../domain/fidoAuth'
import { isValidPinFormat } from '../../domain/pinAuth'
import {
  BaseModal,
  CLINICAL_FIELD_CLASS,
  PILL_BTN_DANGER,
  PILL_BTN_PRIMARY,
  PILL_BTN_SECONDARY,
} from '../common/DialogModal'

export interface SecuritySettingsModalProps {
  isOpen: boolean
  onClose: () => void
  user: AuthUser | null
  securityProfile: DeviceSecurityProfile
  protectionConfigured: boolean
  isGoogleDriveConnected: boolean
  onLinkGoogleAccount: () => void
  onOpenGoogleDriveSync: () => void
  onSavePin: (newPin: string, currentPin?: string) => Promise<{ success: boolean; error?: string }>
  onRemovePin: () => { success: boolean; error?: string }
  onRegisterPasskey: (label: string) => Promise<{ success: boolean; error?: string }>
  onRemovePasskey: (credentialId: string) => void
  onResetTerminalSecurity: () => Promise<void>
}

export function SecuritySettingsModal({
  isOpen,
  onClose,
  user,
  securityProfile,
  protectionConfigured,
  isGoogleDriveConnected,
  onLinkGoogleAccount,
  onOpenGoogleDriveSync,
  onSavePin,
  onRemovePin,
  onRegisterPasskey,
  onRemovePasskey,
  onResetTerminalSecurity,
}: SecuritySettingsModalProps) {
  const [pinLengthChoice, setPinLengthChoice] = useState<4 | 6>(
    securityProfile.pinRecord?.pinLength ?? 4,
  )
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [passkeyLabel, setPasskeyLabel] = useState('Huella / Face ID de este equipo')
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setPinLengthChoice(securityProfile.pinRecord?.pinLength ?? 4)
    setCurrentPin('')
    setNewPin('')
    setConfirmPin('')
    setFeedback(null)
  }, [isOpen, securityProfile.pinRecord?.pinLength])

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault()
    setFeedback(null)
    if (!isValidPinFormat(newPin) || newPin.length !== pinLengthChoice) {
      setFeedback({ tone: 'err', text: `Ingresa exactamente ${pinLengthChoice} dígitos numéricos.` })
      return
    }
    if (newPin !== confirmPin) {
      setFeedback({ tone: 'err', text: 'Los dos PIN ingresados no coinciden.' })
      return
    }
    setBusy(true)
    try {
      const requireOld = securityProfile.pinRecord !== null && user?.method === 'pin'
      const res = await onSavePin(newPin, requireOld ? currentPin : undefined)
      if (!res.success) {
        setFeedback({ tone: 'err', text: res.error || 'No se pudo guardar el PIN.' })
        return
      }
      setCurrentPin('')
      setNewPin('')
      setConfirmPin('')
      setFeedback({ tone: 'ok', text: 'PIN de guardia cifrado (PBKDF2) guardado correctamente.' })
    } finally {
      setBusy(false)
    }
  }

  const handleRegisterFido = async () => {
    setFeedback(null)
    setBusy(true)
    try {
      const res = await onRegisterPasskey(passkeyLabel)
      if (!res.success) {
        setFeedback({ tone: 'err', text: res.error || 'No se pudo registrar la passkey.' })
        return
      }
      setFeedback({ tone: 'ok', text: 'Llave FIDO2 / Passkey registrada en este equipo.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Seguridad de la Estación Clínica"
      subtitle={
        protectionConfigured
          ? 'Terminal protegido con PIN PBKDF2 / FIDO2'
          : 'Modo inicial de demostración (PIN 1234)'
      }
      icon={<ShieldCheck className="h-5 w-5" />}
      maxWidthClass="max-w-lg"
      footer={
        <button type="button" onClick={onClose} className={PILL_BTN_SECONDARY}>
          Cerrar
        </button>
      }
    >
      <div data-testid="security-settings-modal" className="space-y-5 text-xs">
        {feedback && (
          <div
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 font-medium ${
              feedback.tone === 'ok'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                : 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200'
            }`}
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{feedback.text}</span>
          </div>
        )}

        <section className="rounded-2xl border border-[var(--ch-border-subtle)] p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 font-semibold text-[var(--ch-text-primary)]">
              <UserCheck className="h-4 w-4 text-[var(--ch-accent)]" />
              Cuenta Google vinculada
            </span>
            <span className="text-[11px] text-[var(--ch-text-muted)]">
              {securityProfile.ownerEmail || 'Sin cuenta vinculada'}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onLinkGoogleAccount} className={PILL_BTN_SECONDARY}>
              {securityProfile.ownerEmail ? 'Cambiar cuenta Google' : 'Vincular cuenta Google'}
            </button>
            <button type="button" onClick={onOpenGoogleDriveSync} className={PILL_BTN_SECONDARY}>
              <Cloud className="h-3.5 w-3.5" />
              {isGoogleDriveConnected ? 'Gestionar Google Drive' : 'Activar respaldo en Google Drive'}
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--ch-border-subtle)] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-semibold text-[var(--ch-text-primary)]">
              <KeyRound className="h-4 w-4 text-[var(--ch-accent)]" />
              PIN de Guardia (PBKDF2-SHA256)
            </span>
            <div className="flex gap-1">
              {([4, 6] as const).map((len) => (
                <button
                  key={len}
                  type="button"
                  onClick={() => {
                    setPinLengthChoice(len)
                    setNewPin('')
                    setConfirmPin('')
                  }}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    pinLengthChoice === len
                      ? 'bg-[var(--ch-accent-solid)] text-white'
                      : 'border border-[var(--ch-border-subtle)] text-[var(--ch-text-secondary)]'
                  }`}
                >
                  {len} dígitos
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={(e) => void handleSavePin(e)} className="space-y-2">
            {securityProfile.pinRecord !== null && user?.method === 'pin' && (
              <input
                type="password"
                inputMode="numeric"
                placeholder="PIN actual"
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                className={CLINICAL_FIELD_CLASS}
              />
            )}
            <div className="grid grid-cols-2 gap-2">
              <input
                data-testid="pin-new-input"
                type="password"
                inputMode="numeric"
                maxLength={pinLengthChoice}
                placeholder={`Nuevo PIN (${pinLengthChoice} dígitos)`}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                className={CLINICAL_FIELD_CLASS}
              />
              <input
                data-testid="pin-confirm-input"
                type="password"
                inputMode="numeric"
                maxLength={pinLengthChoice}
                placeholder="Confirmar PIN"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                className={CLINICAL_FIELD_CLASS}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="submit"
                data-testid="save-pin-btn"
                disabled={busy}
                className={PILL_BTN_PRIMARY}
              >
                Guardar PIN
              </button>
              {securityProfile.pinRecord && (
                <button
                  type="button"
                  onClick={() => {
                    onRemovePin()
                    setFeedback({ tone: 'ok', text: 'PIN personalizado eliminado.' })
                  }}
                  className={PILL_BTN_SECONDARY}
                >
                  Quitar PIN
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-[var(--ch-border-subtle)] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-semibold text-[var(--ch-text-primary)]">
              <Fingerprint className="h-4 w-4 text-[var(--ch-accent)]" />
              Llaves Biométricas / Passkeys FIDO2
            </span>
            <span className="text-[11px] text-[var(--ch-text-muted)]">
              {securityProfile.passkeys.length} registradas
            </span>
          </div>

          <div className="flex gap-2">
            <input
              data-testid="passkey-label-input"
              type="text"
              value={passkeyLabel}
              onChange={(e) => setPasskeyLabel(e.target.value)}
              placeholder="Nombre del equipo o huella"
              className={CLINICAL_FIELD_CLASS}
            />
            <button
              type="button"
              data-testid="register-passkey-btn"
              disabled={busy || !isWebAuthnSupported()}
              onClick={() => void handleRegisterFido()}
              className={PILL_BTN_PRIMARY}
            >
              Registrar
            </button>
          </div>

          {securityProfile.passkeys.length > 0 && (
            <ul className="space-y-1.5">
              {securityProfile.passkeys.map((pk) => (
                <li
                  key={pk.credentialId}
                  className="flex items-center justify-between rounded-xl border border-[var(--ch-border-subtle)] px-3 py-2"
                >
                  <div>
                    <div className="font-semibold text-[var(--ch-text-primary)]">{pk.label}</div>
                    <div className="text-[10px] text-[var(--ch-text-muted)]">
                      {pk.sealedToken ? 'Híbrida online + offline' : 'Solo verificación local offline'} · usos: {pk.signCount}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={`Eliminar passkey ${pk.label}`}
                    onClick={() => onRemovePasskey(pk.credentialId)}
                    className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {protectionConfigured && (
          <section className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50/40 p-3.5 dark:border-red-900/60 dark:bg-red-950/20">
            <span className="text-[11px] text-[var(--ch-text-secondary)]">
              Restablecer bloqueo borra PIN/FIDO/dueño locales sin tocar tus notas.
            </span>
            <button
              type="button"
              onClick={() => {
                void onResetTerminalSecurity()
                onClose()
              }}
              className={PILL_BTN_DANGER}
            >
              Restablecer
            </button>
          </section>
        )}
      </div>
    </BaseModal>
  )
}
```

Conectar en `ClinicalStationHeader.tsx`, `Dashboard.tsx`, `FolderExplorerView.tsx` y `App.tsx`:
1. En `app/src/components/common/ClinicalStationHeader.tsx`:
   - Importar `ShieldCheck` desde `'lucide-react'`.
   - Agregar `onOpenSecuritySettings?: () => void` en `ClinicalStationHeaderProps`.
   - Junto al botón `"Bloquear"` (`onLockTerminal`), añadir botón:
     ```tsx
     {onOpenSecuritySettings && (
       <button
         type="button"
         data-testid="header-security-btn"
         onClick={onOpenSecuritySettings}
         title="Configurar PIN, FIDO y cuenta Google"
         className={btnCls}
       >
         <ShieldCheck className="h-3.5 w-3.5" />
         <span className="hidden sm:inline">Seguridad</span>
       </button>
     )}
     ```
     y asegurar `data-testid="header-lock-btn"` en el botón de bloquear (`onLockTerminal`).
2. En `app/src/components/dashboard/Dashboard.tsx` y `app/src/components/tree/FolderExplorerView.tsx`:
   - Agregar `onOpenSecuritySettings?: () => void` en `DashboardProps` / `FolderExplorerViewProps` y reenviarlo al `<ClinicalStationHeader onOpenSecuritySettings={onOpenSecuritySettings} ... />`.
3. En `app/src/App.tsx`:
   - Importar `SecuritySettingsModal` (`'./components/auth/SecuritySettingsModal'`) e `initiateGoogleLoginFlow`, `checkServerAuthSession` (`'./pwa/googleAuth'`).
   - Desestructurar de `useAuth()` además de `user`, `isAuthenticated`, `logout`:
     `securityProfile`, `protectionConfigured`, `pinEnabled`, `pinLength`, `lockedUntil`, `hasPasskeys`, `loginWithPin`, `loginWithCredentials`, `loginOfflineEmergency`, `loginWithFido`, `completeGoogleLogin`, `linkGoogleAccount`, `setupOrChangePin`, `removePin`, `registerDevicePasskey`, `removeDevicePasskey`, `resetLocalTerminalSecurity`.
   - Estado: `const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false)` y `const [googleLoginError, setGoogleLoginError] = useState<string | null>(null)`.
   - Al montar, consultar pasivamente `void checkServerAuthSession()` solo para refrescar metadatos de cuenta si no hay usuario bloqueado explícitamente.
   - Handler `handleGoogleSignIn`:
     ```tsx
     const handleGoogleSignIn = useCallback((recoverMode = false) => {
       setGoogleLoginError(null)
       initiateGoogleLoginFlow({
         loginHint: securityProfile.ownerEmail ?? undefined,
         onSuccess: (profile) => {
           if (isAuthenticated) {
             const res = linkGoogleAccount(profile)
             if (!res.success) setGoogleLoginError(res.error ?? 'Error al vincular Google')
             return
           }
           const res = completeGoogleLogin(profile, { allowRecovery: recoverMode })
           if (!res.success) {
             setGoogleLoginError(res.error ?? 'Acceso denegado para esta cuenta Google.')
             return
           }
           if (res.needsPinResetOption) setIsSecurityModalOpen(true)
         },
         onError: (msg) => setGoogleLoginError(msg),
       })
     }, [isAuthenticated, securityProfile.ownerEmail, linkGoogleAccount, completeGoogleLogin])
     ```
   - Pasar a `<LoginView ... />`:
     ```tsx
     <LoginView
       onGoogleSignIn={() => handleGoogleSignIn(false)}
       onRecoverWithGoogle={() => handleGoogleSignIn(true)}
       onResetTerminal={resetLocalTerminalSecurity}
       onPinSubmit={loginWithPin}
       onFidoLogin={loginWithFido}
       onCredentialsSubmit={loginWithCredentials}
       onOfflineAccess={() => { void loginOfflineEmergency() }}
       protectionConfigured={protectionConfigured}
       pinEnabled={pinEnabled}
       pinLength={pinLength}
       hasPasskeys={hasPasskeys}
       lockedUntil={lockedUntil}
       ownerEmail={securityProfile.ownerEmail}
       externalError={googleLoginError}
       theme={theme}
       onToggleTheme={toggleTheme}
     />
     ```
   - Pasar `onOpenSecuritySettings={() => setIsSecurityModalOpen(true)}` a `<Dashboard ... />` y `<FolderExplorerView ... />`.
   - Montar `<SecuritySettingsModal ... />` junto a `<GoogleDriveModal ... />`:
     ```tsx
     <SecuritySettingsModal
       isOpen={isSecurityModalOpen}
       onClose={() => setIsSecurityModalOpen(false)}
       user={user}
       securityProfile={securityProfile}
       protectionConfigured={protectionConfigured}
       isGoogleDriveConnected={isGoogleConnected}
       onLinkGoogleAccount={() => handleGoogleSignIn(false)}
       onOpenGoogleDriveSync={() => {
         setIsSecurityModalOpen(false)
         setIsGoogleModalOpen(true)
       }}
       onSavePin={setupOrChangePin}
       onRemovePin={removePin}
       onRegisterPasskey={registerDevicePasskey}
       onRemovePasskey={removeDevicePasskey}
       onResetTerminalSecurity={resetLocalTerminalSecurity}
     />
     ```

- [ ] **Step 4: Ejecutar tests de UI y typecheck**

Run: `cd app && npx vitest run src/components/auth/LoginView.test.ts src/components/dashboard/Dashboard.test.ts src/components/tree/FolderExplorerView.test.ts && npx tsc -b`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/components/auth/LoginView.tsx app/src/components/auth/LoginView.test.ts app/src/components/auth/SecuritySettingsModal.tsx app/src/components/common/ClinicalStationHeader.tsx app/src/components/dashboard/Dashboard.tsx app/src/components/tree/FolderExplorerView.tsx app/src/App.tsx
git commit -m "feat(ui): wire Google login, FIDO2 WebAuthn passkeys, PBKDF2 PIN, and SecuritySettingsModal"
```

---

### Task 8: Verificación Integral, E2E WebAuthn Virtual Authenticator y Cierre

**Files:**
- Create: `app/e2e/auth-fido-pin.spec.ts`

- [ ] **Step 1: Escribir test E2E `app/e2e/auth-fido-pin.spec.ts` usando Chrome DevTools Protocol Virtual Authenticator**

Crear `app/e2e/auth-fido-pin.spec.ts`:
```typescript
import { test, expect } from '@playwright/test'

test.describe('Autenticación Clínica: PIN PBKDF2, Lockout y FIDO2 Passkey', () => {
  test('configura PIN de 6 dígitos y Passkey FIDO2 virtual, bloquea tras 5 fallos y desbloquea con biometría offline', async ({
    page,
  }) => {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('WebAuthn.enable')
    await cdp.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    })

    await page.goto('/')
    await page.evaluate(() => {
      localStorage.clear()
    })
    await page.reload()

    // 1. Ingreso inicial demo con PIN 1234
    await expect(page.getByTestId('login-screen')).toBeVisible()
    await expect(page.getByTestId('emergency-offline-btn')).toBeVisible()
    for (const d of ['1', '2', '3', '4']) {
      await page.getByRole('button', { name: `Dígito ${d}` }).click()
    }

    // 2. Abrir Seguridad desde cabecera y fijar PIN de 6 dígitos + Passkey FIDO2
    await expect(page.getByTestId('header-security-btn')).toBeVisible({ timeout: 10000 })
    await page.getByTestId('header-security-btn').click()
    await expect(page.getByTestId('security-settings-modal')).toBeVisible()

    await page.getByRole('button', { name: '6 dígitos' }).click()
    await page.getByTestId('pin-new-input').fill('482910')
    await page.getByTestId('pin-confirm-input').fill('482910')
    await page.getByTestId('save-pin-btn').click()
    await expect(page.getByTestId('security-settings-modal')).toContainText('PBKDF2')

    await page.getByTestId('register-passkey-btn').click()
    await expect(page.getByTestId('security-settings-modal')).toContainText('1 registradas')
    await page.getByRole('button', { name: 'Cerrar' }).click()

    // 3. Bloquear estación y verificar ocultamiento de 1234 / Urgencias + lockout tras 5 fallos
    await page.getByTestId('header-lock-btn').click()
    await expect(page.getByTestId('login-screen')).toBeVisible()
    await expect(page.getByTestId('emergency-offline-btn')).toHaveCount(0)
    await expect(page.getByTestId('pin-dot')).toHaveCount(6)

    for (let attempt = 0; attempt < 5; attempt++) {
      for (const d of ['0', '0', '0', '0', '0', '0']) {
        const digitBtn = page.getByRole('button', { name: `Dígito ${d}` })
        await expect(digitBtn).toBeEnabled()
        await digitBtn.click()
      }
      await expect(page.getByRole('alert')).toBeVisible()
    }
    await expect(page.getByRole('alert')).toContainText(/bloqueado|Espera/i)

    // 4. Desbloquear con llave biométrica FIDO2 virtual (simulación sin necesidad de esperar lockout)
    await page.getByTestId('fido-unlock-btn').click()
    await expect(page.getByTestId('header-security-btn')).toBeVisible({ timeout: 10000 })
  })
})
```

- [ ] **Step 2: Ejecutar suite completa de pruebas, typecheck, build, lint y E2E**

Run:
```bash
cd app
npm test
npm run lint
npm run build
npx playwright test e2e/auth-fido-pin.spec.ts
```
Expected: `0` fallos en Vitest, `0` errores en Oxlint, `tsc -b && vite build` limpio y E2E en verde.

- [ ] **Step 3: Commit final de E2E**

```bash
git add app/e2e/auth-fido-pin.spec.ts
git commit -m "test(e2e): verify PBKDF2 PIN lockout and WebAuthn FIDO2 unlock with virtual authenticator"
```
