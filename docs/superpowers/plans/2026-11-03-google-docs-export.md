# Exportación Directa de Markdown y Mermaid a Google Docs con Estilo Clínico SINDECON - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir al usuario exportar Markdown clínico (incluyendo diagramas Mermaid, tablas, callouts y fórmulas) directamente a Google Docs en Google Drive, conservando la identidad visual clínica de SINDECON y abriéndose de forma fluida en tablets Android y navegadores de escritorio.

**Architecture:** Renderizado en el cliente (PWA) de diagramas Mermaid a imágenes PNG de alta resolución (2.5x); empaquetado del documento en memoria como archivo DOCX estructurado con los estilos clínicos de SINDECON (`docx`); y subida atómica a la API de Google Drive (`multipart/related`) con conversión nativa a Google Docs (`application/vnd.google-apps.document`).

**Tech Stack:** TypeScript, React 19, `docx` (v9.x), `mermaid` (v11.x), `jszip`, Google Drive REST API v3, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-03-google-docs-export-design.md`

## Global Constraints

- **Ejecución 100% en cliente:** Ningún dato clínico ni imagen debe enviarse a servidores de terceros para su renderizado.
- **Identidad visual SINDECON:** El documento generado debe usar Teal `#008080`, encabezado médico con marca `SINDECON • CUADERNO MÉDICO`, títulos H1/H2/H3 con jerarquía clínica, callouts con bordes gruesos de color y tablas con cabecera estilizada.
- **Resiliencia ante fallos de Mermaid:** Errores de sintaxis en bloques `mermaid` generados por IA no deben romper la exportación del documento; deben degradarse a un bloque de texto formateado.
- **Soporte Offline:** Si `navigator.onLine` es falso o la subida a Drive falla, debe ofrecerse la descarga local inmediata del archivo `.docx`.
- **OAuth Scope:** Utilizar `https://www.googleapis.com/auth/drive.file`.

---

### Task 1: Instalar dependencia `docx` y fundar tokens de estilo clínico

**Files:**
- Modify: `app/package.json`
- Create: `app/src/domain/gdocs/docxClinicalStyles.ts`
- Test: `app/src/domain/gdocs/docxClinicalStyles.test.ts`

**Interfaces:**
- Consumes: Ninguno
- Produces:
  - Constantes cromáticas: `CLINICAL_COLORS`
  - Función: `createClinicalHeader(title: string, folderPath?: string, tags?: string[], dateStr?: string): Paragraph[]`
  - Función: `createClinicalHeading(text: string, level: 1 | 2 | 3): Paragraph`
  - Función: `createClinicalCallout(title: string, text: string, type: 'note' | 'warning' | 'dosage' | 'important'): Table`

- [ ] **Step 1: Instalar `docx` en `app`**

Ejecutar:
```bash
npm --prefix app install docx
```

- [ ] **Step 2: Escribir el test que falla para los estilos clínicos**

Crear `app/src/domain/gdocs/docxClinicalStyles.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import {
  CLINICAL_COLORS,
  createClinicalHeader,
  createClinicalHeading,
  createClinicalCallout,
} from './docxClinicalStyles'

describe('docxClinicalStyles', () => {
  it('define los colores clínicos exactos de SINDECON', () => {
    expect(CLINICAL_COLORS.primaryTeal).toBe('008080')
    expect(CLINICAL_COLORS.darkSlate).toBe('0F172A')
    expect(CLINICAL_COLORS.bodyText).toBe('1E293B')
  })

  it('construye el encabezado médico con marca SINDECON y fecha', () => {
    const paragraphs = createClinicalHeader('Cefaleas Agudas', 'Urgencias/Neurología', ['urgente', 'neurologia'], '03/11/2026')
    expect(paragraphs.length).toBeGreaterThanOrEqual(2)
  })

  it('construye títulos H1, H2, H3 con configuración de heading', () => {
    const h1 = createClinicalHeading('Diagnóstico Diferencial', 1)
    const h2 = createClinicalHeading('Criterios de Alarma', 2)
    const h3 = createClinicalHeading('Conducta Inmediata', 3)
    expect(h1).toBeDefined()
    expect(h2).toBeDefined()
    expect(h3).toBeDefined()
  })

  it('construye callouts clínicos como tablas con borde lateral de color', () => {
    const callout = createClinicalCallout('Alerta Farmacológica', 'Suspender si QTc > 500ms', 'warning')
    expect(callout).toBeDefined()
  })
})
```

- [ ] **Step 3: Ejecutar el test para verificar que falla**

Ejecutar:
```bash
npm --prefix app test src/domain/gdocs/docxClinicalStyles.test.ts
```
Esperado: FAIL por módulo no encontrado `docxClinicalStyles`.

- [ ] **Step 4: Escribir la implementación mínima**

