import { db, type ArticleRow } from './db'

export async function getArticle(nodeId: string): Promise<ArticleRow | undefined> {
  return db.articles.get(nodeId)
}

/** Upsert del cuerpo Markdown; toca updated_at del nodo (fusión futura). */
export async function saveArticle(nodeId: string, body_md: string): Promise<void> {
  const existing = await db.articles.get(nodeId)
  if (existing) {
    await db.articles.update(nodeId, { body_md })
  } else {
    await db.articles.add({ node_id: nodeId, body_md, tags: [] })
  }
  await db.nodes.update(nodeId, { updated_at: Date.now() })
}
