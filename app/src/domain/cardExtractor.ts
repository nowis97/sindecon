export interface ExtractedCard {
  front: string
  back: string
  sourceType: 'structural' | 'manual' | 'cloud_ai'
}

/**
 * Extrae flashcards a partir de la estructura común de un artículo médico en Markdown.
 */
export function extractCardsFromMarkdown(articleTitle: string, markdown: string): ExtractedCard[] {
  if (!markdown || !markdown.trim()) return []

  const title = articleTitle.trim() || 'Artículo'
  const cards: ExtractedCard[] = []
  const seenFronts = new Set<string>()

  function addCard(front: string, back: string) {
    const cleanFront = front.replace(/\s+/g, ' ').trim()
    const cleanBack = back.trim()

    if (cleanFront.length < 5 || cleanBack.length < 3) return
    const key = cleanFront.toLowerCase()
    if (seenFronts.has(key)) return
    seenFronts.add(key)

    cards.push({
      front: cleanFront,
      back: cleanBack,
      sourceType: 'structural',
    })
  }

  // 1. Detección de pares explícitos Q: / A: o P: / R:
  const qaRegex = /(?:^|\n)(?:Q|P|\*\*P\*\*|\*\*Pregunta\*\*):\s*([^\n]+)\n+(?:A|R|\*\*R\*\*|\*\*Respuesta\*\*):\s*([^\n]+(?:\n(?!(?:Q|P|\*\*P\*\*|#))[^\n]+)*)/gi
  let match: RegExpExecArray | null
  while ((match = qaRegex.exec(markdown)) !== null) {
    const q = match[1]
    const a = match[2]
    if (q && a) {
      addCard(q, a)
    }
  }

  // 2. Callouts médicos (> [!PEARL], > [!WARNING], > [!TIP], etc.)
  const calloutRegex = />\s*\[!(PEARL|WARNING|TIP|NOTE|INFO|CAUTION|ALERT)\](?:\s*([^\n]*))?\n((?:>[^\n]*\n?)+)/gi
  while ((match = calloutRegex.exec(markdown)) !== null) {
    const type = match[1].toUpperCase()
    const calloutTitle = match[2]?.trim() || ''
    const rawBody = match[3] || ''
    const body = rawBody
      .split('\n')
      .map((l) => l.replace(/^>\s?/, '').trim())
      .filter(Boolean)
      .join('\n')

    if (body) {
      const typeLabel = type === 'PEARL' ? '💡 Perla Clínica' : type === 'WARNING' ? '⚠️ Advertencia' : '📌 Clave'
      const front = calloutTitle
        ? `${title} — ${typeLabel}: ${calloutTitle}`
        : `${title} — ${typeLabel}`
      addCard(front, body)
    }
  }

  // 3. Listas con conceptos en negrita: - **Término:** Definición o - **Término**: Definición
  const boldListRegex = /^[ \t]*[-*+][ \t]+\*\*([^*\n]+)\*\*(?::|\s*[-–—])?\s*([^\n]+)$/gm
  while ((match = boldListRegex.exec(markdown)) !== null) {
    const rawTerm = match[1].trim()
    const term = rawTerm.replace(/:$/, '').trim()
    const definition = match[2].trim()
    if (term.length >= 3 && definition.length >= 5) {
      const front = `${title} — ¿Qué es / Qué indica **${term}**?`
      addCard(front, definition)
    }
  }

  // 4. Filas de tablas médicas Markdown
  const lines = markdown.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line.startsWith('|') && line.endsWith('|') && i + 2 < lines.length) {
      const headerLine = line
      const separatorLine = lines[i + 1].trim()

      if (separatorLine.startsWith('|') && separatorLine.includes('---')) {
        const headers = headerLine
          .split('|')
          .slice(1, -1)
          .map((h) => h.trim())

        if (headers.length >= 2) {
          let rowIndex = i + 2
          while (rowIndex < lines.length && lines[rowIndex].trim().startsWith('|')) {
            const rowLine = lines[rowIndex].trim()
            const cols = rowLine
              .split('|')
              .slice(1, -1)
              .map((c) => c.trim())

            if (cols.length >= 2 && cols[0].length >= 2) {
              const term = cols[0]
              const details = cols
                .slice(1)
                .map((val, idx) => {
                  const h = headers[idx + 1] || ''
                  return h ? `**${h}:** ${val}` : val
                })
                .join('\n')

              const front = `${title} — ${term} (${headers.slice(1).join(', ')})`
              addCard(front, details)
            }
            rowIndex++
          }
          i = rowIndex
        }
      }
    }
  }

  // 5. Encabezados de sección clínica (## Sección)
  const sections = markdown.split(/\n(?=##\s+)/)
  for (const sec of sections) {
    const secLines = sec.trim().split('\n')
    const headLine = secLines[0]
    if (headLine.startsWith('## ')) {
      const heading = headLine.replace(/^##\s+/, '').trim()
      // Omitir encabezados genéricos o muy cortos
      if (heading.length >= 3 && !['resumen', 'notas', 'referencias', 'bibliografía'].includes(heading.toLowerCase())) {
        const contentLines = secLines.slice(1).filter((l) => l.trim() && !l.startsWith('#'))
        const content = contentLines.slice(0, 6).join('\n').trim()

        if (content.length >= 20) {
          const front = `${title} — ¿Qué destaca en: **${heading}**?`
          addCard(front, content)
        }
      }
    }
  }

  return cards
}

export interface FlashcardYieldEstimate {
  wordCount: number
  estimatedCards: number
  readTimeMinutes: number
  densityDescription: string
}

/**
 * Calcula la cantidad recomendada de flashcards en base al volumen de palabras
 * del artículo médico (regla de oro: 1 flashcard clínica cada ~50-70 palabras).
 */
export function estimateFlashcardsFromWords(markdown: string): FlashcardYieldEstimate {
  if (!markdown || !markdown.trim()) {
    return {
      wordCount: 0,
      estimatedCards: 0,
      readTimeMinutes: 0,
      densityDescription: 'Artículo vacío',
    }
  }

  // Contar palabras limpiando marcas de formato markdown
  const cleanText = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#*`_~[\]()|>-]/g, ' ')
    .trim()

  const words = cleanText.split(/\s+/).filter((w) => w.length > 0)
  const wordCount = words.length

  if (wordCount < 30) {
    return {
      wordCount,
      estimatedCards: 0,
      readTimeMinutes: 1,
      densityDescription: 'Texto muy breve (< 30 palabras)',
    }
  }

  // 1 card de alto rendimiento clínico cada ~60 palabras (mínimo 3, máx 25)
  const rawCards = Math.round(wordCount / 60)
  const estimatedCards = Math.min(25, Math.max(3, rawCards))
  const readTimeMinutes = Math.max(1, Math.ceil(wordCount / 200))

  let densityDescription = 'Ficha clínica estándar'
  if (wordCount < 200) {
    densityDescription = 'Nota rápida / Resumen conciso'
  } else if (wordCount > 800) {
    densityDescription = 'Guía clínica extensa / Protocolo completo'
  }

  return {
    wordCount,
    estimatedCards,
    readTimeMinutes,
    densityDescription,
  }
}
