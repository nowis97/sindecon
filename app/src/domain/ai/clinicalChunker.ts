export interface ClinicalChunk {
  title: string
  sectionType: 'diagnosis' | 'treatment' | 'alert' | 'general'
  content: string
  wordCount: number
}

/**
 * Determina el tipo de sección clínica basado en el título o contenido.
 */
export function detectSectionType(title: string, content: string): 'diagnosis' | 'treatment' | 'alert' | 'general' {
  const lowerTitle = title.toLowerCase()
  const lowerContent = content.slice(0, 400).toLowerCase()
  const combined = `${lowerTitle} ${lowerContent}`

  // Si tiene callout explícito de advertencia o título específico de alarma
  if (content.includes('> [!WARNING]') || lowerTitle.includes('alerta') || lowerTitle.includes('alarma') || lowerTitle.includes('red flag') || lowerTitle.includes('banderas rojas')) {
    return 'alert'
  }
  // Tratamiento, fármacos y posología
  if (lowerTitle.includes('tratam') || lowerTitle.includes('terap') || lowerTitle.includes('dosis') || lowerTitle.includes('fármac') || lowerTitle.includes('farmaco') || lowerTitle.includes('posolog') || lowerTitle.includes('esquema') || combined.includes('dosis:') || combined.includes('mg/')) {
    return 'treatment'
  }
  // Diagnóstico, clínica y criterios
  if (lowerTitle.includes('diag') || lowerTitle.includes('criterio') || lowerTitle.includes('clínic') || lowerTitle.includes('clinic') || lowerTitle.includes('signo') || lowerTitle.includes('síntoma') || lowerTitle.includes('sintoma') || lowerTitle.includes('laboratorio') || lowerTitle.includes('gold standard') || lowerTitle.includes('estudio')) {
    return 'diagnosis'
  }
  // Fallbacks de urgencia general
  if (lowerTitle.includes('urgencia') || lowerTitle.includes('emergencia')) {
    return 'alert'
  }
  return 'general'
}

/**
 * Cuenta palabras simples en un texto.
 */
export function countWords(text: string): number {
  if (!text || !text.trim()) return 0
  return text.trim().split(/\s+/).length
}

/**
 * Divide un artículo Markdown en fragmentos clínicos semánticos respetando encabezados, tablas y límites de tokens.
 */
export function chunkClinicalMarkdown(
  articleTitle: string,
  markdown: string,
  maxWordsPerChunk = 450,
  maxChunks = 6
): ClinicalChunk[] {
  if (!markdown || !markdown.trim()) {
    return []
  }

  // 1. Limpieza inicial: eliminar imágenes base64 pesadas
  const cleaned = markdown.replace(/!\[(.*?)\]\(data:image\/[^;]+;base64,[^)]+\)/g, '![$1]([imagen])').trim()

  // 2. Dividir por encabezados H2 o H3 (## o ###)
  const headingRegex = /(?:^|\n)(#{1,3}\s+[^\n]+)/g
  const matches = [...cleaned.matchAll(headingRegex)]

  if (matches.length === 0) {
    // No hay encabezados claros: dividir por bloques de párrafos
    return chunkByParagraphs(articleTitle, cleaned, maxWordsPerChunk)
  }

  const rawSections: { heading: string; body: string }[] = []
  let lastIndex = 0

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const matchIndex = match.index!
    const headingText = match[1].replace(/^#{1,3}\s+/, '').trim()

    if (i === 0 && matchIndex > 0) {
      const preamble = cleaned.substring(0, matchIndex).trim()
      if (preamble) {
        rawSections.push({ heading: articleTitle || 'Introducción General', body: preamble })
      }
    }

    const nextMatchIndex = i + 1 < matches.length ? matches[i + 1].index! : cleaned.length
    const body = cleaned.substring(matchIndex + match[0].length, nextMatchIndex).trim()
    rawSections.push({ heading: headingText, body })
    lastIndex = nextMatchIndex
  }

  if (lastIndex < cleaned.length) {
    const trailing = cleaned.substring(lastIndex).trim()
    if (trailing) {
      rawSections.push({ heading: 'Notas Complementarias', body: trailing })
    }
  }

  // 3. Procesar cada sección clínica detectada
  const chunks: ClinicalChunk[] = []

  for (const sec of rawSections) {
    const secWords = countWords(sec.body)
    if (!sec.body.trim()) continue

    if (secWords > maxWordsPerChunk) {
      // Si la sección individual supera el límite, partir por bloques de párrafos
      const subChunks = chunkByParagraphs(sec.heading, sec.body, maxWordsPerChunk)
      chunks.push(...subChunks)
    } else {
      chunks.push({
        title: sec.heading || articleTitle,
        sectionType: detectSectionType(sec.heading, sec.body),
        content: `### ${sec.heading}\n${sec.body}`.trim(),
        wordCount: secWords,
      })
    }
  }

  const rawChunks = chunks.filter(c => c.content.length > 0)
  if (rawChunks.length <= maxChunks) {
    return rawChunks
  }

  // Priorizar las secciones más determinantes en la toma de decisiones clínicas
  return selectTopClinicalChunks(rawChunks, maxChunks)
}

