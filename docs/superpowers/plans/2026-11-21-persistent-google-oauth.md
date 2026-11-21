# Sesión Persistente de Google Drive y Google Docs (Cloudflare Pages Functions) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mantener conectada de forma persistente la sesión OAuth de Google Drive y Google Docs en SINDECON más allá del límite de 1 hora sin popups periódicos ni bases de datos externas, manteniendo compatibilidad offline-first y fallback local.

**Architecture:** Se implementa un *Token Broker* stateless en `app/functions/api/oauth/` (`exchange`, `refresh`, `logout`) para Cloudflare Pages Functions que intercambia códigos OAuth con `GOOGLE_CLIENT_SECRET` y guarda el `refresh_token` cifrado con AES-256-GCM dentro de una cookie `HttpOnly; SameSite=Lax; Path=/api/oauth`. En el cliente, `app/src/pwa/googleDrive.ts` centraliza `ensureValidAccessToken()` (mutex *single-flight*) e `initiateGoogleOAuthFlow()` (`initCodeClient` en popup con fallback transparente a `initTokenClient`), consumidos de forma unificada por `useGoogleSync.ts`, `GoogleDocsExportModal.tsx` y `AiSettingsModal.tsx`.

**Tech Stack:** Cloudflare Pages Functions (Web Standard `Request`, `Response`, `crypto.subtle`, `fetch`), Google Identity Services (`initCodeClient` / `initTokenClient`), React 19, TypeScript 6 (`erasableSyntaxOnly`, `verbatimModuleSyntax`), Vite 8, `vite-plugin-pwa` (Workbox), Vitest (`environment: 'node'`), Oxlint.

**Spec:** `docs/superpowers/specs/2026-11-21-persistent-google-oauth-design.md`

## Global Constraints

- **Ubicación de Cloudflare Functions:** Todas las Pages Functions deben vivir en `app/functions/api/oauth/` (porque Cloudflare Pages usa `Root directory: app`).
- **Cero dependencias npm nuevas:** Las Pages Functions usan exclusivamente APIs Web estándar (`crypto.subtle`, `fetch`, `Request`, `Response`, `URL`, `URLSearchParams`, `TextEncoder`, `TextDecoder`, `btoa`, `atob`).
- **Cookie stateless cifrada:** Nombre exacto `sindecon_gdrive_rt`, payload `{ rt, email?, iat }`, cifrado AES-256-GCM con clave derivada por `SHA-256(OAUTH_COOKIE_SECRET)`, atributos `HttpOnly; SameSite=Lax; Path=/api/oauth; Max-Age=15552000` y `Secure` en HTTPS (omitido solo en `http://localhost` / `http://127.0.0.1`).
- **Seguridad HTTP en `/api/oauth/*`:** Solo aceptar `POST`, validar `Origin` (o `Sec-Fetch-Site === 'same-origin'` si falta `Origin`) devolviendo `403` ante mismatch, e incluir `Cache-Control: no-store, private` y `Vary: Cookie`.
- **Scopes OAuth:** Conservar `https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file` (no sensibles, sin auditoría CASA).
- **Offline-first y fallback:** Errores de red / offline / `5xx` / `429` NO borran `cuaderno-gdrive-enabled` ni la cookie `sindecon_gdrive_rt`. Si `/api/oauth/*` responde `404`/`405` o hay un `Client ID` personalizado distinto de `DEFAULT_GOOGLE_CLIENT_ID`, degradar al flujo GIS clásico (`initTokenClient`).
- **TypeScript 6 estricto:** Respetar `verbatimModuleSyntax: true`, `erasableSyntaxOnly: true`, `noUnusedLocals: true` y `noUnusedParameters: true`.
- **Git limpio:** Hacer commits atómicos agregando explícitamente los archivos de cada tarea (nunca `git add -A`, para no tocar archivos no relacionados del workspace).

---

### Task 1: Configuración de TypeScript para Functions, Workbox y `.gitignore`

**Files:**
- Modify: `.gitignore`
- Modify: `app/.gitignore`
- Create: `app/.dev.vars.example`
- Modify: `app/vite.config.ts:44-50`
- Create: `app/tsconfig.functions.json`
- Modify: `app/tsconfig.json:1-7`

**Interfaces:**
- Consumes: Ninguno
- Produces:
  - `app/tsconfig.functions.json` integrado al build `tsc -b` para verificar tipos de `app/functions/**/*.ts` con librería `WebWorker` (sin `window`/`document`).
  - `navigateFallbackDenylist: [/^\/api\//]` en `app/vite.config.ts`.
  - Plantilla `app/.dev.vars.example` e ignoro de `.dev.vars` y `.wrangler/`.

- [ ] **Step 1: Actualizar `.gitignore` y `app/.gitignore` para ignorar `.dev.vars` y `.wrangler/`**

Editar `.gitignore` (al final del archivo):
```gitignore
.dev.vars
.wrangler/
```

Editar `app/.gitignore` (al final del archivo):
```gitignore
# Cloudflare Wrangler / Pages Functions local secrets
.dev.vars
.wrangler/
```

- [ ] **Step 2: Crear `app/.dev.vars.example`**

Crear `app/.dev.vars.example`:
```ini
# Variables locales para probar Cloudflare Pages Functions con `npx wrangler pages dev`
# Copia este archivo a `app/.dev.vars` (nunca lo subas a git).
GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-tu-client-secret
OAUTH_COOKIE_SECRET=cambia-esto-por-una-clave-aleatoria-de-al-menos-32-caracteres
```

- [ ] **Step 3: Agregar `navigateFallbackDenylist` en `app/vite.config.ts`**

En `app/vite.config.ts`, dentro de `workbox: { ... }`:
```typescript
      workbox: {
        // Precache de todos los assets → la app abre offline completa.
        // La navegación SPA cae a index.html (navigateFallback por defecto),
        // excluyendo /api/* para no interceptar Cloudflare Pages Functions.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/api\//],
      },
```

- [ ] **Step 4: Crear `app/tsconfig.functions.json` y referenciarlo en `app/tsconfig.json`**

Crear `app/tsconfig.functions.json`:
```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.functions.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023", "WebWorker"],
    "module": "esnext",
    "types": [],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["functions"]
}
```

Editar `app/tsconfig.json`:
```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.functions.json" }
  ]
}
```

- [ ] **Step 5: Verificar que `tsc -b`, lint y build pasan**

Run:
```powershell
npm --prefix app run lint; npm --prefix app run build
```
Expected: Salida con código `0` sin errores de TypeScript ni Vite.

- [ ] **Step 6: Commit**

```bash
git add .gitignore app/.gitignore app/.dev.vars.example app/vite.config.ts app/tsconfig.functions.json app/tsconfig.json
git commit -m "chore(oauth): configure Cloudflare Functions tsconfig, Workbox API exclusion and .dev.vars ignore"
```

---

### Task 2: Utilidades compartidas de Pages Functions (`_shared.ts`)

**Files:**
- Create: `app/functions/api/oauth/_shared.ts`
- Test: `app/functions/api/oauth/_shared.test.ts`

**Interfaces:**
- Consumes: Web Standard Crypto (`crypto.subtle`), `Request`, `Response`
- Produces:
  - `export interface OAuthEnv { GOOGLE_CLIENT_ID?: string; GOOGLE_CLIENT_SECRET?: string; OAUTH_COOKIE_SECRET?: string }`
  - `export interface CfPagesContext { request: Request; env: OAuthEnv }`
  - `export interface EncryptedSessionPayload { rt: string; email?: string; iat: number }`
  - `export const COOKIE_NAME = 'sindecon_gdrive_rt'`
  - `export const COOKIE_MAX_AGE_SECONDS = 15_552_000`
  - `export function jsonResponse(data: unknown, status?: number, extraHeaders?: HeadersInit): Response`
  - `export function validateSameOriginPost(request: Request): Response | null`
  - `export function validateEnv(env: OAuthEnv): { ok: true; clientId: string; clientSecret: string; cookieSecret: string } | { ok: false; response: Response }`
  - `export function encryptCookiePayload(payload: EncryptedSessionPayload, secret: string): Promise<string>`
  - `export function decryptCookiePayload(cookieValue: string, secret: string): Promise<EncryptedSessionPayload | null>`
  - `export function readSessionCookie(request: Request): string | null`
  - `export function buildSessionSetCookieHeader(encryptedValue: string, requestUrl: string): string`
  - `export function buildClearCookieHeader(requestUrl: string): string`

- [ ] **Step 1: Escribir los tests unitarios que fallan para `_shared.ts`**

