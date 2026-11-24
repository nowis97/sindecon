import React, { useMemo, useState } from 'react'
import {
  Columns2,
  FileText,
  AlignJustify,
  AlignLeft,
  ListTree,
  Printer,
  FileOutput,
} from 'lucide-react'
import { MermaidViewer } from './MermaidViewer'
import { AssetImage } from './AssetImage'
import { PdfDocumentViewer } from './PdfDocumentViewer'
import { WIKI_LINK_REGEX } from '../../domain/wikiLinks'
import { stripOuterMarkdownFence } from '../../domain/smartImport'
import {
  matchNaturalPearlParagraph,
  normalizeCalloutMarkdownEscapes,
  resolveBracketCallout,
  type ResolvedBracketCallout,
} from '../../domain/callouts'

export interface ArticleReaderProps {
  markdown: string
  onWikiLinkClick: (uuid: string) => void
  onOpenExportPdf?: () => void
  onOpenExportGoogleDocs?: () => void
  isPrintView?: boolean
  articleTitle?: string
  folderPath?: string
  suppressDocHeader?: boolean
  hideReaderToolbar?: boolean
  externalIsTwoColumns?: boolean
  externalIsJustified?: boolean
}

export type CalloutKind =
  | 'warning'
  | 'tip'
  | 'dosage'
  | 'important'
  | 'note'
  | 'example'
  | 'definition'

export interface NestedListItem {
  text: string
  ordered: boolean
  children: NestedListItem[]
}

export type Block =
  | { type: 'header'; level: number; text: string; fullWidth?: boolean }
  | { type: 'mermaid'; code: string; fullWidth?: boolean }
  | { type: 'code'; lang: string; code: string; fullWidth?: boolean }
  | {
      type: 'table'
      headers: string[]
      rows: string[][]
      alignments?: ('left' | 'center' | 'right')[]
      fullWidth?: boolean
    }
  | { type: 'hr' }
  | { type: 'image'; alt: string; src: string; fullWidth?: boolean }
  | { type: 'pdf'; src: string; title?: string }
  | {
      type: 'list'
      items: NestedListItem[]
      ordered: boolean
      isBibliography?: boolean
      startNumber?: number
      fullWidth?: boolean
    }
  | {
      type: 'callout'
      kind: CalloutKind
      title: string
      text: string
      inlineFormat?: boolean
      hasCustomTitle?: boolean
      fullWidth?: boolean
    }
  | { type: 'blockquote'; text: string; fullWidth?: boolean }
  | { type: 'columns'; columns: Block[][]; fullWidth?: boolean }
  | {
      type: 'paragraph'
      text: string
      variant?: 'normal' | 'secondary' | 'caption' | 'bibliography' | 'subtitle'
      fullWidth?: boolean
    }

function pushResolvedCallout(blocks: Block[], resolved: ResolvedBracketCallout) {
  if (resolved.isSecondaryNote) {
    const noteContent = [
      resolved.hasCustomTitle ? resolved.title : '',
      resolved.text,
    ]
      .filter(Boolean)
      .join('\n')
    for (const para of noteContent.split(/\n+/).map((s) => s.trim()).filter(Boolean)) {
      blocks.push({
        type: 'paragraph',
        text: para,
        variant: 'secondary',
      })
    }
    return
  }

  blocks.push({
    type: 'callout',
    kind: resolved.kind,
    title: resolved.title,
    text: resolved.text,
    hasCustomTitle: resolved.hasCustomTitle,
  })
}

function isFigureCaptionLine(trimmed: string): boolean {
  return (
    /^\*{1,2}FIGURA(?:\s+\d+)?\s*:\*{1,2}/i.test(trimmed) ||
    /^\*{1,2}FIGURA(?:\s+\d+)?\*{1,2}\s*:/i.test(trimmed)
  )
}

function extractSubtitleMarker(trimmed: string): string | null {
  const m = trimmed.match(/^@SUBT[IÍ]TULO\s*:\s*(.*)$/i)
  return m ? m[1].trim() : null
}

function extractRefMarker(trimmed: string): string | null {
  const m = trimmed.match(/^(?:\*\*|\*)?REF(?:\*\*|\*)?\s*:\s*(?:\*\*|\*)?\s*(.+)$/i)
  return m ? m[1].trim() : null
}

export function matchNaturalCallout(trimmed: string): Block | null {
  const pearl = matchNaturalPearlParagraph(trimmed)
  if (pearl) {
    return {
      type: 'callout',
      kind: 'tip',
      title: pearl.title,
      text: pearl.text,
      hasCustomTitle: pearl.hasCustomTitle,
      inlineFormat: pearl.inlineFormat,
    }
  }

  const normalized = normalizeCalloutMarkdownEscapes(trimmed)
  const patterns: Array<{ regex: RegExp; kind: CalloutKind }> = [
    {
      regex: /^(?:\*\*|\*)?(Ejemplo\s+cl[ií]nico)(?:\*\*|\*)?\s*:\s*(?:\*\*|\*)?\s*(.+)$/i,
      kind: 'example',
    },
    {
      regex: /^(?:\*\*|\*)?(Advertencia)(?:\*\*|\*)?\s*:\s*(?:\*\*|\*)?\s*(.+)$/i,
      kind: 'warning',
    },
    {
      regex: /^(?:\*\*|\*)?(Definici[oó]n)(?:\*\*|\*)?\s*:\s*(?:\*\*|\*)?\s*(.+)$/i,
      kind: 'definition',
    },
  ]

  for (const { regex, kind } of patterns) {
    const m = normalized.match(regex)
    if (m) {
      return {
        type: 'callout',
        kind,
        title: `${m[1].trim()}:`,
        text: m[2].trim(),
        inlineFormat: true,
      }
    }
  }
  return null
}

export interface PreparedTemplateDocument {
  docTitle: string | null
  docSubtitle: string | null
  bodyBlocks: Block[]
}

function isSubtitleParagraph(block: Block | undefined): block is Extract<Block, { type: 'paragraph' }> {
  if (!block || block.type !== 'paragraph') return false
  if (block.variant === 'subtitle') return true
  return /(?:·|\|)\s*Apuntes\s+5to-2/i.test(block.text) || /^Asignatura\s*·/i.test(block.text.trim())
}

function normalizeCustomSubtitle(rawText: string, subjectText?: string): string | null {
  const trimmed = rawText.trim()
  if (!trimmed || /^Asignatura\s*·\s*Apuntes\s+5to-2$/i.test(trimmed)) {
    return null
  }
  return subjectText && /^Asignatura\s*·/i.test(trimmed)
    ? trimmed.replace(/^Asignatura/i, subjectText)
    : trimmed
}

/**
 * Prepara los bloques parseados para el layout de la plantilla Apuntes 5to-2:
 * - Promueve título (#) y subtítulo (@SUBTÍTULO:) iniciales al bloque de cabecera a 1 columna.
 * - Marca automáticamente tablas >= 3 columnas, diagramas Mermaid y secciones de ancho completo.
 * - Clasifica notas secundarias (> [!NOTA]), pies de imagen (*FIGURA:*) y referencias (REF: / Bibliografía).
 */
