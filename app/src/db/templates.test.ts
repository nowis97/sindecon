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

  it('crear artículo desde plantilla reemplaza {título} y queda independiente', async () => {
    await seedTemplatesIfNeeded()
    const tpls = await listTemplates()
    const patologia = tpls[0]
    const title = 'Hipertensión arterial'
    const body = fillTitlePlaceholder(patologia.body, title)
    expect(body).toContain('# ' + title)
    expect(body).not.toContain('{título}')
  })
})