Crear `app/functions/api/oauth/_shared.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import {
  COOKIE_NAME,
  COOKIE_MAX_AGE_SECONDS,
  encryptCookiePayload,
  decryptCookiePayload,
  readSessionCookie,
  buildSessionSetCookieHeader,
  buildClearCookieHeader,
  validateSameOriginPost,
  validateEnv,
  jsonResponse,
} from './_shared'

describe('oauth _shared helpers', () => {
  const secret = 'super-secret-32-bytes-minimum-key-for-aes-gcm'

  it('cifra y descifra el payload de refresh_token con AES-256-GCM', async () => {
    const payload = {
      rt: '1//0g-refresh-token-de-prueba',
      email: 'medico@hospital.cl',
      iat: 1730000000000,
    }

    const encrypted = await encryptCookiePayload(payload, secret)
    expect(encrypted.split('.')).toHaveLength(2)
    expect(encrypted).not.toContain(payload.rt)

    const decrypted = await decryptCookiePayload(encrypted, secret)
    expect(decrypted).toEqual(payload)
  })

  it('rechaza cookies manipuladas, malformadas o con secreto distinto', async () => {
    const encrypted = await encryptCookiePayload(
      { rt: '1//0g-token', iat: 1730000000000 },
      secret,
    )

    expect(await decryptCookiePayload(encrypted, 'otro-secreto-distinto')).toBeNull()
    expect(await decryptCookiePayload(`${encrypted}x`, secret)).toBeNull()
    expect(await decryptCookiePayload('sin-punto', secret)).toBeNull()
    expect(await decryptCookiePayload('', secret)).toBeNull()
  })

  it('lee correctamente la cookie desde el header Cookie con múltiples cookies', () => {
    const req = new Request('https://sindecon.pages.dev/api/oauth/refresh', {
      method: 'POST',
      headers: {
        Cookie: `otra=123; ${COOKIE_NAME}=abc.def%3D; theme=dark`,
      },
    })
    expect(readSessionCookie(req)).toBe('abc.def=')
  })

  it('construye Set-Cookie con Secure en HTTPS y sin Secure en http://localhost', () => {
    const httpsCookie = buildSessionSetCookieHeader('iv.cipher', 'https://sindecon.pages.dev/api/oauth/exchange')
    expect(httpsCookie).toContain(`${COOKIE_NAME}=iv.cipher`)
    expect(httpsCookie).toContain('HttpOnly')
    expect(httpsCookie).toContain('SameSite=Lax')
    expect(httpsCookie).toContain('Path=/api/oauth')
    expect(httpsCookie).toContain(`Max-Age=${COOKIE_MAX_AGE_SECONDS}`)
    expect(httpsCookie).toContain('Secure')

    const localCookie = buildSessionSetCookieHeader('iv.cipher', 'http://localhost:8788/api/oauth/exchange')
    expect(localCookie).not.toContain('Secure')

    const clearCookie = buildClearCookieHeader('https://sindecon.pages.dev/api/oauth/logout')
    expect(clearCookie).toContain(`${COOKIE_NAME}=;`)
    expect(clearCookie).toContain('Max-Age=0')
    expect(clearCookie).toContain('Path=/api/oauth')
  })

  it('valida método POST y mismo origen contra CSRF', () => {
    const getReq = new Request('https://sindecon.pages.dev/api/oauth/refresh', {
      method: 'GET',
      headers: { Origin: 'https://sindecon.pages.dev' },
    })
    expect(validateSameOriginPost(getReq)?.status).toBe(405)

    const crossOriginReq = new Request('https://sindecon.pages.dev/api/oauth/refresh', {
      method: 'POST',
      headers: { Origin: 'https://evil.example' },
    })
    expect(validateSameOriginPost(crossOriginReq)?.status).toBe(403)

    const missingHeadersReq = new Request('https://sindecon.pages.dev/api/oauth/refresh', {
      method: 'POST',
    })
    expect(validateSameOriginPost(missingHeadersReq)?.status).toBe(403)

    const sameOriginReq = new Request('https://sindecon.pages.dev/api/oauth/refresh', {
      method: 'POST',
      headers: { Origin: 'https://sindecon.pages.dev' },
    })
    expect(validateSameOriginPost(sameOriginReq)).toBeNull()

    const fetchSiteReq = new Request('https://sindecon.pages.dev/api/oauth/refresh', {
      method: 'POST',
      headers: { 'Sec-Fetch-Site': 'same-origin' },
    })
    expect(validateSameOriginPost(fetchSiteReq)).toBeNull()
  })

  it('valida presencia de variables de entorno requeridas y agrega cabeceras no-store', async () => {
    const missing = validateEnv({ GOOGLE_CLIENT_ID: 'id' })
    expect(missing.ok).toBe(false)
    if (!missing.ok) {
      expect(missing.response.status).toBe(500)
      expect(await missing.response.json()).toEqual({ error: 'server_not_configured' })
    }

    const res = jsonResponse({ ok: true }, 200)
    expect(res.headers.get('Cache-Control')).toBe('no-store, private')
    expect(res.headers.get('Vary')).toBe('Cookie')
  })
})
```

- [ ] **Step 2: Ejecutar el test para verificar que falla (TDD rojo)**

Run:
```powershell
npx --prefix app vitest run functions/api/oauth/_shared.test.ts
```
Expected: FAIL (módulo `./_shared` no existe aún).

- [ ] **Step 3: Implementar `app/functions/api/oauth/_shared.ts`**

Crear `app/functions/api/oauth/_shared.ts`:
```typescript
export interface OAuthEnv {
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  OAUTH_COOKIE_SECRET?: string
}

export interface CfPagesContext {
  request: Request
  env: OAuthEnv
}

export interface EncryptedSessionPayload {
  rt: string
  email?: string
  iat: number
}

export const COOKIE_NAME = 'sindecon_gdrive_rt'
export const COOKIE_PATH = '/api/oauth'
export const COOKIE_MAX_AGE_SECONDS = 15_552_000 // 180 días

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(value: string): Uint8Array | null {
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

async function deriveAesKey(secret: string): Promise<CryptoKey> {
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(secret))
  return await crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ])
}

export function jsonResponse(
  data: unknown,
  status = 200,
  extraHeaders?: HeadersInit,
): Response {
  const headers = new Headers(extraHeaders)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  headers.set('Cache-Control', 'no-store, private')
  headers.set('Vary', 'Cookie')
  return new Response(JSON.stringify(data), { status, headers })
}

export function validateSameOriginPost(request: Request): Response | null {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405, { Allow: 'POST' })
  }

  const expectedOrigin = new URL(request.url).origin
  const originHeader = request.headers.get('Origin')
  if (originHeader) {
    if (originHeader !== expectedOrigin) {
      return jsonResponse({ error: 'forbidden_origin' }, 403)
    }
    return null
  }

  const fetchSite = request.headers.get('Sec-Fetch-Site')
  if (fetchSite === 'same-origin') {
    return null
  }

  return jsonResponse({ error: 'forbidden_origin' }, 403)
}

export function validateEnv(
  env: OAuthEnv,
):
  | { ok: true; clientId: string; clientSecret: string; cookieSecret: string }
  | { ok: false; response: Response } {
  const clientId = env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim()
  const cookieSecret = env.OAUTH_COOKIE_SECRET?.trim()

  if (!clientId || !clientSecret || !cookieSecret) {
    return {
      ok: false,
      response: jsonResponse({ error: 'server_not_configured' }, 500),
    }
  }

  return { ok: true, clientId, clientSecret, cookieSecret }
}

export async function encryptCookiePayload(
  payload: EncryptedSessionPayload,
  secret: string,
): Promise<string> {
  const key = await deriveAesKey(secret)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = encoder.encode(JSON.stringify(payload))
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext),
  )
  return `${toBase64Url(iv)}.${toBase64Url(ciphertext)}`
}

export async function decryptCookiePayload(
  cookieValue: string,
  secret: string,
): Promise<EncryptedSessionPayload | null> {
  if (!cookieValue || !secret) return null
  const parts = cookieValue.split('.')
  if (parts.length !== 2) return null

  const iv = fromBase64Url(parts[0]!)
  const ciphertext = fromBase64Url(parts[1]!)
  if (!iv || !ciphertext || iv.length !== 12) return null

  try {
    const key = await deriveAesKey(secret)
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      key,
      new Uint8Array(ciphertext),
    )
    const parsed = JSON.parse(decoder.decode(decrypted)) as Partial<EncryptedSessionPayload>
    if (
      parsed &&
      typeof parsed.rt === 'string' &&
      parsed.rt.length > 0 &&
      typeof parsed.iat === 'number'
    ) {
      return {
        rt: parsed.rt,
        email: typeof parsed.email === 'string' ? parsed.email : undefined,
        iat: parsed.iat,
      }
    }
    return null
  } catch {
    return null
  }
}

export function readSessionCookie(request: Request): string | null {
  const header = request.headers.get('Cookie')
  if (!header) return null
  const cookies = header.split(';')
  for (const part of cookies) {
    const eqIndex = part.indexOf('=')
    if (eqIndex <= 0) continue
    const name = part.slice(0, eqIndex).trim()
    if (name === COOKIE_NAME) {
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

function shouldSetSecureFlag(requestUrl: string): boolean {
  const url = new URL(requestUrl)
  if (url.protocol === 'https:') return true
  return url.hostname !== 'localhost' && url.hostname !== '127.0.0.1'
}

export function buildSessionSetCookieHeader(
  encryptedValue: string,
  requestUrl: string,
): string {
  const attrs = [
    `${COOKIE_NAME}=${encodeURIComponent(encryptedValue)}`,
    'HttpOnly',
    'SameSite=Lax',
    `Path=${COOKIE_PATH}`,
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
  ]
  if (shouldSetSecureFlag(requestUrl)) {
    attrs.push('Secure')
  }
  return attrs.join('; ')
}

export function buildClearCookieHeader(requestUrl: string): string {
  const attrs = [
    `${COOKIE_NAME}=`,
    'HttpOnly',
    'SameSite=Lax',
    `Path=${COOKIE_PATH}`,
    'Max-Age=0',
  ]
  if (shouldSetSecureFlag(requestUrl)) {
    attrs.push('Secure')
  }
  return attrs.join('; ')
}
```

- [ ] **Step 4: Ejecutar tests y `tsc -b` para verificar que pasan**

Run:
```powershell
npx --prefix app vitest run functions/api/oauth/_shared.test.ts; npm --prefix app run build
```
Expected: PASS (todos los tests de `_shared.test.ts` en verde y `tsc -b && vite build` sin errores).

- [ ] **Step 5: Commit**

```bash
git add app/functions/api/oauth/_shared.ts app/functions/api/oauth/_shared.test.ts
git commit -m "feat(oauth): add AES-256-GCM cookie encryption and CSRF helpers for Cloudflare Functions"
```

---

### Task 3: Endpoints `/api/oauth/exchange`, `/api/oauth/refresh` y `/api/oauth/logout`

**Files:**
- Create: `app/functions/api/oauth/exchange.ts`
- Create: `app/functions/api/oauth/refresh.ts`
- Create: `app/functions/api/oauth/logout.ts`
- Test: `app/functions/api/oauth/handlers.test.ts`

**Interfaces:**
- Consumes: `app/functions/api/oauth/_shared.ts`
- Produces:
  - `export async function onRequest(context: CfPagesContext): Promise<Response>` en `exchange.ts`, `refresh.ts`, `logout.ts`
  - Respuesta `exchange`: `200 { access_token: string, expires_in: number, email?: string, persistent: boolean }` + `Set-Cookie` cuando hay `refresh_token`
  - Respuesta `refresh`: `200 { access_token: string, expires_in: number, email?: string }` + `Set-Cookie` renovado, o `401 { error: 'session_expired' }` + borrado de cookie, o `502 { error: 'upstream_unavailable' }` preservando cookie
  - Respuesta `logout`: `200 { ok: true }` + `Set-Cookie` con `Max-Age=0`

- [ ] **Step 1: Escribir los tests unitarios que fallan para `exchange`, `refresh` y `logout`**

