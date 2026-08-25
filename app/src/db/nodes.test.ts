import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from './db'
import {
  createNode,
  listChildren,
  renameNode,
  moveNode,
  deleteNodeCascade,
  deduplicateSystemNodes,
} from './nodes'

beforeEach(async () => {
  await Promise.all([
    db.nodes.clear(),
    db.articles.clear(),
    db.assets.clear(),
    db.meta.clear(),
  ])
})

describe('capa de datos: nodos', () => {
  it('createNode asigna uuid, timestamps y deleted_at null', async () => {
    const n = await createNode({ kind: 'folder', title: 'Medicina Interna' })
    expect(n.id).toBeTruthy()
    expect(n.created_at).toBeGreaterThan(0)
    expect(n.updated_at).toBe(n.created_at)
    expect(n.deleted_at).toBeNull()
    expect(n.parent_id).toBeNull()
    expect(n.system).toBeNull()
  })

  it('los hermanos reciben order incremental (raíces y anidados)', async () => {
    const a = await createNode({ kind: 'folder', title: 'A' })
    const b = await createNode({ kind: 'folder', title: 'B' })
    const hijo = await createNode({ kind: 'article', title: 'H', parent_id: a.id })
    expect(a.order).toBe(0)
    expect(b.order).toBe(1)
    expect(hijo.order).toBe(0) // primer hijo de A
  })

  it('listChildren devuelve solo hijos vivos del padre, ordenados', async () => {
    const padre = await createNode({ kind: 'folder', title: 'Cardio' })
    await createNode({ kind: 'article', title: 'FA', parent_id: padre.id })
    await createNode({ kind: 'article', title: 'IAM', parent_id: padre.id })
    await createNode({ kind: 'folder', title: 'Otro tema' }) // raíz, no hijo

    const hijos = await listChildren(padre.id)
    expect(hijos.map((h) => h.title)).toEqual(['FA', 'IAM'])

    const raices = await listChildren(null)
    expect(raices.map((r) => r.title)).toEqual(['Cardio', 'Otro tema'])
  })

  it('renameNode actualiza título y updated_at', async () => {
    const n = await createNode({ kind: 'folder', title: 'Viejo' })
    await renameNode(n.id, 'Nuevo')
    const actualizado = await db.nodes.get(n.id)
    expect(actualizado?.title).toBe('Nuevo')
    expect(actualizado!.updated_at).toBeGreaterThanOrEqual(n.updated_at)
  })

  it('moveNode reubica con su descendencia y rechaza ciclos', async () => {
    const a = await createNode({ kind: 'folder', title: 'A' })
    const b = await createNode({ kind: 'folder', title: 'B', parent_id: a.id })
    await createNode({ kind: 'article', title: 'Hijo', parent_id: b.id })
    const otro = await createNode({ kind: 'folder', title: 'Otro' })

    await moveNode(b.id, otro.id)
    expect((await db.nodes.get(b.id))?.parent_id).toBe(otro.id)
    expect(await listChildren(otro.id)).toHaveLength(1)

    // ciclo: no se puede mover "otro" dentro de su propio hijo b
    await expect(moveNode(otro.id, b.id)).rejects.toThrow()
  })

  it('deleteNodeCascade marca tombstones en toda la rama', async () => {
    const a = await createNode({ kind: 'folder', title: 'A' })
    const b = await createNode({ kind: 'folder', title: 'B', parent_id: a.id })
    const hoja = await createNode({ kind: 'article', title: 'H', parent_id: b.id })

    const eliminados = await deleteNodeCascade(a.id)
    expect(eliminados).toBe(3)
    expect(await listChildren(null)).toEqual([])
    // los tres tienen tombstone
    for (const id of [a.id, b.id, hoja.id]) {
      expect((await db.nodes.get(id))?.deleted_at).not.toBeNull()
    }
  })

  it('deduplicateSystemNodes consolida múltiples carpetas Inbox y Plantillas', async () => {
    // Simular estado con duplicados
    const inbox1 = await createNode({
      id: 'sys-folder-inbox',
      kind: 'folder',
      title: 'Inbox',
      system: 'inbox',
    })
    const inbox2 = await createNode({
      id: 'legacy-inbox-random-uuid',
      kind: 'folder',
      title: 'Inbox',
      system: 'inbox',
    })
    // Artículo en el inbox duplicado
    const note = await createNode({
      kind: 'article',
      title: 'Nota en inbox 2',
      parent_id: inbox2.id,
    })

    // Carpetas plantillas duplicadas
    const tpl1 = await createNode({
      id: 'sys-folder-templates',
      kind: 'folder',
      title: 'Plantillas',
      system: 'templates',
    })
    const tpl2 = await createNode({
      id: 'legacy-tpl-random-uuid',
      kind: 'folder',
      title: 'Plantillas',
      system: 'templates',
    })
    const tplArt1 = await createNode({
      kind: 'article',
      title: 'Patología / Enfermedad',
      system: 'templates',
      parent_id: tpl1.id,
    })
    const tplArt2 = await createNode({
      kind: 'article',
      title: 'Patología / Enfermedad',
      system: 'templates',
      parent_id: tpl2.id,
    })

    const result = await deduplicateSystemNodes()
    expect(result.inboxFixed).toBe(1)
    expect(result.templatesFixed).toBeGreaterThanOrEqual(1)

    // Solo 1 carpeta Inbox viva
    const liveInboxes = (await db.nodes.toArray()).filter(
      (n) => n.kind === 'folder' && n.title === 'Inbox' && n.deleted_at === null,
    )
    expect(liveInboxes).toHaveLength(1)
    expect(liveInboxes[0].id).toBe(inbox1.id)

    // La nota fue reasignada al inbox canónico
    const noteUpdated = await db.nodes.get(note.id)
    expect(noteUpdated?.parent_id).toBe(inbox1.id)

    // Solo 1 carpeta Plantillas viva
    const liveTpls = (await db.nodes.toArray()).filter(
      (n) => n.kind === 'folder' && n.title === 'Plantillas' && n.deleted_at === null,
    )
    expect(liveTpls).toHaveLength(1)
    expect(liveTpls[0].id).toBe(tpl1.id)

    // Solo 1 plantilla de Patología viva
    const livePatologia = (await db.nodes.toArray()).filter(
      (n) => n.kind === 'article' && n.title === 'Patología / Enfermedad' && n.deleted_at === null,
    )
    expect(livePatologia).toHaveLength(1)
  })
})
