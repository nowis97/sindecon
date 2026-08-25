import type { NodeRow } from '../db/db'

// Lógica pura del árbol: opera sobre arrays en memoria.
// Sin DOM, sin Dexie → tests rápidos en node.

/** Ids de todos los descendientes de un nodo (sin incluirlo). */
export function collectDescendantIds(rows: NodeRow[], rootId: string): string[] {
  const byParent = new Map<string | null, NodeRow[]>()
  for (const row of rows) {
    const list = byParent.get(row.parent_id) ?? []
    list.push(row)
    byParent.set(row.parent_id, list)
  }
  const result: string[] = []
  const stack = [...(byParent.get(rootId) ?? [])]
  while (stack.length > 0) {
    const node = stack.pop()!
    result.push(node.id)
    stack.push(...(byParent.get(node.id) ?? []))
  }
  return result
}

/** ¿es `maybeDescendantId` descendiente de `ancestorId`? */
export function isDescendant(
  rows: NodeRow[],
  ancestorId: string,
  maybeDescendantId: string,
): boolean {
  return collectDescendantIds(rows, ancestorId).includes(maybeDescendantId)
}

/**
 * Un movimiento es válido si:
 * 1. No es un elemento protegido del sistema 'templates' (carpeta de plantillas o plantillas maestras).
 * 2. El destino no es 'templates' ni descendiente de 'templates'.
 * 3. El destino no es el propio nodo, ni uno de sus descendientes (evita ciclos).
 */
export function canMove(
  rows: NodeRow[],
  id: string,
  newParentId: string | null,
): boolean {
  const byId = new Map(rows.map((r) => [r.id, r]))
  const sourceNode = byId.get(id)

  // No permitir mover plantillas ni la carpeta del sistema 'templates'
  if (sourceNode?.system === 'templates') return false

  if (newParentId === null) return true
  if (newParentId === id) return false

  const targetNode = byId.get(newParentId)
  // No permitir mover elementos hacia la carpeta 'templates' ni dentro de sus subcarpetas
  if (targetNode?.system === 'templates') return false

  let currentParentId = targetNode?.parent_id
  while (currentParentId) {
    const ancestor = byId.get(currentParentId)
    if (ancestor?.system === 'templates') return false
    currentParentId = ancestor?.parent_id
  }

  return !isDescendant(rows, id, newParentId)
}

/** Ruta desde la raíz hasta el nodo (para breadcrumbs). Raíz primero. */
export function pathTo(rows: NodeRow[], id: string): NodeRow[] {
  const byId = new Map(rows.map((r) => [r.id, r]))
  const path: NodeRow[] = []
  let current = byId.get(id)
  while (current) {
    path.unshift(current)
    current = current.parent_id ? byId.get(current.parent_id) : undefined
  }
  return path
}

/** Hijos vivos de un padre, ordenados por `order`. */
export function childrenOf(rows: NodeRow[], parentId: string | null): NodeRow[] {
  return rows
    .filter((n) => n.parent_id === parentId && n.deleted_at === null)
    .sort((a, b) => a.order - b.order)
}