Crear `app/functions/api/oauth/handlers.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { onRequest as exchangeOnRequest } from './exchange'
import { onRequest as refreshOnRequest } from './refresh'
import { onRequest as logoutOnRequest } from './logout'
import {
  COOKIE_NAME,
  encryptCookiePayload,
  decryptCookiePayload,
  type OAuthEnv,
} from './_shared'

const TEST_ENV: OAuthEnv = {
  GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'client-secret',
  OAUTH_COOKIE_SECRET: '0123456789abcdef0123456789abcdef',
}

function extractCookieValue(setCookie: string | null): string {
  expect(setCookie).toBeTruthy()
  const prefix = `${COOKIE_NAME}=`
  const start = setCookie!.indexOf(prefix)
  expect(start).toBeGreaterThanOrEqual(0)
  const rest = setCookie!.slice(start + prefix.length)
  const end = rest.indexOf(';')
  return decodeURIComponent(end >= 0 ? rest.slice(0, end) : rest)
}

function makeFakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
  return `${header}.${body}.sig`
}

describe('oauth endpoints (exchange, refresh, logout)', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('POST /api/oauth/exchange', () => {
    it('devuelve 500 si faltan variables de entorno del servidor', async () => {
      const req = new Request('https://sindecon.pages.dev/api/oauth/exchange', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: 'auth-code' }),
      })

      const res = await exchangeOnRequest({ request: req, env: {} })
      expect(res.status).toBe(500)
      expect(await res.json()).toEqual({ error: 'server_not_configured' })
    })

    it('devuelve 400 si falta code en el cuerpo', async () => {
      const req = new Request('https://sindecon.pages.dev/api/oauth/exchange', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: '   ' }),
      })

      const res = await exchangeOnRequest({ request: req, env: TEST_ENV })
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'missing_code' })
    })

    it('canjea code con Google, extrae email de Drive y guarda refresh_token cifrado en cookie HttpOnly', async () => {
      fetchMock
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              access_token: 'ya29.access-new',
              expires_in: 3599,
              refresh_token: '1//0g-new-refresh',
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ user: { emailAddress: 'dra.perez@gmail.com' } }),
            { status: 200 },
          ),
        )

      const req = new Request('https://sindecon.pages.dev/api/oauth/exchange', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: '4/0AcvD-auth-code' }),
      })

      const res = await exchangeOnRequest({ request: req, env: TEST_ENV })
      expect(res.status).toBe(200)

      const body = (await res.json()) as Record<string, unknown>
      expect(body).toEqual({
        access_token: 'ya29.access-new',
        expires_in: 3599,
        email: 'dra.perez@gmail.com',
        persistent: true,
      })

      const encryptedCookie = extractCookieValue(res.headers.get('Set-Cookie'))
      const decrypted = await decryptCookiePayload(
        encryptedCookie,
        TEST_ENV.OAUTH_COOKIE_SECRET!,
      )
      expect(decrypted?.rt).toBe('1//0g-new-refresh')
      expect(decrypted?.email).toBe('dra.perez@gmail.com')

      const [tokenUrl, tokenInit] = fetchMock.mock.calls[0]!
      expect(tokenUrl).toBe('https://oauth2.googleapis.com/token')
      const sentParams = new URLSearchParams(String(tokenInit?.body))
      expect(sentParams.get('redirect_uri')).toBe('postmessage')
      expect(sentParams.get('grant_type')).toBe('authorization_code')
      expect(sentParams.get('client_secret')).toBe(TEST_ENV.GOOGLE_CLIENT_SECRET)
    })

    it('preserva refresh_token previo de la cookie si Google omite refresh_token y lee email de id_token', async () => {
      const existingCookie = await encryptCookiePayload(
        { rt: '1//0g-existing-rt', email: 'prev@gmail.com', iat: 1000 },
        TEST_ENV.OAUTH_COOKIE_SECRET!,
      )

      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'ya29.access-reauth',
            expires_in: 3600,
            id_token: makeFakeJwt({ email: 'jwt.user@gmail.com' }),
          }),
          { status: 200 },
        ),
      )

      const req = new Request('https://sindecon.pages.dev/api/oauth/exchange', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
          'Content-Type': 'application/json',
          Cookie: `${COOKIE_NAME}=${encodeURIComponent(existingCookie)}`,
        },
        body: JSON.stringify({ code: '4/0AcvD-reauth' }),
      })

      const res = await exchangeOnRequest({ request: req, env: TEST_ENV })
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({
        access_token: 'ya29.access-reauth',
        expires_in: 3600,
        email: 'jwt.user@gmail.com',
        persistent: true,
      })

      const encryptedCookie = extractCookieValue(res.headers.get('Set-Cookie'))
      const decrypted = await decryptCookiePayload(
        encryptedCookie,
        TEST_ENV.OAUTH_COOKIE_SECRET!,
      )
      expect(decrypted?.rt).toBe('1//0g-existing-rt')
      expect(decrypted?.email).toBe('jwt.user@gmail.com')
    })

    it('devuelve persistent=false sin Set-Cookie si no hay refresh_token ni cookie previa', async () => {
      fetchMock
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ access_token: 'ya29.temp', expires_in: 3600 }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(new Response('{}', { status: 403 }))

      const req = new Request('https://sindecon.pages.dev/api/oauth/exchange', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: '4/0AcvD-temp' }),
      })

      const res = await exchangeOnRequest({ request: req, env: TEST_ENV })
      expect(res.status).toBe(200)
      expect(res.headers.get('Set-Cookie')).toBeNull()
      expect(await res.json()).toEqual({
        access_token: 'ya29.temp',
        expires_in: 3600,
        email: undefined,
        persistent: false,
      })
    })
  })

  describe('POST /api/oauth/refresh', () => {
    it('devuelve 401 y limpia cookie cuando falta la cookie o está corrupta', async () => {
      const req = new Request('https://sindecon.pages.dev/api/oauth/refresh', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
          Cookie: `${COOKIE_NAME}=basura-corrupta`,
        },
      })

      const res = await refreshOnRequest({ request: req, env: TEST_ENV })
      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ error: 'session_expired' })
      expect(res.headers.get('Set-Cookie')).toContain('Max-Age=0')
    })

    it('refresca access_token, rota refresh_token si Google entrega uno nuevo y renueva cookie', async () => {
      const existingCookie = await encryptCookiePayload(
        { rt: '1//0g-old-rt', email: 'dr@hospital.cl', iat: 1000 },
        TEST_ENV.OAUTH_COOKIE_SECRET!,
      )

      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'ya29.refreshed',
            expires_in: 3599,
            refresh_token: '1//0g-rotated-rt',
          }),
          { status: 200 },
        ),
      )

      const req = new Request('https://sindecon.pages.dev/api/oauth/refresh', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
          Cookie: `${COOKIE_NAME}=${encodeURIComponent(existingCookie)}`,
        },
      })

      const res = await refreshOnRequest({ request: req, env: TEST_ENV })
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({
        access_token: 'ya29.refreshed',
        expires_in: 3599,
        email: 'dr@hospital.cl',
      })

      const updatedCookie = extractCookieValue(res.headers.get('Set-Cookie'))
      const decrypted = await decryptCookiePayload(
        updatedCookie,
        TEST_ENV.OAUTH_COOKIE_SECRET!,
      )
      expect(decrypted?.rt).toBe('1//0g-rotated-rt')
      expect(decrypted?.email).toBe('dr@hospital.cl')
    })

    it('limpia cookie y devuelve 401 si Google responde invalid_grant', async () => {
      const existingCookie = await encryptCookiePayload(
        { rt: '1//0g-revoked', iat: 1000 },
        TEST_ENV.OAUTH_COOKIE_SECRET!,
      )

      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }),
      )

      const req = new Request('https://sindecon.pages.dev/api/oauth/refresh', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
          Cookie: `${COOKIE_NAME}=${encodeURIComponent(existingCookie)}`,
        },
      })

      const res = await refreshOnRequest({ request: req, env: TEST_ENV })
      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ error: 'session_expired' })
      expect(res.headers.get('Set-Cookie')).toContain('Max-Age=0')
    })

    it('devuelve 502 SIN borrar cookie cuando Google responde 503 o falla la red', async () => {
      const existingCookie = await encryptCookiePayload(
        { rt: '1//0g-valid', iat: 1000 },
        TEST_ENV.OAUTH_COOKIE_SECRET!,
      )

      fetchMock.mockResolvedValueOnce(new Response('Service Unavailable', { status: 503 }))

      const req = new Request('https://sindecon.pages.dev/api/oauth/refresh', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
          Cookie: `${COOKIE_NAME}=${encodeURIComponent(existingCookie)}`,
        },
      })

      const res = await refreshOnRequest({ request: req, env: TEST_ENV })
      expect(res.status).toBe(502)
      expect(await res.json()).toEqual({ error: 'upstream_unavailable' })
      expect(res.headers.get('Set-Cookie')).toBeNull()
    })
  })

  describe('POST /api/oauth/logout', () => {
    it('revoca refresh_token en Google (best-effort) y siempre limpia la cookie', async () => {
      const existingCookie = await encryptCookiePayload(
        { rt: '1//0g-to-revoke', iat: 1000 },
        TEST_ENV.OAUTH_COOKIE_SECRET!,
      )

      fetchMock.mockRejectedValueOnce(new Error('network down'))

      const req = new Request('https://sindecon.pages.dev/api/oauth/logout', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
          Cookie: `${COOKIE_NAME}=${encodeURIComponent(existingCookie)}`,
        },
      })

      const res = await logoutOnRequest({ request: req, env: TEST_ENV })
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ ok: true })
      expect(res.headers.get('Set-Cookie')).toContain('Max-Age=0')
      expect(fetchMock).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/revoke',
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })
})
```

- [ ] **Step 2: Ejecutar los tests para verificar que fallan (TDD rojo)**

Run:
```powershell
npx --prefix app vitest run functions/api/oauth/handlers.test.ts
```
Expected: FAIL (`./exchange`, `./refresh`, `./logout` no existen aún).

- [ ] **Step 3: Implementar `exchange.ts`, `refresh.ts` y `logout.ts`**