export function prepareTemplateDocument(
  blocks: Block[],
  articleTitle?: string,
  folderPath?: string,
): PreparedTemplateDocument {
  const subjectText = folderPath?.trim()

  if (blocks.length === 0) {
    return {
      docTitle: articleTitle?.trim() || null,
      docSubtitle: null,
      bodyBlocks: [],
    }
  }

  let startIndex = 0
  let docTitle: string | null = articleTitle?.trim() || null
  let docSubtitle: string | null = null

  const first = blocks[0]
  if (first && first.type === 'header' && first.level === 1) {
    const firstNorm = first.text.trim().toLowerCase()
    const propNorm = (articleTitle || '').trim().toLowerCase()
    const matchesProp = Boolean(propNorm && firstNorm === propNorm)
    const isTemplatePlaceholder =
      first.text.trim().toUpperCase() === 'TÍTULO DEL TEMA' ||
      first.text.trim().toLowerCase() === '{título}' ||
      first.text.trim().toLowerCase() === '{titulo}'
    const hasSubtitleNext = isSubtitleParagraph(blocks[1])
    const isSectionLikeTitle = /^(?:introducci[oó]n|tabla\b|continuaci[oó]n\b|bibliograf[ií]a|resumen)\b/i.test(
      first.text.trim(),
    )

    if (matchesProp || isTemplatePlaceholder || hasSubtitleNext || !isSectionLikeTitle) {
      docTitle =
        articleTitle?.trim() && isTemplatePlaceholder
          ? articleTitle.trim()
          : first.text.trim()
      startIndex = 1
    }
  }

  if (isSubtitleParagraph(blocks[startIndex])) {
    const rawSub = (blocks[startIndex] as Extract<Block, { type: 'paragraph' }>).text
    docSubtitle = normalizeCustomSubtitle(rawSub, subjectText)
    startIndex++
  }

  const enriched: Block[] = []
  let inFullWidthSection = false
  let inBibliographySection = false
  let bibCounter = 1

  for (const raw of blocks.slice(startIndex)) {
    const block: Block = { ...raw }

    if (block.type === 'header') {
      inFullWidthSection = /ancho\s+completo|full\s*width|1\s*col(?:umna)?/i.test(block.text)
      inBibliographySection = /^(?:bibliograf[ií]a|referencias(?:\s+bibliogr[aá]ficas)?|fuentes(?:\s+bibliogr[aá]ficas)?)(?:\s*:)?$/i.test(
        block.text.trim(),
      )
      if (inBibliographySection) {
        bibCounter = 1
      }
      if (inFullWidthSection) {
        block.fullWidth = true
      }
      enriched.push(block)
      continue
    }

    if (inFullWidthSection && block.type !== 'hr' && block.type !== 'pdf') {
      block.fullWidth = true
    }

    if (block.type === 'table') {
      const colCount = Math.max(block.headers.length, ...block.rows.map((r) => r.length), 0)
      if (colCount >= 3) {
        block.fullWidth = true
      }
    } else if (block.type === 'mermaid') {
      block.fullWidth = true
    } else if (block.type === 'paragraph') {
      const prev = enriched[enriched.length - 1]
      const isAfterVisual =
        prev && (prev.type === 'table' || prev.type === 'mermaid' || prev.type === 'image')
      const looksLikeCaption =
        block.variant === 'caption' ||
        /^(?:Tabla|Figura|Cuadro|Algoritmo|Esquema|Gr[aá]fico)\b/i.test(block.text.trim()) ||
        /^\*[^*]+\*$/.test(block.text.trim())

      if (block.variant === 'subtitle') {
        const normalizedSub = normalizeCustomSubtitle(block.text, subjectText)
        if (!normalizedSub) continue
        block.text = normalizedSub
      } else if (block.variant === 'bibliography') {
        // Marcador explícito REF: permanece en flujo de 2 columnas (llenando col 1 antes de pasar a col 2)
      } else if (block.variant === 'secondary') {
        // Marcador explícito > [!NOTA] preservado como nota secundaria
      } else if (block.variant === 'caption' || (isAfterVisual && looksLikeCaption)) {
        block.variant = 'caption'
        if (isAfterVisual && 'fullWidth' in prev && prev.fullWidth) {
          block.fullWidth = true
        }
      } else if (
        /^Nota\s+secundaria\s*:/i.test(block.text.trim()) ||
        /^Este bloque est[aá] en una sola columna/i.test(block.text.trim()) ||
        (inFullWidthSection && (!prev || prev.type === 'header'))
      ) {
        block.variant = 'secondary'
      } else if (inBibliographySection) {
        block.variant = 'bibliography'
      }
    } else if (block.type === 'list' && inBibliographySection) {
      block.isBibliography = true
      block.startNumber = bibCounter
      bibCounter += block.items.length
    }

    enriched.push(block)
  }

  return {
    docTitle,
    docSubtitle,
    bodyBlocks: enriched,
  }
}

function parseTableAlignment(cell: string): 'left' | 'center' | 'right' {
  const trimmed = cell.trim()
  if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center'
  if (trimmed.endsWith(':')) return 'right'
  if (trimmed.startsWith(':')) return 'left'
  return 'left'
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c.trim()))
}

function parseListTree(rawLines: Array<{ indent: number; text: string; ordered: boolean }>): NestedListItem[] {
  const items: NestedListItem[] = []
  const stack: Array<{ depth: number; children: NestedListItem[] }> = [{ depth: -1, children: items }]

  for (const line of rawLines) {
    const depth = Math.floor(line.indent / 2)
    const node: NestedListItem = { text: line.text, ordered: line.ordered, children: [] }

    while (stack.length > 1 && stack[stack.length - 1].depth >= depth) {
      stack.pop()
    }

    stack[stack.length - 1].children.push(node)
    stack.push({ depth, children: node.children })
  }

  return items
}

export function matchPdfBlock(trimmed: string): { src: string; title?: string } | null {
  const m1 = trimmed.match(/^!?\[pdf(?::\s*(.*?))?\]\((asset:\/\/[a-zA-Z0-9_-]+)\)$/i)
  if (m1) {
    return { src: m1[2], title: m1[1]?.trim() }
  }
  const m2 = trimmed.match(/^!?\[(.*?\.pdf)\]\((asset:\/\/[a-zA-Z0-9_-]+)\)$/i)
  if (m2) {
    return { src: m2[2], title: m2[1].trim() }
  }
  return null
}

