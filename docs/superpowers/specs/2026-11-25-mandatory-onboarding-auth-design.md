# Diseño: Configuración Inicial Obligatoria de Autenticación en LoginView

**Fecha:** 2026-11-25  
**Base:** `master` (`v1.3.0`)  
**Rama:** `feat/mandatory-onboarding-auth`

---

## 1. Objetivo y Alcance

Eliminar los accesos de demostración abiertos (`PIN 1234`, pestaña `Credenciales` y botón `Ingreso directo — Urgencias (Sin red)`) en terminales nuevos o restablecidos, reemplazándolos por una **configuración inicial obligatoria en 1 paso directamente dentro de `LoginView`** antes del primer ingreso al Dashboard. Además, el inicio de sesión con **Google (`ownerEmail`)** pasa a contar como protección configurada al igual que un PIN personalizado o una Passkey FIDO2.

---

## 2. Reglas del Modelo de Seguridad (`auth.ts` y `useAuth.ts`)

### 2.1 Qué cuenta como equipo protegido (`isProtectionConfigured`)
En [app/src/domain/auth.ts](app/src/domain/auth.ts), `isProtectionConfigured(profile)` devuelve `true` si existe **al menos uno** de los tres mecanismos:
```ts
profile.pinRecord !== null ||
profile.passkeys.length > 0 ||
Boolean(profile.ownerEmail && profile.ownerEmail.trim().length > 0)
```
Consecuencia:
- Si en `v1.3.0` un usuario solo vinculó Google (`ownerEmail` guardado sin PIN ni passkey), ahora `protectionConfigured` pasa automáticamente a `true`, impidiendo cualquier bypass y exigiendo esa misma cuenta Google (o un restablecimiento explícito del terminal local) para desbloquear.
- En equipos nuevos o tras `resetLocalTerminalSecurity()`, los tres campos son vacíos/nulos (`protectionConfigured = false`), activando el flujo obligatorio de configuración inicial.

### 2.2 Migración y rechazo de accesos demo en `useAuth.ts`
- **PIN legado `sindecon_saved_pin`:**
  - Si vale `'1234'` (`DEFAULT_PIN`): `ensureLegacyPinMigrated` lo elimina sin crear `pinRecord`, dejando `protectionConfigured = false` (el usuario debe configurar un método real la próxima vez).
  - Si tiene un PIN personalizado válido de 4 o 6 dígitos (`!== '1234'`): migra a `PinRecord v2` (`PBKDF2-SHA256`, `150_000` iteraciones), por lo que `protectionConfigured = true` y muestra el teclado de desbloqueo normal.
- **Cierre de vías demo en el controlador (`createAuthController`):**
  - `loginWithPin`: si `!profile.pinRecord`, ya NO acepta `DEFAULT_PIN ('1234')` cuando `!protectionConfigured`; exige configurar un PIN inicial o usar el método activo.
  - `loginWithCredentials` y `loginOfflineEmergency`: devuelven `{ success: false, error: 'El acceso de demostración fue deshabilitado. Configura Google, PIN o Passkey.' }` en todos los estados.

### 2.3 Acciones exclusivas de primer arranque en `useAuth.ts`
Para permitir que el usuario configure su primer PIN o FIDO2 desde `LoginView` cuando aún no existe sesión (`user === null`) **sin abrir una vulnerabilidad de sobrescritura en equipos ya bloqueados**, el controlador expone:

1. `setupInitialPin(newPin: string): Promise<{ success: boolean; error?: string; user?: AuthUser }>`
   - **Guarda estricta:** si `isProtectionConfigured(profile)` o `hasPendingCustomLegacyPin(storage, profile)` es `true` (o si `ensureLegacyPinMigrated()` ya encuentra protección), rechaza de inmediato con `{ success: false, error: 'El terminal ya está protegido. Ingresa para cambiar el PIN.' }`.
   - Valida `isValidPinFormat(newPin)` (`4` o `6` dígitos numéricos).
   - Deriva `pinRecord = await hashPin(newPin)`, limpia `SAVED_PIN_KEY`, persiste `DeviceSecurityProfile` en `localStorage` + `db.meta` y autentica con `createPinUser()`.

2. `registerInitialPasskey(label?: string): Promise<{ success: boolean; error?: string; passkey?: StoredPasskey; user?: AuthUser }>`
   - **Guarda estricta:** misma validación que `setupInitialPin`; si ya existe protección configurada/legada pendiente, rechaza de inmediato sin invocar `registerPasskey`.
   - Ejecuta `registerPasskey({ label: label?.trim() || 'Huella / Face ID de este equipo', ... })` (híbrido online/offline).
   - Si tiene éxito, guarda la passkey en `DeviceSecurityProfile`, persiste el perfil y autentica con `createFidoUser({ id: passkey.credentialId, name: passkey.label })`.

3. `completeGoogleLogin(profile, opts)`:
   - Sin cambios en la interfaz; cuando `!protectionConfigured`, fija `ownerEmail`, `ownerName`, `ownerSub` y `ownerAvatarUrl` (activando `isProtectionConfigured = true`) y autentica al usuario de inmediato.

*(Nota sobre concurrencia: `setupInitialPin` y `registerInitialPasskey` deben leer el perfil más reciente después de `await ensureLegacyPinMigrated()` y `await hydrateFromMirror()` antes de aceptar el alta inicial, evitando que una hidratación asíncrona desde `db.meta` sea pisada en equipos con protección preexistente en IndexedDB).*

---

## 3. Flujo de Interfaz en `LoginView.tsx` y `App.tsx`