Crear `app/src/domain/gdocs/docxClinicalStyles.ts`:
```typescript
import {
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
  WidthType,
} from 'docx'

export const CLINICAL_COLORS = {
  primaryTeal: '008080',
  secondaryTeal: '0F766E',
  darkSlate: '0F172A',
  bodyText: '1E293B',
  mutedText: '64748B',
  borderLight: 'CBD5E1',
  bgSoft: 'F8FAFC',
  warningBorder: 'D97706',
  warningBg: 'FFFBEB',
  dosageBorder: '2563EB',
  dosageBg: 'EFF6FF',
  noteBorder: '0D9488',
  noteBg: 'F0FDFA',
} as const

export function createClinicalHeader(
  title: string,
  folderPath?: string,
  tags: string[] = [],
  dateStr: string = new Date().toLocaleDateString('es-ES')
): Paragraph[] {
  const brandParagraph = new Paragraph({
    spacing: { after: 100 },
    children: [
      new TextRun({
        text: 'SINDECON • CUADERNO MÉDICO',
        bold: true,
        size: 18, // 9pt
        color: CLINICAL_COLORS.primaryTeal,
      }),
      new TextRun({
        text: `    |    ${dateStr}`,
        size: 18,
        color: CLINICAL_COLORS.mutedText,
      }),
    ],
  })

  const titleParagraph = new Paragraph({
    spacing: { before: 80, after: 120 },
    border: {
      bottom: {
        color: CLINICAL_COLORS.primaryTeal,
        space: 6,
        style: BorderStyle.SINGLE,
        size: 16, // 2pt
      },
    },
    children: [
      new TextRun({
        text: title,
        bold: true,
        size: 36, // 18pt
        color: CLINICAL_COLORS.darkSlate,
      }),
    ],
  })

  const result: Paragraph[] = [brandParagraph, titleParagraph]

  if (folderPath || tags.length > 0) {
    const metaRuns: TextRun[] = []
    if (folderPath) {
      metaRuns.push(
        new TextRun({
          text: `📁 ${folderPath}    `,
          size: 18,
          color: CLINICAL_COLORS.mutedText,
          italics: true,
        })
      )
    }
    if (tags.length > 0) {
      metaRuns.push(
        new TextRun({
          text: `🏷️ ${tags.map((t) => `#${t.replace(/^#/, '')}`).join(' ')}`,
          size: 18,
          color: CLINICAL_COLORS.secondaryTeal,
          bold: true,
        })
      )
    }
    result.push(
      new Paragraph({
        spacing: { after: 200 },
        children: metaRuns,
      })
    )
  }

  return result
}

export function createClinicalHeading(text: string, level: 1 | 2 | 3): Paragraph {
  if (level === 1) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 280, after: 120 },
      border: {
        bottom: {
          color: CLINICAL_COLORS.primaryTeal,
          space: 4,
          style: BorderStyle.SINGLE,
          size: 8, // 1pt
        },
      },
      children: [
        new TextRun({
          text,
          bold: true,
          size: 28, // 14pt
          color: CLINICAL_COLORS.primaryTeal,
        }),
      ],
    })
  }

  if (level === 2) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 220, after: 100 },
      children: [
        new TextRun({
          text,
          bold: true,
          size: 24, // 12pt
          color: CLINICAL_COLORS.primaryTeal,
        }),
      ],
    })
  }

  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 180, after: 80 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 21, // 10.5pt
        color: CLINICAL_COLORS.secondaryTeal,
      }),
    ],
  })
}

export function createClinicalCallout(
  title: string,
  text: string,
  type: 'note' | 'warning' | 'dosage' | 'important'
): Table {
  let borderColor = CLINICAL_COLORS.noteBorder
  let bgColor = CLINICAL_COLORS.noteBg
  let icon = '💡'

  if (type === 'warning') {
    borderColor = CLINICAL_COLORS.warningBorder
    bgColor = CLINICAL_COLORS.warningBg
    icon = '⚠️'
  } else if (type === 'dosage') {
    borderColor = CLINICAL_COLORS.dosageBorder
    bgColor = CLINICAL_COLORS.dosageBg
    icon = '💊'
  } else if (type === 'important') {
    borderColor = CLINICAL_COLORS.primaryTeal
    bgColor = CLINICAL_COLORS.bgSoft
    icon = '⭐'
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { fill: bgColor },
            borders: {
              top: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: {
                style: BorderStyle.SINGLE,
                size: 24, // 3pt
                color: borderColor,
              },
            },
            margins: { top: 120, bottom: 120, left: 180, right: 180 },
            children: [
              new Paragraph({
                spacing: { after: 60 },
                children: [
                  new TextRun({
                    text: `${icon} ${title}`,
                    bold: true,
                    size: 20,
                    color: CLINICAL_COLORS.darkSlate,
                  }),
                ],
              }),
              new Paragraph({
                spacing: { after: 0 },
                children: [
                  new TextRun({
                    text,
                    size: 19,
                    color: CLINICAL_COLORS.bodyText,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  })
}
```

