import React, { useMemo, useState } from 'react'
import { MermaidViewer } from './MermaidViewer'
import { AssetImage } from './AssetImage'
import { WIKI_LINK_REGEX } from '../../domain/wikiLinks'

interface ArticleReaderProps {
  markdown: string
  onWikiLinkClick: (uuid: string) => void
  onOpenExportPdf?: () => void
  isPrintView?: boolean
}

export type CalloutKind = 'warning' | 'tip' | 'dosage' | 'important' | 'note'

export interface NestedListItem {
  text: string
  ordered: boolean
  children: NestedListItem[]
}

type Block =
  | { type: 'header'; level: number; text: string }
  | { type: 'mermaid'; code: string }
  | { type: 'code'; lang: string; code: string }
  | { type: 'table'; headers: string[]; rows: string[][]; alignments?: ('left' | 'center' | 'right')[] }
  | { type: 'hr' }
  | { type: 'image'; alt: string; src: string }
  | { type: 'list'; items: NestedListItem[]; ordered: boolean }
  | { type: 'callout'; kind: CalloutKind; title: string; text: string }
  | { type: 'blockquote'; text: string }
  | { type: 'paragraph'; text: string }

function parseCalloutType(typeStr: string): { kind: CalloutKind; defaultTitle: string; icon: string } {
  const upper = typeStr.toUpperCase()
  if (['WARNING', 'ALERTA', 'RED-FLAGS', 'RED_FLAGS', 'CAUTION', 'PELIGRO'].includes(upper)) {
    return { kind: 'warning', defaultTitle: 'Criterios de Alarma / Red Flags', icon: '🚨' }
  }
  if (['TIP', 'PERLA', 'PERLA-CLINICA', 'CONSEJO'].includes(upper)) {
    return { kind: 'tip', defaultTitle: 'Perla Clínica', icon: '💡' }
  }
  if (['DOSIS', 'FARMACO', 'MEDICACION', 'DRUG'].includes(upper)) {
    return { kind: 'dosage', defaultTitle: 'Dosis y Farmacología', icon: '💊' }
  }
  if (['IMPORTANT', 'IMPORTANTE', 'OJO'].includes(upper)) {
    return { kind: 'important', defaultTitle: 'Importante', icon: '📋' }
  }
  return { kind: 'note', defaultTitle: 'Nota Clínica', icon: 'ℹ️' }
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

function parseMarkdownBlocks(md: string): Block[] {
  if (!md) return []
  const rawLines = md.split(/\r?\n/)
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

    // 3. Encabezados (# H1 - ###### H6)
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

    // 4. Imágenes standalone ![alt](src)
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

    // 5. Callouts y Blockquotes (> [!TYPE] Title)
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = []
      while (i < rawLines.length && rawLines[i].trim().startsWith('>')) {
        quoteLines.push(rawLines[i].trim().replace(/^>\s?/, ''))
        i++
      }
      const fullQuote = quoteLines.join('\n')
      const calloutMatch = fullQuote.match(/^\[!([A-Z_-]+)\](?:\s+(.*))?(\n[\s\S]*)?$/i)

      if (calloutMatch) {
        const typeInfo = parseCalloutType(calloutMatch[1])
        const customTitle = calloutMatch[2]
        const bodyText = (calloutMatch[3] || '').trim()

        blocks.push({
          type: 'callout',
          kind: typeInfo.kind,
          title: customTitle || typeInfo.defaultTitle,
          text: bodyText,
        })
      } else {
        blocks.push({
          type: 'blockquote',
          text: fullQuote,
        })
      }
      continue
    }

    // 6. Tablas GFM
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
      }
    }

    // 7. Listas (Ordenadas y Desordenadas con soporte de anidación)
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

    // 8. Párrafo estándar
    blocks.push({
      type: 'paragraph',
      text: trimmed,
    })
    i++
  }

  return blocks
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
      parts.push(renderBasicFormatting(text.slice(lastIndex, matchIndex)))
    }

    const uuid = match[1]
    const label = match[2] || uuid
    parts.push(
      <a
        key={matchIndex}
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
    parts.push(renderBasicFormatting(text.slice(lastIndex)))
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
  return items.map((item, idx) => (
    <li key={idx} className="reader-list-item">
      <span>{renderFormattedInline(item.text, onWikiLinkClick)}</span>
      {item.children.length > 0 && (
        <ul className="reader-list-nested">
          {renderListItems(item.children, onWikiLinkClick)}
        </ul>
      )}
    </li>
  ))
}

