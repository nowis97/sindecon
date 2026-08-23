import { useEffect, useRef, useState } from 'react'

let mermaidIdCounter = 0

interface MermaidViewerProps {
  code: string
}

export function MermaidViewer({ code }: MermaidViewerProps) {
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isFullscreen, setIsFullscreen] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    const renderChart = async () => {
      if (!code.trim()) {
        setSvg(null)
        setError(null)
        return
      }
      try {
        const { default: mermaid } = await import('mermaid')
        mermaid.initialize({
          startOnLoad: false,
          theme: 'default',
          securityLevel: 'loose',
        })
        const id = `reader-mmd-${++mermaidIdCounter}`
        const { svg: renderedSvg } = await mermaid.render(id, code)
        if (active) {
          setSvg(renderedSvg)
          setError(null)
        }
      } catch (err) {
        if (active) {
          setError((err as Error).message || 'Error de sintaxis en diagrama mermaid')
          setSvg(null)
        }
      }
    }

    void renderChart()
    return () => {
      active = false
    }
  }, [code])

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
    <div className={`mermaid-viewer-card ${isFullscreen ? 'fullscreen-mode' : ''}`}>
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

      <div
        ref={containerRef}
        className="mermaid-viewport"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <div
          className="mermaid-svg-wrapper"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
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
