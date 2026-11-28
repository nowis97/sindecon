import { db } from './db'

/** Estado de un bloque descargado: hash del manifest y tarjetas que lo componen. */
export interface DeckBlockState {
  hash: string
  cardIds: string[]
}

export interface DeckState {
  /** Clave: `<deckId>/<file>` (ej. `pediatria/01.json`). */
  blocks: Record<string, DeckBlockState>
  /**
   * Contador global de tarjetas nuevas ya repartidas. Permite continuar el
   * goteo entre bloques (20 nuevas/día en todo el mazo, no por bloque).
   */
  nextDayIndex: number
}

export interface PrunedDeckState {
  state: DeckState
  /** Tarjetas que ya no pertenecen a ningún bloque vigente. */
  removedCardIds: string[]
}

/**
 * Quita del estado los bloques que ya no existen en el manifest.
 *
 * `validBlocks[deckId]`:
 * - Set: archivos vigentes del mazo.
 * - null: el manifest no cargó; se conserva el mazo para no borrar por error.
 * - ausente: el mazo ya no está en el índice; se elimina.
 */
export function pruneDeckState(
  state: DeckState,
  validBlocks: Record<string, Set<string> | null>,
): PrunedDeckState {
  const blocks: Record<string, DeckBlockState> = {}
  const removed: string[] = []

  for (const [key, block] of Object.entries(state.blocks)) {
    const slash = key.indexOf('/')
    const deckId = slash >= 0 ? key.slice(0, slash) : key
    const file = slash >= 0 ? key.slice(slash + 1) : ''
    const valid = validBlocks[deckId]
    const keep =
      valid === undefined ? false : valid === null ? true : valid.has(file)
    if (keep) {
      blocks[key] = block
    } else {
      removed.push(...block.cardIds)
    }
  }

  const keptIds = new Set(Object.values(blocks).flatMap((block) => block.cardIds))
  return {
    state: { ...state, blocks },
    removedCardIds: removed.filter((id) => !keptIds.has(id)),
  }
}

/** IDs de todas las tarjetas descargadas de un mazo. */
export function deckCardIds(state: DeckState, deckId: string): string[] {
  const prefix = `${deckId}/`
  return Object.entries(state.blocks)
    .filter(([key]) => key.startsWith(prefix))
    .flatMap(([, block]) => block.cardIds)
}

const KEY = 'decks_state'

export function emptyDecksState(): DeckState {
  return { blocks: {}, nextDayIndex: 0 }
}

export async function getDecksState(): Promise<DeckState> {
  const row = await db.meta.get(KEY)
  const value = row?.value
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return emptyDecksState()
  }
  const candidate = value as Partial<DeckState>
  if (!candidate.blocks || typeof candidate.blocks !== 'object') {
    // Formato anterior (bloques planos): se descarta y se re-descarga
    return emptyDecksState()
  }
  return {
    blocks: candidate.blocks,
    nextDayIndex:
      typeof candidate.nextDayIndex === 'number' ? candidate.nextDayIndex : 0,
  }
}

export async function saveDecksState(state: DeckState): Promise<void> {
  await db.meta.put({ key: KEY, value: state })
}
