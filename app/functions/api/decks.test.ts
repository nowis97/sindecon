import { describe, it, expect } from 'vitest'
import { onRequest, type DecksDb } from './decks'
import type { CfPagesContext } from './oauth/_shared'

interface Rows {
  meta?: unknown[]
  decksList?: unknown[]
  deck?: unknown[]
  blocks?: unknown[]
  cards?: unknown[]
}

function mockDb(rows: Rows): DecksDb {
  const pick = (sql: string): unknown[] => {
    if (sql.includes('deck_meta')) return rows.meta ?? []
    if (sql.includes('FROM decks d')) return rows.decksList ?? []
    if (sql.includes('FROM decks WHERE id')) return rows.deck ?? []
    if (sql.includes('FROM deck_blocks')) return rows.blocks ?? []
    if (sql.includes('FROM deck_cards')) return rows.cards ?? []
    return []
  }
  const make = (sql: string) => {
    const run = async () => ({ results: pick(sql) })
    return {
      bind: () => ({
        all: run,
        first: async () => (pick(sql)[0] as Record<string, unknown>) ?? null,
      }),
      all: run,
    }
  }
  return { prepare: make } as unknown as DecksDb
}

function ctx(path: string, db?: DecksDb) {
  return {
    request: new Request(`https://x${path}`),
    env: (db ? { DECKS_DB: db } : {}) as CfPagesContext['env'],
  } as CfPagesContext
}

describe('API de mazos', () => {
  it('503 si no hay binding D1', async () => {
    const res = await onRequest(ctx('/api/decks/index.json'))
    expect(res.status).toBe(503)
  })

  it('index con meta y decks', async () => {
    const db = mockDb({
      meta: [
        { key: 'source_version', value: 'sv1' },
        { key: 'new_per_day', value: '15' },
        { key: 'format_version', value: '1' },
        { key: 'generated_at', value: '2026-11-27T00:00:00Z' },
      ],
      decksList: [{ id: 'pediatria', title: 'Pediatría', blocks: 3, cards: 598 }],
    })
    const res = await onRequest(ctx('/api/decks/index.json', db))
    const body = (await res.json()) as Record<string, unknown>
    expect(res.status).toBe(200)
    expect(body.format_version).toBe(1)
    expect(body.new_per_day).toBe(15)
    expect(body.source_version).toBe('sv1')
    expect((body.decks as unknown[]).length).toBe(1)
  })

  it('manifest del mazo', async () => {
    const db = mockDb({
      deck: [{ id: 'pediatria', title: 'Pediatría', source_version: 'sv1' }],
      blocks: [{ file: '01.json', hash: 'h1', count: 200 }],
    })
    const res = await onRequest(ctx('/api/decks/pediatria/manifest.json', db))
    const body = (await res.json()) as Record<string, unknown>
    expect(res.status).toBe(200)
    expect(body.id).toBe('pediatria')
    expect((body.blocks as unknown[]).length).toBe(1)
  })

  it('404 si el mazo no existe', async () => {
    const res = await onRequest(ctx('/api/decks/nope/manifest.json', mockDb({})))
    expect(res.status).toBe(404)
  })

  it('bloque concatena los payloads', async () => {
    const db = mockDb({
      cards: [
        { payload: '{"id":"a"}' },
        { payload: '{"id":"b"}' },
      ],
    })
    const res = await onRequest(ctx('/api/decks/pediatria/01.json', db))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ id: 'a' }, { id: 'b' }])
  })

  it('404 si el bloque está vacío', async () => {
    const res = await onRequest(ctx('/api/decks/pediatria/99.json', mockDb({})))
    expect(res.status).toBe(404)
  })
})
