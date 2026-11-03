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
            alignment: AlignmentType.CENTER,
            spacing: { before: 140, after: 140 },
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
