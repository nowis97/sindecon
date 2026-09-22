import React, { useEffect, useState } from 'react'
import { getAssetBlob } from '../../db/assets'

interface PdfDocumentViewerProps {
  src: string
  title?: string
  className?: string
}

export const PdfDocumentViewer: React.FC<PdfDocumentViewerProps> = ({
  src,
  title,
  className = '',
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    let createdUrl: string | null = null

    async function loadPdf() {
      setIsLoading(true)
      setError(null)

      try {
        if (src.startsWith('asset://')) {
          const assetId = src.slice('asset://'.length)
          const blob = await getAssetBlob(assetId)
          if (!active) return

          if (!blob) {
            setError('El archivo PDF no se encuentra en el almacenamiento local.')
            setIsLoading(false)
            return
          }

          createdUrl = URL.createObjectURL(blob)
          setBlobUrl(createdUrl)
        } else {
          setBlobUrl(src)
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error ? err.message : 'Error al cargar el documento PDF'
          )
        }
      } finally {
        if (active) setIsLoading(false)
      }
    }

    void loadPdf()

    return () => {
      active = false
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl)
      }
    }
  }, [src])

  const downloadFilename = title
    ? `${title.replace(/[\\/:*?"<>|]/g, '_')}.pdf`
    : 'documento.pdf'

  const handleOpenInNewTab = () => {
    if (blobUrl) {
      window.open(blobUrl, '_blank', 'noopener,noreferrer')
    }
  }

  if (isLoading) {
    return (
      <div className={`pdf-viewer-loading-container ${className}`}>
        <div className="pdf-viewer-spinner" />
        <p>Cargando documento PDF...</p>
      </div>
    )
  }

  if (error || !blobUrl) {
    return (
      <div className={`pdf-viewer-error-container ${className}`}>
        <span className="pdf-viewer-error-icon">⚠️</span>
        <p>{error || 'No se pudo generar la vista previa del documento.'}</p>
      </div>
    )
  }

  return (
    <div className={`pdf-document-viewer ${className}`}>
      <div className="pdf-viewer-toolbar">
        <div className="pdf-viewer-toolbar-title">
          <span className="pdf-icon">📄</span>
          <span className="pdf-title-text" title={title || 'Documento PDF'}>
            {title || 'Documento PDF'}
          </span>
        </div>
        <div className="pdf-viewer-toolbar-actions">
          <a
            href={blobUrl}
            download={downloadFilename}
            className="btn-pdf-action btn-pdf-download"
            title="Descargar archivo PDF"
          >
            ⬇️ <span className="btn-text">Descargar</span>
          </a>
          <button
            type="button"
            onClick={handleOpenInNewTab}
            className="btn-pdf-action btn-pdf-open"
            title="Abrir en pestaña nueva"
          >
            ↗️ <span className="btn-text">Pestaña nueva</span>
          </button>
        </div>
      </div>

      <div className="pdf-viewer-frame-container">
        <object
          data={blobUrl}
          type="application/pdf"
          className="pdf-viewer-object"
          aria-label={title || 'Documento PDF'}
        >
          <iframe
            src={blobUrl}
            className="pdf-viewer-iframe"
            title={title || 'Visor de PDF'}
          >
            <div className="pdf-viewer-fallback">
              <p>Tu navegador no soporta la visualización integrada de PDF.</p>
              <a href={blobUrl} download={downloadFilename} className="btn-pdf-download">
                ⬇️ Descargar PDF
              </a>
            </div>
          </iframe>
        </object>
      </div>
    </div>
  )
}