Crear `app/functions/api/oauth/exchange.ts`:
```typescript
import {
  buildSessionSetCookieHeader,
  decryptCookiePayload,
  encryptCookiePayload,
  jsonResponse,
  readSessionCookie,
  validateEnv,
  validateSameOriginPost,
  type CfPagesContext,
} from './_shared'

interface GoogleTokenResponse {
  access_token?: string
  expires_in?: number
  refresh_token?: string
  id_token?: string
  error?: string
}

function decodeEmailFromIdToken(idToken?: string): string | undefined {
  if (!idToken) return undefined
  const parts = idToken.split('.')
  if (parts.length < 2) return undefined
  try {
    const raw = parts[1]!
    const padded = raw.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((raw.length + 3) % 4)
    const parsed = JSON.parse(atob(padded)) as { email?: unknown }
    return typeof parsed.email === 'string' && parsed.email ? parsed.email : undefined
  } catch {
    return undefined
  }
}

async function fetchDriveEmail(accessToken: string): Promise<string | undefined> {
  try {
    const res = await fetch(
      'https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)',
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    if (!res.ok) return undefined
    const data = (await res.json()) as { user?: { emailAddress?: string } }
    return data.user?.emailAddress || undefined
  } catch {
    return undefined
  }
}

export async function onRequest(context: CfPagesContext): Promise<Response> {
  const originError = validateSameOriginPost(context.request)
  if (originError) return originError

  const envCheck = validateEnv(context.env)
  if (!envCheck.ok) return envCheck.response

  let code = ''
  try {
    const body = (await context.request.json()) as { code?: unknown }
    if (typeof body?.code === 'string') {
      code = body.code.trim()
    }
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400)
  }

  if (!code) {
    return jsonResponse({ error: 'missing_code' }, 400)
  }

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
    if (googleRes.status >= 500 || googleRes.status === 429) {
      return jsonResponse({ error: 'upstream_unavailable' }, 502)
    }
    return jsonResponse({ error: 'oauth_exchange_failed' }, 401)
  }

  const tokenData = (await googleRes.json()) as GoogleTokenResponse
  if (!tokenData.access_token) {
    return jsonResponse({ error: 'oauth_exchange_failed' }, 401)
  }

  const email =
    decodeEmailFromIdToken(tokenData.id_token) ||
    (await fetchDriveEmail(tokenData.access_token))

  let refreshToken = tokenData.refresh_token
  let fallbackEmail = email
  if (!refreshToken) {
    const existingRaw = readSessionCookie(context.request)
    if (existingRaw) {
      const existing = await decryptCookiePayload(existingRaw, envCheck.cookieSecret)
      if (existing) {
        refreshToken = existing.rt
        fallbackEmail = email || existing.email
      }
    }
  }

  const expiresIn = typeof tokenData.expires_in === 'number' ? tokenData.expires_in : 3600

  if (!refreshToken) {
    return jsonResponse({
      access_token: tokenData.access_token,
      expires_in: expiresIn,
      email: fallbackEmail,
      persistent: false,
    })
  }

  const encrypted = await encryptCookiePayload(
    {
      rt: refreshToken,
      email: fallbackEmail,
      iat: Date.now(),
    },
    envCheck.cookieSecret,
  )

  return jsonResponse(
    {
      access_token: tokenData.access_token,
      expires_in: expiresIn,
      email: fallbackEmail,
      persistent: true,
    },
    200,
    {
      'Set-Cookie': buildSessionSetCookieHeader(encrypted, context.request.url),
    },
  )
}
```

Crear `app/functions/api/oauth/refresh.ts`:
```typescript
import {
  buildClearCookieHeader,
  buildSessionSetCookieHeader,
  decryptCookiePayload,
  encryptCookiePayload,
  jsonResponse,
  readSessionCookie,
  validateEnv,
  validateSameOriginPost,
  type CfPagesContext,
} from './_shared'

interface GoogleRefreshResponse {
  access_token?: string
  expires_in?: number
  refresh_token?: string
  error?: string
}

export async function onRequest(context: CfPagesContext): Promise<Response> {
  const originError = validateSameOriginPost(context.request)
  if (originError) return originError

  const envCheck = validateEnv(context.env)
  if (!envCheck.ok) return envCheck.response

  const rawCookie = readSessionCookie(context.request)
  const payload = rawCookie
    ? await decryptCookiePayload(rawCookie, envCheck.cookieSecret)
    : null

  if (!payload) {
    return jsonResponse({ error: 'session_expired' }, 401, {
      'Set-Cookie': buildClearCookieHeader(context.request.url),
    })
  }

  let googleRes: Response
  try {
    googleRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: envCheck.clientId,
        client_secret: envCheck.clientSecret,
        refresh_token: payload.rt,
        grant_type: 'refresh_token',
      }).toString(),
    })
  } catch {
    return jsonResponse({ error: 'upstream_unavailable' }, 502)
  }

  if (!googleRes.ok) {
    if (googleRes.status === 400 || googleRes.status === 401) {
      let errCode = ''
      try {
        const errBody = (await googleRes.json()) as { error?: string }
        errCode = errBody.error || ''
      } catch {
        errCode = ''
      }
      if (errCode === 'invalid_grant' || errCode === 'unauthorized_client' || !errCode) {
        return jsonResponse({ error: 'session_expired' }, 401, {
          'Set-Cookie': buildClearCookieHeader(context.request.url),
        })
      }
    }
    return jsonResponse({ error: 'upstream_unavailable' }, 502)
  }

  const tokenData = (await googleRes.json()) as GoogleRefreshResponse
  if (!tokenData.access_token) {
    return jsonResponse({ error: 'upstream_unavailable' }, 502)
  }

  const nextRt = tokenData.refresh_token || payload.rt
  const encrypted = await encryptCookiePayload(
    {
      rt: nextRt,
      email: payload.email,
      iat: Date.now(),
    },
    envCheck.cookieSecret,
  )

  return jsonResponse(
    {
      access_token: tokenData.access_token,
      expires_in: typeof tokenData.expires_in === 'number' ? tokenData.expires_in : 3600,
      email: payload.email,
    },
    200,
    {
      'Set-Cookie': buildSessionSetCookieHeader(encrypted, context.request.url),
    },
  )
}
```

Crear `app/functions/api/oauth/logout.ts`:
```typescript
import {
  buildClearCookieHeader,
  decryptCookiePayload,
  jsonResponse,
  readSessionCookie,
  validateSameOriginPost,
  type CfPagesContext,
} from './_shared'

export async function onRequest(context: CfPagesContext): Promise<Response> {
  const originError = validateSameOriginPost(context.request)
  if (originError) return originError

  const rawCookie = readSessionCookie(context.request)
  const secret = context.env.OAUTH_COOKIE_SECRET?.trim()

  if (rawCookie && secret) {
    const payload = await decryptCookiePayload(rawCookie, secret)
    if (payload?.rt) {
      try {
        await fetch('https://oauth2.googleapis.com/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token: payload.rt }).toString(),
        })
      } catch {
        // Best-effort: el borrado local de la cookie siempre debe ejecutarse
      }
    }
  }

  return jsonResponse({ ok: true }, 200, {
    'Set-Cookie': buildClearCookieHeader(context.request.url),
  })
}
```

- [ ] **Step 4: Ejecutar tests, lint y `tsc -b && vite build`**

Run:
```powershell
npx --prefix app vitest run functions/api/oauth/; npm --prefix app run lint; npm --prefix app run build
```
Expected: Todos los tests de `functions/api/oauth/` en PASS, cero errores de lint y `tsc -b && vite build` en verde.

- [ ] **Step 5: Commit**

```bash
git add app/functions/api/oauth/exchange.ts app/functions/api/oauth/refresh.ts app/functions/api/oauth/logout.ts app/functions/api/oauth/handlers.test.ts
git commit -m "feat(oauth): implement Cloudflare Pages Functions for exchange, refresh and logout"
```

---

### Task 4: Capa compartida de sesión BFF + fallback GIS en `app/src/pwa/googleDrive.ts`

**Files:**
- Modify: `app/src/pwa/googleDrive.ts:1-169,565-582`
- Test: `app/src/pwa/googleDrive.test.ts`

**Interfaces:**
- Consumes: `/api/oauth/exchange`, `/api/oauth/refresh`, `/api/oauth/logout`, `window.google.accounts.oauth2`
- Produces (además de mantener intactas todas las exportaciones actuales):
  - `export const GOOGLE_AUTH_CHANGE_EVENT = 'sindecon-google-auth-change'`
  - `export function shouldUseServerOAuth(): boolean`
  - `export function ensureValidAccessToken(forceRefresh?: boolean): Promise<string | null>`
  - `export function exchangeOAuthCode(code: string): Promise<{ accessToken: string; expiresIn: number; email?: string; persistent: boolean } | null>`
  - `export function revokeServerOAuthSession(): Promise<void>`
  - `export function initiateGoogleOAuthFlow(callbacks: { onSuccess: (token: string, expiresIn: number, email?: string) => void; onError: (message: string) => void }): void`
  - `export function resetOAuthRuntimeStateForTests(): void`

- [ ] **Step 1: Escribir los tests unitarios que fallan para `googleDrive.ts`**

