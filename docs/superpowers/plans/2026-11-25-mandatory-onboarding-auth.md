# Configuración Inicial Obligatoria de Autenticación en LoginView — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar permanentemente los accesos demo abiertos (`PIN 1234`, `Credenciales`, `Urgencias`), considerar `ownerEmail` (Google) como protección activa, e implementar un asistente obligatorio en 1 paso directamente dentro de `LoginView` para configurar Google, PIN (`PBKDF2-SHA256`) o Passkey FIDO2 antes del primer ingreso.

**Architecture:** `isProtectionConfigured(profile)` en `app/src/domain/auth.ts` se amplía para incluir `ownerEmail`. En `app/src/hooks/useAuth.ts`, se cierran los ingresos demo (`1234`, `loginWithCredentials`, `loginOfflineEmergency`) y se añaden las acciones exclusivas de primer arranque `setupInitialPin` y `registerInitialPasskey` con guarda estricta anti-sobrescritura (tras `hydrateFromMirror` + `ensureLegacyPinMigrated` y re-validación post-async contra IndexedDB/`localStorage`). `LoginView.tsx` muestra el asistente en 1 paso cuando `!protectionConfigured` y el bloqueo estricto habitual cuando `protectionConfigured = true` (incluyendo tarjeta específica cuando solo existe `ownerEmail`).

**Tech Stack:** TypeScript 6 (`verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals`, `noUnusedParameters`), React 19, Vite 8, Vitest (`environment: 'node'`, SSR vía `react-dom/server`), Playwright CDP Virtual Authenticator (`ctap2`), Oxlint.

**Spec:** `docs/superpowers/specs/2026-11-25-mandatory-onboarding-auth-design.md`

## Global Constraints

- **Sin bypass demo:** Deshabilitar permanentemente PIN `1234`, pestaña `Credenciales` y botón `Ingreso directo — Urgencias (Sin red)` en UI y controlador (`useAuth`).
- **`ownerEmail` protege el equipo:** `isProtectionConfigured(profile)` es `true` cuando `pinRecord !== null || passkeys.length > 0 || Boolean(profile.ownerEmail?.trim())`.
- **Guarda estricta en primer arranque:** `setupInitialPin` y `registerInitialPasskey` deben esperar `hydrateFromMirror()` + `ensureLegacyPinMigrated()`, verificar `!isProtectionConfigured(profile) && !hasPendingCustomLegacyPin(...)`, y re-validar antes de persistir tras cualquier `await` (TOCTOU safe) para impedir sobrescrituras en equipos ya protegidos.
- **TypeScript 6 estricto & Oxlint limpio:** Sin variables/importaciones sin usar (`noUnusedLocals`, `noUnusedParameters`), sin `enum`, `import type` explícito, `0` errores y `0` warnings nuevos en los archivos modificados.
- **Vitest en Node (`environment: 'node'`):** Sin `jsdom`; pruebas de UI usan `renderToStaticMarkup` y pruebas de hook inyectan `StorageLike`/`SecurityMirrorStore`.
- **Git atómico:** Cada tarea cierra con tests en verde y `git add <archivos específicos>` + `git commit`.

---

## Mapa de Archivos

| Archivo | Responsabilidad |
| :--- | :--- |
| `app/src/domain/auth.ts`, `app/src/domain/auth.test.ts` | Ampliar `isProtectionConfigured` con `ownerEmail` y limpiar validación de whitespace en `canGoogleUnlockDevice`. |
| `app/src/hooks/useAuth.ts`, `app/src/hooks/useAuth.test.ts` | Cerrar demo `1234`/`credentials`/`offline`, agregar `setupInitialPin` y `registerInitialPasskey` con guardas estrictas post-hidratación/TOCTOU, y adaptar/ampliar pruebas. |
| `app/src/components/auth/LoginView.tsx`, `LoginView.test.ts`, `app/src/App.tsx` | Vista onboarding **"Protege tu estación clínica"** cuando `!protectionConfigured`, tarjeta Google-only cuando `!pinEnabled && !hasPasskeys && ownerEmail`, limpieza de JSX/handlers demo y conexión de `onSetupInitialPin` / `onRegisterInitialPasskey`. |
| `app/e2e/auth-fido-pin.spec.ts` | Flujo E2E actualizado: ausencia de `1234`/`Urgencias`/`Credenciales`, alta de PIN 6 dígitos directo en onboarding, registro FIDO2 en `Seguridad`, lockout persistente y desbloqueo biométrico offline + PIN. |

---

### Task 1: Reglas de Protección con `ownerEmail` y Guardas de Primer Arranque (`auth.ts`, `useAuth.ts`)

