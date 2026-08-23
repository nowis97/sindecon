import { describe, it, expect } from 'vitest'
import {
  parseWikiLink,
  extractWikiLinkIds,
  findWikiLinks,
  WIKI_LINK_REGEX,
} from './wikiLinks'

describe('wiki-links (spec search)', () => {
  it('parseWikiLink reconoce [[uuid]] y [[uuid|alias]]', () => {
    expect(parseWikiLink('[[abc-123]]')).toEqual({
      uuid: 'abc-123',
      label: undefined,
      full: '[[abc-123]]',
    })
    expect(parseWikiLink('[[abc-123|FA]]')).toEqual({
      uuid: 'abc-123',
      label: 'FA',
      full: '[[abc-123|FA]]',
    })
    expect(parseWikiLink('texto suelto')).toBeNull()
  })

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

  it('findWikiLinks devuelve posiciones correctas', () => {
    const md = 'Hola [[aaa-1|FA]] mundo [[bbb-2]]'
    const links = findWikiLinks(md)
    expect(links).toHaveLength(2)
    expect(links[0]).toMatchObject({ uuid: 'aaa-1', label: 'FA', from: 5 })
    expect(links[1]).toMatchObject({ uuid: 'bbb-2', from: 24 })
  })

  it('WIKI_LINK_REGEX sigue siendo un RegExp usable', () => {
    expect(WIKI_LINK_REGEX instanceof RegExp).toBe(true)
  })
})