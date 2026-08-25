import TurndownService from 'turndown'
import mammoth from 'mammoth'

/**
 * Configuración de Turndown con soporte para tablas Markdown y formato limpio.
 */
function createTurndownService(): TurndownService {
  const turndown = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    strongDelimiter: '**',
  })

  // Regla para tablas Markdown
  turndown.addRule('table', {
    filter: 'table',
    replacement: (_content, node) => {
      const table = node as HTMLTableElement
      const rows = Array.from(table.rows)
      if (rows.length === 0) return ''

      const output: string[] = []

      // Procesar encabezados o primera fila
      const firstRow = rows[0]
      const headers = Array.from(firstRow.cells).map((cell) =>
        cell.textContent?.trim().replace(/\|/g, '\\|') || ' ',
      )
      output.push(`| ${headers.join(' | ')} |`)
      output.push(`| ${headers.map(() => '---').join(' | ')} |`)

      // Procesar filas restantes
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i]
        const cells = Array.from(row.cells).map((cell) =>
          cell.textContent?.trim().replace(/\|/g, '\\|') || ' ',
        )
        // Rellenar si faltan celdas
        while (cells.length < headers.length) cells.push(' ')
        output.push(`| ${cells.join(' | ')} |`)
      }

      return `\n\n${output.join('\n')}\n\n`
    },
  })

  return turndown
}

/**
 * Limpia fragmentos de HTML sucios copiados de Microsoft Word o páginas web y los transforma en Markdown.
 */
export function cleanWordHtml(html: string): string {
  if (!html) return ''

  // 1. Limpieza de comentarios condicionales de Office <!--[if ...]> y etiquetas XML
  let cleaned = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<xml[\s\S]*?<\/xml>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<o:p>[\s\S]*?<\/o:p>/gi, '')
    .replace(/<\/?o:[^>]*>/gi, '')
    .replace(/<\/?w:[^>]*>/gi, '')
    .replace(/<\/?m:[^>]*>/gi, '')

  // 2. Limpieza de viñetas raras de Word
  cleaned = cleaned
    .replace(/[\uF0B7\u00B7\u2022]/g, '-')
    .replace(/<span[^>]*style=["'][^"']*mso-list:[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, '')

  // 3. Conversión a Markdown con Turndown
  const turndown = createTurndownService()
  let md = turndown.turndown(cleaned)

  // 4. Normalizar saltos de línea múltiples
  md = md.replace(/\n{3,}/g, '\n\n').trim()

  return md
}

/**
 * Enriquece texto Markdown detectando patrones clínicos comunes (de ChatGPT, resúmenes)
 * y transformándolos en Callouts visuales estandarizados (> [!WARNING], > [!DOSIS], etc.)
 */
export function enrichClinicalMarkdown(markdown: string): string {
  if (!markdown) return ''

  const lines = markdown.split('\n')
  const result: string[] = []

  let inCodeBlock = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Evitar transformar dentro de bloques de código o diagramas
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock
      result.push(line)
      continue
    }

    if (inCodeBlock) {
      result.push(line)
      continue
    }

    // Patrón 1: Advertencia / Red Flag / Contraindicación / Peligro
    const warningMatch = line.match(
      /^\s*(?:>|\*{1,2}|)\s*(?:ADVERTENCIA|ALERTA|RED FLAGS?|CUIDADO|PELIGRO|CONTRAINDICACI[OÓ]N|PRECAUCI[OÓ]N)\s*:\s*(.*)/i,
    )
    if (warningMatch) {
      const content = warningMatch[1].replace(/\*{1,2}$/, '').trim()
      result.push(`> [!WARNING]`)
      result.push(`> **Advertencia:** ${content || 'Atención prioritaria'}`)
      continue
    }

    // Patrón 2: Dosis / Posología / Farmacoterapia
    const dosageMatch = line.match(
      /^\s*(?:>|\*{1,2}|)\s*(?:DOSIS|POSOLOG[IÍ]A|FARMACOTERAPIA|ADMINISTRACI[OÓ]N)\s*:\s*(.*)/i,
    )
    if (dosageMatch) {
      const content = dosageMatch[1].replace(/\*{1,2}$/, '').trim()
      result.push(`> [!DOSIS]`)
      result.push(`> **Dosificación:** ${content || 'Revisar protocolo de dosis'}`)
      continue
    }

    // Patrón 3: Perla Clínica / Tip / Consejo
    const tipMatch = line.match(
      /^\s*(?:>|\*{1,2}|)\s*(?:PERLA CL[IÍ]NICA|TIP CL[IÍ]NICO|TIP|RECOMENDACI[OÓ]N|CONSEJO)\s*:\s*(.*)/i,
    )
    if (tipMatch) {
      const content = tipMatch[1].replace(/\*{1,2}$/, '').trim()
      result.push(`> [!TIP]`)
      result.push(`> **Perla Clínica:** ${content || 'Recomendación práctica'}`)
      continue
    }

    // Patrón 4: Importante / Criterio / Clave
    const importantMatch = line.match(
      /^\s*(?:>|\*{1,2}|)\s*(?:IMPORTANTE|CRITERIOS? CLAVE|PUNTO CLAVE|RECUERDE)\s*:\s*(.*)/i,
    )
    if (importantMatch) {
      const content = importantMatch[1].replace(/\*{1,2}$/, '').trim()
      result.push(`> [!IMPORTANT]`)
      result.push(`> **Importante:** ${content || 'Criterio diagnóstico/terapéutico clave'}`)
      continue
    }

    result.push(line)
  }

  return result.join('\n')
}

