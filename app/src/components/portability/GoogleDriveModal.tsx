import { useState } from 'react'
import {
  Cloud,
  User,
  Lock,
  WifiOff,
  RefreshCw,
  KeyRound,
  AlertTriangle,
  Info,
  Settings,
  ChevronUp,
} from 'lucide-react'
import type { SyncState, SyncProgress } from '../../pwa/syncEngine'
import { getStoredClientId, setStoredClientId } from '../../pwa/googleDrive'
import {
  BaseModal,
  PILL_BTN_PRIMARY,
  PILL_BTN_SECONDARY,
  PILL_BTN_DANGER,
  CLINICAL_FIELD_CLASS,
} from '../common/DialogModal'

interface GoogleDriveModalProps {
  isOpen: boolean
  onClose: () => void
  isConnected: boolean
  isSessionExpired?: boolean
  syncState: SyncState
  syncProgress?: SyncProgress | null
  lastSyncedAt: Date | null
  userEmail: string | null
  errorMessage: string | null
  onTriggerSync: () => void
  onDisconnect: () => void
  onConnectToken: (token: string, expiresIn?: number, email?: string) => void
  onInitiateOAuth: () => void
}

export function GoogleDriveModal({
  isOpen,
  onClose,
  isConnected,
  isSessionExpired = false,
  syncState,
  syncProgress,
  lastSyncedAt,
  userEmail,
  errorMessage,
  onTriggerSync,
  onDisconnect,
  onConnectToken,
  onInitiateOAuth,
}: GoogleDriveModalProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [manualToken, setManualToken] = useState('')
  const [manualEmail, setManualEmail] = useState('')
  const [customClientId, setCustomClientId] = useState(() => getStoredClientId())

  const handleSaveCustomClientId = () => {
    if (customClientId.trim()) {
      setStoredClientId(customClientId.trim())
    }
  }

  const handleManualTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualToken.trim()) return
    onConnectToken(manualToken.trim(), 3600, manualEmail.trim() || undefined)
    setManualToken('')
  }

  const getStatusLabel = () => {
    if (syncState === 'syncing') return 'Sincronizando cambios…'
    if (syncState === 'offline') return 'Sin conexión (Offline-First)'
    if (syncState === 'error') return 'Error en sincronización'
    if (isSessionExpired) return 'Sesión en pausa (token expirado)'
    return 'Al día y sincronizado'
  }

  const getStatusDotClass = () => {
    if (syncState === 'syncing') return 'bg-[var(--ch-accent)] animate-pulse'
    if (syncState === 'offline') return 'bg-slate-400'
    if (syncState === 'error') return 'bg-red-500'
    if (isSessionExpired) return 'bg-amber-500'
    return 'bg-emerald-500'
  }

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Sincronización con Google Drive"
      subtitle="Respaldo privado encriptado en tu propia carpeta oculta de Drive."
      icon={<Cloud className="h-5 w-5" />}
      maxWidthClass="max-w-lg"
      footer={
        <button type="button" className={PILL_BTN_SECONDARY} onClick={onClose}>
          Cerrar
        </button>
      }
    >
      {isConnected ? (
        <div className="flex flex-col gap-4">
          {/* Account Card */}
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/70 p-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]">
                <User className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <strong className="block truncate text-sm font-semibold text-[var(--ch-text-primary)]">
                  {userEmail || 'Cuenta de Google Conectada'}
                </strong>
                <span className="block font-mono text-[11px] text-[var(--ch-text-muted)]">
                  Espacio privado: appDataFolder
                </span>
              </div>
            </div>
            <span
              className={`shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-semibold ${
                isSessionExpired
                  ? 'border-amber-500/35 bg-amber-500/15 text-amber-800 dark:text-amber-300'
                  : 'border-emerald-500/35 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
              }`}
            >
              {isSessionExpired ? 'En pausa' : 'Conectado'}
            </span>
          </div>

          {/* Sync Status Box */}
          <div className="flex flex-col gap-2.5 rounded-2xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/40 p-4 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[var(--ch-text-muted)]">Estado actual:</span>
              <span className="inline-flex items-center gap-2 font-semibold text-[var(--ch-text-primary)]">
                <span className={`h-2 w-2 rounded-full ${getStatusDotClass()}`} />
                <span>{getStatusLabel()}</span>
              </span>
            </div>

            {syncState === 'syncing' && (
              <div className="flex flex-col gap-1.5 pt-1">
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--ch-bg-elevated)]">
                  <div
                    className="h-full bg-[var(--ch-accent)] transition-all duration-200"
                    style={{
                      width: `${Math.max(5, Math.min(100, syncProgress?.percent ?? 10))}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between font-mono text-[11px] text-[var(--ch-text-muted)]">
                  <span className="truncate">
                    {syncProgress?.message || 'Sincronizando notas con Google Drive…'}
                  </span>
                  <span>{Math.round(syncProgress?.percent ?? 10)}%</span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 border-t border-[var(--ch-border-subtle)] pt-2">
              <span className="text-[var(--ch-text-muted)]">Última sincronización:</span>
              <span className="font-mono text-[11px] text-[var(--ch-text-secondary)]">
                {lastSyncedAt ? lastSyncedAt.toLocaleString() : 'Pendiente de sincronizar'}
              </span>
            </div>
          </div>

          {isSessionExpired && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-3.5 py-2.5 text-xs leading-relaxed text-[var(--ch-text-secondary)]">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ch-accent)]" />
              <span>
                Tu sesión temporal de Google Drive ha expirado. Tus notas siguen 100% seguras en
                este dispositivo; puedes reconectar cuando quieras sincronizar tus cambios.
              </span>
            </div>
          )}

          {errorMessage && (
            <div className="flex items-center gap-2 rounded-2xl border border-red-500/35 bg-red-500/10 px-3.5 py-2.5 text-xs font-medium text-red-700 dark:text-red-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {isSessionExpired ? (
              <button type="button" className={PILL_BTN_PRIMARY} onClick={onInitiateOAuth}>
                <KeyRound className="h-3.5 w-3.5" />
                <span>Reconectar y sincronizar</span>
              </button>
            ) : (
              <button
                type="button"
                className={PILL_BTN_PRIMARY}
                onClick={onTriggerSync}
                disabled={syncState === 'syncing'}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${syncState === 'syncing' ? 'animate-spin' : ''}`}
                />
                <span>{syncState === 'syncing' ? 'Sincronizando…' : 'Sincronizar ahora'}</span>
              </button>
            )}

            <button type="button" className={PILL_BTN_DANGER} onClick={onDisconnect}>
              Desconectar cuenta
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm leading-relaxed text-[var(--ch-text-secondary)]">
            Sincroniza tus apuntes, protocolos y fotos automáticamente entre tu celular, laptop y
            tablet sin servidores externos.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-2xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/60 p-3.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]">
                <Lock className="h-4 w-4" />
              </span>
              <div>
                <strong className="block text-xs font-semibold text-[var(--ch-text-primary)]">
                  100% Privado
                </strong>
                <p className="mt-0.5 text-[11px] leading-snug text-[var(--ch-text-muted)]">
                  Usa tu carpeta oculta <code>appDataFolder</code>. Solo SINDECON tiene acceso.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/60 p-3.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]">
                <WifiOff className="h-4 w-4" />
              </span>
              <div>
                <strong className="block text-xs font-semibold text-[var(--ch-text-primary)]">
                  Local-First y Offline
                </strong>
                <p className="mt-0.5 text-[11px] leading-snug text-[var(--ch-text-muted)]">
                  Trabaja sin señal en urgencias y sincroniza al recuperar conexión.
                </p>
              </div>
            </div>
          </div>

          {errorMessage && (
            <div className="flex items-center gap-2 rounded-2xl border border-red-500/35 bg-red-500/10 px-3.5 py-2.5 text-xs font-medium text-red-700 dark:text-red-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            type="button"
            onClick={onInitiateOAuth}
            className="flex h-11 w-full items-center justify-center gap-2.5 rounded-full border border-[var(--ch-border-strong)] bg-[var(--ch-bg-elevated)] px-5 text-sm font-semibold text-[var(--ch-text-primary)] shadow-xs transition hover:border-[var(--ch-accent)] hover:bg-[var(--ch-bg-secondary)]"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
              />
            </svg>
            <span>Conectar con Google Drive</span>
          </button>

          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ch-text-muted)] transition hover:text-[var(--ch-accent)]"
            >
              {showAdvanced ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  <span>Ocultar opciones avanzadas</span>
                </>
              ) : (
                <>
                  <Settings className="h-3.5 w-3.5" />
                  <span>Opciones avanzadas (OAuth / Token manual)</span>
                </>
              )}
            </button>

            {showAdvanced && (
              <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/60 p-3.5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-[var(--ch-text-secondary)]">
                    Google OAuth Client ID personalizado
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className={CLINICAL_FIELD_CLASS}
                      value={customClientId}
                      onChange={(e) => setCustomClientId(e.target.value)}
                      placeholder="tu-client-id.apps.googleusercontent.com"
                    />
                    <button
                      type="button"
                      className={PILL_BTN_SECONDARY}
                      onClick={handleSaveCustomClientId}
                    >
                      Guardar
                    </button>
                  </div>
                </div>

                <form onSubmit={handleManualTokenSubmit} className="flex flex-col gap-2">
                  <label className="text-[11px] font-semibold text-[var(--ch-text-secondary)]">
                    Vincular mediante Access Token OAuth
                  </label>
                  <input
                    type="text"
                    className={CLINICAL_FIELD_CLASS}
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    placeholder="Email de Google (opcional)"
                  />
                  <input
                    type="password"
                    className={CLINICAL_FIELD_CLASS}
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    placeholder="pegar ya29.a0A... Access Token"
                  />
                  <button
                    type="submit"
                    className={PILL_BTN_PRIMARY}
                    disabled={!manualToken.trim()}
                  >
                    Conectar Token
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </BaseModal>
  )
}
