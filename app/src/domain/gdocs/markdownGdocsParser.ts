export type ClinicalBlock =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'mermaid'; code: string }
  | {
      kind: 'callout'
      calloutType: 'note' | 'warning' | 'dosage' | 'important'
      title: string
      text: string
    }
  | { kind: 'table'; headers: string[]; rows: string[][] }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'code'; language: string; code: string }

export function parseMarkdownToClinicalBlocks(markdown: string): ClinicalBlock[] {
  const blocks: ClinicalBlock[] = []
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // 1. Líneas vacías
    if (!line.trim()) {
      i++
      continue
    }

    // 2. Bloques de código (incluyendo mermaid)
    if (line.trim().startsWith('```')) {
      const langMatch = line.trim().match(/^```([a-zA-Z0-9_-]*)/)
      const lang = langMatch ? langMatch[1].toLowerCase() : ''
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      if (i < lines.length) i++ // saltar el ``` de cierre

      const code = codeLines.join('\n')
      if (lang === 'mermaid') {
        blocks.push({ kind: 'mermaid', code })
      } else {
        blocks.push({ kind: 'code', language: lang, code })
      }
      continue
    }

    // 3. Encabezados (# H1, ## H2, ### H3)
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3
      blocks.push({ kind: 'heading', level, text: headingMatch[2].trim() })
      i++
      continue
    }

    // 4. Callouts médicos (> [!WARNING], > [!NOTE], etc.)
    const calloutMatch = line.match(/^>\s*\[!(NOTE|WARNING|TIP|DOSAGE|IMPORTANT)\]\s*$/i)
    if (calloutMatch) {
      const typeRaw = calloutMatch[1].toLowerCase()
      let calloutType: 'note' | 'warning' | 'dosage' | 'important' = 'note'
      let defaultTitle = 'NOTA CLÍNICA'

      if (typeRaw === 'warning') {
        calloutType = 'warning'
        defaultTitle = 'ADVERTENCIA'
      } else if (typeRaw === 'dosage') {
        calloutType = 'dosage'
        defaultTitle = 'DOSIFICACIÓN'
      } else if (typeRaw === 'important') {
        calloutType = 'important'
        defaultTitle = 'IMPORTANTE'
      } else if (typeRaw === 'tip') {
        calloutType = 'note'
        defaultTitle = 'CONSEJO CLÍNICO'
      }

      i++
      const textLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        textLines.push(lines[i].replace(/^>\s?/, '').trim())
        i++
      }

      blocks.push({
        kind: 'callout',
        calloutType,
        title: defaultTitle,
        text: textLines.join(' ').trim(),
      })
      continue
    }

    // 5. Tablas Markdown (| a | b |)
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim())
        i++
      }

      if (tableLines.length >= 2) {
        const splitRow = (r: string) =>
          r
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim())

        const headers = splitRow(tableLines[0])
        // tableLines[1] es típicamente |---|---|
        const rows = tableLines.slice(2).map(splitRow)
        blocks.push({ kind: 'table', headers, rows })
      } else {
        for (const tl of tableLines) {
          blocks.push({ kind: 'paragraph', text: tl })
        }
      }
      continue
    }

    // 6. Listas (viñetas o numeradas)
    const bulletMatch = line.match(/^[-*+]\s+(.+)$/)
    const numberMatch = line.match(/^\d+\.\s+(.+)$/)
    if (bulletMatch || numberMatch) {
      const isOrdered = Boolean(numberMatch)
      const listItems: string[] = []

      while (i < lines.length) {
        const currentLine = lines[i]
        const bM = currentLine.match(/^[-*+]\s+(.+)$/)
        const nM = currentLine.match(/^\d+\.\s+(.+)$/)

        if (isOrdered && nM) {
          listItems.push(nM[1].trim())
          i++
        } else if (!isOrdered && bM) {
          listItems.push(bM[1].trim())
          i++
        } else {
          break
        }
      }

      blocks.push({ kind: 'list', ordered: isOrdered, items: listItems })
      continue
    }

    // 7. Párrafo normal
    blocks.push({ kind: 'paragraph', text: line.trim() })
    i++
  }

  return blocks
}
