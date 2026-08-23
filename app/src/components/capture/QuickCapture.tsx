import { useRef, useState } from 'react'
import { createQuickCapture } from '../../db/inbox'

interface QuickCaptureProps {
  onCaptureSaved: (articleNodeId: string) => void
}

export function QuickCapture({ onCaptureSaved }: QuickCaptureProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [note, setNote] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (file?: File) => {
    if (!file) return
    setSelectedFile(file)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const handleSave = async () => {
    if (!selectedFile && !note.trim()) return
    setSaving(true)
    try {
      const result = await createQuickCapture({
        file: selectedFile,
        note: note.trim() || undefined,
      })
      onCaptureSaved(result.node.id)
      handleClose()
    } catch (e) {
      window.alert(`Error al guardar en Inbox: ${(e as Error).message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setIsOpen(false)
    setNote('')
    setSelectedFile(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
  }

  const triggerCamera = () => {
    cameraInputRef.current?.click()
  }

  return (
    <>
      <div className="quick-capture-launcher">
        <button
          className="btn-quick-capture"
          onClick={() => setIsOpen(true)}
          title="Captura rápida a 1 toque (foto + nota) al Inbox"
        >
          📷 Captura rápida
        </button>
      </div>

      {isOpen && (
        <div className="capture-overlay" onClick={handleClose}>
          <div className="capture-modal" onClick={(e) => e.stopPropagation()}>
            <header className="capture-header">
              <h3>⚡ Captura Rápida → Inbox</h3>
              <button className="btn-close" onClick={handleClose} aria-label="Cerrar">
                ✕
              </button>
            </header>

            <div className="capture-body">
              <div className="capture-actions-row">
                {/* Input nativo con capture para abrir la cámara directo en móviles */}
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

                <button
                  type="button"
                  className="btn-camera"
                  onClick={triggerCamera}
                >
                  📸 Tomar foto
                </button>
                <button
                  type="button"
                  className="btn-gallery"
                  onClick={() => fileInputRef.current?.click()}
                >
                  🖼 Galería / Archivo
                </button>
              </div>

              {previewUrl && (
                <div className="capture-preview-container">
                  <img src={previewUrl} alt="Vista previa" className="capture-preview-img" />
                  <button
                    type="button"
                    className="btn-remove-preview"
                    onClick={() => {
                      setSelectedFile(null)
                      if (previewUrl) URL.revokeObjectURL(previewUrl)
                      setPreviewUrl(null)
                    }}
                  >
                    Quitar foto
                  </button>
                </div>
              )}

              <textarea
                className="capture-note-input"
                placeholder="Escribe una nota rápida aquí (opcional)..."
                rows={4}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                autoFocus
              />
            </div>

            <footer className="capture-footer">
              <button
                type="button"
                className="btn-cancel"
                onClick={handleClose}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-save-inbox"
                onClick={handleSave}
                disabled={saving || (!selectedFile && !note.trim())}
              >
                {saving ? 'Guardando en Inbox…' : 'Guardar en Inbox'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  )
}
