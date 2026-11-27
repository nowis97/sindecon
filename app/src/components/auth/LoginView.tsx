import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  Activity,
  BookOpen,
  CalendarDays,
  Cloud,
  Delete,
  Fingerprint,
  KeyRound,
  Lock,
  Moon,
  ShieldAlert,
  ShieldCheck,
  Sun,
} from 'lucide-react'
import type { AuthUser } from '../../domain/auth'
import { isWebAuthnSupported } from '../../domain/fidoAuth'
import { useAuth } from '../../hooks/useAuth'
import { initiateGoogleLoginFlow } from '../../pwa/googleAuth'

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

const KEYPAD_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const

export function LoginView({
  onLoginSuccess,
  onGoogleSignIn,
  onRecoverWithGoogle,
  onResetTerminal,
  onPinSubmit,
  onFidoLogin,
  onSetupInitialPin,
  onRegisterInitialPasskey,
  protectionConfigured: protectionConfiguredProp,
  pinEnabled: pinEnabledProp,
  pinLength: pinLengthProp,
  hasPasskeys: hasPasskeysProp,
  lockedUntil: lockedUntilProp,
  ownerEmail: ownerEmailProp,
  externalError,
  theme = 'light',
  onToggleTheme,
}: LoginViewProps) {
  const auth = useAuth()
  const protectionConfigured = protectionConfiguredProp ?? auth.protectionConfigured
  const pinEnabled = pinEnabledProp ?? auth.pinEnabled
  const pinLength = pinLengthProp ?? auth.pinLength
  const hasPasskeys = hasPasskeysProp ?? auth.hasPasskeys
  const lockedUntil = lockedUntilProp !== undefined ? lockedUntilProp : auth.lockedUntil
  const ownerEmail = ownerEmailProp !== undefined ? ownerEmailProp : auth.securityProfile.ownerEmail

  const [pin, setPin] = useState('')
  const [setupPinLength, setSetupPinLength] = useState<4 | 6>(4)
  const [setupPin, setSetupPin] = useState('')
  const [setupConfirmPin, setSetupConfirmPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const visiblePin = pin.slice(0, pinLength)

  const remainingLockSeconds =
    lockedUntil && lockedUntil > nowMs ? Math.ceil((lockedUntil - nowMs) / 1000) : 0
  const isLocked = remainingLockSeconds > 0

  useEffect(() => {
    if (!lockedUntil) return
    const syncTimer = window.setTimeout(() => {
      setNowMs(Date.now())
    }, 0)
    if (lockedUntil <= Date.now()) {
      return () => window.clearTimeout(syncTimer)
    }
    const timer = window.setInterval(() => {
      const current = Date.now()
      setNowMs(current)
      if (current >= lockedUntil) {
        setError(null)
        window.clearInterval(timer)
      }
    }, 1000)
    return () => {
      window.clearTimeout(syncTimer)
      window.clearInterval(timer)
    }
  }, [lockedUntil])

  const displayError = error || externalError

  const submitPin = useCallback(
    async (candidate: string) => {
      if (busy || isLocked) return
      setBusy(true)
      setError(null)
      try {
        const handler = onPinSubmit ?? auth.loginWithPin
        const res = await handler(candidate)
        setNowMs(Date.now())
        if (res.success) {
          setPin('')
          if (res.user) {
            onLoginSuccess?.(res.user)
          }
        } else {
          setPin('')
          setError(res.error || 'PIN incorrecto.')
        }
      } finally {
        setBusy(false)
      }
    },
    [busy, isLocked, onPinSubmit, auth.loginWithPin, onLoginSuccess],
  )

  const handleDigitClick = useCallback(
    (digit: string) => {
      if (busy || isLocked || visiblePin.length >= pinLength) return
      const next = visiblePin + digit
      setPin(next)
      setError(null)
      if (next.length === pinLength) {
        void submitPin(next)
      }
    },
    [busy, isLocked, visiblePin, pinLength, submitPin],
  )

  const handleBackspace = useCallback(() => {
    if (busy || isLocked) return
    setPin((prev) => prev.slice(0, -1))
  }, [busy, isLocked])

  useEffect(() => {
    if (!protectionConfigured || !pinEnabled || confirmReset) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key >= '0' && e.key <= '9') {
        handleDigitClick(e.key)
      } else if (e.key === 'Backspace') {
        handleBackspace()
      } else if (e.key === 'Escape') {
        setPin('')
        setError(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [protectionConfigured, pinEnabled, confirmReset, handleDigitClick, handleBackspace])

  const handleFidoAccess = async () => {
    if (busy || !protectionConfigured) return
    setBusy(true)
    setError(null)
    try {
      const handler = onFidoLogin ?? auth.loginWithFido
      const res = await handler()
      if (res.success) {
        if (res.user) {
          onLoginSuccess?.(res.user)
        }
      } else {
        setError(res.error || 'No se pudo validar la llave biométrica.')
      }
    } finally {
      setBusy(false)
    }
  }

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

  const handleGoogleAccess = (recoverMode = false) => {
    if (recoverMode && onRecoverWithGoogle) {
      onRecoverWithGoogle()
      return
    }
    if (!recoverMode && onGoogleSignIn) {
      onGoogleSignIn()
      return
    }
    if (recoverMode && onGoogleSignIn) {
      onGoogleSignIn()
      return
    }
    setError(null)
    initiateGoogleLoginFlow({
      loginHint: ownerEmail ?? undefined,
      onSuccess: (profile) => {
        const res = auth.completeGoogleLogin(profile, { allowRecovery: recoverMode })
        if (!res.success) {
          setError(res.error || 'Acceso denegado para esta cuenta Google.')
          return
        }
        if (res.user) {
          onLoginSuccess?.(res.user)
        }
      },
      onError: (msg) => setError(msg),
    })
  }

  const webAuthnCapable = isWebAuthnSupported()

  return (
    <div
      data-testid="login-screen"
      data-login-theme={theme === 'dark' ? 'dark' : 'light'}
      className="clinical-login min-h-screen min-h-[100dvh] flex flex-col items-center justify-center px-4 py-8 sm:px-6"
    >
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,420px)] gap-6 lg:gap-10 items-center">
        {/* Información pública visible en Homepage (sindecon.app) sin requerir inicio de sesión */}
        <section
          aria-label="Información pública de SINDECON"
          data-testid="login-public-overview"
          className="order-2 lg:order-1 rounded-3xl border p-6 sm:p-8"
          style={{
            backgroundColor: 'var(--cl-surface)',
            borderColor: 'var(--cl-border)',
          }}
        >
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold mb-3"
            style={{
              backgroundColor: 'var(--cl-accent-soft)',
              color: 'var(--cl-diagnostic)',
            }}
          >
            PWA Clínica Offline-First · sindecon.app
          </span>

          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2.5" style={{ color: 'var(--cl-fg)' }}>
            SINDECON — Cuaderno Médico Personal
          </h2>
          <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--cl-muted)' }}>
            Sistema de Información y Notas para Decisiones Clínicas. Organiza tus protocolos médicos, fichas en
            Markdown/Mermaid/KaTeX, documentos PDF y tarjetas de repaso espaciado SM-2 directamente en tu navegador
            (IndexedDB), con acceso instantáneo sin conexión durante la guardia hospitalaria.
          </p>

          <ul className="space-y-3 mb-6 text-xs sm:text-sm" style={{ color: 'var(--cl-fg-2)' }}>
            <li className="flex items-start gap-2.5">
              <BookOpen className="h-4 w-4 shrink-0 mt-0.5" style={{ color: 'var(--cl-diagnostic)' }} />
              <span>
                <strong style={{ color: 'var(--cl-fg)' }}>Privacidad local-first:</strong> tus apuntes médicos y PDFs
                permanecen exclusivamente en el almacenamiento local de tu dispositivo.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Cloud className="h-4 w-4 shrink-0 mt-0.5" style={{ color: 'var(--cl-diagnostic)' }} />
              <span>
                <strong style={{ color: 'var(--cl-fg)' }}>Google Drive (opcional):</strong> respaldo privado cifrado en
                la carpeta oculta de la aplicación (<code>drive.appdata</code>) y exportación puntual a Google Docs (
                <code>drive.file</code>).
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <CalendarDays className="h-4 w-4 shrink-0 mt-0.5" style={{ color: 'var(--cl-diagnostic)' }} />
              <span>
                <strong style={{ color: 'var(--cl-fg)' }}>Google Calendar integrado (opcional):</strong> muestra tus
                turnos y recordatorios clínicos y permite crear, editar o eliminar eventos directamente en tu cuenta
                Google incluso con cola offline (<code>calendar.events</code> y{' '}
                <code>calendar.calendarlist.readonly</code>).
              </span>
            </li>
          </ul>

          <div
            className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-4 text-xs"
            style={{ borderColor: 'var(--cl-border-soft)', color: 'var(--cl-muted)' }}
          >
            <a
              href="/privacy.html"
              data-testid="overview-privacy-link"
              className="font-semibold underline-offset-2 hover:underline"
              style={{ color: 'var(--cl-diagnostic)' }}
            >
              Política de Privacidad
            </a>
            <span aria-hidden="true">·</span>
            <a
              href="/privacy.html#terminos"
              data-testid="overview-terms-link"
              className="font-semibold underline-offset-2 hover:underline"
              style={{ color: 'var(--cl-diagnostic)' }}
            >
              Condiciones de Uso
            </a>
            <span aria-hidden="true">·</span>
            <span>Cumple con Google API Services User Data Policy (Limited Use)</span>
          </div>
        </section>

        <div
          className="order-1 lg:order-2 w-full max-w-md mx-auto rounded-3xl border p-6 sm:p-8"
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
              style={{ backgroundColor: 'var(--cl-accent-soft)', color: 'var(--cl-diagnostic)' }}
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
                  : 'Configura tu acceso inicial'}
              </p>
            </div>
          </div>
          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label="Cambiar tema visual"
              className="flex h-9 w-9 items-center justify-center rounded-full border transition cursor-pointer"
              style={{ borderColor: 'var(--cl-border)', color: 'var(--cl-fg-2)' }}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          )}
        </div>

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
              {protectionConfigured && isLocked
                ? `Terminal bloqueado temporalmente (${remainingLockSeconds} s). Usa tu llave FIDO o Google.`
                : displayError}
            </span>
          </div>
        )}

        {protectionConfigured && isLocked && !displayError && (
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
              <span
                className="mx-3 text-[10px] font-medium uppercase tracking-wider"
                style={{ color: 'var(--cl-muted)' }}
              >
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
                        setError(null)
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
                  onChange={(e) => setSetupPin(e.target.value.replace(/\D/g, '').slice(0, setupPinLength))}
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
                  onChange={(e) => setSetupConfirmPin(e.target.value.replace(/\D/g, '').slice(0, setupPinLength))}
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
          <>
            {pinEnabled && (
              <div>
                <div
                  data-testid="pin-dots"
                  data-pin-length={pinLength}
                  aria-label={`PIN con ${visiblePin.length} de ${pinLength} dígitos`}
                  className="mb-3 flex items-center justify-center gap-3 py-2"
                >
                  {Array.from({ length: pinLength }).map((_, idx) => {
                    const filled = idx < visiblePin.length
                    return (
                      <span
                        key={idx}
                        data-testid="pin-dot"
                        className="h-3.5 w-3.5 rounded-full border-2 transition-transform"
                        style={{
                          borderColor: filled ? 'var(--cl-diagnostic)' : 'var(--cl-border)',
                          backgroundColor: filled ? 'var(--cl-diagnostic)' : 'transparent',
                          transform: filled ? 'scale(1.1)' : 'scale(1)',
                        }}
                      />
                    )
                  })}
                </div>

                <div className="mx-auto grid max-w-[260px] grid-cols-3 gap-2.5">
                  {KEYPAD_DIGITS.map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      aria-label={`Dígito ${digit}`}
                      disabled={busy || isLocked}
                      onClick={() => handleDigitClick(digit)}
                      className="h-12 rounded-2xl border text-base font-bold transition active:scale-95 disabled:opacity-45 cursor-pointer disabled:cursor-not-allowed"
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
                        : 'Registra una passkey en Seguridad para activar biometría'
                    }
                    aria-label="Ingresar con Huella o Passkey"
                    disabled={busy || !hasPasskeys}
                    onClick={() => void handleFidoAccess()}
                    className="flex h-12 items-center justify-center rounded-2xl border transition active:scale-95 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: hasPasskeys ? 'var(--cl-accent-soft)' : 'var(--cl-surface-muted)',
                      borderColor: hasPasskeys ? 'var(--cl-accent-border)' : 'var(--cl-border)',
                      color: hasPasskeys ? 'var(--cl-diagnostic)' : 'var(--cl-muted)',
                    }}
                  >
                    <Fingerprint className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Dígito 0"
                    disabled={busy || isLocked}
                    onClick={() => handleDigitClick('0')}
                    className="h-12 rounded-2xl border text-base font-bold transition active:scale-95 disabled:opacity-45 cursor-pointer disabled:cursor-not-allowed"
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
                    disabled={busy || isLocked || visiblePin.length === 0}
                    onClick={handleBackspace}
                    className="flex h-12 items-center justify-center rounded-2xl border transition active:scale-95 disabled:opacity-45 cursor-pointer disabled:cursor-not-allowed"
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

            {!pinEnabled && hasPasskeys && (
              <div className="mb-4 rounded-2xl border p-4 text-center" style={{ borderColor: 'var(--cl-border)' }}>
                <ShieldCheck className="mx-auto mb-2 h-8 w-8" style={{ color: 'var(--cl-diagnostic)' }} />
                <p className="text-xs font-medium" style={{ color: 'var(--cl-fg-2)' }}>
                  Este equipo usa Passkey FIDO2 o cuenta Google (PIN desactivado).
                </p>
              </div>
            )}

            {!pinEnabled && !hasPasskeys && ownerEmail && (
              <div className="mb-4 rounded-2xl border p-4 text-center" style={{ borderColor: 'var(--cl-border)' }}>
                <ShieldCheck className="mx-auto mb-2 h-8 w-8" style={{ color: 'var(--cl-diagnostic)' }} />
                <p className="text-xs font-medium" style={{ color: 'var(--cl-fg-2)' }}>
                  Este equipo está protegido con la cuenta Google {ownerEmail}. Inicia sesión con Google para ingresar.
                </p>
              </div>
            )}

            <div className="mt-5 space-y-2.5 border-t pt-4" style={{ borderColor: 'var(--cl-border-soft)' }}>
              {hasPasskeys && webAuthnCapable && (
                <button
                  type="button"
                  data-testid={!pinEnabled ? 'fido-unlock-btn' : undefined}
                  disabled={busy}
                  onClick={() => void handleFidoAccess()}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-full text-xs font-semibold text-white transition disabled:opacity-50 cursor-pointer"
                  style={{ backgroundColor: 'var(--cl-accent)' }}
                >
                  <Fingerprint className="h-4 w-4" />
                  Ingresar con Huella / Passkey FIDO2
                </button>
              )}

              <button
                type="button"
                data-testid="google-login-btn"
                onClick={() => handleGoogleAccess(false)}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-full border text-xs font-semibold transition cursor-pointer"
                style={{
                  backgroundColor: 'var(--cl-surface-elevated)',
                  borderColor: 'var(--cl-border)',
                  color: 'var(--cl-fg)',
                }}
              >
                Continuar con Google
              </button>

              <div className="pt-1 text-center">
                {ownerEmail ? (
                  <button
                    type="button"
                    data-testid="recover-google-btn"
                    onClick={() => handleGoogleAccess(true)}
                    className="text-[11px] font-semibold underline-offset-2 hover:underline cursor-pointer"
                    style={{ color: 'var(--cl-diagnostic)' }}
                  >
                    ¿Olvidaste tu PIN? Recuperar con Google ({ownerEmail})
                  </button>
                ) : !confirmReset ? (
                  <button
                    type="button"
                    data-testid="reset-local-terminal-btn"
                    onClick={() => setConfirmReset(true)}
                    className="text-[11px] font-semibold underline-offset-2 hover:underline cursor-pointer"
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
                        className="rounded-full px-3 py-1 font-semibold cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmReset(false)
                          setPin('')
                          setError(null)
                          void (onResetTerminal ? onResetTerminal() : auth.resetLocalTerminalSecurity())
                        }}
                        className="rounded-full bg-red-600 px-3 py-1 font-semibold text-white cursor-pointer"
                      >
                        Confirmar restablecimiento
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        <footer
          className="mt-5 border-t pt-3.5 text-center text-[11px] leading-relaxed"
          style={{ borderColor: 'var(--cl-border-soft)', color: 'var(--cl-muted)' }}
        >
          <p className="mb-1">
            Cuaderno médico personal offline-first con respaldo opcional en Google Drive y agenda Google Calendar.
          </p>
          <a
            href="/privacy.html"
            data-testid="login-privacy-link"
            className="font-semibold underline-offset-2 hover:underline"
            style={{ color: 'var(--cl-diagnostic)' }}
          >
            Política de Privacidad y Uso de Datos Google
          </a>
        </footer>
      </div>
      </div>
    </div>
  )
}
