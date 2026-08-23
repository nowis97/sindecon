import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { buildIndex, searchIndex, type IndexedArticle } from '../domain/search'
import type { SearchResult } from 'minisearch'

/**
 * Construye un índice MiniSearch reactivo a partir de db.articles +
 * db.nodes (para los títulos). Memoiza por versiones de artículos/nodos,
 * así no se reconstruye en cada keystroke.
 */
export function useSearchIndex(): { articles: IndexedArticle[]; titleOf: Map<string, string> } {
  const articles = useLiveQuery(() => db.articles.toArray(), [], [])
  const nodes = useLiveQuery(
    () => db.nodes.filter((n) => n.deleted_at === null).toArray(),
    [],
    [],
  )
  return useMemo(() => {
    const titleOf = new Map<string, string>()
    const articleKinds = new Set(['article'])
    for (const n of nodes ?? []) {
      if (articleKinds.has(n.kind)) titleOf.set(n.id, n.title)
    }
    const indexed: IndexedArticle[] = (articles ?? []).map((a) => ({
      id: a.node_id,
      title: titleOf.get(a.node_id) ?? '(sin título)',
      body: a.body_md,
      tags: a.tags.join(' '),
    }))
    return { articles: indexed, titleOf }
  }, [articles, nodes])
}

export function useSearchResults(query: string, limit = 15): SearchResult[] {
  const { articles, titleOf } = useSearchIndex()
  return useMemo(() => {
    if (!query.trim()) return []
    // Reconstruimos el índice solo cuando el corpus cambia
    const index = buildIndex(articles)
    void titleOf // mantener referencia viva en deps, ya consumida al construir el corpus
    return searchIndex(index, query, limit)
  }, [query, articles, titleOf, limit])
}

/** Lista única de todos los tags en uso (orden alfabético). */
export function useAllTags(): string[] {
  const articles = useLiveQuery(() => db.articles.toArray(), [], [])
  return useMemo(() => {
    const set = new Set<string>()
    for (const a of articles ?? []) {
      for (const t of a.tags) if (t.trim()) set.add(t.trim())
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'es'))
  }, [articles])
}