**Files:**
- Modify: `app/src/domain/auth.ts:57-78`
- Modify: `app/src/domain/auth.test.ts:92-142`
- Modify: `app/src/hooks/useAuth.ts:1-35,450-752`
- Modify: `app/src/hooks/useAuth.test.ts:137-574`

**Interfaces:**
- Consumes: `hashPin`, `isValidPinFormat`, `evaluatePinAttempt`, `verifyPinHash` (`pinAuth.ts`), `registerPasskey`, `authenticateWithPasskey` (`fidoAuth.ts`).
- Produces:
  - `isProtectionConfigured(profile)` (`auth.ts`): `true` si hay `pinRecord`, `passkeys.length > 0` o `ownerEmail?.trim()`.
  - `useAuth()` / `createAuthController()` (`useAuth.ts`):
    - `setupInitialPin(newPin: string): Promise<PinLoginResult>`
    - `registerInitialPasskey(label?: string): Promise<{ success: boolean; error?: string; passkey?: StoredPasskey; user?: AuthUser }>`
    - `loginWithPin`, `loginWithCredentials`, `loginOfflineEmergency` bloqueando ingresos demo.

- [ ] **Step 1: Actualizar pruebas en `auth.test.ts` y `useAuth.test.ts` que fallan antes de implementar (RED)**

En `app/src/domain/auth.test.ts`, dentro del bloque `describe('DeviceSecurityProfile y reglas de propiedad Google', ...)`:
1. Reemplazar el test `'considera protectionConfigured=false en perfil vacío/nulo y true con PIN o FIDO'` agregando validación de `ownerEmail`:
```typescript
  it('considera protectionConfigured=false en perfil vacío/nulo o ownerEmail en blanco, y true con PIN, FIDO o Google ownerEmail', async () => {
    expect(isProtectionConfigured(null)).toBe(false)
    expect(isProtectionConfigured(undefined)).toBe(false)

    const empty = createEmptySecurityProfile()
    expect(isProtectionConfigured(empty)).toBe(false)
    expect(isProtectionConfigured({ ...empty, ownerEmail: '   ' })).toBe(false)

    expect(isProtectionConfigured({ ...empty, ownerEmail: 'doc@hospital.cl' })).toBe(true)

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
```
2. En el test `'restringe desbloqueo Google al correo dueño...'`, añadir verificación para equipo protegido solo con Google (`ownerEmail` sin PIN ni passkey):
```typescript
    const protectedGoogleOnly = {
      ...empty,
      ownerEmail: 'Dra.Martinez@gmail.com',
    }
    expect(canGoogleUnlockDevice('dra.martinez@gmail.com', protectedGoogleOnly)).toEqual({ allowed: true })
    expect(canGoogleUnlockDevice('intruso@gmail.com', protectedGoogleOnly)).toEqual({
      allowed: false,
      reason: 'owner_mismatch',
    })
```

En `app/src/hooks/useAuth.test.ts`:
1. Reemplazar el primer test `'mantiene modo demo sin protección cuando sindecon_saved_pin es 1234 y valida credenciales/urgencias'` por:
```typescript
  it('limpia sindecon_saved_pin 1234 sin proteger el terminal y rechaza ingresos demo (1234, credentials, offline)', async () => {
    const storage = makeMemoryStorage({ [SAVED_PIN_KEY]: '1234' })
    const auth = createAuthController({ storage })

    expect(auth.getState().protectionConfigured).toBe(false)

    const demoPin = await auth.loginWithPin('1234')
    expect(demoPin.success).toBe(false)
    expect(storage.getItem(SAVED_PIN_KEY)).toBeNull()
    expect(storage.getItem(AUTH_USER_KEY)).toBeNull()

    const credRes = auth.loginWithCredentials('valenzuela@hospital.cl', 'clave123')
    expect(credRes.success).toBe(false)

    const offlineRes = auth.loginOfflineEmergency()
    expect(offlineRes.success).toBe(false)
  })
```
2. En todos los tests existentes que hacían `await auth.loginWithPin('1234')` + `setupOrChangePin` / `registerDevicePasskey` (líneas ~192, ~286, ~309, ~387, ~500, ~534), migrar ese paso inicial a `setupInitialPin(...)` / `registerInitialPasskey(...)` según corresponda:
   - Lockout test (línea ~192): `const setupRes = await auth.setupInitialPin('482910')` y verificar `setupRes.success === true` y `setupRes.user?.method === 'pin'`.
   - Test recuperación Google (línea ~274): tras `auth.removePin()` sobre una cuenta que **mantiene `ownerEmail`**, actualizar expectativa a `expect(auth.getState().protectionConfigured).toBe(true)` (porque `ownerEmail` sigue protegiendo el dispositivo).
   - Test Google local-only (línea ~286): usar `await auth.setupInitialPin('4829')` tras verificar que `setupInitialPin('12a4')` falla con formato inválido.
   - Test FIDO passkey (línea ~309): usar `await auth.setupInitialPin('4829')` y luego `await auth.registerDevicePasskey('Huella Guardia')`.
   - Test Node sin IndexedDB (línea ~387): usar `await auth.setupInitialPin('5678')`.
   - Test `removePin` orden (línea ~500): usar `await authNotify.setupInitialPin('4321')`.
   - Test FIDO-only (línea ~534): usar `await authFidoOnly.registerInitialPasskey('Solo Huella')`.