/**
 * Extrae un título sugerido a partir del contenido Markdown importado.
 */
export function extractSuggestedTitle(content: string, fallback = 'Nuevo Artículo'): string {
  if (!content) return fallback

  const lines = content.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Encabezado ATX: # Título o ## Título
    const headerMatch = trimmed.match(/^#{1,3}\s+(.+)$/)
    if (headerMatch) {
      return headerMatch[1].replace(/[*_`]/g, '').trim()
    }

    // Encabezado en negrita: **Título**
    const boldMatch = trimmed.match(/^\*\*(.+?)\*\*$/)
    if (boldMatch) {
      return boldMatch[1].trim()
    }

    // Primera línea de texto regular no muy larga (menor a 60 caracteres)
    if (trimmed.length > 3 && trimmed.length <= 60 && !trimmed.startsWith('>') && !trimmed.startsWith('-')) {
      return trimmed.replace(/[*_`]/g, '').trim()
    }
  }

  return fallback
}

/**
 * Convierte un archivo Microsoft Word (.docx) a Markdown limpio usando Mammoth.js en el navegador.
 */
export async function parseDocxFile(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.convertToHtml({ arrayBuffer })
  const html = result.value
  const md = cleanWordHtml(html)
  return md
}

/**
 * Detecta si el texto ingresado es predominantemente HTML (copiado de Word o web)
 * en vez de texto plano o Markdown.
 */
export function isLikelyHtml(text: string): boolean {
  if (/<html[\s>]|<body[\s>]|<!--\[if|<xml|class="?Mso/i.test(text)) return true
  const htmlTagCount = (text.match(/<\/(?:p|div|table|tr|td|li|ul|ol|h[1-6]|span)>/gi) || []).length
  return htmlTagCount >= 2
}

/**
 * Procesa texto o HTML pegado y lo normaliza a Markdown clínico.
 */
export function processImportText(
  input: string,
  options: { isHtml?: boolean; enrichCallouts?: boolean } = {},
): string {
  let md = input

  // Si contiene estructura HTML evidente o se indica explícitamente
  if (options.isHtml || isLikelyHtml(input)) {
    md = cleanWordHtml(input)
  }

  if (options.enrichCallouts !== false) {
    md = enrichClinicalMarkdown(md)
  }

  return md.trim()
}
