import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { NodeRow, ArticleRow } from '../db/db'
import { listTemplates } from '../db/templates'

/** Todos los nodos vivos, reactivos: cualquier cambio re-renderiza. */
export function useAllNodes(): NodeRow[] {
  return (
    useLiveQuery(
      () => db.nodes.filter((n) => n.deleted_at === null).toArray(),
      [],
      [] as NodeRow[],
    ) ?? []
  )
}

/**
 * Artículo por nodeId.
 * undefined = cargando · null = aún no existe · row = cargado.
 */
export function useArticle(nodeId: string | null): ArticleRow | null | undefined {
  return useLiveQuery(
    () => (nodeId ? db.articles.get(nodeId).then((r) => r ?? null) : null),
    [nodeId],
    undefined,
  )
}

/** true/false = resultado registrado · undefined = aún sin registrar. */
export function useStoragePersisted(): boolean | undefined {
  return useLiveQuery(
    async () => (await db.meta.get('storage_persist'))?.value as
      | boolean
      | undefined,
    [],
  )
}

/** Plantillas disponibles en la carpeta Plantillas/. */
export function useTemplates(): {
  node: import('../db/db').NodeRow
  body: string
}[] {
  return (
    useLiveQuery(() => listTemplates(), [], [] as {
      node: import('../db/db').NodeRow
      body: string
    }[]) ?? []
  )
}