Crear `app/src/pwa/googleDrive.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  setStoredClientId,
  setStoredToken,
  getStoredToken,
  getStoredEmail,
  isGoogleSyncEnabled,
  shouldUseServerOAuth,
  ensureValidAccessToken,
  exchangeOAuthCode,
  revokeServerOAuthSession,
  fetchGoogleUserEmail,
  initiateGoogleOAuthFlow,
  resetOAuthRuntimeStateForTests,
} from './googleDrive'

const store: Record<string, string> = {}
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => {
    store[key] = value.toString()
  },
  removeItem: (key: string) => {
    delete store[key]
  },
  clear: () => {
    for (const k of Object.keys(store)) delete store[k]
  },
}

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

Object.defineProperty(globalThis, 'navigator', {
  value: { onLine: true },
  writable: true,
})

describe('googleDrive OAuth BFF & fallback helpers', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    localStorageMock.clear()
    resetOAuthRuntimeStateForTests()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: true },
      writable: true,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    delete (globalThis as Record<string, unknown>).window
  })

  it('reutiliza token vigente en localStorage sin llamar a /api/oauth/refresh', async () => {
    setStoredToken('ya29.vigente', 3600, 'doc@hospital.cl')
    const token = await ensureValidAccessToken()
    expect(token).toBe('ya29.vigente')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('usa single-flight mutex cuando dos llamadas piden refresco simultáneo', async () => {
    setStoredToken('ya29.por-vencer', 30, 'doc@hospital.cl')

    let resolveFetch!: (res: Response) => void
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve
        }),
    )

    const p1 = ensureValidAccessToken()
    const p2 = ensureValidAccessToken()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/oauth/refresh',
      expect.objectContaining({ method: 'POST', credentials: 'same-origin' }),
    )

    resolveFetch(
      new Response(
        JSON.stringify({
          access_token: 'ya29.nuevo-bff',
          expires_in: 3600,
          email: 'doc@hospital.cl',
        }),
        { status: 200 },
      ),
    )

    const [t1, t2] = await Promise.all([p1, p2])
    expect(t1).toBe('ya29.nuevo-bff')
    expect(t2).toBe('ya29.nuevo-bff')
    expect(getStoredToken()).toBe('ya29.nuevo-bff')
  })

  it('en 401 limpia solo el access_token preservando email y cuaderno-gdrive-enabled', async () => {
    setStoredToken('ya29.expirado', -10, 'doc@hospital.cl')
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'session_expired' }), { status: 401 }),
    )

    const token = await ensureValidAccessToken(true)
    expect(token).toBeNull()
    expect(getStoredToken()).toBeNull()
    expect(isGoogleSyncEnabled()).toBe(true)
    expect(getStoredEmail()).toBe('doc@hospital.cl')
  })

  it('en offline no llama a /api/oauth/refresh y preserva la configuración', async () => {
    setStoredToken('ya29.expirado', -10, 'doc@hospital.cl')
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: false },
      writable: true,
    })

    const token = await ensureValidAccessToken(true)
    expect(token).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(isGoogleSyncEnabled()).toBe(true)
  })

  it('marca BFF no disponible tras 404 (entorno Vite sin Wrangler) y evita reintentar', async () => {
    setStoredToken('ya29.expirado', -10)
    fetchMock.mockResolvedValueOnce(new Response('Not Found', { status: 404 }))

    const first = await ensureValidAccessToken(true)
    expect(first).toBeNull()
    expect(shouldUseServerOAuth()).toBe(false)

    const second = await ensureValidAccessToken(true)
    expect(second).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('desactiva modo BFF cuando hay un Client ID personalizado distinto al default', () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'env-client.apps.googleusercontent.com')
    setStoredClientId('custom-selfhosted-id.apps.googleusercontent.com')
    expect(shouldUseServerOAuth()).toBe(false)

    setStoredClientId('env-client.apps.googleusercontent.com')
    expect(shouldUseServerOAuth()).toBe(true)
    vi.unstubAllEnvs()
  })

  it('exchangeOAuthCode devuelve null en 404 y datos de sesión en 200', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'ya29.exchanged',
          expires_in: 3600,
          email: 'med@gmail.com',
          persistent: true,
        }),
        { status: 200 },
      ),
    )

    const res = await exchangeOAuthCode('4/code')
    expect(res).toEqual({
      accessToken: 'ya29.exchanged',
      expiresIn: 3600,
      email: 'med@gmail.com',
      persistent: true,
    })

    fetchMock.mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
    expect(await exchangeOAuthCode('4/code-2')).toBeNull()
    expect(shouldUseServerOAuth()).toBe(false)
  })

  it('fetchGoogleUserEmail cae a drive/v3/about si userinfo falla por scopes', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('Forbidden', { status: 403 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ user: { emailAddress: 'fallback@gmail.com' } }),
          { status: 200 },
        ),
      )

    const email = await fetchGoogleUserEmail('ya29.token')
    expect(email).toBe('fallback@gmail.com')
  })

  it('initiateGoogleOAuthFlow usa initCodeClient con prompt consent + select_account y cae a initTokenClient si BFF devuelve 404', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'env-client.apps.googleusercontent.com')
    const requestCodeMock = vi.fn()
    const requestAccessTokenMock = vi.fn()
    let codeCallback: ((res: { code?: string; error?: string }) => void) | null = null

    Object.defineProperty(globalThis, 'window', {
      value: {
        dispatchEvent: vi.fn(),
        google: {
          accounts: {
            oauth2: {
              initCodeClient: vi.fn((cfg: { callback: (res: { code?: string }) => void }) => {
                codeCallback = cfg.callback
                return { requestCode: requestCodeMock }
              }),
              initTokenClient: vi.fn(() => ({
                requestAccessToken: requestAccessTokenMock,
              })),
            },
          },
        },
      },
      writable: true,
    })

    const onSuccess = vi.fn()
    const onError = vi.fn()

    fetchMock.mockResolvedValueOnce(new Response('Not Found', { status: 404 }))

    initiateGoogleOAuthFlow({ onSuccess, onError })
    expect(requestCodeMock).toHaveBeenCalledTimes(1)
    expect(codeCallback).toBeTruthy()
    codeCallback!({ code: 'auth-code-fallback' })
    await Promise.resolve()
    await Promise.resolve()
    expect(requestAccessTokenMock).toHaveBeenCalledTimes(1)
    vi.unstubAllEnvs()
  })

  it('revokeServerOAuthSession llama a /api/oauth/logout en best-effort sin lanzar errores', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    await expect(revokeServerOAuthSession()).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/oauth/logout',
      expect.objectContaining({ method: 'POST', credentials: 'same-origin' }),
    )
  })
})
```

- [ ] **Step 2: Ejecutar los tests para verificar que fallan (TDD rojo)**

Run:
```powershell
npx --prefix app vitest run src/pwa/googleDrive.test.ts
```
Expected: FAIL (los nuevos exports no existen en `googleDrive.ts`).

- [ ] **Step 3: Actualizar `app/src/pwa/googleDrive.ts`**

En `app/src/pwa/googleDrive.ts`, reemplazar/actualizar las líneas `47-168` y `565-581` manteniendo compatibilidad completa con todas las funciones previas (`requestSilentAccessToken` puede quedar o ser reemplazada? Esperen: verificar con `Select-String` que hicimos antes: `requestSilentAccessToken` NO tiene callers externos en `src/`, pero mantenerla o quitarla limpia código muerto; mejor aún, quitar el código huérfano si nada la importa y mantener todos los exports usados):

Editar líneas `47-169` de `app/src/pwa/googleDrive.ts`:
```typescript
const GDRIVE_TOKEN_KEY = 'cuaderno-gdrive-token'
const GDRIVE_EXPIRY_KEY = 'cuaderno-gdrive-expiry'
const GDRIVE_EMAIL_KEY = 'cuaderno-gdrive-email'
const GDRIVE_CLIENT_ID_KEY = 'cuaderno-gdrive-client-id'
const GDRIVE_ENABLED_KEY = 'cuaderno-gdrive-enabled'

export const GOOGLE_AUTH_CHANGE_EVENT = 'sindecon-google-auth-change'

// Client ID configurado mediante variable de entorno VITE_GOOGLE_CLIENT_ID o localStorage
export const DEFAULT_GOOGLE_CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || ''

function getDefaultGoogleClientId(): string {
  return (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || DEFAULT_GOOGLE_CLIENT_ID
}

let bffUnavailableInSession = false
let inFlightRefreshPromise: Promise<string | null> | null = null

export function resetOAuthRuntimeStateForTests(): void {
  bffUnavailableInSession = false
  inFlightRefreshPromise = null
}

function notifyGoogleAuthChange(): void {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof Event === 'function') {
    window.dispatchEvent(new Event(GOOGLE_AUTH_CHANGE_EVENT))
  }
}

export function getStoredClientId(): string {
  return localStorage.getItem(GDRIVE_CLIENT_ID_KEY) || getDefaultGoogleClientId()
}

export function setStoredClientId(clientId: string) {
  if (clientId) {
    localStorage.setItem(GDRIVE_CLIENT_ID_KEY, clientId)
  } else {
    localStorage.removeItem(GDRIVE_CLIENT_ID_KEY)
  }
}

export function shouldUseServerOAuth(): boolean {
  if (bffUnavailableInSession) return false
  const defaultId = getDefaultGoogleClientId()
  const storedCustom = localStorage.getItem(GDRIVE_CLIENT_ID_KEY)
  if (storedCustom && storedCustom !== defaultId) {
    return false
  }
  return true
}

export function isGoogleSyncEnabled(): boolean {
  return localStorage.getItem(GDRIVE_ENABLED_KEY) === 'true'
}

export function setGoogleSyncEnabled(enabled: boolean) {
  if (enabled) {
    localStorage.setItem(GDRIVE_ENABLED_KEY, 'true')
  } else {
    localStorage.removeItem(GDRIVE_ENABLED_KEY)
  }
}

export function isTokenExpired(marginMinutes = 2): boolean {
  const expiryStr = localStorage.getItem(GDRIVE_EXPIRY_KEY)
  if (!expiryStr) return true
  const expiry = Number.parseInt(expiryStr, 10)
  return Date.now() >= expiry - marginMinutes * 60 * 1000
}

export function getStoredToken(): string | null {
  const token = localStorage.getItem(GDRIVE_TOKEN_KEY)
  const expiryStr = localStorage.getItem(GDRIVE_EXPIRY_KEY)
  if (!token) return null

  if (expiryStr) {
    const expiry = Number.parseInt(expiryStr, 10)
    if (Date.now() > expiry) {
      // Token expirado: NO borramos email ni la bandera gdrive-enabled para permitir renovación
      localStorage.removeItem(GDRIVE_TOKEN_KEY)
      return null
    }
  }
  return token
}

export function setStoredToken(token: string, expiresInSeconds = 3600, email?: string) {
  localStorage.setItem(GDRIVE_TOKEN_KEY, token)
  localStorage.setItem(GDRIVE_EXPIRY_KEY, (Date.now() + expiresInSeconds * 1000).toString())
  localStorage.setItem(GDRIVE_ENABLED_KEY, 'true')
  if (email) {
    localStorage.setItem(GDRIVE_EMAIL_KEY, email)
  }
  notifyGoogleAuthChange()
}

export function getStoredEmail(): string | null {
  return localStorage.getItem(GDRIVE_EMAIL_KEY)
}

export function clearStoredToken(disconnectExplicit = false) {
  localStorage.removeItem(GDRIVE_TOKEN_KEY)
  localStorage.removeItem(GDRIVE_EXPIRY_KEY)
  if (disconnectExplicit) {
    localStorage.removeItem(GDRIVE_EMAIL_KEY)
    localStorage.removeItem(GDRIVE_ENABLED_KEY)
  }
  notifyGoogleAuthChange()
}

export async function exchangeOAuthCode(code: string): Promise<{
  accessToken: string
  expiresIn: number
  email?: string
  persistent: boolean
} | null> {
  const res = await fetch('/api/oauth/exchange', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  })

  if (res.status === 404 || res.status === 405) {
    bffUnavailableInSession = true
    return null
  }

  if (!res.ok) {
    throw new Error(`No se pudo completar la autenticación con Google (${res.status})`)
  }

  const data = (await res.json()) as {
    access_token?: string
    expires_in?: number
    email?: string
    persistent?: boolean
  }

  if (!data.access_token) {
    throw new Error('Google no devolvió un token de acceso válido')
  }

  return {
    accessToken: data.access_token,
    expiresIn: typeof data.expires_in === 'number' ? data.expires_in : 3600,
    email: data.email,
    persistent: Boolean(data.persistent),
  }
}

export async function ensureValidAccessToken(forceRefresh = false): Promise<string | null> {
  if (!forceRefresh) {
    const existing = getStoredToken()
    if (existing && !isTokenExpired(2)) {
      return existing
    }
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return null
  }

  if (!shouldUseServerOAuth()) {
    return null
  }

  if (inFlightRefreshPromise) {
    return await inFlightRefreshPromise
  }

  inFlightRefreshPromise = (async () => {
    try {
      const res = await fetch('/api/oauth/refresh', {
        method: 'POST',
        credentials: 'same-origin',
      })

      if (res.status === 404 || res.status === 405) {
        bffUnavailableInSession = true
        return null
      }

      if (res.status === 401) {
        clearStoredToken(false)
        return null
      }

      if (!res.ok) {
        throw new Error(`Error temporal renovando sesión de Google (${res.status})`)
      }

      const data = (await res.json()) as {
        access_token?: string
        expires_in?: number
        email?: string
      }

      if (!data.access_token) {
        return null
      }

      setStoredToken(
        data.access_token,
        typeof data.expires_in === 'number' ? data.expires_in : 3600,
        data.email,
      )
      return data.access_token
    } finally {
      inFlightRefreshPromise = null
    }
  })()

  return await inFlightRefreshPromise
}

export async function revokeServerOAuthSession(): Promise<void> {
  if (!shouldUseServerOAuth()) return
  try {
    await fetch('/api/oauth/logout', {
      method: 'POST',
      credentials: 'same-origin',
    })
  } catch {
    // Best-effort en logout local
  }
}

interface GisOAuth2Namespace {
  initTokenClient: (config: {
    client_id: string
    scope: string
    prompt?: string
    login_hint?: string
    callback: (res: { access_token?: string; expires_in?: number; error?: string }) => void
  }) => { requestAccessToken: (opts?: { prompt?: string; login_hint?: string }) => void }
  initCodeClient?: (config: {
    client_id: string
    scope: string
    ux_mode?: 'popup' | 'redirect'
    prompt?: string
    login_hint?: string
    callback: (res: { code?: string; error?: string }) => void
  }) => { requestCode: () => void }
}

function triggerLegacyTokenFlow(
  oauth2: GisOAuth2Namespace,
  clientId: string,
  storedEmail: string | null,
  callbacks: {
    onSuccess: (token: string, expiresIn: number, email?: string) => void
    onError: (message: string) => void
  },
): void {
  const client = oauth2.initTokenClient({
    client_id: clientId,
    scope: GOOGLE_DRIVE_SCOPES,
    login_hint: storedEmail || undefined,
    callback: (response) => {
      if (response.access_token) {
        callbacks.onSuccess(response.access_token, response.expires_in || 3600)
      } else if (response.error) {
        callbacks.onError(`Error de Google: ${response.error}`)
      }
    },
  })
  client.requestAccessToken()
}

export function initiateGoogleOAuthFlow(callbacks: {
  onSuccess: (token: string, expiresIn: number, email?: string) => void
  onError: (message: string) => void
}): void {
  const win = window as unknown as {
    google?: { accounts?: { oauth2?: GisOAuth2Namespace } }
  }

  const clientId = getStoredClientId()
  if (!clientId) {
    callbacks.onError('No hay Client ID de Google configurado')
    return
  }

  const oauth2 = win.google?.accounts?.oauth2
  if (!oauth2) {
    callbacks.onError('Google Identity Services no está disponible en este navegador')
    return
  }

  const storedEmail = getStoredEmail()

  if (shouldUseServerOAuth() && typeof oauth2.initCodeClient === 'function') {
    const codeClient = oauth2.initCodeClient({
      client_id: clientId,
      scope: GOOGLE_DRIVE_SCOPES,
      ux_mode: 'popup',
      login_hint: storedEmail || undefined,
      prompt: storedEmail ? 'consent' : 'select_account consent',
      callback: (response) => {
        if (response.error) {
          callbacks.onError(`Error de Google: ${response.error}`)
          return
        }
        if (!response.code) return

        void exchangeOAuthCode(response.code)
          .then((session) => {
            if (session === null) {
              triggerLegacyTokenFlow(oauth2, clientId, storedEmail, callbacks)
              return
            }
            callbacks.onSuccess(session.accessToken, session.expiresIn, session.email)
          })
          .catch((err: unknown) => {
            callbacks.onError((err as Error).message || 'Error al iniciar sesión con Google')
          })
      },
    })
    codeClient.requestCode()
    return
  }

  triggerLegacyTokenFlow(oauth2, clientId, storedEmail, callbacks)
}
```

