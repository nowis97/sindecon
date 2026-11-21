# Especificación de Diseño: Sesión Persistente de Google Drive y Google Docs mediante Cloudflare Pages Functions

- **Fecha:** 2026-11-21
- **Estado:** Validado / Listo para Revisión
- **Autor:** Antigravity (Pair Programming) & Usuario

---

## 1. Contexto y Problema

SINDECON es una PWA *offline-first* desplegada en Cloudflare Pages (`Root directory: app`). Actualmente la integración con Google Drive (respaldo automático en `appDataFolder`) y Google Docs (exportación clínica en `.docx`) utiliza exclusivamente Google Identity Services (`google.accounts.oauth2.initTokenClient`) en el navegador:

1. Google no emite `refresh_token` a aplicaciones 100% navegador sin `Client Secret`, y su endpoint `https://oauth2.googleapis.com/token` rechaza intercambios PKCE sin `client_secret` para clientes Web y bloquea llamadas CORS desde SPA.
2. El `access_token` emitido por GIS caduca estrictamente a los **3600 segundos (1 hora)**.
3. Los navegadores modernos bloquean iframes ocultos por restricciones de cookies de terceros y bloquean popups disparados sin gesto del usuario, por lo que `requestSilentAccessToken` fue desconectado en `v0.8.0` ([useGoogleSync.ts](../../../app/src/hooks/useGoogleSync.ts)). Como consecuencia, cada hora la sesión pasa a *"Sesión en pausa"* y el usuario debe reconectar manualmente.

### Objetivo
Mantener la sesión de Google Drive y Google Docs conectada de forma persistente (semanas/meses en producción) sin popups horarios ni almacenamiento de notas o tokens en bases de datos de terceros, manteniendo el costo en **\$0/mes**.

---

## 2. Decisiones de Arquitectura

| Dimensión | Decisión | Justificación |
| :--- | :--- | :--- |
| **Patrón** | BFF *Token Broker* ligero en `app/functions/api/oauth/` | Cloudflare Pages ejecuta Functions dentro del `Root directory: app`. Solo intercambia y refresca tokens OAuth; los datos clínicos y archivos ZIP/DOCX nunca pasan por el servidor. |
| **Persistencia del `refresh_token`** | Cookie `HttpOnly` cifrada con **AES-256-GCM** (*stateless*) | Cero bases de datos, cero Cloudflare KV, cero PII en servidores externos. El `refresh_token` cifrado (~250–350 bytes) queda en el dispositivo del usuario, inaccesible desde JavaScript ante XSS. |
| **Flujo de conexión inicial** | GIS `initCodeClient` (`ux_mode: 'popup'`) | Mantiene al usuario dentro de la PWA (sin recargar la página ni perder estado de modales abiertos como `GoogleDocsExportModal`) y funciona en contenedores standalone de PWA. |
| **Scopes OAuth** | Mantener `drive.appdata` y `drive.file` | Ambos son clasificados por Google como *no sensibles*; permiten publicar la app en Google Cloud a *In Production* sin auditoría de pago CASA. |
| **Fallback local / personalizado** | GIS `initTokenClient` clásico | Preserva compatibilidad con `npm run dev` (Vite puro sin Wrangler) y con `Client ID` personalizados en Opciones Avanzadas de `GoogleDriveModal`. |

---

## 3. Arquitectura de Backend (Cloudflare Pages Functions)

### 3.1. Estructura de archivos
Ubicados en `app/functions/api/oauth/` (fuera de `app/src/` para no mezclarse con el bundle de Vite ni con `tsconfig.app.json`), implementados únicamente con APIs estándar Web (`Request`, `Response`, `crypto.subtle`, `fetch`) y sin dependencias npm adicionales:

- `app/functions/api/oauth/_shared.ts`: cifrado/descifrado AES-256-GCM, gestión de cookies, validación CSRF por `Origin` y helpers de respuesta JSON.
- `app/functions/api/oauth/exchange.ts`: `POST /api/oauth/exchange`
- `app/functions/api/oauth/refresh.ts`: `POST /api/oauth/refresh`
- `app/functions/api/oauth/logout.ts`: `POST /api/oauth/logout`

### 3.2. Variables de entorno (Cloudflare Pages)
Configuradas en **Dashboard → Settings → Environment variables** (Production y Preview) y en `app/.dev.vars` para desarrollo local con Wrangler:

- `GOOGLE_CLIENT_ID`: Client ID de Google OAuth 2.0 (mismo valor que `VITE_GOOGLE_CLIENT_ID`).
- `GOOGLE_CLIENT_SECRET`: Client Secret de Google Cloud Console.
- `OAUTH_COOKIE_SECRET`: secreto aleatorio de al menos 32 caracteres para cifrar cookies.

Para derivar la clave criptográfica AES-256-GCM de forma determinista y sin errores de formato, `_shared.ts` calcula el hash `SHA-256` de `OAUTH_COOKIE_SECRET` e importa los 32 bytes resultantes como clave `AES-GCM`.

### 3.3. Formato y seguridad de la cookie `sindecon_gdrive_rt`
- **Payload cifrado:** JSON `{ rt: string, email?: string, iat: number }`.
- **Codificación:** `base64url(iv_12_bytes) + "." + base64url(ciphertext_con_tag)`.
- **Atributos de `Set-Cookie`:**
  - `HttpOnly`
  - `SameSite=Lax`
  - `Path=/api/oauth` (solo se envía a los endpoints de OAuth, nunca a assets estáticos)
  - `Max-Age=15552000` (180 días; se renueva en cada refresco)
  - `Secure` cuando la petición es `https:` (se omite únicamente en `http://localhost` o `http://127.0.0.1` para pruebas locales con Wrangler).
- **Cabeceras HTTP y protección CSRF:**
  - Toda respuesta de `/api/oauth/*` incluye `Cache-Control: no-store, private` y `Vary: Cookie`.
  - Solo se acepta el método `POST`.
  - Validación de mismo origen: si viene cabecera `Origin`, debe coincidir exactamente con `new URL(request.url).origin`; si no viene `Origin`, `Sec-Fetch-Site` debe ser `'same-origin'`. En caso contrario responde `403`.

### 3.4. Contrato de endpoints

#### `POST /api/oauth/exchange`
- **Request:** `{ "code": string }`
- **Proceso:**
  1. Valida presencia de `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `OAUTH_COOKIE_SECRET`; si falta alguna, responde `500 { "error": "server_not_configured" }`.
  2. Valida que `code` sea string no vacío; si no, responde `400 { "error": "missing_code" }`.
  3. Envía `POST https://oauth2.googleapis.com/token` (`application/x-www-form-urlencoded`) con:
     - `code`
     - `client_id`: `env.GOOGLE_CLIENT_ID`
     - `client_secret`: `env.GOOGLE_CLIENT_SECRET`
     - `redirect_uri`: `'postmessage'`
     - `grant_type`: `'authorization_code'`
  4. Determina `email`: si Google incluye `id_token` con claim `email` se decodifica el payload JWT; si no, consulta `GET https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)` con el nuevo `access_token` (best-effort).
  5. Determina el `refresh_token` a persistir:
     - Si Google devuelve `refresh_token`, se usa ese valor.
     - Si Google lo omite (p. ej. autorización previa sin consentimiento forzado), intenta recuperar `rt` de una cookie `sindecon_gdrive_rt` válida previa en la petición.
  6. Si existe `refresh_token`, cifra `{ rt, email, iat: Date.now() }` y adjunta `Set-Cookie` para `sindecon_gdrive_rt`, respondiendo `200 { access_token, expires_in, email, persistent: true }`.
  7. Si ni Google ni una cookie previa tienen `refresh_token`, responde `200 { access_token, expires_in, email, persistent: false }` sin escribir cookie rota.
  8. Si Google rechaza el intercambio del `code` (`400`/`401`), responde `401 { "error": "oauth_exchange_failed" }` (o `502 { "error": "upstream_unavailable" }` ante errores `5xx` de Google o red).

