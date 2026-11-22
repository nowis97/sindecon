import React, { useEffect, useRef, useState } from 'react'
import { FileText, Folder, Upload, Trash2, AlertTriangle, X } from 'lucide-react'
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
import {
  BaseModal,
  PILL_BTN_PRIMARY,
  PILL_BTN_SECONDARY,
  CLINICAL_FIELD_CLASS,
} from '../common/DialogModal'

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
  }, [isOpen, targetFolderId])

  const folders = nodes.filter(
    (n) => n.kind === 'folder' && n.deleted_at === null && n.system !== 'templates',
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
        `Se descartaron ${fileArray.length - validPdfFiles.length} archivo(s) por no ser PDF.`,
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
      prev.map((item) => (item.id === id ? { ...item, title: newTitle } : item)),
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
        },
      )

      onUploadComplete?.(results)
      onClose()
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Ocurrió un error al subir los archivos PDF',
      )
    } finally {
      setIsUploading(false)
    }
  }

  const targetFolderNode = folders.find((f) => f.id === selectedFolderId)

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      closeOnBackdrop={!isUploading}
      hideCloseButton={isUploading}
      title="Subir Documentos PDF"
      subtitle="Guarda guías clínicas y PDFs directamente para lectura y anotación offline."
      icon={<FileText className="h-5 w-5" />}
      maxWidthClass="max-w-xl"
      footer={
        <>
          <button
            type="button"
            className={PILL_BTN_SECONDARY}
            onClick={onClose}
            disabled={isUploading}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={PILL_BTN_PRIMARY}
            onClick={handleStartUpload}
            disabled={isUploading || items.length === 0}
          >
            <Upload className="h-3.5 w-3.5" />
            <span>
              {isUploading
                ? 'Guardando…'
                : items.length === 1
                  ? 'Subir 1 PDF'
                  : `Subir ${items.length} PDFs`}
            </span>
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Target Folder */}
        <div className="flex flex-col gap-1.5">
          <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ch-text-secondary)]">
            <Folder className="h-3.5 w-3.5 text-[var(--ch-accent)]" />
            <span>Carpeta de destino</span>
          </label>
          <select
            value={selectedFolderId ?? ''}
            onChange={(e) => setSelectedFolderId(e.target.value ? e.target.value : null)}
            disabled={isUploading}
            className={CLINICAL_FIELD_CLASS}
          >
            <option value="">Raíz de Mi Repositorio</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.title}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-[var(--ch-text-muted)]">
            {selectedFolderId
              ? `Se guardarán dentro de «${targetFolderNode?.title || 'Carpeta seleccionada'}».`
              : 'Los PDFs se guardarán como fichas en la raíz.'}
          </span>
        </div>

        {/* Dropzone */}
        <div
          className={`flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed p-6 text-center transition ${
            isDragOver
              ? 'border-[var(--ch-accent)] bg-[var(--ch-accent-soft)]'
              : 'border-[var(--ch-border-strong)] bg-[var(--ch-bg-secondary)]/60 hover:border-[var(--ch-accent)]'
          }`}
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
          <span className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]">
            <Upload className="h-6 w-6" />
          </span>
          <h4 className="font-serif text-sm font-semibold text-[var(--ch-text-primary)]">
            Arrastra tus PDFs o haz clic para explorar
          </h4>
          <p className="mt-1 mb-4 text-xs text-[var(--ch-text-muted)]">
            Puedes seleccionar uno o varios documentos (.pdf) simultáneamente.
          </p>
          <button
            type="button"
            className={PILL_BTN_SECONDARY}
            disabled={isUploading}
            onClick={(e) => {
              e.stopPropagation()
              fileInputRef.current?.click()
            }}
          >
            <Upload className="h-3.5 w-3.5 text-[var(--ch-accent)]" />
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

        {errorMessage && (
          <div className="flex items-center gap-2 rounded-2xl border border-red-500/35 bg-red-500/10 px-3.5 py-2.5 text-xs font-medium text-red-700 dark:text-red-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {isUploading && progress && (
          <div className="flex flex-col gap-1.5 rounded-2xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] p-3">
            <div className="flex justify-between text-xs font-semibold text-[var(--ch-text-primary)]">
              <span>Guardando documentos PDF en almacenamiento local…</span>
              <span className="font-mono">
                {progress.current} / {progress.total}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--ch-bg-elevated)]">
              <div
                className="h-full bg-[var(--ch-accent)] transition-all duration-200"
                style={{
                  width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        )}

        {items.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-[var(--ch-text-primary)]">
                Documentos listos para subir ({items.length})
              </span>
              {!isUploading && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--ch-text-muted)] hover:text-red-600"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Quitar todos</span>
                </button>
              )}
            </div>

            <div className="flex max-h-52 flex-col gap-2 overflow-y-auto pr-0.5">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-2xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/50 p-3"
                >
                  <FileText className="h-5 w-5 shrink-0 text-[var(--ch-accent)]" />
                  <div className="min-w-0 flex-1">
                    <input
                      type="text"
                      className={CLINICAL_FIELD_CLASS}
                      value={item.title}
                      onChange={(e) => handleTitleChange(item.id, e.target.value)}
                      disabled={isUploading}
                      placeholder="Título del artículo…"
                    />
                    <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-[var(--ch-text-muted)]">
                      <span className="truncate">{item.file.name}</span>
                      <span>•</span>
                      <span className="shrink-0">{item.sizeFormatted}</span>
                    </div>
                  </div>
                  {!isUploading && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--ch-text-muted)] transition hover:bg-red-500/10 hover:text-red-600"
                      title="Descartar este PDF"
                      aria-label={`Descartar ${item.title}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </BaseModal>
  )
}
