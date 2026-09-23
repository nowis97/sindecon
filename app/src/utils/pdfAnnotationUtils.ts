import type { AnnotationPoint, AnnotationStroke } from '../db/db'

/**
 * Convierte coordenadas del viewport (event.clientX/Y) a coordenadas normalizadas
 * en puntos PDF a escala base 1.0.
 */
export function clientToPdfPoint(
  clientX: number,
  clientY: number,
  canvasRect: { left: number; top: number; width: number; height: number },
  scale: number,
  pressure?: number,
): AnnotationPoint {
  if (scale <= 0) scale = 1.0
  const xCss = Math.max(0, Math.min(canvasRect.width, clientX - canvasRect.left))
  const yCss = Math.max(0, Math.min(canvasRect.height, clientY - canvasRect.top))

  return {
    x: Number((xCss / scale).toFixed(2)),
    y: Number((yCss / scale).toFixed(2)),
    pressure: pressure !== undefined ? Number(pressure.toFixed(2)) : undefined,
  }
}

/**
 * Calcula la distancia mínima desde un punto P hasta un segmento de línea AB.
 */
export function distanceToSegment(
  p: AnnotationPoint,
  a: AnnotationPoint,
  b: AnnotationPoint,
): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const l2 = dx * dx + dy * dy
  if (l2 === 0) {
    const dpx = p.x - a.x
    const dpy = p.y - a.y
    return Math.sqrt(dpx * dpx + dpy * dpy)
  }

  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2))
  const projX = a.x + t * dx
  const projY = a.y + t * dy
  const distDx = p.x - projX
  const distDy = p.y - projY
  return Math.sqrt(distDx * distDx + distDy * distDy)
}

/**
 * Determina si un punto está dentro de la tolerancia de borrado de un trazo.
 */
export function isPointNearStroke(
  point: AnnotationPoint,
  stroke: AnnotationStroke,
  tolerance = 10,
): boolean {
  if (!stroke.points || stroke.points.length === 0) return false
  if (stroke.points.length === 1) {
    const p0 = stroke.points[0]
    const dx = point.x - p0.x
    const dy = point.y - p0.y
    return Math.sqrt(dx * dx + dy * dy) <= Math.max(tolerance, stroke.width / 2)
  }

  for (let i = 0; i < stroke.points.length - 1; i++) {
    const a = stroke.points[i]
    const b = stroke.points[i + 1]
    const d = distanceToSegment(point, a, b)
    if (d <= Math.max(tolerance, stroke.width / 2)) {
      return true
    }
  }

  return false
}

/**
 * Dibuja un trazo vectorial individual en un contexto 2D de Canvas escalado.
 */
export function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: AnnotationStroke,
  scale: number,
): void {
  const pts = stroke.points
  if (!pts || pts.length === 0) return

  ctx.save()

  const strokeWidth = Math.max(1, stroke.width * scale)
  ctx.lineWidth = strokeWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (stroke.tool === 'highlighter') {
    ctx.strokeStyle = stroke.color
    ctx.globalAlpha = 0.45
    // En navegadores que soportan 'multiply', esto produce un efecto de resaltador auténtico sobre texto
    ctx.globalCompositeOperation = 'source-over'
  } else if (stroke.tool === 'eraser') {
    ctx.strokeStyle = '#ffffff'
    ctx.globalCompositeOperation = 'destination-out'
  } else {
    ctx.strokeStyle = stroke.color
    ctx.globalAlpha = 1.0
    ctx.globalCompositeOperation = 'source-over'
  }

  if (pts.length === 1) {
    const p0 = pts[0]
    ctx.beginPath()
    ctx.arc(p0.x * scale, p0.y * scale, strokeWidth / 2, 0, Math.PI * 2)
    ctx.fillStyle = stroke.color
    ctx.fill()
    ctx.restore()
    return
  }

  ctx.beginPath()
  ctx.moveTo(pts[0].x * scale, pts[0].y * scale)

  if (pts.length === 2) {
    ctx.lineTo(pts[1].x * scale, pts[1].y * scale)
  } else {
    // Interpolación con curvas de Bézier cuadráticas para máxima suavidad
    for (let i = 1; i < pts.length - 1; i++) {
      const p1 = pts[i]
      const p2 = pts[i + 1]
      const midX = ((p1.x + p2.x) / 2) * scale
      const midY = ((p1.y + p2.y) / 2) * scale
      ctx.quadraticCurveTo(p1.x * scale, p1.y * scale, midX, midY)
    }
    const last = pts[pts.length - 1]
    ctx.lineTo(last.x * scale, last.y * scale)
  }

  ctx.stroke()
  ctx.restore()
}

/**
 * Redibuja todos los trazos en el lienzo de anotaciones.
 */
export function redrawAllStrokes(
  canvas: HTMLCanvasElement,
  strokes: AnnotationStroke[],
  scale: number,
  pixelRatio: number,
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.save()
  // Limpiar lienzo completo
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Aplicar factor de densidad de píxeles para alta resolución
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)

  for (const stroke of strokes) {
    drawStroke(ctx, stroke, scale)
  }

  ctx.restore()
}
