import { db, type AssetRow } from './db'

/** Persistencia de imágenes en IndexedDB (design D4). El id es uuid; el blob vive aquí. */
export async function createAssetFromFile(
  file: File,
): Promise<{ id: string; mime: string }> {
  const id = crypto.randomUUID()
  const row: AssetRow = {
    id,
    node_id: '',
    blob: file,
    mime: file.type || 'application/octet-stream',
  }
  await db.assets.add(row)
  return { id, mime: row.mime }
}

export async function getAssetBlob(id: string): Promise<Blob | undefined> {
  return (await db.assets.get(id))?.blob
}

export async function setAssetOwner(id: string, nodeId: string): Promise<void> {
  await db.assets.update(id, { node_id: nodeId })
}