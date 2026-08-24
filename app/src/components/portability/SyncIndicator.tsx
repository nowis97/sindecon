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
        status: 'disconnected',
        label: 'Drive',
        title: 'Google Drive no conectado. Haz click para activar sincronización y backup automático.',
      }
    }

    switch (syncState) {
      case 'syncing':
      case 'checking':
        return {
          status: 'syncing',
          label: 'Sincronizando…',
          title: 'Sincronizando cambios en segundo plano con Google Drive…',
        }
      case 'offline':
        return {
          status: 'offline',
          label: 'Offline',
          title: 'Modo Offline. Los cambios se guardan localmente y se sincronizarán al reconectar.',
        }
      case 'error':
        return {
          status: 'error',
          label: 'Error Sync',
          title: 'Error de sincronización con Google Drive. Haz click para ver detalles y reintentar.',
        }
      case 'idle':
      default:
        return {
          status: 'synced',
          label: lastSyncedAt
            ? `Sync ${lastSyncedAt.toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
              })}`
            : 'Al día',
          title: lastSyncedAt
            ? `Última sincronización con Google Drive: ${lastSyncedAt.toLocaleString()}`
            : 'Sincronizado con Google Drive (Local-First)',
        }
    }
  }

  const { status, label, title } = getStatusDetails()

  return (
    <button
      type="button"
      className={`sync-indicator-chip sync-status-${status}`}
      onClick={onClick}
      title={title}
      aria-label="Estado de sincronización en la nube"
    >
      <svg
        className="sync-chip-cloud-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
      </svg>
      <span className={`sync-status-dot dot-${status}`} />
      <span className="sync-status-label">{label}</span>
    </button>
  )
}
