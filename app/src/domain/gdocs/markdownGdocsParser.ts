import type { ClinicalCalloutType } from './docxClinicalStyles'

export type ClinicalBlock =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string; fullWidth?: boolean }
  | {
      kind: 'paragraph'
      text: string
      variant?: 'normal' | 'secondary' | 'caption' | 'bibliography' | 'subtitle'
      fullWidth?: boolean
    }
  | { kind: 'mermaid'; code: string; fullWidth?: boolean }
  | {
      kind: 'callout'
      calloutType: ClinicalCalloutType
      title: string
      text: string
      fullWidth?: boolean
    }
  | { kind: 'table'; headers: string[]; rows: string[][]; fullWidth?: boolean }
  | { kind: 'list'; ordered: boolean; items: string[]; isBibliography?: boolean; startNumber?: number; fullWidth?: boolean }
  | { kind: 'code'; language: string; code: string; fullWidth?: boolean }

function matchNaturalGdocsCallout(trimmed: string): ClinicalBlock | null {
  const patterns: Array<{ regex: RegExp; calloutType: ClinicalCalloutType }> = [
    {
      regex: /^(?:\*\*|\*)?(Ejemplo\s+cl[ií]nico)(?:\*\*|\*)?\s*:\s*(?:\*\*|\*)?\s*(.+)$/i,
      calloutType: 'example',
    },
    {
      regex: /^(?:\*\*|\*)?(Perla\s+cl[ií]nica)(?:\*\*|\*)?\s*:\s*(?:\*\*|\*)?\s*(.+)$/i,
      calloutType: 'pearl',
    },
    {
      regex: /^(?:\*\*|\*)?(Advertencia)(?:\*\*|\*)?\s*:\s*(?:\*\*|\*)?\s*(.+)$/i,
      calloutType: 'warning',
    },
    {
      regex: /^(?:\*\*|\*)?(Definici[oó]n)(?:\*\*|\*)?\s*:\s*(?:\*\*|\*)?\s*(.+)$/i,
      calloutType: 'definition',
    },
  ]

  for (const { regex, calloutType } of patterns) {
    const m = trimmed.match(regex)
    if (m) {
      return {
        kind: 'callout',
        calloutType,
        title: `${m[1].trim()}:`,
        text: m[2].trim(),
      }
    }
  }
  return null
}

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

    // 2b. Bloques explícitos a ancho completo (:::ancho-completo / :::fullwidth)
    if (/^[-*+\s]*\\*:::\s*(?:ancho[-_\s]*completo|full[-_\s]*width|1\s*col(?:umna)?)$/i.test(line.trim())) {
      i++
      const innerLines: string[] = []
      while (i < lines.length) {
        const currTrimmed = lines[i].trim()
        if (
          currTrimmed === ':::' ||
          currTrimmed === '\\:\\:\\:' ||
          /^\\*:::\s*(?:ancho[-_\s]*completo|full[-_\s]*width|1\s*col(?:umna)?)?$/i.test(currTrimmed)
        ) {
          i++
          break
        }
        innerLines.push(lines[i])
        i++
      }
      const innerBlocks = parseMarkdownToClinicalBlocks(innerLines.join('\n'))
      for (const ib of innerBlocks) {
        blocks.push({ ...ib, fullWidth: true })
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

    // 4. Callouts médicos (> [!WARNING], > [!NOTE], > [!PERLA], > [!EJEMPLO], > [!DEFINICION], etc.)
    const calloutMatch = line.match(
      /^>\s*\[!(NOTE|WARNING|TIP|DOSAGE|DOSIS|IMPORTANT|PERLA|EJEMPLO|EXAMPLE|ADVERTENCIA|DEFINICION|DEFINICIÓN)\](?:\s+(.*))?$/i
    )
    if (calloutMatch) {
      const typeRaw = calloutMatch[1].toLowerCase()
      const customTitle = calloutMatch[2]?.trim()
      let calloutType: ClinicalCalloutType = 'note'
      let defaultTitle = 'NOTA CLÍNICA'

      if (typeRaw === 'warning' || typeRaw === 'advertencia') {
        calloutType = 'warning'
        defaultTitle = typeRaw === 'advertencia' ? 'Advertencia:' : 'ADVERTENCIA'
      } else if (typeRaw === 'dosage' || typeRaw === 'dosis') {
        calloutType = 'dosage'
        defaultTitle = 'DOSIFICACIÓN'
      } else if (typeRaw === 'important') {
        calloutType = 'important'
        defaultTitle = 'IMPORTANTE'
      } else if (typeRaw === 'tip') {
        calloutType = 'note'
        defaultTitle = 'CONSEJO CLÍNICO'
      } else if (typeRaw === 'perla') {
        calloutType = 'pearl'
        defaultTitle = 'Perla clínica:'
      } else if (typeRaw === 'ejemplo' || typeRaw === 'example') {
        calloutType = 'example'
        defaultTitle = 'Ejemplo clínico:'
      } else if (typeRaw === 'definicion' || typeRaw === 'definición') {
        calloutType = 'definition'
        defaultTitle = 'Definición:'
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
        title: customTitle || defaultTitle,
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
        const maybeSep = splitRow(tableLines[1])
        const hasSep = maybeSep.length > 0 && maybeSep.every((c) => /^:?-+:?$/.test(c))

        if (hasSep) {
          const rows = tableLines.slice(2).map(splitRow)
          blocks.push({ kind: 'table', headers, rows })
        } else {
          const rows = tableLines.slice(1).map(splitRow)
          if (headers.length >= 2 && rows.every((r) => r.length === headers.length)) {
            blocks.push({ kind: 'table', headers, rows })
          } else {
            for (const tl of tableLines) {
              blocks.push({ kind: 'paragraph', text: tl })
            }
          }
        }
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

    // 7. Párrafos con estilo de callout natural (Ejemplo clínico:, Perla clínica:, Advertencia:, Definición:)
    const naturalCallout = matchNaturalGdocsCallout(line.trim())
    if (naturalCallout) {
      blocks.push(naturalCallout)
      i++
      continue
    }

    // 8. Párrafo normal
    blocks.push({ kind: 'paragraph', text: line.trim() })
    i++
  }

  return blocks
}