#### `POST /api/oauth/refresh`
- **Request:** cuerpo vacío (lee la cookie `sindecon_gdrive_rt`).
- **Proceso:**
  1. Si la cookie falta o falla el descifrado AES-GCM, limpia la cookie (`Max-Age=0`) y responde `401 { "error": "session_expired" }`.
  2. Envía `POST https://oauth2.googleapis.com/token` con `client_id`, `client_secret`, `refresh_token` y `grant_type=refresh_token`.
  3. Si Google responde `200`:
     - Conserva `rt` (o actualiza al nuevo `refresh_token` si Google lo rotó) y re-emite la cookie `sindecon_gdrive_rt` renovando `Max-Age=15552000`.
     - Responde `200 { access_token, expires_in, email }` tomando `email` del payload descifrado de la cookie.
  4. Si Google responde `400` o `401` con `error === "invalid_grant"` o `"unauthorized_client"` (permiso revocado o caducado a los 7 días en modo *Testing*): limpia la cookie (`Max-Age=0`) y responde `401 { "error": "session_expired" }`.
  5. Si Google responde `5xx` o `429` o falla la red hacia Google: **no borra la cookie** y responde `502 { "error": "upstream_unavailable" }`.

#### `POST /api/oauth/logout`
- **Proceso:**
  1. Si existe cookie `sindecon_gdrive_rt` válida, intenta revocar el `refresh_token` con `POST https://oauth2.googleapis.com/revoke` (timeout corto/best-effort; un fallo de red no bloquea el logout).
  2. Siempre responde `200 { "ok": true }` con `Set-Cookie: sindecon_gdrive_rt=; Path=/api/oauth; Max-Age=0`.

---

## 4. Integración en el Cliente (Frontend + Service Worker)

### 4.1. Capa compartida en `app/src/pwa/googleDrive.ts`
Centraliza la gestión de tokens para eliminar la duplicación actual entre `useGoogleSync.ts` y `GoogleDocsExportModal.tsx`:

1. **Detección de modo BFF vs fallback:**
   - Se utiliza el BFF `/api/oauth/*` cuando el `clientId` activo coincide con `DEFAULT_GOOGLE_CLIENT_ID` (no un `Client ID` personalizado ingresado en Opciones Avanzadas) y no se ha detectado en esta sesión de navegador que `/api/oauth/*` devuelva `404`/`405` (entorno `vite dev` sin Wrangler).
2. **`ensureValidAccessToken(forceRefresh = false): Promise<string | null>`** (con mutex *single-flight*):
   - Si `!forceRefresh` y `getStoredToken()` existe y `!isTokenExpired(2)`, lo retorna de inmediato.
   - Si no hay red (`!navigator.onLine`), retorna `null` sin alterar estado ni borrar `cuaderno-gdrive-enabled`.
   - Si aplica BFF y hay una sesión habilitada (o se invoca desde `GoogleDocsExportModal` al intentar exportar), comparte una única promesa `inFlightRefresh` para llamar `POST /api/oauth/refresh` (`credentials: 'same-origin'`).
   - En `200`: invoca `setStoredToken(data.access_token, data.expires_in, data.email)` y retorna el token.
   - En `401`: invoca `clearStoredToken(false)` (mantiene `cuaderno-gdrive-enabled` y `cuaderno-gdrive-email`) y retorna `null`.
   - En `404`/`405`: marca el soporte BFF como no disponible para la sesión en memoria y retorna `null`.
   - En `5xx`/error de red: lanza o retorna error transitorio sin invalidar `cuaderno-gdrive-enabled`.
