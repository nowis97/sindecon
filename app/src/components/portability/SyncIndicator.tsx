import type { SyncState } from '../../pwa/syncEngine'

interface SyncIndicatorProps {
  isConnected: boolean
  syncState: SyncState
  lastSyncedAt: Date | null
  onClick: () => void
}

export function SyncIndicator({
  isConnected,
  syncState,
  lastSyncedAt,
  onClick,
}: SyncIndicatorProps) {
  const getStatusDetails = () => {
    if (!isConnected) {
      return {
        dotClass: 'dot-disconnected',
        label: 'Nube',
        title: 'Google Drive no conectado. Haz click para configurar sincronización.',
      }
    }

    switch (syncState) {
      case 'syncing':
      case 'checking':
        return {
          dotClass: 'dot-syncing',
          label: 'Sincronizando…',
          title: 'Sincronizando cambios con Google Drive…',
        }
      case 'offline':
        return {
          dotClass: 'dot-offline',
          label: 'Offline',
          title: 'Sin conexión a internet. Los cambios se sincronizarán al reconectar.',
        }
      case 'error':
        return {
          dotClass: 'dot-error',
          label: 'Error Sync',
          title: 'Error de sincronización con Google Drive. Haz click para ver detalles.',
        }
      case 'idle':
      default:
        return {
          dotClass: 'dot-synced',
          label: lastSyncedAt
            ? `Sync ${lastSyncedAt.toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
              })}`
            : 'Al día',
          title: lastSyncedAt
            ? `Última sincronización: ${lastSyncedAt.toLocaleString()}`
            : 'Sincronizado con Google Drive',
        }
    }
  }

  const { dotClass, label, title } = getStatusDetails()

  return (
    <button
      type="button"
      className="sync-indicator-chip"
      onClick={onClick}
      title={title}
      aria-label="Estado de sincronización en la nube"
    >
      <span className={`sync-status-dot ${dotClass}`} />
      <span className="sync-status-label">{label}</span>
    </button>
  )
}
