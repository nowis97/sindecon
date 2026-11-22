import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Sparkles,
  ClipboardPaste,
  FileUp,
  FileText,
  Plus,
  RefreshCw,
  FilePlus,
  Inbox,
  FileOutput,
  Eye,
  AlertTriangle,
} from 'lucide-react'
import type { NodeRow } from '../../db/db'
import {
  processImportText,
  parseDocxFile,
  extractSuggestedTitle,
} from '../../domain/smartImport'
import { ArticleReader } from '../reader/ArticleReader'
import {
  BaseModal,
  PILL_BTN_PRIMARY,
  PILL_BTN_SECONDARY,
  CLINICAL_FIELD_CLASS,
} from '../common/DialogModal'

export interface SmartImportModalProps {
  isOpen: boolean
  onClose: () => void
  currentArticle?: {
    id: string
    title: string
    body: string
  } | null
  currentFolderId?: string | null
  nodes: NodeRow[]
  onAppendToCurrentArticle: (articleId: string, additionalMarkdown: string) => Promise<void>
  onReplaceCurrentArticle: (articleId: string, newMarkdown: string) => Promise<void>
  onCreateNewArticle: (title: string, markdown: string, parentId: string | null) => Promise<void>
  onSaveToInbox: (title: string, markdown: string) => Promise<void>
  onExportToGoogleDocs?: (title: string, markdown: string) => void
}

