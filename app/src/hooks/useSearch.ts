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
    const articleMap = new Map((articles ?? []).map((a) => [a.node_id, a]))
    const indexed: IndexedArticle[] = []

    for (const n of nodes ?? []) {
      if (n.kind === 'article') {
        titleOf.set(n.id, n.title)
        const a = articleMap.get(n.id)
        indexed.push({
          id: n.id,
          title: n.title,
          body: a?.body_md ?? '',
          tags: (a?.tags ?? []).join(' '),
        })
      }
    }
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

/** Obtiene los IDs de artículos que contienen una etiqueta específica. */
export function useArticlesWithTag(tag: string | null): string[] {
  const articles = useLiveQuery(() => db.articles.toArray(), [], [])
  return useMemo(() => {
    if (!tag) return []
    const lower = tag.trim().toLowerCase()
    return (articles ?? [])
      .filter((a) => a.tags.some((t) => t.toLowerCase() === lower))
      .map((a) => a.node_id)
  }, [articles, tag])
}