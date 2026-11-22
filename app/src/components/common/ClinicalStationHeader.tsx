import { useMemo, type ReactNode } from 'react'
import { Lock, Moon, Smartphone, Sun } from 'lucide-react'
import type { Theme } from '../../hooks/useTheme'
import { getSyncStatusDetails, type SyncProgress, type SyncState } from '../../pwa/syncEngine'

export interface ClinicalStationHeaderProps {
  ariaLabel?: string
  theme?: Theme
  userName?: string
  left: ReactNode
  canInstallPwa?: boolean
  onInstallPwa?: () => void
  onToggleTheme?: () => void
  onLockTerminal?: () => void
  isGoogleConnected?: boolean
  isGoogleSessionExpired?: boolean
  googleHasPendingChanges?: boolean
  googleSyncState?: SyncState
  googleSyncProgress?: SyncProgress | null
  googleLastSyncedAt?: Date | null
  onOpenGoogleDriveSync?: () => void
}

const SYNC_STYLE_MAP: Record<string, { dotClass: string; pillClass: string }> = {
  disconnected: {
    dotClass: 'bg-[var(--cl-muted)]',
    pillClass:
      'border-[var(--cl-border)] bg-[var(--cl-surface)] text-[var(--cl-fg-2)] hover:bg-[var(--cl-surface-warm)]',
  },
  syncing: {
    dotClass: 'bg-[var(--cl-diagnostic)] animate-pulse',
    pillClass:
      'border-[var(--cl-accent-border)] bg-[var(--cl-accent-soft)] text-[var(--cl-diagnostic)]',
  },
  paused: {
    dotClass: 'bg-[var(--cl-warn)]',
    pillClass:
      'border-[var(--cl-warn-border)] bg-[var(--cl-warn-soft)] text-[var(--cl-warn)]',
  },
  pending: {
    dotClass: 'bg-[var(--cl-warn)]',
    pillClass:
      'border-[var(--cl-warn-border)] bg-[var(--cl-warn-soft)] text-[var(--cl-warn)]',
  },
  offline: {
    dotClass: 'bg-[var(--cl-muted)]',
    pillClass:
      'border-[var(--cl-border)] bg-[var(--cl-surface)] text-[var(--cl-muted)]',
  },
  error: {
    dotClass: 'bg-[var(--cl-danger)]',
    pillClass:
      'border-[var(--cl-danger-border)] bg-[var(--cl-danger-soft)] text-[var(--cl-danger)]',
  },
  synced: {
    dotClass: 'bg-[var(--cl-success)]',
    pillClass:
      'border-[var(--cl-success-border)] bg-[var(--cl-success-soft)] text-[var(--cl-success)]',
  },
}

/** Cabecera compartida para Inicio y Carpeta, manteniendo alineación y controles globales estables. */
export function ClinicalStationHeader({
  ariaLabel = 'Cabecera de estación clínica',
  theme = 'light',
  userName = 'Médico de Guardia',
  left,
  canInstallPwa = false,
  onInstallPwa,
  onToggleTheme,
  onLockTerminal,
  isGoogleConnected = false,
  isGoogleSessionExpired = false,
  googleHasPendingChanges = false,
  googleSyncState = 'idle',
  googleSyncProgress = null,
  googleLastSyncedAt = null,
  onOpenGoogleDriveSync,
}: ClinicalStationHeaderProps) {
  const isDark = theme === 'dark'

  const driveSummary = useMemo(() => {
    const details = getSyncStatusDetails({
      isConnected: isGoogleConnected,
      isSessionExpired: isGoogleSessionExpired,
      hasPendingChanges: googleHasPendingChanges,
      syncState: googleSyncState,
      syncProgress: googleSyncProgress,
      lastSyncedAt: googleLastSyncedAt,
    })
    const styles = SYNC_STYLE_MAP[details.status] || SYNC_STYLE_MAP.disconnected
    return {
      label: details.label,
      title: details.title,
      dotClass: styles.dotClass,
      pillClass: styles.pillClass,
    }
  }, [
    isGoogleConnected,
    isGoogleSessionExpired,
    googleHasPendingChanges,
    googleSyncState,
    googleSyncProgress,
    googleLastSyncedAt,
  ])

  return (
    <header
      className="relative z-35 flex items-center justify-between gap-4 flex-wrap pb-4 mb-5 border-b border-[var(--cl-border)]"
      aria-label={ariaLabel}
    >
      {left}

      <div className="flex items-center gap-2 flex-wrap shrink-0">
        {onOpenGoogleDriveSync && (
          <button
            type="button"
            onClick={onOpenGoogleDriveSync}
            title={driveSummary.title}
            className={`inline-flex items-center gap-2 min-h-[40px] px-3.5 rounded-full border text-xs font-bold cursor-pointer transition-colors ${driveSummary.pillClass}`}
          >
            <span className={`w-[7px] h-[7px] rounded-full shrink-0 ${driveSummary.dotClass}`} />
            <span>{driveSummary.label}</span>
          </button>
        )}

        {canInstallPwa && onInstallPwa && (
          <button
            type="button"
            onClick={onInstallPwa}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-full border border-[var(--cl-border)] bg-[var(--cl-surface)] hover:bg-[var(--cl-surface-warm)] text-[var(--cl-fg-2)] hover:text-[var(--cl-fg)] text-xs font-semibold cursor-pointer transition-colors"
            title="Instalar SINDECON como aplicación offline"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Instalar App</span>
          </button>
        )}

        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label="Cambiar entre modo diurno y guardia UCI"
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-full border border-[var(--cl-border)] bg-[var(--cl-surface)] hover:bg-[var(--cl-surface-warm)] text-[var(--cl-fg-2)] hover:text-[var(--cl-fg)] text-xs font-semibold cursor-pointer transition-colors"
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span>{isDark ? 'Turno Día' : 'Guardia UCI'}</span>
          </button>
        )}

        {onLockTerminal && (
          <button
            type="button"
            onClick={onLockTerminal}
            aria-label="Bloquear terminal clínico"
            title={`Sesión activa: ${userName}. Clic para bloquear terminal.`}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-full border border-[var(--cl-border)] bg-[var(--cl-surface)] hover:bg-[var(--cl-surface-warm)] text-[var(--cl-fg-2)] hover:text-[var(--cl-fg)] text-xs font-semibold cursor-pointer transition-colors"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Bloquear</span>
          </button>
        )}
      </div>
    </header>
  )
}
