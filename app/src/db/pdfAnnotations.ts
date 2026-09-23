import { db, type AnnotationStroke, type PageAnnotationsRecord } from './db'

/**
 * Obtiene los trazos de anotación guardados para una página específica de un documento PDF.
 */
export async function getPageAnnotations(
  documentId: string,
  pageNumber: number,
): Promise<AnnotationStroke[]> {
  if (!documentId || pageNumber < 1) return []
  try {
    const record = await db.pdf_annotations
      .where(['documentId', 'pageNumber'])
      .equals([documentId, pageNumber])
      .first()
    return record?.strokes ?? []
  } catch {
    return []
  }
}

/**
 * Guarda o actualiza los trazos de anotación de una página.
 * Si el arreglo de trazos está vacío y existía un registro, lo elimina para mantener limpio el almacenamiento.
 */
export async function savePageAnnotations(
  documentId: string,
  pageNumber: number,
  strokes: AnnotationStroke[],
): Promise<void> {
  if (!documentId || pageNumber < 1) return

  const now = Date.now()
  const existing = await db.pdf_annotations
    .where(['documentId', 'pageNumber'])
    .equals([documentId, pageNumber])
    .first()

  if (strokes.length === 0) {
    if (existing?.id !== undefined) {
      await db.pdf_annotations.delete(existing.id)
    }
    return
  }

  if (existing?.id !== undefined) {
    await db.pdf_annotations.update(existing.id, {
      strokes,
      updatedAt: now,
    })
  } else {
    const record: PageAnnotationsRecord = {
      documentId,
      pageNumber,
      strokes,
      updatedAt: now,
    }
    await db.pdf_annotations.add(record)
  }
}

/**
 * Limpia todas las anotaciones de una página específica.
 */
export async function clearPageAnnotations(
  documentId: string,
  pageNumber: number,
): Promise<void> {
  if (!documentId || pageNumber < 1) return
  const existing = await db.pdf_annotations
    .where(['documentId', 'pageNumber'])
    .equals([documentId, pageNumber])
    .first()
  if (existing?.id !== undefined) {
    await db.pdf_annotations.delete(existing.id)
  }
}

/**
 * Elimina todas las anotaciones asociadas a un documento completo (todas sus páginas).
 */
export async function clearAllDocumentAnnotations(documentId: string): Promise<void> {
  if (!documentId) return
  await db.pdf_annotations.where('documentId').equals(documentId).delete()
}