3. Añadir un nuevo test dedicado a las guardas estrictas de primer arranque en `useAuth.test.ts`:
```typescript
  it('permite setupInitialPin/registerInitialPasskey solo sin protección previa (incluyendo mirror y Google owner) y bloquea sobrescritura al bloquear', async () => {
    // 1. setupInitialPin falla si ya hay protección en localStorage o mirror IndexedDB
    const storageMirror = makeMemoryStorage()
    const protectedMirror = makeMemoryMirror({
      version: 1,
      ownerEmail: 'dueno@hospital.cl',
      ownerName: 'Dueño',
      ownerSub: 'sub-1',
      ownerAvatarUrl: null,
      pinRecord: null,
      passkeys: [],
      updatedAt: Date.now(),
    })
    const authMirror = createAuthController({ storage: storageMirror, mirror: protectedMirror })
    const blockedByMirror = await authMirror.setupInitialPin('482910')
    expect(blockedByMirror.success).toBe(false)
    expect(authMirror.getState().isAuthenticated).toBe(false)

    // 2. Equipo vacío: setupInitialPin protege e inicia sesión, y bloquea segundo setupInitialPin tras logout
    const storagePin = makeMemoryStorage()
    const authPin = createAuthController({ storage: storagePin })
    const initPin = await authPin.setupInitialPin('592014')
    expect(initPin.success).toBe(true)
    expect(initPin.user?.method).toBe('pin')
    expect(authPin.getState().isAuthenticated).toBe(true)
    expect(authPin.getState().protectionConfigured).toBe(true)
    authPin.logout()

    expect((await authPin.setupInitialPin('9999')).success).toBe(false)
    expect((await authPin.registerInitialPasskey('Atacante')).success).toBe(false)

    // 3. Equipo vacío con Passkey inicial
    const storageFido = makeMemoryStorage()
    const { credentialsApi } = await createFakePasskeyCredentials({ credentialId: 'init-fido-1' })
    const authFido = createAuthController({
      storage: storageFido,
      fetchFn: vi.fn(async () => new Response('not found', { status: 404 })) as unknown as typeof fetch,
      credentialsApi,
    })
    const initFido = await authFido.registerInitialPasskey('Huella Turno')
    expect(initFido.success).toBe(true)
    expect(initFido.user?.method).toBe('fido')
    expect(authFido.getState().protectionConfigured).toBe(true)
    authFido.logout()

    expect((await authFido.setupInitialPin('1122')).success).toBe(false)
    expect((await authFido.registerInitialPasskey('Otra')).success).toBe(false)
  })
```

- [ ] **Step 2: Ejecutar pruebas para confirmar fallas esperadas (RED)**

Run: `cd app; npx vitest run src/domain/auth.test.ts src/hooks/useAuth.test.ts`
Expected: FAIL (`isProtectionConfigured` returns `false` for `ownerEmail`-only, `setupInitialPin` / `registerInitialPasskey` are not functions, `1234` still returns `true`).

- [ ] **Step 3: Implementar cambios en `app/src/domain/auth.ts` y `app/src/hooks/useAuth.ts`**

En `app/src/domain/auth.ts` (`lines 57-78`):
```typescript
/** True cuando el equipo tiene PIN personalizado, passkey FIDO2 o cuenta Google vinculada. */
export function isProtectionConfigured(profile: DeviceSecurityProfile | null | undefined): boolean {
  if (!profile) return false
  return (
    profile.pinRecord !== null ||
    profile.passkeys.length > 0 ||
    Boolean(profile.ownerEmail?.trim())
  )
}

/** Controla qué cuenta Google puede desbloquear o recuperar este equipo. */
export function canGoogleUnlockDevice(
  incomingEmail: string,
  profile: DeviceSecurityProfile | null | undefined,
): { allowed: boolean; reason?: 'owner_mismatch' | 'local_protection_no_google' } {
  if (!isProtectionConfigured(profile)) {
    return { allowed: true }
  }
  const owner = profile?.ownerEmail?.trim()
  if (!owner) {
    return { allowed: false, reason: 'local_protection_no_google' }
  }
  if (incomingEmail.trim().toLowerCase() === owner.toLowerCase()) {
    return { allowed: true }
  }
  return { allowed: false, reason: 'owner_mismatch' }
}
```

