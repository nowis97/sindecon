import { db, type NodeRow, type NodeKind, type SystemMarker } from './db'
import { canMove, collectDescendantIds } from '../domain/tree'

export function newId(): string {
  return crypto.randomUUID()
}

export interface CreateNodeInput {
  id?: string
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
    id: input.id ?? newId(),
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

/**
 * Detecta y consolida/elimina carpetas o artículos duplicados de sistema
 * (ej. múltiples carpetas "Inbox" o "Plantillas" provocadas por sincronizaciones anteriores).
 */
export async function deduplicateSystemNodes(): Promise<{
  inboxFixed: number
  templatesFixed: number
}> {
  let inboxFixed = 0
  let templatesFixed = 0
  const now = Date.now()

  await db.transaction('rw', [db.nodes, db.articles], async () => {
    const allNodes = await db.nodes.toArray()
    const liveNodes = allNodes.filter((n) => n.deleted_at === null)

    // 1. Deduplicar carpetas Inbox
    const inboxFolders = liveNodes.filter(
      (n) =>
        n.kind === 'folder' &&
        (n.system === 'inbox' || (n.title === 'Inbox' && n.parent_id === null)),
    )

    if (inboxFolders.length > 1) {
      const canonical =
        inboxFolders.find((n) => n.id === 'sys-folder-inbox') ??
        inboxFolders.sort((a, b) => a.created_at - b.created_at)[0]

      for (const dup of inboxFolders) {
        if (dup.id === canonical.id) continue
        const children = liveNodes.filter((n) => n.parent_id === dup.id)
        for (const child of children) {
          await db.nodes.update(child.id, { parent_id: canonical.id, updated_at: now })
        }
        await db.nodes.update(dup.id, { deleted_at: now, updated_at: now })
        inboxFixed++
      }
    }

    // 2. Deduplicar carpetas Plantillas
    const templateFolders = liveNodes.filter(
      (n) =>
        n.kind === 'folder' &&
        (n.system === 'templates' || (n.title === 'Plantillas' && n.parent_id === null)),
    )

    if (templateFolders.length > 1) {
      const canonical =
        templateFolders.find((n) => n.id === 'sys-folder-templates') ??
        templateFolders.sort((a, b) => a.created_at - b.created_at)[0]

      for (const dup of templateFolders) {
        if (dup.id === canonical.id) continue
        const children = liveNodes.filter((n) => n.parent_id === dup.id)
        for (const child of children) {
          await db.nodes.update(child.id, { parent_id: canonical.id, updated_at: now })
        }
        await db.nodes.update(dup.id, { deleted_at: now, updated_at: now })
        templatesFixed++
      }
    }

    // 3. Deduplicar artículos de plantilla repetidos por título
    const currentNodes = await db.nodes.toArray()
    const activeTemplateFolders = currentNodes.filter(
      (n) =>
        n.kind === 'folder' &&
        n.deleted_at === null &&
        (n.system === 'templates' || (n.title === 'Plantillas' && n.parent_id === null)),
    )
    for (const folder of activeTemplateFolders) {
      const folderArticles = currentNodes.filter(
        (n) => n.parent_id === folder.id && n.kind === 'article' && n.deleted_at === null,
      )
      const seenTitles = new Map<string, NodeRow>()
      for (const art of folderArticles) {
        const prev = seenTitles.get(art.title)
        if (!prev) {
          seenTitles.set(art.title, art)
        } else {
          const keep = art.id.startsWith('sys-tpl-')
            ? art
            : prev.id.startsWith('sys-tpl-')
              ? prev
              : art.updated_at >= prev.updated_at
                ? art
                : prev
          const discard = keep.id === art.id ? prev : art
          await db.nodes.update(discard.id, { deleted_at: now, updated_at: now })
          seenTitles.set(art.title, keep)
          templatesFixed++
        }
      }
    }
  })

  return { inboxFixed, templatesFixed }
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
