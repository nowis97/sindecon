import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from './db'
import { createNode, deleteNodeCascade } from './nodes'
import { saveArticle } from './articles'
import { buildExportZip, importFromZip, EXPORT_FORMAT_VERSION } from './exportImport'
import { listChildren } from './nodes'

async function clearDb() {
  await Promise.all([
    db.nodes.clear(),
    db.articles.clear(),
    db.assets.clear(),
    db.meta.clear(),
  ])
}

/** Árbol de prueba: Tema ▸ Cardio ▸ Arritmias ▸ FA + artículo raíz. */
async function seedTree() {
  const tema = await createNode({ kind: 'folder', title: 'Medicina Interna' })
  const cardio = await createNode({ kind: 'folder', title: 'Cardiología', parent_id: tema.id })
  const arr = await createNode({ kind: 'folder', title: 'Arritmias', parent_id: cardio.id })
  const fa = await createNode({ kind: 'article', title: 'Fibrilación auricular', parent_id: arr.id })
  await saveArticle(fa.id, '# FA\n\nArritmia **supraventricular**.\n\n| Fármaco | Dosis |\n| --- | --- |\n| Amiodarona | 150 mg |')
  const raiz = await createNode({ kind: 'article', title: 'Nota suelta' })
  await saveArticle(raiz.id, 'Nota en la raíz.')
  return { tema, cardio, arr, fa, raiz }
}

beforeEach(clearDb)

