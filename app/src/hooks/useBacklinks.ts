import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { WIKI_LINK_REGEX } from '../domain/wikiLinks'

export interface Backlink {
  id: string // node_id del artículo que contiene el enlace
  title: string
}

/**
 * Devuelve los artículos que enlazan hacia `targetArticleId` (vía [[uuid]]).
 * Resilente: ignora links huérfanos (uuid no corresponde a un artículo vivo).
 */
export function useBacklinks(targetArticleId: string | null): Backlink[] {
  const articles = useLiveQuery(() => db.articles.toArray(), [], [])
  const nodes = useLiveQuery(
    () => db.nodes
      .filter((n) => n.deleted_at === null && n.kind === 'article')
      .toArray(),
    [],
    [],
  )
  const titleOf = useMemo(() => {
    const m = new Map<string, string>()
    for (const n of nodes ?? []) m.set(n.id, n.title)
    return m
  }, [nodes])

  return useMemo(() => {
    if (!targetArticleId) return []
    const out: Backlink[] = []
    const re = new RegExp(WIKI_LINK_REGEX.source, 'g')
    for (const a of articles ?? []) {
      if (a.node_id === targetArticleId) continue
      let hit = false
      for (const m of a.body_md.matchAll(re)) {
        if (m[1] === targetArticleId) {
          hit = true
          break
        }
      }
      if (hit) {
        const title = titleOf.get(a.node_id) ?? '(sin título)'
        out.push({ id: a.node_id, title })
      }
    }
    return out
  }, [targetArticleId, articles, titleOf])
}