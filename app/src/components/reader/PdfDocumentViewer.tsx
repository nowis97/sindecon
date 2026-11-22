import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import {
  FileText,
  ZoomOut,
  ZoomIn,
  PenLine,
  Download,
  ExternalLink,
  Highlighter,
  Eraser,
  Undo2,
  Trash2,
  AlertTriangle,
  Check,
} from 'lucide-react'
import { getAssetBlob } from '../../db/assets'
import type { AnnotationTool } from '../../db/db'
import { PdfAnnotationOverlay } from './PdfAnnotationOverlay'

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
  documentId: string
  isAnnotationMode: boolean
  activeTool: AnnotationTool
  activeColor: string
  activeWidth: number
  undoTrigger: number
  clearTrigger: number
  targetPageNumber: number
  onPageDrawn: (pageNumber: number) => void
}

const PdfPageCanvas: React.FC<PdfPageProps> = React.memo(
  ({
    pdfDoc,
    pageNumber,
    scale,
    documentId,
    isAnnotationMode,
    activeTool,
    activeColor,
    activeWidth,
    undoTrigger,
    clearTrigger,
    targetPageNumber,
    onPageDrawn,
  }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null)
    const [renderError, setRenderError] = useState<string | null>(null)
    const [dimensions, setDimensions] = useState<{
      width: number
      height: number
      pixelRatio: number
    }>({
      width: 0,
      height: 0,
      pixelRatio: 1,
    })

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
          const w = Math.floor(viewport.width)
          const h = Math.floor(viewport.height)

          canvas.width = Math.floor(w * pixelRatio)
          canvas.height = Math.floor(h * pixelRatio)
          canvas.style.width = `${w}px`
          canvas.style.height = `${h}px`

          setDimensions({ width: w, height: h, pixelRatio })

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
      <div
        className="pdf-page-canvas-wrapper"
        data-page-number={pageNumber}
        style={{ position: 'relative' }}
      >
        <canvas ref={canvasRef} className="pdf-page-canvas" />
        {dimensions.width > 0 && dimensions.height > 0 && (
          <PdfAnnotationOverlay
            documentId={documentId}
            pageNumber={pageNumber}
            scale={scale}
            pixelRatio={dimensions.pixelRatio}
            width={dimensions.width}
            height={dimensions.height}
            isAnnotationMode={isAnnotationMode}
            activeTool={activeTool}
            activeColor={activeColor}
            activeWidth={activeWidth}
            undoTrigger={undoTrigger}
            clearTrigger={clearTrigger}
            isCurrentTargetPage={targetPageNumber === pageNumber}
            onStrokeCountChange={() => onPageDrawn(pageNumber)}
          />
        )}
      </div>
    )
  },
)

PdfPageCanvas.displayName = 'PdfPageCanvas'

interface ColorOption {
  label: string
  value: string
  previewColor?: string
}

const PEN_COLORS: ColorOption[] = [
  { label: 'Negro', value: '#1e293b' },
  { label: 'Azul', value: '#2563eb' },
  { label: 'Rojo', value: '#dc2626' },
  { label: 'Verde', value: '#16a34a' },
]

