import { useEffect, useRef, useState } from 'react'
import type { NodeRow } from '../../db/db'
import {
  processFilesForBulkImport,
  type ParsedMarkdownArticle,
} from '../../domain/bulkMarkdownImport'
import {
  importBulkArticles,
  type CollisionStrategy,
  type BulkImportResult,
} from '../../db/bulkArticles'

export interface BulkImportModalProps {
  isOpen: boolean
  onClose: () => void
  targetFolderId?: string | null
  nodes: NodeRow[]
  onImportComplete?: (result: BulkImportResult) => void
}

export function BulkImportModal({
  isOpen,
  onClose,
  targetFolderId = null,
  nodes,
  onImportComplete,
}: BulkImportModalProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(targetFolderId ?? null)
  const [collisionStrategy, setCollisionStrategy] = useState<CollisionStrategy>('suffix')
  const [parsedItems, setParsedItems] = useState<ParsedMarkdownArticle[]>([])
  const [isParsing, setIsParsing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const multiFileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const wasOpenRef = useRef(false)

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setSelectedFolderId(targetFolderId ?? null)
      setCollisionStrategy('suffix')
      setParsedItems([])
      setIsParsing(false)
      setIsImporting(false)
      setProgress(null)
      setErrorMessage(null)
      setIsDragOver(false)
    }
    wasOpenRef.current = isOpen

    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isImporting) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, targetFolderId, isImporting, onClose])

  if (!isOpen) return null

  const folders = nodes.filter(
    (n) => n.kind === 'folder' && n.deleted_at === null && n.system !== 'templates'
  )

  const handleFilesSelected = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return
    setIsParsing(true)
    setErrorMessage(null)

    try {
      const items = await processFilesForBulkImport(files)
      if (items.length === 0) {
        setErrorMessage('No se encontraron archivos Markdown (.md, .markdown) o ZIP válidos.')
      } else {
        setParsedItems((prev) => {
          // Evitar duplicados exactos por nombre de archivo / ruta relativa
          const existingKeys = new Set(prev.map((i) => i.relativePath || i.originalFilename))
          const newItems = items.filter(
            (i) => !existingKeys.has(i.relativePath || i.originalFilename)
          )
          return [...prev, ...newItems]
        })
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Error al procesar los archivos seleccionados'
      )
    } finally {
      setIsParsing(false)
      if (multiFileInputRef.current) multiFileInputRef.current.value = ''
      if (folderInputRef.current) folderInputRef.current.value = ''
    }
  }

  const handleRemoveItem = (index: number) => {
    setParsedItems((prev) => prev.filter((_, idx) => idx !== index))
  }

  const handleClearAll = () => {
    setParsedItems([])
    setErrorMessage(null)
  }

  const handleStartImport = async () => {
    if (parsedItems.length === 0 || isImporting) return
    setIsImporting(true)
    setErrorMessage(null)
    setProgress({ current: 0, total: parsedItems.length })

    try {
      const result = await importBulkArticles(parsedItems, {
        parentId: selectedFolderId,
        collisionStrategy,
        onProgress: (current, total) => {
          setProgress({ current, total })
        },
      })

      onImportComplete?.(result)
      onClose()
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Ocurrió un error durante la importación'
      )
    } finally {
      setIsImporting(false)
    }
  }

  const targetFolderNode = folders.find((f) => f.id === selectedFolderId)

  return (
    <div className="dialog-overlay" onClick={isImporting ? undefined : onClose} role="dialog" aria-modal="true">
      <div
        className="dialog-modal bulk-import-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 740, width: '95%' }}
      >
        <div className="dialog-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.3rem' }}>📥</span>
            <h3 style={{ margin: 0 }}>Importación Masiva de Archivos Markdown</h3>
          </div>
          {!isImporting && (
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

        <div className="dialog-body bulk-import-body" style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 'calc(85vh - 130px)', overflowY: 'auto', padding: 20 }}>
          {/* Zona de Arrastrar y Soltar */}
          <div
            className={`bulk-import-dropzone ${isDragOver ? 'drag-over' : ''} ${isParsing ? 'parsing' : ''}`}
            style={{
              border: isDragOver ? '2px dashed var(--accent-primary)' : '2px dashed var(--border-strong)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px 16px',
              textAlign: 'center',
              backgroundColor: isDragOver ? 'var(--accent-surface)' : 'var(--bg-muted)',
              cursor: isImporting || isParsing ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
            }}
            onDragOver={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (!isImporting && !isParsing) setIsDragOver(true)
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
              if (isImporting || isParsing) return
              if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
                void handleFilesSelected(e.dataTransfer.files)
              }
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: 6 }}>📂</div>
            <h4 style={{ margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
              {isParsing
                ? 'Analizando y extrayendo metadatos...'
                : 'Arrastra aquí tus archivos .md, carpetas o archivos .zip'}
            </h4>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              Compatible con Obsidian Vaults, Notion exports, guías clínicas y repositorios Markdown
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-dialog-secondary"
                disabled={isImporting || isParsing}
                onClick={() => multiFileInputRef.current?.click()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                📄 Seleccionar Archivos (.md, .zip)
              </button>

              <button
                type="button"
                className="btn-dialog-secondary"
                disabled={isImporting || isParsing}
                onClick={() => folderInputRef.current?.click()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                📁 Seleccionar Carpeta Completa
              </button>
            </div>

            {/* Inputs de archivo ocultos */}
            <input
              ref={multiFileInputRef}
              type="file"
              multiple
              accept=".md,.markdown,.zip,application/zip,text/markdown"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files) void handleFilesSelected(e.target.files)
              }}
            />
            <input
              ref={folderInputRef}
              type="file"
              multiple
              // @ts-expect-error webkitdirectory es un atributo no estándar soportado por Chrome/Edge/Safari/Firefox
              webkitdirectory=""
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files) void handleFilesSelected(e.target.files)
              }}
            />
          </div>

          {/* Opciones de Configuración: Destino y Política de Duplicados */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 12,
              background: 'var(--bg-elevated)',
              padding: 14,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {/* Carpeta de Destino */}
            <div>
              <label className="dialog-label" style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
                📁 Carpeta de Destino:
              </label>
              <select
                className="dialog-input"
                value={selectedFolderId || ''}
                disabled={isImporting}
                onChange={(e) => setSelectedFolderId(e.target.value || null)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}
              >
                <option value="">(Raíz / Nivel Principal)</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    📁 {f.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Resolución de Duplicados */}
            <div>
              <label className="dialog-label" style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
                ⚙️ Si ya existe un artículo con el mismo título:
              </label>
              <select
                className="dialog-input"
                value={collisionStrategy}
                disabled={isImporting}
                onChange={(e) => setCollisionStrategy(e.target.value as CollisionStrategy)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}
              >
                <option value="suffix">Añadir sufijo numérico (ej. "Nota (1)")</option>
                <option value="skip">Omitir (No importar si existe)</option>
                <option value="overwrite">Sobrescribir contenido existente</option>
              </select>
            </div>
          </div>

          {/* Previsualización del Lote */}
          {parsedItems.length > 0 && (
            <div
              className="bulk-import-preview"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  background: 'var(--bg-muted)',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  📋 {parsedItems.length} {parsedItems.length === 1 ? 'nota detectada' : 'notas detectadas'} para{' '}
                  {targetFolderNode ? `"${targetFolderNode.title}"` : 'la raíz'}
                </span>
                {!isImporting && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Vaciar lista
                  </button>
                )}
              </div>

              <div style={{ maxHeight: 220, overflowY: 'auto', padding: '6px 0' }}>
                {parsedItems.map((item, index) => (
                  <div
                    key={`${item.originalFilename}-${index}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 14px',
                      borderBottom: index < parsedItems.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                      fontSize: '0.85rem',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden', marginRight: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>📄 {item.title}</span>
                        {item.tags.length > 0 && (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {item.tags.map((t) => (
                              <span
                                key={t}
                                style={{
                                  fontSize: '0.72rem',
                                  padding: '1px 6px',
                                  borderRadius: 9999,
                                  background: 'var(--pill-bg)',
                                  color: 'var(--pill-text)',
                                }}
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {item.relativePath || item.originalFilename}
                      </span>
                    </div>

                    {!isImporting && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          fontSize: '1rem',
                          cursor: 'pointer',
                          padding: '2px 6px',
                        }}
                        title="Quitar de la lista"
                        aria-label="Quitar de la lista"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Barra de Progreso durante la Importación */}
          {isImporting && progress && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ fontWeight: 600 }}>Guardando notas en la base de datos...</span>
                <span>
                  {progress.current} / {progress.total} (
                  {Math.round((progress.current / Math.max(progress.total, 1)) * 100)}%)
                </span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: 8,
                  backgroundColor: 'var(--bg-muted)',
                  borderRadius: 4,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    backgroundColor: 'var(--accent-primary)',
                    width: `${(progress.current / Math.max(progress.total, 1)) * 100}%`,
                    transition: 'width 0.15s ease',
                  }}
                />
              </div>
            </div>
          )}

          {/* Mensajes de Error */}
          {errorMessage && (
            <div className="dialog-error-text" style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
              ⚠️ {errorMessage}
            </div>
          )}
        </div>

        <div className="dialog-footer" style={{ padding: '14px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            type="button"
            className="btn-dialog-secondary"
            onClick={onClose}
            disabled={isImporting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn-dialog-primary"
            onClick={handleStartImport}
            disabled={parsedItems.length === 0 || isImporting || isParsing}
          >
            {isImporting
              ? 'Importando…'
              : `📥 Importar ${parsedItems.length > 0 ? `${parsedItems.length} ` : ''}Notas`}
          </button>
        </div>
      </div>
    </div>
  )
}