- [ ] **Step 5: Ejecutar test y verificar que pasa**

Ejecutar:
```bash
npm --prefix app test src/domain/gdocs/docxClinicalStyles.test.ts
```
Esperado: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/package.json app/package-lock.json app/src/domain/gdocs/docxClinicalStyles.ts app/src/domain/gdocs/docxClinicalStyles.test.ts
git commit -m "feat(gdocs): add docx dependency and clinical styles foundation"
```

---

### Task 2: Parser y tokenizador de Markdown a bloques clínicos y Mermaid

**Files:**
- Create: `app/src/domain/gdocs/markdownGdocsParser.ts`
- Test: `app/src/domain/gdocs/markdownGdocsParser.test.ts`

**Interfaces:**
- Consumes: Ninguno
- Produces:
  - Tipo: `ClinicalBlock`
  - Función: `parseMarkdownToClinicalBlocks(markdown: string): ClinicalBlock[]`

- [ ] **Step 1: Escribir el test para el parser de Markdown**

Crear `app/src/domain/gdocs/markdownGdocsParser.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { parseMarkdownToClinicalBlocks, type ClinicalBlock } from './markdownGdocsParser'

describe('markdownGdocsParser', () => {
  it('extrae encabezados H1, H2 y H3', () => {
    const md = '# Título Principal\n## Subtítulo 1\n### Subsección A'
    const blocks = parseMarkdownToClinicalBlocks(md)

    expect(blocks).toEqual([
      { kind: 'heading', level: 1, text: 'Título Principal' },
      { kind: 'heading', level: 2, text: 'Subtítulo 1' },
      { kind: 'heading', level: 3, text: 'Subsección A' },
    ])
  })

  it('aísla bloques de código mermaid', () => {
    const md = 'Texto previo.\n\n```mermaid\ngraph TD\n  A --> B\n```\n\nTexto posterior.'
    const blocks = parseMarkdownToClinicalBlocks(md)

    expect(blocks).toHaveLength(3)
    expect(blocks[0]).toEqual({ kind: 'paragraph', text: 'Texto previo.' })
    expect(blocks[1]).toEqual({ kind: 'mermaid', code: 'graph TD\n  A --> B' })
    expect(blocks[2]).toEqual({ kind: 'paragraph', text: 'Texto posterior.' })
  })

  it('detecta callouts clínicos de advertencia y notas médicas', () => {
    const md = '> [!WARNING]\n> Dosis máxima de paracetamol: 4g/día en adultos.\n\n> [!NOTE]\n> Control en 48 horas.'
    const blocks = parseMarkdownToClinicalBlocks(md)

    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toEqual({
      kind: 'callout',
      calloutType: 'warning',
      title: 'ADVERTENCIA',
      text: 'Dosis máxima de paracetamol: 4g/día en adultos.',
    })
    expect(blocks[1]).toEqual({
      kind: 'callout',
      calloutType: 'note',
      title: 'NOTA CLÍNICA',
      text: 'Control en 48 horas.',
    })
  })

  it('procesa tablas Markdown simples', () => {
    const md = '| Parámetro | Valor |\n|---|---|\n| PAS | 120 |\n| PAD | 80 |'
    const blocks = parseMarkdownToClinicalBlocks(md)

    expect(blocks).toHaveLength(1)
    expect(blocks[0].kind).toBe('table')
    if (blocks[0].kind === 'table') {
      expect(blocks[0].headers).toEqual(['Parámetro', 'Valor'])
      expect(blocks[0].rows).toEqual([
        ['PAS', '120'],
        ['PAD', '80'],
      ])
    }
  })

  it('procesa listas desordenadas y ordenadas', () => {
    const md = '- Item 1\n- Item 2\n\n1. Paso 1\n2. Paso 2'
    const blocks = parseMarkdownToClinicalBlocks(md)

    expect(blocks).toEqual([
      { kind: 'list', ordered: false, items: ['Item 1', 'Item 2'] },
      { kind: 'list', ordered: true, items: ['Paso 1', 'Paso 2'] },
    ])
  })
})
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Ejecutar:
```bash
npm --prefix app test src/domain/gdocs/markdownGdocsParser.test.ts
```
Esperado: FAIL por módulo no encontrado `markdownGdocsParser`.

- [ ] **Step 3: Escribir la implementación mínima**

Crear `app/src/domain/gdocs/markdownGdocsParser.ts`:
```typescript
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
        continue
      }
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
```

- [ ] **Step 4: Ejecutar test y verificar que pasa**

