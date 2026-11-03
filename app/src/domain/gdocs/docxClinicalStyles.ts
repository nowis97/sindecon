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
  let borderColor: string = CLINICAL_COLORS.noteBorder
  let bgColor: string = CLINICAL_COLORS.noteBg
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
