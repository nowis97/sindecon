import { Cloud } from 'lucide-react'
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

  const styleByStatus: Record<string, { dotClass: string; pillClass: string }> = {
    disconnected: {
      dotClass: 'bg-slate-400',
      pillClass:
        'border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] text-[var(--ch-text-secondary)]',
    },
    syncing: {
      dotClass: 'bg-[var(--ch-accent)] animate-pulse',
      pillClass:
        'border-[var(--ch-accent)]/35 bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]',
    },
    paused: {
      dotClass: 'bg-amber-500',
      pillClass:
        'border-amber-500/35 bg-amber-500/12 text-amber-800 dark:text-amber-300',
    },
    pending: {
      dotClass: 'bg-amber-500',
      pillClass:
        'border-amber-500/35 bg-amber-500/12 text-amber-800 dark:text-amber-300',
    },
    offline: {
      dotClass: 'bg-slate-400',
      pillClass:
        'border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] text-[var(--ch-text-muted)]',
    },
    error: {
      dotClass: 'bg-red-500',
      pillClass: 'border-red-500/35 bg-red-500/12 text-red-700 dark:text-red-300',
    },
    synced: {
      dotClass: 'bg-emerald-500',
      pillClass:
        'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    },
  }

  const { dotClass, pillClass } = styleByStatus[status] || styleByStatus.disconnected

  return (
    <button
      type="button"
      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 font-mono text-[11px] font-semibold transition hover:border-[var(--ch-accent)] ${pillClass}`}
      onClick={onClick}
      title={title}
      aria-label="Estado de sincronización en la nube"
    >
      <Cloud className="h-3.5 w-3.5 shrink-0" />
      <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
      <span className="truncate">{label}</span>
    </button>
  )
}
