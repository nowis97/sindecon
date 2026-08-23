/**
 * Formato wiki-link en el Markdown: `[[uuid]]` o `[[uuid|alias visible]]`.
 * El uuid es estable a renombres y movimientos; el alias es solo cosmético.
 */
export const WIKI_LINK_REGEX = /\[\[([a-f0-9-]+)(?:\|([^\]]+))?\]\]/g

export interface ParsedWikiLink {
  uuid: string
  label?: string
  full: string
}

export function parseWikiLink(text: string): ParsedWikiLink | null {
  const m = text.match(/^\[\[([a-f0-9-]+)(?:\|([^\]]+))?\]\]$/)
  if (!m) return null
  return { uuid: m[1], label: m[2], full: m[0] }
}

/** Devuelve los ids únicos referenciados desde un Markdown. */
export function extractWikiLinkIds(markdown: string): string[] {
  const ids = new Set<string>()
  for (const m of markdown.matchAll(WIKI_LINK_REGEX)) {
    if (m[1]) ids.add(m[1])
  }
  return [...ids]
}

/** Devuelve las menciones con posición; útil para decoración ProseMirror. */
export function findWikiLinks(markdown: string): Array<{
  from: number
  to: number
  uuid: string
  label?: string
}> {
  const out: Array<{ from: number; to: number; uuid: string; label?: string }> = []
  const re = new RegExp(WIKI_LINK_REGEX.source, 'g')
  for (const m of markdown.matchAll(re)) {
    if (m.index === undefined) continue
    out.push({
      from: m.index,
      to: m.index + m[0].length,
      uuid: m[1],
      label: m[2],
    })
  }
  return out
}