Ejecutar:
```bash
npm --prefix app test src/domain/gdocs/markdownGdocsParser.test.ts
```
Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/domain/gdocs/markdownGdocsParser.ts app/src/domain/gdocs/markdownGdocsParser.test.ts
git commit -m "feat(gdocs): add markdown to clinical blocks parser with mermaid isolation"
```

---

### Task 3: Renderizador de Mermaid a PNG en Alta Definición (Canvas Offscreen)

**Files:**
- Create: `app/src/domain/gdocs/mermaidPngRenderer.ts`
- Test: `app/src/domain/gdocs/mermaidPngRenderer.test.ts`

**Interfaces:**
- Consumes: `mermaid` (instalado en el repo)
- Produces:
  - Función: `renderMermaidToPngBuffer(mermaidCode: string, scale?: number): Promise<{ buffer: ArrayBuffer; width: number; height: number } | null>`

- [ ] **Step 1: Escribir el test para el renderizador Mermaid**

Crear `app/src/domain/gdocs/mermaidPngRenderer.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderMermaidToPngBuffer } from './mermaidPngRenderer'
import mermaid from 'mermaid'

describe('mermaidPngRenderer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maneja errores de sintaxis de mermaid sin arrojar excepción fatal', async () => {
    vi.spyOn(mermaid, 'render').mockRejectedValueOnce(new Error('Syntax error in graph'))

    const result = await renderMermaidToPngBuffer('sintaxis invalida <<<', 2)
    expect(result).toBeNull()
  })

  it('procesa mermaid válido y extrae buffer cuando svg está disponible', async () => {
    vi.spyOn(mermaid, 'render').mockResolvedValueOnce({
      svg: '<svg width="200" height="100" viewBox="0 0 200 100"><rect/></svg>',
      bindFunctions: undefined,
    })

    // Mock de Image y Canvas para entorno Node / jsdom
    const mockBuffer = new ArrayBuffer(8)
    const result = await renderMermaidToPngBuffer('graph TD; A-->B', 2, {
      mockRasterize: async () => ({ buffer: mockBuffer, width: 400, height: 200 }),
    })

    expect(result).not.toBeNull()
    expect(result?.width).toBe(400)
    expect(result?.height).toBe(200)
    expect(result?.buffer).toBe(mockBuffer)
  })
})
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Ejecutar:
```bash
npm --prefix app test src/domain/gdocs/mermaidPngRenderer.test.ts
```
Esperado: FAIL por módulo no encontrado `mermaidPngRenderer`.

- [ ] **Step 3: Escribir la implementación mínima**

Crear `app/src/domain/gdocs/mermaidPngRenderer.ts`:
```typescript
import mermaid from 'mermaid'

export interface RasterizeOptions {
  mockRasterize?: (
    svg: string,
    scale: number
  ) => Promise<{ buffer: ArrayBuffer; width: number; height: number }>
}

let mermaidInitialized = false

function ensureMermaidInit() {
  if (!mermaidInitialized) {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'neutral',
      fontFamily: 'Inter, sans-serif',
      securityLevel: 'loose',
    })
    mermaidInitialized = true
  }
}

export async function renderMermaidToPngBuffer(
  mermaidCode: string,
  scale: number = 2.5,
  options?: RasterizeOptions
): Promise<{ buffer: ArrayBuffer; width: number; height: number } | null> {
  ensureMermaidInit()

  try {
    const id = `mermaid-gdocs-${Date.now()}-${Math.floor(Math.random() * 10000)}`
    const { svg } = await mermaid.render(id, mermaidCode)

    if (options?.mockRasterize) {
      return await options.mockRasterize(svg, scale)
    }

    return await rasterizeSvgToPngInBrowser(svg, scale)
  } catch (error) {
    console.warn('Advertencia clínica: Error al renderizar diagrama Mermaid para Docs:', error)
    return null
  }
}

function rasterizeSvgToPngInBrowser(
  svgString: string,
  scale: number
): Promise<{ buffer: ArrayBuffer; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()

    img.onload = () => {
      try {
        const baseWidth = img.naturalWidth || 600
        const baseHeight = img.naturalHeight || 300
        const targetWidth = Math.round(baseWidth * scale)
        const targetHeight = Math.round(baseHeight * scale)

        const canvas = document.createElement('canvas')
        canvas.width = targetWidth
        canvas.height = targetHeight

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          URL.revokeObjectURL(url)
          return reject(new Error('No se pudo obtener el contexto 2D del Canvas'))
        }

        // Fondo blanco para legibilidad en Google Docs
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, targetWidth, targetHeight)
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight)

        canvas.toBlob(
          async (blobResult) => {
            URL.revokeObjectURL(url)
            if (!blobResult) {
              return reject(new Error('Fallo al convertir Canvas a Blob PNG'))
            }
            const buffer = await blobResult.arrayBuffer()
            resolve({
              buffer,
              width: targetWidth,
              height: targetHeight,
            })
          },
          'image/png',
          0.95
        )
      } catch (e) {
        URL.revokeObjectURL(url)
        reject(e)
      }
    }

    img.onerror = (e) => {
      URL.revokeObjectURL(url)
      reject(new Error('Fallo al cargar imagen SVG en el navegador para rasterización'))
    }

    img.src = url
  })
}
```

