import { describe, it, expect } from 'vitest'
import { onRequest, type DecksDb } from './decks'
import { createAuthCookieHeader } from './auth/_session'
import type { CfPagesContext } from './oauth/_shared'

const SECRET = 'test-secret'

interface Rows {
  meta?: unknown[]
  decksList?: unknown[]
  deck?: unknown[]
  blocks?: unknown[]
  cards?: unknown[]
  rateCount?: number
}

function mockDb(rows: Rows): DecksDb {
  const pick = (sql: string): unknown[] => {
    if (sql.includes('rate_limits')) return [{ count: rows.rateCount ?? 1 }]
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

async function sessionCookie(): Promise<string> {
  const setCookie = await createAuthCookieHeader(
    { sub: 'u1', email: 'user@test.cl', name: 'Test', method: 'google' },
    SECRET,
    'https://x/api/auth/session',
  )
  return setCookie.split(';')[0]!
}

async function ctx(
  path: string,
  db?: DecksDb,
  opts: { cookie?: string; secret?: string } = {},
): Promise<CfPagesContext> {
  const headers: Record<string, string> = {}
  if (opts.cookie) headers.cookie = opts.cookie
  return {
    request: new Request(`https://x${path}`, { headers }),
    env: {
      ...(db ? { DECKS_DB: db } : {}),
      ...(opts.secret === undefined ? { OAUTH_COOKIE_SECRET: SECRET } : { OAUTH_COOKIE_SECRET: opts.secret }),
    } as CfPagesContext['env'],
  } as CfPagesContext
}

describe('API de mazos', () => {
  it('503 si no hay binding D1', async () => {
    const res = await onRequest(await ctx('/api/decks/index.json'))
    expect(res.status).toBe(503)
  })

  it('500 si falta el secreto de cookies', async () => {
    const res = await onRequest(
      await ctx('/api/decks/index.json', mockDb({}), { secret: '' }),
    )
    expect(res.status).toBe(500)
  })

  it('401 sin sesión', async () => {
    const res = await onRequest(await ctx('/api/decks/index.json', mockDb({})))
    expect(res.status).toBe(401)
  })

  it('401 con cookie inválida', async () => {
    const res = await onRequest(
      await ctx('/api/decks/index.json', mockDb({}), {
        cookie: 'sindecon_auth_session=basura',
      }),
    )
    expect(res.status).toBe(401)
  })

  it('200 index con sesión válida', async () => {
    const cookie = await sessionCookie()
    const db = mockDb({
      meta: [
        { key: 'source_version', value: 'sv1' },
        { key: 'new_per_day', value: '15' },
        { key: 'format_version', value: '1' },
        { key: 'generated_at', value: '2026-11-27T00:00:00Z' },
      ],
      decksList: [{ id: 'pediatria', title: 'Pediatría', blocks: 3, cards: 598 }],
    })
    const res = await onRequest(await ctx('/api/decks/index.json', db, { cookie }))
    const body = (await res.json()) as Record<string, unknown>
    expect(res.status).toBe(200)
    expect(body.format_version).toBe(1)
    expect(body.new_per_day).toBe(15)
    expect((body.decks as unknown[]).length).toBe(1)
  })

  it('429 si excede el rate limit', async () => {
    const cookie = await sessionCookie()
    const db = mockDb({ rateCount: 61 })
    const res = await onRequest(await ctx('/api/decks/index.json', db, { cookie }))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBeTruthy()
  })

  it('manifest del mazo', async () => {
    const cookie = await sessionCookie()
    const db = mockDb({
      deck: [{ id: 'pediatria', title: 'Pediatría', source_version: 'sv1' }],
      blocks: [{ file: '01.json', hash: 'h1', count: 200 }],
    })
    const res = await onRequest(
      await ctx('/api/decks/pediatria/manifest.json', db, { cookie }),
    )
    const body = (await res.json()) as Record<string, unknown>
    expect(res.status).toBe(200)
    expect(body.id).toBe('pediatria')
  })

  it('404 si el mazo no existe', async () => {
    const cookie = await sessionCookie()
    const res = await onRequest(
      await ctx('/api/decks/nope/manifest.json', mockDb({}), { cookie }),
    )
    expect(res.status).toBe(404)
  })

  it('bloque concatena los payloads', async () => {
    const cookie = await sessionCookie()
    const db = mockDb({
      cards: [{ payload: '{"id":"a"}' }, { payload: '{"id":"b"}' }],
    })
    const res = await onRequest(
      await ctx('/api/decks/pediatria/01.json', db, { cookie }),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ id: 'a' }, { id: 'b' }])
  })

  it('404 si el bloque está vacío', async () => {
    const cookie = await sessionCookie()
    const res = await onRequest(
      await ctx('/api/decks/pediatria/99.json', mockDb({}), { cookie }),
    )
    expect(res.status).toBe(404)
  })
})
