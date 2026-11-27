import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '../db/db'
import { downloadBlock } from './deckDownloader'

function jsonResponse(body: unknown, contentType = 'application/json') {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': contentType },
  })
}

function mk(id: string) {
  return {
    id,
    node_id: 'global',
    front: `f-${id}`,
    back: 'b',
    source_type: 'eunacom',
    interval: 0,
    ease_factor: 2.5,
    reps: 0,
    lapses: 0,
    due_date: 0,
    created_at: 0,
    updated_at: 0,
  }
}

describe('deckDownloader', () => {
  beforeEach(async () => {
    await db.flashcards.clear()
    await db.meta.clear()
    vi.restoreAllMocks()
  })

  it('rechaza respuesta no JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response('<html></html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
      ),
    )
    await expect(downloadBlock('pediatria', '01.json', 20)).rejects.toThrow(/no es JSON/)
  })

  it('rechaza HTTP de error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 404 })))
    await expect(downloadBlock('pediatria', '01.json', 20)).rejects.toThrow(/HTTP 404/)
  })

  it('reparte due_date en días', async () => {
    const cards = Array.from({ length: 30 }, (_, i) => mk(`c${i}`))
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(cards)))
    const now = 1_700_000_000_000
    await downloadBlock('pediatria', '01.json', 10, now)
    const all = await db.flashcards.toArray()
    const days = new Set(all.map((c) => Math.floor((c.due_date - now) / 86_400_000)))
    expect(days).toEqual(new Set([0, 1, 2]))
  })

  it('conserva el progreso al re-descargar', async () => {
    const card = mk('c1')
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse([card])))
    await downloadBlock('pediatria', '01.json', 20)
    await db.flashcards.update('c1', { interval: 7, ease_factor: 2.7 })
    await downloadBlock('pediatria', '01.json', 20)
    const saved = await db.flashcards.get('c1')
    expect(saved?.interval).toBe(7)
    expect(saved?.ease_factor).toBe(2.7)
  })

  it('borra las tarjetas que salieron del bloque', async () => {
    let payload = [mk('a'), mk('b')]
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(payload)))
    await downloadBlock('pediatria', '01.json', 20)
    payload = [mk('a'), mk('c')]
    await downloadBlock('pediatria', '01.json', 20)
    const ids = (await db.flashcards.toArray()).map((c) => c.id).sort()
    expect(ids).toEqual(['a', 'c'])
  })

  it('no duplica al descargar dos veces', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse([mk('a')])))
    await downloadBlock('pediatria', '01.json', 20)
    await downloadBlock('pediatria', '01.json', 20)
    expect(await db.flashcards.count()).toBe(1)
  })
})
