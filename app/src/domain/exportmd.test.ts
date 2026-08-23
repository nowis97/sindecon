import { describe, it, expect } from 'vitest'
import {
  sanitizeFileName,
  buildFrontmatter,
  parseFrontmatter,
  rewriteAssetRefsToRelative,
  rewriteRelativeRefsToAsset,
  mimeToExt,
  extToMime,
} from './exportmd'

describe('formato de export (Markdown portable)', () => {
  it('sanitizeFileName elimina caracteres peligrosos', () => {
    expect(sanitizeFileName('¿Qué es: la FA?')).toBe('¿Qué es- la FA-')
    expect(sanitizeFileName('A/B\\C')).toBe('A-B-C')
    expect(sanitizeFileName('   ')).toBe('sin-titulo')
  })

  it('frontmatter round-trip sin pérdidas', () => {
    const meta = {
      id: 'abc-123',
      title: 'Fibrilación: auricular',
      order: 2,
      created_at: 1000,
      updated_at: 2000,
      tags: ['fiebre', 'dolor torácico'],
    }
    const raw = buildFrontmatter(meta) + '\n\n# Cuerpo\n\nTexto.'
    const { meta: parsed, body } = parseFrontmatter(raw)
    expect(parsed).toEqual(meta)
    expect(body).toBe('\n# Cuerpo\n\nTexto.')
  })

  it('frontmatter con tags vacíos', () => {
    const meta = { id: 'x', title: 'T', order: 0, created_at: 1, updated_at: 1, tags: [] as string[] }
    const { meta: parsed } = parseFrontmatter(buildFrontmatter(meta) + '\n')
    expect(parsed.tags).toEqual([])
  })

  it('rechaza archivos sin frontmatter', () => {
    expect(() => parseFrontmatter('solo texto')).toThrow()
  })

  it('reescribe refs asset:// ↔ rutas relativas', () => {
    const md = 'Antes ![img](asset://11111111-2222-3333-4444-555555555555) después'
    const map = new Map([['11111111-2222-3333-4444-555555555555', 'assets/11111111-2222-3333-4444-555555555555.png']])
    const rel = rewriteAssetRefsToRelative(md, map)
    expect(rel).toContain('assets/11111111-2222-3333-4444-555555555555.png')
    expect(rel).not.toContain('asset://')
    expect(rewriteRelativeRefsToAsset(rel)).toContain('asset://11111111-2222-3333-4444-555555555555')
  })

  it('refs desconocidas quedan intactas', () => {
    const md = '![x](asset://desconocido-id)'
    expect(rewriteAssetRefsToRelative(md, new Map())).toBe(md)
  })

  it('mime ↔ extensión', () => {
    expect(mimeToExt('image/jpeg')).toBe('jpg')
    expect(mimeToExt('raro/x')).toBe('bin')
    expect(extToMime('PNG')).toBe('image/png')
  })
})
