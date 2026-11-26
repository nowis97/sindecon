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

export type FlashcardSourceType = 'manual' | 'structural' | 'cloud_ai' | 'local_ai'

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
  localModelId?: string
  updated_at?: number
}

export type AnnotationTool = 'pen' | 'highlighter' | 'eraser'

export interface AnnotationPoint {
  x: number // Coordenada X normalizada (escala base 1.0 en puntos PDF)
  y: number // Coordenada Y normalizada (escala base 1.0 en puntos PDF)
  pressure?: number
}

export interface AnnotationStroke {
  id: string
  tool: AnnotationTool
  color: string
  width: number
  points: AnnotationPoint[]
}

export interface PageAnnotationsRecord {
  id?: number // Clave primaria autoincremental
  documentId: string // ID del documento o asset (ej. assetId o URI)
  pageNumber: number // Número de página (1-indexado)
  strokes: AnnotationStroke[] // Trazos vectoriales de la página
  updatedAt: number // Timestamp ms
}

export type CalendarAccessRole = 'owner' | 'writer' | 'reader' | 'freeBusyReader'
export type CalendarSyncStatus = 'synced' | 'pending' | 'error'
export type CalendarEventStatus = 'confirmed' | 'tentative' | 'cancelled'
export type CalendarOutboxOp = 'create' | 'update' | 'delete'

export interface CalendarListRow {
  id: string
  summary: string
  primary: boolean
  backgroundColor: string
  accessRole: CalendarAccessRole
  selected: boolean
  timeZone?: string
}

export interface CalendarEventRow {
  id: string // googleEventId o 'local-<uuid>' antes de sincronizar
  calendarId: string
  summary: string
  description: string
  location: string
  startIso: string // 'YYYY-MM-DD' si allDay=true; RFC3339 si allDay=false
  endIso: string // 'YYYY-MM-DD' exclusivo si allDay=true; RFC3339 si allDay=false
  startMs: number // ms local inicio
  endMs: number // ms local fin (exclusivo para allDay)
  allDay: boolean
  status: CalendarEventStatus
  recurringEventId?: string
  htmlLink?: string
  updatedAt: number
  syncStatus: CalendarSyncStatus
  syncError?: string
}

export interface CalendarEventDraft {
  calendarId: string
  summary: string
  description: string
  location: string
  startIso: string
  endIso: string
  allDay: boolean
  timeZone?: string
}

export interface CalendarOutboxRow {
  id?: number
  op: CalendarOutboxOp
  eventId: string
  calendarId: string
  payload?: CalendarEventDraft
  createdAt: number
  attempts: number
  lastError?: string
}

export class KbDatabase extends Dexie {
  nodes!: Table<NodeRow, string>
  articles!: Table<ArticleRow, string>
  assets!: Table<AssetRow, string>
  meta!: Table<MetaRow, string>
  flashcards!: Table<FlashcardRow, string>
  pdf_annotations!: Table<PageAnnotationsRecord, number>
  calendar_list!: Table<CalendarListRow, string>
  calendar_events!: Table<CalendarEventRow, string>
  calendar_outbox!: Table<CalendarOutboxRow, number>

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
    this.version(3).stores({
      pdf_annotations: '++id, [documentId+pageNumber], documentId, updatedAt',
    })
    this.version(4).stores({
      calendar_list: 'id',
      calendar_events: 'id, calendarId, startMs, endMs, [calendarId+startMs]',
      calendar_outbox: '++id, eventId, createdAt',
    })
  }
}

export const db = new KbDatabase()