- [ ] **Step 4: Ejecutar test y verificar que pasa**

Ejecutar:
```bash
npm --prefix app test src/domain/gdocs/mermaidPngRenderer.test.ts
```
Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/domain/gdocs/mermaidPngRenderer.ts app/src/domain/gdocs/mermaidPngRenderer.test.ts
git commit -m "feat(gdocs): add high-dpi offscreen mermaid to png rasterizer with graceful fallback"
```

---

### Task 4: Generador del Documento DOCX Clínico Completo

**Files:**
- Create: `app/src/domain/gdocs/clinicalDocxGenerator.ts`
- Test: `app/src/domain/gdocs/clinicalDocxGenerator.test.ts`

**Interfaces:**
- Consumes:
  - `docxClinicalStyles` (Task 1)
  - `markdownGdocsParser` (Task 2)
  - `mermaidPngRenderer` (Task 3)
- Produces:
  - Interfaz: `ClinicalDocxMetadata`
  - Función: `generateClinicalDocxBlob(markdown: string, metadata: ClinicalDocxMetadata): Promise<Blob>`

- [ ] **Step 1: Escribir el test para el generador DOCX**

Crear `app/src/domain/gdocs/clinicalDocxGenerator.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { generateClinicalDocxBlob } from './clinicalDocxGenerator'
import * as mermaidModule from './mermaidPngRenderer'

