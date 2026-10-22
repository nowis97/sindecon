import { useEffect, useRef, useState } from 'react'

let mermaidIdCounter = 0

// Memoria caché global de SVGs de diagramas Mermaid ya renderizados
export const mermaidSvgCache = new Map<string, string>()

let mermaidInitPromise: Promise<typeof import('mermaid').default> | null = null

export async function getMermaid() {
  if (!mermaidInitPromise) {
    mermaidInitPromise = (async () => {
      const { default: mermaid } = await import('mermaid')
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'loose',
      })
      return mermaid
    })()
  }
  return mermaidInitPromise
}

// Cola secuencial de renderizado para evitar colisiones internas en el DOM de Mermaid
let renderQueue = Promise.resolve()

export async function renderMermaidSvg(code: string): Promise<string> {
  const trimmed = code.trim()
  if (!trimmed) return ''

  const cached = mermaidSvgCache.get(trimmed)
  if (cached) return cached

  return new Promise<string>((resolve, reject) => {
    renderQueue = renderQueue.then(async () => {
      const existing = mermaidSvgCache.get(trimmed)
      if (existing) {
        resolve(existing)
        return
      }
      try {
        const mermaid = await getMermaid()
        const id = `reader-mmd-${++mermaidIdCounter}-${Date.now()}`
        const { svg } = await mermaid.render(id, trimmed)
        mermaidSvgCache.set(trimmed, svg)
        resolve(svg)
      } catch (err) {
        reject(err)
      }
    })
  })
}

export async function preloadMermaidDiagrams(codes: string[]): Promise<void> {
  const unique = Array.from(new Set(codes.map((c) => c.trim()).filter(Boolean)))
  if (unique.length === 0) return

  await Promise.all(
    unique.map((code) =>
      renderMermaidSvg(code).catch((err) => {
        console.warn('Error precargando diagrama mermaid:', err)
      }),
    ),
  )
}

interface MermaidViewerProps {
  code: string
  isPrintView?: boolean
}

export function MermaidViewer({ code, isPrintView = false }: MermaidViewerProps) {
  const trimmed = code.trim()
  const [svg, setSvg] = useState<string | null>(() => mermaidSvgCache.get(trimmed) || null)
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isFullscreen, setIsFullscreen] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true

    if (!trimmed) {
      setSvg(null)
      setError(null)
      return
    }

    if (mermaidSvgCache.has(trimmed)) {
      setSvg(mermaidSvgCache.get(trimmed)!)
      setError(null)
      return
    }

    renderMermaidSvg(trimmed)
      .then((renderedSvg) => {
        if (active) {
          setSvg(renderedSvg)
          setError(null)
        }
      })
      .catch((err) => {
        if (active) {
          setError((err as Error).message || 'Error de sintaxis en diagrama mermaid')
          setSvg(null)
        }
      })

    return () => {
      active = false
    }
  }, [trimmed])

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3))
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5))
  const handleResetZoom = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    })
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false)
    try {
      ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
    } catch {
      // Ignorar si el puntero ya no está capturado
    }
  }

  if (error) {
    return (
      <div className="mermaid-error">
        <p className="error-title">⚠ Diagrama mermaid no válido</p>
        <pre className="mermaid-code-fallback">{code}</pre>
      </div>
    )
  }

  if (!svg) {
    return <div className="mermaid-loading">Cargando esquema…</div>
  }

  const viewerContent = (
    <div className={`mermaid-viewer-card ${isFullscreen ? 'fullscreen-mode' : ''} ${isPrintView ? 'is-print-view' : ''}`}>
      {!isPrintView && (
        <div className="mermaid-controls">
          <span className="mermaid-tag">Algoritmo / Esquema</span>
          <div className="mermaid-buttons">
            <button type="button" onClick={handleZoomIn} title="Acercar (+)">
              +
            </button>
            <button type="button" onClick={handleZoomOut} title="Alejar (-)">
              -
            </button>
            <button type="button" onClick={handleResetZoom} title="Restablecer tamaño">
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            >
              {isFullscreen ? '✕' : '⛶'}
            </button>
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        className="mermaid-viewport"
        onPointerDown={isPrintView ? undefined : handlePointerDown}
        onPointerMove={isPrintView ? undefined : handlePointerMove}
        onPointerUp={isPrintView ? undefined : handlePointerUp}
        onPointerCancel={isPrintView ? undefined : handlePointerUp}
        style={{ cursor: isPrintView ? 'default' : isDragging ? 'grabbing' : 'grab' }}
      >
        <div
          className="mermaid-svg-wrapper"
          style={{
            transform: isPrintView ? 'none' : `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'top center',
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </div>
  )

  if (isFullscreen) {
    return (
      <div className="mermaid-fullscreen-overlay">
        {viewerContent}
      </div>
    )
  }

  return viewerContent
}
