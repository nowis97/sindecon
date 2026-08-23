/**
 * Formato wiki-link en el Markdown: `[[uuid]]` o `[[uuid|alias visible]]`.
 * El uuid es estable a renombres y movimientos; el alias es solo cosmético.
 */
export const WIKI_LINK_REGEX = /\[\[([a-f0-9-]+)(?:\|([^\]]+))?\]\]/g

/** Devuelve los ids únicos referenciados desde un Markdown. */
export function extractWikiLinkIds(markdown: string): string[] {
  const ids = new Set<string>()
  for (const m of markdown.matchAll(WIKI_LINK_REGEX)) {
    if (m[1]) ids.add(m[1])
  }
  return [...ids]
}