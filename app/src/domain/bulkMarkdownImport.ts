import JSZip from 'jszip'

export interface ParsedMarkdownArticle {
  title: string
  tags: string[]
  body: string
  originalFilename: string
  relativePath?: string
}

export interface RawFileItem {
  filename: string
  content: string
  relativePath?: string
}

/** Limpia un nombre de archivo para convertirlo en un título legible si no hay Frontmatter ni H1. */
export function cleanFilenameToTitle(filename: string): string {
  const withoutExt = filename.replace(/\.(md|markdown)$/i, '')
  // Reemplazar guiones bajos y múltiples guiones por espacios
  const cleaned = withoutExt
    .replace(/[_-]+/g, ' ')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) return 'Sin Título'

  // Capitalizar primera letra de cada palabra si está todo en minúsculas
  if (cleaned === cleaned.toLowerCase()) {
    return cleaned.replace(/\b\w/g, (c) => c.toUpperCase())
  }
  return cleaned
}

/** Parsea un bloque de Frontmatter YAML básico sin dependencias externas pesadas. */
export function extractFrontmatter(raw: string): {
  frontmatter: { title?: string; tags?: string[]; [key: string]: unknown }
  body: string
} {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!match) {
    return { frontmatter: {}, body: raw }
  }

  const yamlContent = match[1]
  const body = raw.slice(match[0].length)
  const frontmatter: { title?: string; tags?: string[]; [key: string]: unknown } = {}

  const lines = yamlContent.split(/\r?\n/)
  let currentKey = ''
  let inList = false
  const listItems: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    // Elemento de lista multilínea (ej. `  - tag1`)
    if (trimmed.startsWith('-') && inList) {
      const itemVal = trimmed.replace(/^-\s*/, '').replace(/^['"]|['"]$/g, '').trim()
      if (itemVal) listItems.push(itemVal)
      continue
    }

    if (inList && currentKey) {
      frontmatter[currentKey] = [...listItems]
      inList = false
      listItems.length = 0
    }

    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue

    const key = line.slice(0, colonIdx).trim()
    const rawVal = line.slice(colonIdx + 1).trim()
    currentKey = key

    if (!rawVal) {
      // Posible inicio de lista multilínea
      inList = true
      listItems.length = 0
      continue
    }

    // Lista en formato bracket [tag1, tag2]
    if (rawVal.startsWith('[') && rawVal.endsWith(']')) {
      const items = rawVal
        .slice(1, -1)
        .split(',')
        .map((t) => t.trim().replace(/^['"]|['"]$/g, ''))
        .filter((t) => t.length > 0)
      frontmatter[key] = items
    } else {
      // Valor escalar (eliminar comillas si existen)
      const cleanVal = rawVal.replace(/^['"]|['"]$/g, '')
      frontmatter[key] = cleanVal
    }
  }

  if (inList && currentKey) {
    frontmatter[currentKey] = [...listItems]
  }

  return { frontmatter, body }
}

/** Parsea un contenido Markdown y extrae metadatos clínicos (Título, Tags y Cuerpo). */
export function parseMarkdownArticle(
  rawContent: string,
  filename: string,
  relativePath?: string
): ParsedMarkdownArticle {
  const { frontmatter, body } = extractFrontmatter(rawContent)

  // 1. Extraer título: Frontmatter > H1 > Nombre de archivo
  let title = ''
  if (typeof frontmatter.title === 'string' && frontmatter.title.trim()) {
    title = frontmatter.title.trim()
  }

  if (!title) {
    // Buscar primer encabezado H1 en el cuerpo
    const lines = body.split(/\r?\n/)
    for (const l of lines) {
      const matchH1 = l.trim().match(/^#\s+(.+)$/)
      if (matchH1 && matchH1[1].trim()) {
        title = matchH1[1].trim()
        break
      }
    }
  }

  if (!title) {
    title = cleanFilenameToTitle(filename)
  }

  // 2. Extraer etiquetas (Tags): Frontmatter tags / categories / keywords
  const tagsSet = new Set<string>()

  const rawTags = frontmatter.tags || frontmatter.categories || frontmatter.keywords
  if (Array.isArray(rawTags)) {
    for (const t of rawTags) {
      if (typeof t === 'string' && t.trim()) {
        tagsSet.add(t.trim().toLowerCase())
      }
    }
  } else if (typeof rawTags === 'string' && rawTags.trim()) {
    rawTags
      .split(/[,;\s]+/)
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .forEach((t) => tagsSet.add(t))
  }

  return {
    title,
    tags: Array.from(tagsSet),
    body: body.trim(),
    originalFilename: filename,
    relativePath,
  }
}

/** Extrae recursivamente todos los archivos Markdown de un archivo ZIP. */
export async function extractMarkdownZip(
  zipData: Blob | ArrayBuffer | File | Uint8Array
): Promise<RawFileItem[]> {
  let data: any = zipData
  if (data && typeof data.arrayBuffer === 'function') {
    data = await data.arrayBuffer()
  }
  const zip = await JSZip.loadAsync(data)
  const items: RawFileItem[] = []

  const entries: JSZip.JSZipObject[] = []
  zip.forEach((_relPath, file) => {
    // Filtrar archivos no-directorio que sean .md o .markdown y no sean archivos ocultos del sistema
    const isMd = /\.(md|markdown)$/i.test(file.name)
    const isHidden = file.name.split('/').some((part) => part.startsWith('.') || part === '__MACOSX')
    if (!file.dir && isMd && !isHidden) {
      entries.push(file)
    }
  })

  for (const entry of entries) {
    const content = await entry.async('string')
    const parts = entry.name.split('/')
    const filename = parts[parts.length - 1]
    items.push({
      filename,
      content,
      relativePath: entry.name,
    })
  }

  return items
}

/** Procesa una lista de archivos File del navegador (mezcla de .md, .markdown y .zip). */
export async function processFilesForBulkImport(
  files: File[] | FileList
): Promise<ParsedMarkdownArticle[]> {
  const fileArray = Array.from(files)
  const results: ParsedMarkdownArticle[] = []

  for (const file of fileArray) {
    if (file.name.toLowerCase().endsWith('.zip')) {
      const zipItems = await extractMarkdownZip(file)
      for (const item of zipItems) {
        results.push(parseMarkdownArticle(item.content, item.filename, item.relativePath))
      }
    } else if (/\.(md|markdown)$/i.test(file.name)) {
      const content = await file.text()
      const relPath = (file as unknown as { webkitRelativePath?: string }).webkitRelativePath || file.name
      results.push(parseMarkdownArticle(content, file.name, relPath))
    }
  }

  return results
}
