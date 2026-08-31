import React, { useMemo } from 'react'

interface FlashcardMarkdownProps {
  content: string
  className?: string
}

interface NestedListItem {
  text: string
  ordered: boolean
  children: NestedListItem[]
}

type FlashcardBlock =
  | { type: 'header'; level: number; text: string }
  | { type: 'code'; lang: string; code: string }
  | { type: 'table'; headers: string[]; rows: string[][]; alignments: ('left' | 'center' | 'right')[] }
  | { type: 'hr' }
  | { type: 'list'; items: NestedListItem[]; ordered: boolean }
  | { type: 'callout'; kind: string; title: string; text: string }
  | { type: 'blockquote'; text: string }
  | { type: 'paragraph'; lines: string[] }

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

function parseMarkdownBlocks(md: string): FlashcardBlock[] {
  if (!md) return []
  const rawLines = md.split(/\r?\n/)
  const blocks: FlashcardBlock[] = []
  let i = 0

  while (i < rawLines.length) {
    const line = rawLines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      i++
      continue
    }

    // 1. Code blocks
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < rawLines.length && !rawLines[i].trim().startsWith('```')) {
        codeLines.push(rawLines[i])
        i++
      }
      i++ // Skip closing fence
      blocks.push({ type: 'code', lang, code: codeLines.join('\n') })
      continue
    }

    // 2. Horizontal Rule
    if (/^(?:---|\*\*\*|___)$/.test(trimmed)) {
      blocks.push({ type: 'hr' })
      i++
      continue
    }

    // 3. Headings (# H1 - #### H4)
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

    // 4. Callouts & Blockquotes
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = []
      while (i < rawLines.length && rawLines[i].trim().startsWith('>')) {
        quoteLines.push(rawLines[i].trim().replace(/^>\s?/, ''))
        i++
      }
      const fullQuote = quoteLines.join('\n')
      const calloutMatch = fullQuote.match(/^\[!([A-Z_-]+)\](?:\s+(.*))?(\n[\s\S]*)?$/i)

      if (calloutMatch) {
        const kind = calloutMatch[1].toLowerCase()
        const title = calloutMatch[2] || (kind === 'warning' ? 'Alerta' : kind === 'tip' ? 'Perla Clínica' : 'Nota')
        const bodyText = (calloutMatch[3] || '').trim()
        blocks.push({
          type: 'callout',
          kind,
          title,
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

    // 5. Tables
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

    // 6. Lists (Ordered & Unordered)
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

    // 7. Paragraph (accumulate lines until blank line or special block)
    const paraLines: string[] = []
    while (i < rawLines.length) {
      const current = rawLines[i]
      const currTrim = current.trim()
      if (!currTrim) break
      if (
        currTrim.startsWith('#') ||
        currTrim.startsWith('```') ||
        currTrim.startsWith('>') ||
        (currTrim.startsWith('|') && currTrim.endsWith('|')) ||
        /^(?:---|\*\*\*|___)$/.test(currTrim) ||
        /^(\s*)([-*+]|\d+\.)\s+/.test(current)
      ) {
        break
      }
      paraLines.push(currTrim)
      i++
    }

    if (paraLines.length > 0) {
      blocks.push({
        type: 'paragraph',
        lines: paraLines,
      })
    }
  }

  return blocks
}

/**
 * Renderiza texto inline con soporte para:
 * - **Negrita** o __Negrita__
 * - *Cursiva* o _Cursiva_
 * - ***Negrita y Cursiva***
 * - `Código inline`
 * - ==Resaltado==
 * - ~~Tachado~~
 */
export function renderInlineMarkdown(text: string): React.ReactNode {
  if (!text) return null

  // Regex para capturar formato inline
  const tokens = text.split(/(\*\*\*.*?\*\*\*|___.*?___|\*\*.*?\*\*|__.*?__|\*.*?\*|_.*?_|`.*?`|==.*?==|~~.*?~~)/g)

  return (
    <>
      {tokens.map((tok, idx) => {
        if (!tok) return null

        // Negrita + Cursiva
        if ((tok.startsWith('***') && tok.endsWith('***')) || (tok.startsWith('___') && tok.endsWith('___'))) {
          return (
            <strong key={idx} className="card-md-bold">
              <em>{tok.slice(3, -3)}</em>
            </strong>
          )
        }

        // Negrita
        if ((tok.startsWith('**') && tok.endsWith('**')) || (tok.startsWith('__') && tok.endsWith('__'))) {
          return (
            <strong key={idx} className="card-md-bold">
              {tok.slice(2, -2)}
            </strong>
          )
        }

        // Cursiva
        if ((tok.startsWith('*') && tok.endsWith('*')) || (tok.startsWith('_') && tok.endsWith('_'))) {
          return (
            <em key={idx} className="card-md-italic">
              {tok.slice(1, -1)}
            </em>
          )
        }

        // Código inline
        if (tok.startsWith('`') && tok.endsWith('`') && tok.length >= 2) {
          return (
            <code key={idx} className="card-code-inline">
              {tok.slice(1, -1)}
            </code>
          )
        }

        // Resaltado
        if (tok.startsWith('==') && tok.endsWith('==') && tok.length >= 4) {
          return (
            <mark key={idx} className="card-md-highlight">
              {tok.slice(2, -2)}
            </mark>
          )
        }

        // Tachado
        if (tok.startsWith('~~') && tok.endsWith('~~') && tok.length >= 4) {
          return <del key={idx}>{tok.slice(2, -2)}</del>
        }

        return tok
      })}
    </>
  )
}

function renderNestedList(items: NestedListItem[]): React.ReactNode {
  return items.map((item, idx) => (
    <li key={idx} className="card-list-item">
      <span>{renderInlineMarkdown(item.text)}</span>
      {item.children.length > 0 && (
        <ul className="card-list-nested">
          {renderNestedList(item.children)}
        </ul>
      )}
    </li>
  ))
}

export const FlashcardMarkdown: React.FC<FlashcardMarkdownProps> = ({ content, className = '' }) => {
  const blocks = useMemo(() => parseMarkdownBlocks(content), [content])

  if (!content || !content.trim()) {
    return null
  }

  return (
    <div className={`flashcard-markdown-root ${className}`}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'header': {
            const Tag = `h${Math.min(block.level, 5)}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5'
            return (
              <Tag key={idx} className={`card-md-heading h${block.level}`}>
                {renderInlineMarkdown(block.text)}
              </Tag>
            )
          }

          case 'paragraph': {
            return (
              <p key={idx} className="card-md-paragraph">
                {block.lines.map((line, lIdx) => (
                  <React.Fragment key={lIdx}>
                    {lIdx > 0 && <br />}
                    {renderInlineMarkdown(line)}
                  </React.Fragment>
                ))}
              </p>
            )
          }

          case 'list': {
            if (block.ordered) {
              return (
                <ol key={idx} className="card-md-list card-md-ol">
                  {renderNestedList(block.items)}
                </ol>
              )
            }
            return (
              <ul key={idx} className="card-md-list card-md-ul">
                {renderNestedList(block.items)}
              </ul>
            )
          }

          case 'table': {
            return (
              <div key={idx} className="card-table-wrapper">
                <table className="card-table">
                  <thead>
                    <tr>
                      {block.headers.map((h, hIdx) => (
                        <th
                          key={hIdx}
                          style={{ textAlign: block.alignments[hIdx] || 'left' }}
                        >
                          {renderInlineMarkdown(h)}
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
                            style={{ textAlign: block.alignments[cIdx] || 'left' }}
                          >
                            {renderInlineMarkdown(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }

          case 'callout': {
            const icon =
              block.kind === 'warning'
                ? '🚨'
                : block.kind === 'tip'
                ? '💡'
                : block.kind === 'dosage'
                ? '💊'
                : '📋'
            return (
              <div key={idx} className={`card-md-callout callout-${block.kind}`}>
                <div className="callout-header">
                  <span className="callout-icon">{icon}</span>
                  <strong>{block.title}</strong>
                </div>
                {block.text && (
                  <div className="callout-body">{renderInlineMarkdown(block.text)}</div>
                )}
              </div>
            )
          }

          case 'blockquote': {
            return (
              <blockquote key={idx} className="card-md-blockquote">
                {renderInlineMarkdown(block.text)}
              </blockquote>
            )
          }

          case 'code': {
            return (
              <pre key={idx} className="card-code-block">
                <code>{block.code}</code>
              </pre>
            )
          }

          case 'hr': {
            return <hr key={idx} className="card-md-hr" />
          }

          default:
            return null
        }
      })}
    </div>
  )
}
