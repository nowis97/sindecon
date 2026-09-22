import React, { useEffect, useRef, useState } from 'react'
import type { NodeRow } from '../../db/db'
import {
  cleanPdfFilenameToTitle,
  isPdfFile,
  formatPdfFileSize,
} from '../../domain/pdfUpload'
import {
  saveMultiplePdfsAsArticles,
  type SavedPdfArticleResult,
} from '../../db/pdfArticles'

export interface UploadPdfModalProps {
  isOpen: boolean
  onClose: () => void
  targetFolderId?: string | null
  nodes: NodeRow[]
  onUploadComplete?: (results: SavedPdfArticleResult[]) => void
}

interface PdfUploadItem {
  id: string
  file: File
  title: string
  sizeFormatted: string
}

export const UploadPdfModal: React.FC<UploadPdfModalProps> = ({
  isOpen,
  onClose,
  targetFolderId = null,
  nodes,
  onUploadComplete,
}) => {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(targetFolderId ?? null)
  const [items, setItems] = useState<PdfUploadItem[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const wasOpenRef = useRef(false)

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setSelectedFolderId(targetFolderId ?? null)
      setItems([])
      setIsUploading(false)
      setProgress(null)
      setErrorMessage(null)
      setIsDragOver(false)
    }
    wasOpenRef.current = isOpen

    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isUploading) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, targetFolderId, isUploading, onClose])

  if (!isOpen) return null

  const folders = nodes.filter(
    (n) => n.kind === 'folder' && n.deleted_at === null && n.system !== 'templates'
  )

  const handleFilesSelected = (selectedFiles: FileList | File[]) => {
    if (!selectedFiles || selectedFiles.length === 0) return
    setErrorMessage(null)

    const fileArray = Array.from(selectedFiles)
    const validPdfFiles = fileArray.filter((f) => isPdfFile(f))

    if (validPdfFiles.length === 0) {
      setErrorMessage('Solo se admiten archivos en formato PDF (.pdf).')
      return
    }

    if (validPdfFiles.length < fileArray.length) {
      setErrorMessage(
        `Se descartaron ${fileArray.length - validPdfFiles.length} archivo(s) por no ser PDF.`
      )
    }

    const newItems: PdfUploadItem[] = validPdfFiles.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      title: cleanPdfFilenameToTitle(file.name),
      sizeFormatted: formatPdfFileSize(file.size),
    }))

    setItems((prev) => [...prev, ...newItems])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleTitleChange = (id: string, newTitle: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, title: newTitle } : item))
    )
  }

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  const handleClearAll = () => {
    setItems([])
    setErrorMessage(null)
  }

  const handleStartUpload = async () => {
    if (items.length === 0 || isUploading) return
    setIsUploading(true)
    setErrorMessage(null)
    setProgress({ current: 0, total: items.length })

    try {
      const results = await saveMultiplePdfsAsArticles(
        items.map((i) => ({
          file: i.file,
          filename: i.file.name,
          title: i.title.trim() || cleanPdfFilenameToTitle(i.file.name),
          parentId: selectedFolderId,
        })),
        (current, total) => {
          setProgress({ current, total })
        }
      )

      onUploadComplete?.(results)
      onClose()
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Ocurrió un error al subir los archivos PDF'
      )
    } finally {
      setIsUploading(false)
    }
  }

  const targetFolderNode = folders.find((f) => f.id === selectedFolderId)

  return (
    <div
      className="dialog-overlay"
      onClick={isUploading ? undefined : onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="dialog-modal upload-pdf-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.3rem' }}>📄</span>
            <h3 style={{ margin: 0 }}>Subir Documentos PDF</h3>
          </div>
          {!isUploading && (
            <button
              type="button"
              className="dialog-btn-close"
              onClick={onClose}
              aria-label="Cerrar"
            >
              ✕
            </button>
          )}
        </div>

        <div
          className="dialog-body"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            maxHeight: 'calc(85vh - 130px)',
            overflowY: 'auto',
            padding: 20,
          }}
        >
          {/* Selector de Carpeta de Destino */}
          <div className="folder-select-group" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              📁 Carpeta de destino:
            </label>
            <select
              value={selectedFolderId ?? ''}
              onChange={(e) => setSelectedFolderId(e.target.value ? e.target.value : null)}
              disabled={isUploading}
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            >
              <option value="">Raíz del árbol de conocimientos (Tema)</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  📁 {f.title}
                </option>
              ))}
            </select>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {selectedFolderId
                ? `Los PDFs se crearán como artículos dentro de "${targetFolderNode?.title || 'Carpeta seleccionada'}".`
                : 'Los PDFs se crearán como artículos principales en la raíz.'}
            </span>
          </div>

          {/* Zona Drag & Drop */}
          <div
            className={`upload-pdf-dropzone ${isDragOver ? 'drag-over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (!isUploading) setIsDragOver(true)
            }}
            onDragLeave={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIsDragOver(false)
            }}
            onDrop={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIsDragOver(false)
              if (isUploading) return
              if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
                handleFilesSelected(e.dataTransfer.files)
              }
            }}
            onClick={() => !isUploading && fileInputRef.current?.click()}
          >
            <div style={{ fontSize: '2.2rem', marginBottom: 4 }}>📑</div>
            <h4 style={{ margin: '0 0 4px 0', color: 'var(--text-primary)', fontSize: '0.96rem', fontWeight: 600 }}>
              Arrastra aquí tus archivos PDF o haz clic para explorar
            </h4>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Puedes seleccionar uno o varios documentos (.pdf) simultáneamente
            </p>
            <button
              type="button"
              className="upload-pdf-browse-btn"
              disabled={isUploading}
              onClick={(e) => {
                e.stopPropagation()
                fileInputRef.current?.click()
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span>Explorar archivos PDF</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,application/pdf"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFilesSelected(e.target.files)
                }
              }}
            />
          </div>

          {/* Mensaje de Error */}
          {errorMessage && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>⚠️</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Barra de Progreso */}
          {isUploading && progress && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                <span>Guardando documentos PDF en almacenamiento local...</span>
                <span>{progress.current} / {progress.total}</span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: 6,
                  backgroundColor: 'var(--bg-muted)',
                  borderRadius: 3,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    backgroundColor: 'var(--accent-primary)',
                    width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
                    transition: 'width 0.2s ease',
                  }}
                />
              </div>
            </div>
          )}

          {/* Lista de Documentos Seleccionados */}
          {items.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Documentos listos para subir ({items.length}):
                </span>
                {!isUploading && (
                  <button
                    type="button"
                    className="btn-upload-pdf-clear"
                    onClick={handleClearAll}
                    title="Descartar todos los archivos de la lista"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                    <span>Quitar todos</span>
                  </button>
                )}
              </div>

              <div className="upload-pdf-list">
                {items.map((item) => (
                  <div key={item.id} className="upload-pdf-item">
                    <span className="upload-pdf-item-icon">📄</span>
                    <div className="upload-pdf-item-details">
                      <input
                        type="text"
                        className="upload-pdf-item-input"
                        value={item.title}
                        onChange={(e) => handleTitleChange(item.id, e.target.value)}
                        disabled={isUploading}
                        placeholder="Título del artículo..."
                        title="Puedes cambiar el título antes de subir"
                      />
                      <div className="upload-pdf-item-meta">
                        <span>Original: {item.file.name}</span>
                        <span>•</span>
                        <span>{item.sizeFormatted}</span>
                      </div>
                    </div>
                    {!isUploading && (
                      <button
                        type="button"
                        className="btn-upload-pdf-remove"
                        onClick={() => handleRemoveItem(item.id)}
                        title="Descartar este PDF"
                        aria-label={`Descartar ${item.title}`}
                      >
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2m-6 5v6m4-6v6" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button
            type="button"
            className="btn-dialog-secondary dialog-btn-secondary"
            onClick={onClose}
            disabled={isUploading}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn-dialog-primary dialog-btn-primary"
            onClick={handleStartUpload}
            disabled={isUploading || items.length === 0}
          >
            {isUploading ? (
              <>
                <span className="btn-spinner" aria-hidden="true" />
                <span>Guardando documentos...</span>
              </>
            ) : (
              <>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span>
                  {items.length === 1
                    ? 'Subir 1 documento PDF'
                    : `Subir ${items.length} documentos PDF`}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