export function parseMarkdownBlocks(md: string): Block[] {
  if (!md) return []
  // Normalizar tags <br /> / <br> generados por ProseMirror/Milkdown, espacios y caracteres escapados por Markdown serializer
  const unwrapped = stripOuterMarkdownFence(md)
  const normalizedMd = unwrapped
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\\+:/g, ':')
    .replace(/\\+\|/g, '|')
    .replace(/\\+\[/g, '[')
    .replace(/\\+\]/g, ']')
    .replace(/\\+(\r?\n)/g, '$1')
    .replace(/\\+([>@#\-*+])/g, '$1')
  const rawLines = normalizedMd.split(/\r?\n/)
  const blocks: Block[] = []
  let i = 0

  while (i < rawLines.length) {
    const line = rawLines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      i++
      continue
    }

    // 1. Bloques de código (Fenced Code Block) y diagramas Mermaid
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < rawLines.length && !rawLines[i].trim().startsWith('```')) {
        codeLines.push(rawLines[i])
        i++
      }
      i++ // Skip closing fence
      const fullCode = codeLines.join('\n')

      if (lang === 'mermaid') {
        blocks.push({ type: 'mermaid', code: fullCode })
      } else {
        blocks.push({ type: 'code', lang, code: fullCode })
      }
      continue
    }

    // 2. Regla horizontal
    if (/^(?:---|\*\*\*|___)$/.test(trimmed)) {
      blocks.push({ type: 'hr' })
      i++
      continue
    }

    // 3. Encabezados (# Título - #### Título 3)
    const headerMatch = trimmed.match(/^(#{1,6})\s+(.*)$/)
    if (headerMatch) {
      blocks.push({
        type: 'header',
        level: headerMatch[1].length,
        text: headerMatch[2],
      })
      i++
      continue
    }

    // 3b. Marcador explícito de Subtítulo (@SUBTÍTULO: ...)
    const subtitleMarker = extractSubtitleMarker(trimmed)
    if (subtitleMarker !== null) {
      blocks.push({
        type: 'paragraph',
        text: subtitleMarker,
        variant: 'subtitle',
      })
      i++
      continue
    }

    // 4. Documentos PDF standalone [pdf](asset://...) o ![pdf](asset://...)
    const pdfBlock = matchPdfBlock(trimmed)
    if (pdfBlock) {
      blocks.push({
        type: 'pdf',
        src: pdfBlock.src,
        title: pdfBlock.title,
      })
      i++
      continue
    }

    // 5. Imágenes standalone ![alt](src)
    const imgMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/)
    if (imgMatch) {
      blocks.push({
        type: 'image',
        alt: imgMatch[1],
        src: imgMatch[2],
      })
      i++
      continue
    }

    // 5. Callouts y Blockquotes (> [!TYPE] Title, > [!PERLA: Nombre], > [!Nombre] o directos [!TYPE])
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = []
      while (i < rawLines.length && rawLines[i].trim().startsWith('>')) {
        if (quoteLines.length > 0 && /^>\s*\[![^\]]+\]/.test(rawLines[i].trim())) {
          break
        }
        quoteLines.push(rawLines[i].trim().replace(/^>\s?/, ''))
        i++
      }
      const [firstQuoteLine = '', ...restQuoteLines] = quoteLines
      const resolvedCallout = resolveBracketCallout(firstQuoteLine, restQuoteLines)

      if (resolvedCallout) {
        pushResolvedCallout(blocks, resolvedCallout)
      } else {
        blocks.push({
          type: 'blockquote',
          text: quoteLines.join('\n'),
        })
      }
      continue
    }

    if (/^\[![^\]]+\]/.test(trimmed)) {
      const firstLine = trimmed
      const bodyLines: string[] = []
      i++
      while (i < rawLines.length) {
        const nextTrimmed = rawLines[i].trim()
        if (
          !nextTrimmed &&
          i + 1 < rawLines.length &&
          (!rawLines[i + 1].trim() ||
            /^#{1,6}\s+/.test(rawLines[i + 1].trim()) ||
            /^\[![^\]]+\]/.test(rawLines[i + 1].trim()) ||
            rawLines[i + 1].trim().startsWith(':::') ||
            rawLines[i + 1].trim().startsWith('```') ||
            rawLines[i + 1].trim().startsWith('>'))
        ) {
          break
        }
        if (
          /^#{1,6}\s+/.test(nextTrimmed) ||
          /^\[![^\]]+\]/.test(nextTrimmed) ||
          nextTrimmed.startsWith(':::') ||
          nextTrimmed.startsWith('```') ||
          nextTrimmed.startsWith('---') ||
          nextTrimmed.startsWith('>')
        ) {
          break
        }
        if (nextTrimmed) {
          bodyLines.push(nextTrimmed)
        }
        i++
      }

      const resolvedCallout = resolveBracketCallout(firstLine, bodyLines)
      if (resolvedCallout) {
        pushResolvedCallout(blocks, resolvedCallout)
        continue
      }
    }

    // 6a. Bloques a ancho completo (:::ancho-completo / :::fullwidth)
    if (/^[-*+\s]*\\*:::\s*(?:ancho[-_\s]*completo|full[-_\s]*width|1\s*col(?:umna)?)$/i.test(trimmed)) {
      i++
      const innerLines: string[] = []
      while (i < rawLines.length) {
        const currLine = rawLines[i]
        const currTrimmed = currLine.trim().replace(/^[-*+]\s+/, '')
        if (
          currTrimmed === ':::' ||
          currTrimmed === '\\:\\:\\:' ||
          /^\\*:::\s*(?:ancho[-_\s]*completo|full[-_\s]*width|1\s*col(?:umna)?)?$/i.test(currTrimmed)
        ) {
          i++
          break
        }
        innerLines.push(currLine)
        i++
      }
      const innerBlocks = parseMarkdownBlocks(innerLines.join('\n'))
      for (const ib of innerBlocks) {
        if (ib.type !== 'hr' && ib.type !== 'pdf') {
          blocks.push({ ...ib, fullWidth: true })
        } else {
          blocks.push(ib)
        }
      }
      continue
    }

    // 6. Bloques multicolumna (:::columns, :::columnas, :::col, :::2cols, etc., con separadores |||)
    if (/^[-*+\s]*\\*:::\s*(?:columns?|columnas?|cols?|\d+\s*cols?|\d+\s*columnas?)/i.test(trimmed)) {
      i++ // saltar línea de apertura
      const columnRawSections: string[][] = [[]]
      let currentColIndex = 0

      while (i < rawLines.length) {
        const currLine = rawLines[i]
        const currTrimmed = currLine.trim().replace(/^[-*+]\s+/, '')

        if (
          currTrimmed === ':::' ||
          currTrimmed === '\\:\\:\\:' ||
          /^\\*:::\s*(?:columns?|columnas?|cols?|columnas?)?$/i.test(currTrimmed)
        ) {
          i++ // saltar línea de cierre
          break
        }

        if (
          /^\\*\|{2,4}\\*$/.test(currTrimmed) ||
          currTrimmed === '|||' ||
          currTrimmed === '\\|\\|\\|' ||
          currTrimmed === '||' ||
          currTrimmed === '\\|\\|'
        ) {
          currentColIndex++
          columnRawSections[currentColIndex] = []
          i++
          continue
        }

        columnRawSections[currentColIndex].push(currLine)
        i++
      }

      // Parsear recursivamente cada columna
      const parsedColumns: Block[][] = columnRawSections
        .map((lines) => parseMarkdownBlocks(lines.join('\n')))
        .filter((colBlocks) => colBlocks.length > 0)

      if (parsedColumns.length > 0) {
        blocks.push({
          type: 'columns',
          columns: parsedColumns,
        })
      }
      continue
    }

    // 7. Tablas GFM
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2) {
      const tableLines: string[] = []
      while (
        i < rawLines.length &&
        rawLines[i].trim().startsWith('|') &&
        rawLines[i].trim().endsWith('|')
      ) {
        tableLines.push(rawLines[i].trim())
        i++
      }

      if (tableLines.length >= 2) {
        const headerCells = tableLines[0].slice(1, -1).split('|').map((c) => c.trim())
        const sepCells = tableLines[1].slice(1, -1).split('|').map((c) => c.trim())

        if (isSeparatorRow(sepCells)) {
          const alignments = sepCells.map(parseTableAlignment)
          const rows = tableLines.slice(2).map((rowLine) =>
            rowLine.slice(1, -1).split('|').map((c) => c.trim())
          )
          blocks.push({
            type: 'table',
            headers: headerCells,
            rows,
            alignments,
          })
          continue
        }

        const parsedRows = tableLines.slice(1).map((rowLine) =>
          rowLine.slice(1, -1).split('|').map((c) => c.trim())
        )
        if (headerCells.length >= 2 && parsedRows.every((r) => r.length === headerCells.length)) {
          blocks.push({
            type: 'table',
            headers: headerCells,
            rows: parsedRows,
          })
          continue
        }
      }

      for (const tl of tableLines) {
        blocks.push({ type: 'paragraph', text: tl })
      }
      continue
    }

    // 8. Listas (Ordenadas y Desordenadas con soporte de anidación)
    const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/)
    if (listMatch) {
      const rawListLines: Array<{ indent: number; text: string; ordered: boolean }> = []
      const isInitialOrdered = /^\d+\./.test(listMatch[2])

      while (i < rawLines.length) {
        const currLine = rawLines[i]
        const currMatch = currLine.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/)
        if (!currMatch) break

        const indent = currMatch[1].length
        const isOrdered = /^\d+\./.test(currMatch[2])
        rawListLines.push({
          indent,
          text: currMatch[3],
          ordered: isOrdered,
        })
        i++
      }

      const items = parseListTree(rawListLines)
      blocks.push({
        type: 'list',
        items,
        ordered: isInitialOrdered,
      })
      continue
    }

    // 9. Párrafos con estilo de callout natural (Ejemplo clínico:, Perla clínica:, Advertencia:, Definición:)
    const naturalCallout = matchNaturalCallout(trimmed)
    if (naturalCallout) {
      blocks.push(naturalCallout)
      i++
      continue
    }

    // 9b. Pies de imagen explícitos (*FIGURA:* ...) y referencias explícitas (REF: ...)
    if (isFigureCaptionLine(trimmed)) {
      blocks.push({
        type: 'paragraph',
        text: trimmed,
        variant: 'caption',
      })
      i++
      continue
    }

    const refText = extractRefMarker(trimmed)
    if (refText !== null) {
      blocks.push({
        type: 'paragraph',
        text: refText,
        variant: 'bibliography',
      })
      i++
      continue
    }

    // 10. Párrafo estándar
    blocks.push({
      type: 'paragraph',
      text: trimmed,
    })
    i++
  }

  return blocks
}

