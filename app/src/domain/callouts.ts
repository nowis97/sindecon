export type ClinicalCalloutKind =
  | 'warning'
  | 'tip'
  | 'dosage'
  | 'important'
  | 'note'
  | 'example'
  | 'definition'

export interface ResolvedBracketCallout {
  isSecondaryNote: boolean
  kind: ClinicalCalloutKind
  rawTag: string
  defaultTitle: string
  gdocsType: 'warning' | 'dosage' | 'important' | 'note' | 'pearl' | 'tip' | 'example' | 'definition'
  gdocsDefaultTitle: string
  title: string
  text: string
  hasCustomTitle: boolean
}

interface TagMeta {
  kind: ClinicalCalloutKind
  defaultTitle: string
  gdocsType: ResolvedBracketCallout['gdocsType']
  gdocsDefaultTitle: string
  isSecondaryNote?: boolean
}

const EXACT_CALLOUT_TAGS: Record<string, TagMeta> = {
  WARNING: { kind: 'warning', defaultTitle: 'Advertencia', gdocsType: 'warning', gdocsDefaultTitle: 'ADVERTENCIA' },
  ALERTA: { kind: 'warning', defaultTitle: 'Advertencia', gdocsType: 'warning', gdocsDefaultTitle: 'ADVERTENCIA' },
  ADVERTENCIA: { kind: 'warning', defaultTitle: 'Advertencia', gdocsType: 'warning', gdocsDefaultTitle: 'Advertencia:' },
  'RED-FLAGS': { kind: 'warning', defaultTitle: 'Advertencia', gdocsType: 'warning', gdocsDefaultTitle: 'ADVERTENCIA' },
  RED_FLAGS: { kind: 'warning', defaultTitle: 'Advertencia', gdocsType: 'warning', gdocsDefaultTitle: 'ADVERTENCIA' },
  CAUTION: { kind: 'warning', defaultTitle: 'Advertencia', gdocsType: 'warning', gdocsDefaultTitle: 'ADVERTENCIA' },
  PELIGRO: { kind: 'warning', defaultTitle: 'Advertencia', gdocsType: 'warning', gdocsDefaultTitle: 'ADVERTENCIA' },

  TIP: { kind: 'tip', defaultTitle: 'Perla clínica', gdocsType: 'note', gdocsDefaultTitle: 'CONSEJO CLÍNICO' },
  PEARL: { kind: 'tip', defaultTitle: 'Perla clínica', gdocsType: 'pearl', gdocsDefaultTitle: 'Perla clínica:' },
  PERLA: { kind: 'tip', defaultTitle: 'Perla clínica', gdocsType: 'pearl', gdocsDefaultTitle: 'Perla clínica:' },
  'PERLA-CLINICA': { kind: 'tip', defaultTitle: 'Perla clínica', gdocsType: 'pearl', gdocsDefaultTitle: 'Perla clínica:' },
  PERLA_CLINICA: { kind: 'tip', defaultTitle: 'Perla clínica', gdocsType: 'pearl', gdocsDefaultTitle: 'Perla clínica:' },
  'PERLA CLÍNICA': { kind: 'tip', defaultTitle: 'Perla clínica', gdocsType: 'pearl', gdocsDefaultTitle: 'Perla clínica:' },
  'PERLA CLINICA': { kind: 'tip', defaultTitle: 'Perla clínica', gdocsType: 'pearl', gdocsDefaultTitle: 'Perla clínica:' },
  CONSEJO: { kind: 'tip', defaultTitle: 'Perla clínica', gdocsType: 'note', gdocsDefaultTitle: 'CONSEJO CLÍNICO' },

  EXAMPLE: { kind: 'example', defaultTitle: 'Ejemplo clínico', gdocsType: 'example', gdocsDefaultTitle: 'Ejemplo clínico:' },
  EJEMPLO: { kind: 'example', defaultTitle: 'Ejemplo clínico', gdocsType: 'example', gdocsDefaultTitle: 'Ejemplo clínico:' },
  'EJEMPLO-CLINICO': { kind: 'example', defaultTitle: 'Ejemplo clínico', gdocsType: 'example', gdocsDefaultTitle: 'Ejemplo clínico:' },
  EJEMPLO_CLINICO: { kind: 'example', defaultTitle: 'Ejemplo clínico', gdocsType: 'example', gdocsDefaultTitle: 'Ejemplo clínico:' },
  CASO: { kind: 'example', defaultTitle: 'Ejemplo clínico', gdocsType: 'example', gdocsDefaultTitle: 'Ejemplo clínico:' },

  DEFINITION: { kind: 'definition', defaultTitle: 'Definición', gdocsType: 'definition', gdocsDefaultTitle: 'Definición:' },
  DEFINICION: { kind: 'definition', defaultTitle: 'Definición', gdocsType: 'definition', gdocsDefaultTitle: 'Definición:' },
  DEFINICIÓN: { kind: 'definition', defaultTitle: 'Definición', gdocsType: 'definition', gdocsDefaultTitle: 'Definición:' },
  DEF: { kind: 'definition', defaultTitle: 'Definición', gdocsType: 'definition', gdocsDefaultTitle: 'Definición:' },

  DOSIS: { kind: 'dosage', defaultTitle: 'Dosis y Farmacología', gdocsType: 'dosage', gdocsDefaultTitle: 'DOSIFICACIÓN' },
  DOSAGE: { kind: 'dosage', defaultTitle: 'Dosis y Farmacología', gdocsType: 'dosage', gdocsDefaultTitle: 'DOSIFICACIÓN' },
  FARMACO: { kind: 'dosage', defaultTitle: 'Dosis y Farmacología', gdocsType: 'dosage', gdocsDefaultTitle: 'DOSIFICACIÓN' },
  MEDICACION: { kind: 'dosage', defaultTitle: 'Dosis y Farmacología', gdocsType: 'dosage', gdocsDefaultTitle: 'DOSIFICACIÓN' },
  DRUG: { kind: 'dosage', defaultTitle: 'Dosis y Farmacología', gdocsType: 'dosage', gdocsDefaultTitle: 'DOSIFICACIÓN' },

  IMPORTANT: { kind: 'important', defaultTitle: 'Importante', gdocsType: 'important', gdocsDefaultTitle: 'IMPORTANTE' },
  IMPORTANTE: { kind: 'important', defaultTitle: 'Importante', gdocsType: 'important', gdocsDefaultTitle: 'IMPORTANTE' },
  OJO: { kind: 'important', defaultTitle: 'Importante', gdocsType: 'important', gdocsDefaultTitle: 'IMPORTANTE' },

  NOTA: { kind: 'note', defaultTitle: 'Nota Clínica', gdocsType: 'note', gdocsDefaultTitle: 'NOTA CLÍNICA', isSecondaryNote: true },
  'NOTA-SECUNDARIA': { kind: 'note', defaultTitle: 'Nota Clínica', gdocsType: 'note', gdocsDefaultTitle: 'NOTA CLÍNICA', isSecondaryNote: true },
  NOTA_SECUNDARIA: { kind: 'note', defaultTitle: 'Nota Clínica', gdocsType: 'note', gdocsDefaultTitle: 'NOTA CLÍNICA', isSecondaryNote: true },
  SECONDARY: { kind: 'note', defaultTitle: 'Nota Clínica', gdocsType: 'note', gdocsDefaultTitle: 'NOTA CLÍNICA', isSecondaryNote: true },

  NOTE: { kind: 'note', defaultTitle: 'Nota Clínica', gdocsType: 'note', gdocsDefaultTitle: 'NOTA CLÍNICA' },
  INFO: { kind: 'note', defaultTitle: 'Nota Clínica', gdocsType: 'note', gdocsDefaultTitle: 'NOTA CLÍNICA' },
}

