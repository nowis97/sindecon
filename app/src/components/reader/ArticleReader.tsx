import React, { useMemo, useState } from 'react'
import { MermaidViewer } from './MermaidViewer'
import { AssetImage } from './AssetImage'
import { WIKI_LINK_REGEX } from '../../domain/wikiLinks'

interface ArticleReaderProps {
  markdown: string
  onWikiLinkClick: (uuid: string) => void
}

export type CalloutKind = 'warning' | 'tip' | 'dosage' | 'important' | 'note'

type Block =
  | { type: 'header'; level: number; text: string }
  | { type: 'mermaid'; code: string }
  | { type: 'code'; lang: string; code: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'image'; alt: string; src: string }
  | { type: 'list'; items: string[]; ordered: boolean }
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
  if (['IMPORTANT', 'DIAGNOSTICO', 'CRITERIOS'].includes(upper)) {
    return { kind: 'important', defaultTitle: 'Criterios Diagnósticos', icon: '📋' }
  }
  return { kind: 'note', defaultTitle: 'Nota', icon: 'ℹ️' }
}

function parseMarkdownBlocks(md: string): Block[] {
  const lines = md.split(/\r?\n/)
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Code fence
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++ // Skip closing ```
      const code = codeLines.join('\n')
      if (lang.toLowerCase() === 'mermaid') {
        blocks.push({ type: 'mermaid', code })
      } else {
        blocks.push({ type: 'code', lang, code })
      }
      continue
    }

    // Standalone Image: ![alt](url)
    const imgMatch = line.trim().match(/^!\[(.*?)\]\((.*?)\)$/)
    if (imgMatch) {
      blocks.push({ type: 'image', alt: imgMatch[1], src: imgMatch[2] })
      i++
      continue
    }

    // Headers: # H1, ## H2, etc.
    const headerMatch = line.match(/^(#{1,6})\s+(.*)$/)
    if (headerMatch) {
      blocks.push({
        type: 'header',
        level: headerMatch[1].length,
        text: headerMatch[2].trim(),
      })
      i++
      continue
    }

    // Blockquote / Callout (> [!TYPE] Title)
    if (line.trim().startsWith('>')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''))
        i++
      }

      if (quoteLines.length > 0) {
        const firstLine = quoteLines[0]
        const calloutMatch = firstLine.match(/^\[!([A-Za-z0-9_-]+)\](?:\s+(.*))?$/)

        if (calloutMatch) {
          const typeStr = calloutMatch[1]
          const customTitle = calloutMatch[2]?.trim()
          const { kind, defaultTitle } = parseCalloutType(typeStr)
          const bodyText = quoteLines.slice(1).join('\n').trim()

          blocks.push({
            type: 'callout',
            kind,
            title: customTitle || defaultTitle,
            text: bodyText,
          })
          continue
        } else {
          blocks.push({
            type: 'blockquote',
            text: quoteLines.join('\n'),
          })
          continue
        }
      }
    }

    // Tables: | col1 | col2 |
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableLines: string[] = []
      while (
        i < lines.length &&
        lines[i].trim().startsWith('|') &&
        lines[i].trim().endsWith('|')
      ) {
        tableLines.push(lines[i].trim())
        i++
      }

      if (tableLines.length >= 2) {
        const parseRow = (rowStr: string) =>
          rowStr
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim())

        const headers = parseRow(tableLines[0])
        const dataLines = tableLines.slice(1).filter((r) => !r.match(/^\|[\s-:]+\|$/))
        const rows = dataLines.map(parseRow)

        blocks.push({ type: 'table', headers, rows })
        continue
      }
    }

    // Lists: - item or 1. item
    if (line.trim().match(/^[-*]\s+/) || line.trim().match(/^\d+\.\s+/)) {
      const isOrdered = Boolean(line.trim().match(/^\d+\.\s+/))
      const listItems: string[] = []
      while (
        i < lines.length &&
        (lines[i].trim().match(/^[-*]\s+/) || lines[i].trim().match(/^\d+\.\s+/))
      ) {
        const itemText = lines[i]
          .trim()
          .replace(/^[-*]\s+/, '')
          .replace(/^\d+\.\s+/, '')
        listItems.push(itemText)
        i++
      }
      blocks.push({ type: 'list', items: listItems, ordered: isOrdered })
      continue
    }

    // Empty lines
    if (!line.trim()) {
      i++
      continue
    }

    // Paragraph
    const paragraphLines: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('>') &&
      !lines[i].trim().startsWith('|') &&
      !lines[i].trim().match(/^[-*]\s+/) &&
      !lines[i].trim().match(/^\d+\.\s+/) &&
      !lines[i].trim().match(/^!\[(.*?)\]\((.*?)\)$/)
    ) {
      paragraphLines.push(lines[i])
      i++
    }
    blocks.push({ type: 'paragraph', text: paragraphLines.join(' ') })
  }

  return blocks
}

