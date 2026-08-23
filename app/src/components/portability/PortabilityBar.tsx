import { useRef, useState } from 'react'
import { exportToZip, importFromZip } from '../../db/exportImport'

/** Export a zip / import con fusión (spec data-portability). */
export function PortabilityBar() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

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
      const report = await importFromZip(file)
      window.alert(
        [
          'Importación completada (fusión):',
          `Nodos: +${report.nodesAdded} añadidos · ~${report.nodesUpdated} actualizados · -${report.nodesDeleted} eliminados · ${report.nodesSkipped} intactos`,
          `Artículos: +${report.articlesAdded} · ~${report.articlesUpdated} · ${report.articlesSkipped} intactos`,
          `Imágenes: +${report.assetsAdded} · ${report.assetsSkipped} existentes`,
        ].join('\n'),
      )
    } catch (e) {
      window.alert(`Import fallido: ${(e as Error).message}`)
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="portability">
      <button onClick={onExport} disabled={busy}>
        Exportar backup
      </button>
      <button onClick={() => fileRef.current?.click()} disabled={busy}>
        Importar
      </button>
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
  )
}
