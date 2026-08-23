import { db, type NodeRow, type NodeKind, type SystemMarker } from './db'
import { canMove, collectDescendantIds } from '../domain/tree'

export function newId(): string {
  return crypto.randomUUID()
}

export interface CreateNodeInput {
  kind: NodeKind
  title: string
  parent_id?: string | null
  system?: SystemMarker
}

/** Crea un nodo al final de sus hermanos, con uuid y timestamps. */
export async function createNode(input: CreateNodeInput): Promise<NodeRow> {
  const parentId = input.parent_id ?? null
  const siblings = await db.nodes
    .filter((n) => n.parent_id === parentId && n.deleted_at === null)
    .toArray()
  const order = siblings.length
  const now = Date.now()
  const node: NodeRow = {
    id: newId(),
    parent_id: parentId,
    kind: input.kind,
    title: input.title,
    order,
    system: input.system ?? null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  }
  await db.nodes.add(node)
  // Antes creábamos una fila vacía de db.articles aquí, pero eso abría
  // una carrera: useArticle devolvía la fila vacía entre createNode y
  // saveArticle(templateBody), el editor montaba con '' y sobreescribía
  // el contenido recién sembrado. La fila se crea de forma lazy en
  // saveArticle.
  return node
}

/** Lista hijos vivos de un padre, ordenados. parentId null = raíces (Temas). */
export async function listChildren(parentId: string | null): Promise<NodeRow[]> {
  const rows = await db.nodes
    .filter((n) => n.parent_id === parentId && n.deleted_at === null)
    .toArray()
  return rows.sort((a, b) => a.order - b.order)
}

export async function renameNode(id: string, title: string): Promise<void> {
  await db.nodes.update(id, { title, updated_at: Date.now() })
}

/**
 * Mueve un nodo (con su descendencia) bajo otro padre.
 * Rechaza ciclos: no se puede mover algo dentro de sí mismo.
 */
export async function moveNode(id: string, newParentId: string | null): Promise<void> {
  const all = await db.nodes.filter((n) => n.deleted_at === null).toArray()
  if (!canMove(all, id, newParentId)) {
    throw new Error('Movimiento inválido: el destino es el propio nodo o su descendiente')
  }
  const siblings = all.filter((n) => n.parent_id === newParentId)
  await db.nodes.update(id, {
    parent_id: newParentId,
    order: siblings.length,
    updated_at: Date.now(),
  })
}

/**
 * Elimina un nodo y TODA su descendencia en cascada (tombstones).
 * Los tombstones permiten que la fusión propague la eliminación.
 */
export async function deleteNodeCascade(id: string): Promise<number> {
  const all = await db.nodes.toArray()
  const ids = [id, ...collectDescendantIds(all, id)]
  const now = Date.now()
  await db.transaction('rw', db.nodes, async () => {
    for (const nid of ids) {
      await db.nodes.update(nid, { deleted_at: now, updated_at: now })
    }
  })
  return ids.length
}
