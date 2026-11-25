# Especificación de Diseño: Autenticación Clínica con Google, FIDO2/WebAuthn y PIN Seguro (\$0/mes)

- **Fecha:** 2026-11-25
- **Estado:** Validado en diseño / Pendiente de revisión final del usuario
- **Modelo:** Híbrido *Stateless* en Cloudflare Workers/Pages + WebAuthn/WebCrypto Dual (Online + Offline)
- **Costo operativo:** **\$0/mes** (sin base de datos externa, KV ni proveedores BaaS pagos)

---

## 1. Contexto y Problema Actual

Hoy la capa de autenticación en SINDECON ([auth.ts](../../../app/src/domain/auth.ts), [useAuth.ts](../../../app/src/hooks/useAuth.ts), [LoginView.tsx](../../../app/src/components/auth/LoginView.tsx) y [App.tsx](../../../app/src/App.tsx)) presenta cuatro brechas frente a un acceso real:

1. **Botón de Google desconectado del login:** En [App.tsx](../../../app/src/App.tsx), `<LoginView onGoogleSignIn={initiateGoogleOAuth} />` solo dispara el flujo de Google Drive ([useGoogleSync.ts](../../../app/src/hooks/useGoogleSync.ts)), solicita permisos completos de Drive (`drive.appdata` y `drive.file`) y nunca llama a `loginWithGoogle()` para desbloquear la estación clínica.
2. **Botón biométrico simulado:** `handleBiometricAccess` en [LoginView.tsx](../../../app/src/components/auth/LoginView.tsx) simplemente inyecta `'1234'` en lugar de usar WebAuthn / FIDO2 real.
3. **PIN en texto plano y sin gestión UI:** `DEFAULT_PIN = '1234'` se compara en texto plano contra `localStorage` (`sindecon_saved_pin`), sin hash criptográfico, sin límite de intentos, sin soporte de 6 dígitos ni interfaz para configurarlo o recuperarlo.
4. **Bypass permanente:** Incluso si el usuario cambiara su PIN manualmente, el botón *"Ingreso directo — Urgencias (Sin red)"* y la pestaña *"Credenciales"* (que acepta cualquier contraseña de 4+ caracteres) permitirían omitir el bloqueo local.

### Principios de Diseño
- **\$0/mes sin BD central:** Todos los endpoints de servidor corren dentro del Worker/Pages gratuito de Cloudflare ([worker.ts](../../../app/worker.ts), `100.000` req/día gratis) utilizando cookies y tokens sellados de forma *stateless* con **AES-256-GCM** (`OAUTH_COOKIE_SECRET`).
- **Offline-first real en hospital:** Un médico ya configurado en su terminal puede desbloquear SINDECON con **huella/FaceID FIDO** o **PIN** sin conexión a internet.
- **Privacidad estricta:** Ningún dato clínico, hash de PIN ni llave privada sale hacia servidores propios o de terceros.

---

## 2. Arquitectura General y Estados del Terminal

### 2.1. Estados de protección del dispositivo (`protectionConfigured`)

| Estado | Cuándo aplica | Métodos visibles en `LoginView` |
| :--- | :--- | :--- |
| **Inicial / Sin configurar (`false`)** | Navegador nuevo sin PIN propio ni passkey FIDO registrado. | PIN demo inicial (`1234`), pestaña `Credenciales` básica, `Continuar con Google`, e `Ingreso directo — Urgencias (Sin red)`. |
| **Protegido (`true`)** | Al crear un PIN propio (`4` o `6` dígitos) **o** registrar al menos una credencial FIDO en el dispositivo. | Solo métodos verificados: **PIN de Guardia** (`4` o `6` dígitos con PBKDF2 + lockout), **Biometría / Passkey FIDO** real y **Continuar con Google** (login + recuperación). Se ocultan `"Urgencias (Sin red)"`, el aviso de `1234` y la pestaña dummy `"Credenciales"`. |

