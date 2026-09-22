import { db } from './db'
import { createNode, newId } from './nodes'
import { saveArticle } from './articles'
import { setAssetOwner } from './assets'

export interface SavePdfArticleInput {
  file: File | Blob
  filename?: string
  title: string
  parentId?: string | null
}

export interface SavedPdfArticleResult {
  nodeId: string
  assetId: string
  title: string
}

/**
 * Almacena un archivo PDF en IndexedDB (tabla assets) y crea el nodo de artículo correspondiente
 * con el contenido Markdown apuntando a `[pdf](asset://${assetId})`.
 */
export async function savePdfAsArticle(
  input: SavePdfArticleInput,
): Promise<SavedPdfArticleResult> {
  const assetId = newId()
  const mime = input.file.type || 'application/pdf'

  await db.assets.add({
    id: assetId,
    node_id: '',
    blob: input.file,
    mime: mime.includes('pdf') ? 'application/pdf' : mime,
  })

  const title = input.title.trim() || 'Documento PDF'
  const node = await createNode({
    kind: 'article',
    title,
    parent_id: input.parentId ?? null,
  })

  await setAssetOwner(assetId, node.id)
  await saveArticle(node.id, `[pdf](asset://${assetId})`)

  return {
    nodeId: node.id,
    assetId,
    title: node.title,
  }
}

/**
 * Guarda múltiples archivos PDF en lote, creando un artículo para cada uno en la carpeta especificada.
 */
export async function saveMultiplePdfsAsArticles(
  items: SavePdfArticleInput[],
  onProgress?: (current: number, total: number) => void,
): Promise<SavedPdfArticleResult[]> {
  const results: SavedPdfArticleResult[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const saved = await savePdfAsArticle(item)
    results.push(saved)
    onProgress?.(i + 1, items.length)
  }
  return results
}