const PEARL_DEFAULT_TITLES = new Set([
  'perla clinica',
  'perla clínica',
  'perla',
  'tip',
  'tip clinico',
  'tip clínico',
  'consejo clinico',
  'consejo clínico',
])

const MODIFIER_CONTINUATION_RE = /^(?:de|del|en|para|sobre|con|eunacom|clinica|clínica|quirurgica|quirúrgica|diagnostica|diagnóstica|terapeutica|terapéutica|farmacologica|farmacológica)\b/i

/** Normaliza escapes comunes de Milkdown en marcadores `[!...]` y `:`. */
export function normalizeCalloutMarkdownEscapes(raw: string): string {
  return raw
    .replace(/\\+\[/g, '[')
    .replace(/\\+\]/g, ']')
    .replace(/\\+:/g, ':')
}

export function isGenericPearlTitle(title: string): boolean {
  const clean = title.trim().replace(/:$/, '').toLowerCase()
  return PEARL_DEFAULT_TITLES.has(clean)
}

/** Limpia corchetes externos `[Nombre]` sin alterar wikilinks `[[...]]` ni links Markdown `[t](url)`. */
export function stripWrappingBrackets(raw: string): string {
  const trimmed = raw.trim()
  if (
    trimmed.startsWith('[') &&
    trimmed.endsWith(']') &&
    !trimmed.startsWith('[[') &&
    !trimmed.endsWith(']]') &&
    !/\]\([^)]*\)$/.test(trimmed)
  ) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

