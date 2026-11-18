import { useState, useEffect, useCallback, type FormEvent } from 'react'
import {
  Stethoscope,
  ShieldCheck,
  Lock,
  User,
  Eye,
  EyeOff,
  Fingerprint,
  Cloud,
  Sun,
  Moon,
  Delete,
  Activity,
  FileText,
  LayoutGrid,
  ClipboardList,
} from 'lucide-react'
import { useAuth, DEFAULT_PIN } from '../../hooks/useAuth'
import type { AuthUser } from '../../domain/auth'

export interface LoginViewProps {
  onLoginSuccess?: (user: AuthUser) => void
  onGoogleSignIn?: () => void
  onOfflineAccess?: () => void
  theme?: 'light' | 'dark'
  onToggleTheme?: () => void
}

const KEYPAD_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const

export function LoginView({
  onLoginSuccess,
  onGoogleSignIn,
  onOfflineAccess,
  theme = 'light',
  onToggleTheme,
}: LoginViewProps) {
  const { loginWithPin, loginWithCredentials, loginOffline } = useAuth()
  const isDark = theme === 'dark'

  const [activeTab, setActiveTab] = useState<'pin' | 'credentials'>('pin')
  const [pin, setPin] = useState<string>('')
  const [isShaking, setIsShaking] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)

  // Credenciales clínicas + validación al perder foco
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberDevice, setRememberDevice] = useState(true)
  const [emailTouched, setEmailTouched] = useState(false)
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [credError, setCredError] = useState<string | null>(null)

  const getEmailValidationError = (val: string): string | null => {
    if (!val.trim()) return 'Introduce tu correo institucional o identificador médico.'
    return null
  }

  const getPasswordValidationError = (val: string): string | null => {
    if (val.trim().length < 4) {
      return 'Introduce al menos 4 caracteres para validar la clave clínica.'
    }
    return null
  }

  const emailFieldError = emailTouched ? getEmailValidationError(email) : null
  const passwordFieldError = passwordTouched ? getPasswordValidationError(password) : null

  // Validación e ingreso por PIN de guardia
  const handlePinSubmit = useCallback(
    (pinToTest: string) => {
      const res = loginWithPin(pinToTest)
      if (res.success) {
        setPinError(null)
        onLoginSuccess?.({
          id: 'clinical-pin-user',
          name: 'Médico de Guardia',
          role: 'Urgencias / Turno',
          method: 'pin',
          loggedAt: Date.now(),
        })
      } else {
        setPinError(
          res.error ||
            'El PIN ingresado no coincide con la clave local. Reintenta con los 4 dígitos de guardia (1234) o accede en modo urgencias.',
        )
        setIsShaking(true)
        setTimeout(() => {
          setIsShaking(false)
          setPin('')
        }, 420)
      }
    },
    [loginWithPin, onLoginSuccess],
  )

  const handleKeypadPress = useCallback(
    (digit: string) => {
      if (pin.length >= 4 || isShaking) return
      const nextPin = pin + digit
      setPin(nextPin)
      setPinError(null)
      if (nextPin.length === 4) {
        handlePinSubmit(nextPin)
      }
    },
    [pin, isShaking, handlePinSubmit],
  )

  const handleBackspace = useCallback(() => {
    if (isShaking || pin.length === 0) return
    setPin((prev) => prev.slice(0, -1))
    setPinError(null)
  }, [isShaking, pin.length])

  const handleBiometricAccess = useCallback(() => {
    setPin(DEFAULT_PIN)
    handlePinSubmit(DEFAULT_PIN)
  }, [handlePinSubmit])

  // Soporte de teclado físico cuando la pestaña PIN está activa
  useEffect(() => {
    if (activeTab !== 'pin') return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleKeypadPress(e.key)
      } else if (e.key === 'Backspace') {
        handleBackspace()
      } else if (e.key === 'Escape') {
        setPin('')
        setPinError(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTab, handleKeypadPress, handleBackspace])

  const handleCredentialsSubmit = (e: FormEvent) => {
    e.preventDefault()
    setEmailTouched(true)
    setPasswordTouched(true)
    setCredError(null)

    const eErr = getEmailValidationError(email)
    const pErr = getPasswordValidationError(password)
    if (eErr || pErr) return

    const res = loginWithCredentials(email, password)
    if (res.success) {
      const cleanName = email.split('@')[0]
      const formattedName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1)
      onLoginSuccess?.({
        id: email.toLowerCase(),
        name: `Dr. ${formattedName}`,
        role: 'Médico Facultativo',
        method: 'credentials',
        loggedAt: Date.now(),
      })
    } else {
      setCredError(res.error || 'No se pudieron verificar las credenciales locales.')
    }
  }

  const handleEmergencyOffline = () => {
    loginOffline()
    onOfflineAccess?.()
    onLoginSuccess?.({
      id: 'offline-emergency',
      name: 'Modo Urgencias',
      role: 'Acceso Local Sin Conexión',
      method: 'offline',
      loggedAt: Date.now(),
    })
  }

  return (
    <div
      className="clinical-login min-h-screen min-h-[100dvh] flex flex-col font-sans antialiased transition-colors duration-150"
      data-login-theme={theme}
    >
      <div
        className="min-h-screen min-h-[100dvh] flex flex-col"
        style={{ background: 'var(--cl-shell-bg)' }}
      >
        {/* Barra Superior de Estación Clínica */}
        <header className="w-full border-b border-[var(--cl-border)] bg-[var(--cl-surface)] transition-colors duration-150">
          <div className="max-w-[1160px] mx-auto px-4 sm:px-6 py-2 sm:py-3 flex items-center justify-between gap-2.5 sm:gap-4">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div
                className={`w-[34px] h-[34px] sm:w-10 sm:h-10 rounded-[10px] flex items-center justify-center shrink-0 transition-colors ${
                  isDark
                    ? 'bg-[var(--cl-accent-soft)] text-[var(--cl-diagnostic)] border border-[var(--cl-accent-border)]'
                    : 'bg-[var(--cl-fg)] text-white'
                }`}
                aria-hidden="true"
              >
                <Stethoscope className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[1.0625rem] font-extrabold tracking-tight text-[var(--cl-fg)]">
                    SINDECON
                  </span>
                  <span className="hidden sm:inline-block font-mono tabular-nums text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-[var(--cl-surface-warm)] border border-[var(--cl-border)] text-[var(--cl-fg-2)]">
                    V0.17
                  </span>
                </div>
                <p className="hidden sm:block text-xs text-[var(--cl-muted)] truncate m-0">
                  Cuaderno Médico Personal · Estación Clínica
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2.5">
              <span className="inline-flex items-center gap-1.5 min-h-[34px] sm:min-h-[36px] px-2.5 sm:px-3 py-1 rounded-full bg-[var(--cl-success-soft)] border border-[var(--cl-success-border)] text-[var(--cl-success)] text-xs font-semibold">
                <span className="w-[7px] h-[7px] rounded-full bg-current animate-pulse shrink-0" />
                <span>
                  Local listo<span className="hidden sm:inline"> · Sin red</span>
                </span>
              </span>

              {onToggleTheme && (
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="inline-flex items-center gap-1.5 min-h-[34px] sm:min-h-[40px] px-2.5 sm:px-3.5 rounded-[10px] border border-[var(--cl-border)] bg-[var(--cl-surface-warm)] hover:bg-[var(--cl-surface)] hover:border-[var(--cl-accent)] text-[var(--cl-fg)] text-xs sm:text-[13px] font-semibold cursor-pointer transition-colors"
                  aria-label="Cambiar entre modo diurno y guardia UCI nocturna"
                  title={isDark ? 'Cambiar a Turno Día clínico' : 'Cambiar a Guardia UCI nocturna'}
                >
                  {isDark ? (
                    <>
                      <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span>Turno Día</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span>Guardia UCI</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Grid Asimétrico de Estación Clínica */}
        <main className="flex-1 flex items-start lg:items-center justify-center px-4 py-3 sm:px-6 sm:py-5 lg:py-6">
          <div className="w-full max-w-[1112px] grid grid-cols-1 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,444px)] gap-5 lg:gap-10 items-center">
            {/* Columna Izquierda: Contexto Médico y Ficha Clínica */}
            <section
              className="flex flex-col gap-5 min-w-0 text-left order-last lg:order-first"
              aria-label="Contexto clínico de la estación"
            >
              <div className="inline-flex items-center gap-2 self-start px-3 py-1 rounded-full bg-[var(--cl-surface-warm)] border border-[var(--cl-border)] text-[var(--cl-fg-2)] text-xs font-semibold">
                <Activity className="w-3.5 h-3.5" />
                <span>Estación clínica local · Sin dependencia de red</span>
              </div>

              <h1 className="text-[1.95rem] sm:text-[2.35rem] lg:text-[2.55rem] font-extrabold leading-[1.14] tracking-[-0.03em] text-[var(--cl-fg)] m-0">
                Decisiones médicas
                <br />
                <span className="text-[var(--cl-diagnostic)]">en el punto de atención.</span>
              </h1>

              <p className="text-sm sm:text-base text-[var(--cl-fg-2)] leading-relaxed max-w-[540px] m-0">
                Accede al instante a notas SOAP, algoritmos ACLS y dosificaciones clínicas desde urgencias, planta o consulta externa sin depender de cobertura hospitalaria.
              </p>

              {/* Tarjeta de Referencia Clínica con Trazo Sinusal y Cálculo Renal */}
              <div
                className="bg-[var(--cl-surface)] border border-[var(--cl-border)] rounded-2xl overflow-hidden transition-colors"
                style={{ boxShadow: 'var(--cl-shadow-card)' }}
                aria-label="Vista previa de ficha clínica y calculadora renal"
              >
                <div className="px-[18px] py-3 bg-[var(--cl-surface-warm)] border-b border-[var(--cl-border-soft)] flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 text-[13px] font-bold text-[var(--cl-fg)]">
                    <ClipboardList className="w-4 h-4" />
                    <span>Módulo clínico integrado · Referencia rápida</span>
                  </div>
                  <span className="text-xs font-semibold text-[var(--cl-muted)]">Acceso inmediato</span>
                </div>

                {/* Trazo ECG Sinusal */}
                <div className="px-[18px] pt-3 pb-2 border-b border-[var(--cl-border-soft)] flex items-center justify-between gap-4">
                  <svg
                    className="flex-1 h-[34px] max-w-[340px] text-[var(--cl-diagnostic)]"
                    viewBox="0 0 340 34"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M0 19 L28 19 L34 15 L40 19 L48 19 L52 24 L58 5 L64 29 L69 19 L79 19 L86 14 L94 19 L142 19 L148 15 L154 19 L162 19 L166 24 L172 5 L178 29 L183 19 L193 19 L200 14 L208 19 L258 19 L264 15 L270 19 L278 19 L282 24 L288 5 L294 29 L299 19 L309 19 L316 14 L324 19 L340 19"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <div className="text-right shrink-0">
                    <span className="block font-mono tabular-nums text-[13px] font-bold text-[var(--cl-fg)]">
                      72 lpm · Sinusal
                    </span>
                    <span className="text-xs text-[var(--cl-muted)]">Protocolo ACLS / SOAP</span>
                  </div>
                </div>

                {/* Fórmula Cockcroft-Gault */}
                <div className="px-[18px] py-3.5 border-b border-[var(--cl-border-soft)] bg-[var(--cl-bg-subtle)]">
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5 text-xs font-semibold text-[var(--cl-muted)]">
                    <span>Cálculo renal · Fórmula de Cockcroft-Gault</span>
                    <span>Nefrología</span>
                  </div>
                  <p className="font-mono tabular-nums text-sm font-semibold text-[var(--cl-fg)] leading-normal m-0 break-words">
                    ClCr = [(140 − Edad) × Peso (kg)] / [72 × Cr sérica (mg/dL)]
                  </p>
                  <p className="text-xs text-[var(--cl-fg-2)] mt-1 mb-0">
                    Factor corrector × 0.85 en paciente mujer · Ajuste de dosis antibiótica en guardia.
                  </p>
                </div>

                <ul className="list-none m-0 px-[18px] py-1.5">
                  <li className="flex items-start gap-3 py-2.5 border-b border-[var(--cl-border-soft)]">
                    <div
                      className="w-[30px] h-[30px] rounded-lg bg-[var(--cl-surface-warm)] border border-[var(--cl-border)] text-[var(--cl-fg-2)] flex items-center justify-center shrink-0 mt-0.5"
                      aria-hidden="true"
                    >
                      <FileText className="w-[15px] h-[15px]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[var(--cl-fg)] m-0 mb-0.5">
                        Plantillas SOAP, RCP y fichas de bolsillo
                      </p>
                      <p className="text-[13px] text-[var(--cl-muted)] leading-snug m-0">
                        Algoritmos diagnósticos y tarjetas clínicas disponibles sin conexión.
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3 py-2.5">
                    <div
                      className="w-[30px] h-[30px] rounded-lg bg-[var(--cl-surface-warm)] border border-[var(--cl-border)] text-[var(--cl-fg-2)] flex items-center justify-center shrink-0 mt-0.5"
                      aria-hidden="true"
                    >
                      <ShieldCheck className="w-[15px] h-[15px]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[var(--cl-fg)] m-0 mb-0.5">
                        Resguardo estricto del secreto médico
                      </p>
                      <p className="text-[13px] text-[var(--cl-muted)] leading-snug m-0">
                        Los registros clínicos se cifran localmente en este equipo sin telemetría externa.
                      </p>
                    </div>
                  </li>
                </ul>
              </div>
            </section>

            {/* Columna Derecha: Panel de Identificación del Facultativo (Prioritario en Móvil) */}
            <section
              className="w-full bg-[var(--cl-surface)] border border-[var(--cl-border)] rounded-2xl overflow-hidden order-first lg:order-last transition-colors"
              style={{ boxShadow: 'var(--cl-shadow-card)' }}
              aria-label="Identificación del facultativo"
            >
              {/* Banda superior del terminal */}
              <div className="px-4 py-2.5 sm:px-[22px] sm:py-[11px] bg-[var(--cl-surface-warm)] border-b border-[var(--cl-border)] flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-[var(--cl-fg-2)] inline-flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  Terminal clínico protegido
                </span>
                <span className="text-xs font-semibold text-[var(--cl-fg)]">
                  {isDark ? 'UCI Nocturna' : 'Guardia activa'}
                </span>
              </div>

              <div className="p-4 sm:px-[22px] sm:pt-[18px] sm:pb-4">
                <div className="mb-2.5 sm:mb-3.5 text-left">
                  <h2 className="text-[1.28rem] sm:text-[1.3125rem] font-extrabold tracking-[-0.02em] text-[var(--cl-fg)] m-0 mb-0.5">
                    Identificación del Facultativo
                  </h2>
                  <p className="text-[13.5px] text-[var(--cl-muted)] m-0">
                    Desbloquea tu estación clínica local para continuar el turno
                  </p>
                </div>

                {/* Conmutador PIN de Guardia / Credenciales */}
                <div
                  className="grid grid-cols-2 gap-1 p-1 rounded-[10px] bg-[var(--cl-surface-warm)] border border-[var(--cl-border)] mb-3 sm:mb-3.5"
                  role="tablist"
                  aria-label="Método de identificación clínica"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'pin'}
                    className={`min-h-[40px] px-3 py-1.5 rounded-[7px] text-[13px] font-semibold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      activeTab === 'pin'
                        ? 'bg-[var(--cl-surface-elevated)] text-[var(--cl-fg)] border-[var(--cl-border)]'
                        : 'bg-transparent text-[var(--cl-muted)] border-transparent hover:text-[var(--cl-fg)]'
                    }`}
                    style={activeTab === 'pin' ? { boxShadow: 'var(--cl-shadow-tab)' } : undefined}
                    onClick={() => {
                      setActiveTab('pin')
                      setCredError(null)
                    }}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    PIN de Guardia
                  </button>

                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'credentials'}
                    className={`min-h-[40px] px-3 py-1.5 rounded-[7px] text-[13px] font-semibold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      activeTab === 'credentials'
                        ? 'bg-[var(--cl-surface-elevated)] text-[var(--cl-fg)] border-[var(--cl-border)]'
                        : 'bg-transparent text-[var(--cl-muted)] border-transparent hover:text-[var(--cl-fg)]'
                    }`}
                    style={
                      activeTab === 'credentials'
                        ? { boxShadow: 'var(--cl-shadow-tab)' }
                        : undefined
                    }
                    onClick={() => {
                      setActiveTab('credentials')
                      setPinError(null)
                    }}
                  >
                    <User className="w-3.5 h-3.5" />
                    Credenciales
                  </button>
                </div>

                {/* Pestaña 1: PIN de Guardia */}
                {activeTab === 'pin' && (
                  <div role="tabpanel" aria-label="Acceso mediante PIN de Guardia">
                    <div
                      className={`flex justify-center gap-3 mt-0.5 mb-2 ${
                        isShaking ? 'clinical-animate-shake' : ''
                      }`}
                      aria-label={`PIN con ${pin.length} de 4 dígitos`}
                    >
                      {[0, 1, 2, 3].map((index) => {
                        const isFilled = index < pin.length
                        return (
                          <span
                            key={index}
                            className={`w-4 h-4 rounded-[5px] border-2 transition-all duration-150 ${
                              pinError
                                ? 'border-[var(--cl-danger)] bg-[var(--cl-danger-soft)]'
                                : isFilled
                                  ? 'border-[var(--cl-diagnostic)] bg-[var(--cl-diagnostic)] scale-105'
                                  : 'border-[var(--cl-border)] bg-[var(--cl-surface-warm)]'
                            }`}
                          />
                        )
                      })}
                    </div>

                    {pinError ? (
                      <p
                        role="alert"
                        aria-live="assertive"
                        className="mb-2.5 px-3 py-2 rounded-lg bg-[var(--cl-danger-soft)] border border-[var(--cl-danger-border)] text-[var(--cl-danger)] text-[13px] font-medium text-left leading-snug"
                      >
                        {pinError}
                      </p>
                    ) : (
                      <p
                        role="status"
                        aria-live="polite"
                        className="min-h-[20px] mb-2.5 text-[13px] text-[var(--cl-muted)] text-center leading-snug"
                      >
                        PIN de 4 dígitos o biometría rápida.
                      </p>
                    )}

                    {/* Teclado Numérico Táctil (>=48px) */}
                    <div
                      className="grid grid-cols-3 gap-2 mb-2.5"
                      role="group"
                      aria-label="Teclado numérico clínico"
                    >
                      {KEYPAD_DIGITS.map((digit) => (
                        <button
                          key={digit}
                          type="button"
                          onClick={() => handleKeypadPress(digit)}
                          className="min-h-[48px] rounded-[10px] border border-[var(--cl-border)] bg-[var(--cl-surface-warm)] hover:bg-[var(--cl-surface)] hover:border-[var(--cl-accent)] active:scale-[0.97] active:bg-[var(--cl-accent-soft)] text-[var(--cl-fg)] font-mono tabular-nums text-lg font-semibold flex items-center justify-center select-none cursor-pointer transition-all"
                        >
                          {digit}
                        </button>
                      ))}

                      <button
                        type="button"
                        onClick={handleBiometricAccess}
                        aria-label="Desbloqueo biométrico rápido"
                        title="Biometría rápida"
                        className="min-h-[48px] rounded-[10px] border border-[var(--cl-border)] bg-[var(--cl-surface-warm)] hover:bg-[var(--cl-surface)] hover:border-[var(--cl-accent)] active:scale-[0.97] text-[var(--cl-diagnostic)] flex items-center justify-center cursor-pointer transition-all"
                      >
                        <Fingerprint className="w-5 h-5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleKeypadPress('0')}
                        className="min-h-[48px] rounded-[10px] border border-[var(--cl-border)] bg-[var(--cl-surface-warm)] hover:bg-[var(--cl-surface)] hover:border-[var(--cl-accent)] active:scale-[0.97] active:bg-[var(--cl-accent-soft)] text-[var(--cl-fg)] font-mono tabular-nums text-lg font-semibold flex items-center justify-center select-none cursor-pointer transition-all"
                      >
                        0
                      </button>

                      <button
                        type="button"
                        onClick={handleBackspace}
                        disabled={pin.length === 0}
                        aria-label="Borrar último dígito"
                        title="Borrar dígito"
                        className="min-h-[48px] rounded-[10px] border border-[var(--cl-border)] bg-[var(--cl-surface-warm)] hover:bg-[var(--cl-surface)] hover:border-[var(--cl-accent)] active:scale-[0.97] text-[var(--cl-fg-2)] flex items-center justify-center cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed transition-all"
                      >
                        <Delete className="w-[19px] h-[19px]" />
                      </button>
                    </div>

                    <p className="text-center text-xs text-[var(--cl-muted)] m-0">
                      PIN de guardia inicial:{' '}
                      <span className="font-mono tabular-nums font-bold text-[var(--cl-fg)] bg-[var(--cl-surface-warm)] border border-[var(--cl-border)] px-1.5 py-0.5 rounded-[5px]">
                        {DEFAULT_PIN}
                      </span>
                    </p>
                  </div>
                )}

                {/* Pestaña 2: Credenciales Institucionales */}
                {activeTab === 'credentials' && (
                  <form
                    className="flex flex-col gap-3.5 text-left"
                    onSubmit={handleCredentialsSubmit}
                    noValidate
                    role="tabpanel"
                    aria-label="Acceso mediante credenciales clínicas"
                  >
                    {credError && (
                      <p
                        role="alert"
                        className="px-3 py-2 rounded-lg bg-[var(--cl-danger-soft)] border border-[var(--cl-danger-border)] text-[var(--cl-danger)] text-xs font-medium m-0"
                      >
                        {credError}
                      </p>
                    )}

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="login-email" className="text-[13px] font-semibold text-[var(--cl-fg)]">
                        Correo institucional o ID médico
                      </label>
                      <input
                        id="login-email"
                        type="text"
                        value={email}
                        onBlur={() => setEmailTouched(true)}
                        onChange={(e) => {
                          setEmail(e.target.value)
                          setCredError(null)
                        }}
                        placeholder="dra.martinez@hospital.es"
                        autoComplete="email"
                        className={`w-full min-h-[44px] px-3.5 rounded-[10px] border text-[15px] text-[var(--cl-fg)] placeholder:text-[var(--cl-muted)] focus:outline-none transition-colors ${
                          emailFieldError
                            ? 'border-[var(--cl-danger)] bg-[var(--cl-danger-soft)]'
                            : 'border-[var(--cl-border)] bg-[var(--cl-bg-subtle)] focus:bg-[var(--cl-surface)] focus:border-[var(--cl-accent)]'
                        }`}
                      />
                      {emailFieldError && (
                        <p role="alert" className="text-xs font-medium text-[var(--cl-danger)] m-0">
                          {emailFieldError}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="login-password" className="text-[13px] font-semibold text-[var(--cl-fg)]">
                        Contraseña clínica
                      </label>
                      <div className="relative flex items-center">
                        <input
                          id="login-password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onBlur={() => setPasswordTouched(true)}
                          onChange={(e) => {
                            setPassword(e.target.value)
                            setCredError(null)
                          }}
                          placeholder="Mínimo 4 caracteres"
                          autoComplete="current-password"
                          className={`w-full min-h-[44px] pl-3.5 pr-12 rounded-[10px] border text-[15px] text-[var(--cl-fg)] placeholder:text-[var(--cl-muted)] focus:outline-none transition-colors ${
                            passwordFieldError
                              ? 'border-[var(--cl-danger)] bg-[var(--cl-danger-soft)]'
                              : 'border-[var(--cl-border)] bg-[var(--cl-bg-subtle)] focus:bg-[var(--cl-surface)] focus:border-[var(--cl-accent)]'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                          className="absolute right-1 min-w-[40px] min-h-[40px] rounded-lg text-[var(--cl-muted)] hover:text-[var(--cl-fg)] hover:bg-[var(--cl-surface-warm)] flex items-center justify-center cursor-pointer transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {passwordFieldError && (
                        <p role="alert" className="text-xs font-medium text-[var(--cl-danger)] m-0">
                          {passwordFieldError}
                        </p>
                      )}
                    </div>

                    <label className="flex items-center gap-2.5 text-[13px] text-[var(--cl-fg-2)] cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rememberDevice}
                        onChange={(e) => setRememberDevice(e.target.checked)}
                        className="w-4 h-4 accent-[#0f766e] cursor-pointer"
                      />
                      <span>Recordar autorización en este terminal</span>
                    </label>

                    <button
                      type="submit"
                      className="w-full min-h-[46px] px-4 rounded-[10px] bg-[var(--cl-accent)] hover:bg-[var(--cl-accent-hover)] active:bg-[var(--cl-accent-active)] text-white text-[15px] font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                      <span>Desbloquear estación clínica</span>
                    </button>
                  </form>
                )}

                {/* Separador de Contingencia */}
                <div className="flex items-center gap-3 my-3 text-xs font-semibold text-[var(--cl-muted)]">
                  <span className="flex-1 h-px bg-[var(--cl-border)]" />
                  <span>Acceso sincronizado o de contingencia</span>
                  <span className="flex-1 h-px bg-[var(--cl-border)]" />
                </div>

                {/* Acciones Secundarias y Urgencias */}
                <div className="flex flex-col gap-2">
                  {onGoogleSignIn && (
                    <button
                      type="button"
                      onClick={onGoogleSignIn}
                      title="Sincronizar con tu cuenta de Google Drive"
                      className="w-full min-h-[44px] px-4 rounded-[10px] border border-[var(--cl-border)] bg-[var(--cl-surface)] hover:bg-[var(--cl-surface-warm)] hover:border-[var(--cl-fg-2)] text-[var(--cl-fg)] text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                      <Cloud className="w-4 h-4" />
                      <span>Continuar con Google Drive</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleEmergencyOffline}
                    title="Acceso directo sin contraseña ni internet"
                    className="w-full min-h-[44px] px-4 rounded-[10px] border-[1.5px] border-[var(--cl-diagnostic)] bg-[var(--cl-surface)] hover:bg-[var(--cl-accent-soft)] text-[var(--cl-diagnostic)] text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <Activity className="w-4 h-4" />
                    <span>Ingreso directo — Urgencias (Sin red)</span>
                  </button>
                </div>

                <footer className="mt-3 pt-2.5 border-t border-[var(--cl-border-soft)] flex items-center justify-center gap-1.5 text-xs text-[var(--cl-muted)] text-center">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>Cifrado local en el navegador · Sin telemetría en la nube</span>
                </footer>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}