En `app/src/hooks/useAuth.ts`:
1. Retirar `createOfflineEmergencyUser` y `validateCredentials` del `import ... from '../domain/auth'` (para cumplir `noUnusedLocals`).
2. Reemplazar `loginWithPin`, `loginWithCredentials`, `loginOfflineEmergency`:
```typescript
  const loginWithPin = async (inputPin: string): Promise<PinLoginResult> => {
    const profile = await ensureLegacyPinMigrated()
    if (profile.pinRecord) {
      const attempt = await evaluatePinAttempt(inputPin.trim(), profile.pinRecord)
      persistProfile({ ...profile, pinRecord: attempt.nextRecord })
      if (!attempt.ok) {
        return { success: false, error: attempt.error, lockedUntil: attempt.nextRecord.lockedUntil }
      }
      const user = createPinUser()
      persistUser(user)
      return { success: true, user }
    }

    if (isProtectionConfigured(profile)) {
      return {
        success: false,
        error: 'El ingreso por PIN está deshabilitado. Usa tu llave FIDO o Google.',
      }
    }

    return {
      success: false,
      error: 'Configura primero un PIN, Passkey FIDO o cuenta Google para ingresar.',
    }
  }

  const loginWithCredentials = (
    _username: string,
    _password: string,
  ): { success: boolean; error?: string; user?: AuthUser } => ({
    success: false,
    error: 'El acceso de demostración fue deshabilitado. Configura Google, PIN o Passkey.',
  })

  const loginOfflineEmergency = (): { success: boolean; error?: string; user?: AuthUser } => ({
    success: false,
    error: 'El acceso de demostración fue deshabilitado. Configura Google, PIN o Passkey.',
  })
```
*(Asegurar guion bajo `_username`, `_password` para `noUnusedParameters: true`)*.

3. Añadir `setupInitialPin` y `registerInitialPasskey` justo junto a `setupOrChangePin` / `registerDevicePasskey`:
```typescript
  const setupInitialPin = async (newPin: string): Promise<PinLoginResult> => {
    if (!isValidPinFormat(newPin)) {
      return { success: false, error: 'El PIN debe tener exactamente 4 o 6 dígitos numéricos.' }
    }
    await hydrateFromMirror()
    const profile = await ensureLegacyPinMigrated()
    if (isProtectionConfigured(profile) || hasPendingCustomLegacyPin(storage, profile)) {
      return { success: false, error: 'El terminal ya está protegido. Ingresa para cambiar el PIN.' }
    }

    const nextRecord = await hashPin(newPin)
    const latest = readSecurityProfile(storage)
    if (isProtectionConfigured(latest) || hasPendingCustomLegacyPin(storage, latest)) {
      return { success: false, error: 'El terminal ya está protegido. Ingresa para cambiar el PIN.' }
    }

    safeRemoveItem(storage, SAVED_PIN_KEY)
    persistProfile({ ...latest, pinRecord: nextRecord })
    const user = createPinUser()
    persistUser(user)
    return { success: true, user }
  }

  const registerInitialPasskey = async (
    label?: string,
  ): Promise<{ success: boolean; error?: string; passkey?: StoredPasskey; user?: AuthUser }> => {
    await hydrateFromMirror()
    const profile = await ensureLegacyPinMigrated()
    if (isProtectionConfigured(profile) || hasPendingCustomLegacyPin(storage, profile)) {
      return {
        success: false,
        error: 'El terminal ya está protegido. Ingresa para registrar otra passkey.',
      }
    }

    const res = await registerPasskey({
      label: label?.trim() || 'Huella / Face ID de este equipo',
      ownerEmail: null,
      ownerSub: null,
      displayName: 'Médico SINDECON',
      fetchFn,
      credentialsApi: deps.credentialsApi,
    })
    if (!res.ok) return { success: false, error: res.error }

    const latest = readSecurityProfile(storage)
    if (isProtectionConfigured(latest) || hasPendingCustomLegacyPin(storage, latest)) {
      return {
        success: false,
        error: 'El terminal ya está protegido. Ingresa para registrar otra passkey.',
      }
    }

    persistProfile({ ...latest, passkeys: [res.passkey] })
    const user = createFidoUser({ id: res.passkey.credentialId, name: res.passkey.label })
    persistUser(user)
    return { success: true, passkey: res.passkey, user }
  }
```
4. Exportar `setupInitialPin` y `registerInitialPasskey` en el objeto devuelto por `createAuthController` y por `useAuth()`.

- [ ] **Step 4: Ejecutar pruebas, typecheck y lint (GREEN)**

