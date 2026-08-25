import { db, type NodeRow, type ArticleRow } from './db'
import { createNode } from './nodes'
import { saveArticle } from './articles'
import { createAssetFromFile, setAssetOwner } from './assets'
import { compressImage } from '../utils/imageCompress'

export const INBOX_SYSTEM_MARKER = 'inbox'
export const SYSTEM_INBOX_ID = 'sys-folder-inbox'

/** Obtiene o crea la carpeta de sistema Inbox de manera determinista e idempotente. */
export async function ensureInboxFolder(): Promise<NodeRow> {
  const existingById = await db.nodes.get(SYSTEM_INBOX_ID)
  if (existingById && existingById.deleted_at === null && existingById.kind === 'folder') {
    return existingById
  }

  const existing = await db.nodes
    .filter(
      (n) =>
        (n.system === INBOX_SYSTEM_MARKER || (n.title === 'Inbox' && n.parent_id === null)) &&
        n.deleted_at === null &&
        n.kind === 'folder',
    )
    .first()

  if (existing) {
    return existing
  }

  return await createNode({
    id: SYSTEM_INBOX_ID,
    kind: 'folder',
    title: 'Inbox',
    system: INBOX_SYSTEM_MARKER,
    parent_id: null,
  })
}

export interface QuickCaptureInput {
  file?: File | null
  note?: string
}

export interface QuickCaptureResult {
  node: NodeRow
  article: ArticleRow
}

function formatCaptureDate(d: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  const day = pad(d.getDate())
  const month = pad(d.getMonth() + 1)
  const hours = pad(d.getHours())
  const mins = pad(d.getMinutes())
  return `${day}/${month} ${hours}:${mins}`
}

export function generateCaptureTitle(note?: string, date: Date = new Date()): string {
  const trimmedNote = note?.trim()
  if (trimmedNote) {
    const firstLine = trimmedNote.split('\n')[0].trim()
    if (firstLine.length <= 40) {
      return firstLine
    }
    return firstLine.slice(0, 37) + '…'
  }
  return `Captura ${formatCaptureDate(date)}`
}

/**
 * Guarda una captura rápida (foto y/o nota) directamente en el Inbox
 * sin solicitar ubicación al usuario.
 */
export async function createQuickCapture(input: QuickCaptureInput): Promise<QuickCaptureResult> {
  const inbox = await ensureInboxFolder()
  const title = generateCaptureTitle(input.note)

  let assetId: string | null = null
  if (input.file) {
    let processedFile = input.file
    try {
      if (typeof document !== 'undefined' && input.file.type.startsWith('image/')) {
        processedFile = await compressImage(input.file)
      }
    } catch {
      // Si falla la compresión (p.ej. entorno test), usamos el archivo original
      processedFile = input.file
    }
    const asset = await createAssetFromFile(processedFile)
    assetId = asset.id
  }

  const sections: string[] = []
  if (assetId) {
    sections.push(`![Captura](asset://${assetId})`)
  }
  if (input.note?.trim()) {
    sections.push(input.note.trim())
  }

  const bodyMd = sections.join('\n\n')
  const node = await createNode({
    kind: 'article',
    title,
    parent_id: inbox.id,
  })

  if (assetId) {
    await setAssetOwner(assetId, node.id)
  }

  const article = await saveArticle(node.id, bodyMd, ['captura'])
  return { node, article }
}
