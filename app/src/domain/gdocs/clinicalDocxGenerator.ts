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
  AlignmentType,
  SectionType,
  VerticalAlign,
  LevelFormat,
  type ISectionOptions,
} from 'docx'
import {
  APUNTES_COLORS,
  CLINICAL_COLORS,
  createApuntesFooter,
  createApuntesRunningHeader,
  createClinicalHeader,
  createClinicalHeading,
  createClinicalCallout,
} from './docxClinicalStyles'
import {
  parseMarkdownToClinicalBlocks,
  type ClinicalBlock,
} from './markdownGdocsParser'
import { renderMermaidToPngBuffer } from './mermaidPngRenderer'

export interface ClinicalDocxMetadata {
  title: string
  folderPath?: string
  tags?: string[]
  dateStr?: string
}

const APUNTES_PAGE_PROPS = {
  size: {
    width: 11906,
    height: 16838,
  },
  margin: {
    top: 1020,
    right: 1020,
    bottom: 1020,
    left: 1020,
    header: 567,
    footer: 567,
    gutter: 0,
  },
} as const

interface EnrichedGdocsData {
  effectiveTitle: string
  subtitleOverride?: string
  sections: Array<{ fullWidth: boolean; blocks: ClinicalBlock[] }>
}

function isSubtitleBlock(block: ClinicalBlock | undefined): block is Extract<ClinicalBlock, { kind: 'paragraph' }> {
  if (!block || block.kind !== 'paragraph') return false
  if (block.variant === 'subtitle') return true
  return /(?:·|\|)\s*Apuntes\s+5to-2/i.test(block.text) || /^Asignatura\s*·/i.test(block.text.trim())
}

function prepareGdocsSections(
  blocks: ClinicalBlock[],
  metadata: ClinicalDocxMetadata
): EnrichedGdocsData {
  let startIndex = 0
  let effectiveTitle = metadata.title
  let subtitleOverride: string | undefined

  const first = blocks[0]
  if (first && first.kind === 'heading' && first.level === 1) {
    const firstNorm = first.text.trim().toLowerCase()
    const titleNorm = metadata.title.trim().toLowerCase()
    const isPlaceholder =
      first.text.trim().toUpperCase() === 'TÍTULO DEL TEMA' ||
      first.text.trim().toLowerCase() === '{título}' ||
      first.text.trim().toLowerCase() === '{titulo}'
    const isSectionLikeTitle = /^(?:introducci[oó]n|tabla\b|continuaci[oó]n\b|bibliograf[ií]a|resumen)\b/i.test(
      first.text.trim(),
    )
    if (firstNorm === titleNorm || isPlaceholder || isSubtitleBlock(blocks[1]) || !isSectionLikeTitle) {
      if (isPlaceholder && metadata.title.trim()) {
        effectiveTitle = metadata.title
      } else {
        effectiveTitle = first.text.trim()
      }
      startIndex = 1
    }
  }

  if (isSubtitleBlock(blocks[startIndex])) {
    const rawSub = (blocks[startIndex] as Extract<ClinicalBlock, { kind: 'paragraph' }>).text.trim()
    subtitleOverride =
      metadata.folderPath?.trim() && /^Asignatura\s*·/i.test(rawSub)
        ? rawSub.replace(/^Asignatura/i, metadata.folderPath.trim())
        : rawSub
    startIndex++
  }

  const enriched: ClinicalBlock[] = []
  let inFullWidthSection = false
  let inBibliographySection = false
  let bibCounter = 1

  for (const raw of blocks.slice(startIndex)) {
    const block: ClinicalBlock = { ...raw }

    if (block.kind === 'heading') {
      inFullWidthSection = /ancho\s+completo|full\s*width|1\s*col(?:umna)?/i.test(block.text)
      inBibliographySection = /^bibliograf[ií]a$|^referencias$|^fuentes$/i.test(block.text.trim())
      if (inBibliographySection) {
        bibCounter = 1
      }
      if (inFullWidthSection) {
        block.fullWidth = true
      }
      enriched.push(block)
      continue
    }

    if (inFullWidthSection) {
      block.fullWidth = true
    }

    if (block.kind === 'table') {
      const colCount = Math.max(block.headers.length, ...block.rows.map((r) => r.length), 0)
      if (colCount >= 3) {
        block.fullWidth = true
      }
    } else if (block.kind === 'mermaid') {
      block.fullWidth = true
    } else if (block.kind === 'paragraph') {
      const prev = enriched[enriched.length - 1]
      const isAfterVisual = prev && (prev.kind === 'table' || prev.kind === 'mermaid')
      const looksLikeCaption =
        block.variant === 'caption' ||
        /^(?:Tabla|Figura|Cuadro|Algoritmo|Esquema|Gr[aá]fico)\b/i.test(block.text.trim()) ||
        /^\*[^*]+\*$/.test(block.text.trim())

      if (block.variant === 'subtitle') {
        if (metadata.folderPath?.trim() && /^Asignatura\s*·/i.test(block.text.trim())) {
          block.text = block.text.trim().replace(/^Asignatura/i, metadata.folderPath.trim())
        }
      } else if (block.variant === 'bibliography') {
        // Marcador REF: preservado como bibliografía
      } else if (block.variant === 'secondary') {
        // Marcador > [!NOTA] preservado como nota secundaria
      } else if (block.variant === 'caption' || (isAfterVisual && looksLikeCaption)) {
        block.variant = 'caption'
        if (isAfterVisual && prev.fullWidth) {
          block.fullWidth = true
        }
      } else if (
        /^Nota\s+secundaria\s*:/i.test(block.text.trim()) ||
        /^Este bloque est[aá] en una sola columna/i.test(block.text.trim()) ||
        (inFullWidthSection && (!prev || prev.kind === 'heading'))
      ) {
        block.variant = 'secondary'
      } else if (inBibliographySection) {
        block.variant = 'bibliography'
      }
    } else if (block.kind === 'list' && inBibliographySection) {
      block.isBibliography = true
      block.startNumber = bibCounter
      bibCounter += block.items.length
    }

    enriched.push(block)
  }

  const sections: Array<{ fullWidth: boolean; blocks: ClinicalBlock[] }> = []
  for (const b of enriched) {
    const fw = Boolean(b.fullWidth)
    const last = sections[sections.length - 1]
    if (!last || last.fullWidth !== fw) {
      sections.push({ fullWidth: fw, blocks: [b] })
    } else {
      last.blocks.push(b)
    }
  }

  return { effectiveTitle, subtitleOverride, sections }
}