function splitBracketedPrefix(text: string): { title: string; rest: string } | null {
  const m = text.trim().match(/^\[(?!\[)([^\]\n]*\p{L}[^\]\n]*)\](?!\()(?:\s*[:\-–—]\s*|\s+)?([\s\S]*)$/u)
  if (!m) return null
  const title = m[1].trim()
  if (!title || title.length > 90) return null
  return { title, rest: (m[2] || '').trim() }
}

function splitInlineLabel(text: string): { title: string; rest: string; bold: boolean } | null {
  const trimmed = text.trim()
  if (!trimmed || /^[-*+]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) return null

  const boldColon = trimmed.match(/^(?:\*\*|\*)([^*\n]{2,80}?):?\*(?:\*)?\s*:\s*([\s\S]*)$/)
    || trimmed.match(/^(?:\*\*|\*)([^*\n]{2,80}?):(?:\*\*|\*)\s*([\s\S]*)$/)
  if (boldColon) {
    const title = stripWrappingBrackets(boldColon[1].trim().replace(/:$/, '').trim())
    if (title) return { title, rest: (boldColon[2] || '').trim(), bold: true }
  }

  const plainColon = trimmed.match(/^([^:\n]{2,55}):\s+([\s\S]+)$/)
  if (plainColon) {
    const candidate = stripWrappingBrackets(plainColon[1].trim())
    if (candidate && !/^https?$/i.test(candidate) && !candidate.includes('](')) {
      return { title: candidate, rest: plainColon[2].trim(), bold: false }
    }
  }

  return null
}

function parseCalloutInnerHeader(innerRaw: string): {
  meta: TagMeta
  rawTag: string
  innerTitle: string
} {
  const inner = innerRaw.trim()
  const exact = EXACT_CALLOUT_TAGS[inner.toUpperCase()]
  if (exact) {
    return { meta: exact, rawTag: inner.toUpperCase(), innerTitle: '' }
  }

  // Ejemplos: [!PERLA: Criterio de Light], [!PERLA - ECG], [!PERLA Criterio], [!PERLA_ECG]
  const sepMatch = inner.match(/^([\p{L}]+)\s*[:\-–—]\s*(.+)$/u)
    || inner.match(/^([\p{L}]+)[_-](.+)$/u)
    || inner.match(/^([\p{L}]+)\s+(.+)$/u)

  if (sepMatch) {
    const headTag = sepMatch[1].toUpperCase()
    const headMeta = EXACT_CALLOUT_TAGS[headTag]
    const remainder = sepMatch[2].trim()

    if (headMeta) {
      const usedExplicitSep = /^[\p{L}]+\s*(?:[:\-–—]|[_-])\s*/u.test(inner)
      if (!usedExplicitSep && headMeta.kind === 'tip' && MODIFIER_CONTINUATION_RE.test(remainder)) {
        // Conserva títulos naturales como [!Perla de ECG] o [!Perla en urgencias] completos
        return {
          meta: EXACT_CALLOUT_TAGS.PERLA,
          rawTag: 'PERLA',
          innerTitle: stripWrappingBrackets(inner),
        }
      }
      return {
        meta: headMeta,
        rawTag: headTag,
        innerTitle: stripWrappingBrackets(remainder),
      }
    }
  }

  // Marcador con nombre propio directo entre corchetes: [!Criterio de Light], [!Hiponatremia]
  return {
    meta: EXACT_CALLOUT_TAGS.PERLA,
    rawTag: 'PERLA',
    innerTitle: stripWrappingBrackets(inner),
  }
}

