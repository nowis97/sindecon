import { Cloud } from 'lucide-react'
import type { SyncState, SyncProgress } from '../../pwa/syncEngine'

interface SyncIndicatorProps {
  isConnected: boolean
  isSessionExpired?: boolean
  syncState: SyncState
  syncProgress?: SyncProgress | null
  lastSyncedAt: Date | null
  onClick: () => void
}

export function SyncIndicator({
  isConnected,
  isSessionExpired = false,
  syncState,
  syncProgress,
  lastSyncedAt,
  onClick,
}: SyncIndicatorProps) {
  const getStatusDetails = () => {
    if (!isConnected) {
      return {
        dotClass: 'bg-slate-400',
        pillClass:
          'border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] text-[var(--ch-text-secondary)]',
        label: 'Drive',
        title:
          'Google Drive no conectado. Haz clic para activar sincronización y backup automático.',
      }
    }

    if (isSessionExpired) {
      return {
        dotClass: 'bg-amber-500',
        pillClass:
          'border-amber-500/35 bg-amber-500/12 text-amber-800 dark:text-amber-300',
        label: 'Drive (pausa)',
        title:
          'Sesión de Google Drive en pausa (token expirado). Haz clic para reconectar y sincronizar.',
      }
    }

    switch (syncState) {
      case 'syncing':
      case 'checking': {
        const percent =
          syncProgress?.percent !== undefined ? Math.round(syncProgress.percent) : null
        return {
          dotClass: 'bg-[var(--ch-accent)] animate-pulse',
          pillClass:
            'border-[var(--ch-accent)]/35 bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]',
          label: percent !== null ? `Sync ${percent}%` : 'Sincronizando…',
          title: syncProgress?.message
            ? `${syncProgress.message} (${percent ?? 0}%)`
            : 'Sincronizando cambios en segundo plano con Google Drive…',
        }
      }
      case 'offline':
        return {
          dotClass: 'bg-slate-400',
          pillClass:
            'border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] text-[var(--ch-text-muted)]',
          label: 'Offline',
          title: 'Modo Offline. Los cambios se guardan localmente y se sincronizarán al reconectar.',
        }
      case 'error':
        return {
          dotClass: 'bg-red-500',
          pillClass: 'border-red-500/35 bg-red-500/12 text-red-700 dark:text-red-300',
          label: 'Error Sync',
          title: 'Error de sincronización con Google Drive. Haz clic para ver detalles y reintentar.',
        }
      case 'idle':
      default:
        return {
          dotClass: 'bg-emerald-500',
          pillClass:
            'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
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

  const { dotClass, pillClass, label, title } = getStatusDetails()

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
