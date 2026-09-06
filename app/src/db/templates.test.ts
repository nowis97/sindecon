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
        { title: 'E', defaultContent: ['line 1', 'line 2'] },
      ],
    })
    expect(body).toContain('# {título}')
    expect(body).toContain('## A')
    expect(body).toContain('## B')
    expect(body).toContain('## C')
    expect(body).toContain('## D')
    expect(body).toContain('## E')
    expect(body).toContain('line 1\nline 2')
    expect(body).toContain('```mermaid')
    expect(body).toContain('| X | Y |')
  })

  it('fillTitlePlaceholder sustituye {título}', () => {
    expect(fillTitlePlaceholder('# {título}\nTexto', 'FA')).toBe('# FA\nTexto')
  })

  it('seedTemplatesIfNeeded siembra 12 plantillas en primer arranque (v2.1)', async () => {
    const seeded = await seedTemplatesIfNeeded()
    expect(seeded).toBe(true)
    const tpls = await listTemplates()
    expect(tpls.length).toBe(12)
    expect(tpls[0].node.title).toBe('Patología / Enfermedad')
    expect(tpls[1].node.title).toBe('Síndrome clínico / Diagnóstico sindromático')
    expect(tpls[10].node.title).toBe('Fármaco / Posología y administración clínica')
    expect(tpls[11].node.title).toBe('Patología oncológica / Cáncer')
    expect(tpls[0].body).toContain('## Definición')
    expect(tpls[10].body).toContain('## Posología')
    expect(tpls[10].body).toContain('| Contexto | Dosis | Frecuencia | Vía | Máximo diario | Acotaciones |')
    expect(tpls[10].body).toContain('## Preparación y ajuste')
    expect(tpls[10].body).toContain('Ajuste en IRA')
    expect(tpls[10].body).toContain('Ajuste en DHC')
    expect(tpls[10].body).toContain('NO mezclar con')
    expect(tpls[10].body).toContain('Marcas comerciales en Chile')
    expect(tpls[10].body).toContain('Contraindicaciones')
    expect(tpls[10].body).toContain('Fuentes')
    expect(tpls[11].body).toContain('## Estadificación / TNM')
    expect(tpls[11].body).toContain('## Tratamiento según estadio')
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
    expect(tpls2.length).toBe(12)
  })

  it('plantilla Fármaco / Posología y administración clínica reproduce el formato clínico manuscrito', async () => {
    await seedTemplatesIfNeeded()
    const tpls = await listTemplates()
    const tpl = tpls.find(
      (t) => t.node.title === 'Fármaco / Posología y administración clínica',
    )!
    expect(tpl).toBeDefined()
    const body = fillTitlePlaceholder(tpl.body, 'Ceftriaxona')
    expect(body).toContain('# Ceftriaxona')
    expect(body).not.toContain('## Qué es, grupo farmacológico y datos generales')
    expect(body).toContain('## Indicaciones')
    expect(body).toContain('1. \n2. \n3. \n4. \n5. \n6. \n7. \n8. \n9. ')
    expect(body).toContain(
      '> **Nota:** Qué es, grupo farmacológico y datos generales sobre el fármaco.',
    )
    expect(body).toContain('## Posología')
    expect(body).toContain(
      '| Contexto | Dosis | Frecuencia | Vía | Máximo diario | Acotaciones |',
    )
    expect(body).toContain('|   |   |   |   |   |   |')
    expect(body).toContain('## Preparación y ajuste')
    expect(body).toContain('- **Dilución:** En qué solución y en cuánto volumen.')
    expect(body).toContain(
      '- **Tiempo de administración:** En cuánto tiempo pasar (velocidad de infusión).',
    )
    expect(body).toContain('- **Ajuste en IRA:**')
    expect(body).toContain('- **Ajuste en DHC:**')
    expect(body).toContain('- **NO mezclar con:**')
    expect(body).toContain('## RAM relevantes')
    expect(body).toContain('## Marcas comerciales en Chile')
    expect(body).toContain('## Contraindicaciones')
    expect(body).toContain('## Fuentes')
    expect(body).not.toContain('### Guías clínicas y consensos')
    expect(body).toContain('## Fuentes\n\n1. \n2. \n3. \n4. \n5. ')
  })

  it('createNode de artículo NO crea fila de cuerpo (la fila es lazy para evitar la carrera con saveArticle)', async () => {
    const { createNode } = await import('./nodes')
    const n = await createNode({ kind: 'article', title: 'Prueba' })
    const row = await db.articles.get(n.id)
    expect(row).toBeUndefined()
  })

  it('saveArticle upserta la fila de cuerpo (puede crearla aunque no exista)', async () => {
    const { createNode } = await import('./nodes')
    const { saveArticle } = await import('./articles')
    const n = await createNode({ kind: 'article', title: 'Prueba' })
    await saveArticle(n.id, '# Contenido')
    const row = await db.articles.get(n.id)
    expect(row?.body_md).toBe('# Contenido')
    expect(row?.tags).toEqual([])
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