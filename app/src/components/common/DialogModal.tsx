import { useEffect, useRef, useState } from 'react'
import {
  X,
  FolderPlus,
  FilePlus,
  Pencil,
  Trash2,
  AlertTriangle,
  FileText,
  Info,
} from 'lucide-react'

export const PILL_BTN_PRIMARY =
  'inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-[var(--ch-accent)] px-5 text-xs font-semibold text-white shadow-xs transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-45'

export const PILL_BTN_SECONDARY =
  'inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] px-4 text-xs font-semibold text-[var(--ch-text-secondary)] transition hover:border-[var(--ch-accent)] hover:text-[var(--ch-text-primary)] disabled:cursor-not-allowed disabled:opacity-45'

export const PILL_BTN_DANGER =
  'inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-red-600 px-5 text-xs font-semibold text-white shadow-xs transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-45'

export const PILL_INPUT_CLASS =
  'h-11 w-full rounded-full border border-[var(--ch-border-strong)] bg-[var(--ch-bg-primary)] px-4 text-sm text-[var(--ch-text-primary)] outline-none transition placeholder:text-[var(--ch-text-muted)] focus:border-[var(--ch-accent)] focus:ring-2 focus:ring-[var(--ch-accent)]/20 disabled:opacity-50'

export const CLINICAL_FIELD_CLASS =
  'h-10 w-full rounded-xl border border-[var(--ch-border-strong)] bg-[var(--ch-bg-primary)] px-3.5 text-xs font-medium text-[var(--ch-text-primary)] outline-none transition placeholder:text-[var(--ch-text-muted)] focus:border-[var(--ch-accent)] focus:ring-2 focus:ring-[var(--ch-accent)]/20 disabled:opacity-50'

function sanitizeDialogTitle(raw: string): string {
  return raw
    .replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\s]+/gu, '')
    .trim()
}

function inferDialogIcon(rawTitle: string, tone: 'accent' | 'danger' | 'warning'): React.ReactNode {
  const lower = rawTitle.toLowerCase()
  if (tone === 'danger' || lower.includes('eliminar')) {
    return <Trash2 className="h-5 w-5" />
  }
  if (tone === 'warning' || lower.includes('notificaci') || lower.includes('alerta')) {
    return <AlertTriangle className="h-5 w-5" />
  }
  if (lower.includes('carpeta')) return <FolderPlus className="h-5 w-5" />
  if (lower.includes('renombrar')) return <Pencil className="h-5 w-5" />
  if (lower.includes('artículo') || lower.includes('articulo') || lower.includes('desde')) {
    return <FilePlus className="h-5 w-5" />
  }
  return <FileText className="h-5 w-5" />
}

export interface BaseModalProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  title?: React.ReactNode
  subtitle?: React.ReactNode
  icon?: React.ReactNode
  tone?: 'accent' | 'danger' | 'warning'
  maxWidthClass?: string
  closeOnBackdrop?: boolean
  hideCloseButton?: boolean
  footer?: React.ReactNode
  titleId?: string
  bodyClassName?: string
}