3. **`initiateGoogleCodeOAuth(options)`:**
   - Si aplica BFF y `google.accounts.oauth2.initCodeClient` está disponible:
     - Usa `ux_mode: 'popup'`, `scope: GOOGLE_DRIVE_SCOPES`, `login_hint: storedEmail || undefined`.
     - Pasa `prompt: storedEmail ? 'consent' : 'select_account consent'` para asegurar emisión de `refresh_token`.
     - Al recibir `response.code`, llama `POST /api/oauth/exchange`. Si el endpoint responde `404`/`405`, cae automáticamente al flujo clásico `initTokenClient`.
   - Si usa `Client ID` personalizado o no hay BFF, ejecuta `initTokenClient` clásico.
4. **Resiliencia en `fetchGoogleUserEmail(token)`:**
   - Mantiene `/oauth2/v3/userinfo` y agrega fallback a `https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)` para obtener el correo aun cuando solo existan scopes de Drive.
5. **Notificación reactiva de cambios de token:**
   - Un evento interno ligero (`window.dispatchEvent` o suscriptores en memoria) mantiene sincronizados `token` y `userEmail` en `useGoogleSync` cuando `GoogleDocsExportModal` renueva o conecta el token.

### 4.2. Hook `app/src/hooks/useGoogleSync.ts`
- **Estado `isRefreshing` sin parpadeos:** mientras `ensureValidAccessToken()` está en curso al abrir la app tras >1 h, `isSessionExpired` permanece en `false` para evitar mostrar brevemente *"Sesión en pausa"* antes de que termine el refresco; solo pasa a `true` si el refresco falla por sesión expirada (`401`) o si aplica el modo sin BFF con token vencido.
- **Al montar, al recuperar visibilidad (`visibilitychange`), al evento `online` y cada 45 minutos:**
  - Si `isGoogleSyncEnabled()` es `true` y `navigator.onLine`, verifica si falta token o está por vencer (`!getStoredToken() || isTokenExpired(5)`). En ese caso llama a `ensureValidAccessToken()` silenciosamente (sin popups) y luego ejecuta `triggerSync()`.
- **Reintento automático ante `401` de Google Drive:**
  - Si `performGoogleDriveSync` falla por `401`/token expirado, intenta **1 vez** `ensureValidAccessToken(true)`. Si obtiene token nuevo, reintenta la sincronización; solo si falla el refresco marca `isSessionExpired = true`.
- **`disconnect()`:**
  - Llama a `clearStoredToken(true)` y dispara `POST /api/oauth/logout` en segundo plano.

### 4.3. Exportación a Google Docs (`app/src/components/portability/GoogleDocsExportModal.tsx`)
- Elimina su implementación duplicada de `initTokenClient` y usa `ensureValidAccessToken()` + `initiateGoogleCodeOAuth()`.
- Al abrirse el modal (estando online), si `getStoredToken()` no existe o está por vencer (`isTokenExpired(1)`), intenta `ensureValidAccessToken()` antes de mostrar la pantalla `"Conectar con Google Drive"`. Si la cookie `HttpOnly` es válida, refresca el token y ejecuta la exportación automáticamente.
- Si `uploadDocxAsGoogleDoc` responde `401`, intenta `ensureValidAccessToken(true)` una vez y reintenta la subida antes de mostrar error de sesión expirada.

### 4.4. Service Worker y Gitignore
- **[vite.config.ts](../../../app/vite.config.ts):** agregar `navigateFallbackDenylist: [/^\/api\//]` en `VitePWA({ workbox: ... })` para evitar que Workbox responda `index.html` ante cualquier petición bajo `/api/`.
- **[.gitignore](../../../.gitignore) / [app/.gitignore](../../../app/.gitignore):** asegurar que `.dev.vars` y `.wrangler/` estén ignorados para impedir commits accidentales de secretos locales.

---

## 5. Manejo de Errores y Casos Borde

