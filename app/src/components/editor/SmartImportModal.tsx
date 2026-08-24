import { useEffect, useMemo, useRef, useState } from 'react'
import type { NodeRow } from '../../db/db'
import {
  processImportText,
  parseDocxFile,
  extractSuggestedTitle,
} from '../../domain/smartImport'
import { ArticleReader } from '../reader/ArticleReader'

export interface SmartImportModalProps {
  isOpen: boolean
  onClose: () => void
  currentArticle?: {
    id: string
    title: string
    body: string
  } | null
  nodes: NodeRow[]
  onAppendToCurrentArticle: (articleId: string, additionalMarkdown: string) => Promise<void>
  onReplaceCurrentArticle: (articleId: string, newMarkdown: string) => Promise<void>
  onCreateNewArticle: (title: string, markdown: string, parentId: string | null) => Promise<void>
  onSaveToInbox: (title: string, markdown: string) => Promise<void>
}

export function SmartImportModal({
  isOpen,
  onClose,
  currentArticle,
  nodes,
  onAppendToCurrentArticle,
  onReplaceCurrentArticle,
  onCreateNewArticle,
  onSaveToInbox,
}: SmartImportModalProps) {
  const [inputText, setInputText] = useState('')
  const [activeTab, setActiveTab] = useState<'paste' | 'file'>('paste')
  const [enrichCallouts, setEnrichCallouts] = useState(true)
  const [destination, setDestination] = useState<
    'append' | 'replace' | 'new-article' | 'inbox'
  >(currentArticle ? 'append' : 'new-article')
  const [targetFolderId, setTargetFolderId] = useState<string | null>(null)
  const [customTitle, setCustomTitle] = useState('')
  const [previewMode, setPreviewMode] = useState<'rendered' | 'raw'>('rendered')
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const wasOpenRef = useRef(false)

  // Reset solo cuando el modal pasa de cerrado a abierto
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setInputText('')
      setErrorMessage(null)
      setDestination(currentArticle ? 'append' : 'new-article')
      setCustomTitle('')
      setEnrichCallouts(true)
    }
    wasOpenRef.current = isOpen
  }, [isOpen, currentArticle])

  // Markdown procesado en tiempo real
  const processedMarkdown = useMemo(() => {
    if (!inputText.trim()) return ''
    return processImportText(inputText, { enrichCallouts })
  }, [inputText, enrichCallouts])

  // Título sugerido derivado reactivamente
  const suggestedTitle = useMemo(() => {
    if (!processedMarkdown) return ''
    return extractSuggestedTitle(processedMarkdown)
  }, [processedMarkdown])

  const effectiveTitle = customTitle || suggestedTitle

  if (!isOpen) return null

  const folders = nodes.filter((n) => n.kind === 'folder')

  const handleFileUpload = async (file: File) => {
    setIsProcessing(true)
    setErrorMessage(null)
    try {
      if (file.name.endsWith('.docx')) {
        const md = await parseDocxFile(file)
        setInputText(md)
        const baseName = file.name.replace(/\.docx$/i, '')
        setCustomTitle(baseName)
      } else if (file.name.endsWith('.md') || file.name.endsWith('.txt')) {
        const text = await file.text()
        setInputText(text)
        const baseName = file.name.replace(/\.(md|txt)$/i, '')
        setCustomTitle(baseName)
      } else {
        throw new Error('Formato no soportado. Sube un archivo .docx, .md o .txt')
      }
      setActiveTab('paste') // Cambiar a pestaña de edición/preview
    } catch (e) {
      setErrorMessage((e as Error).message)
    } finally {
      setIsProcessing(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleApply = async () => {
    if (!processedMarkdown.trim()) return
    setIsProcessing(true)
    setErrorMessage(null)

    try {
      if (destination === 'append' && currentArticle) {
        await onAppendToCurrentArticle(currentArticle.id, processedMarkdown)
      } else if (destination === 'replace' && currentArticle) {
        await onReplaceCurrentArticle(currentArticle.id, processedMarkdown)
      } else if (destination === 'new-article') {
        const finalTitle = effectiveTitle.trim() || 'Nuevo Artículo Importado'
        await onCreateNewArticle(finalTitle, processedMarkdown, targetFolderId)
      } else if (destination === 'inbox') {
        const finalTitle = effectiveTitle.trim() || 'Captura Importada'
        await onSaveToInbox(finalTitle, processedMarkdown)
      }
      onClose()
    } catch (e) {
      setErrorMessage((e as Error).message)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div
      className="dialog-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="dialog-modal smart-import-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-header">
          <h3>🪄 Asistente de Importación (ChatGPT, IA y Word)</h3>
          <button
            type="button"
            className="dialog-btn-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="dialog-body smart-import-body">
          <div className="smart-import-tabs">
            <button
              type="button"
              className={`import-tab-btn ${activeTab === 'paste' ? 'active' : ''}`}
              onClick={() => setActiveTab('paste')}
            >
              📋 Pegar Texto / ChatGPT
            </button>
            <button
              type="button"
              className={`import-tab-btn ${activeTab === 'file' ? 'active' : ''}`}
              onClick={() => setActiveTab('file')}
            >
              📁 Subir Word (.docx) / Markdown
            </button>
          </div>

          {activeTab === 'file' ? (
            <div
              className="smart-import-dropzone"
              onClick={() => fileInputRef.current?.click()}
            >
              <span className="dropzone-icon">📄</span>
              <strong>Haz clic para seleccionar o arrastra un archivo Word (.docx) o .md</strong>
              <p>El archivo se procesará 100% en tu navegador (Local-First).</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,.md,.txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleFileUpload(file)
                }}
              />
            </div>
          ) : (
            <div className="smart-import-input-area">
              <textarea
                className="smart-import-textarea"
                placeholder="Pega aquí el texto copiado de ChatGPT, Claude, Word o una página web…"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                rows={7}
                autoFocus
              />
            </div>
          )}

          {/* Opciones de Procesamiento Inteligente */}
          <div className="smart-import-options-row">
            <label className="import-option-checkbox">
              <input
                type="checkbox"
                checked={enrichCallouts}
                onChange={(e) => setEnrichCallouts(e.target.checked)}
              />
              <span>Detectar automáticamente Callouts clínicos (Advertencias, Dosis, Perlas)</span>
            </label>
          </div>

          {/* Destino de la Importación */}
          <div className="smart-import-destination-box">
            <span className="destination-title">¿Dónde deseas aplicar este contenido?</span>
            <div className="destination-options-grid">
              {currentArticle && (
                <>
                  <label className={`dest-card ${destination === 'append' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="import-dest"
                      value="append"
                      checked={destination === 'append'}
                      onChange={() => setDestination('append')}
                    />
                    <div className="dest-card-info">
                      <strong>➕ Añadir al final</strong>
                      <span>Se anexa al artículo "{currentArticle.title}"</span>
                    </div>
                  </label>

                  <label className={`dest-card ${destination === 'replace' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="import-dest"
                      value="replace"
                      checked={destination === 'replace'}
                      onChange={() => setDestination('replace')}
                    />
                    <div className="dest-card-info">
                      <strong>🔄 Reemplazar</strong>
                      <span>Sobrescribe el contenido de "{currentArticle.title}"</span>
                    </div>
                  </label>
                </>
              )}

              <label className={`dest-card ${destination === 'new-article' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="import-dest"
                  value="new-article"
                  checked={destination === 'new-article'}
                  onChange={() => setDestination('new-article')}
                />
                <div className="dest-card-info">
                  <strong>📄 Crear nuevo artículo</strong>
                  <span>Crea una nota independiente</span>
                </div>
              </label>

              <label className={`dest-card ${destination === 'inbox' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="import-dest"
                  value="inbox"
                  checked={destination === 'inbox'}
                  onChange={() => setDestination('inbox')}
                />
                <div className="dest-card-info">
                  <strong>📥 Guardar en Inbox</strong>
                  <span>Para clasificar y revisar después</span>
                </div>
              </label>
            </div>

            {destination === 'new-article' && (
              <div className="new-article-meta-row">
                <div className="field-group">
                  <label className="dialog-label">Título del nuevo artículo:</label>
                  <input
                    type="text"
                    className="dialog-input"
                    value={customTitle !== '' ? customTitle : suggestedTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="ej. Guía Diagnóstica..."
                  />
                </div>
                <div className="field-group">
                  <label className="dialog-label">Carpeta / Especialidad:</label>
                  <select
                    className="dialog-input"
                    value={targetFolderId || ''}
                    onChange={(e) => setTargetFolderId(e.target.value || null)}
                  >
                    <option value="">(Raíz / Sin Carpeta)</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        📁 {f.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Vista Previa del Contenido Procesado */}
          {processedMarkdown && (
            <div className="smart-import-preview-section">
              <div className="preview-header">
                <strong>👁️ Vista Previa del Contenido Formateado</strong>
                <div className="preview-toggle-buttons">
                  <button
                    type="button"
                    className={`btn-preview-mode ${previewMode === 'rendered' ? 'active' : ''}`}
                    onClick={() => setPreviewMode('rendered')}
                  >
                    Visual
                  </button>
                  <button
                    type="button"
                    className={`btn-preview-mode ${previewMode === 'raw' ? 'active' : ''}`}
                    onClick={() => setPreviewMode('raw')}
                  >
                    Markdown
                  </button>
                </div>
              </div>

              <div className="preview-viewport">
                {previewMode === 'rendered' ? (
                  <ArticleReader
                    markdown={processedMarkdown}
                    onWikiLinkClick={() => {}}
                  />
                ) : (
                  <pre className="preview-raw-code">{processedMarkdown}</pre>
                )}
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="dialog-error-text">⚠️ {errorMessage}</div>
          )}
        </div>

        <div className="dialog-footer">
          <button
            type="button"
            className="btn-dialog-secondary"
            onClick={onClose}
            disabled={isProcessing}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn-dialog-primary"
            onClick={handleApply}
            disabled={!processedMarkdown.trim() || isProcessing}
          >
            {isProcessing ? 'Procesando…' : '🪄 Aplicar Importación'}
          </button>
        </div>
      </div>
    </div>
  )
}
