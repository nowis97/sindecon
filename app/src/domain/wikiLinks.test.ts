import { describe, it, expect } from 'vitest'
import {
  extractWikiLinkIds,
  WIKI_LINK_REGEX,
} from './wikiLinks'

describe('wiki-links (spec search)', () => {
  it('extractWikiLinkIds devuelve ids únicos', () => {
    const md = 'Ver [[11111111-2222-3333-4444-555555555555]] y [[11111111-2222-3333-4444-555555555555|FA]]'
    expect(extractWikiLinkIds(md)).toEqual(['11111111-2222-3333-4444-555555555555'])
  })

  it('extrae múltiples links distintos', () => {
    const md = '[[aaa]] y [[bbb|otro]]'
    expect(extractWikiLinkIds(md).sort()).toEqual(['aaa', 'bbb'])
  })

  it('ignora texto similar pero no es wiki-link', () => {
    expect(extractWikiLinkIds('[no es link]')).toEqual([])
    expect(extractWikiLinkIds('[[sinuuid]')).toEqual([])
  })

  it('WIKI_LINK_REGEX sigue siendo un RegExp usable', () => {
    expect(WIKI_LINK_REGEX instanceof RegExp).toBe(true)
  })
})