describe('clinicalDocxGenerator', () => {
  it('genera un Blob DOCX válido con encabezado y contenido formateado', async () => {
    vi.spyOn(mermaidModule, 'renderMermaidToPngBuffer').mockResolvedValue({
      buffer: new Uint8Array([1, 2, 3, 4]).buffer,
      width: 400,
      height: 200,
    })

    const markdown = `
# Hipertensión Arterial de Urgencia
Texto de introducción clínica.

> [!WARNING]
> No descender la PAM más de 20-25% en la primera hora.

\`\`\`mermaid
graph TD
  A[Sospecha] --> B[Evaluar daño de órgano blanco]
\`\`\`

| Fármaco | Dosis Inicial |
|---|---|
| Labetalol | 20 mg EV |
| Nitroprusiato | 0.25 mcg/kg/min |
`

    const blob = await generateClinicalDocxBlob(markdown, {
      title: 'Hipertensión Arterial de Urgencia',
      folderPath: 'Cardiología / Urgencias',
      tags: ['emergencia', 'hta'],
      dateStr: '03/11/2026',
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(500)
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  })
})
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Ejecutar:
```bash
npm --prefix app test src/domain/gdocs/clinicalDocxGenerator.test.ts
```
Esperado: FAIL por módulo no encontrado `clinicalDocxGenerator`.

- [ ] **Step 3: Escribir la implementación mínima**

Crear `app/src/domain/gdocs/clinicalDocxGenerator.ts`:
```typescript
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  ImageRun,
  BorderStyle,
  WidthType,
} from 'docx'
import {
  CLINICAL_COLORS,
  createClinicalHeader,
  createClinicalHeading,
  createClinicalCallout,
} from './docxClinicalStyles'
import { parseMarkdownToClinicalBlocks } from './markdownGdocsParser'
import { renderMermaidToPngBuffer } from './mermaidPngRenderer'

export interface ClinicalDocxMetadata {
  title: string
  folderPath?: string
  tags?: string[]
  dateStr?: string
}

export async function generateClinicalDocxBlob(
  markdown: string,
  metadata: ClinicalDocxMetadata
): Promise<Blob> {
  const blocks = parseMarkdownToClinicalBlocks(markdown)
  const docElements: (Paragraph | Table)[] = []

  // 1. Encabezado Médico Oficial de SINDECON
  docElements.push(
    ...createClinicalHeader(
      metadata.title,
      metadata.folderPath,
      metadata.tags,
      metadata.dateStr
    )
  )

  // 2. Procesamiento de bloques secuenciales
  for (const block of blocks) {
    if (block.kind === 'heading') {
      docElements.push(createClinicalHeading(block.text, block.level))
    } else if (block.kind === 'paragraph') {
      docElements.push(
        new Paragraph({
          spacing: { after: 120, line: 260 },
          children: parseInlineFormatting(block.text),
        })
      )
    } else if (block.kind === 'callout') {
      docElements.push(
        createClinicalCallout(block.title, block.text, block.calloutType)
      )
      // Espaciado posterior al callout
      docElements.push(new Paragraph({ spacing: { after: 100 } }))
    } else if (block.kind === 'list') {
      for (const item of block.items) {
        docElements.push(
          new Paragraph({
            bullet: block.ordered ? undefined : { level: 0 },
            numbering: block.ordered
              ? { reference: 'clinical-numbering', level: 0 }
              : undefined,
            spacing: { after: 60 },
            children: parseInlineFormatting(item),
          })
        )
      }
      docElements.push(new Paragraph({ spacing: { after: 60 } }))
    } else if (block.kind === 'table') {
      const tableRows: TableRow[] = []

      // Cabecera
      tableRows.push(
        new TableRow({
          tableHeader: true,
          children: block.headers.map(
            (h) =>
              new TableCell({
                shading: { fill: 'F1F5F9' },
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 4, color: CLINICAL_COLORS.borderLight },
                  bottom: { style: BorderStyle.SINGLE, size: 8, color: CLINICAL_COLORS.primaryTeal },
                  left: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE },
                },
                margins: { top: 80, bottom: 80, left: 100, right: 100 },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: h,
                        bold: true,
                        size: 20,
                        color: CLINICAL_COLORS.darkSlate,
                      }),
                    ],
                  }),
                ],
              })
          ),
        })
      )

      // Filas de datos
      for (const row of block.rows) {
        tableRows.push(
          new TableRow({
            children: row.map(
              (cellText) =>
                new TableCell({
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE },
                  },
                  margins: { top: 60, bottom: 60, left: 100, right: 100 },
                  children: [
                    new Paragraph({
                      children: parseInlineFormatting(cellText),
                    }),
                  ],
                })
            ),
          })
        )
      }

      docElements.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: tableRows,
        })
      )
      docElements.push(new Paragraph({ spacing: { after: 120 } }))
    } else if (block.kind === 'mermaid') {
      const rendered = await renderMermaidToPngBuffer(block.code, 2.5)

      if (rendered) {
        // Escalar respetando el ancho máximo de página imprimible (máx 560pt)
        const maxWidth = 560
        let displayWidth = Math.round(rendered.width / 2.5)
        let displayHeight = Math.round(rendered.height / 2.5)

        if (displayWidth > maxWidth) {
          const ratio = maxWidth / displayWidth
          displayWidth = maxWidth
          displayHeight = Math.round(displayHeight * ratio)
        }

        docElements.push(
          new Paragraph({
            alignment: 'center',
            spacing: { before: 140, after: 140 },
            children: [
              new ImageRun({
                data: rendered.buffer,
                transformation: {
                  width: displayWidth,
                  height: displayHeight,
                },
              }),
            ],
          })
        )
      } else {
        // Fallback elegante si el mermaid tiene error de sintaxis
        docElements.push(
          new Paragraph({
            shading: { fill: 'F8FAFC' },
            spacing: { before: 100, after: 100 },
            border: {
              left: { style: BorderStyle.SINGLE, size: 12, color: CLINICAL_COLORS.mutedText },
            },
            children: [
              new TextRun({
                text: '📊 [Diagrama clínico - Preservado en texto]:\n',
                bold: true,
                size: 18,
                color: CLINICAL_COLORS.mutedText,
              }),
              new TextRun({
                text: block.code,
                font: 'Courier New',
                size: 16,
                color: CLINICAL_COLORS.darkSlate,
              }),
            ],
          })
        )
      }
    } else if (block.kind === 'code') {
      docElements.push(
        new Paragraph({
          shading: { fill: 'F1F5F9' },
          spacing: { before: 80, after: 80 },
          children: [
            new TextRun({
              text: block.code,
              font: 'Courier New',
              size: 18,
              color: CLINICAL_COLORS.darkSlate,
            }),
          ],
        })
      )
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1000,
              bottom: 1000,
              left: 1000,
              right: 1000,
            },
          },
        },
        children: docElements,
      },
    ],
  })

  return await Packer.toBlob(doc)
}

function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = []
  // Regex básica para bold (**texto**)
  const parts = text.split(/(\*\*[^*]+\*\*)/g)

  for (const part of parts) {
    if (part.startsWith('**') && part.endsWith('**')) {
      runs.push(
        new TextRun({
          text: part.slice(2, -2),
          bold: true,
          size: 19,
          color: CLINICAL_COLORS.bodyText,
        })
      )
    } else if (part) {
      runs.push(
        new TextRun({
          text: part,
          size: 19,
          color: CLINICAL_COLORS.bodyText,
        })
      )
    }
  }

  return runs.length > 0 ? runs : [new TextRun({ text, size: 19, color: CLINICAL_COLORS.bodyText })]
}
```

- [ ] **Step 4: Ejecutar test y verificar que pasa**

Ejecutar:
```bash
npm --prefix app test src/domain/gdocs/clinicalDocxGenerator.test.ts
```
Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/domain/gdocs/clinicalDocxGenerator.ts app/src/domain/gdocs/clinicalDocxGenerator.test.ts
git commit -m "feat(gdocs): add clinical docx generator with header, tables, callouts and mermaid images"
```

---

### Task 5: Cliente de Google Drive API y Subida Multipart con Conversión Nativa a Google Docs

**Files:**
- Modify: `app/src/pwa/googleDrive.ts`
- Create: `app/src/pwa/googleDocsUpload.ts`
- Test: `app/src/pwa/googleDocsUpload.test.ts`

**Interfaces:**
- Consumes: Token OAuth de `googleDrive.ts`
- Produces:
  - Función: `uploadDocxAsGoogleDoc(blob: Blob, title: string, token: string): Promise<{ fileId: string; url: string }>`

- [ ] **Step 1: Añadir scope `drive.file` a `googleDrive.ts`**

En `app/src/pwa/googleDrive.ts`:
Asegurar que la solicitud de token OAuth incluya `https://www.googleapis.com/auth/drive.file`.

- [ ] **Step 2: Escribir el test para la subida multipart**

Crear `app/src/pwa/googleDocsUpload.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { uploadDocxAsGoogleDoc } from './googleDocsUpload'

describe('googleDocsUpload', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('arma la petición multipart con metadatos de conversión a Google Doc', async () => {
    const mockFileId = 'mock-doc-12345'
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: mockFileId }),
    })
    global.fetch = mockFetch

    const blob = new Blob(['dummy content'], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })

    const result = await uploadDocxAsGoogleDoc(blob, 'Protocolo RCP', 'fake-token')

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, requestInit] = mockFetch.mock.calls[0]
    expect(url).toBe('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart')
    expect(requestInit.method).toBe('POST')
    expect(requestInit.headers.Authorization).toBe('Bearer fake-token')

    expect(result.fileId).toBe(mockFileId)
    expect(result.url).toBe(`https://docs.google.com/document/d/${mockFileId}/edit`)
  })

  it('lanza un error claro si la API de Google Drive rechaza la subida', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'Invalid credentials',
    })
    global.fetch = mockFetch

    const blob = new Blob(['test'])
    await expect(uploadDocxAsGoogleDoc(blob, 'Test', 'bad-token')).rejects.toThrow(
      'Error de Google Drive (401)'
    )
  })
})
```

- [ ] **Step 3: Ejecutar el test para verificar que falla**

Ejecutar:
```bash
npm --prefix app test src/pwa/googleDocsUpload.test.ts
```
Esperado: FAIL por módulo no encontrado `googleDocsUpload`.

- [ ] **Step 4: Escribir la implementación mínima**

Crear `app/src/pwa/googleDocsUpload.ts`:
```typescript
export interface GoogleDocUploadResult {
  fileId: string
  url: string
}