/**
 * Agrupa los bloques en hojas continuas estilo A4.
 * Cada regla horizontal (Block.type === 'hr') actúa como delimitador de salto de página.
 */
export function partitionBlocksIntoSheets(blocks: Block[]): Block[][] {
  if (blocks.length === 0) return [[]]
  const sheets: Block[][] = [[]]
  for (const block of blocks) {
    if (block.type === 'hr') {
      sheets.push([])
    } else {
      sheets[sheets.length - 1].push(block)
    }
  }
  const filtered = sheets.filter((sheet, idx) => sheet.length > 0 || idx === 0)
  return filtered.length > 0 ? filtered : [[]]
}

/**
 * Estima la altura visual aproximada (en píxeles) de un bloque en 2 columnas en formato A4.
 */
export function estimateBlockHeight(block: Block): number {
  switch (block.type) {
    case 'header':
      if (block.level === 1) return 46
      if (block.level === 2) return 36
      return 28
    case 'paragraph': {
      const lines = Math.max(1, Math.ceil(block.text.length / 50))
      return lines * 19 + 6
    }
    case 'blockquote': {
      const lines = Math.max(1, Math.ceil(block.text.length / 46))
      return lines * 19 + 12
    }
    case 'list': {
      const countItems = (items: typeof block.items): number =>
        items.reduce((acc, item) => {
          const lines = Math.max(1, Math.ceil((item.text?.length || 20) / 46))
          const itemH = lines * 19 + 4
          return acc + itemH + countItems(item.children)
        }, 0)
      return countItems(block.items) + 8
    }
    case 'callout': {
      const titleLines = Math.max(1, Math.ceil(block.title.length / 46))
      const textLines = Math.max(1, Math.ceil(block.text.length / 46))
      return (titleLines + textLines) * 19 + 24
    }
    case 'table': {
      const rowsCount = block.rows.length + 1
      return rowsCount * 28 + 14
    }
    case 'code': {
      const lines = block.code.split('\n').length
      return lines * 19 + 20
    }
    case 'mermaid':
      return 240
    case 'image':
      return 200
    case 'pdf':
      return 350
    case 'columns': {
      const maxColHeight = block.columns.reduce((max, col) => {
        const colH = col.reduce((sum, b) => sum + estimateBlockHeight(b), 0)
        return Math.max(max, colH)
      }, 0)
      return maxColHeight + 16
    }
    case 'hr':
      return 0
    default:
      return 24
  }
}

export const A4_TWO_COLUMN_CAPACITY_PX = 2100

type EditorialUnit =
  | { kind: 'hr'; blocks: [Extract<Block, { type: 'hr' }>] }
  | {
      kind: 'image-figure'
      blocks: Block[]
      image: Extract<Block, { type: 'image' }>
      caption?: Extract<Block, { type: 'paragraph' }>
    }
  | { kind: 'fullwidth'; blocks: Block[] }
  | { kind: 'flow'; blocks: [Block] }

interface TwoColumnBand {
  kind: 'flow' | 'full' | 'solo-figure'
  units: EditorialUnit[]
}

function isFullWidthVisualBlock(block: Block): boolean {
  if ('fullWidth' in block && block.fullWidth) return true
  if (block.type === 'mermaid' || block.type === 'columns') return true
  if (block.type === 'table') {
    const colCount = Math.max(block.headers.length, ...block.rows.map((r) => r.length), 0)
    if (colCount >= 3) return true
  }
  return false
}

function isCaptionParagraph(block: Block | undefined): block is Extract<Block, { type: 'paragraph' }> {
  return Boolean(block && block.type === 'paragraph' && block.variant === 'caption')
}

function isShortLeadInParagraph(block: Block | undefined): block is Extract<Block, { type: 'paragraph' }> {
  if (!block || block.type !== 'paragraph') return false
  if (block.variant === 'caption' || block.variant === 'bibliography' || block.variant === 'subtitle') {
    return false
  }
  return block.variant === 'secondary' || block.text.length <= 320
}

/**
 * Agrupa bloques relacionados en unidades editoriales atómicas:
 * - Empareja imagen + leyenda (`caption`) en una sola `<figure>` inseparable.
 * - Mantiene el encabezado (`<h2>`/`<h3>`) e intro breve pegados al bloque `fullWidth` (Mermaid / tabla ancha / `:::columns`) al que introducen.
 */
