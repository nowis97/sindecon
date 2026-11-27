/**
 * API de mazos EUNACOM servidos desde Cloudflare D1.
 *
 * GET /api/decks/index.json          -> catálogo
 * GET /api/decks/:id/manifest.json   -> manifest del mazo
 * GET /api/decks/:id/:file           -> bloque de tarjetas
 *
 * Mantiene el mismo contrato que los antiguos JSON estáticos, así el front
 * solo cambia la base de `fetchIndex` a `/api/decks`.
 */
import { jsonResponse, type CfPagesContext } from './oauth/_shared'

/** Interfaz mínima de D1 (permite testear el handler con un mock). */
export interface DecksDb {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      all<T = Record<string, unknown>>(): Promise<{ results: T[] }>
      first<T = Record<string, unknown>>(): Promise<T | null>
    }
    all<T = Record<string, unknown>>(): Promise<{ results: T[] }>
  }
}

export interface DecksEnv {
  DECKS_DB?: DecksDb
}

export async function onRequest(context: CfPagesContext): Promise<Response> {
  const db = (context.env as DecksEnv).DECKS_DB
  if (!db) {
    return jsonResponse({ error: 'decks_not_configured' }, 503)
  }

  const { pathname } = new URL(context.request.url)
  const rest = pathname.replace(/^\/api\/decks\/?/, '')

  if (rest === '' || rest === 'index.json') {
    return decksIndex(db)
  }

  const [deckId, file] = rest.split('/')
  if (!deckId) {
    return jsonResponse({ error: 'not_found' }, 404)
  }
  if (file === 'manifest.json') {
    return deckManifest(db, deckId)
  }
  if (file) {
    return deckBlock(db, deckId, file)
  }
  return jsonResponse({ error: 'not_found' }, 404)
}

async function decksIndex(db: DecksDb): Promise<Response> {
  const metaRows = await db
    .prepare('SELECT key, value FROM deck_meta')
    .all<{ key: string; value: string }>()
  const meta = Object.fromEntries(metaRows.results.map((r) => [r.key, r.value]))

  const rows = await db
    .prepare(
      `SELECT d.id, d.title, d.updated_at,
              (SELECT COUNT(*) FROM deck_blocks b WHERE b.deck_id = d.id) AS blocks,
              (SELECT COALESCE(SUM(b.count), 0) FROM deck_blocks b WHERE b.deck_id = d.id) AS cards
         FROM decks d
        ORDER BY d.title`,
    )
    .all<Record<string, unknown>>()

  return jsonResponse({
    format_version: Number(meta.format_version ?? 1),
    generated_at: meta.generated_at ?? '',
    source_version: meta.source_version ?? '',
    new_per_day: Number(meta.new_per_day ?? 20),
    decks: rows.results,
  })
}

async function deckManifest(db: DecksDb, deckId: string): Promise<Response> {
  const deck = await db
    .prepare('SELECT id, title, source_version FROM decks WHERE id = ?')
    .bind(deckId)
    .first<Record<string, unknown>>()
  if (!deck) {
    return jsonResponse({ error: 'not_found' }, 404)
  }

  const blocks = await db
    .prepare(
      'SELECT file, hash, count FROM deck_blocks WHERE deck_id = ? ORDER BY file',
    )
    .bind(deckId)
    .all<Record<string, unknown>>()

  return jsonResponse({ ...deck, blocks: blocks.results })
}

async function deckBlock(
  db: DecksDb,
  deckId: string,
  file: string,
): Promise<Response> {
  const rows = await db
    .prepare(
      'SELECT payload FROM deck_cards WHERE deck_id = ? AND block_file = ? ORDER BY position',
    )
    .bind(deckId, file)
    .all<{ payload: string }>()

  if (rows.results.length === 0) {
    return jsonResponse({ error: 'not_found' }, 404)
  }

  // Concatenar los payloads evita parsear y re-serializar 200 objetos
  return new Response(`[${rows.results.map((r) => r.payload).join(',')}]`, {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
