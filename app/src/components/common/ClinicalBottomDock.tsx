import React from 'react'

export const DOCK_BTN_BASE =
  'min-h-[38px] sm:min-h-[40px] items-center justify-center gap-1.5 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-45'

export const DOCK_BTN_IDLE =
  'text-[var(--ch-text-secondary)] hover:bg-[var(--cl-surface-warm)] hover:text-[var(--ch-text-primary)]'

export const DOCK_BTN_ACTIVE =
  'bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]'

interface ClinicalBottomDockProps {
  ariaLabel: string
  left: React.ReactNode
  right: React.ReactNode
  orbLabel: string
  orbTitle: string
  onOrbClick: () => void
  orbIcon: React.ReactNode
  orbRef?: React.RefObject<HTMLButtonElement | null>
  orbDisabled?: boolean
  dockTrigger?: boolean
  zIndexClass?: string
}

/**
 * Shared floating pill bottom dock with a mathematically centered primary `+` orb.
 * Uses a 3-column symmetric CSS grid (`1fr auto 1fr`) so left/right tools hug the center
 * orb cleanly while keeping the orb dead-center at every viewport width.
 */
export function ClinicalBottomDock({
  ariaLabel,
  left,
  right,
  orbLabel,
  orbTitle,
  onOrbClick,
  orbIcon,
  orbRef,
  orbDisabled = false,
  dockTrigger = false,
  zIndexClass = 'z-30',
}: ClinicalBottomDockProps) {
  return (
    <div
      className={`fixed right-0 bottom-3.5 left-0 flex justify-center px-3.5 pointer-events-none ${zIndexClass}`}
    >
      <nav
        {...(dockTrigger ? { 'data-dock-trigger': '' } : {})}
        aria-label={ariaLabel}
        className="pointer-events-auto grid w-[min(1080px,100%)] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 rounded-full border border-[var(--cl-border)] bg-[var(--cl-surface)]/95 px-2.5 py-1.5 backdrop-blur-md sm:gap-2 sm:px-3.5"
        style={{ boxShadow: 'var(--cl-shadow-dock)' }}
      >
        <div className="flex min-w-0 items-center justify-end gap-1">
          {left}
        </div>

        <button
          ref={orbRef}
          type="button"
          disabled={orbDisabled}
          onClick={onOrbClick}
          aria-label={orbLabel}
          title={orbTitle}
          className="mx-0.5 -my-3 flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full border-[3px] border-[var(--cl-surface)] bg-[var(--ch-accent-solid)] text-white transition-all hover:scale-105 hover:bg-[var(--cl-accent-hover)] disabled:cursor-not-allowed disabled:opacity-45 sm:mx-1 sm:-my-3.5 sm:h-14 sm:w-14"
          style={{ boxShadow: '0 6px 18px rgba(15, 118, 110, 0.34)' }}
        >
          {orbIcon}
        </button>

        <div className="flex min-w-0 items-center justify-start gap-1">
          {right}
        </div>
      </nav>
    </div>
  )
}