> **Nota sobre Google sin PIN/FIDO:** Si el usuario solo inicia sesión con Google y luego pulsa `Bloquear terminal` sin haber creado PIN ni FIDO, vuelve a `LoginView` pudiendo reingresar con Google (o configurar PIN/FIDO en *Seguridad y Cuenta* para tener acceso rápido offline). Si vincula un Google (`ownerEmail`) tras proteger el terminal, otro correo Gmail diferente **no** podrá saltarse el bloqueo.

### 2.2. Nuevo panel modal `SecuritySettingsModal`
Accesible desde un botón discreto **Seguridad** en [ClinicalStationHeader.tsx](../../../app/src/components/common/ClinicalStationHeader.tsx) (junto a `Drive` y `Bloquear`). Permite:
- Ver cuenta Google vinculada (nombre, email) y activar/gestionar respaldo en Google Drive de forma opcional.
- Crear, cambiar o eliminar el **PIN local** (`4` o `6` dígitos), exigiendo verificación previa (PIN actual, FIDO o Google).
- Registrar, nombrar, listar y eliminar **Passkeys / Biometría FIDO** de este terminal.
- **Cerrar / Bloquear turno** (llama a `logout()` manteniendo PIN, FIDO y respaldo) o **Restablecer terminal de seguridad** (con confirmación destructiva explícita si se olvidó el PIN sin Google vinculado).

---

## 3. Flujo 1: Login Real con Google + Drive Opcional

### 3.1. Endpoints en Cloudflare (`app/functions/api/auth/`)
Se generalizan los helpers de cifrado y cookies en [\_shared.ts](../../../app/functions/api/oauth/_shared.ts) (`encryptJsonPayload`, `decryptJsonPayload`, `readCookieByName`, `buildCookieHeader`) para reutilizar `OAUTH_COOKIE_SECRET` con cookies por ruta sin duplicar código:

- **`POST /api/auth/google`**
  - **Entrada:** `{ "code": string }` obtenido vía Google Identity Services `initCodeClient({ scope: 'openid email profile', ux_mode: 'popup' })`.
  - **Validación:** Envía el `code` a `https://oauth2.googleapis.com/token` (con `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `redirect_uri: 'postmessage'`). Verifica `aud === env.GOOGLE_CLIENT_ID`, `iss` en `accounts.google.com` / `https://accounts.google.com`, `exp` vigente y `email_verified === true` del `id_token` (con fallback a `https://openidconnect.googleapis.com/v1/userinfo` usando `access_token`).
  - **Salida `200`:** `{ user: { sub, email, name, picture }, driveConnected: boolean }` (detectando si existe cookie `sindecon_gdrive_rt` válida del mismo `email`). Adjunta cookie `HttpOnly` cifrada AES-256-GCM **`sindecon_auth_session`** (`Path=/api/auth`, `SameSite=Lax`, `Max-Age=15552000`).
  - **Errores:** `400` si falta `code`, `401` si Google rechaza o `email_verified` es falso, `403` origen cruzado, `500` si faltan env vars, `502` si falla red hacia Google.
- **`POST /api/auth/session`**
  - Lee y descifra `sindecon_auth_session` para comprobar validez de sesión web cuando hay red; devuelve `{ authenticated: true, user }` o `401`.
- **`POST /api/auth/logout`**
  - Limpia `sindecon_auth_session` (`Max-Age=0`) cuando el usuario desvincula su cuenta del terminal (bloqueo de turno rápido NO borra `sindecon_auth_session`, solo limpia la sesión UI activa si se re-bloquea, o exige verificación local).

### 3.2. Flujo en Cliente y Regla de `ownerEmail`
- En `LoginView`, pulsar **"Continuar con Google"** solicita únicamente `openid email profile` (sin pedir permisos de Google Drive obligatorios).
- **Fallback en desarrollo (`vite dev` sin Wrangler):** Si `POST /api/auth/google` devuelve `404`/`405`, usa `initTokenClient` con `'openid email profile'` y consulta `/oauth2/v3/userinfo` para completar el mismo objeto `{ sub, email, name, picture }`.
- **Resguardo de dueño del equipo:** Al configurar PIN/FIDO tras haber entrado con Google (o al iniciar con Google en un equipo sin bloqueo previo), se guarda `ownerEmail` y `ownerSub`. Si el dispositivo está bloqueado (`protectionConfigured = true`) con un `ownerEmail` fijado y alguien intenta entrar con una cuenta Google distinta, se rechaza el desbloqueo con aviso claro para evitar suplantación local con otro Gmail.
- **Drive opcional:** Desde `SecuritySettingsModal` o `GoogleDriveModal` ([GoogleDriveModal.tsx](../../../app/src/components/portability/GoogleDriveModal.tsx)), un botón **"Activar respaldo automático en Google Drive"** solicita `GOOGLE_DRIVE_SCOPES` usando `exchange.ts` / `refresh.ts` preexistente (reutilizando `login_hint: ownerEmail`).

---

## 4. Flujo 2: FIDO2 / WebAuthn Criptográfico (Online + Offline Dual)

Reemplaza el acceso biométrico simulado por WebAuthn nativo (`navigator.credentials.create` / `get`), usando curvas **ECDSA P-256 (`alg: -7`, `ES256`)** y **RS256 (`alg: -257`)** verificables con WebCrypto tanto en Cloudflare Worker como en el navegador.

### 4.1. Registro (Enrollment)
1. El médico (autenticado) pulsa **"Registrar huella / Passkey"** en `SecuritySettingsModal` y asigna etiqueta (ej. *"MacBook TouchID"*).
2. Si hay conexión, pide `POST /api/auth/fido/challenge`; si está offline, genera 32 bytes locales (`crypto.getRandomValues`).
3. Ejecuta `navigator.credentials.create` con:
   - `rp`: `{ id: window.location.hostname, name: 'SINDECON Clínica' }`
   - `user`: `{ id: utf8(ownerSub || localDeviceId), name: ownerEmail || 'medico@local', displayName }`
   - `pubKeyCredParams`: `[{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }]`
   - `authenticatorSelection`: `{ residentKey: 'preferred', userVerification: 'required' }`
   - `attestation`: `'none'`
4. Extrae `credentialId`, `clientDataJSON`, `authenticatorData` (`signCount` inicial) y la clave pública **SPKI** (`response.getPublicKey()`, con fallback por parser CBOR COSE mínimo de `authData` si el navegador no implementa `getPublicKey()`).
5. **Con red:** `POST /api/auth/fido/enroll` valida `clientDataJSON` + challenge cookie (`sindecon_fido_challenge`), importa la clave pública en `crypto.subtle.importKey` para confirmar formato válido, y devuelve un **`sealedToken`** cifrado con `AES-256-GCM` (`OAUTH_COOKIE_SECRET`) conteniendo `{ credentialId, publicKeySpkiB64, alg, rpId, ownerEmail, enrolledAt }`.
6. **Sin red:** guarda localmente la credencial sin `sealedToken` (verificación local activa al instante; al conectarse y validar sesión puede sellar en servidor si se desea o usarse localmente).

### 4.2. Verificación al Desbloquear
Al pulsar el botón de huella/FIDO en `LoginView` (o *"Desbloquear con FIDO"*):

1. Se obtiene `challenge` desde `POST /api/auth/fido/challenge` (que emite cookie `HttpOnly` AES-GCM `sindecon_fido_challenge` con TTL `180s` y nonce único) o `crypto.getRandomValues(32)` si `!navigator.onLine` / BFF no disponible.
2. Ejecuta `navigator.credentials.get({ publicKey: { challenge, rpId: hostname, allowCredentials, userVerification: 'required' } })`.
3. **Ruta Online (si existe `sealedToken` y hay red → `POST /api/auth/fido/verify`):**
   - Descifra y **consume** la cookie `sindecon_fido_challenge` (`Set-Cookie` con `Max-Age=0` incluso si falla, garantizando **uso único anti-replay**).
   - Descifra `sealedToken` con `OAUTH_COOKIE_SECRET` (el cliente no puede falsificar su clave pública frente al servidor).
   - Verifica `clientDataJSON`: `type === 'webauthn.get'`, coincidencia exacta de `challenge` base64url, y `origin === expectedOrigin`.
   - Verifica `authenticatorData`: `SHA-256(rpId)` coincide con los primeros `32` bytes (`rpIdHash`) y las banderas `UP (0x01)` y `UV (0x04)` están activas.
   - Verifica la firma criptográfica sobre `authenticatorData || SHA-256(clientDataJSON)` mediante `crypto.subtle.verify` (convirtiendo firma ECDSA ASN.1 DER a IEEE P1363 de 64 bytes para P-256).
   - Emite `200 { verified: true, user }` + cookie `sindecon_auth_session`.
4. **Ruta Offline (`!navigator.onLine` o sin BFF):**
   - Ejecuta **exactamente la misma rutina compartida de validación WebAuthn** en el navegador contra `publicKeySpkiB64` almacenada localmente, además de validar incremento de `signCount` (si el previo era `> 0`, el nuevo debe ser estrictamente mayor para detectar clonación).
5. **Errores contemplados:**
   - Cancelación del usuario (`NotAllowedError`) → feedback neutro en `LoginView` sin incrementar contador de errores ni borrar credenciales.
   - Navegador sin soporte WebAuthn (`!window.PublicKeyCredential`) → oculta/desactiva el disparador FIDO con texto informativo.
   - Sin passkeys en el dispositivo → al pulsar FIDO informa *"Configura tu huella o Passkey desde Seguridad tras iniciar sesión"*.

---

## 5. Flujo 3: PIN Seguro con PBKDF2, Bloqueo y Recuperación

### 5.1. Modelo criptográfico y estructura local (`app/src/domain/pinAuth.ts`)
Se guarda en almacenamiento local del navegador (`sindecon_security_state` en `localStorage` respaldado en `db.meta` para sobrevivir recargas/limpiezas parciales):

```ts
export interface PinRecord {
  version: 2
  pinLength: 4 | 6
  saltB64: string // 16 bytes aleatorios
  hashB64: string // 32 bytes PBKDF2-SHA256 (150_000 iteraciones)
  iterations: 150_000
  failedAttempts: number
  lockedUntil: number | null // timestamp ms
  updatedAt: number
}
```

- **Derivación y comparación:** Nunca se almacena el PIN en texto plano ni en cookies. La verificación recalcula los 256 bits vía `crypto.subtle.deriveBits` (`PBKDF2`, `SHA-256`, `150_000` iteraciones) y compara byte a byte en tiempo constante.
- **Migración limpia desde `v1.2.x`:** Si un usuario previo solo tenía `DEFAULT_PIN` (`'1234'`) sin `PinRecord v2`, el sistema permanece en estado `protectionConfigured = false` (conservando compatibilidad sin bloquearle el acceso). Si había personalizado `sindecon_saved_pin` != `'1234'`, se migra automáticamente a `PinRecord v2` (`PBKDF2`) al primer acceso válido y se borra la clave en claro.

### 5.2. Bloqueo exponencial ante fuerza bruta física
- Fallos `1`–`4`: mensaje claro con intentos restantes (`"PIN incorrecto. Quedan N intentos."`).
- Fallo `5`: bloqueo **`30 s`**.
- Fallo `6`: bloqueo **`2 min`**.
- Fallo `7`: bloqueo **`5 min`**.
- Fallo `>= 8`: bloqueo **`15 min`**.
- Durante `Date.now() < lockedUntil`: teclado numérico deshabilitado en `LoginView` mostrando cuenta regresiva en vivo; **FIDO** y **Google (dueño)** siguen disponibles para desbloqueo legítimo inmediato (lo que además resetea `failedAttempts = 0` y `lockedUntil = null`).

### 5.3. Recuperación de PIN olvidado
1. **Con `ownerEmail` vinculado (caso recomendado):** El enlace *"¿Olvidaste tu PIN? Recuperar con Google"* lanza `loginWithGoogle`. Si el correo coincide con `ownerEmail`, desbloquea la estación y abre el diálogo para fijar un nuevo PIN (o quitarlo).
2. **Sin `ownerEmail` vinculado:** Ninguna cuenta Google externa puede resetear el PIN. Si el usuario olvida el PIN sin Google vinculado, se ofrece únicamente *"Restablecer terminal local"* tras doble confirmación destructiva (advirtiendo al crear un PIN sin Google sobre la conveniencia de vincular una cuenta Gmail).

---

## 6. Archivos Previstos y Fronteras de Arquitectura

- **Backend Cloudflare (`app/functions/api/` + `app/worker.ts`):**
  - `_shared.ts`: cifrado/descifrado genérico AES-256-GCM y cookies parametrizables por nombre/ruta.
  - `app/functions/api/auth/_webauthn.ts`: verificación pura de WebAuthn (`clientDataJSON`, `authenticatorData`, conversión ASN.1 DER → IEEE P1363 y `crypto.subtle.verify`) reusable también como módulo compartido o espejo puro sin dependencias Node.
  - `app/functions/api/auth/google.ts`, `session.ts`, `logout.ts`
  - `app/functions/api/auth/fido/challenge.ts`, `enroll.ts`, `verify.ts`
  - `app/worker.ts`: registro de las nuevas rutas `/api/auth/*` en `API_ROUTES`.
- **Dominio y Estado en Cliente (`app/src/`):**
  - `app/src/domain/pinAuth.ts`: derivación `PBKDF2`, validación de formato `4|6`, lógica de lockout exponencial, migración `sindecon_saved_pin`.
  - `app/src/domain/fidoAuth.ts`: WebAuthn `registerPasskey`, `authenticateWithPasskey`, extractor SPKI/COSE, verificación criptográfica offline (compartiendo verificador puro WebCrypto).
  - `app/src/domain/auth.ts`: `AuthUser` enriquecido (`email?`, `avatarUrl?`, `sub?`), estado `SecurityProfile` y `isProtectionConfigured()`.
  - `app/src/hooks/useAuth.ts`: integración real de Google Auth, FIDO, PIN PBKDF2, lockout y acciones de configuración/recuperación.
- **UI (`app/src/components/`):**
  - `auth/LoginView.tsx`: soporte de 4 o 6 dígitos en indicadores, botón WebAuthn real, botón Google login independiente, ocultación de bypasses cuando `protectionConfigured = true`, cuenta regresiva de bloqueo y flujo `"¿Olvidaste tu PIN?"`.
  - `auth/SecuritySettingsModal.tsx` + integración en `common/ClinicalStationHeader.tsx` y `App.tsx`.

---

## 7. Estrategia de Verificación y Pruebas

1. **Pruebas Backend (`app/tests/oauth/auth.test.ts` y `fido.test.ts`):**
   - Ciclo completo Google Auth (`code` → token → validación `id_token` → cookie AES-GCM → `/session` → `/logout`).
   - Ciclo completo FIDO WebAuthn generando claves ECDSA `P-256` reales con `crypto.subtle`: challenge de un solo uso (replay rechazado con `401`), firma ASN.1 DER válida (`200`), origin inválido (`401`), `rpIdHash` inválido (`401`), bandera `UV=0` (`401`) y `sealedToken` alterado (`401`).
2. **Pruebas de Dominio (`pinAuth.test.ts`, `fidoAuth.test.ts`, `auth.test.ts`):**
   - Hash/verificación `PBKDF2`, longitud `4` vs `6`, bloqueo exponencial persistente, migración heredada y regla estricta de `ownerEmail` para recuperación.
   - Verificación WebAuthn offline y detección anti-clonación por `signCount` decreciente.
3. **Pruebas UI y E2E (`LoginView.test.ts` + Chrome DevTools / Playwright Virtual Authenticator):**
   - Contratos y renderizado de `LoginView` en estados `protectionConfigured = false` vs `true`.
   - Prueba E2E en navegador real activando el **Virtual Authenticator (`WebAuthn`)** vía CDP para registrar una Passkey, bloquear terminal y desbloquear con FIDO sin errores en consola, además de flujo de PIN y bloqueo temporal.
4. **Gate completo del repo:** `npm test`, `npm run lint`, `npm run build` (`tsc -b && vite build` incluyendo `tsconfig.functions.json`).
