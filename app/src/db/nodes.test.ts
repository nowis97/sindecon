import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from './db'
import { createNode, listChildren, renameNode, moveNode, deleteNodeCascade } from './nodes'

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
})