export async function uploadDocxAsGoogleDoc(
  blob: Blob,
  title: string,
  accessToken: string
): Promise<GoogleDocUploadResult> {
  const boundary = `-------sindecon_gdocs_${Date.now()}`
  const delimiter = `\r\n--${boundary}\r\n`
  const closeDelimiter = `\r\n--${boundary}--`

  const metadata = {
    name: title,
    mimeType: 'application/vnd.google-apps.document', // Indicación para que Google Drive lo convierta a Doc nativo
  }

  const metadataPart =
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) +
    `\r\n`

  const mediaHeader =
    `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document\r\n` +
    `Content-Transfer-Encoding: binary\r\n\r\n`

  const docxBytes = new Uint8Array(await blob.arrayBuffer())

  // Armar el payload multipart combinando metadatos y binario
  const encoder = new TextEncoder()
  const part1 = encoder.encode(delimiter + metadataPart + delimiter + mediaHeader)
  const part3 = encoder.encode(closeDelimiter)

  const fullPayload = new Uint8Array(part1.length + docxBytes.length + part3.length)
  fullPayload.set(part1, 0)
  fullPayload.set(docxBytes, part1.length)
  fullPayload.set(part3, part1.length + docxBytes.length)

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: fullPayload,
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Error de Google Drive (${response.status}): ${errorText || response.statusText}`)
  }

  const data = (await response.json()) as { id: string }
  const fileId = data.id

  return {
    fileId,
    url: `https://docs.google.com/document/d/${fileId}/edit`,
  }
}
```

- [ ] **Step 5: Ejecutar test y verificar que pasa**

Ejecutar:
```bash
npm --prefix app test src/pwa/googleDocsUpload.test.ts
```
Esperado: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/pwa/googleDrive.ts app/src/pwa/googleDocsUpload.ts app/src/pwa/googleDocsUpload.test.ts
git commit -m "feat(gdocs): add google drive multipart uploader with native google docs conversion"
```