export function ArticleReader({
  markdown,
  onWikiLinkClick,
  onOpenExportPdf,
  isPrintView = false,
}: ArticleReaderProps) {
  const [isTwoColumns, setIsTwoColumns] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('sindecon_reader_columns')
      return saved !== null ? saved === '2' : true
    } catch {
      return true
    }
  })

  const toggleColumns = () => {
    setIsTwoColumns((prev) => {
      const next = !prev
      try {
        localStorage.setItem('sindecon_reader_columns', next ? '2' : '1')
      } catch {}
      return next
    })
  }

  const blocks = useMemo(() => parseMarkdownBlocks(markdown), [markdown])

  const getCalloutIcon = (kind: CalloutKind) => {
    switch (kind) {
      case 'warning':
        return '🚨'
      case 'tip':
        return '💡'
      case 'dosage':
        return '💊'
      case 'important':
        return '📋'
      case 'note':
        return 'ℹ️'
    }
  }

  return (
    <div className={isPrintView ? 'print-reader-container' : 'article-reader-container'}>
      {!isPrintView && (
        <div className="reader-toolbar-row">
          <button
            type="button"
            className={`btn-reader-layout-toggle ${isTwoColumns ? 'active' : ''}`}
            onClick={toggleColumns}
            title={isTwoColumns ? 'Cambiar a vista de 1 columna' : 'Cambiar a diseño de 2 columnas (Ficha médica)'}
          >
            {isTwoColumns ? '📖 Vista 2 Columnas (Word)' : '📄 Vista 1 Columna'}
          </button>

          {onOpenExportPdf && (
            <button
              type="button"
              className="btn-reader-export-pdf"
              onClick={onOpenExportPdf}
              title="Exportar este artículo a PDF o Imprimir"
            >
              🖨️ Exportar PDF
            </button>
          )}
        </div>
      )}

      {!markdown.trim() ? (
        <div className={isPrintView ? 'print-reader-view empty' : 'article-reader-view empty'}>
          <p className="muted empty-reader">Este artículo está vacío. Toca "Editar" para redactar contenido.</p>
        </div>
      ) : (
        <div
          className={
            isPrintView
              ? 'print-reader-view'
              : `article-reader-view ${isTwoColumns ? 'layout-two-columns' : 'layout-single-column'}`
          }
        >
          {blocks.map((block, idx) => {
            switch (block.type) {
              case 'header': {
                const Tag = `h${Math.min(block.level, 6)}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
                return (
                  <Tag key={idx} className={`reader-heading h${block.level}`}>
                    {renderFormattedInline(block.text, onWikiLinkClick)}
                  </Tag>
                )
              }
              case 'hr':
                return <hr key={idx} className="reader-hr" />
              case 'callout':
                return (
                  <div key={idx} className={`reader-callout callout-${block.kind}`}>
                    <div className="callout-header">
                      <span className="callout-icon">{getCalloutIcon(block.kind)}</span>
                      <strong className="callout-title">
                        {renderFormattedInline(block.title, onWikiLinkClick)}
                      </strong>
                    </div>
                    {block.text && (
                      <div className="callout-body">
                        {block.text.split('\n').map((p, pIdx) => (
                          <p key={pIdx} className="callout-paragraph">
                            {renderFormattedInline(p, onWikiLinkClick)}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )
              case 'blockquote':
                return (
                  <blockquote key={idx} className="reader-blockquote">
                    {block.text.split('\n').map((p, pIdx) => (
                      <p key={pIdx}>{renderFormattedInline(p, onWikiLinkClick)}</p>
                    ))}
                  </blockquote>
                )
              case 'mermaid':
                return <MermaidViewer key={idx} code={block.code} />
              case 'code':
                return (
                  <pre key={idx} className="reader-code-block">
                    <code>{block.code}</code>
                  </pre>
                )
              case 'table':
                return (
                  <div key={idx} className="reader-table-wrapper">
                    <table className="reader-table">
                      <thead>
                        <tr>
                          {block.headers.map((h, hIdx) => (
                            <th
                              key={hIdx}
                              style={{ textAlign: block.alignments?.[hIdx] ?? 'left' }}
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
                                style={{ textAlign: block.alignments?.[cIdx] ?? 'left' }}
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
              case 'image':
                return <AssetImage key={idx} src={block.src} alt={block.alt} />
              case 'list': {
                const ListTag = block.ordered ? 'ol' : 'ul'
                return (
                  <ListTag key={idx} className="reader-list">
                    {renderListItems(block.items, onWikiLinkClick)}
                  </ListTag>
                )
              }
              case 'paragraph':
                return (
                  <p key={idx} className="reader-paragraph">
                    {renderFormattedInline(block.text, onWikiLinkClick)}
                  </p>
                )
              default:
                return null
            }
          })}
        </div>
      )}
    </div>
  )
}
