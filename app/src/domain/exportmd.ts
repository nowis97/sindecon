// Formato de export: Markdown + frontmatter YAML controlado.
// El formato lo escribimos nosotros, así que el parser solo necesita
// entender nuestra propia salida.

export interface ArticleFrontmatter {
  id: string
  title: string
  order: number
  created_at: number
  updated_at: number
  tags: string[]
}

/** Nombres de archivo seguros en Windows/Linux/macOS. */
export function sanitizeFileName(title: string): string {
  const cleaned = title.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim()
  return (cleaned || 'sin-titulo').slice(0, 100)
}

export function buildFrontmatter(meta: ArticleFrontmatter): string {
  const tags = `[${meta.tags.join(', ')}]`
  return [
    '---',
    `id: ${meta.id}`,
    `title: ${meta.title}`,
    `order: ${meta.order}`,
    `created_at: ${meta.created_at}`,
    `updated_at: ${meta.updated_at}`,
    `tags: ${tags}`,
    '---',
  ].join('\n')
}

/** Inverso de buildFrontmatter. body = contenido tras el frontmatter. */
export function parseFrontmatter(raw: string): {
  meta: ArticleFrontmatter
  body: string
} {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?/)
  if (!match) throw new Error('Archivo sin frontmatter válido')
  const lines = match[1].split('\n')
  const fields = new Map<string, string>()
  for (const line of lines) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    fields.set(line.slice(0, idx).trim(), line.slice(idx + 1).trim())
  }
  const tagsRaw = fields.get('tags') ?? '[]'
  const tags = tagsRaw
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)

  return {
    meta: {
      id: fields.get('id') ?? '',
      title: fields.get('title') ?? '',
      order: Number(fields.get('order') ?? 0),
      created_at: Number(fields.get('created_at') ?? 0),
      updated_at: Number(fields.get('updated_at') ?? 0),
      tags,
    },
    body: raw.slice(match[0].length),
  }
}

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
}

export function mimeToExt(mime: string): string {
  return MIME_EXT[mime] ?? 'bin'
}

const EXT_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
}

export function extToMime(ext: string): string {
  return EXT_MIME[ext.toLowerCase()] ?? 'application/octet-stream'
}

/** asset://<id> → assets/<id>.<ext> (para el zip exportado). */
export function rewriteAssetRefsToRelative(
  md: string,
  assetFileName: Map<string, string>,
): string {
  return md.replace(/asset:\/\/([a-f0-9-]+)/gi, (full, id: string) => {
    return assetFileName.get(id) ?? full
  })
}

/** assets/<id>.<ext> → asset://<id> (al importar). */
export function rewriteRelativeRefsToAsset(md: string): string {
  return md.replace(/assets\/([a-f0-9-]+)\.[a-z0-9]+/gi, (_full, id: string) => {
    return `asset://${id}`
  })
}
