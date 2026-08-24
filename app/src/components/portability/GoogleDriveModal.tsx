import { useState } from 'react'
import type { SyncState } from '../../pwa/syncEngine'
import {
  getStoredClientId,
  setStoredClientId,
} from '../../pwa/googleDrive'

interface GoogleDriveModalProps {
  isOpen: boolean
  onClose: () => void
  isConnected: boolean
  syncState: SyncState
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
  syncState,
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

  if (!isOpen) return null

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

  return (
    <div
      className="dialog-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="dialog-modal gdrive-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-header">
          <h3>☁️ Sincronización con Google Drive</h3>
          <button
            type="button"
            className="dialog-btn-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="dialog-body gdrive-modal-body">
          {isConnected ? (
            <div className="gdrive-connected-section">
              <div className="gdrive-account-card">
                <div className="account-avatar">👤</div>
                <div className="account-details">
                  <strong>{userEmail || 'Cuenta de Google Conectada'}</strong>
                  <span className="account-scope">
                    Espacio privado: <code>appDataFolder</code>
                  </span>
                </div>
                <span className="account-badge-connected">Conectado</span>
              </div>

              <div className="sync-status-details-box">
                <div className="sync-detail-row">
                  <span>Estado actual:</span>
                  <strong>
                    {syncState === 'syncing'
                      ? '🔄 Sincronizando cambios…'
                      : syncState === 'offline'
                        ? '⚪ Sin conexión (Offline-First)'
                        : syncState === 'error'
                          ? '🔴 Error en sincronización'
                          : '🟢 Al día y sincronizado'}
                  </strong>
                </div>
                <div className="sync-detail-row">
                  <span>Última sincronización:</span>
                  <span>
                    {lastSyncedAt
                      ? lastSyncedAt.toLocaleString()
                      : 'Pendiente de sincronizar'}
                  </span>
                </div>
              </div>

              {errorMessage && (
                <div className="dialog-error-text">
                  ⚠️ {errorMessage}
                </div>
              )}

              <div className="gdrive-actions-row">
                <button
                  type="button"
                  className="btn-dialog-primary"
                  onClick={onTriggerSync}
                  disabled={syncState === 'syncing'}
                >
                  {syncState === 'syncing'
                    ? 'Sincronizando…'
                    : '🔄 Sincronizar ahora'}
                </button>
                <button
                  type="button"
                  className="btn-dialog-danger"
                  onClick={onDisconnect}
                >
                  Desconectar cuenta
                </button>
              </div>
            </div>
          ) : (
            <div className="gdrive-disconnected-section">
              <p className="gdrive-benefit-lead">
                Sincroniza tus apuntes, protocolos y fotos automáticamente entre tu
                celular, laptop y tablet sin servidores externos.
              </p>

              <div className="gdrive-feature-list">
                <div className="gdrive-feature-item">
                  <span>🔒</span>
                  <div>
                    <strong>100% Privado y Seguro</strong>
                    <p>
                      Se guarda en tu propia carpeta oculta de Google Drive (
                      <code>appDataFolder</code>). Solo esta app tiene acceso.
                    </p>
                  </div>
                </div>

                <div className="gdrive-feature-item">
                  <span>📶</span>
                  <div>
                    <strong>Local-First y Offline</strong>
                    <p>
                      Trabaja en el hospital sin señal. Los cambios se sincronizan en
                      segundo plano cuando recuperas conexión.
                    </p>
                  </div>
                </div>
              </div>

              {errorMessage && (
                <div className="dialog-error-text">
                  ⚠️ {errorMessage}
                </div>
              )}

              <div className="gdrive-connect-cta">
                <button
                  type="button"
                  className="btn-google-signin"
                  onClick={onInitiateOAuth}
                >
                  <span className="google-icon">G</span>
                  <span>Conectar con Google Drive</span>
                </button>
              </div>

              {/* Opciones avanzadas de desarrollador / autohospedaje */}
              <div className="gdrive-advanced-toggle">
                <button
                  type="button"
                  className="btn-link-toggle"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  {showAdvanced
                    ? '▲ Ocultar opciones avanzadas'
                    : '⚙️ Opciones avanzadas (OAuth / Token manual)'}
                </button>
              </div>

              {showAdvanced && (
                <div className="gdrive-advanced-panel">
                  <div className="advanced-field">
                    <label className="dialog-label">
                      Google OAuth Client ID personalizado:
                    </label>
                    <div className="input-with-button">
                      <input
                        type="text"
                        className="dialog-input"
                        value={customClientId}
                        onChange={(e) => setCustomClientId(e.target.value)}
                        placeholder="tu-client-id.apps.googleusercontent.com"
                      />
                      <button
                        type="button"
                        className="btn-dialog-secondary"
                        onClick={handleSaveCustomClientId}
                      >
                        Guardar
                      </button>
                    </div>
                  </div>

                  <form
                    onSubmit={handleManualTokenSubmit}
                    className="advanced-field"
                  >
                    <label className="dialog-label">
                      Vincular mediante Access Token OAuth:
                    </label>
                    <input
                      type="text"
                      className="dialog-input"
                      value={manualEmail}
                      onChange={(e) => setManualEmail(e.target.value)}
                      placeholder="Email de Google (opcional)"
                    />
                    <input
                      type="password"
                      className="dialog-input"
                      value={manualToken}
                      onChange={(e) => setManualToken(e.target.value)}
                      placeholder="pegar ya29.a0A... Access Token"
                    />
                    <button
                      type="submit"
                      className="btn-dialog-primary"
                      disabled={!manualToken.trim()}
                    >
                      Conectar Token
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button
            type="button"
            className="btn-dialog-secondary"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