const HIGHLIGHTER_COLORS: ColorOption[] = [
  { label: 'Amarillo', value: 'rgba(250, 204, 21, 0.45)', previewColor: '#facc15' },
  { label: 'Verde', value: 'rgba(74, 222, 128, 0.45)', previewColor: '#4ade80' },
  { label: 'Rosa', value: 'rgba(244, 114, 182, 0.45)', previewColor: '#f472b6' },
  { label: 'Celeste', value: 'rgba(56, 189, 248, 0.45)', previewColor: '#38bdf8' },
]

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

  // Estados de anotaciones
  const [isAnnotationMode, setIsAnnotationMode] = useState(false)
  const [activeTool, setActiveTool] = useState<AnnotationTool>('pen')
  const [activeColor, setActiveColor] = useState('#1e293b')
  const [activeWidth, setActiveWidth] = useState(3)
  const [undoTrigger, setUndoTrigger] = useState(0)
  const [clearTrigger, setClearTrigger] = useState(0)
  const [lastDrawnPage, setLastDrawnPage] = useState(1)

  const documentId = src.replace(/^asset:\/\//, '')

  const containerRef = useRef<HTMLDivElement | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)

  const handleSelectTool = (tool: AnnotationTool) => {
    setActiveTool(tool)
    if (tool === 'highlighter') {
      if (!activeColor.startsWith('rgba')) {
        setActiveColor('rgba(250, 204, 21, 0.45)')
      }
      setActiveWidth(18)
    } else if (tool === 'pen') {
      if (activeColor.startsWith('rgba')) {
        setActiveColor('#1e293b')
      }
      setActiveWidth(3)
    }
  }

  const handleUndo = () => {
    setUndoTrigger((c) => c + 1)
  }

  const handleClearPage = () => {
    setClearTrigger((c) => c + 1)
  }

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
    ? `${title.replace(/[\\/:*?"<>|]/g, '-').trim()}.pdf`
    : 'documento.pdf'

  const handleOpenInNewTab = () => {
    if (!blobUrl) return
    window.open(blobUrl, '_blank')
  }

  if (isLoading) {
    return (
      <div className={`pdf-viewer-loading-container ${className}`}>
        <div className="pdf-viewer-spinner" />
        <p>Cargando documento con PDF.js…</p>
      </div>
    )
  }

  if (error || !blobUrl) {
    return (
      <div className={`pdf-viewer-error-container clinical-home ${className}`}>
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/14 text-amber-600 dark:text-amber-300">
          <AlertTriangle className="h-6 w-6" />
        </span>
        <p className="text-sm text-[var(--ch-text-secondary)]">
          {error || 'No se pudo generar la vista previa del documento.'}
        </p>
        {blobUrl && (
          <a
            href={blobUrl}
            download={downloadFilename}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[var(--ch-accent-solid)] px-5 text-xs font-semibold text-white shadow-xs transition hover:opacity-95"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Descargar archivo PDF</span>
          </a>
        )}
      </div>
    )
  }

  return (
    <div ref={containerRef} className={`pdf-document-viewer clinical-home ${className}`}>
      {/* Barra de herramientas superior del visor */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2.5 border-b border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] px-4 py-2.5 md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <div className="flex min-w-0 max-w-xs items-center gap-2 md:justify-self-start">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]">
            <FileText className="h-4 w-4" />
          </span>
          <span
            className="truncate text-sm font-semibold text-[var(--ch-text-primary)]"
            title={title || 'Documento PDF'}
          >
            {title || 'Documento PDF'}
          </span>
          {numPages > 0 && (
            <span className="shrink-0 rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[var(--ch-text-secondary)]">
              {numPages} {numPages === 1 ? 'pág' : 'págs'}
            </span>
          )}
        </div>

        {/* Controles de Zoom */}
        <div className="inline-flex items-center rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] p-0.5 md:justify-self-center">
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--ch-text-secondary)] transition hover:bg-[var(--ch-bg-elevated)] hover:text-[var(--ch-text-primary)]"
            onClick={handleZoomOut}
            title="Reducir zoom"
            aria-label="Reducir zoom"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="h-7 rounded-full px-2.5 font-mono text-[11px] font-semibold text-[var(--ch-text-primary)] transition hover:bg-[var(--ch-bg-elevated)]"
            onClick={handleResetFit}
            title="Ajustar al ancho de la pantalla"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--ch-text-secondary)] transition hover:bg-[var(--ch-bg-elevated)] hover:text-[var(--ch-text-primary)]"
            onClick={handleZoomIn}
            title="Aumentar zoom"
            aria-label="Aumentar zoom"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Acciones principales */}
        <div className="flex flex-wrap items-center gap-1.5 md:justify-self-end">
          <button
            type="button"
            className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition ${
              isAnnotationMode
                ? 'border-[var(--ch-accent-solid)] bg-[var(--ch-accent-solid)] text-white shadow-xs'
                : 'border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] text-[var(--ch-text-secondary)] hover:border-[var(--ch-accent)] hover:text-[var(--ch-text-primary)]'
            }`}
            onClick={() => setIsAnnotationMode((prev) => !prev)}
            title={
              isAnnotationMode
                ? 'Finalizar y salir del modo anotación'
                : 'Anotar con lápiz o resaltador sobre el PDF'
            }
          >
            {isAnnotationMode ? <Check className="h-3.5 w-3.5" /> : <PenLine className="h-3.5 w-3.5" />}
            <span>{isAnnotationMode ? 'Finalizar' : 'Anotar'}</span>
          </button>
          <a
            href={blobUrl}
            download={downloadFilename}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] px-3.5 text-xs font-semibold text-[var(--ch-text-secondary)] transition hover:border-[var(--ch-accent)] hover:text-[var(--ch-text-primary)]"
            title="Descargar archivo PDF"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Descargar</span>
          </a>
          <button
            type="button"
            onClick={handleOpenInNewTab}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] px-3.5 text-xs font-semibold text-[var(--ch-text-secondary)] transition hover:border-[var(--ch-accent)] hover:text-[var(--ch-text-primary)]"
            title="Abrir en pestaña nueva"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Pestaña nueva</span>
          </button>
        </div>
      </div>

      {/* Barra de herramientas secundaria de Anotación (Lápiz, Resaltador, Borrador) */}
      {isAnnotationMode && (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2.5 border-b border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/75 px-4 py-2">
          <div className="inline-flex rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] p-0.5">
            <button
              type="button"
              className={`inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition ${
                activeTool === 'pen'
                  ? 'bg-[var(--ch-accent-solid)] text-white shadow-xs'
                  : 'text-[var(--ch-text-secondary)] hover:text-[var(--ch-text-primary)]'
              }`}
              onClick={() => handleSelectTool('pen')}
              title="Lápiz / Bolígrafo"
            >
              <PenLine className="h-3.5 w-3.5" />
              <span>Lápiz</span>
            </button>
            <button
              type="button"
              className={`inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition ${
                activeTool === 'highlighter'
                  ? 'bg-[var(--ch-accent-solid)] text-white shadow-xs'
                  : 'text-[var(--ch-text-secondary)] hover:text-[var(--ch-text-primary)]'
              }`}
              onClick={() => handleSelectTool('highlighter')}
              title="Resaltador / Marcador"
            >
              <Highlighter className="h-3.5 w-3.5" />
              <span>Resaltador</span>
            </button>
            <button
              type="button"
              className={`inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition ${
                activeTool === 'eraser'
                  ? 'bg-[var(--ch-accent-solid)] text-white shadow-xs'
                  : 'text-[var(--ch-text-secondary)] hover:text-[var(--ch-text-primary)]'
              }`}
              onClick={() => handleSelectTool('eraser')}
              title="Borrador de trazos"
            >
              <Eraser className="h-3.5 w-3.5" />
              <span>Borrador</span>
            </button>
          </div>

          {activeTool !== 'eraser' && (
            <div className="flex items-center gap-1.5 rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] px-2.5 py-1">
              {(activeTool === 'pen' ? PEN_COLORS : HIGHLIGHTER_COLORS).map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={`h-5 w-5 rounded-full border transition ${
                    activeColor === c.value
                      ? 'scale-110 border-[var(--ch-text-primary)] ring-2 ring-[var(--ch-accent)]/40'
                      : 'border-[var(--ch-border-strong)] hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.previewColor || c.value }}
                  onClick={() => setActiveColor(c.value)}
                  title={c.label}
                  aria-label={c.label}
                />
              ))}
            </div>
          )}

          {activeTool !== 'eraser' && (
            <div className="inline-flex rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] p-0.5">
              <button
                type="button"
                className={`h-7 rounded-full px-2.5 text-[11px] font-semibold transition ${
                  activeWidth === (activeTool === 'pen' ? 2 : 10)
                    ? 'bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]'
                    : 'text-[var(--ch-text-secondary)] hover:text-[var(--ch-text-primary)]'
                }`}
                onClick={() => setActiveWidth(activeTool === 'pen' ? 2 : 10)}
                title="Grosor fino"
              >
                Fino
              </button>
              <button
                type="button"
                className={`h-7 rounded-full px-2.5 text-[11px] font-semibold transition ${
                  activeWidth === (activeTool === 'pen' ? 4 : 18)
                    ? 'bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]'
                    : 'text-[var(--ch-text-secondary)] hover:text-[var(--ch-text-primary)]'
                }`}
                onClick={() => setActiveWidth(activeTool === 'pen' ? 4 : 18)}
                title="Grosor medio"
              >
                Medio
              </button>
              <button
                type="button"
                className={`h-7 rounded-full px-2.5 text-[11px] font-semibold transition ${
                  activeWidth === (activeTool === 'pen' ? 7 : 28)
                    ? 'bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]'
                    : 'text-[var(--ch-text-secondary)] hover:text-[var(--ch-text-primary)]'
                }`}
                onClick={() => setActiveWidth(activeTool === 'pen' ? 7 : 28)}
                title="Grosor grueso"
              >
                Grueso
              </button>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] px-3 text-xs font-semibold text-[var(--ch-text-secondary)] transition hover:border-[var(--ch-accent)] hover:text-[var(--ch-text-primary)]"
              onClick={handleUndo}
              title="Deshacer último trazo de la página"
            >
              <Undo2 className="h-3.5 w-3.5" />
              <span>Deshacer</span>
            </button>
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/8 px-3 text-xs font-semibold text-red-600 transition hover:bg-red-500/15 dark:text-red-400"
              onClick={handleClearPage}
              title="Borrar todas las anotaciones de esta página"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Borrar pág.</span>
            </button>
          </div>
        </div>
      )}

      {/* Contenedor de scroll y renderizado de páginas en Canvas */}
      <div ref={scrollContainerRef} className="pdf-canvas-scroll-container">
        {pdfDoc &&
          Array.from({ length: numPages }, (_, idx) => (
            <PdfPageCanvas
              key={`page-${idx + 1}`}
              pdfDoc={pdfDoc}
              pageNumber={idx + 1}
              scale={scale}
              documentId={documentId}
              isAnnotationMode={isAnnotationMode}
              activeTool={activeTool}
              activeColor={activeColor}
              activeWidth={activeWidth}
              undoTrigger={undoTrigger}
              clearTrigger={clearTrigger}
              targetPageNumber={lastDrawnPage}
              onPageDrawn={(p) => setLastDrawnPage(p)}
            />
          ))}
      </div>
    </div>
  )
}
