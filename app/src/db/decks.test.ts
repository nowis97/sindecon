import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from './db'
import { getDecksState, saveDecksState } from './decks'

describe('decks state', () => {
  beforeEach(async () => {
    await db.meta.clear()
  })

  it('arranca vacío', async () => {
    expect(await getDecksState()).toEqual({})
  })

  it('guarda y recupera', async () => {
    await saveDecksState({ 'pediatria/01.json': { hash: 'h1', cardIds: ['a', 'b'] } })
    const s = await getDecksState()
    expect(s['pediatria/01.json'].hash).toBe('h1')
    expect(s['pediatria/01.json'].cardIds).toEqual(['a', 'b'])
  })

  it('ignora estado corrupto', async () => {
    await db.meta.put({ key: 'decks_state', value: 'no-es-un-objeto' })
    expect(await getDecksState()).toEqual({})
  })
})
