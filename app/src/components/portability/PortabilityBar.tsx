import { useRef, useState } from 'react'
import { exportToZip, importFromZip } from '../../db/exportImport'
import type { MergeReport } from '../../domain/merge'
import { AlertDialog } from '../common/DialogModal'

interface PortabilityBarProps {
  onOpenGoogleDriveSync?: () => void
}

/** Export a zip / import con fusión (spec data-portability) + acceso a nube. */
export function PortabilityBar({ onOpenGoogleDriveSync }: PortabilityBarProps) {
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
      <div className="portability">
        <button
          type="button"
          onClick={onExport}
          disabled={busy}
          title="Exportar todo el cuaderno médico a un archivo .zip"
        >
          {busy ? 'Exportando…' : 'Exportar backup'}
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          title="Importar y fusionar datos desde un archivo .zip"
        >
          Importar
        </button>
        {onOpenGoogleDriveSync && (
          <button
            type="button"
            className="btn-gdrive-sync-trigger"
            onClick={onOpenGoogleDriveSync}
            title="Configurar sincronización en Google Drive"
          >
            ☁️ Nube
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
          title="📥 Importación Completada"
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
          title="⚠️ Error al importar"
          onClose={() => setErrorMsg(null)}
          content={<p className="dialog-error-text">{errorMsg}</p>}
        />
      )}
    </>
  )
}
