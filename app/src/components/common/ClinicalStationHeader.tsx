import { useMemo, type ReactNode } from 'react'
import { CalendarDays, Layers, Lock, Moon, ShieldCheck, Smartphone, Sun } from 'lucide-react'
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
  onOpenSecuritySettings?: () => void
  onLockTerminal?: () => void
  onOpenDecks?: () => void
  isGoogleConnected?: boolean
  isGoogleSessionExpired?: boolean
  googleHasPendingChanges?: boolean
  googleSyncState?: SyncState
  googleSyncProgress?: SyncProgress | null
  googleLastSyncedAt?: Date | null
  onOpenGoogleDriveSync?: () => void
  onOpenCalendar?: () => void
  calendarEnabled?: boolean
  calendarOnline?: boolean
  calendarPendingCount?: number
  calendarSessionExpired?: boolean
  calendarNeedsConsent?: boolean
}

const HEADER_ACTION_BTN_CLASS =
  'inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-full border border-[var(--cl-border)] bg-[var(--cl-surface)] hover:bg-[var(--cl-surface-warm)] text-[var(--cl-fg-2)] hover:text-[var(--cl-fg)] text-xs font-semibold cursor-pointer transition-colors'

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
  onOpenSecuritySettings,
  onLockTerminal,
  onOpenDecks,
  isGoogleConnected = false,
  isGoogleSessionExpired = false,
  googleHasPendingChanges = false,
  googleSyncState = 'idle',
  googleSyncProgress = null,
  googleLastSyncedAt = null,
  onOpenGoogleDriveSync,
  onOpenCalendar,
  calendarEnabled = false,
  calendarOnline = true,
  calendarPendingCount = 0,
  calendarSessionExpired = false,
  calendarNeedsConsent = false,
}: ClinicalStationHeaderProps) {
  const isDark = theme === 'dark'

  const calendarSummary = useMemo(() => {
    if (calendarNeedsConsent) {
      return {
        title: 'Agenda: faltan permisos de Google Calendar. Haz clic para autorizar.',
        ariaLabel: 'Agenda: permisos requeridos',
        showDot: true,
        dotClass: SYNC_STYLE_MAP.paused.dotClass,
        pillClass: SYNC_STYLE_MAP.paused.pillClass,
      }
    }
    if (calendarSessionExpired) {
      return {
        title: 'Google Calendar: sesión expirada — clic para reconectar',
        ariaLabel: 'Agenda: sesión expirada',
        showDot: true,
        dotClass: SYNC_STYLE_MAP.paused.dotClass,
        pillClass: SYNC_STYLE_MAP.paused.pillClass,
      }
    }
    if (calendarPendingCount > 0) {
      const pendingText = `${calendarPendingCount} cambio${calendarPendingCount === 1 ? '' : 's'} pendiente${calendarPendingCount === 1 ? '' : 's'}`
      return {
        title: `Google Calendar: ${pendingText}`,
        ariaLabel: `Agenda: ${pendingText}`,
        showDot: true,
        dotClass: SYNC_STYLE_MAP.pending.dotClass,
        pillClass: SYNC_STYLE_MAP.pending.pillClass,
      }
    }
    if (calendarEnabled && !calendarOnline) {
      return {
        title: 'Agenda: sin conexión (modo offline local)',
        ariaLabel: 'Agenda offline',
        showDot: true,
        dotClass: SYNC_STYLE_MAP.offline.dotClass,
        pillClass: SYNC_STYLE_MAP.offline.pillClass,
      }
    }
    if (calendarEnabled) {
      return {
        title: 'Agenda clínica conectada a Google Calendar',
        ariaLabel: 'Agenda conectada',
        showDot: true,
        dotClass: SYNC_STYLE_MAP.synced.dotClass,
        pillClass: SYNC_STYLE_MAP.synced.pillClass,
      }
    }
    return {
      title: 'Abrir o conectar Agenda de Google Calendar',
      ariaLabel: 'Conectar Agenda',
      showDot: false,
      dotClass: SYNC_STYLE_MAP.disconnected.dotClass,
      pillClass: SYNC_STYLE_MAP.disconnected.pillClass,
    }
  }, [
    calendarEnabled,
    calendarOnline,
    calendarPendingCount,
    calendarSessionExpired,
    calendarNeedsConsent,
  ])

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
        {onOpenDecks && (
          <button
            type="button"
            data-testid="header-decks-btn"
            onClick={onOpenDecks}
            className={HEADER_ACTION_BTN_CLASS}
            title="Descargar mazos de estudio EUNACOM"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Mazos</span>
          </button>
        )}

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

        {onOpenCalendar && (
          <button
            type="button"
            data-testid="header-calendar-btn"
            onClick={onOpenCalendar}
            aria-label={calendarSummary.ariaLabel}
            title={calendarSummary.title}
            className={`inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-full border text-xs font-semibold cursor-pointer transition-colors ${calendarSummary.pillClass}`}
          >
            <CalendarDays className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Agenda</span>
            {calendarSummary.showDot && (
              <span
                className={`w-[7px] h-[7px] rounded-full shrink-0 ${calendarSummary.dotClass}`}
                aria-hidden="true"
              />
            )}
          </button>
        )}

        {canInstallPwa && onInstallPwa && (
          <button
            type="button"
            onClick={onInstallPwa}
            className={HEADER_ACTION_BTN_CLASS}
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
            className={HEADER_ACTION_BTN_CLASS}
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span>{isDark ? 'Turno Día' : 'Guardia UCI'}</span>
          </button>
        )}

        {onOpenSecuritySettings && (
          <button
            type="button"
            data-testid="header-security-btn"
            onClick={onOpenSecuritySettings}
            aria-label="Seguridad"
            title="Configurar PIN, FIDO y cuenta Google"
            className={HEADER_ACTION_BTN_CLASS}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Seguridad</span>
          </button>
        )}

        {onLockTerminal && (
          <button
            type="button"
            data-testid="header-lock-btn"
            onClick={onLockTerminal}
            aria-label="Bloquear terminal clínico"
            title={`Sesión activa: ${userName}. Clic para bloquear terminal.`}
            className={HEADER_ACTION_BTN_CLASS}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Bloquear</span>
          </button>
        )}
      </div>
    </header>
  )
}
