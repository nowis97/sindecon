import JSZip from 'jszip'
import { db } from './db'
import type { NodeRow, ArticleRow, AssetRow } from './db'
import { deduplicateSystemNodes } from './nodes'
import { mergeDatabase, type DbSnapshot, type MergeReport } from '../domain/merge'
import { pathTo } from '../domain/tree'
import {
  buildFrontmatter,
  parseFrontmatter,
  sanitizeFileName,
  rewriteAssetRefsToRelative,
  rewriteRelativeRefsToAsset,
  mimeToExt,
  extToMime,
} from '../domain/exportmd'

// spec data-portability: el formato nace versionado para que el
// backup de hoy lo lea la app de mañana.
export const EXPORT_FORMAT_VERSION = 1

/** Id determinista para carpetas implícitas (zips editados a mano). */
export function idFromPath(path: string): string {
  let h = 0x811c9dc5
  const s = `folder:${path}`
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  const hex = (h >>> 0).toString(16).padStart(8, '0')
  return `imp-${hex}-0000-0000-${hex}${hex.slice(0, 4)}`
}

/** Ensambla el zip de export (sin generar el blob final). */
export async function buildExportZip(): Promise<JSZip> {
  const nodes = await db.nodes.toArray()
  const articles = await db.articles.toArray()
  const assets = await db.assets.toArray()
  const flashcards = await db.flashcards.toArray()
  const live = nodes.filter((n) => n.deleted_at === null)
  const articlesByNode = new Map(articles.map((a) => [a.node_id, a]))

  const zip = new JSZip()
  zip.file(
    '_manifest.json',
    JSON.stringify(
      { export_format_version: EXPORT_FORMAT_VERSION, exported_at: Date.now() },
      null,
      2,
    ),
  )
  zip.file(
    '_deleted.json',
    JSON.stringify(
      nodes
        .filter((n) => n.deleted_at !== null)
        .map((n) => ({ id: n.id, deleted_at: n.deleted_at })),
      null,
      2,
    ),
  )
  if (flashcards.length > 0) {
    zip.file('_flashcards.json', JSON.stringify(flashcards, null, 2))
  }

  // assets → archivos; mapa para reescribir asset:// en el markdown
  const assetFileName = new Map<string, string>()
  for (const a of assets) {
    const name = `assets/${a.id}.${mimeToExt(a.mime)}`
    zip.file(name, new Uint8Array(await a.blob.arrayBuffer()))
    assetFileName.set(a.id, name)
  }

  // Carpetas primero (padres antes que hijos), con rutas únicas.
  const dirOf = new Map<string, string>()
  const usedDirs = new Set<string>()
  const folders = live
    .filter((n) => n.kind === 'folder')
    .sort((a, b) => pathTo(live, a.id).length - pathTo(live, b.id).length)
  for (const f of folders) {
    const parentDir = f.parent_id ? (dirOf.get(f.parent_id) ?? '') : ''
    const base = sanitizeFileName(f.title)
    let dir = parentDir ? `${parentDir}/${base}` : base
    let i = 2
    while (usedDirs.has(dir)) {
      dir = `${parentDir ? `${parentDir}/` : ''}${base} (${i++})`
    }
    usedDirs.add(dir)
    dirOf.set(f.id, dir)
    zip.file(
      `${dir}/_folder.json`,
      JSON.stringify(
        {
          id: f.id,
          title: f.title,
          order: f.order,
          created_at: f.created_at,
          updated_at: f.updated_at,
          system: f.system,
        },
        null,
        2,
      ),
    )
  }

  // Artículos → .md con frontmatter, colisiones resueltas con (n).
  const usedFiles = new Set<string>()
  for (const a of live.filter((n) => n.kind === 'article')) {
    const dir = a.parent_id ? (dirOf.get(a.parent_id) ?? '') : ''
    const base = sanitizeFileName(a.title)
    let file = `${base}.md`
    let i = 2
    while (usedFiles.has(dir ? `${dir}/${file}` : file)) {
      file = `${base} (${i++}).md`
    }
    const full = dir ? `${dir}/${file}` : file
    usedFiles.add(full)
    const article = articlesByNode.get(a.id)
    const body = rewriteAssetRefsToRelative(article?.body_md ?? '', assetFileName)
    zip.file(
      full,
      buildFrontmatter({
        id: a.id,
        title: a.title,
        order: a.order,
        created_at: a.created_at,
        updated_at: a.updated_at,
        tags: article?.tags ?? [],
        system: a.system,
      }) +
        '\n' +
        body,
    )
  }

  return zip
}

export async function exportToZip(): Promise<Blob> {
  const zip = await buildExportZip()
  return zip.generateAsync({ type: 'blob' })
}