describe('export/import portable', () => {
  it('round-trip completo: export → limpiar → import reconstruye el árbol', async () => {
    const { fa, raiz } = await seedTree()
    const zip = await buildExportZip()
    const buf = await zip.generateAsync({ type: 'nodebuffer' })

    // El zip es legible sin la app
    expect(Object.keys(zip.files)).toContain('Medicina Interna/Cardiología/Arritmias/Fibrilación auricular.md')
    expect(Object.keys(zip.files)).toContain('Nota suelta.md')
    const md = await zip.file('Medicina Interna/Cardiología/Arritmias/Fibrilación auricular.md')!.async('string')
    expect(md).toContain('---')
    expect(md).toContain('id: ' + fa.id)
    expect(md).toContain('# FA')

    const manifest = JSON.parse(await zip.file('_manifest.json')!.async('string'))
    expect(manifest.export_format_version).toBe(EXPORT_FORMAT_VERSION)

    await clearDb()
    const report = await importFromZip(buf)
    expect(report.nodesAdded).toBe(5) // 3 carpetas + 2 artículos
    expect(report.articlesAdded).toBe(2)

    // Estructura idéntica
    const roots = await listChildren(null)
    expect(roots.map((r) => r.title).sort()).toEqual(['Medicina Interna', 'Nota suelta'])
    const faImported = (await db.nodes.get(fa.id))!
    expect(faImported.title).toBe('Fibrilación auricular')
    expect((await db.articles.get(fa.id))?.body_md).toContain('Amiodarona')
    expect((await db.articles.get(raiz.id))?.body_md).toBe('Nota en la raíz.')
  })

  it('re-import no duplica nada', async () => {
    await seedTree()
    const buf = await (await buildExportZip()).generateAsync({ type: 'nodebuffer' })
    const report = await importFromZip(buf)
    expect(report.nodesAdded).toBe(0)
    expect(report.nodesSkipped + report.nodesUpdated).toBeGreaterThanOrEqual(5)
    expect((await db.nodes.filter((n) => n.deleted_at === null).toArray()).length).toBe(5)
  })

  it('edición local más reciente sobrevive al import', async () => {
    const { fa } = await seedTree()
    const buf = await (await buildExportZip()).generateAsync({ type: 'nodebuffer' })

    // Editamos localmente DESPUÉS del export
    await new Promise((r) => setTimeout(r, 5))
    await saveArticle(fa.id, '# FA editada después del export')

    await importFromZip(buf)
    expect((await db.articles.get(fa.id))?.body_md).toContain('editada después')
  })

  it('eliminación local más reciente NO es resucitada', async () => {
    const { fa } = await seedTree()
    const buf = await (await buildExportZip()).generateAsync({ type: 'nodebuffer' })

    await new Promise((r) => setTimeout(r, 5))
    await deleteNodeCascade(fa.id)

    await importFromZip(buf)
    expect((await db.nodes.get(fa.id))?.deleted_at).not.toBeNull()
  })

  it('tombstones del export propagan eliminaciones', async () => {
    const { fa } = await seedTree()
    // Export con todo vivo (lo que tendría el otro dispositivo)
    const aliveBuf = await (await buildExportZip()).generateAsync({ type: 'nodebuffer' })

    await new Promise((r) => setTimeout(r, 5))
    await deleteNodeCascade(fa.id)
    const deletedZip = await buildExportZip()
    const deleted = JSON.parse(await deletedZip.file('_deleted.json')!.async('string'))
    expect(deleted.map((d: { id: string }) => d.id)).toContain(fa.id)

    // Otro dispositivo: importa el estado vivo, luego recibe el export con tombstones
    await clearDb()
    await importFromZip(aliveBuf)
    expect((await db.nodes.get(fa.id))?.deleted_at).toBeNull()

    const report = await importFromZip(await deletedZip.generateAsync({ type: 'nodebuffer' }))
    expect(report.nodesDeleted).toBeGreaterThanOrEqual(1)
    expect((await db.nodes.get(fa.id))?.deleted_at).not.toBeNull()
  })

  it('valida el flujo bidireccional PC ↔ Móvil con capturas de Inbox sin pérdida de datos', async () => {
    // 1. Simulación Dispositivo Móvil: Captura notas en Inbox
    const mobileCapture = await createNode({
      kind: 'article',
      title: 'Foto ECG urgencias',
    })
    await saveArticle(mobileCapture.id, '![Foto](asset://mock-asset)\n\nRitmo sinusal con extrasístoles.')
    
    const mobileZip = await buildExportZip()
    const mobileBuf = await mobileZip.generateAsync({ type: 'nodebuffer' })

    // 2. Simulación Dispositivo PC: Crea categorías y temas
    await clearDb()
    const { tema, fa } = await seedTree()
    expect(await listChildren(null)).toHaveLength(2)

    // 3. PC importa el export del móvil
    const reportPC = await importFromZip(mobileBuf)
    expect(reportPC.nodesAdded).toBe(1)
    expect(reportPC.articlesAdded).toBe(1)

    // Verificamos que en PC existen tanto las capturas del móvil como los datos elaborados de PC
    const importedCapture = await db.nodes.get(mobileCapture.id)
    expect(importedCapture?.title).toBe('Foto ECG urgencias')
    expect((await db.nodes.get(fa.id))?.title).toBe('Fibrilación auricular')
    expect((await db.nodes.get(tema.id))?.title).toBe('Medicina Interna')

    // 4. PC edita un artículo y exporta hacia el móvil
    await new Promise((r) => setTimeout(r, 10))
    await saveArticle(fa.id, '# FA actualizada en PC con dosis definitivas')
    const pcZip = await buildExportZip()
    const pcBuf = await pcZip.generateAsync({ type: 'nodebuffer' })

    // 5. Móvil recibe export de PC: Debe actualizar FA y mantener su captura local
    await clearDb()
    // Restaurar estado inicial del móvil
    await db.nodes.add(mobileCapture)
    await db.articles.add({
      node_id: mobileCapture.id,
      body_md: '![Foto](asset://mock-asset)\n\nRitmo sinusal con extrasístoles.',
      tags: ['captura'],
    })

    const reportMobile = await importFromZip(pcBuf)
    expect(reportMobile.nodesAdded).toBeGreaterThanOrEqual(4) // Categorías y artículos de PC
    expect(reportMobile.nodesSkipped + reportMobile.nodesUpdated).toBeGreaterThanOrEqual(1)

    const mobileFA = await db.articles.get(fa.id)
    expect(mobileFA?.body_md).toContain('actualizada en PC con dosis definitivas')
    const mobileCapt = await db.nodes.get(mobileCapture.id)
    expect(mobileCapt?.title).toBe('Foto ECG urgencias')
  })

  it('reporte de importación refleja con precisión nodos añadidos, actualizados, eliminados y omitidos', async () => {
    const { fa } = await seedTree()
    const buf1 = await (await buildExportZip()).generateAsync({ type: 'nodebuffer' })

    // Reimport idéntico: 0 añadidos, todos omitidos
    const report1 = await importFromZip(buf1)
    expect(report1.nodesAdded).toBe(0)
    expect(report1.articlesAdded).toBe(0)
    expect(report1.nodesSkipped).toBe(5)

    // Modificamos fecha remota para forzar actualización
    await new Promise((r) => setTimeout(r, 10))
    await saveArticle(fa.id, '# FA versión 2')
    const buf2 = await (await buildExportZip()).generateAsync({ type: 'nodebuffer' })

    // Volvemos la versión local a la anterior
    await db.nodes.update(fa.id, { updated_at: 1000 })
    const report2 = await importFromZip(buf2)
    expect(report2.nodesUpdated).toBe(1)
  })

  it('rechaza formatos con versión desconocida', async () => {
    await seedTree()
    const zip = await buildExportZip()
    zip.file('_manifest.json', JSON.stringify({ export_format_version: 999 }))
    const buf = await zip.generateAsync({ type: 'nodebuffer' })
    await expect(importFromZip(buf)).rejects.toThrow(/999/)
  })

  it('rechaza archivos que no son un export', async () => {
    await expect(importFromZip(new Uint8Array([1, 2, 3]))).rejects.toThrow()
  })
})