async function renderBlocksToDocElements(
  blocks: ClinicalBlock[],
  inTwoColumns: boolean
): Promise<(Paragraph | Table)[]> {
  const docElements: (Paragraph | Table)[] = []

  for (const block of blocks) {
    if (block.kind === 'heading') {
      docElements.push(createClinicalHeading(block.text, block.level))
    } else if (block.kind === 'paragraph') {
      if (block.variant === 'subtitle') {
        docElements.push(
          new Paragraph({
            spacing: { before: 0, after: 200, line: 240 },
            children: parseInlineFormatting(block.text, {
              size: 19, // 9.5pt
              color: APUNTES_COLORS.mutedGray,
            }),
          })
        )
      } else if (block.variant === 'caption') {
        docElements.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 40, after: 120, line: 240 },
            children: parseInlineFormatting(block.text, {
              size: 18, // 9pt
              color: APUNTES_COLORS.mutedGray,
              italics: true,
            }),
          })
        )
      } else if (block.variant === 'secondary') {
        docElements.push(
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { before: 0, after: 100, line: 240 },
            children: parseInlineFormatting(block.text, {
              size: 19, // 9.5pt
              color: APUNTES_COLORS.mutedGray,
            }),
          })
        )
      } else if (block.variant === 'bibliography') {
        docElements.push(
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { before: 0, after: 60, line: 240 },
            indent: { left: 283, hanging: 283 },
            children: parseInlineFormatting(block.text, {
              size: 18, // 9pt
              color: APUNTES_COLORS.bodyText,
            }),
          })
        )
      } else {
        docElements.push(
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { before: 0, after: 100, line: 264 },
            children: parseInlineFormatting(block.text, {
              size: 21, // 10.5pt
              color: APUNTES_COLORS.bodyText,
            }),
          })
        )
      }
    } else if (block.kind === 'callout') {
      docElements.push(
        createClinicalCallout(block.title, block.text, block.calloutType)
      )
      docElements.push(new Paragraph({ spacing: { before: 0, after: 60 } }))
    } else if (block.kind === 'list') {
      if (block.isBibliography) {
        const startNum = block.startNumber ?? 1
        block.items.forEach((item, idx) => {
          docElements.push(
            new Paragraph({
              alignment: AlignmentType.JUSTIFIED,
              spacing: { before: 0, after: 60, line: 240 },
              indent: { left: 283, hanging: 283 },
              children: [
                new TextRun({
                  text: `${startNum + idx}. `,
                  font: 'Roboto',
                  size: 18,
                  color: APUNTES_COLORS.bodyText,
                }),
                ...parseInlineFormatting(item, {
                  size: 18,
                  color: APUNTES_COLORS.bodyText,
                }),
              ],
            })
          )
        })
      } else {
        block.items.forEach((item, idx) => {
          const itemLevel = block.itemLevels?.[idx] ?? 0
          docElements.push(
            new Paragraph({
              alignment: AlignmentType.JUSTIFIED,
              numbering: {
                reference: block.ordered ? 'clinical-numbering' : 'clinical-bullets',
                level: itemLevel,
              },
              spacing: { before: 0, after: 60, line: 252 },
              children: parseInlineFormatting(item, {
                size: 21,
                color: APUNTES_COLORS.bodyText,
              }),
            })
          )
        })
        docElements.push(new Paragraph({ spacing: { before: 0, after: 40 } }))
      }
    } else if (block.kind === 'table') {
      const tableRows: TableRow[] = []

      // Cabecera (#D9D2C3)
      tableRows.push(
        new TableRow({
          tableHeader: true,
          children: block.headers.map(
            (h) =>
              new TableCell({
                shading: { fill: APUNTES_COLORS.tableHeaderBg },
                verticalAlign: VerticalAlign.CENTER,
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 4, color: APUNTES_COLORS.tableBorderGray },
                  bottom: { style: BorderStyle.SINGLE, size: 4, color: APUNTES_COLORS.tableBorderGray },
                  left: { style: BorderStyle.SINGLE, size: 4, color: APUNTES_COLORS.tableBorderGray },
                  right: { style: BorderStyle.SINGLE, size: 4, color: APUNTES_COLORS.tableBorderGray },
                },
                margins: { top: 70, bottom: 70, left: 100, right: 100 },
                children: [
                  new Paragraph({
                    spacing: { before: 0, after: 40, line: 240 },
                    children: [
                      new TextRun({
                        text: h,
                        font: 'Roboto',
                        bold: true,
                        size: 19, // 9.5pt
                        color: APUNTES_COLORS.bodyText,
                      }),
                    ],
                  }),
                ],
              })
          ),
        })
      )

      // Filas de datos (bandas alternadas #FFFFFF / #FAF9F6)
      block.rows.forEach((row, rIdx) => {
        const fill = rIdx % 2 === 1 ? APUNTES_COLORS.tableZebraBg : 'FFFFFF'
        tableRows.push(
          new TableRow({
            children: row.map(
              (cellText) =>
                new TableCell({
                  shading: { fill },
                  verticalAlign: VerticalAlign.CENTER,
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 4, color: APUNTES_COLORS.tableBorderGray },
                    bottom: { style: BorderStyle.SINGLE, size: 4, color: APUNTES_COLORS.tableBorderGray },
                    left: { style: BorderStyle.SINGLE, size: 4, color: APUNTES_COLORS.tableBorderGray },
                    right: { style: BorderStyle.SINGLE, size: 4, color: APUNTES_COLORS.tableBorderGray },
                  },
                  margins: { top: 70, bottom: 70, left: 100, right: 100 },
                  children: [
                    new Paragraph({
                      spacing: { before: 0, after: 40, line: 240 },
                      children: parseInlineFormatting(cellText, {
                        size: 19, // 9.5pt
                        color: APUNTES_COLORS.bodyText,
                      }),
                    }),
                  ],
                })
            ),
          })
        )
      })

      docElements.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: tableRows,
        })
      )
      docElements.push(new Paragraph({ spacing: { before: 0, after: 60 } }))
    } else if (block.kind === 'mermaid') {
      const rendered = await renderMermaidToPngBuffer(block.code, 2.5)

      if (rendered) {
        const maxWidth = inTwoColumns ? 260 : 560
        let displayWidth = Math.round(rendered.width / 2.5)
        let displayHeight = Math.round(rendered.height / 2.5)

        if (displayWidth > maxWidth) {
          const ratio = maxWidth / displayWidth
          displayWidth = maxWidth
          displayHeight = Math.round(displayHeight * ratio)
        }

        docElements.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 120, after: 120 },
            children: [
              new ImageRun({
                data: rendered.buffer,
                type: 'png',
                transformation: {
                  width: displayWidth,
                  height: displayHeight,
                },
              }),
            ],
          })
        )
      } else {
        docElements.push(
          new Paragraph({
            shading: { fill: APUNTES_COLORS.definitionBg },
            spacing: { before: 100, after: 100 },
            border: {
              left: { style: BorderStyle.SINGLE, size: 10, color: APUNTES_COLORS.headingBlue },
            },
            children: [
              new TextRun({
                text: '📊 [Diagrama clínico - Preservado en texto]:\n',
                font: 'Roboto',
                bold: true,
                size: 18,
                color: APUNTES_COLORS.mutedGray,
              }),
              new TextRun({
                text: block.code,
                font: 'Courier New',
                size: 16,
                color: APUNTES_COLORS.bodyText,
              }),
            ],
          })
        )
      }
    } else if (block.kind === 'code') {
      docElements.push(
        new Paragraph({
          shading: { fill: APUNTES_COLORS.definitionBg },
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

  return docElements
}

export async function generateClinicalDocxBlob(
  markdown: string,
  metadata: ClinicalDocxMetadata
): Promise<Blob> {
  const blocks = parseMarkdownToClinicalBlocks(markdown)
  const { effectiveTitle, subtitleOverride, sections } = prepareGdocsSections(
    blocks,
    metadata
  )

  const headerElements = createClinicalHeader(
    effectiveTitle,
    metadata.folderPath,
    metadata.tags,
    metadata.dateStr,
    subtitleOverride
  )

  const runningHeader = createApuntesRunningHeader(metadata.folderPath)
  const runningFooter = createApuntesFooter()

  const docSections: ISectionOptions[] = [
    {
      headers: { default: runningHeader },
      footers: { default: runningFooter },
      properties: {
        page: APUNTES_PAGE_PROPS,
        column: {
          count: 1,
          space: 397,
          equalWidth: true,
        },
      },
      children: headerElements,
    },
  ]

  for (const segment of sections) {
    const segmentElements = await renderBlocksToDocElements(
      segment.blocks,
      !segment.fullWidth
    )
    if (segmentElements.length === 0) continue

    docSections.push({
      properties: {
        type: SectionType.CONTINUOUS,
        page: APUNTES_PAGE_PROPS,
        column: segment.fullWidth
          ? {
              count: 1,
              space: 397,
              equalWidth: true,
            }
          : {
              count: 2,
              space: 397,
              equalWidth: true,
            },
      },
      children: segmentElements,
    })
  }

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'clinical-bullets',
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '\u2022',
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: 454, hanging: 227 },
                },
                run: {
                  font: 'Roboto',
                  size: 21,
                },
              },
            },
            {
              level: 1,
              format: LevelFormat.BULLET,
              text: '\u25E6',
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: 737, hanging: 227 },
                },
                run: {
                  font: 'Roboto',
                  size: 21,
                },
              },
            },
            {
              level: 2,
              format: LevelFormat.BULLET,
              text: '\u25AA',
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: 1020, hanging: 227 },
                },
                run: {
                  font: 'Roboto',
                  size: 21,
                },
              },
            },
          ],
        },
        {
          reference: 'clinical-numbering',
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: '%1.',
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: 454, hanging: 227 },
                },
                run: {
                  font: 'Roboto',
                  size: 21,
                },
              },
            },
            {
              level: 1,
              format: LevelFormat.LOWER_LETTER,
              text: '%2.',
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: 737, hanging: 227 },
                },
                run: {
                  font: 'Roboto',
                  size: 21,
                },
              },
            },
          ],
        },
      ],
    },
    sections: docSections,
  })

  return await Packer.toBlob(doc)
}

function parseInlineFormatting(
  text: string,
  opts: { size?: number; color?: string; italics?: boolean } = {}
): TextRun[] {
  const size = opts.size ?? 21
  const color = opts.color ?? APUNTES_COLORS.bodyText
  const baseItalics = opts.italics ?? false
  const runs: TextRun[] = []
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)

  for (const part of parts) {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      runs.push(
        new TextRun({
          text: part.slice(2, -2),
          font: 'Roboto',
          bold: true,
          italics: baseItalics,
          size,
          color,
        })
      )
    } else if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      runs.push(
        new TextRun({
          text: part.slice(1, -1),
          font: 'Roboto',
          italics: true,
          size,
          color,
        })
      )
    } else if (part) {
      runs.push(
        new TextRun({
          text: part,
          font: 'Roboto',
          italics: baseItalics,
          size,
          color,
        })
      )
    }
  }

  return runs.length > 0
    ? runs
    : [new TextRun({ text, font: 'Roboto', italics: baseItalics, size, color })]
}