function renderFormattedInline(
  text: string,
  onWikiLinkClick: (uuid: string) => void,
): React.ReactNode[] {
  // Manejo de wiki-links [[uuid|alias]] o [[uuid]]
  const parts: React.ReactNode[] = []
  const wikiRegex = new RegExp(WIKI_LINK_REGEX.source, 'g')
  let lastIdx = 0
  let match: RegExpExecArray | null

  while ((match = wikiRegex.exec(text)) !== null) {
    const start = match.index
    const end = start + match[0].length
    if (start > lastIdx) {
      parts.push(renderBasicFormatting(text.slice(lastIdx, start), `${lastIdx}`))
    }

    const uuid = match[1]
    const title = match[2] || uuid
    parts.push(
      <button
        key={`wiki-${start}`}
        type="button"
        className="wiki-link"
        onClick={() => onWikiLinkClick(uuid)}
        title={`Ir a: ${title}`}
      >
        📄 {title}
      </button>,
    )
    lastIdx = end
  }

  if (lastIdx < text.length) {
    parts.push(renderBasicFormatting(text.slice(lastIdx), `${lastIdx}`))
  }

  return parts
}

function renderBasicFormatting(segment: string, keyPrefix: string): React.ReactNode {
  // Formato simple para negrita ** y cursiva * y código `
  const tokens = segment.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g)
  return (
    <React.Fragment key={keyPrefix}>
      {tokens.map((tok, idx) => {
        if (tok.startsWith('**') && tok.endsWith('**') && tok.length >= 4) {
          return <strong key={idx}>{tok.slice(2, -2)}</strong>
        }
        if (tok.startsWith('*') && tok.endsWith('*') && tok.length >= 2) {
          return <em key={idx}>{tok.slice(1, -1)}</em>
        }
        if (tok.startsWith('`') && tok.endsWith('`') && tok.length >= 2) {
          return <code key={idx} className="reader-code-inline">{tok.slice(1, -1)}</code>
        }
        return tok
      })}
    </React.Fragment>
  )
}

export function ArticleReader({ markdown, onWikiLinkClick }: ArticleReaderProps) {
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

  if (!markdown.trim()) {
    return <p className="muted empty-reader">Este artículo está vacío. Toca "Editar" para redactar contenido.</p>
  }

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
    <div className="article-reader-container">
      <div className="reader-toolbar-row">
        <button
          type="button"
          className={`btn-reader-layout-toggle ${isTwoColumns ? 'active' : ''}`}
          onClick={toggleColumns}
          title={isTwoColumns ? 'Cambiar a vista de 1 columna' : 'Cambiar a diseño de 2 columnas (Ficha médica)'}
        >
          {isTwoColumns ? '📖 Vista 2 Columnas (Word)' : '📄 Vista 1 Columna'}
        </button>
      </div>

      <div className={`article-reader-view ${isTwoColumns ? 'layout-two-columns' : 'layout-single-column'}`}>
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
                        <th key={hIdx}>{renderFormattedInline(h, onWikiLinkClick)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rIdx) => (
                      <tr key={rIdx}>
                        {row.map((cell, cIdx) => (
                          <td key={cIdx}>{renderFormattedInline(cell, onWikiLinkClick)}</td>
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
                {block.items.map((it, itIdx) => (
                  <li key={itIdx}>{renderFormattedInline(it, onWikiLinkClick)}</li>
                ))}
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
    </div>
  )
}
