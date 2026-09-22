import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from './db'
import { createNode } from './nodes'
import { savePdfAsArticle, saveMultiplePdfsAsArticles } from './pdfArticles'

beforeEach(async () => {
  await Promise.all([
    db.nodes.clear(),
    db.articles.clear(),
    db.assets.clear(),
    db.meta.clear(),
  ])
})

describe('pdfArticles persistence service', () => {
  it('guarda un archivo PDF como asset y crea el artículo enlazado', async () => {
    const folder = await createNode({ kind: 'folder', title: 'Guías Clínicas' })
    const fakeBlob = new Blob(['%PDF-1.4 mock content'], { type: 'application/pdf' })

    const result = await savePdfAsArticle({
      file: fakeBlob,
      title: 'Guía Hipertensión 2024',
      parentId: folder.id,
    })

    expect(result.nodeId).toBeDefined()
    expect(result.assetId).toBeDefined()
    expect(result.title).toBe('Guía Hipertensión 2024')

    // Verificar nodo en base de datos
    const node = await db.nodes.get(result.nodeId)
    expect(node).toBeDefined()
    expect(node?.title).toBe('Guía Hipertensión 2024')
    expect(node?.parent_id).toBe(folder.id)
    expect(node?.kind).toBe('article')

    // Verificar asset en base de datos
    const asset = await db.assets.get(result.assetId)
    expect(asset).toBeDefined()
    expect(asset?.node_id).toBe(result.nodeId)
    expect(asset?.mime).toBe('application/pdf')

    // Verificar artículo con referencia Markdown
    const article = await db.articles.get(result.nodeId)
    expect(article).toBeDefined()
    expect(article?.body_md).toBe(`[pdf](asset://${result.assetId})`)
  })

  it('guarda múltiples PDFs en lote reportando progreso', async () => {
    const folder = await createNode({ kind: 'folder', title: 'Cardiología' })
    const pdf1 = new Blob(['%PDF-1.4 1'], { type: 'application/pdf' })
    const pdf2 = new Blob(['%PDF-1.4 2'], { type: 'application/pdf' })

    const progressCalls: number[] = []
    const results = await saveMultiplePdfsAsArticles(
      [
        { file: pdf1, title: 'Doc 1', parentId: folder.id },
        { file: pdf2, title: 'Doc 2', parentId: folder.id },
      ],
      (cur, tot) => {
        progressCalls.push(cur)
        expect(tot).toBe(2)
      },
    )

    expect(results).toHaveLength(2)
    expect(progressCalls).toEqual([1, 2])

    const nodes = (await db.nodes.toArray()).filter((n) => n.parent_id === folder.id)
    expect(nodes).toHaveLength(2)
  })
})
