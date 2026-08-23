import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from './db'
import {
  buildTemplateBody,
  fillTitlePlaceholder,
  seedTemplatesIfNeeded,
  listTemplates,
} from './templates'

beforeEach(async () => {
  await Promise.all([
    db.nodes.clear(),
    db.articles.clear(),
    db.assets.clear(),
    db.meta.clear(),
  ])
})

describe('plantillas (spec templates)', () => {
  it('buildTemplateBody produce encabezados del PDF', () => {
    const body = buildTemplateBody({
      title: 'Demo',
      sections: [
        { title: 'A' },
        { title: 'B', kind: 'list' },
        { title: 'C', kind: 'table', tableHeaders: ['X', 'Y'] },
        { title: 'D', kind: 'algorithm' },
      ],
    })
    expect(body).toContain('# {título}')
    expect(body).toContain('## A')
    expect(body).toContain('## B')
    expect(body).toContain('## C')
    expect(body).toContain('## D')
    expect(body).toContain('```mermaid')
    expect(body).toContain('| X | Y |')
  })

  it('fillTitlePlaceholder sustituye {título}', () => {
    expect(fillTitlePlaceholder('# {título}\nTexto', 'FA')).toBe('# FA\nTexto')
  })

  it('seedTemplatesIfNeeded siembra 10 plantillas en primer arranque', async () => {
    const seeded = await seedTemplatesIfNeeded()
    expect(seeded).toBe(true)
    const tpls = await listTemplates()
    expect(tpls.length).toBe(10)
    expect(tpls[0].node.title).toBe('Patología / Enfermedad')
    expect(tpls[9].node.title).toBe('Fármaco / Ficha farmacológica')
    expect(tpls[0].body).toContain('## Definición')
    expect(tpls[0].body).toContain('{título}')
  })

  it('no re-siembra si el marcador existe (idempotente)', async () => {
    await seedTemplatesIfNeeded()
    // Editamos una plantilla para detectar si se reescribe en la 2ª llamada
    const tpls = await listTemplates()
    await db.articles.update(tpls[0].node.id, { body_md: 'EDITADO' })

    const seededAgain = await seedTemplatesIfNeeded()
    expect(seededAgain).toBe(false)
    const tpls2 = await listTemplates()
    expect(tpls2[0].body).toBe('EDITADO')
    expect(tpls2.length).toBe(10)
  })

  it('createNode de artículo ya viene con fila de cuerpo (useArticle no devuelve null)', async () => {
    const { createNode } = await import('./nodes')
    const n = await createNode({ kind: 'article', title: 'Prueba' })
    const row = await db.articles.get(n.id)
    expect(row).toBeDefined()
    expect(row?.body_md).toBe('')
  })

  it('flujo completo: seed → crear desde plantilla → cuerpo en la DB', async () => {
    const { createNode } = await import('./nodes')
    const { saveArticle } = await import('./articles')
    await seedTemplatesIfNeeded()
    const tpls = await listTemplates()
    const farma = tpls.find((t) => t.node.title === 'Fármaco / Ficha farmacológica')!
    expect(farma).toBeDefined()
    const title = 'Amiodarona'
    const body = fillTitlePlaceholder(farma.body, title)
    const node = await createNode({ kind: 'article', title })
    await saveArticle(node.id, body)
    const saved = await db.articles.get(node.id)
    expect(saved?.body_md).toBe(body)
    expect(saved?.body_md).toContain('# ' + title)
    expect(saved?.body_md).toContain('## Mecanismo de acción')
    expect(saved?.body_md).toContain('## Dosis en adultos y vía de administración')
  })

  it('cada plantilla produce un body DISTINTO en el flujo "crear desde plantilla"', async () => {
    const { createNode } = await import('./nodes')
    const { saveArticle } = await import('./articles')
    await seedTemplatesIfNeeded()
    const tpls = await listTemplates()
    const created: { title: string; body: string }[] = []
    for (const tpl of tpls) {
      const title = `Caso · ${tpl.node.title}`
      const node = await createNode({ kind: 'article', title })
      const body = fillTitlePlaceholder(tpl.body, title)
      await saveArticle(node.id, body)
      const saved = await db.articles.get(node.id)
      created.push({ title, body: saved?.body_md ?? '' })
    }
    // Todos los bodies deben ser distintos entre sí
    const unique = new Set(created.map((c) => c.body))
    expect(unique.size).toBe(created.length)
    // Cada body debe contener el nombre de su plantilla (placeholder sustituido)
    for (const { title, body } of created) {
      expect(body).toContain(`# Caso · ${title.replace('Caso · ', '')}`)
      expect(body).not.toContain('{título}')
    }
  })
})