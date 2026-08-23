import React, { useMemo } from 'react'
import { MermaidViewer } from './MermaidViewer'
import { AssetImage } from './AssetImage'
import { WIKI_LINK_REGEX } from '../../domain/wikiLinks'

interface ArticleReaderProps {
  markdown: string
  onWikiLinkClick: (uuid: string) => void
}

type Block =
  | { type: 'header'; level: number; text: string }
  | { type: 'mermaid'; code: string }
  | { type: 'code'; lang: string; code: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'image'; alt: string; src: string }
  | { type: 'list'; items: string[]; ordered: boolean }
  | { type: 'paragraph'; text: string }

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
  const blocks = useMemo(() => parseMarkdownBlocks(markdown), [markdown])

  if (!markdown.trim()) {
    return <p className="muted empty-reader">Este artículo está vacío. Toca "Editar" para redactar contenido.</p>
  }

  return (
    <div className="article-reader-view">
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
  )
}