export function SmartImportModal({
  isOpen,
  onClose,
  currentArticle,
  currentFolderId = null,
  nodes,
  onAppendToCurrentArticle,
  onReplaceCurrentArticle,
  onCreateNewArticle,
  onSaveToInbox,
  onExportToGoogleDocs,
}: SmartImportModalProps) {
  const [inputText, setInputText] = useState('')
  const [activeTab, setActiveTab] = useState<'paste' | 'file'>('paste')
  const [enrichCallouts, setEnrichCallouts] = useState(true)
  const [destination, setDestination] = useState<
    'append' | 'replace' | 'new-article' | 'inbox' | 'gdocs'
  >(currentArticle ? 'append' : 'new-article')
  const [targetFolderId, setTargetFolderId] = useState<string | null>(
    currentFolderId ?? null,
  )
  const [customTitle, setCustomTitle] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState<'rendered' | 'raw'>('rendered')
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const wasOpenRef = useRef(false)

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setInputText('')
      setErrorMessage(null)
      setDestination(currentArticle ? 'append' : 'new-article')
      setTargetFolderId(currentFolderId ?? null)
      setCustomTitle(null)
      setEnrichCallouts(true)
    }
    wasOpenRef.current = isOpen
  }, [isOpen, currentArticle, currentFolderId])

  const processedMarkdown = useMemo(() => {
    if (!inputText.trim()) return ''
    return processImportText(inputText, { enrichCallouts })
  }, [inputText, enrichCallouts])

  const suggestedTitle = useMemo(() => {
    if (!processedMarkdown) return ''
    return extractSuggestedTitle(processedMarkdown)
  }, [processedMarkdown])

  const effectiveTitle = customTitle !== null ? customTitle : suggestedTitle
  const folders = nodes.filter((n) => n.kind === 'folder' && n.deleted_at === null)

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
      setActiveTab('paste')
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
        const finalTitle = effectiveTitle.trim() || suggestedTitle || 'Nuevo Artículo Importado'
        await onCreateNewArticle(finalTitle, processedMarkdown, targetFolderId)
      } else if (destination === 'inbox') {
        const finalTitle = effectiveTitle.trim() || suggestedTitle || 'Captura Importada'
        await onSaveToInbox(finalTitle, processedMarkdown)
      } else if (destination === 'gdocs') {
        const finalTitle = effectiveTitle.trim() || suggestedTitle || 'Nota ChatGPT'
        onExportToGoogleDocs?.(finalTitle, processedMarkdown)
      }
      onClose()
    } catch (e) {
      setErrorMessage((e as Error).message)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      closeOnBackdrop={!isProcessing}
      title="Importador Clínico Inteligente"
      subtitle="Convierte apuntes de ChatGPT, Claude, Word (.docx) o Markdown con callouts médicos."
      icon={<Sparkles className="h-5 w-5" />}
      maxWidthClass="max-w-3xl"
      footer={
        <>
          <button
            type="button"
            className={PILL_BTN_SECONDARY}
            onClick={onClose}
            disabled={isProcessing}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={PILL_BTN_PRIMARY}
            onClick={handleApply}
            disabled={!processedMarkdown.trim() || isProcessing}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>
              {isProcessing
                ? 'Procesando…'
                : destination === 'gdocs'
                  ? 'Exportar a Google Docs'
                  : 'Aplicar Importación'}
            </span>
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Source Mode Switcher */}
        <div className="inline-flex self-start rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] p-1">
          <button
            type="button"
            onClick={() => setActiveTab('paste')}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
              activeTab === 'paste'
                ? 'bg-[var(--ch-accent-solid)] text-white shadow-xs'
                : 'text-[var(--ch-text-secondary)] hover:text-[var(--ch-text-primary)]'
            }`}
          >
            <ClipboardPaste className="h-3.5 w-3.5" />
            <span>Pegar Markdown / ChatGPT</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('file')}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
              activeTab === 'file'
                ? 'bg-[var(--ch-accent-solid)] text-white shadow-xs'
                : 'text-[var(--ch-text-secondary)] hover:text-[var(--ch-text-primary)]'
            }`}
          >
            <FileUp className="h-3.5 w-3.5" />
            <span>Subir Word (.docx) / .md</span>
          </button>
        </div>

        {/* Input / File Area */}
        {activeTab === 'file' ? (
          <div
            className="flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-[var(--ch-border-strong)] bg-[var(--ch-bg-secondary)]/60 p-7 text-center transition hover:border-[var(--ch-accent)]"
            onClick={() => fileInputRef.current?.click()}
          >
            <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]">
              <FileText className="h-5 w-5" />
            </span>
            <strong className="font-display text-sm font-semibold text-[var(--ch-text-primary)]">
              Haz clic para seleccionar un archivo Word (.docx) o .md
            </strong>
            <p className="mt-1 text-xs text-[var(--ch-text-muted)]">
              El documento se procesará 100% en tu navegador (Local-First).
            </p>
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
          <textarea
            className="w-full rounded-2xl border border-[var(--ch-border-strong)] bg-[var(--ch-bg-primary)] p-3.5 font-mono text-xs leading-relaxed text-[var(--ch-text-primary)] outline-none transition placeholder:text-[var(--ch-text-muted)] focus:border-[var(--ch-accent)] focus:ring-2 focus:ring-[var(--ch-accent)]/20"
            placeholder="Pega aquí tu texto en Markdown, respuestas de ChatGPT, Claude o apuntes clínicos…"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            rows={6}
            autoFocus
          />
        )}

        <label className="flex cursor-pointer items-center gap-2.5 rounded-2xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/50 px-3.5 py-2.5 text-xs font-medium text-[var(--ch-text-primary)]">
          <input
            type="checkbox"
            checked={enrichCallouts}
            onChange={(e) => setEnrichCallouts(e.target.checked)}
            className="h-4 w-4 accent-[var(--ch-accent)]"
          />
          <span>Detectar automáticamente bloques clínicos (Advertencias, Dosis y Perlas)</span>
        </label>

        {/* Destination Cards */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-[var(--ch-text-secondary)]">
            ¿Dónde deseas aplicar este contenido?
          </span>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {currentArticle && (
              <>
                <button
                  type="button"
                  onClick={() => setDestination('append')}
                  className={`flex items-start gap-2.5 rounded-2xl border p-3 text-left transition ${
                    destination === 'append'
                      ? 'border-[var(--ch-accent)] bg-[var(--ch-accent-soft)]'
                      : 'border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/50 hover:border-[var(--ch-accent)]/50'
                  }`}
                >
                  <Plus className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ch-accent)]" />
                  <div className="min-w-0">
                    <strong className="block text-xs font-semibold text-[var(--ch-text-primary)]">
                      Añadir al final
                    </strong>
                    <span className="block truncate text-[11px] text-[var(--ch-text-muted)]">
                      Anexar a «{currentArticle.title}»
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDestination('replace')}
                  className={`flex items-start gap-2.5 rounded-2xl border p-3 text-left transition ${
                    destination === 'replace'
                      ? 'border-[var(--ch-accent)] bg-[var(--ch-accent-soft)]'
                      : 'border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/50 hover:border-[var(--ch-accent)]/50'
                  }`}
                >
                  <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ch-accent)]" />
                  <div className="min-w-0">
                    <strong className="block text-xs font-semibold text-[var(--ch-text-primary)]">
                      Reemplazar artículo
                    </strong>
                    <span className="block truncate text-[11px] text-[var(--ch-text-muted)]">
                      Sobrescribir «{currentArticle.title}»
                    </span>
                  </div>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setDestination('new-article')}
              className={`flex items-start gap-2.5 rounded-2xl border p-3 text-left transition ${
                destination === 'new-article'
                  ? 'border-[var(--ch-accent)] bg-[var(--ch-accent-soft)]'
                  : 'border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/50 hover:border-[var(--ch-accent)]/50'
              }`}
            >
              <FilePlus className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ch-accent)]" />
              <div className="min-w-0">
                <strong className="block text-xs font-semibold text-[var(--ch-text-primary)]">
                  Crear nuevo artículo
                </strong>
                <span className="block text-[11px] text-[var(--ch-text-muted)]">
                  Ficha clínica independiente
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setDestination('inbox')}
              className={`flex items-start gap-2.5 rounded-2xl border p-3 text-left transition ${
                destination === 'inbox'
                  ? 'border-[var(--ch-accent)] bg-[var(--ch-accent-soft)]'
                  : 'border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/50 hover:border-[var(--ch-accent)]/50'
              }`}
            >
              <Inbox className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ch-accent)]" />
              <div className="min-w-0">
                <strong className="block text-xs font-semibold text-[var(--ch-text-primary)]">
                  Guardar en Inbox
                </strong>
                <span className="block text-[11px] text-[var(--ch-text-muted)]">
                  Clasificar después
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setDestination('gdocs')}
              className={`flex items-start gap-2.5 rounded-2xl border p-3 text-left transition ${
                destination === 'gdocs'
                  ? 'border-[var(--ch-accent)] bg-[var(--ch-accent-soft)]'
                  : 'border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/50 hover:border-[var(--ch-accent)]/50'
              }`}
            >
              <FileOutput className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ch-accent)]" />
              <div className="min-w-0">
                <strong className="block text-xs font-semibold text-[var(--ch-text-primary)]">
                  Exportar a Google Docs
                </strong>
                <span className="block text-[11px] text-[var(--ch-text-muted)]">
                  Formato clínico directo
                </span>
              </div>
            </button>
          </div>

          {destination === 'new-article' && (
            <div className="mt-2 grid grid-cols-1 gap-3 rounded-2xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/50 p-3.5 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-[var(--ch-text-secondary)]">
                  Título del nuevo artículo
                </label>
                <input
                  type="text"
                  className={CLINICAL_FIELD_CLASS}
                  value={customTitle !== null ? customTitle : suggestedTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder={suggestedTitle || 'ej. Guía Diagnóstica…'}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-[var(--ch-text-secondary)]">
                  Carpeta / Especialidad
                </label>
                <select
                  className={CLINICAL_FIELD_CLASS}
                  value={targetFolderId || ''}
                  onChange={(e) => setTargetFolderId(e.target.value || null)}
                >
                  <option value="">(Raíz / Sin Carpeta)</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {destination === 'gdocs' && (
            <div className="mt-2 rounded-2xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/50 p-3.5">
              <label className="mb-1 block text-[11px] font-semibold text-[var(--ch-text-secondary)]">
                Título del documento
              </label>
              <input
                type="text"
                className={CLINICAL_FIELD_CLASS}
                value={customTitle !== null ? customTitle : suggestedTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder={suggestedTitle || 'Nota Clínica'}
              />
            </div>
          )}
        </div>

        {/* Live Processed Preview */}
        {processedMarkdown && (
          <div className="overflow-hidden rounded-2xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)]">
            <div className="flex items-center justify-between border-b border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/70 px-4 py-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ch-text-primary)]">
                <Eye className="h-3.5 w-3.5 text-[var(--ch-accent)]" />
                <span>Vista Previa Formateada</span>
              </span>
              <div className="inline-flex rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] p-0.5">
                <button
                  type="button"
                  onClick={() => setPreviewMode('rendered')}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                    previewMode === 'rendered'
                      ? 'bg-[var(--ch-accent-solid)] text-white'
                      : 'text-[var(--ch-text-muted)]'
                  }`}
                >
                  Visual
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('raw')}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                    previewMode === 'raw'
                      ? 'bg-[var(--ch-accent-solid)] text-white'
                      : 'text-[var(--ch-text-muted)]'
                  }`}
                >
                  Markdown
                </button>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto p-4">
              {previewMode === 'rendered' ? (
                <ArticleReader markdown={processedMarkdown} onWikiLinkClick={() => {}} />
              ) : (
                <pre className="whitespace-pre-wrap font-mono text-xs text-[var(--ch-text-secondary)]">
                  {processedMarkdown}
                </pre>
              )}
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-center gap-2 rounded-2xl border border-red-500/35 bg-red-500/10 px-3.5 py-2.5 text-xs font-medium text-red-700 dark:text-red-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>
    </BaseModal>
  )
}
