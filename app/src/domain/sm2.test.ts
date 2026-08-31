import { describe, it, expect } from 'vitest'
import { calculateNextSm2, getRatingIntervalLabels } from './sm2'

describe('SM-2 Algorithm', () => {
  const initialCard = {
    interval: 0,
    ease_factor: 2.5,
    reps: 0,
    lapses: 0,
  }

  it('calculates initial review when rating is Good (3)', () => {
    const res = calculateNextSm2(initialCard, 3, 1000000)
    expect(res.interval).toBe(1)
    expect(res.reps).toBe(1)
    expect(res.ease_factor).toBe(2.5)
    expect(res.lapses).toBe(0)
    expect(res.due_date).toBe(1000000 + 1 * 86400000)
  })

  it('calculates second consecutive Good review (reps=1 -> 6d)', () => {
    const card = { interval: 1, ease_factor: 2.5, reps: 1, lapses: 0 }
    const res = calculateNextSm2(card, 3, 1000000)
    expect(res.interval).toBe(6)
    expect(res.reps).toBe(2)
  })

  it('calculates third consecutive Good review with ease factor multiplication', () => {
    const card = { interval: 6, ease_factor: 2.5, reps: 2, lapses: 0 }
    const res = calculateNextSm2(card, 3, 1000000)
    expect(res.interval).toBe(15) // 6 * 2.5 = 15
    expect(res.reps).toBe(3)
  })

  it('resets reps and increases lapse when rating is Again (1)', () => {
    const card = { interval: 15, ease_factor: 2.5, reps: 3, lapses: 0 }
    const res = calculateNextSm2(card, 1, 1000000)
    expect(res.interval).toBe(1)
    expect(res.reps).toBe(0)
    expect(res.lapses).toBe(1)
    expect(res.ease_factor).toBe(2.3) // 2.5 - 0.2
  })

  it('never lowers ease factor below 1.3', () => {
    const card = { interval: 1, ease_factor: 1.35, reps: 0, lapses: 5 }
    const res = calculateNextSm2(card, 1, 1000000)
    expect(res.ease_factor).toBe(1.3)
  })

  it('handles Easy (4) bonus', () => {
    const res = calculateNextSm2(initialCard, 4, 1000000)
    expect(res.interval).toBe(4)
    expect(res.reps).toBe(1)
    expect(res.ease_factor).toBe(2.65)
  })

  it('provides rating interval labels', () => {
    const labels = getRatingIntervalLabels(initialCard)
    expect(labels[1]).toBe('1d')
    expect(labels[2]).toBe('1d')
    expect(labels[3]).toBe('1d')
    expect(labels[4]).toBe('4d')
  })
})
