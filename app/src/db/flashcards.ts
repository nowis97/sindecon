import { db, type FlashcardRow, type AiConfig, type FlashcardSourceType } from './db'

export type { FlashcardRow, AiConfig, FlashcardSourceType }

export async function getAllFlashcards(): Promise<FlashcardRow[]> {
  return db.flashcards.toArray()
}

export async function getDueFlashcards(cutoffMs = Date.now()): Promise<FlashcardRow[]> {
  return db.flashcards
    .where('due_date')
    .belowOrEqual(cutoffMs)
    .sortBy('due_date')
}

export async function getFlashcardsByNode(nodeId: string): Promise<FlashcardRow[]> {
  return db.flashcards
    .where('node_id')
    .equals(nodeId)
    .toArray()
}

export async function getFlashcardStats(): Promise<{ total: number; dueToday: number; mastered: number }> {
  const all = await db.flashcards.toArray()
  const now = Date.now()
  const dueToday = all.filter((c) => c.due_date <= now).length
  const mastered = all.filter((c) => c.interval >= 21).length
  return {
    total: all.length,
    dueToday,
    mastered,
  }
}

export async function createFlashcard(params: {
  nodeId: string
  front: string
  back: string
  sourceType?: FlashcardSourceType
}): Promise<FlashcardRow> {
  const now = Date.now()
  const newCard: FlashcardRow = {
    id: crypto.randomUUID(),
    node_id: params.nodeId,
    front: params.front.trim(),
    back: params.back.trim(),
    source_type: params.sourceType || 'manual',
    interval: 0,
    ease_factor: 2.5,
    reps: 0,
    lapses: 0,
    due_date: now,
    created_at: now,
    updated_at: now,
  }

  await db.flashcards.put(newCard)
  return newCard
}

export async function upsertFlashcards(cards: FlashcardRow[]): Promise<void> {
  if (cards.length === 0) return
  await db.flashcards.bulkPut(cards)
}

export async function updateFlashcard(id: string, patch: Partial<FlashcardRow>): Promise<void> {
  await db.flashcards.update(id, {
    ...patch,
    updated_at: Date.now(),
  })
}

export async function deleteFlashcard(id: string): Promise<void> {
  await db.flashcards.delete(id)
}

export async function deleteFlashcardsByNode(nodeId: string): Promise<void> {
  const cards = await db.flashcards.where('node_id').equals(nodeId).toArray()
  const ids = cards.map((c) => c.id)
  if (ids.length > 0) {
    await db.flashcards.bulkDelete(ids)
  }
}

const AI_CONFIG_KEY = 'ai_config'

export const DEFAULT_AI_CONFIG: AiConfig = {
  provider: 'gemini',
  apiKey: '',
  modelName: 'gemini-3.5-flash',
}

export async function getAiConfig(): Promise<AiConfig> {
  const row = await db.meta.get(AI_CONFIG_KEY)
  if (!row || !row.value) {
    return { ...DEFAULT_AI_CONFIG }
  }
  return { ...DEFAULT_AI_CONFIG, ...(row.value as Partial<AiConfig>) }
}

export async function saveAiConfig(config: AiConfig): Promise<void> {
  const enriched: AiConfig = {
    ...config,
    updated_at: config.updated_at || Date.now(),
  }
  await db.meta.put({
    key: AI_CONFIG_KEY,
    value: enriched,
  })
}
