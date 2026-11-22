import React, { useState, useEffect } from 'react'
import { Printer, FileText, Columns2, Folder, Lightbulb } from 'lucide-react'
import { BaseModal, PILL_BTN_PRIMARY, PILL_BTN_SECONDARY } from '../common/DialogModal'

export interface ExportPdfOptions {
  columns: '1' | '2'
  includeHeader: boolean
  includeTags: boolean
}

interface ExportPdfModalProps {
  isOpen: boolean
  onClose: () => void
  articleTitle: string
  folderPath?: string
  tags?: string[]
  onConfirmExport: (options: ExportPdfOptions) => void
}

const PDF_LAYOUT_KEY = 'sindecon_pdf_layout_columns'

export const ExportPdfModal: React.FC<ExportPdfModalProps> = ({
  isOpen,
  onClose,
  articleTitle,
  folderPath,
  tags = [],
  onConfirmExport,
}) => {
  const [columns, setColumns] = useState<'1' | '2'>('2')
  const [includeHeader, setIncludeHeader] = useState(true)
  const [includeTags, setIncludeTags] = useState(true)

  useEffect(() => {
    if (isOpen) {
      try {
        const saved = localStorage.getItem(PDF_LAYOUT_KEY)
        if (saved === '1' || saved === '2') {
          setColumns(saved)
        }
      } catch {}
    }
  }, [isOpen])

  const handleSelectColumns = (col: '1' | '2') => {
    setColumns(col)
    try {
      localStorage.setItem(PDF_LAYOUT_KEY, col)
    } catch {}
  }

  const handleExport = () => {
    onConfirmExport({
      columns,
      includeHeader,
      includeTags,
    })
  }

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Exportar Ficha a PDF"
      subtitle="Maquetación clínica A4 lista para imprimir o guardar en PDF."
      icon={<Printer className="h-5 w-5" />}
      maxWidthClass="max-w-lg"
      footer={
        <>
          <button type="button" className={PILL_BTN_SECONDARY} onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className={PILL_BTN_PRIMARY} onClick={handleExport}>
            <Printer className="h-3.5 w-3.5" />
            <span>Imprimir / Guardar PDF</span>
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Context Chip */}
        <div className="flex items-center gap-2.5 rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-4 py-2.5">
          <FileText className="h-4 w-4 shrink-0 text-[var(--ch-accent)]" />
          <div className="min-w-0 flex-1 truncate text-xs text-[var(--ch-text-secondary)]">
            <strong className="font-semibold text-[var(--ch-text-primary)]">{articleTitle}</strong>
            {folderPath && (
              <span className="ml-2 inline-flex items-center gap-1 text-[var(--ch-text-muted)]">
                · <Folder className="h-3 w-3" /> {folderPath}
              </span>
            )}
          </div>
        </div>

        {/* Layout Selector */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-[var(--ch-text-secondary)]">
            Diseño de maquetación en papel
          </span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => handleSelectColumns('1')}
              className={`flex flex-col items-start gap-2 rounded-2xl border p-3.5 text-left transition ${
                columns === '1'
                  ? 'border-[var(--ch-accent)] bg-[var(--ch-accent-soft)]'
                  : 'border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/60 hover:border-[var(--ch-accent)]/50'
              }`}
            >
              <div className="flex w-full items-center justify-between">
                <span
                  className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold ${
                    columns === '1'
                      ? 'bg-[var(--ch-accent)] text-white'
                      : 'border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] text-[var(--ch-text-muted)]'
                  }`}
                >
                  Lineal
                </span>
                <FileText className="h-4 w-4 text-[var(--ch-accent)]" />
              </div>
              <div>
                <strong className="block font-serif text-sm font-semibold text-[var(--ch-text-primary)]">
                  1 Columna Continua
                </strong>
                <span className="mt-0.5 block text-xs leading-snug text-[var(--ch-text-muted)]">
                  Ideal para artículos extensos, algoritmos y tablas anchas.
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleSelectColumns('2')}
              className={`flex flex-col items-start gap-2 rounded-2xl border p-3.5 text-left transition ${
                columns === '2'
                  ? 'border-[var(--ch-accent)] bg-[var(--ch-accent-soft)]'
                  : 'border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/60 hover:border-[var(--ch-accent)]/50'
              }`}
            >
              <div className="flex w-full items-center justify-between">
                <span
                  className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold ${
                    columns === '2'
                      ? 'bg-[var(--ch-accent)] text-white'
                      : 'border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] text-[var(--ch-text-muted)]'
                  }`}
                >
                  Recomendado
                </span>
                <Columns2 className="h-4 w-4 text-[var(--ch-accent)]" />
              </div>
              <div>
                <strong className="block font-serif text-sm font-semibold text-[var(--ch-text-primary)]">
                  2 Columnas Ficha A4
                </strong>
                <span className="mt-0.5 block text-xs leading-snug text-[var(--ch-text-muted)]">
                  Formato compacto estilo dossier clínico de guardia.
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Document Options */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-[var(--ch-text-secondary)]">
            Opciones del documento
          </span>
          <div className="flex flex-col gap-2 rounded-2xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/50 p-3">
            <label className="flex cursor-pointer items-center gap-2.5 text-xs font-medium text-[var(--ch-text-primary)]">
              <input
                type="checkbox"
                checked={includeHeader}
                onChange={(e) => setIncludeHeader(e.target.checked)}
                className="h-4 w-4 accent-[var(--ch-accent)]"
              />
              <span>Incluir cabecera clínica (Título, fecha de revisión y ruta)</span>
            </label>

            {tags.length > 0 && (
              <label className="flex cursor-pointer items-center gap-2.5 text-xs font-medium text-[var(--ch-text-primary)]">
                <input
                  type="checkbox"
                  checked={includeTags}
                  onChange={(e) => setIncludeTags(e.target.checked)}
                  className="h-4 w-4 accent-[var(--ch-accent)]"
                />
                <span>
                  Incluir etiquetas del artículo ({tags.map((t) => `#${t}`).join(', ')})
                </span>
              </label>
            )}
          </div>
        </div>

        {/* Tip */}
        <div className="flex items-start gap-2.5 rounded-2xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-3.5 py-2.5 text-xs text-[var(--ch-text-secondary)]">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ch-accent)]" />
          <span>
            <strong>Consejo:</strong> En el diálogo de impresión del navegador, selecciona{' '}
            <em>«Guardar como PDF»</em> como impresora destino.
          </span>
        </div>
      </div>
    </BaseModal>
  )
}
