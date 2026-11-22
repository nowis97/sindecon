import { Sparkles, RefreshCw, X } from 'lucide-react'

interface UpdateToastProps {
  needRefresh: boolean
  onUpdate: () => void
  onDismiss: () => void
}

export function UpdateToast({ needRefresh, onUpdate, onDismiss }: UpdateToastProps) {
  if (!needRefresh) return null

  return (
    <div
      className="clinical-home fixed right-4 bottom-20 left-4 z-50 mx-auto flex max-w-lg flex-wrap items-center justify-between gap-3 rounded-[22px] border border-[var(--ch-border-strong)] bg-[var(--ch-bg-elevated)] px-4 py-3 text-[var(--ch-text-primary)] shadow-[var(--ch-shadow-modal)] sm:left-auto"
      role="alert"
      aria-live="polite"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <strong className="block font-display text-sm font-semibold text-[var(--ch-text-primary)]">
            Nueva versión clínica disponible
          </strong>
          <span className="block text-xs text-[var(--ch-text-muted)]">
            Actualiza cuando termines para aplicar las mejoras.
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--ch-accent-solid)] px-4 text-xs font-semibold text-white shadow-xs transition hover:opacity-95"
          onClick={onUpdate}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Actualizar</span>
        </button>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] text-[var(--ch-text-muted)] transition hover:text-[var(--ch-text-primary)]"
          onClick={onDismiss}
          aria-label="Cerrar aviso de actualización"
          title="Posponer actualización"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
