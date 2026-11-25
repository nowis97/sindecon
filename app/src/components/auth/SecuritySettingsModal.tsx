import { useState, type FormEvent } from 'react'
import {
  AlertCircle,
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
  onSavePin: (
    newPin: string,
    opts?: { currentPin?: string },
  ) => Promise<{ success: boolean; error?: string }>
  onRemovePin: () => { success: boolean; error?: string }
  onRegisterPasskey: (label: string) => Promise<{ success: boolean; error?: string }>
  onRemovePasskey: (credentialId: string) => void
  onResetTerminalSecurity: () => Promise<void>
}

function SecuritySettingsContent({
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
}: Omit<SecuritySettingsModalProps, 'isOpen'>) {
  const [pinLengthChoice, setPinLengthChoice] = useState<4 | 6>(
    securityProfile.pinRecord?.pinLength ?? 4,
  )
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [passkeyLabel, setPasskeyLabel] = useState('Huella / Face ID de este equipo')
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const requireOldPin = securityProfile.pinRecord !== null && user?.method === 'pin'

  const handleSavePin = async (e: FormEvent) => {
    e.preventDefault()
    setFeedback(null)
    if (requireOldPin && !currentPin) {
      setFeedback({ tone: 'err', text: 'Ingresa tu PIN actual para cambiarlo.' })
      return
    }
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
      const res = await onSavePin(newPin, requireOldPin ? { currentPin } : undefined)
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

  const handleResetTerminal = async () => {
    setBusy(true)
    try {
      await onResetTerminalSecurity()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <BaseModal
      isOpen={true}
      onClose={onClose}
      titleId="security-settings-title"
      title="Seguridad de la Estación Clínica"
      subtitle={
        protectionConfigured
          ? 'Terminal protegido con PIN PBKDF2 / FIDO2'
          : 'Modo inicial de demostración (PIN 1234)'
      }
      icon={<ShieldCheck className="h-5 w-5" />}
      maxWidthClass="max-w-lg"
      footer={
        <button
          type="button"
          data-testid="security-close-btn"
          onClick={onClose}
          className={PILL_BTN_SECONDARY}
        >
          Cerrar
        </button>
      }
    >
      <div data-testid="security-settings-modal" className="space-y-5 text-xs">
        {feedback && (
          <div
            role={feedback.tone === 'err' ? 'alert' : 'status'}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 font-medium ${
              feedback.tone === 'ok'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                : 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200'
            }`}
          >
            {feedback.tone === 'ok' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
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
              {isGoogleDriveConnected
                ? 'Gestionar Google Drive'
                : 'Activar respaldo en Google Drive'}
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
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold cursor-pointer ${
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
            {requireOldPin && (
              <input
                data-testid="pin-current-input"
                type="password"
                inputMode="numeric"
                aria-label="PIN actual"
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
                aria-label={`Nuevo PIN (${pinLengthChoice} dígitos)`}
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
                aria-label="Confirmar PIN"
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
                  disabled={busy}
                  onClick={() => {
                    const res = onRemovePin()
                    if (!res.success) {
                      setFeedback({ tone: 'err', text: res.error || 'No se pudo quitar el PIN.' })
                      return
                    }
                    setCurrentPin('')
                    setNewPin('')
                    setConfirmPin('')
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
              aria-label="Nombre del equipo o huella"
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
                      {pk.sealedToken
                        ? 'Híbrida online + offline'
                        : 'Solo verificación local offline'}{' '}
                      · usos: {pk.signCount}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={`Eliminar passkey ${pk.label}`}
                    onClick={() => onRemovePasskey(pk.credentialId)}
                    className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {protectionConfigured && (
          <section className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50/40 p-3.5 dark:border-red-900/60 dark:bg-red-950/20">
            <span className="text-[11px] text-[var(--ch-text-secondary)]">
              Restablecer bloqueo borra PIN/FIDO/dueño locales sin tocar tus notas.
            </span>
            <button
              type="button"
              data-testid="security-reset-btn"
              disabled={busy}
              onClick={() => void handleResetTerminal()}
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

export function SecuritySettingsModal({ isOpen, ...rest }: SecuritySettingsModalProps) {
  if (!isOpen) return null
  return <SecuritySettingsContent {...rest} />
}
