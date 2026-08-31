import type { FlashcardRow } from '../db/db'

export type Sm2Rating = 1 | 2 | 3 | 4

export interface Sm2Result {
  interval: number
  ease_factor: number
  reps: number
  lapses: number
  due_date: number
}

const MIN_EASE_FACTOR = 1.3
const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Calcula el siguiente estado SM-2 dado el estado actual de la tarjeta y la calificación del usuario.
 */
export function calculateNextSm2(
  card: Pick<FlashcardRow, 'interval' | 'ease_factor' | 'reps' | 'lapses'>,
  rating: Sm2Rating,
  now = Date.now()
): Sm2Result {
  let { interval, ease_factor, reps, lapses } = card
  ease_factor = ease_factor || 2.5

  switch (rating) {
    case 1: {
      // Otra vez / Fallo
      reps = 0
      lapses += 1
      interval = 1
      ease_factor = Math.max(MIN_EASE_FACTOR, ease_factor - 0.2)
      break
    }
    case 2: {
      // Difícil
      reps += 1
      interval = interval <= 1 ? 1 : Math.max(1, Math.round(interval * 1.2))
      ease_factor = Math.max(MIN_EASE_FACTOR, ease_factor - 0.15)
      break
    }
    case 3: {
      // Bueno
      if (reps === 0) {
        interval = 1
      } else if (reps === 1) {
        interval = 6
      } else {
        interval = Math.round(interval * ease_factor)
      }
      reps += 1
      break
    }
    case 4: {
      // Fácil
      if (reps === 0) {
        interval = 4
      } else if (reps === 1) {
        interval = 8
      } else {
        interval = Math.round(interval * ease_factor * 1.3)
      }
      reps += 1
      ease_factor = +(ease_factor + 0.15).toFixed(2)
      break
    }
  }

  const due_date = now + interval * MS_PER_DAY

  return {
    interval,
    ease_factor: +ease_factor.toFixed(2),
    reps,
    lapses,
    due_date,
  }
}

/**
 * Devuelve etiquetas legibles de tiempo estimado para los botones de calificación (ej. " 1d\, \6d\).
 */
export function getRatingIntervalLabels(
  card: Pick<FlashcardRow, 'interval' | 'ease_factor' | 'reps' | 'lapses'>
): Record<Sm2Rating, string> {
  const r1 = calculateNextSm2(card, 1)
  const r2 = calculateNextSm2(card, 2)
  const r3 = calculateNextSm2(card, 3)
  const r4 = calculateNextSm2(card, 4)

  const formatDays = (days: number) => (days <= 1 ? '1d' : `${days}d`)

  return {
    1: formatDays(r1.interval),
    2: formatDays(r2.interval),
    3: formatDays(r3.interval),
    4: formatDays(r4.interval),
  }
}
