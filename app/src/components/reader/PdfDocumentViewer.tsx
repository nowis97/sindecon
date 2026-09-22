import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { getAssetBlob } from '../../db/assets'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

interface PdfDocumentViewerProps {
  src: string
  title?: string
  className?: string
}

interface PdfPageProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy
  pageNumber: number
  scale: number
}

const PdfPageCanvas: React.FC<PdfPageProps> = React.memo(
  ({ pdfDoc, pageNumber, scale }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null)
    const [renderError, setRenderError] = useState<string | null>(null)

    useEffect(() => {
      let cancelled = false

      async function renderPage() {
        try {
          const page = await pdfDoc.getPage(pageNumber)
          if (cancelled) return

          const canvas = canvasRef.current
          if (!canvas) return
          const ctx = canvas.getContext('2d')
          if (!ctx) return

          if (renderTaskRef.current) {
            try {
              renderTaskRef.current.cancel()
            } catch {
              // Ignorar error de cancelación si ya terminó
            }
          }

          const pixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
          const viewport = page.getViewport({ scale })

          canvas.width = Math.floor(viewport.width * pixelRatio)
          canvas.height = Math.floor(viewport.height * pixelRatio)
          canvas.style.width = `${Math.floor(viewport.width)}px`
          canvas.style.height = `${Math.floor(viewport.height)}px`

          ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)

          const task = page.render({
            canvasContext: ctx,
            viewport,
          })
          renderTaskRef.current = task
          await task.promise
        } catch (err: unknown) {
          if (
            err &&
            typeof err === 'object' &&
            'name' in err &&
            (err as { name: string }).name === 'RenderingCancelledException'
          ) {
            return
          }
          if (!cancelled) {
            setRenderError(err instanceof Error ? err.message : 'Error al renderizar página')
          }
        }
      }

      void renderPage()

      return () => {
        cancelled = true
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel()
          } catch {
            // Ignorar cancelación al desmontar
          }
        }
      }
    }, [pdfDoc, pageNumber, scale])

    if (renderError) {
      return (
        <div className="pdf-page-error">
          <p>Error en pág. {pageNumber}: {renderError}</p>
        </div>
      )
    }

    return (
      <div className="pdf-page-canvas-wrapper" data-page-number={pageNumber}>
        <canvas ref={canvasRef} className="pdf-page-canvas" />
      </div>
    )
  },
)

PdfPageCanvas.displayName = 'PdfPageCanvas'

export const PdfDocumentViewer: React.FC<PdfDocumentViewerProps> = ({
  src,
  title,
  className = '',
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [numPages, setNumPages] = useState<number>(0)
  const [scale, setScale] = useState<number>(1.0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)

  const calculateFitScale = useCallback(async (doc: pdfjsLib.PDFDocumentProxy): Promise<number> => {
    try {
      const page1 = await doc.getPage(1)
      const unscaledViewport = page1.getViewport({ scale: 1.0 })
      const containerWidth = scrollContainerRef.current
        ? scrollContainerRef.current.clientWidth - 32
        : 800
      if (containerWidth <= 0 || unscaledViewport.width <= 0) return 1.0

      const fit = containerWidth / unscaledViewport.width
      // Limitar entre 0.4x y 2.5x para mantener legibilidad y rendimiento
      return Math.min(Math.max(Number(fit.toFixed(2)), 0.4), 2.5)
    } catch {
      return 1.0
    }
  }, [])

  useEffect(() => {
    let active = true
    let createdUrl: string | null = null

    async function loadPdf() {
      setIsLoading(true)
      setError(null)

      try {
        let pdfData: Uint8Array | null = null

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

          const arrayBuffer = await blob.arrayBuffer()
          pdfData = new Uint8Array(arrayBuffer)
        } else {
          setBlobUrl(src)
          const response = await fetch(src)
          const arrayBuffer = await response.arrayBuffer()
          pdfData = new Uint8Array(arrayBuffer)
        }

        if (!active) return

        const loadingTask = pdfjsLib.getDocument({
          data: pdfData,
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
          cMapPacked: true,
        })

        const doc = await loadingTask.promise
        if (!active) return

        setPdfDoc(doc)
        setNumPages(doc.numPages)

        // Calcular ajuste automático al ancho del contenedor
        const initialScale = await calculateFitScale(doc)
        if (active) {
          setScale(initialScale)
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error ? err.message : 'Error al procesar el documento PDF con PDF.js',
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
  }, [src, calculateFitScale])

  const handleZoomIn = () => {
    setScale((prev) => Math.min(3.0, Number((prev + 0.15).toFixed(2))))
  }

  const handleZoomOut = () => {
    setScale((prev) => Math.max(0.4, Number((prev - 0.15).toFixed(2))))
  }

  const handleResetFit = async () => {
    if (pdfDoc) {
      const fit = await calculateFitScale(pdfDoc)
      setScale(fit)
    } else {
      setScale(1.0)
    }
  }

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
        {blobUrl && (
          <a href={blobUrl} download={downloadFilename} className="btn-pdf-action btn-pdf-download">
            ⬇️ Descargar archivo PDF
          </a>
        )}
      </div>
    )
  }

  return (
    <div ref={containerRef} className={`pdf-document-viewer ${className}`}>
      {/* Barra de herramientas superior del visor */}
      <div className="pdf-viewer-toolbar">
        <div className="pdf-viewer-toolbar-title">
          <span className="pdf-icon">📄</span>
          <span className="pdf-title-text" title={title || 'Documento PDF'}>
            {title || 'Documento PDF'}
          </span>
          {numPages > 0 && (
            <span className="pdf-page-badge">
              {numPages} {numPages === 1 ? 'pág' : 'págs'}
            </span>
          )}
        </div>

        {/* Controles de Zoom */}
        <div className="pdf-viewer-controls-group">
          <button
            type="button"
            className="btn-pdf-zoom"
            onClick={handleZoomOut}
            title="Reducir zoom"
            aria-label="Reducir zoom"
          >
            🔍−
          </button>
          <button
            type="button"
            className="btn-pdf-zoom-reset"
            onClick={handleResetFit}
            title="Ajustar al ancho de la pantalla"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            type="button"
            className="btn-pdf-zoom"
            onClick={handleZoomIn}
            title="Aumentar zoom"
            aria-label="Aumentar zoom"
          >
            🔍+
          </button>
        </div>

        {/* Acciones principales */}
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

      {/* Contenedor de scroll y renderizado de páginas en Canvas */}
      <div ref={scrollContainerRef} className="pdf-canvas-scroll-container">
        {pdfDoc &&
          Array.from({ length: numPages }, (_, idx) => (
            <PdfPageCanvas
              key={`page-${idx + 1}`}
              pdfDoc={pdfDoc}
              pageNumber={idx + 1}
              scale={scale}
            />
          ))}
      </div>
    </div>
  )
}
