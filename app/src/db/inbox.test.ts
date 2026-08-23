import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from './db'
import { ensureInboxFolder, createQuickCapture, generateCaptureTitle, INBOX_SYSTEM_MARKER } from './inbox'
import { listChildren } from './nodes'

beforeEach(async () => {
  await Promise.all([
    db.nodes.clear(),
    db.articles.clear(),
    db.assets.clear(),
    db.meta.clear(),
  ])
})

describe('inbox y captura rápida', () => {
  it('ensureInboxFolder crea la carpeta Inbox una única vez (idempotente)', async () => {
    const inbox1 = await ensureInboxFolder()
    expect(inbox1.title).toBe('Inbox')
    expect(inbox1.system).toBe(INBOX_SYSTEM_MARKER)
    expect(inbox1.parent_id).toBeNull()

    const inbox2 = await ensureInboxFolder()
    expect(inbox2.id).toBe(inbox1.id)

    const allInboxes = await db.nodes
      .filter((n) => n.system === INBOX_SYSTEM_MARKER && n.deleted_at === null)
      .toArray()
    expect(allInboxes).toHaveLength(1)
  })

  it('generateCaptureTitle usa la primera línea de la nota o la fecha', () => {
    expect(generateCaptureTitle('Paciente con fiebre alta\nRevisar laboratorio')).toBe(
      'Paciente con fiebre alta',
    )
    expect(generateCaptureTitle('   ')).toContain('Captura ')
    expect(generateCaptureTitle(undefined)).toContain('Captura ')
  })

  it('createQuickCapture guarda una nota directamente en el Inbox', async () => {
    const result = await createQuickCapture({
      note: 'Presión 140/90 en control matutino',
    })

    expect(result.node.title).toBe('Presión 140/90 en control matutino')
    expect(result.node.kind).toBe('article')
    expect(result.article.body_md).toBe('Presión 140/90 en control matutino')
    expect(result.article.tags).toContain('captura')

    const inbox = await ensureInboxFolder()
    expect(result.node.parent_id).toBe(inbox.id)

    const children = await listChildren(inbox.id)
    expect(children.map((c) => c.id)).toContain(result.node.id)
  })

  it('createQuickCapture guarda foto + nota asociando el asset', async () => {
    const fakeFile = new File(['fake-image-content'], 'foto.jpg', { type: 'image/jpeg' })
    const result = await createQuickCapture({
      file: fakeFile,
      note: 'ECG derivación DII',
    })

    expect(result.article.body_md).toMatch(/!\[Captura\]\(asset:\/\/[a-f0-9-]+\)\n\nECG derivación DII/)
    const assetIdMatch = result.article.body_md.match(/asset:\/\/([a-f0-9-]+)/)
    expect(assetIdMatch).toBeTruthy()

    const assetId = assetIdMatch![1]
    const asset = await db.assets.get(assetId)
    expect(asset).toBeDefined()
    expect(asset?.node_id).toBe(result.node.id)
  })
})