export function BaseModal({
  isOpen,
  onClose,
  children,
  title,
  subtitle,
  icon,
  tone = 'accent',
  maxWidthClass = 'max-w-md',
  closeOnBackdrop = true,
  hideCloseButton = false,
  footer,
  titleId,
  bodyClassName = 'px-5 py-4 sm:px-6',
}: BaseModalProps) {
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnBackdrop) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, closeOnBackdrop])

  if (!isOpen) return null

  const stringTitle = typeof title === 'string' ? title : ''
  const displayTitle = typeof title === 'string' ? sanitizeDialogTitle(title) : title
  const resolvedIcon =
    icon ?? (stringTitle ? inferDialogIcon(stringTitle, tone) : <Info className="h-5 w-5" />)

  const iconWrapClass =
    tone === 'danger'
      ? 'bg-red-500/12 text-red-600 dark:text-red-400'
      : tone === 'warning'
        ? 'bg-amber-500/14 text-amber-600 dark:text-amber-300'
        : 'bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-xs sm:p-4"
      onClick={closeOnBackdrop ? onClose : undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className={`clinical-home flex max-h-[90vh] w-full ${maxWidthClass} flex-col overflow-hidden rounded-[22px] border border-[var(--ch-border-strong)] bg-[var(--ch-bg-elevated)] text-[var(--ch-text-primary)] shadow-[var(--ch-shadow-modal)]`}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || !hideCloseButton) && (
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--ch-border-subtle)] px-5 py-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              {resolvedIcon && (
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconWrapClass}`}
                >
                  {resolvedIcon}
                </span>
              )}
              <div className="min-w-0">
                {displayTitle && (
                  <h3
                    id={titleId}
                    className="truncate font-serif text-lg font-semibold tracking-tight text-[var(--ch-text-primary)]"
                  >
                    {displayTitle}
                  </h3>
                )}
                {subtitle && (
                  <p className="mt-0.5 text-xs text-[var(--ch-text-muted)]">{subtitle}</p>
                )}
              </div>
            </div>

            {!hideCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] text-[var(--ch-text-muted)] transition hover:border-[var(--ch-accent)] hover:text-[var(--ch-text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </header>
        )}

        <div className={`min-h-0 flex-1 overflow-y-auto ${bodyClassName}`}>{children}</div>

        {footer && (
          <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2.5 border-t border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/45 px-5 py-3.5 sm:px-6">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}

interface PromptDialogProps {
  isOpen: boolean
  title: string
  label?: string
  placeholder?: string
  initialValue?: string
  confirmText?: string
  onConfirm: (value: string) => void
  onClose: () => void
}

function PromptForm({
  label,
  placeholder,
  initialValue = '',
  confirmText = 'Guardar',
  onConfirm,
  onClose,
}: Omit<PromptDialogProps, 'isOpen' | 'title'>) {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!value.trim()) return
    onConfirm(value.trim())
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {label && (
          <label className="text-xs font-semibold text-[var(--ch-text-secondary)]">
            {label}
          </label>
        )}
        <input
          ref={inputRef}
          type="text"
          className={PILL_INPUT_CLASS}
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      <footer className="flex items-center justify-end gap-2.5 pt-1">
        <button type="button" className={PILL_BTN_SECONDARY} onClick={onClose}>
          Cancelar
        </button>
        <button type="submit" className={PILL_BTN_PRIMARY} disabled={!value.trim()}>
          {confirmText}
        </button>
      </footer>
    </form>
  )
}

export function PromptDialog({
  isOpen,
  title,
  label,
  placeholder,
  initialValue = '',
  confirmText = 'Guardar',
  onConfirm,
  onClose,
}: PromptDialogProps) {
  if (!isOpen) return null

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title={title} maxWidthClass="max-w-md">
      <PromptForm
        key={`${title}-${initialValue}`}
        label={label}
        placeholder={placeholder}
        initialValue={initialValue}
        confirmText={confirmText}
        onConfirm={onConfirm}
        onClose={onClose}
      />
    </BaseModal>
  )
}

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  isDestructive?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  isDestructive = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      tone={isDestructive ? 'danger' : 'accent'}
      maxWidthClass="max-w-md"
      footer={
        <>
          <button type="button" className={PILL_BTN_SECONDARY} onClick={onClose}>
            {cancelText}
          </button>
          <button
            type="button"
            className={isDestructive ? PILL_BTN_DANGER : PILL_BTN_PRIMARY}
            onClick={() => {
              onConfirm()
              onClose()
            }}
            autoFocus
          >
            {confirmText}
          </button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-[var(--ch-text-secondary)]">{message}</p>
    </BaseModal>
  )
}

interface AlertDialogProps {
  isOpen: boolean
  title: string
  content: string | React.ReactNode
  buttonText?: string
  onClose: () => void
}

export function AlertDialog({
  isOpen,
  title,
  content,
  buttonText = 'Entendido',
  onClose,
}: AlertDialogProps) {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      tone="warning"
      maxWidthClass="max-w-md"
      footer={
        <button type="button" className={PILL_BTN_PRIMARY} onClick={onClose} autoFocus>
          {buttonText}
        </button>
      }
    >
      {typeof content === 'string' ? (
        <p className="text-sm leading-relaxed text-[var(--ch-text-secondary)]">{content}</p>
      ) : (
        <div className="text-sm leading-relaxed text-[var(--ch-text-secondary)]">{content}</div>
      )}
    </BaseModal>
  )
}