Y actualizar `fetchGoogleUserEmail` (líneas ~565-581 originales de `app/src/pwa/googleDrive.ts`):
```typescript
/**
 * Obtiene el email del usuario usando Google UserInfo y fallback a Drive About API.
 */
export async function fetchGoogleUserEmail(token: string): Promise<string | null> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const data = (await res.json()) as { email?: string }
      if (data.email) return data.email
    }
  } catch {
    // Continuar con fallback de Drive API
  }

  try {
    const aboutRes = await fetch(
      'https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)',
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (aboutRes.ok) {
      const aboutData = (await aboutRes.json()) as { user?: { emailAddress?: string } }
      return aboutData.user?.emailAddress ?? null
    }
  } catch {
    // Ignorar si falla
  }

  return null
}
```

- [ ] **Step 4: Ejecutar todos los tests relacionados (`googleDrive.test.ts`, `syncEngine.test.ts`) y `build`**

Run:
```powershell
npx --prefix app vitest run src/pwa/googleDrive.test.ts src/pwa/syncEngine.test.ts; npm --prefix app run lint; npm --prefix app run build
```
Expected: Todos los tests PASS, cero errores de lint ni compilación.

- [ ] **Step 5: Commit**

```bash
git add app/src/pwa/googleDrive.ts app/src/pwa/googleDrive.test.ts
git commit -m "feat(oauth): add shared BFF token refresh, code exchange and GIS fallback in googleDrive"
```

---

### Task 5: Integrar refresco silencioso, reintento único y `isRefreshing` en `useGoogleSync.ts`

**Files:**
- Modify: `app/src/hooks/useGoogleSync.ts`
- Test: `app/src/hooks/useGoogleSync.test.ts`

**Interfaces:**
- Consumes: `ensureValidAccessToken`, `initiateGoogleOAuthFlow`, `revokeServerOAuthSession`, `GOOGLE_AUTH_CHANGE_EVENT`, `getStoredToken`, `getStoredEmail`, `setStoredToken`, `clearStoredToken`, `fetchGoogleUserEmail`, `isGoogleSyncEnabled`, `isTokenExpired` de `app/src/pwa/googleDrive.ts`; `performGoogleDriveSync`, `getLastSyncTime` de `app/src/pwa/syncEngine.ts`.
- Produces:
  - Funciones puras exportadas y testeables en `app/src/hooks/useGoogleSync.ts`:
    - `computeIsSessionExpired(enabled: boolean, isRefreshing: boolean, token: string | null, tokenExpired: boolean): boolean`
    - `syncWithAutoRefresh(deps: { getToken: () => string | null; ensureToken: (force?: boolean) => Promise<string | null>; runSync: (token: string) => Promise<SyncEngineResult>; isSessionError: (msg: string) => boolean }): Promise<SyncEngineResult | null>`
  - Hook `useGoogleSync()` preservando su API exacta (`isConnected`, `isSessionExpired`, `syncState`, `syncProgress`, `lastSyncedAt`, `errorMessage`, `userEmail`, `connectWithToken`, `disconnect`, `triggerSync`, `initiateOAuthLogin`).

- [ ] **Step 1: Escribir los tests unitarios que fallan para la lógica de `useGoogleSync.ts`**

Crear `app/src/hooks/useGoogleSync.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { computeIsSessionExpired, syncWithAutoRefresh } from './useGoogleSync'
import type { SyncEngineResult } from '../pwa/syncEngine'

const OK_SYNC: SyncEngineResult = {
  action: 'uploaded',
  timestamp: 1730000000000,
  message: 'OK',
}

describe('useGoogleSync orchestration helpers', () => {
  it('mantiene isSessionExpired en false mientras isRefreshing está activo', () => {
    expect(computeIsSessionExpired(true, true, null, true)).toBe(false)
    expect(computeIsSessionExpired(true, false, null, true)).toBe(true)
    expect(computeIsSessionExpired(true, false, 'ya29.ok', false)).toBe(false)
    expect(computeIsSessionExpired(false, false, null, true)).toBe(false)
  })

  it('refresca silenciosamente antes de sincronizar si no hay token vigente', async () => {
    const ensureToken = vi.fn().mockResolvedValue('ya29.refreshed')
    const runSync = vi.fn().mockResolvedValue(OK_SYNC)

    const result = await syncWithAutoRefresh({
      getToken: () => null,
      ensureToken,
      runSync,
      isSessionError: (msg) => msg.includes('401') || msg.includes('expirada'),
    })

    expect(ensureToken).toHaveBeenCalledWith(false)
    expect(runSync).toHaveBeenCalledWith('ya29.refreshed')
    expect(result).toEqual(OK_SYNC)
  })

  it('reintenta una sola vez tras 401 forzando ensureToken(true)', async () => {
    const ensureToken = vi.fn().mockResolvedValue('ya29.rotated')
    const runSync = vi
      .fn()
      .mockRejectedValueOnce(new Error('Sesión de Google Drive expirada'))
      .mockResolvedValueOnce(OK_SYNC)

    const result = await syncWithAutoRefresh({
      getToken: () => 'ya29.stale',
      ensureToken,
      runSync,
      isSessionError: (msg) => msg.includes('401') || msg.includes('expirada'),
    })

    expect(ensureToken).toHaveBeenCalledWith(true)
    expect(runSync).toHaveBeenCalledTimes(2)
    expect(runSync).toHaveBeenNthCalledWith(1, 'ya29.stale')
    expect(runSync).toHaveBeenNthCalledWith(2, 'ya29.rotated')
    expect(result).toEqual(OK_SYNC)
  })

  it('retorna null sin propagar error si el refresco tras 401 indica sesión expirada', async () => {
    const ensureToken = vi.fn().mockResolvedValue(null)
    const runSync = vi.fn().mockRejectedValueOnce(new Error('Sesión de Google Drive expirada'))

    const result = await syncWithAutoRefresh({
      getToken: () => 'ya29.stale',
      ensureToken,
      runSync,
      isSessionError: (msg) => msg.includes('401') || msg.includes('expirada'),
    })

    expect(ensureToken).toHaveBeenCalledWith(true)
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Ejecutar el test para verificar que falla (TDD rojo)**

Run:
```powershell
npx --prefix app vitest run src/hooks/useGoogleSync.test.ts
```
Expected: FAIL (`computeIsSessionExpired` y `syncWithAutoRefresh` no existen aún).

- [ ] **Step 3: Actualizar `app/src/hooks/useGoogleSync.ts`**

Reemplazar contenido de `app/src/hooks/useGoogleSync.ts`:
```typescript
import { useCallback, useEffect, useState } from 'react'
import {
  getStoredToken,
  getStoredEmail,
  setStoredToken,
  clearStoredToken,
  fetchGoogleUserEmail,
  isGoogleSyncEnabled,
  isTokenExpired,
  ensureValidAccessToken,
  initiateGoogleOAuthFlow,
  revokeServerOAuthSession,
  GOOGLE_AUTH_CHANGE_EVENT,
} from '../pwa/googleDrive'
import {
  performGoogleDriveSync,
  getLastSyncTime,
  type SyncState,
  type SyncProgress,
  type SyncEngineResult,
} from '../pwa/syncEngine'

