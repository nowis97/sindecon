import { db, type FlashcardRow } from '../db/db'
import { getDecksState, saveDecksState } from '../db/decks'

export interface DeckBlockMeta {
  file: string
  count: number
  hash: string
}

export interface DeckManifest {
  id: string
  title: string
  source_version: string
  blocks: DeckBlockMeta[]
}

export interface DeckSummary {
  id: string
  title: string
  blocks: number
  cards: number
  updated_at?: string
}

export interface DeckIndex {
  format_version: number
  generated_at: string
  source_version: string
  new_per_day?: number
  decks: DeckSummary[]
}

const DAY_MS = 86_400_000

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'same-origin' })
  if (!res.ok) {
    throw new Error(`No se pudo descargar ${url} (HTTP ${res.status})`)
  }
  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('json')) {
    // El Worker devuelve index.html (SPA fallback) para assets inexistentes
    throw new Error(`La respuesta de ${url} no es JSON`)
  }
  return (await res.json()) as T
}

export async function fetchIndex(base = '/api/decks'): Promise<DeckIndex> {
  return fetchJson<DeckIndex>(`${base}/index.json`)
}

export async function fetchManifest(
  deckId: string,
  base = '/api/decks',
): Promise<DeckManifest> {
  return fetchJson<DeckManifest>(`${base}/${deckId}/manifest.json`)
}

/**
 * Descarga un bloque de tarjetas y lo fusiona en IndexedDB.
 *
 * - Conserva el progreso SM-2 de las tarjetas que ya existían (`id` estable).
 * - Borra las tarjetas que salieron del bloque en una nueva versión.
 * - Reparte `due_date` de las nuevas: `nuevasPorDia` por día.
 */
export async function downloadBlock(
  deckId: string,
  file: string,
  nuevasPorDia = 20,
  now = Date.now(),
  hash = '',
  base = '/api/decks',
): Promise<{ added: number; removed: number }> {
  const key = `${deckId}/${file}`
  const incoming = await fetchJson<FlashcardRow[]>(`${base}/${key}`)
  const state = await getDecksState()

  const previous = await db.flashcards.bulkGet(incoming.map((c) => c.id))
  const previousById = new Map(
    previous.filter((c): c is FlashcardRow => Boolean(c)).map((c) => [c.id, c]),
  )

  let nextIndex = state.nextDayIndex
  const merged = incoming.map((card) => {
    const prev = previousById.get(card.id)
    if (prev) {
      return {
        ...card,
        interval: prev.interval,
        ease_factor: prev.ease_factor,
        reps: prev.reps,
        lapses: prev.lapses,
        due_date: prev.due_date,
        created_at: prev.created_at,
        updated_at: prev.updated_at,
      }
    }
    const day = Math.floor(nextIndex / Math.max(1, nuevasPorDia))
    nextIndex += 1
    return {
      ...card,
      due_date: now + day * DAY_MS,
      created_at: now,
      updated_at: now,
    }
  })

  const newIds = merged.map((c) => c.id)
  const previousIds = state.blocks[key]?.cardIds ?? []

  // Una tarjeta que se movió a otro bloque del mismo mazo no es huérfana.
  const deckPrefix = `${deckId}/`
  const otherBlockIds = new Set(
    Object.entries(state.blocks)
      .filter(([blockKey]) => blockKey !== key && blockKey.startsWith(deckPrefix))
      .flatMap(([, block]) => block.cardIds),
  )
  const removed = previousIds.filter(
    (id) => !newIds.includes(id) && !otherBlockIds.has(id),
  )

  await db.flashcards.bulkPut(merged)
  if (removed.length > 0) {
    await db.flashcards.bulkDelete(removed)
  }

  await saveDecksState({
    blocks: { ...state.blocks, [key]: { hash, cardIds: newIds } },
    nextDayIndex: nextIndex,
  })

  return {
    added: merged.length - previousById.size,
    removed: removed.length,
  }
}
