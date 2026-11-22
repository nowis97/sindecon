import { useRef, useState, useEffect, useCallback } from 'react'
import {
  Camera,
  ImagePlus,
  Inbox,
  X,
  Tag,
  Check,
  AlertTriangle,
} from 'lucide-react'
import { createQuickCapture } from '../../db/inbox'
import { PILL_BTN_PRIMARY, PILL_BTN_SECONDARY } from '../common/DialogModal'

interface QuickCaptureProps {
  onCaptureSaved: (articleNodeId: string) => void
  isOpen?: boolean
  onClose?: () => void
  hideLauncher?: boolean
}

const QUICK_TAGS = ['Urgencias', 'Farmaco', 'Protocolo', 'Planta', 'Pendiente']

export function QuickCapture({
  onCaptureSaved,
  isOpen: externalIsOpen,
  onClose: externalOnClose,
  hideLauncher = false,
}: QuickCaptureProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const [note, setNote] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isModalOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleClose = useCallback(() => {
    if (externalOnClose) {
      externalOnClose()
    }
    setInternalIsOpen(false)
    setNote('')
    setSelectedFile(null)
    setErrorMsg(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
  }, [externalOnClose, previewUrl])

  const handleSave = useCallback(async () => {
    if (!selectedFile && !note.trim()) return
    setSaving(true)
    setErrorMsg(null)
    try {
      const result = await createQuickCapture({
        file: selectedFile,
        note: note.trim() || undefined,
      })
      onCaptureSaved(result.node.id)
      handleClose()
    } catch (e) {
      setErrorMsg(`Error al guardar en Inbox: ${(e as Error).message}`)
    } finally {
      setSaving(false)
    }
  }, [selectedFile, note, onCaptureSaved, handleClose])

  useEffect(() => {
    if (!isModalOpen) return

    setTimeout(() => {
      textareaRef.current?.focus()
    }, 60)

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        void handleSave()
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [isModalOpen, handleClose, handleSave])

  const handleFileChange = (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Por favor selecciona un archivo de imagen válido (JPEG, PNG, WebP).')
      return
    }
    setSelectedFile(file)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(file))
    setErrorMsg(null)
  }

  const triggerCamera = () => {
    cameraInputRef.current?.click()
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileChange(file)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose()
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      void handleSave()
    }
  }

  const handleAddTag = (tag: string) => {
    const formattedTag = `#${tag}`
    if (!note.includes(formattedTag)) {
      setNote((prev) => (prev.trim() ? `${prev.trim()} ${formattedTag}` : formattedTag))
    }
    textareaRef.current?.focus()
  }

  if (hideLauncher && !isModalOpen) {
    return null
  }

  return (
    <>
      {!hideLauncher && (
        <div className="quick-capture-launcher">
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--ch-accent-solid)] px-4 text-xs font-semibold text-white shadow-xs transition hover:opacity-95"
            onClick={() => setInternalIsOpen(true)}
            title="Captura rápida a 1 toque (foto + nota) al Inbox"
          >
            <Camera className="h-3.5 w-3.5" />
            <span>Captura rápida</span>
          </button>
        </div>
      )}

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-xs sm:p-4"
          onClick={handleClose}
        >
          <div
            className="clinical-home flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-[22px] border border-[var(--ch-border-strong)] bg-[var(--ch-bg-elevated)] text-[var(--ch-text-primary)] shadow-[var(--ch-shadow-modal)]"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-capture-title"
          >
            {/* Clinical Header */}
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--ch-border-subtle)] px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]">
                  <Camera className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3
                      id="quick-capture-title"
                      className="font-display text-lg font-semibold tracking-tight text-[var(--ch-text-primary)]"
                    >
                      Captura Rápida de Guardia
                    </h3>
                    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--ch-accent)]/30 bg-[var(--ch-accent-soft)] px-2 py-0.5 font-mono text-[10px] font-semibold text-[var(--ch-accent)]">
                      <Inbox className="h-3 w-3" />
                      <span>Inbox</span>
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--ch-text-muted)]">
                    Guarda fotos clínicas, ECGs o notas directas para clasificar después
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Cerrar ventana de captura"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] text-[var(--ch-text-muted)] transition hover:border-[var(--ch-accent)] hover:text-[var(--ch-text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex flex-col gap-4 p-5">
              {errorMsg && (
                <div className="flex items-center gap-2 rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Camera & Gallery Dropzone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`rounded-xl border-2 border-dashed p-3 transition ${
                  isDragging
                    ? 'border-[var(--ch-accent)] bg-[var(--ch-accent-soft)]'
                    : 'border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/60'
                }`}
              >
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileChange(e.target.files?.[0])}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileChange(e.target.files?.[0])}
                />

                {!previewUrl ? (
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={triggerCamera}
                      className="flex items-center gap-3 rounded-xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] p-3 text-left transition hover:border-[var(--ch-accent)] hover:bg-[var(--ch-accent-soft)]/50"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]">
                        <Camera className="h-5 w-5" />
                      </span>
                      <div>
                        <strong className="block text-xs font-semibold text-[var(--ch-text-primary)]">
                          Tomar foto clínica
                        </strong>
                        <span className="text-[11px] text-[var(--ch-text-muted)]">
                          Cámara en planta / guardia
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-3 rounded-xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] p-3 text-left transition hover:border-[var(--ch-accent)] hover:bg-[var(--ch-accent-soft)]/50"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]">
                        <ImagePlus className="h-5 w-5" />
                      </span>
                      <div>
                        <strong className="block text-xs font-semibold text-[var(--ch-text-primary)]">
                          Galería / Archivo
                        </strong>
                        <span className="text-[11px] text-[var(--ch-text-muted)]">
                          O arrastra la imagen aquí
                        </span>
                      </div>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="relative overflow-hidden rounded-lg border border-[var(--ch-border-subtle)] bg-black/5">
                      <img
                        src={previewUrl}
                        alt="Vista previa de captura médica"
                        className="max-h-52 w-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFile(null)
                          if (previewUrl) URL.revokeObjectURL(previewUrl)
                          setPreviewUrl(null)
                        }}
                        title="Eliminar foto adjunta"
                        className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-slate-900/80 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-600"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>Quitar foto</span>
                      </button>
                    </div>
                    {selectedFile && (
                      <div className="flex items-center justify-between px-1 font-mono text-[11px] text-[var(--ch-text-muted)]">
                        <span className="truncate">{selectedFile.name}</span>
                        <span>{(selectedFile.size / 1024).toFixed(1)} KB</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Clinical Note Textarea & Quick Tags */}
              <div className="flex flex-col gap-2.5">
                <textarea
                  ref={textareaRef}
                  placeholder="Escribe una nota rápida, caso, dosis o recordatorio clínico…"
                  rows={4}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full rounded-xl border border-[var(--ch-border-strong)] bg-[var(--ch-bg-primary)] p-3 text-xs leading-relaxed text-[var(--ch-text-primary)] outline-none placeholder:text-[var(--ch-text-muted)] focus:border-[var(--ch-accent)]"
                />

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold tracking-wider text-[var(--ch-text-muted)] uppercase">
                    <Tag className="h-3 w-3 text-[var(--ch-accent)]" />
                    <span>Etiquetas rápidas:</span>
                  </span>
                  {QUICK_TAGS.map((tag) => {
                    const isActive = note.includes(`#${tag}`)
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleAddTag(tag)}
                        className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium transition ${
                          isActive
                            ? 'border-[var(--ch-accent)] bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]'
                            : 'border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] text-[var(--ch-text-secondary)] hover:border-[var(--ch-accent)]'
                        }`}
                      >
                        #{tag}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <footer className="flex shrink-0 items-center justify-between border-t border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/45 px-5 py-3.5 sm:px-6">
              <div className="font-mono text-[11px] text-[var(--ch-text-muted)]">
                <kbd className="rounded border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] px-1.5 py-0.5">
                  Ctrl
                </kbd>
                +
                <kbd className="rounded border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] px-1.5 py-0.5">
                  Enter
                </kbd>{' '}
                para guardar
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={saving}
                  className={PILL_BTN_SECONDARY}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving || (!selectedFile && !note.trim())}
                  className={PILL_BTN_PRIMARY}
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>{saving ? 'Guardando…' : 'Guardar en Inbox'}</span>
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </>
  )
}