const PROACTIVE_REFRESH_INTERVAL_MS = 45 * 60 * 1000
const SYNC_INTERVAL_MS = 5 * 60 * 1000

function isSessionExpiredMessage(msg: string): boolean {
  return msg.includes('expirada') || msg.includes('401')
}

export function computeIsSessionExpired(
  enabled: boolean,
  isRefreshing: boolean,
  token: string | null,
  tokenExpired: boolean,
): boolean {
  if (!enabled || isRefreshing) return false
  return !token || tokenExpired
}

export async function syncWithAutoRefresh(deps: {
  getToken: () => string | null
  ensureToken: (forceRefresh?: boolean) => Promise<string | null>
  runSync: (token: string) => Promise<SyncEngineResult>
  isSessionError: (msg: string) => boolean
}): Promise<SyncEngineResult | null> {
  let currentToken = deps.getToken()
  if (!currentToken) {
    currentToken = await deps.ensureToken(false)
  }
  if (!currentToken) return null

  try {
    return await deps.runSync(currentToken)
  } catch (err) {
    const msg = (err as Error).message || ''
    if (!deps.isSessionError(msg)) {
      throw err
    }

    const refreshedToken = await deps.ensureToken(true)
    if (!refreshedToken) {
      return null
    }
    return await deps.runSync(refreshedToken)
  }
}

