import { db, type ArticleRow } from './db'

/**
 * Upsert del cuerpo Markdown (put para tolerar el row vacío que crea
 * createNode); toca updated_at del nodo (fusión futura) y mantiene
 * la propiedad asset → artículo.
 */
export async function saveArticle(
  nodeId: string,
  body_md: string,
  tags?: string[],
): Promise<ArticleRow> {
  const existing = await db.articles.get(nodeId)
  const finalTags = tags !== undefined ? tags : (existing?.tags ?? [])
  const row: ArticleRow = {
    node_id: nodeId,
    body_md,
    tags: finalTags,
  }
  await db.articles.put(row)
  await db.nodes.update(nodeId, { updated_at: Date.now() })

  const ids = [...body_md.matchAll(/asset:\/\/([a-f0-9-]+)/gi)].map((m) => m[1])
  const unique = [...new Set(ids)]
  await Promise.all(
    unique.map(async (id) => {
      const a = await db.assets.get(id)
      if (a && a.node_id !== nodeId) await db.assets.update(id, { node_id: nodeId })
    }),
  )
  return row
}