export function groupEditorialUnits(blocks: Block[]): EditorialUnit[] {
  const units: EditorialUnit[] = []
  let i = 0

  while (i < blocks.length) {
    const curr = blocks[i]

    if (curr.type === 'hr') {
      units.push({ kind: 'hr', blocks: [curr] })
      i++
      continue
    }

    if (curr.type === 'image') {
      const next = blocks[i + 1]
      const caption = isCaptionParagraph(next) ? next : undefined
      if (curr.fullWidth) {
        units.push({
          kind: 'fullwidth',
          blocks: caption ? [curr, caption] : [curr],
        })
      } else {
        units.push({
          kind: 'image-figure',
          blocks: caption ? [curr, caption] : [curr],
          image: curr,
          caption,
        })
      }
      i += caption ? 2 : 1
      continue
    }

    if (isFullWidthVisualBlock(curr)) {
      // Un encabezado con `fullWidth: true` (ej. sección `:::ancho-completo`) solo agrupa si lleva visual tras él
      if (curr.type === 'header') {
        const next1 = blocks[i + 1]
        const next2 = blocks[i + 2]
        if (next1 && isFullWidthVisualBlock(next1) && next1.type !== 'header') {
          const cap = isCaptionParagraph(blocks[i + 2]) ? (blocks[i + 2] as Extract<Block, { type: 'paragraph' }>) : undefined
          units.push({
            kind: 'fullwidth',
            blocks: cap ? [curr, next1, cap] : [curr, next1],
          })
          i += cap ? 3 : 2
          continue
        }
        if (isShortLeadInParagraph(next1) && next2 && isFullWidthVisualBlock(next2) && next2.type !== 'header') {
          const cap = isCaptionParagraph(blocks[i + 3]) ? (blocks[i + 3] as Extract<Block, { type: 'paragraph' }>) : undefined
          units.push({
            kind: 'fullwidth',
            blocks: cap ? [curr, next1, next2, cap] : [curr, next1, next2],
          })
          i += cap ? 4 : 3
          continue
        }
        units.push({ kind: 'fullwidth', blocks: [curr] })
        i++
        continue
      }

      const next = blocks[i + 1]
      const cap = isCaptionParagraph(next) ? next : undefined
      units.push({
        kind: 'fullwidth',
        blocks: cap ? [curr, cap] : [curr],
      })
      i += cap ? 2 : 1
      continue
    }

    if (curr.type === 'header') {
      const next1 = blocks[i + 1]
      const next2 = blocks[i + 2]
      if (next1 && isFullWidthVisualBlock(next1) && next1.type !== 'header') {
        const cap = isCaptionParagraph(next2) ? next2 : undefined
        units.push({
          kind: 'fullwidth',
          blocks: cap ? [curr, next1, cap] : [curr, next1],
        })
        i += cap ? 3 : 2
        continue
      }
      if (isShortLeadInParagraph(next1) && next2 && isFullWidthVisualBlock(next2) && next2.type !== 'header') {
        const cap = isCaptionParagraph(blocks[i + 3]) ? (blocks[i + 3] as Extract<Block, { type: 'paragraph' }>) : undefined
        units.push({
          kind: 'fullwidth',
          blocks: cap ? [curr, next1, next2, cap] : [curr, next1, next2],
        })
        i += cap ? 4 : 3
        continue
      }
    }

    units.push({ kind: 'flow', blocks: [curr] })
    i++
  }

  return units
}

function estimateTwoColUnitBudget(unit: EditorialUnit): number {
  if (unit.kind === 'hr') return 0
  if (unit.kind === 'image-figure') {
    const imgCost = Math.min(310, estimateBlockHeight(unit.image))
    const capCost = unit.caption ? estimateBlockHeight(unit.caption) : 0
    return imgCost + capCost
  }
  if (unit.kind === 'fullwidth') {
    return unit.blocks.reduce((sum, b) => {
      if (b.type === 'mermaid') {
        const lines = Math.max(4, b.code.split('\n').length)
        const cardH = Math.min(430, Math.max(240, lines * 26 + 80))
        return sum + cardH * 2
      }
      if (b.type === 'table') {
        const rowsCount = b.rows.length + 1
        return sum + (rowsCount * 26 + 34) * 2
      }
      if (b.type === 'columns') {
        return sum + estimateBlockHeight(b) * 2
      }
      if (b.type === 'image') {
        return sum + 320 * 2
      }
      return sum + Math.ceil(estimateBlockHeight(b) * 1.15)
    }, 0)
  }
  return estimateBlockHeight(unit.blocks[0])
}

export function buildTwoColumnBands(sheetBlocks: Block[]): TwoColumnBand[] {
  const units = groupEditorialUnits(sheetBlocks)
  const rawBands: TwoColumnBand[] = []

  for (const unit of units) {
    if (unit.kind === 'hr') continue
    if (unit.kind === 'fullwidth') {
      rawBands.push({ kind: 'full', units: [unit] })
    } else {
      const last = rawBands[rawBands.length - 1]
      if (last && last.kind === 'flow') {
        last.units.push(unit)
      } else {
        rawBands.push({ kind: 'flow', units: [unit] })
      }
    }
  }

  return rawBands.map((band) => {
    if (band.kind === 'flow' && band.units.length === 1 && band.units[0].kind === 'image-figure') {
      return { kind: 'solo-figure', units: band.units }
    }
    return band
  })
}

/**
 * Pagina los bloques en hojas discretas estilo A4 para el modo a dos columnas.
 * Mantiene juntas las unidades atómicas (imagen + leyenda, encabezado + bloque ancho)
 * y contabiliza el ancho doble (2x) de bloques a ancho completo sobre la capacidad A4.
 */
export function paginateTwoColumnBlocks(
  blocks: Block[],
  capacityPx = A4_TWO_COLUMN_CAPACITY_PX,
): Block[][] {
  if (blocks.length === 0) return [[]]

  const units = groupEditorialUnits(blocks)
  const sheets: Block[][] = []
  let currentSheet: Block[] = []
  let currentSheetHeight = 0

  for (const unit of units) {
    if (unit.kind === 'hr') {
      if (currentSheet.length > 0) {
        sheets.push(currentSheet)
        currentSheet = []
        currentSheetHeight = 0
      }
      continue
    }

    const unitHeight = estimateTwoColUnitBudget(unit)

    if (currentSheet.length === 0 || currentSheetHeight + unitHeight <= capacityPx) {
      currentSheet.push(...unit.blocks)
      currentSheetHeight += unitHeight
    } else {
      sheets.push(currentSheet)
      currentSheet = [...unit.blocks]
      currentSheetHeight = unitHeight
    }
  }

  if (currentSheet.length > 0 || sheets.length === 0) {
    sheets.push(currentSheet)
  }

  return sheets
}

function renderFormattedInline(
  text: string,
  onWikiLinkClick: (uuid: string) => void
): React.ReactNode {
  const parts: React.ReactNode[] = []
  let lastIndex = 0

  // 1. Reemplazar enlaces internos wiki [[uuid|Título]] o [[uuid]]
  const matches = [...text.matchAll(new RegExp(WIKI_LINK_REGEX, 'g'))]

  for (const match of matches) {
    const matchIndex = match.index ?? 0
    if (matchIndex > lastIndex) {
      parts.push(
        <span key={`txt-${lastIndex}`}>
          {renderBasicFormatting(text.slice(lastIndex, matchIndex))}
        </span>
      )
    }

    const uuid = match[1]
    const label = match[2] || uuid
    parts.push(
      <a
        key={`wiki-${matchIndex}`}
        className="wiki-link"
        href={`#${uuid}`}
        onClick={(e) => {
          e.preventDefault()
          onWikiLinkClick(uuid)
        }}
      >
        {label}
      </a>
    )
    lastIndex = matchIndex + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push(
      <span key={`txt-${lastIndex}`}>
        {renderBasicFormatting(text.slice(lastIndex))}
      </span>
    )
  }

  return <>{parts}</>
}

function renderBasicFormatting(segment: string): React.ReactNode {
  const tokens = segment.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g)
  return (
    <>
      {tokens.map((tok, idx) => {
        if (tok.startsWith('**') && tok.endsWith('**') && tok.length >= 4) {
          return <strong key={idx}>{tok.slice(2, -2)}</strong>
        }
        if (tok.startsWith('*') && tok.endsWith('*') && tok.length >= 2) {
          return <em key={idx}>{tok.slice(1, -1)}</em>
        }
        if (tok.startsWith('`') && tok.endsWith('`') && tok.length >= 2) {
          return (
            <code key={idx} className="reader-code-inline">
              {tok.slice(1, -1)}
            </code>
          )
        }
        return tok
      })}
    </>
  )
}

function renderListItems(
  items: NestedListItem[],
  onWikiLinkClick: (uuid: string) => void
): React.ReactNode {
  return items.map((item, idx) => {
    const childOrdered = item.children[0]?.ordered
    const ChildTag = childOrdered ? 'ol' : 'ul'
    return (
      <li key={idx} className="reader-list-item">
        <span>{renderFormattedInline(item.text, onWikiLinkClick)}</span>
        {item.children.length > 0 && (
          <ChildTag className="reader-list-nested">
            {renderListItems(item.children, onWikiLinkClick)}
          </ChildTag>
        )}
      </li>
    )
  })
}

