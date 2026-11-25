import { useCallback, useEffect, useState, type FormEvent } from 'react'
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
import { DEFAULT_PIN, useAuth } from '../../hooks/useAuth'
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
  onOfflineAccess,
  onRecoverWithGoogle,
  onResetTerminal,
  onPinSubmit,
  onFidoLogin,
  onCredentialsSubmit,
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

  const [tab, setTab] = useState<'pin' | 'credentials'>('pin')
  const [pin, setPin] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const activeTab = protectionConfigured ? 'pin' : tab
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
    if (activeTab !== 'pin' || !pinEnabled || confirmReset) return
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
  }, [activeTab, pinEnabled, confirmReset, handleDigitClick, handleBackspace])

  const handleFidoAccess = async () => {
    if (busy) return
    if (!hasPasskeys && !protectionConfigured) {
      await submitPin(DEFAULT_PIN)
      return
    }
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

  const handleCredentialsForm = (e: FormEvent) => {
    e.preventDefault()
    if (protectionConfigured) return
    const handler = onCredentialsSubmit ?? auth.loginWithCredentials
    const res = handler(username, password)
    if (res.success) {
      if (res.user) {
        onLoginSuccess?.(res.user)
      }
    } else {
      setError(res.error || 'Credenciales incorrectas.')
    }
  }

  const handleEmergencyOffline = () => {
    if (protectionConfigured) return
    if (onOfflineAccess) {
      const res = onOfflineAccess()
      if (res && typeof res === 'object' && 'success' in res) {
        if (res.success) {
          if (res.user) {
            onLoginSuccess?.(res.user)
          }
        } else {
          setError(res.error || 'Acceso de urgencias no disponible.')
        }
      }
      return
    }
    const res = auth.loginOfflineEmergency()
    if (res.success) {
      if (res.user) {
        onLoginSuccess?.(res.user)
      }
    } else {
      setError(res.error || 'Acceso de urgencias no disponible.')
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
      className="clinical-login min-h-screen min-h-[100dvh] flex flex-col items-center justify-center px-4 py-8"
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
                  : 'Estación clínica offline-first'}
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
              className="rounded-full py-2 text-xs font-semibold transition cursor-pointer"
              style={
                activeTab === 'pin'
                  ? {
                      backgroundColor: 'var(--cl-surface)',
                      color: 'var(--cl-fg)',
                      boxShadow: 'var(--cl-shadow-tab)',
                    }
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
              className="rounded-full py-2 text-xs font-semibold transition cursor-pointer"
              style={
                activeTab === 'credentials'
                  ? {
                      backgroundColor: 'var(--cl-surface)',
                      color: 'var(--cl-fg)',
                      boxShadow: 'var(--cl-shadow-tab)',
                    }
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

        {activeTab === 'pin' && pinEnabled && (
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
                    : 'Acceso biométrico de demostración'
                }
                aria-label="Ingresar con Huella o Passkey"
                disabled={busy || (protectionConfigured && !hasPasskeys)}
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

        {activeTab === 'pin' && !pinEnabled && hasPasskeys && (
          <div className="mb-4 rounded-2xl border p-4 text-center" style={{ borderColor: 'var(--cl-border)' }}>
            <ShieldCheck className="mx-auto mb-2 h-8 w-8" style={{ color: 'var(--cl-diagnostic)' }} />
            <p className="text-xs font-medium" style={{ color: 'var(--cl-fg-2)' }}>
              Este equipo usa Passkey FIDO2 o cuenta Google (PIN desactivado).
            </p>
          </div>
        )}

        {activeTab === 'credentials' && !protectionConfigured && (
          <form onSubmit={handleCredentialsForm} className="space-y-3">
            <input
              type="text"
              aria-label="Usuario clínico"
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
              aria-label="Contraseña inicial"
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
              className="flex h-11 w-full items-center justify-center gap-2 rounded-full text-xs font-semibold text-white transition cursor-pointer"
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

          {!protectionConfigured && (
            <button
              type="button"
              data-testid="emergency-offline-btn"
              onClick={handleEmergencyOffline}
              className="flex h-9 w-full items-center justify-center gap-1.5 rounded-full text-[11px] font-semibold transition cursor-pointer"
              style={{ color: 'var(--cl-muted)' }}
            >
              <WifiOff className="h-3.5 w-3.5" />
              Ingreso directo — Urgencias (Sin red)
            </button>
          )}

          {protectionConfigured && (
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
          )}
        </div>
      </div>
    </div>
  )
}
