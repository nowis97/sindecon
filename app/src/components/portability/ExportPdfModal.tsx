import React, { useState, useEffect } from 'react'

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

  if (!isOpen) return null

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
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content export-pdf-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="header-title-group">
            <div className="topic-modal-title-line">
              <span className="topic-modal-icon">🖨️</span>
              <h3>Exportar a PDF / Imprimir</h3>
            </div>
            <span className="header-subtitle">
              Genera un documento PDF de alta fidelidad o imprime tu artículo médico.
            </span>
          </div>
          <button className="btn-close" onClick={onClose} aria-label="Cerrar modal">
            ✕
          </button>
        </div>

        <div className="export-pdf-body">
          {/* Ficha Resumen del Artículo */}
          <div className="pdf-article-preview-badge">
            <span className="preview-icon">📄</span>
            <div className="preview-info">
              <strong className="preview-title">{articleTitle}</strong>
              {folderPath && (
                <span className="preview-path">📁 {folderPath}</span>
              )}
            </div>
          </div>

          {/* Selector de Maquetación */}
          <div className="form-group">
            <label className="field-main-label">Diseño de Maquetación en Papel:</label>
            <div className="pdf-layout-grid">
              <button
                type="button"
                className={`pdf-layout-card ${columns === '1' ? 'active' : ''}`}
                onClick={() => handleSelectColumns('1')}
              >
                <div className="layout-badge-pill">Lectura Lineal</div>
                <div className="layout-card-icon">📄</div>
                <div className="layout-card-info">
                  <strong>1 Columna</strong>
                  <span>Diseño amplio y secuencial. Ideal para artículos extensos y tablas anchas.</span>
                </div>
              </button>

              <button
                type="button"
                className={`pdf-layout-card ${columns === '2' ? 'active' : ''}`}
                onClick={() => handleSelectColumns('2')}
              >
                <div className="layout-badge-pill recommended">Ficha Médica</div>
                <div className="layout-card-icon">📖</div>
                <div className="layout-card-info">
                  <strong>2 Columnas</strong>
                  <span>Diseño compacto estilo Word/UptoDate. Ahorra papel y optimiza espacio.</span>
                </div>
              </button>
            </div>
          </div>

          {/* Opciones de Encabezado y Metadatos */}
          <div className="form-group">
            <label className="field-main-label">Opciones del Documento:</label>
            <div className="pdf-options-list">
              <label className="pdf-checkbox-row">
                <input
                  type="checkbox"
                  checked={includeHeader}
                  onChange={(e) => setIncludeHeader(e.target.checked)}
                />
                <span>Incluir cabecera clínica (Título, fecha de revisión y ruta)</span>
              </label>

              {tags.length > 0 && (
                <label className="pdf-checkbox-row">
                  <input
                    type="checkbox"
                    checked={includeTags}
                    onChange={(e) => setIncludeTags(e.target.checked)}
                  />
                  <span>Incluir etiquetas del artículo ({tags.map(t => `#${t}`).join(', ')})</span>
                </label>
              )}
            </div>
          </div>

          {/* Consejo de Impresión / Guardado PDF */}
          <div className="pdf-hint-box">
            <span>💡 <strong>Consejo:</strong> En el diálogo de impresión de tu navegador, elige <em>"Guardar como PDF"</em> como impresora para generar el archivo digital.</span>
          </div>
        </div>

        {/* Acciones */}
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary btn-print-confirm"
            onClick={handleExport}
          >
            🖨️ Imprimir / Guardar como PDF
          </button>
        </div>
      </div>
    </div>
  )
}
