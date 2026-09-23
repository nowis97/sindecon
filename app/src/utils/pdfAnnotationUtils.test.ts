import { describe, it, expect } from 'vitest'
import {
  clientToPdfPoint,
  distanceToSegment,
  isPointNearStroke,
} from './pdfAnnotationUtils'
import type { AnnotationStroke } from '../db/db'

describe('pdfAnnotationUtils', () => {
  describe('clientToPdfPoint', () => {
    it('normaliza coordenadas respecto a la escala y origen del canvas', () => {
      const rect = { left: 100, top: 50, width: 800, height: 1000 }
      // Con escala 1.0
      const pt1 = clientToPdfPoint(200, 150, rect, 1.0)
      expect(pt1.x).toBe(100)
      expect(pt1.y).toBe(100)

      // Con escala 2.0 (zoom al doble)
      const pt2 = clientToPdfPoint(300, 250, rect, 2.0)
      expect(pt2.x).toBe(100) // (300 - 100) / 2 = 100
      expect(pt2.y).toBe(100) // (250 - 50) / 2 = 100
    })

    it('limita coordenadas dentro de los bordes del canvas', () => {
      const rect = { left: 100, top: 50, width: 800, height: 1000 }
      const pt = clientToPdfPoint(50, 20, rect, 1.0)
      expect(pt.x).toBe(0)
      expect(pt.y).toBe(0)
    })
  })

  describe('distanceToSegment', () => {
    it('calcula la distancia perpendicular exacta a un segmento horizontal', () => {
      const p = { x: 50, y: 30 }
      const a = { x: 10, y: 20 }
      const b = { x: 100, y: 20 }
      const dist = distanceToSegment(p, a, b)
      expect(dist).toBe(10)
    })

    it('calcula la distancia a los extremos si el punto está fuera de la proyección', () => {
      const p = { x: 5, y: 20 }
      const a = { x: 10, y: 20 }
      const b = { x: 100, y: 20 }
      const dist = distanceToSegment(p, a, b)
      expect(dist).toBe(5)
    })
  })

  describe('isPointNearStroke', () => {
    const stroke: AnnotationStroke = {
      id: 's1',
      tool: 'pen',
      color: '#000000',
      width: 4,
      points: [
        { x: 10, y: 10 },
        { x: 100, y: 10 },
      ],
    }

    it('detecta un punto cercano dentro de la tolerancia', () => {
      expect(isPointNearStroke({ x: 50, y: 14 }, stroke, 10)).toBe(true)
    })

    it('descarta un punto alejado fuera de la tolerancia', () => {
      expect(isPointNearStroke({ x: 50, y: 30 }, stroke, 10)).toBe(false)
    })
  })
})