function getCalloutIcon(kind: CalloutKind) {
  switch (kind) {
    case 'warning':
      return '🚨'
    case 'tip':
      return '💡'
    case 'dosage':
      return '💊'
    case 'important':
      return '📋'
    case 'example':
      return '🩺'
    case 'definition':
      return '📘'
    case 'note':
      return 'ℹ️'
  }
}

function renderCalloutBody(
  text: string,
  onWikiLinkClick: (uuid: string) => void,
): React.ReactNode {
  const lines = text.split('\n').filter((l) => l.trim().length > 0)
  const nodes: React.ReactNode[] = []
  let idx = 0

  while (idx < lines.length) {
    const trimmed = lines[idx].trim()
    const bulletMatch = trimmed.match(/^[-*+]\s+(.*)$/)
    const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/)

    if (bulletMatch || orderedMatch) {
      const isOrdered = Boolean(orderedMatch)
      const listItems: string[] = []
      while (idx < lines.length) {
        const curr = lines[idx].trim()
        const m = isOrdered ? curr.match(/^\d+\.\s+(.*)$/) : curr.match(/^[-*+]\s+(.*)$/)
        if (!m) break
        listItems.push(m[1])
        idx++
      }
      const ListTag = isOrdered ? 'ol' : 'ul'
      nodes.push(
        <ListTag key={`list-${idx}`} className="callout-list">
          {listItems.map((item, itemIdx) => (
            <li key={itemIdx}>{renderFormattedInline(item, onWikiLinkClick)}</li>
          ))}
        </ListTag>,
      )
      continue
    }

    nodes.push(
      <p key={`p-${idx}`} className="callout-paragraph">
        {renderFormattedInline(lines[idx], onWikiLinkClick)}
      </p>,
    )
    idx++
  }

  return nodes
}

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function renderBlock(
  block: Block,
  key: string | number,
  onWikiLinkClick: (uuid: string) => void,
  articleTitle?: string,
  isPrintView: boolean = false,
): React.ReactNode {
  const fullWidthClass = 'fullWidth' in block && block.fullWidth ? ' full-width-block' : ''

  switch (block.type) {
    case 'header': {
      const Tag = `h${Math.min(block.level, 6)}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
      const anchorId = `reader-sec-${slugifyHeading(block.text)}`
      return (
        <Tag
          key={key}
          id={anchorId}
          className={`reader-heading h${block.level}${fullWidthClass} scroll-mt-24`}
        >
          {renderFormattedInline(block.text, onWikiLinkClick)}
        </Tag>
      )
    }
    case 'hr':
      return <hr key={key} className="reader-hr" />
    case 'callout': {
      const isApuntesCallout =
        block.inlineFormat ||
        (!block.hasCustomTitle &&
          (block.kind === 'example' ||
            block.kind === 'tip' ||
            block.kind === 'warning' ||
            block.kind === 'definition'))

      if (isApuntesCallout) {
        const paragraphs = block.text ? block.text.split('\n') : []
        const firstLine = paragraphs[0] ?? ''
        const firstStartsWithList = /^(?:[-*+]|\d+\.)\s+/.test(firstLine.trim())
        const rest = paragraphs.slice(1)
        const normalizedTitle = block.title
          ? block.title.endsWith(':')
            ? block.title
            : `${block.title}:`
          : ''

        if (firstStartsWithList) {
          return (
            <div
              key={key}
              className={`reader-callout callout-${block.kind} callout-apuntes${fullWidthClass}`}
            >
              {normalizedTitle && (
                <p className="callout-paragraph">
                  <strong className="callout-inline-title">
                    {renderFormattedInline(normalizedTitle, onWikiLinkClick)}
                  </strong>
                </p>
              )}
              <div className="callout-body">
                {renderCalloutBody(block.text, onWikiLinkClick)}
              </div>
            </div>
          )
        }

        return (
          <div
            key={key}
            className={`reader-callout callout-${block.kind} callout-apuntes${fullWidthClass}`}
          >
            <p className="callout-paragraph">
              {normalizedTitle && (
                <strong className="callout-inline-title">
                  {renderFormattedInline(normalizedTitle, onWikiLinkClick)}
                  {firstLine ? ' ' : ''}
                </strong>
              )}
              {firstLine && renderFormattedInline(firstLine, onWikiLinkClick)}
            </p>
            {rest.length > 0 && renderCalloutBody(rest.join('\n'), onWikiLinkClick)}
          </div>
        )
      }

      return (
        <div key={key} className={`reader-callout callout-${block.kind}${fullWidthClass}`}>
          <div className="callout-header">
            <span className="callout-icon">{getCalloutIcon(block.kind)}</span>
            <strong className="callout-title">
              {renderFormattedInline(block.title, onWikiLinkClick)}
            </strong>
          </div>
          {block.text && (
            <div className="callout-body">
              {renderCalloutBody(block.text, onWikiLinkClick)}
            </div>
          )}
        </div>
      )
    }
    case 'blockquote':
      return (
        <blockquote key={key} className={`reader-blockquote${fullWidthClass}`}>
          {block.text.split('\n').map((p, pIdx) => (
            <p key={pIdx}>{renderFormattedInline(p, onWikiLinkClick)}</p>
          ))}
        </blockquote>
      )
    case 'mermaid':
      return (
        <MermaidViewer
          key={key}
          code={block.code}
          isPrintView={isPrintView}
          className={block.fullWidth ? 'full-width-block' : ''}
        />
      )
    case 'code':
      return (
        <pre key={key} className={`reader-code-block${fullWidthClass}`}>
          <code className={block.lang ? `language-${block.lang}` : ''}>{block.code}</code>
        </pre>
      )
    case 'table': {
      const colCount = Math.max(block.headers.length, ...block.rows.map((r) => r.length), 0)
      const isWide = colCount >= 3 || Boolean(block.fullWidth)
      const isExtraWide = colCount >= 5
      return (
        <div
          key={key}
          className={`reader-table-container reader-table-wrapper ${isWide ? 'table-wide full-width-block' : ''} ${isExtraWide ? 'table-extra-wide' : ''}${!isWide ? fullWidthClass : ''}`}
        >
          <table className="reader-table">
            <thead>
              <tr>
                {block.headers.map((h, hIdx) => (
                  <th
                    key={hIdx}
                    style={{
                      textAlign: block.alignments ? block.alignments[hIdx] : 'left',
                    }}
                  >
                    {renderFormattedInline(h, onWikiLinkClick)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((cell, cIdx) => (
                    <td
                      key={cIdx}
                      style={{
                        textAlign: block.alignments ? block.alignments[cIdx] : 'left',
                      }}
                    >
                      {renderFormattedInline(cell, onWikiLinkClick)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }
    case 'image':
      return (
        <AssetImage
          key={key}
          src={block.src}
          alt={block.alt}
          className={block.fullWidth ? 'full-width-block' : ''}
        />
      )
    case 'pdf':
      return (
        <PdfDocumentViewer
          key={key}
          src={block.src}
          title={block.title || articleTitle}
        />
      )
    case 'list': {
      if (block.isBibliography) {
        const startNum = block.startNumber ?? 1
        return (
          <div key={key} className={`reader-bibliography-list${fullWidthClass}`}>
            {block.items.map((item, idx) => (
              <p key={idx} className="reader-bibliography-item">
                <span className="reader-bib-num">{startNum + idx}.</span>{' '}
                <span>{renderFormattedInline(item.text, onWikiLinkClick)}</span>
              </p>
            ))}
          </div>
        )
      }
      const ListTag = block.ordered ? 'ol' : 'ul'
      return (
        <ListTag key={key} className={`reader-list${fullWidthClass}`}>
          {renderListItems(block.items, onWikiLinkClick)}
        </ListTag>
      )
    }
    case 'columns': {
      const colCount = Math.min(Math.max(block.columns.length, 1), 4)
      return (
        <div
          key={key}
          className={`article-columns-grid cols-${colCount}${fullWidthClass}`}
          style={{ '--col-count': colCount } as React.CSSProperties}
        >
          {block.columns.map((colBlocks, colIdx) => (
            <div key={colIdx} className="article-column-item">
              {groupEditorialUnits(colBlocks).map((unit, unitIdx) =>
                renderEditorialUnit(unit, `${key}-${colIdx}-${unitIdx}`, onWikiLinkClick, articleTitle, isPrintView),
              )}
            </div>
          ))}
        </div>
      )
    }
    case 'paragraph': {
      if (block.variant === 'caption') {
        return (
          <p key={key} className={`reader-caption${fullWidthClass}`}>
            {renderFormattedInline(block.text, onWikiLinkClick)}
          </p>
        )
      }
      if (block.variant === 'secondary') {
        return (
          <p key={key} className={`reader-secondary-note${fullWidthClass}`}>
            {renderFormattedInline(block.text, onWikiLinkClick)}
          </p>
        )
      }
      if (block.variant === 'subtitle') {
        return (
          <p key={key} className="reader-doc-subtitle full-width-block">
            {renderFormattedInline(block.text, onWikiLinkClick)}
          </p>
        )
      }
      if (block.variant === 'bibliography') {
        return (
          <p key={key} className={`reader-bibliography-item${fullWidthClass}`}>
            {renderFormattedInline(block.text, onWikiLinkClick)}
          </p>
        )
      }
      return (
        <p key={key} className={`reader-paragraph${fullWidthClass}`}>
          {renderFormattedInline(block.text, onWikiLinkClick)}
        </p>
      )
    }
    default:
      return null
  }
}

function renderEditorialUnit(
  unit: EditorialUnit,
  key: string | number,
  onWikiLinkClick: (uuid: string) => void,
  articleTitle?: string,
  isPrintView: boolean = false,
): React.ReactNode {
  if (unit.kind === 'hr') {
    return renderBlock(unit.blocks[0], key, onWikiLinkClick, articleTitle, isPrintView)
  }

  if (unit.kind === 'image-figure') {
    const captionNode = unit.caption
      ? renderFormattedInline(unit.caption.text, onWikiLinkClick)
      : undefined
    return (
      <AssetImage
        key={key}
        src={unit.image.src}
        alt={unit.image.alt}
        caption={captionNode}
        className={unit.image.fullWidth ? 'full-width-block' : ''}
      />
    )
  }

  if (unit.kind === 'fullwidth') {
    if (unit.blocks.length === 1) {
      const b = unit.blocks[0]
      if (b.type === 'image') {
        return (
          <AssetImage
            key={key}
            src={b.src}
            alt={b.alt}
            className="full-width-block"
          />
        )
      }
      return renderBlock(b, `${key}-0`, onWikiLinkClick, articleTitle, isPrintView)
    }

    // Agrupa visual ancho + caption (o heading introductorio) en bloque atómico
    const first = unit.blocks[0]
    const second = unit.blocks[1]
    if (first.type === 'image' && isCaptionParagraph(second)) {
      return (
        <AssetImage
          key={key}
          src={first.src}
          alt={first.alt}
          caption={renderFormattedInline(second.text, onWikiLinkClick)}
          className="full-width-block"
        />
      )
    }

    if (isPrintView) {
      return (
        <div key={key} className="reader-print-fullwidth-group full-width-block">
          {unit.blocks.map((b, bIdx) =>
            renderBlock(b, `${key}-${bIdx}`, onWikiLinkClick, articleTitle, isPrintView),
          )}
        </div>
      )
    }

    return (
      <React.Fragment key={key}>
        {unit.blocks.map((b, bIdx) =>
          renderBlock(b, `${key}-${bIdx}`, onWikiLinkClick, articleTitle, isPrintView),
        )}
      </React.Fragment>
    )
  }

  return renderBlock(unit.blocks[0], key, onWikiLinkClick, articleTitle, isPrintView)
}

export function ArticleReader({
  markdown,
  onWikiLinkClick,
  onOpenExportPdf,
  onOpenExportGoogleDocs,
  isPrintView = false,
  articleTitle,
  folderPath,
  suppressDocHeader = false,
  hideReaderToolbar = false,
  externalIsTwoColumns,
  externalIsJustified,
}: ArticleReaderProps) {
  const [internalIsTwoColumns, setInternalIsTwoColumns] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('sindecon_reader_columns')
      return saved !== null ? saved === '2' : true
    } catch {
      return true
    }
  })

  const [internalIsJustified, setInternalIsJustified] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('sindecon_reader_text_align')
      return saved !== null ? saved === 'justify' : true
    } catch {
      return true
    }
  })

  const isTwoColumns = externalIsTwoColumns ?? internalIsTwoColumns
  const isJustified = externalIsJustified ?? internalIsJustified

  const toggleColumns = () => {
    setInternalIsTwoColumns((prev) => {
      const next = !prev
      try {
        localStorage.setItem('sindecon_reader_columns', next ? '2' : '1')
      } catch {}
      return next
    })
  }

  const toggleAlignment = () => {
    setInternalIsJustified((prev) => {
      const next = !prev
      try {
        localStorage.setItem('sindecon_reader_text_align', next ? 'justify' : 'left')
      } catch {}
      return next
    })
  }

  const blocks = useMemo(() => parseMarkdownBlocks(markdown), [markdown])
  const isPdfArticle = useMemo(
    () => blocks.length > 0 && blocks.some((b) => b.type === 'pdf'),
    [blocks],
  )
  const preparedDoc = useMemo(
    () => prepareTemplateDocument(blocks, articleTitle, folderPath),
    [blocks, articleTitle, folderPath],
  )
  const alignmentClass = isJustified ? 'text-justified' : 'text-left'
  const sheets = useMemo(() => {
    if (isTwoColumns) {
      return paginateTwoColumnBlocks(preparedDoc.bodyBlocks)
    }
    return partitionBlocksIntoSheets(preparedDoc.bodyBlocks)
  }, [preparedDoc.bodyBlocks, isTwoColumns])

  const sectionHeadings = useMemo(() => {
    const list: Array<{ text: string; id: string; level: number }> = []
    const seen = new Set<string>()
    for (const b of preparedDoc.bodyBlocks) {
      if (b.type === 'header' && (b.level === 2 || b.level === 3)) {
        const cleanText = b.text.replace(/[*_`~]/g, '').trim()
        const id = `reader-sec-${slugifyHeading(b.text)}`
        if (cleanText && !seen.has(id)) {
          seen.add(id)
          list.push({ text: cleanText, id, level: b.level })
        }
      }
    }
    return list
  }, [preparedDoc.bodyBlocks])

  return (
    <div
      className={
        isPrintView
          ? 'print-reader-container'
          : `article-reader-container ${isPdfArticle ? 'pdf-container-full' : ''}`
      }
    >
      {!isPrintView && !isPdfArticle && !hideReaderToolbar && (
        <div className="mb-4 flex flex-col gap-2.5 rounded-xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] p-3 shadow-[var(--ch-shadow-card)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Left: Layout & Alignment Controls */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 font-mono text-[11px] font-semibold tracking-wider text-[var(--ch-text-muted)] uppercase">
                Formato Dossier:
              </span>
              <button
                type="button"
                onClick={toggleColumns}
                title={
                  isTwoColumns
                    ? 'Cambiar a vista de 1 columna continua'
                    : 'Cambiar a diseño de 2 columnas (Ficha clínica A4)'
                }
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                  isTwoColumns
                    ? 'border-[var(--ch-accent)]/40 bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]'
                    : 'border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] text-[var(--ch-text-secondary)] hover:text-[var(--ch-text-primary)]'
                }`}
              >
                {isTwoColumns ? (
                  <Columns2 className="h-3.5 w-3.5" />
                ) : (
                  <FileText className="h-3.5 w-3.5" />
                )}
                <span>{isTwoColumns ? '2 Columnas (Ficha A4)' : '1 Columna'}</span>
              </button>

              <button
                type="button"
                onClick={toggleAlignment}
                title={
                  isJustified
                    ? 'Cambiar a alineación izquierda'
                    : 'Cambiar a texto justificado editorial'
                }
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                  isJustified
                    ? 'border-[var(--ch-accent)]/40 bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]'
                    : 'border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] text-[var(--ch-text-secondary)] hover:text-[var(--ch-text-primary)]'
                }`}
              >
                {isJustified ? (
                  <AlignJustify className="h-3.5 w-3.5" />
                ) : (
                  <AlignLeft className="h-3.5 w-3.5" />
                )}
                <span>{isJustified ? 'Justificado' : 'Izquierda'}</span>
              </button>

              <span className="ml-1 rounded-full bg-[var(--ch-bg-secondary)] px-2.5 py-0.5 font-mono text-[11px] text-[var(--ch-text-muted)]">
                {sheets.length} {sheets.length === 1 ? 'página A4' : 'páginas A4'}
              </span>
            </div>

            {/* Right: Export to PDF / Google Docs */}
            <div className="flex flex-wrap items-center gap-1.5">
              {onOpenExportPdf && (
                <button
                  type="button"
                  onClick={onOpenExportPdf}
                  title="Imprimir o exportar ficha clínica a PDF"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-2.5 py-1 text-xs font-semibold text-[var(--ch-text-primary)] transition hover:border-[var(--ch-accent)] hover:text-[var(--ch-accent)]"
                >
                  <Printer className="h-3.5 w-3.5 text-[var(--ch-accent)]" />
                  <span>Imprimir / PDF</span>
                </button>
              )}

              {onOpenExportGoogleDocs && (
                <button
                  type="button"
                  onClick={onOpenExportGoogleDocs}
                  title="Exportar a Google Docs con diseño clínico y diagramas Mermaid"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-2.5 py-1 text-xs font-semibold text-[var(--ch-text-primary)] transition hover:border-[var(--ch-accent)] hover:text-[var(--ch-accent)]"
                >
                  <FileOutput className="h-3.5 w-3.5 text-[var(--ch-accent)]" />
                  <span>Google Docs</span>
                </button>
              )}
            </div>
          </div>

          {/* Interactive Section Outline (Índice Rápido de Secciones del Protocolo) */}
          {sectionHeadings.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--ch-border-subtle)] pt-2">
              <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] font-semibold tracking-wider text-[var(--ch-text-muted)] uppercase">
                <ListTree className="h-3 w-3 text-[var(--ch-accent)]" />
                <span>Secciones:</span>
              </span>
              {sectionHeadings.map((sec) => (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => {
                    const el = document.getElementById(sec.id)
                    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                  className="inline-flex items-center rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--ch-text-secondary)] transition hover:border-[var(--ch-accent)] hover:bg-[var(--ch-accent-soft)] hover:text-[var(--ch-accent)]"
                >
                  {sec.text}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isPrintView ? (
        !markdown.trim() ? (
          <div className={`print-reader-view empty ${alignmentClass}`}>
            <p className="muted empty-reader">Este artículo está vacío. Toca "Editor" para redactar contenido.</p>
          </div>
        ) : (
          <div className={`print-reader-view ${alignmentClass}`}>
            {!suppressDocHeader && preparedDoc.docTitle && (
              <div className="a4-sheet-doc-header full-width-block">
                <h1 className="reader-doc-title">{preparedDoc.docTitle}</h1>
                {preparedDoc.docSubtitle && (
                  <p className="reader-doc-subtitle">{preparedDoc.docSubtitle}</p>
                )}
              </div>
            )}
            {groupEditorialUnits(preparedDoc.bodyBlocks).map((unit, idx) =>
              renderEditorialUnit(unit, idx, onWikiLinkClick, articleTitle, isPrintView),
            )}
          </div>
        )
      ) : isPdfArticle ? (
        <div className="article-reader-view pdf-mode">
          {blocks.map((block, idx) => renderBlock(block, idx, onWikiLinkClick, articleTitle, isPrintView))}
        </div>
      ) : !markdown.trim() ? (
        <div className="a4-sheet-container">
          <div className={`article-reader-view a4-sheet empty ${alignmentClass}`}>
            <p className="muted empty-reader">Este artículo está vacío. Toca "Editor" para redactar contenido.</p>
          </div>
        </div>
      ) : (
        <div className="a4-sheet-container">
          {sheets.map((sheetBlocks, sheetIdx) => (
            <React.Fragment key={sheetIdx}>
              {sheetIdx > 0 && (
                <div className="a4-sheet-break" role="separator" aria-label={`Página ${sheetIdx + 1}`}>
                  <span className="a4-sheet-break-label">Página {sheetIdx + 1}</span>
                </div>
              )}
              <div
                className={`article-reader-view a4-sheet ${isTwoColumns ? 'layout-two-columns' : 'layout-single-column'} ${alignmentClass}`}
                data-sheet-index={sheetIdx}
              >
                {sheetIdx === 0 && !suppressDocHeader && preparedDoc.docTitle && (
                  <div className="a4-sheet-doc-header">
                    <h1 className="reader-doc-title">{preparedDoc.docTitle}</h1>
                    {preparedDoc.docSubtitle && (
                      <p className="reader-doc-subtitle">{preparedDoc.docSubtitle}</p>
                    )}
                  </div>
                )}
                <div className="a4-sheet-content">
                  {isTwoColumns
                    ? buildTwoColumnBands(sheetBlocks).map((band, bandIdx) => {
                        const bandClass =
                          band.kind === 'full'
                            ? 'a4-sheet-fullwidth-band'
                            : band.kind === 'solo-figure'
                              ? 'a4-sheet-solo-figure-band'
                              : 'a4-sheet-flow-band'
                        return (
                          <div key={`b-${sheetIdx}-${bandIdx}`} className={bandClass}>
                            {band.units.map((unit, uIdx) =>
                              renderEditorialUnit(
                                unit,
                                `s${sheetIdx}-b${bandIdx}-${uIdx}`,
                                onWikiLinkClick,
                                articleTitle,
                                isPrintView,
                              ),
                            )}
                          </div>
                        )
                      })
                    : groupEditorialUnits(sheetBlocks).map((unit, unitIdx) =>
                        renderEditorialUnit(unit, `s${sheetIdx}-${unitIdx}`, onWikiLinkClick, articleTitle, isPrintView),
                      )}
                </div>
                <footer className="a4-sheet-page-footer">
                  <span className="a4-sheet-page-number">
                    {sheets.length > 1 ? `Página ${sheetIdx + 1} de ${sheets.length}` : `Página ${sheetIdx + 1}`}
                  </span>
                </footer>
              </div>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  )
}
