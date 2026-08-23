import MiniSearch, { type SearchResult } from 'minisearch'

/**
 * Tupla que MiniSearch indexa. Tags se aplanan a string porque MiniSearch
 * no indexa arrays nativos; el array original vive en db.articles.
 */
export interface IndexedArticle {
  id: string // node_id
  title: string
  body: string
  tags: string // joined, ej "fiebre dolor torácico"
}

export function buildIndex(
  articles: IndexedArticle[],
): MiniSearch<IndexedArticle> {
  const ms = new MiniSearch<IndexedArticle>({
    fields: ['title', 'body', 'tags'],
    storeFields: ['id', 'title'],
    searchOptions: {
      boost: { title: 3, tags: 2 },
      prefix: true,
      fuzzy: 0.2,
    },
  })
  ms.addAll(articles)
  return ms
}

export function searchIndex(
  index: MiniSearch<IndexedArticle>,
  q: string,
  limit = 15,
): SearchResult[] {
  const query = q.trim()
  if (!query) return []
  return index.search(query, { fuzzy: 0.2, prefix: true }).slice(0, limit)
}