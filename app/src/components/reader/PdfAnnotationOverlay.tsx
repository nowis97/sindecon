import React, { useEffect, useRef, useState, useCallback } from 'react'
import type { AnnotationStroke, AnnotationTool } from '../../db/db'
import {
  getPageAnnotations,
  savePageAnnotations,
  clearPageAnnotations,
} from '../../db/pdfAnnotations'
import {
  clientToPdfPoint,
  drawStroke,
  isPointNearStroke,
  redrawAllStrokes,
} from '../../utils/pdfAnnotationUtils'

export interface PdfAnnotationOverlayProps {
  documentId: string
  pageNumber: number
  scale: number
  pixelRatio: number
  width: number
  height: number
  isAnnotationMode: boolean
  activeTool: AnnotationTool
  activeColor: string
  activeWidth: number
  undoTrigger?: number
  clearTrigger?: number
  isCurrentTargetPage?: boolean
  onStrokeCountChange?: (pageNumber: number, count: number) => void
}

export const PdfAnnotationOverlay: React.FC<PdfAnnotationOverlayProps> = ({
  documentId,
  pageNumber,
  scale,
  pixelRatio,
  width,
  height,
  isAnnotationMode,
  activeTool,
  activeColor,
  activeWidth,
  undoTrigger = 0,
  clearTrigger = 0,
  isCurrentTargetPage = false,
  onStrokeCountChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [strokes, setStrokes] = useState<AnnotationStroke[]>([])
  const isDrawingRef = useRef(false)
  const isErasingRef = useRef(false)
  const currentStrokeRef = useRef<AnnotationStroke | null>(null)
  const strokesRef = useRef<AnnotationStroke[]>([])
  strokesRef.current = strokes

  const lastUndoRef = useRef(undoTrigger)
  const lastClearRef = useRef(clearTrigger)

  // 1. Cargar anotaciones iniciales desde IndexedDB
  useEffect(() => {
    let active = true

    async function load() {
      if (!documentId || pageNumber < 1) return
      const loaded = await getPageAnnotations(documentId, pageNumber)
      if (active) {
        setStrokes(loaded)
        onStrokeCountChange?.(pageNumber, loaded.length)
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [documentId, pageNumber, onStrokeCountChange])

  // 2. Redibujar cuando cambian trazos, escala o dimensiones
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || width <= 0 || height <= 0) return

    canvas.width = Math.floor(width * pixelRatio)
    canvas.height = Math.floor(height * pixelRatio)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    redrawAllStrokes(canvas, strokes, scale, pixelRatio)
  }, [strokes, scale, pixelRatio, width, height])

  // 3. Manejar disparador de Deshacer (Undo)
  useEffect(() => {
    if (undoTrigger > lastUndoRef.current) {
      lastUndoRef.current = undoTrigger
      if (isCurrentTargetPage && strokesRef.current.length > 0) {
        const nextStrokes = strokesRef.current.slice(0, -1)
        setStrokes(nextStrokes)
        onStrokeCountChange?.(pageNumber, nextStrokes.length)
        void savePageAnnotations(documentId, pageNumber, nextStrokes)
      }
    }
  }, [undoTrigger, isCurrentTargetPage, documentId, pageNumber, onStrokeCountChange])

  // 4. Manejar disparador de Limpiar página (Clear)
  useEffect(() => {
    if (clearTrigger > lastClearRef.current) {
      lastClearRef.current = clearTrigger
      if (isCurrentTargetPage && strokesRef.current.length > 0) {
        setStrokes([])
        onStrokeCountChange?.(pageNumber, 0)
        void clearPageAnnotations(documentId, pageNumber)
      }
    }
  }, [clearTrigger, isCurrentTargetPage, documentId, pageNumber, onStrokeCountChange])

  // 5. Manejo de eventos de puntero (Mouse, Stylus, Touch)
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isAnnotationMode || e.button !== 0) return
      const canvas = canvasRef.current
      if (!canvas) return

      try {
        canvas.setPointerCapture(e.pointerId)
      } catch {}

      const rect = canvas.getBoundingClientRect()
      const pt = clientToPdfPoint(e.clientX, e.clientY, rect, scale, e.pressure)

      if (activeTool === 'eraser') {
        isErasingRef.current = true
        const next = strokesRef.current.filter((s) => !isPointNearStroke(pt, s, 12))
        if (next.length !== strokesRef.current.length) {
          setStrokes(next)
          onStrokeCountChange?.(pageNumber, next.length)
          void savePageAnnotations(documentId, pageNumber, next)
        }
      } else {
        isDrawingRef.current = true
        const id =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `stroke-${Date.now()}-${Math.random()}`

        const newStroke: AnnotationStroke = {
          id,
          tool: activeTool,
          color: activeColor,
          width: activeWidth,
          points: [pt],
        }

        currentStrokeRef.current = newStroke

        // Dibujar el punto inicial de inmediato
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.save()
          ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
          drawStroke(ctx, newStroke, scale)
          ctx.restore()
        }
      }
    },
    [
      isAnnotationMode,
      scale,
      pixelRatio,
      activeTool,
      activeColor,
      activeWidth,
      documentId,
      pageNumber,
      onStrokeCountChange,
    ],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isAnnotationMode) return
      const canvas = canvasRef.current
      if (!canvas) return

      if (isErasingRef.current) {
        const rect = canvas.getBoundingClientRect()
        const pt = clientToPdfPoint(e.clientX, e.clientY, rect, scale, e.pressure)
        const next = strokesRef.current.filter((s) => !isPointNearStroke(pt, s, 12))
        if (next.length !== strokesRef.current.length) {
          setStrokes(next)
          onStrokeCountChange?.(pageNumber, next.length)
          void savePageAnnotations(documentId, pageNumber, next)
        }
        return
      }

      if (isDrawingRef.current && currentStrokeRef.current) {
        const rect = canvas.getBoundingClientRect()
        const pt = clientToPdfPoint(e.clientX, e.clientY, rect, scale, e.pressure)
        const stroke = currentStrokeRef.current
        const pts = stroke.points

        // Evitar puntos duplicados extremadamente cercanos
        const last = pts[pts.length - 1]
        const dx = pt.x - last.x
        const dy = pt.y - last.y
        if (dx * dx + dy * dy < 1.0) return

        pts.push(pt)

        // Dibujar en vivo sobre el canvas
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.save()
          ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
          // Dibujar el trazo actualizado
          drawStroke(ctx, stroke, scale)
          ctx.restore()
        }
      }
    },
    [isAnnotationMode, scale, pixelRatio, documentId, pageNumber, onStrokeCountChange],
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (canvas) {
        try {
          canvas.releasePointerCapture(e.pointerId)
        } catch {}
      }

      if (isErasingRef.current) {
        isErasingRef.current = false
      }

      if (isDrawingRef.current && currentStrokeRef.current) {
        isDrawingRef.current = false
        const completedStroke = currentStrokeRef.current
        currentStrokeRef.current = null

        const nextStrokes = [...strokesRef.current, completedStroke]
        setStrokes(nextStrokes)
        onStrokeCountChange?.(pageNumber, nextStrokes.length)
        void savePageAnnotations(documentId, pageNumber, nextStrokes)
      }
    },
    [documentId, pageNumber, onStrokeCountChange],
  )

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      handlePointerUp(e)
    },
    [handlePointerUp],
  )

  return (
    <canvas
      ref={canvasRef}
      className={`pdf-annotation-canvas ${isAnnotationMode ? 'active' : ''} tool-${activeTool}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: `${width}px`,
        height: `${height}px`,
        pointerEvents: isAnnotationMode ? 'auto' : 'none',
        touchAction: isAnnotationMode ? 'none' : 'auto',
      }}
      data-annotation-page={pageNumber}
    />
  )
}
