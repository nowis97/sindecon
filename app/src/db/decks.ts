import { db } from './db'

/** Estado de un bloque descargado: hash del manifest y tarjetas que lo componen. */
export interface DeckBlockState {
  hash: string
  cardIds: string[]
}

/** Clave: `<deckId>/<file>` (ej. `pediatria/01.json`). */
export type DeckState = Record<string, DeckBlockState>

const KEY = 'decks_state'

export async function getDecksState(): Promise<DeckState> {
  const row = await db.meta.get(KEY)
  const value = row?.value
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as DeckState
}

export async function saveDecksState(state: DeckState): Promise<void> {
  await db.meta.put({ key: KEY, value: state })
}
