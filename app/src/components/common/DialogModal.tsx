import { useEffect, useRef, useState } from 'react'

interface BaseModalProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
}

export function BaseModal({ isOpen, onClose, children, title }: BaseModalProps) {
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="dialog-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="dialog-modal" onClick={(e) => e.stopPropagation()}>
        {title && (
          <header className="dialog-header">
            <h3>{title}</h3>
            <button
              type="button"
              className="dialog-btn-close"
              onClick={onClose}
              aria-label="Cerrar"
            >
              ✕
            </button>
          </header>
        )}
        {children}
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
    <form onSubmit={handleSubmit}>
      <div className="dialog-body">
        {label && <label className="dialog-label">{label}</label>}
        <input
          ref={inputRef}
          type="text"
          className="dialog-input"
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      <footer className="dialog-footer">
        <button type="button" className="btn-dialog-secondary" onClick={onClose}>
          Cancelar
        </button>
        <button
          type="submit"
          className="btn-dialog-primary"
          disabled={!value.trim()}
        >
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
    <BaseModal isOpen={isOpen} onClose={onClose} title={title}>
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
    <BaseModal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="dialog-body">
        <p className="dialog-message">{message}</p>
      </div>
      <footer className="dialog-footer">
        <button type="button" className="btn-dialog-secondary" onClick={onClose}>
          {cancelText}
        </button>
        <button
          type="button"
          className={isDestructive ? 'btn-dialog-danger' : 'btn-dialog-primary'}
          onClick={() => {
            onConfirm()
            onClose()
          }}
          autoFocus
        >
          {confirmText}
        </button>
      </footer>
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
    <BaseModal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="dialog-body">
        {typeof content === 'string' ? (
          <div className="dialog-text-content">{content}</div>
        ) : (
          content
        )}
      </div>
      <footer className="dialog-footer">
        <button
          type="button"
          className="btn-dialog-primary"
          onClick={onClose}
          autoFocus
        >
          {buttonText}
        </button>
      </footer>
    </BaseModal>
  )
}