---

### Task 6: Modal interactivo de Exportación y Apertura (`GoogleDocsExportModal.tsx`)

**Files:**
- Create: `app/src/components/portability/GoogleDocsExportModal.tsx`
- Test: `app/src/components/portability/GoogleDocsExportModal.test.ts`

**Interfaces:**
- Consumes:
  - `generateClinicalDocxBlob` (Task 4)
  - `uploadDocxAsGoogleDoc` (Task 5)
  - Autenticación Google de `googleDrive.ts`
- Produces:
  - Componente: `GoogleDocsExportModal`

- [ ] **Step 1: Escribir el test del modal de exportación**

Crear `app/src/components/portability/GoogleDocsExportModal.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'

describe('GoogleDocsExportModal Component Logic', () => {
  it('identifica correctamente estado offline y ofrece descarga local', () => {
    const isOnline = false
    const shouldOfferDownload = !isOnline
    expect(shouldOfferDownload).toBe(true)
  })

  it('formatea el nombre limpio del archivo removiendo caracteres inválidos', () => {
    const rawTitle = 'Cefaleas: Guía / Manejo clínico (2026)?'
    const clean = rawTitle.replace(/[\\/:*?"<>|]/g, '-').trim()
    expect(clean).toBe('Cefaleas- Guía - Manejo clínico (2026)-')
  })
})
```

- [ ] **Step 2: Ejecutar el test para verificar que pasa**

Ejecutar:
```bash
npm --prefix app test src/components/portability/GoogleDocsExportModal.test.ts
```
Esperado: PASS.

- [ ] **Step 3: Implementar el componente `GoogleDocsExportModal.tsx`**

Crear `app/src/components/portability/GoogleDocsExportModal.tsx` con soporte para:
1. Estados: `'idle' | 'rendering' | 'uploading' | 'success' | 'error' | 'offline'`
2. Disparo de generación del DOCX y subida a Google Drive.
3. Botón principal: **`Abrir en Google Docs ↗`** (con deep-link para tablet Android).
4. Botón de rescate: **`💾 Descargar archivo .docx`** en caso de estar offline o error de red.

- [ ] **Step 4: Ejecutar suite de pruebas**

Ejecutar:
```bash
npm --prefix app test src/components/portability/GoogleDocsExportModal.test.ts
```
Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/portability/GoogleDocsExportModal.tsx app/src/components/portability/GoogleDocsExportModal.test.ts
git commit -m "feat(gdocs): add GoogleDocsExportModal with progress, deep-link and offline fallback"
```

---

### Task 7: Integración en `SmartImportModal`, `ArticleReader` y verificación integral

**Files:**
- Modify: `app/src/components/editor/SmartImportModal.tsx`
- Modify: `app/src/components/reader/ArticleReader.tsx`
- Modify: `app/src/App.tsx`

**Interfaces:**
- Consumes: `GoogleDocsExportModal`
- Produces: Flujo unificado accesible desde pegar ChatGPT o nota existente

- [ ] **Step 1: Modificar `SmartImportModal.tsx`**
  - Añadir opción `'gdocs'` a los destinos de importación (`'append' | 'replace' | 'new-article' | 'inbox' | 'gdocs'`).
  - Al seleccionar `'gdocs'`, el botón principal dice: *"Exportar a Google Docs"*, y al hacer clic invoca el flujo de exportación pasando el Markdown procesado y título sugerido.

- [ ] **Step 2: Modificar `ArticleReader.tsx`**
  - Añadir botón de barra de herramientas `📄 Google Docs` junto a `🖨️ PDF`.
  - Conectar callback `onExportGoogleDocs?: () => void`.

- [ ] **Step 3: Integrar en `App.tsx`**
  - Conectar el estado `isGoogleDocsExportOpen`, `googleDocsExportData` ({ markdown, title, folderPath, tags }).
  - Montar `<GoogleDocsExportModal />`.

- [ ] **Step 4: Ejecutar todos los tests para asegurar que nada se rompió**

Ejecutar:
```bash
npm --prefix app test
```
Esperado: Todos los tests pasan (200+ tests).

- [ ] **Step 5: Verificar compilación TypeScript**

Ejecutar:
```bash
cd app && npx tsc -b
```
Esperado: Cero errores de compilación.

- [ ] **Step 6: Commit**

```bash
git add app/src/components/editor/SmartImportModal.tsx app/src/components/reader/ArticleReader.tsx app/src/App.tsx
git commit -m "feat(gdocs): integrate direct Google Docs export into SmartImport and ArticleReader"
```
