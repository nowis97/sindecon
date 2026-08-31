import Dexie, { type Table } from 'dexie'

// Modelo según design.md D4.
// Ojo: `parent_id` usa null para raíces. IndexedDB NO indexa null,
// así que las consultas por padre se hacen con .filter() (volumen
// de una KB personal: insignificante). No añadir índice sobre parent_id.

export type NodeKind = 'folder' | 'article'
export type SystemMarker = 'inbox' | 'templates' | null

export interface NodeRow {
  id: string // uuid
  parent_id: string | null // null = raíz (Tema)
  kind: NodeKind
  title: string
  order: number // orden entre hermanos
  system: SystemMarker // 'inbox' | 'templates' | null
  created_at: number
  updated_at: number
  deleted_at: number | null // tombstone (sync/merge)
}

export interface ArticleRow {
  node_id: string // pk, 1:1 con nodes kind='article'
  body_md: string // Markdown GFM + fences mermaid + refs asset://
  tags: string[] // tags de síntomas, etc.
}

export interface AssetRow {
  id: string // uuid
  node_id: string // artículo dueño
  blob: Blob
  mime: string
}

export interface MetaRow {
  key: string
  value: unknown
}

export type FlashcardSourceType = 'manual' | 'structural' | 'cloud_ai'

export interface FlashcardRow {
  id: string // uuid
  node_id: string // artículo dueño (o 'global')
  front: string // Anverso (Pregunta / Enunciado)
  back: string // Reverso (Respuesta / Explicación)
  source_type: FlashcardSourceType
  interval: number // días hasta el próximo repaso
  ease_factor: number // factor de facilidad (base 2.5)
  reps: number // racha de respuestas correctas
  lapses: number // fallos acumulados
  due_date: number // timestamp (ms) de vencimiento
  created_at: number
  updated_at: number
}

export interface AiConfig {
  provider: 'gemini' | 'groq' | 'openai' | 'none'
  apiKey?: string
  modelName?: string
  updated_at?: number
}

export class KbDatabase extends Dexie {
  nodes!: Table<NodeRow, string>
  articles!: Table<ArticleRow, string>
  assets!: Table<AssetRow, string>
  meta!: Table<MetaRow, string>
  flashcards!: Table<FlashcardRow, string>

  constructor(name = 'cuaderno-medico') {
    super(name)
    this.version(1).stores({
      nodes: 'id, kind, updated_at',
      articles: 'node_id',
      assets: 'id, node_id',
      meta: 'key',
    })
    this.version(2).stores({
      flashcards: 'id, node_id, due_date, updated_at',
    })
  }
}

export const db = new KbDatabase()
