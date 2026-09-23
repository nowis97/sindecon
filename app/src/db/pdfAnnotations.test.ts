import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db, type AnnotationStroke } from './db'
import {
  getPageAnnotations,
  savePageAnnotations,
  clearPageAnnotations,
  clearAllDocumentAnnotations,
} from './pdfAnnotations'

beforeEach(async () => {
  await db.pdf_annotations.clear()
})

describe('pdfAnnotations database service', () => {
  const sampleStrokes: AnnotationStroke[] = [
    {
      id: 'stroke-1',
      tool: 'pen',
      color: '#1e293b',
      width: 2,
      points: [
        { x: 10, y: 20 },
        { x: 15, y: 25 },
        { x: 20, y: 30 },
      ],
    },
    {
      id: 'stroke-2',
      tool: 'highlighter',
      color: 'rgba(250, 204, 21, 0.45)',
      width: 14,
      points: [
        { x: 50, y: 80 },
        { x: 120, y: 80 },
      ],
    },
  ]

  it('devuelve un arreglo vacío si no existen anotaciones para la página', async () => {
    const strokes = await getPageAnnotations('doc-123', 1)
    expect(strokes).toEqual([])
  })

  it('guarda y recupera trazos para una página específica', async () => {
    await savePageAnnotations('doc-123', 1, sampleStrokes)

    const saved = await getPageAnnotations('doc-123', 1)
    expect(saved).toHaveLength(2)
    expect(saved[0].id).toBe('stroke-1')
    expect(saved[0].tool).toBe('pen')
    expect(saved[1].id).toBe('stroke-2')
    expect(saved[1].tool).toBe('highlighter')

    // Otra página del mismo documento no debe tener trazos
    const page2 = await getPageAnnotations('doc-123', 2)
    expect(page2).toEqual([])
  })

  it('actualiza trazos existentes de una página', async () => {
    await savePageAnnotations('doc-123', 1, sampleStrokes)

    const updatedStrokes: AnnotationStroke[] = [
      ...sampleStrokes,
      {
        id: 'stroke-3',
        tool: 'pen',
        color: '#dc2626',
        width: 3,
        points: [{ x: 30, y: 40 }],
      },
    ]

    await savePageAnnotations('doc-123', 1, updatedStrokes)
    const result = await getPageAnnotations('doc-123', 1)
    expect(result).toHaveLength(3)
    expect(result[2].id).toBe('stroke-3')
  })

  it('elimina el registro si se guarda un arreglo vacío', async () => {
    await savePageAnnotations('doc-123', 1, sampleStrokes)
    expect(await getPageAnnotations('doc-123', 1)).toHaveLength(2)

    await savePageAnnotations('doc-123', 1, [])
    expect(await getPageAnnotations('doc-123', 1)).toEqual([])

    const count = await db.pdf_annotations.count()
    expect(count).toBe(0)
  })

  it('limpia las anotaciones de una página con clearPageAnnotations', async () => {
    await savePageAnnotations('doc-123', 1, sampleStrokes)
    await savePageAnnotations('doc-123', 2, sampleStrokes)

    await clearPageAnnotations('doc-123', 1)
    expect(await getPageAnnotations('doc-123', 1)).toEqual([])
    expect(await getPageAnnotations('doc-123', 2)).toHaveLength(2)
  })

  it('elimina todas las anotaciones de todas las páginas de un documento', async () => {
    await savePageAnnotations('doc-123', 1, sampleStrokes)
    await savePageAnnotations('doc-123', 2, sampleStrokes)
    await savePageAnnotations('doc-456', 1, sampleStrokes)

    await clearAllDocumentAnnotations('doc-123')
    expect(await getPageAnnotations('doc-123', 1)).toEqual([])
    expect(await getPageAnnotations('doc-123', 2)).toEqual([])
    expect(await getPageAnnotations('doc-456', 1)).toHaveLength(2)
  })
})
