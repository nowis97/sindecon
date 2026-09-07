import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from './db'
import { createNode, listChildren } from './nodes'
import { importBulkArticles } from './bulkArticles'
import type { ParsedMarkdownArticle } from '../domain/bulkMarkdownImport'

beforeEach(async () => {
  await Promise.all([
    db.nodes.clear(),
    db.articles.clear(),
    db.assets.clear(),
    db.meta.clear(),
  ])
})

describe('capa de datos: bulkArticles', () => {
  it('importa lote de artículos en una carpeta con orden incremental y persistencia de tags', async () => {
    const folder = await createNode({ kind: 'folder', title: 'Cardiología' })

    const items: ParsedMarkdownArticle[] = [
      {
        title: 'Insuficiencia Cardíaca',
        tags: ['urgencias', 'cardiología'],
        body: '# Insuficiencia Cardíaca\nGuía de manejo con FEVI reducida.',
        originalFilename: 'ic.md',
      },
      {
        title: 'Fibrilación Auricular',
        tags: ['arritmias'],
        body: '# Fibrilación Auricular\nControl de ritmo vs frecuencia.',
        originalFilename: 'fa.md',
      },
    ]

    const onProgress = vi.fn()
    const result = await importBulkArticles(items, {
      parentId: folder.id,
      onProgress,
    })

    expect(result.importedCount).toBe(2)
    expect(result.skippedCount).toBe(0)
    expect(result.updatedCount).toBe(0)
    expect(onProgress).toHaveBeenCalledWith(2, 2)

    const children = await listChildren(folder.id)
    expect(children).toHaveLength(2)
    expect(children[0].title).toBe('Insuficiencia Cardíaca')
    expect(children[0].order).toBe(0)
    expect(children[1].title).toBe('Fibrilación Auricular')
    expect(children[1].order).toBe(1)

    const art1 = await db.articles.get(children[0].id)
    expect(art1?.body_md).toContain('Guía de manejo con FEVI reducida.')
    expect(art1?.tags).toEqual(['urgencias', 'cardiología'])
  })

  it('resuelve colisiones con estrategia suffix agregando (1)', async () => {
    const folder = await createNode({ kind: 'folder', title: 'Urgencias' })
    await createNode({ kind: 'article', title: 'Shock Séptico', parent_id: folder.id })

    const items: ParsedMarkdownArticle[] = [
      {
        title: 'Shock Séptico',
        tags: ['infectología'],
        body: 'Nueva versión de shock séptico.',
        originalFilename: 'shock.md',
      },
    ]

    const result = await importBulkArticles(items, {
      parentId: folder.id,
      collisionStrategy: 'suffix',
    })

    expect(result.importedCount).toBe(1)
    const children = await listChildren(folder.id)
    expect(children).toHaveLength(2)
    expect(children.map((c) => c.title)).toContain('Shock Séptico (1)')
  })

  it('resuelve colisiones con estrategia skip omitiendo el artículo', async () => {
    const folder = await createNode({ kind: 'folder', title: 'Pediatría' })
    await createNode({ kind: 'article', title: 'Bronquiolitis', parent_id: folder.id })

    const items: ParsedMarkdownArticle[] = [
      {
        title: 'Bronquiolitis',
        tags: ['respiratorio'],
        body: 'Manejo en lactantes.',
        originalFilename: 'bronquiolitis.md',
      },
    ]

    const result = await importBulkArticles(items, {
      parentId: folder.id,
      collisionStrategy: 'skip',
    })

    expect(result.importedCount).toBe(0)
    expect(result.skippedCount).toBe(1)
    const children = await listChildren(folder.id)
    expect(children).toHaveLength(1)
  })

  it('resuelve colisiones con estrategia overwrite actualizando el contenido', async () => {
    const folder = await createNode({ kind: 'folder', title: 'Neurología' })
    const node = await createNode({ kind: 'article', title: 'ACV Isquémico', parent_id: folder.id })
    await db.articles.put({ node_id: node.id, body_md: 'Contenido viejo', tags: [] })

    const items: ParsedMarkdownArticle[] = [
      {
        title: 'ACV Isquémico',
        tags: ['trombolisis'],
        body: 'Contenido nuevo y actualizado con ventana de 4.5h.',
        originalFilename: 'acv.md',
      },
    ]

    const result = await importBulkArticles(items, {
      parentId: folder.id,
      collisionStrategy: 'overwrite',
    })

    expect(result.importedCount).toBe(0)
    expect(result.updatedCount).toBe(1)

    const updatedArt = await db.articles.get(node.id)
    expect(updatedArt?.body_md).toBe('Contenido nuevo y actualizado con ventana de 4.5h.')
    expect(updatedArt?.tags).toEqual(['trombolisis'])
  })
})