| Escenario | Comportamiento del Sistema |
| :--- | :--- |
| **Sin conexión a internet** | No llama a `/api/oauth/refresh`; mantiene `cuaderno-gdrive-enabled` y pasa a `offline`. Refresca y sincroniza automáticamente al volver `online`. |
| **Token caducado tras >1 h con sesión activa** | `ensureValidAccessToken()` renueva silenciosamente vía cookie `HttpOnly` sin popups ni clics del usuario. |
| **Fallo temporal de Google/Cloudflare (`5xx`/`429`)** | La Function conserva la cookie intacta; la app no borra credenciales y vuelve a intentar al recuperar foco o pulsar sincronizar. |
| **Permiso revocado en Google o >7 días en *Testing*** | Google responde `invalid_grant`; `/refresh` borra la cookie y devuelve `401`. La UI muestra *"Sesión en pausa"* conservando todas las notas locales en IndexedDB. |
| **Cookies borradas por el usuario** | `/refresh` devuelve `401`; el usuario pulsa *"Reconectar y sincronizar"* una vez (`prompt: 'consent'`) y recupera el `refresh_token`. |
| **Dev local con `npm run dev` (sin Wrangler)** | Al detectar `404`/`405` en `/api/oauth/*`, degrada de forma transparente al flujo `initTokenClient` de 1 hora sin errores bloqueantes. |

---

## 6. Configuración Requerida en Despliegue

1. **Google Cloud Console:**
   - Copiar el **Client Secret** del cliente OAuth 2.0 (*Web application*).
   - Verificar que **Authorized JavaScript origins** incluya el dominio de Cloudflare Pages (p. ej. `https://<proyecto>.pages.dev` o dominio propio) y orígenes locales (`http://localhost:5173`, `http://localhost:8788`).
   - En **OAuth consent screen**, cambiar **Publishing status** de *Testing* a **In Production** para eliminar la caducidad de 7 días de los `refresh_token` (los scopes `drive.appdata` y `drive.file` no requieren auditoría CASA).
2. **Cloudflare Pages:**
   - Añadir las variables `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `OAUTH_COOKIE_SECRET` en *Environment variables* (Production y Preview).
   - Para pruebas locales completas: archivo `app/.dev.vars` + `npx wrangler pages dev -- npm run dev`.

---

## 7. Estrategia de Verificación y Pruebas

1. **Pruebas unitarias de Cloudflare Functions (Vitest en entorno Node):**
   - `_shared`: cifrado/descifrado AES-256-GCM (roundtrip válido, rechazo de cookie alterada/corrupta, clave distinta), atributos de cookie (`Secure` en HTTPS vs HTTP local, `Max-Age=0` al limpiar) y validación `Origin` / `Sec-Fetch-Site` / método `POST`.
   - `exchange`, `refresh` y `logout` con `fetch` mockeado: obtención y cifrado de `refresh_token`, preservación de `rt` previo si Google omite `refresh_token`, rotación de `refresh_token`, `invalid_grant` limpiando cookie (`401`), error `5xx` preservando cookie (`502`), y respuesta `500` si faltan variables de entorno.
2. **Pruebas unitarias del cliente (Vitest):**
   - `ensureValidAccessToken()`: reutilización de token vigente, *single-flight* ante llamadas simultáneas, manejo de `401`, degradación en `404` y comportamiento offline.
   - `fetchGoogleUserEmail()`: fallback a `drive/v3/about` si falla `/userinfo`.
   - Reintento único ante `401` en `useGoogleSync` y apertura con auto-refresco en `GoogleDocsExportModal`.
3. **Verificación integral:**
   - `npm test`, `npm run lint` y `npm run build` (`tsc -b && vite build`) sin errores, incluyendo comprobación de tipos TypeScript sobre `app/functions/`.
   - Prueba manual de integración con `wrangler pages dev` (o deploy preview de Cloudflare Pages) verificando cookie `HttpOnly`, refresco silencioso tras caducidad forzada del `access_token` local y desconexión explícita.