/** Import FUSIONANDO (nunca reemplaza). spec data-portability. */
export async function importFromZip(
  data: Blob | ArrayBuffer | Uint8Array,
): Promise<MergeReport> {
  const zip = await JSZip.loadAsync(data)

  const manifestFile = zip.file('_manifest.json')
  if (!manifestFile) throw new Error('No es un export válido (falta _manifest.json)')
  const manifest = JSON.parse(await manifestFile.async('string'))
  if (manifest.export_format_version !== EXPORT_FORMAT_VERSION) {
    throw new Error(
      `Versión de formato ${manifest.export_format_version} no soportada por esta app`,
    )
  }

  const incomingNodes: NodeRow[] = []
  const incomingArticles: ArticleRow[] = []
  const incomingAssets: AssetRow[] = []

  // 1) Tombstones del export (propagan eliminaciones).
  const deletedFile = zip.file('_deleted.json')
  if (deletedFile) {
    const tombstones: { id: string; deleted_at: number }[] = JSON.parse(
      await deletedFile.async('string'),
    )
    for (const t of tombstones) {
      incomingNodes.push({
        id: t.id,
        parent_id: null,
        kind: 'article',
        title: '',
        order: 0,
        system: null,
        created_at: t.deleted_at,
        updated_at: t.deleted_at,
        deleted_at: t.deleted_at,
      })
    }
  }

  // 2) Carpetas (padres antes que hijos por profundidad).
  const dirToId = new Map<string, string>()
  const ensureDir = (dir: string): string => {
    const known = dirToId.get(dir)
    if (known) return known
    const parentDir = dir.includes('/') ? dir.slice(0, dir.lastIndexOf('/')) : ''
    const parentId = parentDir === '' ? null : ensureDir(parentDir)
    const id = idFromPath(dir) // carpeta implícita: id estable por ruta
    dirToId.set(dir, id)
    incomingNodes.push({
      id,
      parent_id: parentId,
      kind: 'folder',
      title: dir.split('/').pop() ?? dir,
      order: 0,
      system: null,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
    })
    return id
  }

  const isFile = (p: string) => !zip.files[p].dir
  const folderPaths = Object.keys(zip.files)
    .filter((p) => isFile(p) && p.endsWith('/_folder.json'))
    .sort((a, b) => a.split('/').length - b.split('/').length)
  for (const path of folderPaths) {
    const meta = JSON.parse(await zip.file(path)!.async('string'))
    const dir = path.slice(0, -'/_folder.json'.length)
    const parentDir = dir.includes('/') ? dir.slice(0, dir.lastIndexOf('/')) : ''
    dirToId.set(dir, meta.id)
    incomingNodes.push({
      id: meta.id,
      parent_id: parentDir === '' ? null : ensureDir(parentDir),
      kind: 'folder',
      title: meta.title ?? dir.split('/').pop() ?? dir,
      order: meta.order ?? 0,
      system: meta.system ?? null,
      created_at: meta.created_at ?? meta.updated_at ?? 0,
      updated_at: meta.updated_at ?? 0,
      deleted_at: null,
    })
  }

  // 3) Artículos.
  const mdPaths = Object.keys(zip.files).filter(
    (p) => isFile(p) && p.endsWith('.md') && !p.startsWith('_'),
  )
  for (const path of mdPaths) {
    const raw = await zip.file(path)!.async('string')
    const { meta, body } = parseFrontmatter(raw)
    const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
    incomingNodes.push({
      id: meta.id,
      parent_id: dir === '' ? null : ensureDir(dir),
      kind: 'article',
      title: meta.title,
      order: meta.order,
      system: meta.system ?? null,
      created_at: meta.created_at,
      updated_at: meta.updated_at,
      deleted_at: null,
    })
    incomingArticles.push({
      node_id: meta.id,
      body_md: rewriteRelativeRefsToAsset(body),
      tags: meta.tags,
    })
  }

  // 4) Assets; el dueño se deduce de quién los referencia.
  const assetPaths = Object.keys(zip.files).filter((p) => isFile(p) && p.startsWith('assets/'))
  for (const path of assetPaths) {
    const name = path.slice('assets/'.length)
    const dot = name.lastIndexOf('.')
    const id = dot === -1 ? name : name.slice(0, dot)
    const ext = dot === -1 ? '' : name.slice(dot + 1)
    const mime = extToMime(ext)
    const buf = await zip.file(path)!.async('nodebuffer')
    incomingAssets.push({ id, node_id: '', blob: new Blob([new Uint8Array(buf)], { type: mime }), mime })
  }
  for (const asset of incomingAssets) {
    const owner = incomingArticles.find((a) => a.body_md.includes(`asset://${asset.id}`))
    asset.node_id = owner?.node_id ?? ''
  }

  // 5) Fusión y aplicación atómica.
  const local: DbSnapshot = {
    nodes: await db.nodes.toArray(),
    articles: await db.articles.toArray(),
    assets: await db.assets.toArray(),
  }
  const { result, report } = mergeDatabase(local, {
    nodes: incomingNodes,
    articles: incomingArticles,
    assets: incomingAssets,
  })
  await db.transaction('rw', [db.nodes, db.articles, db.assets], async () => {
    await db.nodes.bulkPut(result.nodes)
    await db.articles.bulkPut(result.articles)
    await db.assets.bulkPut(result.assets)
  })

  // 6) Flashcards opcionales.
  const flashcardsFile = zip.file('_flashcards.json')
  if (flashcardsFile) {
    try {
      const importedCards = JSON.parse(await flashcardsFile.async('string'))
      if (Array.isArray(importedCards) && importedCards.length > 0) {
        await db.flashcards.bulkPut(importedCards)
      }
    } catch (e) {
      console.warn('No se pudieron restaurar algunas flashcards del zip:', e)
    }
  }

  await deduplicateSystemNodes()
  return report
}
