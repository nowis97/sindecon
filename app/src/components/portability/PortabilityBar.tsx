import { useRef, useState } from 'react'
import {
  Archive,
  Upload,
  FileInput,
  Printer,
  Cloud,
  Smartphone,
} from 'lucide-react'
import { exportToZip, importFromZip } from '../../db/exportImport'
import type { MergeReport } from '../../domain/merge'
import { AlertDialog } from '../common/DialogModal'

interface PortabilityBarProps {
  onOpenGoogleDriveSync?: () => void
  onInstallPwa?: () => void
  canInstallPwa?: boolean
  onBulkImportMarkdown?: () => void
  onBulkExportPdf?: () => void
}

/** Export a zip / import con fusión (spec data-portability) + acceso a nube e instalación PWA. */
export function PortabilityBar({
  onOpenGoogleDriveSync,
  onInstallPwa,
  canInstallPwa,
  onBulkImportMarkdown,
  onBulkExportPdf,
}: PortabilityBarProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState<MergeReport | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const onExport = async () => {
    setBusy(true)
    try {
      const blob = await exportToZip()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cuaderno-medico-${new Date().toISOString().slice(0, 10)}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setBusy(false)
    }
  }

  const onImport = async (file: File) => {
    setBusy(true)
    try {
      const res = await importFromZip(file)
      setReport(res)
    } catch (e) {
      setErrorMsg((e as Error).message || 'Error desconocido al importar el archivo zip')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-1.5 border-b border-[var(--ch-border-subtle)] px-3 py-2.5">
        <button
          type="button"
          onClick={onExport}
          disabled={busy}
          title="Exportar todo el cuaderno médico a un archivo .zip"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--ch-text-primary)] transition hover:border-[var(--ch-accent)] hover:text-[var(--ch-accent)] disabled:opacity-45"
        >
          <Archive className="h-3.5 w-3.5 shrink-0 text-[var(--ch-accent)]" />
          <span className="truncate">{busy ? 'Exportando…' : 'Backup .zip'}</span>
        </button>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          title="Importar y fusionar backup completo desde un archivo .zip de SINDECON"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--ch-text-primary)] transition hover:border-[var(--ch-accent)] hover:text-[var(--ch-accent)] disabled:opacity-45"
        >
          <Upload className="h-3.5 w-3.5 shrink-0 text-[var(--ch-accent)]" />
          <span className="truncate">Restaurar .zip</span>
        </button>

        {onBulkImportMarkdown && (
          <button
            type="button"
            onClick={onBulkImportMarkdown}
            disabled={busy}
            title="Importación masiva de archivos Markdown (.md) y carpetas"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--ch-text-primary)] transition hover:border-[var(--ch-accent)] hover:text-[var(--ch-accent)] disabled:opacity-45"
          >
            <FileInput className="h-3.5 w-3.5 shrink-0 text-[var(--ch-accent)]" />
            <span className="truncate">Importar .md</span>
          </button>
        )}

        {onBulkExportPdf && (
          <button
            type="button"
            onClick={onBulkExportPdf}
            disabled={busy}
            title="Exportar múltiples artículos clínicos seleccionados a documento PDF"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--ch-text-primary)] transition hover:border-[var(--ch-accent)] hover:text-[var(--ch-accent)] disabled:opacity-45"
          >
            <Printer className="h-3.5 w-3.5 shrink-0 text-[var(--ch-accent)]" />
            <span className="truncate">Compendio PDF</span>
          </button>
        )}

        {onOpenGoogleDriveSync && (
          <button
            type="button"
            onClick={onOpenGoogleDriveSync}
            title="Configurar sincronización en Google Drive"
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--ch-text-primary)] transition hover:border-[var(--ch-accent)] hover:text-[var(--ch-accent)] ${
              canInstallPwa && onInstallPwa ? '' : 'col-span-2'
            }`}
          >
            <Cloud className="h-3.5 w-3.5 shrink-0 text-[var(--ch-accent)]" />
            <span className="truncate">Sincronización Google Drive</span>
          </button>
        )}

        {canInstallPwa && onInstallPwa && (
          <button
            type="button"
            onClick={onInstallPwa}
            title="Instalar SINDECON en este dispositivo (pantalla completa y offline)"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--ch-accent)]/40 bg-[var(--ch-accent-soft)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--ch-accent)] transition hover:opacity-90"
          >
            <Smartphone className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Instalar App</span>
          </button>
        )}

        <input
          ref={fileRef}
          type="file"
          accept=".zip,application/zip"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void onImport(file)
          }}
        />
      </div>

      {report && (
        <AlertDialog
          isOpen={true}
          title="Importación Completada"
          onClose={() => setReport(null)}
          content={
            <div className="import-report-dialog">
              <p className="import-report-lead">
                Los datos se han fusionado con éxito en tu base local:
              </p>
              <div className="import-report-stats">
                <div className="report-stat-row">
                  <strong>Carpetas y Nodos:</strong>
                  <span>
                    +{report.nodesAdded} nuevos · ~{report.nodesUpdated} actualizados · -{report.nodesDeleted} eliminados · {report.nodesSkipped} intactos
                  </span>
                </div>
                <div className="report-stat-row">
                  <strong>Artículos:</strong>
                  <span>
                    +{report.articlesAdded} nuevos · ~{report.articlesUpdated} actualizados · {report.articlesSkipped} intactos
                  </span>
                </div>
                <div className="report-stat-row">
                  <strong>Imágenes / Assets:</strong>
                  <span>
                    +{report.assetsAdded} añadidos · {report.assetsSkipped} existentes
                  </span>
                </div>
              </div>
            </div>
          }
        />
      )}

      {errorMsg && (
        <AlertDialog
          isOpen={true}
          title="Error al importar"
          onClose={() => setErrorMsg(null)}
          content={<p className="dialog-error-text">{errorMsg}</p>}
        />
      )}
    </>
  )
}
