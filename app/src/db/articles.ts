import { db, type ArticleRow } from './db'

export async function getArticle(nodeId: string): Promise<ArticleRow | undefined> {
  return db.articles.get(nodeId)
}

/**
 * Upsert del cuerpo Markdown; toca updated_at del nodo (fusión futura)
 * y mantiene la propiedad asset → artículo (los asset:// referenciados
 * quedan atados al artículo dueño para que el export los encuentre).
 */
export async function saveArticle(nodeId: string, body_md: string): Promise<void> {
  const existing = await db.articles.get(nodeId)
  if (existing) {
    await db.articles.update(nodeId, { body_md })
  } else {
    await db.articles.add({ node_id: nodeId, body_md, tags: [] })
  }
  await db.nodes.update(nodeId, { updated_at: Date.now() })

  const ids = [...body_md.matchAll(/asset:\/\/([a-f0-9-]+)/gi)].map((m) => m[1])
  const unique = [...new Set(ids)]
  await Promise.all(
    unique.map(async (id) => {
      const a = await db.assets.get(id)
      if (a && a.node_id !== nodeId) await db.assets.update(id, { node_id: nodeId })
    }),
  )
}