/**
 * Selecciona los chunks más relevantes clínicamente cuando un artículo es muy extenso,
 * preservando el orden secuencial del documento.
 */
function selectTopClinicalChunks(chunks: ClinicalChunk[], maxChunks: number): ClinicalChunk[] {
  const priorityMap: Record<ClinicalChunk['sectionType'], number> = {
    alert: 4,
    treatment: 3,
    diagnosis: 2,
    general: 1,
  }

  // Mapear con su índice original para restaurar el orden de lectura
  const indexed = chunks.map((chunk, index) => ({
    chunk,
    index,
    score: (priorityMap[chunk.sectionType] || 1) * 1000 + Math.min(500, chunk.wordCount),
  }))

  // Ordenar por relevancia clínica y seleccionar los mejores
  indexed.sort((a, b) => b.score - a.score)
  const selected = indexed.slice(0, maxChunks)

  // Restaurar el orden original en el documento
  selected.sort((a, b) => a.index - b.index)
  return selected.map(s => s.chunk)
}

/**
 * Divide un texto plano o sin encabezados en párrafos contiguos.
 */
function chunkByParagraphs(baseTitle: string, text: string, maxWords: number): ClinicalChunk[] {
  const paragraphs = text.split(/\n\s*\n/)
  const result: ClinicalChunk[] = []
  let buffer = ''
  let partIndex = 1

  for (const para of paragraphs) {
    const trimmed = para.trim()
    if (!trimmed) continue

    const candidate = buffer ? `${buffer}\n\n${trimmed}` : trimmed
    if (countWords(candidate) <= maxWords) {
      buffer = candidate
    } else {
      if (buffer) {
        result.push({
          title: paragraphs.length > 3 ? `${baseTitle} (Parte ${partIndex++})` : baseTitle,
          sectionType: detectSectionType(baseTitle, buffer),
          content: buffer,
          wordCount: countWords(buffer)
        })
      }
      buffer = trimmed
    }
  }

  if (buffer) {
    result.push({
      title: result.length > 0 ? `${baseTitle} (Parte ${partIndex})` : baseTitle,
      sectionType: detectSectionType(baseTitle, buffer),
      content: buffer,
      wordCount: countWords(buffer)
    })
  }

  return result
}

/**
 * Genera el prompt médico especializado para cada chunk clínico según su tipo.
 */
export function getSectionSpecializedPrompt(articleTitle: string, chunk: ClinicalChunk, targetCards: number): string {
  let focusGuidance = ''

  switch (chunk.sectionType) {
    case 'diagnosis':
      focusGuidance = `
Enfócate con prioridad en:
- Criterios diagnósticos cardinales (sensibilidad/especificidad o criterios mayores/menores).
- Signos y síntomas patognomónicos o diferenciales.
- Estudio diagnóstico de elección (Gold Standard) y hallazgos radiológicos/laboratoriales clave.
`.trim()
      break
    case 'treatment':
      focusGuidance = `
Enfócate con prioridad en:
- Fármacos de primera línea y alternativas según severidad.
- Dosis exactas con unidades médicas (mg, mcg/kg/min, g/día), vías de administración y duración.
- Contraindicaciones absolutas y efectos adversos críticos.
- Formato estructurado en tabla Markdown si hay múltiples fármacos o escalones.
`.trim()
      break
    case 'alert':
      focusGuidance = `
Enfócate con prioridad en:
- Criterios de alarma y signos de deterioro clínico inminente (Red Flags).
- Conductas médicas de emergencia inmediata (primeros 15-60 minutos).
- Errores clínicos comunes a evitar (Don'ts / Contraindicaciones en urgencias).
`.trim()
      break
    default:
      focusGuidance = `
Enfócate en perlas clínicas de alto rendimiento, mecanismos fisiopatológicos determinantes y conceptos de examen o pase de visita médica.
`.trim()
      break
  }

  return `
Eres un médico experto en educación clínica y memorización activa de alto rendimiento (Anki/SM-2).
Analiza el siguiente fragmento del tema "${articleTitle}" titulado "${chunk.title}".
Genera EXACTAMENTE ${targetCards} flashcard(s) clínica(s) de alto rendimiento.

${focusGuidance}

REGLAS ESTRICTAS:
1. Genera EXACTAMENTE ${targetCards} flashcards (ni más ni menos).
2. "front": Pregunta directa, clínica y sin ambigüedad (ej. "¿Cuál es el estudio de elección en sospecha de ${chunk.title}?").
3. "back": Respuesta estructurada en Markdown (negritas en datos clave, listas o tablas).
4. Devuelve ÚNICAMENTE un array JSON válido con la estructura:
[
  {
    "front": "Pregunta médica...",
    "back": "Respuesta en Markdown..."
  }
]

CONTENIDO DE LA SECCIÓN:
${chunk.content}
`.trim()
}