/**
 * Resuelve encabezados y títulos de callouts clínicos desde todas sus variantes:
 * - `> [!PERLA] Nombre dado` (1 o más líneas)
 * - `> [!PERLA] [Nombre dado]`
 * - `> [!PERLA: Nombre dado]` / `> [!PERLA - Nombre dado]`
 * - `> [!Nombre dado]`
 * - `> [!PERLA]\n> [Nombre dado]...` o `> [!PERLA]\n> **Nombre dado:** ...`
 */
export function resolveBracketCallout(
  rawHeaderLine: string,
  rawBodyLines: string[],
  options: { joinBodyWith?: string } = {},
): ResolvedBracketCallout | null {
  const normalizedHeader = normalizeCalloutMarkdownEscapes(rawHeaderLine.trim())
  const headerMatch = normalizedHeader.match(/^\[!([^\]]+)\](.*)$/)
  if (!headerMatch) return null

  const { meta, rawTag, innerTitle } = parseCalloutInnerHeader(headerMatch[1])
  const afterBracket = (headerMatch[2] || '').trim()
  const bodyLines = rawBodyLines.map((l) => normalizeCalloutMarkdownEscapes(l))

  let customTitle = innerTitle
  let inlineBody = ''

  if (customTitle) {
    inlineBody = afterBracket.replace(/^[:\-–—]\s*/, '').trim()
  } else if (afterBracket) {
    const bracketAfter = splitBracketedPrefix(afterBracket)
    if (bracketAfter) {
      customTitle = bracketAfter.title
      inlineBody = bracketAfter.rest
    } else if (bodyLines.length === 0 && meta.kind === 'tip') {
      // Una sola línea: `> [!PERLA] Criterio: cuerpo` o `> [!PERLA] Nombre solo:`
      const singleLineColon = afterBracket.match(/^([^:\n]{2,60}):\s*([\s\S]*)$/)
      if (singleLineColon && !/^https?$/i.test(singleLineColon[1].trim())) {
        customTitle = stripWrappingBrackets(singleLineColon[1].trim())
        inlineBody = singleLineColon[2].trim()
      } else {
        customTitle = stripWrappingBrackets(afterBracket.replace(/:$/, '').trim())
      }
    } else {
      customTitle = stripWrappingBrackets(afterBracket)
    }
  }

  const normalizedBodyLines = inlineBody ? [inlineBody, ...bodyLines] : [...bodyLines]

  // Caso especial existente: [!DOSIS] seguido por línea `Dosificación: ...`
  if (!customTitle && meta.kind === 'dosage' && normalizedBodyLines.length > 0) {
    if (normalizedBodyLines[0].trim().toLowerCase().startsWith('dosificación:')) {
      customTitle = normalizedBodyLines.shift()!.trim()
    }
  }

  // Si no hubo título junto a [!PERLA], revisar [Nombre] o **Nombre:** al inicio del cuerpo
  if (!customTitle && normalizedBodyLines.length > 0) {
    const firstTrimmed = normalizedBodyLines[0].trim()
    const bodyBracket = splitBracketedPrefix(firstTrimmed)
    if (bodyBracket) {
      customTitle = bodyBracket.title
      if (bodyBracket.rest) {
        normalizedBodyLines[0] = bodyBracket.rest
      } else {
        normalizedBodyLines.shift()
      }
    } else if (meta.kind === 'tip') {
      const bodyLabel = splitInlineLabel(firstTrimmed)
      if (bodyLabel) {
        customTitle = bodyLabel.title
        if (bodyLabel.rest) {
          normalizedBodyLines[0] = bodyLabel.rest
        } else {
          normalizedBodyLines.shift()
        }
      }
    }
  }

  const text = normalizedBodyLines.join(options.joinBodyWith ?? '\n').trim()
  const hasCustomTitle =
    Boolean(customTitle) && !(meta.kind === 'tip' && isGenericPearlTitle(customTitle))

  return {
    isSecondaryNote: Boolean(meta.isSecondaryNote),
    kind: meta.kind,
    rawTag,
    defaultTitle: meta.defaultTitle,
    gdocsType: hasCustomTitle && meta.kind === 'tip' ? 'pearl' : meta.gdocsType,
    gdocsDefaultTitle: meta.gdocsDefaultTitle,
    title: customTitle || meta.defaultTitle,
    text,
    hasCustomTitle,
  }
}

