import { useEffect, useRef, useState } from 'react'
import {
  FileUp,
  FolderOpen,
  FileText,
  Folder,
  Settings,
  AlertTriangle,
  X,
} from 'lucide-react'
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
import {
  BaseModal,
  PILL_BTN_PRIMARY,
  PILL_BTN_SECONDARY,
  CLINICAL_FIELD_CLASS,
} from '../common/DialogModal'

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
  }, [isOpen, targetFolderId])

  const folders = nodes.filter(
    (n) => n.kind === 'folder' && n.deleted_at === null && n.system !== 'templates',
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
          const existingKeys = new Set(prev.map((i) => i.relativePath || i.originalFilename))
          const newItems = items.filter(
            (i) => !existingKeys.has(i.relativePath || i.originalFilename),
          )
          return [...prev, ...newItems]
        })
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Error al procesar los archivos seleccionados',
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
        err instanceof Error ? err.message : 'Ocurrió un error inesperado al importar las notas',
      )
    } finally {
      setIsImporting(false)
    }
  }

  const targetFolderNode = folders.find((f) => f.id === selectedFolderId)

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      closeOnBackdrop={!isImporting}
      hideCloseButton={isImporting}
      title="Importación Masiva Markdown"
      subtitle="Compatible con Obsidian Vaults, Notion, carpetas .md o paquetes .zip."
      icon={<FileUp className="h-5 w-5" />}
      maxWidthClass="max-w-2xl"
      footer={
        <>
          <button
            type="button"
            className={PILL_BTN_SECONDARY}
            onClick={onClose}
            disabled={isImporting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={PILL_BTN_PRIMARY}
            onClick={handleStartImport}
            disabled={parsedItems.length === 0 || isImporting || isParsing}
          >
            <FileUp className="h-3.5 w-3.5" />
            <span>
              {isImporting
                ? 'Importando…'
                : `Importar ${parsedItems.length > 0 ? `${parsedItems.length} ` : ''}Notas`}
            </span>
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Dropzone */}
        <div
          className={`flex flex-col items-center rounded-2xl border-2 border-dashed p-6 text-center transition ${
            isDragOver
              ? 'border-[var(--ch-accent)] bg-[var(--ch-accent-soft)]'
              : 'border-[var(--ch-border-strong)] bg-[var(--ch-bg-secondary)]/60'
          }`}
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
          <span className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]">
            <FolderOpen className="h-6 w-6" />
          </span>
          <h4 className="font-serif text-sm font-semibold text-[var(--ch-text-primary)]">
            {isParsing
              ? 'Analizando archivos y metadatos…'
              : 'Arrastra aquí tus archivos .md, carpetas o archivos .zip'}
          </h4>
          <p className="mt-1 mb-4 text-xs text-[var(--ch-text-muted)]">
            Procesamiento 100% local en tu navegador sin subir archivos a la nube.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              className={PILL_BTN_SECONDARY}
              disabled={isImporting || isParsing}
              onClick={() => multiFileInputRef.current?.click()}
            >
              <FileText className="h-3.5 w-3.5 text-[var(--ch-accent)]" />
              <span>Seleccionar Archivos (.md, .zip)</span>
            </button>
            <button
              type="button"
              className={PILL_BTN_SECONDARY}
              disabled={isImporting || isParsing}
              onClick={() => folderInputRef.current?.click()}
            >
              <Folder className="h-3.5 w-3.5 text-[var(--ch-accent)]" />
              <span>Seleccionar Carpeta</span>
            </button>
          </div>

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

        {/* Settings Grid */}
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/50 p-3.5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ch-text-secondary)]">
              <Folder className="h-3.5 w-3.5 text-[var(--ch-accent)]" />
              <span>Carpeta de destino</span>
            </label>
            <select
              className={CLINICAL_FIELD_CLASS}
              value={selectedFolderId || ''}
              disabled={isImporting}
              onChange={(e) => setSelectedFolderId(e.target.value || null)}
            >
              <option value="">(Raíz / Nivel Principal)</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ch-text-secondary)]">
              <Settings className="h-3.5 w-3.5 text-[var(--ch-accent)]" />
              <span>Si existe título duplicado</span>
            </label>
            <select
              className={CLINICAL_FIELD_CLASS}
              value={collisionStrategy}
              disabled={isImporting}
              onChange={(e) => setCollisionStrategy(e.target.value as CollisionStrategy)}
            >
              <option value="suffix">Añadir sufijo numérico (ej. "Nota (1)")</option>
              <option value="skip">Omitir si ya existe</option>
              <option value="overwrite">Sobrescribir contenido existente</option>
            </select>
          </div>
        </div>

        {/* Preview List */}
        {parsedItems.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)]">
            <div className="flex items-center justify-between border-b border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/70 px-4 py-2.5">
              <span className="text-xs font-semibold text-[var(--ch-text-primary)]">
                {parsedItems.length}{' '}
                {parsedItems.length === 1 ? 'nota detectada' : 'notas detectadas'} para{' '}
                {targetFolderNode ? `«${targetFolderNode.title}»` : 'la raíz'}
              </span>
              {!isImporting && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-xs font-semibold text-[var(--ch-text-muted)] underline hover:text-red-600"
                >
                  Vaciar lista
                </button>
              )}
            </div>

            <div className="max-h-52 divide-y divide-[var(--ch-border-subtle)] overflow-y-auto">
              {parsedItems.map((item, index) => (
                <div
                  key={`${item.originalFilename}-${index}`}
                  className="flex items-center justify-between gap-2 px-4 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ch-text-primary)]">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--ch-accent)]" />
                      <span className="truncate">{item.title}</span>
                    </div>
                    <span className="block truncate pl-5 font-mono text-[10px] text-[var(--ch-text-muted)]">
                      {item.relativePath || item.originalFilename}
                    </span>
                  </div>
                  {!isImporting && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[var(--ch-text-muted)] hover:bg-red-500/10 hover:text-red-600"
                      title="Quitar de la lista"
                      aria-label="Quitar de la lista"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Import Progress */}
        {isImporting && progress && (
          <div className="flex flex-col gap-1.5 rounded-2xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] p-3">
            <div className="flex justify-between text-xs font-semibold text-[var(--ch-text-primary)]">
              <span>Guardando notas en la base clínica…</span>
              <span className="font-mono">
                {progress.current} / {progress.total} (
                {Math.round((progress.current / Math.max(progress.total, 1)) * 100)}%)
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--ch-bg-elevated)]">
              <div
                className="h-full bg-[var(--ch-accent)] transition-all duration-150"
                style={{
                  width: `${(progress.current / Math.max(progress.total, 1)) * 100}%`,
                }}
              />
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
