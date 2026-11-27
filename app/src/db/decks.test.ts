import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from './db'
import { getDecksState, saveDecksState } from './decks'

describe('decks state', () => {
  beforeEach(async () => {
    await db.meta.clear()
  })

  it('arranca vacío con contador en 0', async () => {
    expect(await getDecksState()).toEqual({ blocks: {}, nextDayIndex: 0 })
  })

  it('guarda y recupera', async () => {
    await saveDecksState({
      blocks: { 'pediatria/01.json': { hash: 'h1', cardIds: ['a', 'b'] } },
      nextDayIndex: 40,
    })
    const s = await getDecksState()
    expect(s.blocks['pediatria/01.json'].hash).toBe('h1')
    expect(s.blocks['pediatria/01.json'].cardIds).toEqual(['a', 'b'])
    expect(s.nextDayIndex).toBe(40)
  })

  it('ignora estado corrupto o del formato viejo', async () => {
    await db.meta.put({ key: 'decks_state', value: 'no-es-un-objeto' })
    expect(await getDecksState()).toEqual({ blocks: {}, nextDayIndex: 0 })

    await db.meta.put({
      key: 'decks_state',
      value: { 'pediatria/01.json': { hash: 'h', cardIds: ['a'] } },
    })
    expect(await getDecksState()).toEqual({ blocks: {}, nextDayIndex: 0 })
  })
})