export interface NaturalPearlMatch {
  title: string
  text: string
  hasCustomTitle: boolean
  inlineFormat: boolean
}

/**
 * Reconoce párrafos de perla naturales:
 * - Genérica: `Perla clínica: ...` / `**Perla clínica:** ...` (mantiene formato inline compacto)
 * - Nombrada: `**Perla de ECG:** ...`, `Perla quirúrgica: ...`, `Perla [Criterio de Light]: ...`
 */
export function matchNaturalPearlParagraph(trimmed: string): NaturalPearlMatch | null {
  const normalized = normalizeCalloutMarkdownEscapes(trimmed)

  const generic = normalized.match(
    /^(?:\*\*|\*)?(Perla\s+cl[ií]nica)(?:\*\*|\*)?\s*:\s*(?:\*\*|\*)?\s*(.+)$/i,
  )
  if (generic) {
    return {
      title: `${generic[1].trim()}:`,
      text: generic[2].trim(),
      hasCustomTitle: false,
      inlineFormat: true,
    }
  }

  const boldNamed =
    normalized.match(/^\*\*(Perla(?:\s+[^*\n]{1,60})?)\*\*\s*:\s*([\s\S]+)$/i) ||
    normalized.match(/^\*\*(Perla(?:\s+[^*\n]{1,60})?):\*\*\s*([\s\S]+)$/i)
  if (boldNamed) {
    const cleanTitle = stripNamedPearlLabel(boldNamed[1])
    return {
      title: cleanTitle,
      text: boldNamed[2].trim(),
      hasCustomTitle: !isGenericPearlTitle(cleanTitle),
      inlineFormat: isGenericPearlTitle(cleanTitle),
    }
  }

  const bracketNamed = normalized.match(
    /^(?:\*\*|\*)?\[(Perla(?:\s*[:\-–—]\s*|\s+)[^\]\n]{1,60})\](?:\*\*|\*)?(?:\s*:\s*|\s+)([\s\S]+)$/i,
  )
  if (bracketNamed) {
    const cleanTitle = stripNamedPearlLabel(bracketNamed[1])
    return {
      title: cleanTitle,
      text: bracketNamed[2].trim(),
      hasCustomTitle: true,
      inlineFormat: false,
    }
  }

  const unboldedNamed = normalized.match(
    /^(Perla\s+(?:EUNACOM|quir[uú]rgica|diagn[oó]stica|terap[eé]utica|farmacol[oó]gica|de\s+[^:\n]{2,45}|\[[^\]\n]{2,50}\]))\s*:\s*([\s\S]+)$/i,
  )
  if (unboldedNamed) {
    const cleanTitle = stripNamedPearlLabel(unboldedNamed[1])
    return {
      title: cleanTitle,
      text: unboldedNamed[2].trim(),
      hasCustomTitle: true,
      inlineFormat: false,
    }
  }

  return null
}

function stripNamedPearlLabel(raw: string): string {
  const inner = stripWrappingBrackets(raw.trim().replace(/:$/, '').trim())
  const bracketedTail = inner.match(/^Perla\s*(?:[:\-–—]\s*|\s+)?\[([^\]\n]+)\]$/i)
  if (bracketedTail) {
    return bracketedTail[1].trim()
  }
  const colonTail = inner.match(/^Perla\s*[:\-–—]\s*(.+)$/i)
  if (colonTail) {
    return colonTail[1].trim()
  }
  return inner
}
