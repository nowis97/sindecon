/**
 * Utilidades para procesamiento, validación y formateo de documentos PDF.
 */

/**
 * Limpia un nombre de archivo PDF para sugerir un título de artículo legible.
 * Remueve la extensión .pdf, reemplaza guiones y caracteres de sistema por espacios,
 * normaliza espacios en blanco y capitaliza palabras si está en minúsculas.
 */
export function cleanPdfFilenameToTitle(filename: string): string {
  if (!filename) return 'Documento PDF'

  const withoutExt = filename.replace(/\.pdf$/i, '')
  const cleaned = withoutExt
    .replace(/[_-]+/g, ' ')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) return 'Documento PDF'

  // Capitalizar primera letra de cada palabra si todo está en minúsculas
  if (cleaned === cleaned.toLowerCase()) {
    return cleaned.replace(/\b\w/g, (c) => c.toUpperCase())
  }

  return cleaned
}

/**
 * Valida si un archivo o descriptor de archivo es de tipo PDF.
 */
export function isPdfFile(file: { name: string; type?: string }): boolean {
  if (!file || !file.name) return false
  const hasPdfExt = file.name.toLowerCase().endsWith('.pdf')
  const hasPdfMime = file.type === 'application/pdf'
  return hasPdfExt || hasPdfMime
}

/**
 * Formatea el tamaño de un archivo en bytes a una cadena legible (B, KB, MB).
 */
export function formatPdfFileSize(bytes: number): string {
  if (bytes < 0 || isNaN(bytes)) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) {
    return `${kb >= 10 ? Math.round(kb) : kb.toFixed(1)} KB`
  }
  const mb = kb / 1024
  return `${mb.toFixed(1)} MB`
}