Run: `cd app; npx vitest run src/domain/auth.test.ts src/hooks/useAuth.test.ts; if ($LASTEXITCODE -eq 0) { npx tsc -b; if ($LASTEXITCODE -eq 0) { npx oxlint src/domain/auth.ts src/domain/auth.test.ts src/hooks/useAuth.ts src/hooks/useAuth.test.ts } }`
Expected: PASS (`0` errores TS6, `0` warnings/errors en Oxlint).

- [ ] **Step 5: Commit**

```bash
git add app/src/domain/auth.ts app/src/domain/auth.test.ts app/src/hooks/useAuth.ts app/src/hooks/useAuth.test.ts
git commit -m "feat(auth): treat ownerEmail as protected and add strict initial PIN/FIDO onboarding actions"
```

---

### Task 2: Interfaz Onboarding en 1 Paso en `LoginView.tsx` y Conexión en `App.tsx`

**Files:**
- Modify: `app/src/components/auth/LoginView.tsx:1-650`
- Modify: `app/src/components/auth/LoginView.test.ts:52-144`
- Modify: `app/src/App.tsx:123-146,765-808`

**Interfaces:**
- Consumes: `setupInitialPin`, `registerInitialPasskey`, `completeGoogleLogin`, `loginWithPin`, `loginWithFido`, `resetLocalTerminalSecurity` (`useAuth.ts`).
- Produces:
  - `LoginViewProps` actualizado con `onSetupInitialPin` y `onRegisterInitialPasskey`.
  - Onboarding `!protectionConfigured` con `data-testid="google-login-btn"`, `data-testid="setup-pin-input"`, `data-testid="setup-pin-confirm-input"`, `data-testid="setup-pin-submit-btn"`, `data-testid="setup-fido-btn"`.
  - Tarjeta Google-only en estado bloqueado (`protectionConfigured && !pinEnabled && !hasPasskeys && ownerEmail`).

- [ ] **Step 1: Actualizar pruebas SSR en `app/src/components/auth/LoginView.test.ts` (RED)**

Reemplazar el bloque `describe('LoginView Component & Lock Screen Rules', ...)` en `app/src/components/auth/LoginView.test.ts`:
```typescript
describe('LoginView Component & Lock Screen Rules', () => {
  it('muestra configuración inicial obligatoria sin 1234, Credenciales ni Urgencias cuando protectionConfigured=false', () => {
    const html = renderToStaticMarkup(
      createElement(LoginView, {
        protectionConfigured: false,
        pinEnabled: true,
        pinLength: 4,
        hasPasskeys: false,
      }),
    )
    expect(html).toContain('Configura tu acceso inicial')
    expect(html).toContain('Protege tu estación clínica')
    expect(html).toContain('data-testid="setup-pin-input"')
    expect(html).toContain('data-testid="setup-pin-confirm-input"')
    expect(html).toContain('data-testid="setup-pin-submit-btn"')
    expect(html).toContain('data-testid="setup-fido-btn"')
    expect(html).toContain('data-testid="google-login-btn"')
    expect(html).not.toContain('1234')
    expect(html).not.toContain('Credenciales')
    expect(html).not.toContain('Urgencias')
    expect(html).not.toContain('data-testid="pin-dot"')
  })

  it('muestra pantalla de bloqueo con 6 puntos, FIDO y recuperación Google cuando protectionConfigured=true', () => {
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
    expect(html).not.toContain('setup-pin-input')
    expect(html).toContain('Continuar con Google')
    expect(html).toContain('Huella')
    expect(html).toContain('Recuperar con Google')
    expect(html.match(/data-testid="pin-dot"/g)?.length).toBe(6)
  })

  it('muestra tarjeta informativa Google-only cuando protectionConfigured=true sin PIN ni Passkey', () => {
    const html = renderToStaticMarkup(
      createElement(LoginView, {
        protectionConfigured: true,
        pinEnabled: false,
        pinLength: 4,
        hasPasskeys: false,
        ownerEmail: 'dra.martinez@gmail.com',
      }),
    )
    expect(html).toContain('dra.martinez@gmail.com')
    expect(html).toContain('data-testid="google-login-btn"')
    expect(html).not.toContain('data-testid="pin-dot"')
  })

  it('muestra aviso de bloqueo temporal y deshabilita dígitos cuando lockedUntil está en el futuro', () => {
    const html = renderToStaticMarkup(
      createElement(LoginView, {
        protectionConfigured: true,
        pinEnabled: true,
        pinLength: 4,
        hasPasskeys: true,
        lockedUntil: Date.now() + 25_000,
      }),
    )
    expect(html).toContain('Bloqueo temporal activo')
    expect(html).toContain('data-testid="reset-local-terminal-btn"')
  })
```

- [ ] **Step 2: Ejecutar test para confirmar que falla (RED)**