export function useGoogleSync() {
  const [token, setToken] = useState<string | null>(() => getStoredToken())
  const [userEmail, setUserEmail] = useState<string | null>(() => getStoredEmail())
  const [isRefreshing, setIsRefreshing] = useState<boolean>(
    () => isGoogleSyncEnabled() && (!getStoredToken() || isTokenExpired(2)),
  )
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null)
  const [lastSyncedTime, setLastSyncedTime] = useState<number>(() => getLastSyncTime())
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const syncEnabled = isGoogleSyncEnabled()
  const isConnected = Boolean(token) || syncEnabled
  const isSessionExpired = computeIsSessionExpired(
    syncEnabled,
    isRefreshing,
    token,
    isTokenExpired(0),
  )

  useEffect(() => {
    const syncLocalState = () => {
      setToken(getStoredToken())
      setUserEmail(getStoredEmail())
    }
    window.addEventListener(GOOGLE_AUTH_CHANGE_EVENT, syncLocalState)
    return () => window.removeEventListener(GOOGLE_AUTH_CHANGE_EVENT, syncLocalState)
  }, [])

  const connectWithToken = useCallback(
    async (newToken: string, expiresInSeconds = 3600, email?: string) => {
      let finalEmail = email
      if (!finalEmail) {
        finalEmail = (await fetchGoogleUserEmail(newToken)) || undefined
      }
      setStoredToken(newToken, expiresInSeconds, finalEmail)
      setToken(newToken)
      if (finalEmail) {
        setUserEmail(finalEmail)
      }
      setIsRefreshing(false)
      setSyncState('idle')
      setErrorMessage(null)

      try {
        setSyncState('syncing')
        setSyncProgress({ phase: 'checking', percent: 5, message: 'Iniciando sincronización…' })
        const res = await performGoogleDriveSync(newToken, (p) => setSyncProgress(p))
        setLastSyncedTime(res.timestamp)
        setTimeout(() => {
          setSyncProgress(null)
          setSyncState('idle')
        }, 500)
      } catch (e) {
        setSyncProgress(null)
        setSyncState('error')
        setErrorMessage((e as Error).message)
      }
    },
    [],
  )

  const refreshSilently = useCallback(async (forceRefresh = false): Promise<string | null> => {
    if (!isGoogleSyncEnabled()) return null
    if (!navigator.onLine) {
      setIsRefreshing(false)
      return null
    }

    setIsRefreshing(true)
    try {
      const nextToken = await ensureValidAccessToken(forceRefresh)
      setToken(getStoredToken())
      setUserEmail(getStoredEmail())
      if (nextToken) {
        setErrorMessage(null)
      }
      return nextToken
    } catch (e) {
      // Error transitorio (5xx / red): mantener configuración y no expulsar usuario
      setErrorMessage((e as Error).message)
      return null
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  const triggerSync = useCallback(async () => {
    if (!navigator.onLine) {
      setSyncState('offline')
      return
    }

    try {
      setSyncState('syncing')
      setSyncProgress({ phase: 'checking', percent: 5, message: 'Iniciando sincronización…' })
      setErrorMessage(null)

      const res = await syncWithAutoRefresh({
        getToken: () => {
          const t = getStoredToken()
          return t && !isTokenExpired(2) ? t : null
        },
        ensureToken: refreshSilently,
        runSync: (activeToken) =>
          performGoogleDriveSync(activeToken, (p) => setSyncProgress(p)),
        isSessionError: isSessionExpiredMessage,
      })

      if (!res) {
        setSyncProgress(null)
        setToken(getStoredToken())
        setSyncState('idle')
        return
      }

      setLastSyncedTime(res.timestamp)
      setTimeout(() => {
        setSyncProgress(null)
        setSyncState('idle')
      }, 500)
    } catch (e) {
      setSyncProgress(null)
      const msg = (e as Error).message
      if (isSessionExpiredMessage(msg)) {
        clearStoredToken(false)
        setToken(null)
        setSyncState('idle')
        setErrorMessage(null)
        return
      }
      setSyncState('error')
      setErrorMessage(msg)
    }
  }, [refreshSilently])

  const disconnect = useCallback(() => {
    clearStoredToken(true)
    void revokeServerOAuthSession()
    setToken(null)
    setUserEmail(null)
    setIsRefreshing(false)
    setSyncProgress(null)
    setSyncState('idle')
    setErrorMessage(null)
  }, [])

  // Sincronización y renovación automática silenciosa al montar
  useEffect(() => {
    if (!isGoogleSyncEnabled()) {
      setIsRefreshing(false)
      return
    }
    if (!navigator.onLine) {
      setIsRefreshing(false)
      return
    }

    void triggerSync()
  }, [triggerSync])

  // Sincronización y refresco proactivo al recuperar foco, conexión o cada 45 min
  useEffect(() => {
    if (!isConnected) return

    const ensureAndSync = () => {
      if (!navigator.onLine) return
      const activeToken = getStoredToken()
      if ((activeToken && !isTokenExpired(5)) || isGoogleSyncEnabled()) {
        void triggerSync()
      }
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        ensureAndSync()
      }
    }

    const handleOnline = () => {
      ensureAndSync()
    }

    window.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('online', handleOnline)

    const syncInterval = setInterval(() => {
      if (navigator.onLine && document.visibilityState === 'visible') {
        ensureAndSync()
      }
    }, SYNC_INTERVAL_MS)

    const proactiveRefreshInterval = setInterval(() => {
      if (navigator.onLine && isGoogleSyncEnabled() && isTokenExpired(10)) {
        void refreshSilently(true)
      }
    }, PROACTIVE_REFRESH_INTERVAL_MS)

    return () => {
      window.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('online', handleOnline)
      clearInterval(syncInterval)
      clearInterval(proactiveRefreshInterval)
    }
  }, [isConnected, triggerSync, refreshSilently])

  const initiateOAuthLogin = useCallback(() => {
    initiateGoogleOAuthFlow({
      onSuccess: (accessToken, expiresIn, email) => {
        void connectWithToken(accessToken, expiresIn, email)
      },
      onError: (msg) => {
        setErrorMessage(msg)
      },
    })
  }, [connectWithToken])

  return {
    isConnected,
    isSessionExpired,
    syncState,
    syncProgress,
    lastSyncedAt: lastSyncedTime ? new Date(lastSyncedTime) : null,
    errorMessage,
    userEmail,
    connectWithToken,
    disconnect,
    triggerSync,
    initiateOAuthLogin,
  }
}
```

- [ ] **Step 4: Ejecutar tests y compilación**

Run:
```powershell
npx --prefix app vitest run src/hooks/useGoogleSync.test.ts src/pwa/googleDrive.test.ts; npm --prefix app run lint; npm --prefix app run build
```
Expected: PASS sin errores de lint ni TypeScript.

- [ ] **Step 5: Commit**

```bash
git add app/src/hooks/useGoogleSync.ts app/src/hooks/useGoogleSync.test.ts
git commit -m "feat(oauth): integrate silent BFF token refresh and single retry in useGoogleSync"
```

---

### Task 6: Unificar auto-refresco en `GoogleDocsExportModal.tsx` y `AiSettingsModal.tsx`

**Files:**
- Modify: `app/src/components/portability/GoogleDocsExportModal.tsx:1-310,535-560`
- Modify: `app/src/components/portability/GoogleDocsExportModal.test.ts`
- Modify: `app/src/components/settings/AiSettingsModal.tsx:17,105-114`

**Interfaces:**
- Consumes: `ensureValidAccessToken`, `initiateGoogleOAuthFlow`, `getStoredToken`, `setStoredToken`, `clearStoredToken`, `isTokenExpired`, `fetchGoogleUserEmail` de `app/src/pwa/googleDrive.ts`.
- Produces:
  - Helpers exportados y testeables en `GoogleDocsExportModal.tsx`:
    - `resolveTokenForDocsExport(propToken: string | null | undefined, deps: { getToken: () => string | null; isExpired: (marginMinutes?: number) => boolean; ensureToken: (forceRefresh?: boolean) => Promise<string | null> }): Promise<string | null>`
    - `uploadDocxWithTokenRetry(blob: Blob, title: string, activeToken: string, deps: { upload: (b: Blob, t: string, token: string) => Promise<GoogleDocUploadResult>; ensureToken: (forceRefresh?: boolean) => Promise<string | null> }): Promise<GoogleDocUploadResult>`

- [ ] **Step 1: Agregar tests unitarios en `app/src/components/portability/GoogleDocsExportModal.test.ts`**

Añadir al final de `app/src/components/portability/GoogleDocsExportModal.test.ts` (y añadir los imports de `resolveTokenForDocsExport`, `uploadDocxWithTokenRetry` arriba):
```typescript
import {
  sanitizeDocTitle,
  getFallbackDocxFileName,
  isSessionExpiredError,
  resolveTokenForDocsExport,
  uploadDocxWithTokenRetry,
  type GoogleDocsExportStatus,
} from './GoogleDocsExportModal'
```

Y añadir el bloque `describe`:
```typescript
describe('GoogleDocsExportModal Helpers - Silent Refresh & Retry', () => {
  it('resolveTokenForDocsExport reutiliza token vigente y refresca vía BFF si caducó', async () => {
    const ensureToken = vi.fn().mockResolvedValue('ya29.refreshed-docs')

    const fromProp = await resolveTokenForDocsExport('ya29.prop', {
      getToken: () => null,
      isExpired: () => true,
      ensureToken,
    })
    expect(fromProp).toBe('ya29.prop')
    expect(ensureToken).not.toHaveBeenCalled()

    const refreshed = await resolveTokenForDocsExport(null, {
      getToken: () => null,
      isExpired: () => true,
      ensureToken,
    })
    expect(refreshed).toBe('ya29.refreshed-docs')
    expect(ensureToken).toHaveBeenCalledWith(false)
  })

  it('uploadDocxWithTokenRetry reintenta una vez ante error 401 usando ensureToken(true)', async () => {
    const blob = new Blob(['docx'], { type: 'application/octet-stream' })
    const upload = vi
      .fn()
      .mockRejectedValueOnce(new Error('Error de Google Drive (401): Unauthorized'))
      .mockResolvedValueOnce({ fileId: 'doc-1', url: 'https://docs.google.com/document/d/doc-1/edit' })
    const ensureToken = vi.fn().mockResolvedValue('ya29.rotated')

    const res = await uploadDocxWithTokenRetry(blob, 'Protocolo Shock', 'ya29.stale', {
      upload,
      ensureToken,
    })

    expect(ensureToken).toHaveBeenCalledWith(true)
    expect(upload).toHaveBeenCalledTimes(2)
    expect(upload).toHaveBeenNthCalledWith(1, blob, 'Protocolo Shock', 'ya29.stale')
    expect(upload).toHaveBeenNthCalledWith(2, blob, 'Protocolo Shock', 'ya29.rotated')
    expect(res.fileId).toBe('doc-1')
  })
})
```
*(Asegurarse de importar `vi` en `GoogleDocsExportModal.test.ts`: `import { describe, it, expect, vi } from 'vitest'`)*

- [ ] **Step 2: Ejecutar los tests para verificar que fallan (TDD rojo)**

Run:
```powershell
npx --prefix app vitest run src/components/portability/GoogleDocsExportModal.test.ts
```
Expected: FAIL (`resolveTokenForDocsExport` y `uploadDocxWithTokenRetry` no están exportados).

- [ ] **Step 3: Actualizar `app/src/components/portability/GoogleDocsExportModal.tsx` y `app/src/components/settings/AiSettingsModal.tsx`**

En `app/src/components/portability/GoogleDocsExportModal.tsx`:
1. Actualizar imports (líneas `1-12`):
```tsx
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { generateClinicalDocxBlob } from '../../domain/gdocs/clinicalDocxGenerator'
import { uploadDocxAsGoogleDoc, type GoogleDocUploadResult } from '../../pwa/googleDocsUpload'
import {
  getStoredToken,
  setStoredToken,
  clearStoredToken,
  isTokenExpired,
  ensureValidAccessToken,
  initiateGoogleOAuthFlow,
  fetchGoogleUserEmail,
} from '../../pwa/googleDrive'
```
2. Exportar los helpers puros después de `isSessionExpiredError`:
```tsx
export async function resolveTokenForDocsExport(
  propToken: string | null | undefined,
  deps: {
    getToken: () => string | null
    isExpired: (marginMinutes?: number) => boolean
    ensureToken: (forceRefresh?: boolean) => Promise<string | null>
  } = {
    getToken: getStoredToken,
    isExpired: isTokenExpired,
    ensureToken: ensureValidAccessToken,
  },
): Promise<string | null> {
  if (propToken) return propToken
  const current = deps.getToken()
  if (current && !deps.isExpired(1)) {
    return current
  }
  return await deps.ensureToken(false)
}

export async function uploadDocxWithTokenRetry(
  blob: Blob,
  cleanTitle: string,
  activeToken: string,
  deps: {
    upload: (b: Blob, t: string, token: string) => Promise<GoogleDocUploadResult>
    ensureToken: (forceRefresh?: boolean) => Promise<string | null>
  } = {
    upload: uploadDocxAsGoogleDoc,
    ensureToken: ensureValidAccessToken,
  },
): Promise<GoogleDocUploadResult> {
  try {
    return await deps.upload(blob, cleanTitle, activeToken)
  } catch (err) {
    const msg = (err as Error).message || ''
    if (!isSessionExpiredError(msg)) {
      throw err
    }
    const refreshedToken = await deps.ensureToken(true)
    if (!refreshedToken) {
      throw err
    }
    return await deps.upload(blob, cleanTitle, refreshedToken)
  }
}
```
3. En `executeExport`: reemplazar `const uploadResult = await uploadDocxAsGoogleDoc(blob, cleanTitle, activeToken)` por:
```tsx
        const uploadResult = await uploadDocxWithTokenRetry(blob, cleanTitle, activeToken)
```
4. En `handleOAuthConnect`: delegar al flujo compartido `initiateGoogleOAuthFlow`:
```tsx
  const handleOAuthConnect = useCallback(() => {
    if (onInitiateOAuth) {
      onInitiateOAuth()
      return
    }

    initiateGoogleOAuthFlow({
      onSuccess: (accessToken, expiresIn, email) => {
        if (!isMountedRef.current) return
        void (async () => {
          const finalEmail = email || (await fetchGoogleUserEmail(accessToken)) || undefined
          setStoredToken(accessToken, expiresIn, finalEmail)
          if (!isMountedRef.current) return
          void executeExport(accessToken)
        })()
      },
      onError: (msg) => {
        if (!isMountedRef.current) return
        setStatus('error')
        setErrorMessage(msg)
      },
    })
  }, [executeExport, onInitiateOAuth])
```
5. En el `useEffect` de inicialización del modal (reemplazando líneas `300-306`), resolver asíncronamente con `resolveTokenForDocsExport`:
```tsx
    let cancelled = false
    void resolveTokenForDocsExport(propToken)
      .then((resolvedToken) => {
        if (cancelled || !isMountedRef.current) return
        if (resolvedToken) {
          void executeExport(resolvedToken)
        } else {
          setStatus('idle')
        }
      })
      .catch(() => {
        if (cancelled || !isMountedRef.current) return
        setStatus('idle')
      })

    return () => {
      cancelled = true
    }
```
6. En el botón `"🔄 Reintentar conexión"` del estado `offline` (líneas `539-543`), usar `resolveTokenForDocsExport`:
```tsx
                  onClick={() => {
                    if (!navigator.onLine) return
                    void resolveTokenForDocsExport(propToken).then((resolvedToken) => {
                      if (!isMountedRef.current) return
                      if (resolvedToken) void executeExport(resolvedToken)
                      else handleOAuthConnect()
                    })
                  }}
```

En `app/src/components/settings/AiSettingsModal.tsx`:
Actualizar línea `17` y líneas `105-113`:
```tsx
import {
  ensureValidAccessToken,
  isGoogleSyncEnabled,
  uploadAiConfigToDrive,
} from '../../pwa/googleDrive'
```
Y dentro de `handleSave`:
```tsx
    // Si Google Drive está conectado, subimos inmediatamente a appDataFolder (refrescando si expiró)
    if (isGoogleSyncEnabled()) {
      void ensureValidAccessToken()
        .then((token) => (token ? uploadAiConfigToDrive(token, enrichedConfig) : null))
        .catch((err) => {
          console.warn('Error subiendo AI config a Google Drive al guardar:', err)
        })
    }
```

- [ ] **Step 4: Ejecutar toda la suite de tests, lint y build**

Run:
```powershell
npm --prefix app test; npm --prefix app run lint; npm --prefix app run build
```
Expected: Todos los tests de Vitest PASS, cero errores de lint, `tsc -b && vite build` exitoso.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/portability/GoogleDocsExportModal.tsx app/src/components/portability/GoogleDocsExportModal.test.ts app/src/components/settings/AiSettingsModal.tsx
git commit -m "feat(oauth): auto-refresh token in GoogleDocsExportModal and AiSettingsModal"
```

---

## Verification & Rollout Checklist (post-implementación)

1. Verificar localmente con Wrangler (opcional antes de push):
   - Copiar `app/.dev.vars.example` → `app/.dev.vars` con `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `OAUTH_COOKIE_SECRET`.
   - Ejecutar `npm --prefix app run build` y `npx --prefix app wrangler pages dev dist`.
   - Conectar Google Drive → comprobar en DevTools Network que `POST /api/oauth/exchange` devuelve `200 { persistent: true }` y setea cookie `HttpOnly` `sindecon_gdrive_rt`.
   - Borrar `cuaderno-gdrive-token` y `cuaderno-gdrive-expiry` en Application → LocalStorage (conservando `cuaderno-gdrive-enabled: "true"`), recargar página → comprobar que `POST /api/oauth/refresh` renueva silenciosamente sin popup ni pasar a "Sesión en pausa".
   - Pulsar "Desconectar cuenta" → comprobar que `POST /api/oauth/logout` borra la cookie (`Max-Age=0`).
2. En Google Cloud Console: cambiar OAuth Consent Screen de *Testing* a **In Production** y confirmar orígenes autorizados de Cloudflare Pages.
3. En Cloudflare Pages Dashboard: configurar `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `OAUTH_COOKIE_SECRET` en *Production* y *Preview*.
