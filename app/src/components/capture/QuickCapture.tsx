import { useRef, useState, useEffect } from 'react'
import { createQuickCapture } from '../../db/inbox'

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

  // Limpiar preview cuando se desmonte o cierre
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  // Foco automático en el textarea cuando se abre el modal
  useEffect(() => {
    if (isModalOpen) {
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 60)
    }
  }, [isModalOpen])

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

  const handleSave = async () => {
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
  }

  const handleClose = () => {
    if (externalOnClose) {
      externalOnClose()
    } else {
      setInternalIsOpen(false)
    }
    setNote('')
    setSelectedFile(null)
    setErrorMsg(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
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
    if (file) {
      handleFileChange(file)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleClose()
    }
  }

  const addTagToNote = (tag: string) => {
    const formattedTag = `#${tag} `
    if (!note.includes(formattedTag)) {
      setNote((prev) => (prev.trim() ? `${prev.trim()} ${formattedTag}` : formattedTag))
    }
    textareaRef.current?.focus()
  }

  return (
    <>
      {!hideLauncher && (
        <div className="quick-capture-launcher">
          <button
            type="button"
            className="btn-quick-capture"
            onClick={() => setInternalIsOpen(true)}
            title="Captura rápida a 1 toque (foto + nota) al Inbox"
          >
            📸 Captura rápida
          </button>
        </div>
      )}

      {isModalOpen && (
        <div className="capture-overlay" onClick={handleClose}>
          <div
            className="capture-modal"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-capture-title"
          >
            {/* Cabecera estilizada con indicador visual de Inbox */}
            <header className="capture-header">
              <div className="capture-header-info">
                <div className="capture-header-title-row">
                  <span className="capture-header-icon">📸</span>
                  <h3 id="quick-capture-title">Captura Rápida</h3>
                  <span className="capture-badge-inbox">📥 Inbox</span>
                </div>
                <p className="capture-header-subtitle">
                  Guarda fotos clínicas o notas directas sin clasificar
                </p>
              </div>
              <button
                type="button"
                className="btn-close capture-btn-close"
                onClick={handleClose}
                aria-label="Cerrar ventana de captura"
              >
                ✕
              </button>
            </header>

            <div className="capture-body">
              {errorMsg && <div className="dialog-error-text capture-error">{errorMsg}</div>}

              {/* Botones de acción rápida: Cámara y Galería */}
              <div
                className={`capture-dropzone ${isDragging ? 'dragging' : ''} ${previewUrl ? 'has-preview' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {/* Inputs ocultos */}
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
                  <div className="capture-actions-row">
                    <button
                      type="button"
                      className="btn-camera capture-action-btn"
                      onClick={triggerCamera}
                    >
                      <span className="capture-action-icon">📷</span>
                      <div className="capture-action-text">
                        <strong>Tomar foto</strong>
                        <span>Cámara en planta / guardia</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      className="btn-gallery capture-action-btn"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <span className="capture-action-icon">🖼️</span>
                      <div className="capture-action-text">
                        <strong>Galería / Archivo</strong>
                        <span>O arrastra la imagen aquí</span>
                      </div>
                    </button>
                  </div>
                ) : (
                  <div className="capture-preview-container">
                    <div className="capture-preview-wrapper">
                      <img
                        src={previewUrl}
                        alt="Vista previa de captura médica"
                        className="capture-preview-img"
                      />
                      <button
                        type="button"
                        className="btn-remove-preview"
                        onClick={() => {
                          setSelectedFile(null)
                          if (previewUrl) URL.revokeObjectURL(previewUrl)
                          setPreviewUrl(null)
                        }}
                        title="Eliminar foto adjunta"
                      >
                        ✕ Quitar foto
                      </button>
                    </div>
                    {selectedFile && (
                      <div className="capture-file-meta">
                        <span className="file-name">{selectedFile.name}</span>
                        <span className="file-size">
                          {(selectedFile.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Área de texto para nota clínica */}
              <div className="capture-input-section">
                <textarea
                  ref={textareaRef}
                  className="capture-note-input"
                  placeholder="Escribe una nota rápida, caso, dosis o recordatorio clínico..."
                  rows={4}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />

                {/* Etiquetas rápidas clínicas */}
                <div className="capture-quick-tags-row">
                  <span className="quick-tags-label">Etiquetas rápidas:</span>
                  <div className="quick-tags-pills">
                    {QUICK_TAGS.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className={`btn-quick-tag ${note.includes(`#${tag}`) ? 'active' : ''}`}
                        onClick={() => addTagToNote(tag)}
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer con atajo de teclado y botones principales */}
            <footer className="capture-footer">
              <div className="capture-footer-hint">
                <kbd>Ctrl</kbd>+<kbd>Enter</kbd> para guardar
              </div>
              <div className="capture-footer-actions">
                <button
                  type="button"
                  className="btn-cancel capture-btn-cancel"
                  onClick={handleClose}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-save-inbox capture-btn-save"
                  onClick={handleSave}
                  disabled={saving || (!selectedFile && !note.trim())}
                >
                  {saving ? (
                    <>
                      <span className="capture-spinner" /> Guardando…
                    </>
                  ) : (
                    <>⚡ Guardar en Inbox</>
                  )}
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </>
  )
}
