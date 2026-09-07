import { db, type NodeRow, type ArticleRow } from './db'
import { newId } from './nodes'
import type { ParsedMarkdownArticle } from '../domain/bulkMarkdownImport'

export type CollisionStrategy = 'suffix' | 'skip' | 'overwrite'

export interface BulkImportOptions {
  parentId: string | null
  collisionStrategy?: CollisionStrategy
  onProgress?: (current: number, total: number) => void
  chunkSize?: number
}

export interface BulkImportResult {
  importedCount: number
  skippedCount: number
  updatedCount: number
  errors: Array<{ filename: string; error: string }>
}

/**
 * Importa masivamente una lista de artículos Markdown procesados en una carpeta específica.
 * Ejecuta inserciones transaccionales por lotes en Dexie para garantizar consistencia y rendimiento.
 */
export async function importBulkArticles(
  items: ParsedMarkdownArticle[],
  options: BulkImportOptions
): Promise<BulkImportResult> {
  const { parentId, collisionStrategy = 'suffix', onProgress, chunkSize = 50 } = options

  const result: BulkImportResult = {
    importedCount: 0,
    skippedCount: 0,
    updatedCount: 0,
    errors: [],
  }

  if (!items || items.length === 0) {
    onProgress?.(0, 0)
    return result
  }

  // Obtener hermanos existentes en la carpeta de destino
  const existingSiblings = await db.nodes
    .filter((n) => n.parent_id === parentId && n.deleted_at === null)
    .toArray()

  let currentOrder = existingSiblings.length
  // Mapa de títulos para resolución rápida de colisiones (clave en minúsculas -> nodo)
  const titleMap = new Map<string, NodeRow>()
  for (const sibling of existingSiblings) {
    titleMap.set(sibling.title.trim().toLowerCase(), sibling)
  }

  const total = items.length
  let processed = 0

  // Procesar en chunks para no bloquear el hilo principal ni la transacción
  for (let i = 0; i < total; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize)

    await db.transaction('rw', [db.nodes, db.articles], async () => {
      const nodesToAdd: NodeRow[] = []
      const articlesToAdd: ArticleRow[] = []

      for (const item of chunk) {
        try {
          const rawTitle = (item.title || item.originalFilename || 'Sin Título').trim()
          const lowerTitle = rawTitle.toLowerCase()
          const existing = titleMap.get(lowerTitle)

          if (existing) {
            if (collisionStrategy === 'skip') {
              result.skippedCount++
              processed++
              continue
            }

            if (collisionStrategy === 'overwrite') {
              const now = Date.now()
              await db.articles.put({
                node_id: existing.id,
                body_md: item.body,
                tags: item.tags,
              })
              await db.nodes.update(existing.id, {
                updated_at: now,
              })
              result.updatedCount++
              processed++
              continue
            }

            // Suffix: Generar un título único con sufijo (1), (2), etc.
            let counter = 1
            let candidateTitle = `${rawTitle} (${counter})`
            while (titleMap.has(candidateTitle.toLowerCase())) {
              counter++
              candidateTitle = `${rawTitle} (${counter})`
            }

            const now = Date.now()
            const id = newId()
            const node: NodeRow = {
              id,
              parent_id: parentId,
              kind: 'article',
              title: candidateTitle,
              order: currentOrder++,
              system: null,
              created_at: now,
              updated_at: now,
              deleted_at: null,
            }
            const article: ArticleRow = {
              node_id: id,
              body_md: item.body,
              tags: item.tags,
            }

            titleMap.set(candidateTitle.toLowerCase(), node)
            nodesToAdd.push(node)
            articlesToAdd.push(article)
            result.importedCount++
            processed++
            continue
          }

          // Sin colisión: insertar nuevo nodo y artículo
          const now = Date.now()
          const id = newId()
          const node: NodeRow = {
            id,
            parent_id: parentId,
            kind: 'article',
            title: rawTitle,
            order: currentOrder++,
            system: null,
            created_at: now,
            updated_at: now,
            deleted_at: null,
          }
          const article: ArticleRow = {
            node_id: id,
            body_md: item.body,
            tags: item.tags,
          }

          titleMap.set(lowerTitle, node)
          nodesToAdd.push(node)
          articlesToAdd.push(article)
          result.importedCount++
          processed++
        } catch (err) {
          result.errors.push({
            filename: item.originalFilename,
            error: err instanceof Error ? err.message : String(err),
          })
          processed++
        }
      }

      if (nodesToAdd.length > 0) {
        await db.nodes.bulkAdd(nodesToAdd)
      }
      if (articlesToAdd.length > 0) {
        await db.articles.bulkAdd(articlesToAdd)
      }
    })

    onProgress?.(processed, total)

    // Ceder brevemente al event loop si hay más chunks
    if (i + chunkSize < total) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }

  return result
}