### 3.1 Estado `!protectionConfigured` ("Protege tu estación clínica")
Cuando `protectionConfigured === false`, [LoginView.tsx](app/src/components/auth/LoginView.tsx) NO renderiza pestañas (`PIN de Guardia` / `Credenciales`), NO muestra teclado con pista `1234`, y NO renderiza `Ingreso directo — Urgencias (Sin red)`. En su lugar muestra el asistente en 1 paso:

1. **Cabecera:** subtítulo `"Configura tu acceso inicial"` y selector de tema día/noche.
2. **Banner de error (`role="alert"`):** muestra errores de validación, fallo de FIDO o rechazo de Google.
3. **Opción 1 — Google:** botón `"Continuar con Google"` (`data-testid="google-login-btn"`).
4. **Opción 2 — Crear PIN de guardia (offline-first):**
   - Selector de longitud `4 dígitos` / `6 dígitos`.
   - Inputs numéricos `inputMode="numeric"` con `type="password"`: `data-testid="setup-pin-input"` y `data-testid="setup-pin-confirm-input"`.
   - Botón `"Guardar PIN e ingresar"` (`data-testid="setup-pin-submit-btn"`), validando longitud exacta y coincidencia antes de invocar `setupInitialPin`.
5. **Opción 3 — Passkey FIDO2:**
   - Botón `"Registrar Huella / Passkey FIDO2"` (`data-testid="setup-fido-btn"`).
   - Si `!isWebAuthnSupported()`, se muestra deshabilitado con texto aclaratorio corto (`"Navegador sin soporte FIDO2 o sin contexto HTTPS"`).

### 3.2 Estado `protectionConfigured = true` (Pantalla de bloqueo)
- Conserva teclado PIN de `4` o `6` puntos cuando `pinEnabled` es `true`, cuenta regresiva en vivo de `lockedUntil`, botón de desbloqueo FIDO2 cuando `hasPasskeys` es `true`, `"Continuar con Google"` y recuperación (`"¿Olvidaste tu PIN? Recuperar con Google"` o `"Restablecer terminal local"`).
- **Caso Google-only (`!pinEnabled && !hasPasskeys && ownerEmail`):** muestra tarjeta informativa clara (`"Terminal protegido con cuenta Google (${ownerEmail}). Inicia sesión con Google para ingresar o añade PIN/Passkey en Seguridad."`) en lugar del bloque de teclado vacío.

### 3.3 Conexión en `App.tsx` y Props de `LoginView`
- `LoginViewProps` añade `onSetupInitialPin?: (newPin: string) => Promise<{ success: boolean; error?: string; user?: AuthUser }>` y `onRegisterInitialPasskey?: (label?: string) => Promise<{ success: boolean; error?: string; user?: AuthUser }>` (con fallback interno a `useAuth` cuando no se pasan por props, facilitando pruebas SSR aisladas).
- `App.tsx` conecta `onSetupInitialPin={setupInitialPin}` y `onRegisterInitialPasskey={registerInitialPasskey}`, limpiando `googleLoginError` antes de ejecutarlas y mostrando el toast de bienvenida tras autenticar.
- Las props heredadas opcionales (`onCredentialsSubmit`, `onOfflineAccess`) se mantienen en el tipo `LoginViewProps` únicamente para compatibilidad de firma si alguna prueba de contrato las referencia, pero dejan de renderizarse y no permiten el ingreso desde la UI.

---

## 4. Estrategia de Pruebas

1. **`app/src/domain/auth.test.ts`:**
   - Verificar `isProtectionConfigured({ ...empty, ownerEmail: 'doc@hospital.cl' }) === true` (y `false` con strings en blanco).
   - Verificar `canGoogleUnlockDevice` cuando solo `ownerEmail` está configurado (permite al dueño y bloquea a terceros con `'owner_mismatch'`).
2. **`app/src/hooks/useAuth.test.ts`:**
   - `setupInitialPin` y `registerInitialPasskey` funcionan cuando el equipo está vacío y autentican al instante.
   - Ambas acciones **rechazan** si ya existe PIN, passkey, `ownerEmail`, mirror protegido en IndexedDB o PIN legado personalizado en `SAVED_PIN_KEY`.
   - `loginWithPin('1234')`, `loginWithCredentials` y `loginOfflineEmergency` devuelven `success: false` sin autenticar.
3. **`app/src/components/auth/LoginView.test.ts`:**
   - En SSR con `protectionConfigured = false`: verifica que renderiza `Configura tu acceso inicial`, `setup-pin-input`, `setup-fido-btn`, `google-login-btn`, y **no** contiene `1234`, `Credenciales` ni `Urgencias`.
   - En SSR con `protectionConfigured = true`: casos con PIN (`6` puntos), FIDO-only y Google-only (`!pinEnabled && !hasPasskeys && ownerEmail`).
4. **`app/e2e/auth-fido-pin.spec.ts`:**
   - En navegador real Chromium con CDP Virtual Authenticator (`ctap2`):
     1. Verifica en primer arranque que no existe `1234` ni `Urgencias`, crea un PIN de 6 dígitos (`482910`) desde el formulario inicial de `LoginView` y entra directo al Dashboard.
     2. Abre `Seguridad`, registra la passkey FIDO2 virtual y cierra el modal.
     3. Bloquea, verifica persistencia al recargar, provoca bloqueo tras 5 intentos fallidos (`000000`), verifica persistencia del bloqueo al recargar, desbloquea con FIDO2 offline y confirma ingreso con el PIN `482910`.