Run: `cd app; npx vitest run src/components/auth/LoginView.test.ts`
Expected: FAIL (`setup-pin-input` y `Configura tu acceso inicial` ausentes, aún renderiza `1234`/`Credenciales`/`Urgencias`).

- [ ] **Step 3: Implementar `LoginView.tsx` y conectar `App.tsx`**

En `app/src/components/auth/LoginView.tsx`:
1. Limpiar imports no usados (`WifiOff` y `DEFAULT_PIN`; conservar `KeyRound` para sección `"Crear PIN de guardia"`).
2. Ampliar `LoginViewProps` (manteniendo `onOfflineAccess` y `onCredentialsSubmit` opcionales en la interface para no romper tests de contrato, sin desestructurarlos en el cuerpo de la función para cumplir `noUnusedParameters`):
```typescript
export interface LoginViewProps {
  onLoginSuccess?: (user: AuthUser) => void
  onGoogleSignIn?: () => void
  onOfflineAccess?: () => { success: boolean; error?: string; user?: AuthUser } | void
  onRecoverWithGoogle?: () => void
  onResetTerminal?: () => Promise<void> | void
  onPinSubmit?: (
    pin: string,
  ) => Promise<{ success: boolean; error?: string; lockedUntil?: number | null; user?: AuthUser }>
  onFidoLogin?: () => Promise<{ success: boolean; error?: string; user?: AuthUser }>
  onSetupInitialPin?: (
    newPin: string,
  ) => Promise<{ success: boolean; error?: string; user?: AuthUser }>
  onRegisterInitialPasskey?: (
    label?: string,
  ) => Promise<{ success: boolean; error?: string; user?: AuthUser }>
  onCredentialsSubmit?: (
    username: string,
    password: string,
  ) => { success: boolean; error?: string; user?: AuthUser }
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
```
3. Reemplazar estado `tab`/`username`/`password` por estado de onboarding:
```typescript
  const [pin, setPin] = useState('')
  const [setupPinLength, setSetupPinLength] = useState<4 | 6>(4)
  const [setupPin, setSetupPin] = useState('')
  const [setupConfirmPin, setSetupConfirmPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [nowMs, setNowMs] = useState(() => Date.now())
```
4. Efecto de teclado físico: ejecutar solo cuando `protectionConfigured && pinEnabled && !confirmReset`.
5. Handlers de onboarding:
```typescript
  const handleSetupPinSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy || protectionConfigured) return
    if (!new RegExp(`^\\d{${setupPinLength}}$`).test(setupPin)) {
      setError(`Ingresa un PIN de exactamente ${setupPinLength} dígitos numéricos.`)
      return
    }
    if (setupPin !== setupConfirmPin) {
      setError('Los dos PIN ingresados no coinciden.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const handler = onSetupInitialPin ?? auth.setupInitialPin
      const res = await handler(setupPin)
      if (!res.success) {
        setError(res.error || 'No se pudo configurar el PIN inicial.')
        return
      }
      setSetupPin('')
      setSetupConfirmPin('')
      if (res.user) onLoginSuccess?.(res.user)
    } finally {
      setBusy(false)
    }
  }

  const handleSetupFido = async () => {
    if (busy || protectionConfigured) return
    setBusy(true)
    setError(null)
    try {
      const handler = onRegisterInitialPasskey ?? auth.registerInitialPasskey
      const res = await handler('Huella / Face ID de este equipo')
      if (!res.success) {
        setError(res.error || 'No se pudo registrar la passkey biométrica.')
        return
      }
      if (res.user) onLoginSuccess?.(res.user)
    } finally {
      setBusy(false)
    }
  }
```
6. En `handleFidoAccess`: retirar el atajo demo `if (!hasPasskeys && !protectionConfigured) await submitPin(DEFAULT_PIN)`.
7. Renderizado condicional limpio en JSX (reemplazando subtítulo, pestañas demo, bloque keypad demo, botones `Urgencias` y formulario `Credenciales`):
```tsx
            <div>
              <h1 className="text-lg font-bold tracking-tight" style={{ color: 'var(--cl-fg)' }}>
                SINDECON
              </h1>
              <p className="text-xs font-medium" style={{ color: 'var(--cl-muted)' }}>
                {protectionConfigured
                  ? 'Terminal clínico protegido'
                  : 'Configura tu acceso inicial'}
              </p>
            </div>
```
y cuando `!protectionConfigured`:
```tsx
        {!protectionConfigured ? (
          <div className="space-y-4">
            <div
              className="rounded-2xl border p-3.5 text-xs"
              style={{
                backgroundColor: 'var(--cl-surface-muted)',
                borderColor: 'var(--cl-border)',
                color: 'var(--cl-fg-2)',
              }}
            >
              <p className="font-semibold mb-1" style={{ color: 'var(--cl-fg)' }}>
                Protege tu estación clínica
              </p>
              <p className="text-[11px]" style={{ color: 'var(--cl-muted)' }}>
                Elige Google, un PIN de guardia o Passkey biométrica antes del primer ingreso.
              </p>
            </div>

            <button
              type="button"
              data-testid="google-login-btn"
              disabled={busy}
              onClick={() => handleGoogleAccess(false)}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-full border text-xs font-semibold transition cursor-pointer disabled:opacity-50"
              style={{
                backgroundColor: 'var(--cl-surface-elevated)',
                borderColor: 'var(--cl-border)',
                color: 'var(--cl-fg)',
              }}
            >
              Continuar con Google
            </button>

            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t" style={{ borderColor: 'var(--cl-border-soft)' }} />
              <span className="mx-3 text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--cl-muted)' }}>
                o acceso offline local
              </span>
              <div className="flex-grow border-t" style={{ borderColor: 'var(--cl-border-soft)' }} />
            </div>

            <form onSubmit={(e) => void handleSetupPinSubmit(e)} className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--cl-fg)' }}>
                  <KeyRound className="h-3.5 w-3.5" style={{ color: 'var(--cl-diagnostic)' }} />
                  Crear PIN de guardia
                </span>
                <div className="flex gap-1">
                  {([4, 6] as const).map((len) => (
                    <button
                      key={len}
                      type="button"
                      onClick={() => {
                        setSetupPinLength(len)
                        setSetupPin('')
                        setSetupConfirmPin('')
                      }}
                      className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold cursor-pointer border"
                      style={
                        setupPinLength === len
                          ? { backgroundColor: 'var(--cl-accent)', borderColor: 'var(--cl-accent)', color: '#ffffff' }
                          : { borderColor: 'var(--cl-border)', color: 'var(--cl-muted)' }
                      }
                    >
                      {len} dígitos
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  data-testid="setup-pin-input"
                  type="password"
                  inputMode="numeric"
                  aria-label={`Nuevo PIN de ${setupPinLength} dígitos`}
                  maxLength={setupPinLength}
                  placeholder={`Nuevo PIN (${setupPinLength})`}
                  value={setupPin}
                  onChange={(e) => setSetupPin(e.target.value.replace(/\D/g, ''))}
                  className="h-10 w-full rounded-xl border px-3 text-xs outline-none"
                  style={{
                    backgroundColor: 'var(--cl-surface-muted)',
                    borderColor: 'var(--cl-border)',
                    color: 'var(--cl-fg)',
                  }}
                />
                <input
                  data-testid="setup-pin-confirm-input"
                  type="password"
                  inputMode="numeric"
                  aria-label="Confirmar PIN inicial"
                  maxLength={setupPinLength}
                  placeholder="Confirmar PIN"
                  value={setupConfirmPin}
                  onChange={(e) => setSetupConfirmPin(e.target.value.replace(/\D/g, ''))}
                  className="h-10 w-full rounded-xl border px-3 text-xs outline-none"
                  style={{
                    backgroundColor: 'var(--cl-surface-muted)',
                    borderColor: 'var(--cl-border)',
                    color: 'var(--cl-fg)',
                  }}
                />
              </div>

              <button
                type="submit"
                data-testid="setup-pin-submit-btn"
                disabled={busy}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-full text-xs font-semibold text-white transition cursor-pointer disabled:opacity-50"
                style={{ backgroundColor: 'var(--cl-accent)' }}
              >
                Guardar PIN e ingresar
              </button>
            </form>

            <div className="space-y-1">
              <button
                type="button"
                data-testid="setup-fido-btn"
                disabled={busy || !webAuthnCapable}
                onClick={() => void handleSetupFido()}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-full border text-xs font-semibold transition cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: 'var(--cl-accent-soft)',
                  borderColor: 'var(--cl-accent-border)',
                  color: 'var(--cl-diagnostic)',
                }}
              >
                <Fingerprint className="h-4 w-4" />
                Registrar Huella / Passkey FIDO2
              </button>
              {!webAuthnCapable && (
                <p className="text-center text-[10px]" style={{ color: 'var(--cl-muted)' }}>
                  Navegador sin soporte FIDO2 o sin contexto HTTPS.
                </p>
              )}
            </div>
          </div>
        ) : (
          /* Bloque normal de desbloqueo con PIN (si pinEnabled), FIDO-only card, o Google-only card */
```
Y para el caso Google-only (`!pinEnabled && !hasPasskeys && ownerEmail` dentro de la rama `protectionConfigured`):
```tsx
            {!pinEnabled && !hasPasskeys && ownerEmail && (
              <div className="mb-4 rounded-2xl border p-4 text-center" style={{ borderColor: 'var(--cl-border)' }}>
                <ShieldCheck className="mx-auto mb-2 h-8 w-8" style={{ color: 'var(--cl-diagnostic)' }} />
                <p className="text-xs font-medium" style={{ color: 'var(--cl-fg-2)' }}>
                  Este equipo está protegido con la cuenta Google {ownerEmail}. Inicia sesión con Google para ingresar.
                </p>
              </div>
            )}
```

