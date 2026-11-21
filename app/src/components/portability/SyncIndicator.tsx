import { getSyncStatusDetails, type SyncState, type SyncProgress } from '../../pwa/syncEngine'

interface SyncIndicatorProps {
  isConnected: boolean
  isSessionExpired?: boolean
  hasPendingChanges?: boolean
  syncState: SyncState
  syncProgress?: SyncProgress | null
  lastSyncedAt: Date | null
  onClick: () => void
}

export function SyncIndicator({
  isConnected,
  isSessionExpired = false,
  hasPendingChanges = false,
  syncState,
  syncProgress,
  lastSyncedAt,
  onClick,
}: SyncIndicatorProps) {
  const { status, label, title } = getSyncStatusDetails({
    isConnected,
    isSessionExpired,
    hasPendingChanges,
    syncState,
    syncProgress,
    lastSyncedAt,
  })

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
      {status === 'syncing' && syncProgress && (
        <span
          className="sync-chip-progress-bar"
          style={{ width: `${Math.max(5, Math.min(100, syncProgress.percent))}%` }}
        />
      )}
    </button>
  )
}