En `app/src/App.tsx`:
1. Remover `loginWithCredentials` y `loginOfflineEmergency` del destructure de `useAuth()` (`lines 133-134`), añadiendo `setupInitialPin` y `registerInitialPasskey`.
2. Actualizar `<LoginView ... />` (`lines 765-808`):
   - Quitar props `onCredentialsSubmit` y `onOfflineAccess`.
   - Agregar:
     ```tsx
     onSetupInitialPin={async (newPin) => {
       setGoogleLoginError(null)
       return await setupInitialPin(newPin)
     }}
     onRegisterInitialPasskey={async (label) => {
       setGoogleLoginError(null)
       return await registerInitialPasskey(label)
     }}
     ```

- [ ] **Step 4: Ejecutar pruebas, typecheck y lint (GREEN)**

Run: `cd app; npx vitest run src/components/auth/LoginView.test.ts src/hooks/useAuth.test.ts src/domain/auth.test.ts; if ($LASTEXITCODE -eq 0) { npx tsc -b; if ($LASTEXITCODE -eq 0) { npx oxlint src/components/auth/LoginView.tsx src/components/auth/LoginView.test.ts src/App.tsx } }`
Expected: PASS (`0` errores en TS6, `0` errores en Oxlint y `0` warnings en `LoginView.tsx`/`LoginView.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add app/src/components/auth/LoginView.tsx app/src/components/auth/LoginView.test.ts app/src/App.tsx
git commit -m "feat(ui): enforce 1-step initial auth setup directly in LoginView"
```

---

### Task 3: E2E Actualizado (`auth-fido-pin.spec.ts`) y Validación Integral

**Files:**
- Modify: `app/e2e/auth-fido-pin.spec.ts:1-95`

- [ ] **Step 1: Actualizar `app/e2e/auth-fido-pin.spec.ts` para verificar onboarding obligatorio + bloqueo + FIDO2 virtual**

Actualizar paso 1 en `app/e2e/auth-fido-pin.spec.ts` (líneas `26-49`) reemplazando el antiguo login con `1234` + `emergency-offline-btn` por configuración directa de PIN de 6 dígitos en `LoginView` y luego registro de passkey FIDO2 en `Seguridad`:
```typescript
    // 1. Primer arranque sin bypass: verificar ausencia de 1234/Urgencias y crear PIN inicial de 6 dígitos
    await expect(page.getByTestId('login-screen')).toBeVisible()
    await expect(page.getByTestId('emergency-offline-btn')).toHaveCount(0)
    await expect(page.getByText('Credenciales')).toHaveCount(0)
    await expect(page.getByTestId('setup-pin-input')).toBeVisible()

    await page.getByRole('button', { name: '6 dígitos' }).click()
    await page.getByTestId('setup-pin-input').fill('482910')
    await page.getByTestId('setup-pin-confirm-input').fill('482910')
    await page.getByTestId('setup-pin-submit-btn').click()

    // 2. Ya autenticado en el Dashboard: abrir Seguridad y registrar Passkey FIDO2 virtual
    await expect(page.getByTestId('header-security-btn')).toBeVisible({ timeout: 10000 })
    await page.getByTestId('header-security-btn').click()
    await expect(page.getByTestId('security-settings-modal')).toBeVisible()

    await page.getByTestId('register-passkey-btn').click()
    await expect(page.getByTestId('security-settings-modal')).toContainText('1 registradas')
    await page.getByTestId('security-close-btn').click()
    await expect(page.getByTestId('security-settings-modal')).not.toBeVisible()
```
*(Manteniendo intactos los pasos 3, 4 y 5: bloqueo, persistencia al recargar, lockout tras 5 fallos, desbloqueo con `fido-unlock-btn` y validación posterior con el PIN `482910` — y añadiendo aserción `await expect(page.getByTestId('setup-pin-input')).toHaveCount(0)` tras bloquear).*

- [ ] **Step 2: Ejecutar suite completa, lint, build y E2E**

Run:
```powershell
cd app
npm test
npm run lint
npm run build
npx playwright test e2e/auth-fido-pin.spec.ts --reporter=list
```
Expected: `0` fallos en Vitest, `0` errores en Oxlint (`0` warnings nuevos), `tsc -b && vite build` limpio y Playwright E2E en verde.

- [ ] **Step 3: Commit**

```bash
git add app/e2e/auth-fido-pin.spec.ts
git commit -m "test(e2e): verify mandatory onboarding auth setup and lockout flow"
```
