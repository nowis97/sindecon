import {
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
  WidthType,
  Header,
  Footer,
  AlignmentType,
  PageNumber,
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

export const APUNTES_COLORS = {
  headingBlue: '1F4E79',
  titleBorderBlue: '4F81BD',
  bodyText: '222222',
  mutedGray: '666666',
  headerBorderGray: 'D9D9D9',
  tableBorderGray: 'C9C9C9',
  tableHeaderBg: 'D9D2C3',
  tableZebraBg: 'FAF9F6',
  exampleBg: 'F2F2F2',
  exampleBorder: 'B7B7B7',
  pearlBg: 'F3EFE6',
  pearlBorder: 'D9D2C3',
  warningBg: 'FCE8E6',
  warningBorder: '9C2F2F',
  definitionBg: 'F5F5F5',
  definitionBorder: '1F4E79',
} as const

export type ClinicalCalloutType =
  | 'note'
  | 'warning'
  | 'dosage'
  | 'important'
  | 'example'
  | 'pearl'
  | 'tip'
  | 'definition'

export function createApuntesRunningHeader(folderPath?: string): Header {
  const subject = folderPath?.trim()
    ? folderPath.trim().toUpperCase()
    : 'ASIGNATURA'
  return new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        border: {
          bottom: {
            style: BorderStyle.SINGLE,
            size: 4,
            space: 4,
            color: APUNTES_COLORS.headerBorderGray,
          },
        },
        spacing: { after: 0, line: 240 },
        children: [
          new TextRun({
            text: `APUNTES 5TO-2  ·  ${subject}`,
            font: 'Roboto',
            size: 16, // 8pt
            color: APUNTES_COLORS.mutedGray,
          }),
        ],
      }),
    ],
  })
}

export function createApuntesFooter(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 0, line: 240 },
        children: [
          new TextRun({
            text: 'Página ',
            font: 'Roboto',
            size: 16, // 8pt
            color: APUNTES_COLORS.mutedGray,
          }),
          new TextRun({
            children: [PageNumber.CURRENT],
            font: 'Roboto',
            size: 16,
            color: APUNTES_COLORS.mutedGray,
          }),
        ],
      }),
    ],
  })
}

export function createClinicalHeader(
  title: string,
  folderPath?: string,
  tags: string[] = [],
  dateStr?: string,
  subtitleOverride?: string
): Paragraph[] {
  const titleParagraph = new Paragraph({
    spacing: { before: 0, after: 140, line: 240 },
    border: {
      bottom: {
        color: APUNTES_COLORS.titleBorderBlue,
        space: 4,
        style: BorderStyle.SINGLE,
        size: 8, // 1pt
      },
    },
    children: [
      new TextRun({
        text: title,
        font: 'Roboto',
        bold: true,
        size: 36, // 18pt
        color: APUNTES_COLORS.headingBlue,
      }),
    ],
  })

  const subtitleText =
    subtitleOverride?.trim() ||
    `${folderPath?.trim() || 'Asignatura'} · Apuntes 5to-2`

  const subtitleParagraph = new Paragraph({
    spacing: { before: 0, after: 200 },
    children: [
      new TextRun({
        text: subtitleText,
        font: 'Roboto',
        size: 19, // 9.5pt
        color: APUNTES_COLORS.mutedGray,
      }),
    ],
  })

  const result: Paragraph[] = [titleParagraph, subtitleParagraph]

  if (tags.length > 0 || dateStr) {
    const metaRuns: TextRun[] = []
    if (dateStr) {
      metaRuns.push(
        new TextRun({
          text: `${dateStr}    `,
          font: 'Roboto',
          size: 16,
          color: APUNTES_COLORS.mutedGray,
        })
      )
    }
    if (tags.length > 0) {
      metaRuns.push(
        new TextRun({
          text: tags.map((t) => `#${t.replace(/^#/, '')}`).join(' '),
          font: 'Roboto',
          size: 16,
          color: APUNTES_COLORS.headingBlue,
          bold: true,
        })
      )
    }
    if (metaRuns.length > 0) {
      result.push(
        new Paragraph({
          spacing: { after: 120 },
          children: metaRuns,
        })
      )
    }
  }

  return result
}

export function createClinicalHeading(text: string, level: 1 | 2 | 3): Paragraph {
  if (level === 1) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_1,
      keepNext: true,
      keepLines: true,
      spacing: { before: 240, after: 100, line: 240 },
      children: [
        new TextRun({
          text,
          font: 'Roboto',
          bold: true,
          size: 29, // 14.5pt
          color: APUNTES_COLORS.headingBlue,
        }),
      ],
    })
  }

  if (level === 2) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_2,
      keepNext: true,
      keepLines: true,
      spacing: { before: 180, after: 80, line: 240 },
      children: [
        new TextRun({
          text,
          font: 'Roboto',
          bold: true,
          size: 25, // 12.5pt
          color: APUNTES_COLORS.headingBlue,
        }),
      ],
    })
  }

  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    keepNext: true,
    keepLines: true,
    spacing: { before: 120, after: 40, line: 240 },
    children: [
      new TextRun({
        text,
        font: 'Roboto',
        bold: true,
        size: 22, // 11pt
        color: APUNTES_COLORS.bodyText,
      }),
    ],
  })
}

export function createClinicalCallout(
  title: string,
  text: string,
  type: ClinicalCalloutType
): Table {
  let borderColor: string = APUNTES_COLORS.definitionBorder
  let bgColor: string = APUNTES_COLORS.definitionBg
  let borderSize = 10
  let italics = false
  let fontSize = 21

  if (type === 'example') {
    borderColor = APUNTES_COLORS.exampleBorder
    bgColor = APUNTES_COLORS.exampleBg
    borderSize = 8
    italics = true
    fontSize = 20
  } else if (type === 'pearl' || type === 'tip') {
    borderColor = APUNTES_COLORS.pearlBorder
    bgColor = APUNTES_COLORS.pearlBg
    borderSize = 12
  } else if (type === 'warning') {
    borderColor = APUNTES_COLORS.warningBorder
    bgColor = APUNTES_COLORS.warningBg
    borderSize = 12
  } else if (type === 'dosage') {
    borderColor = CLINICAL_COLORS.dosageBorder
    bgColor = CLINICAL_COLORS.dosageBg
    borderSize = 12
  } else if (type === 'important' || type === 'definition' || type === 'note') {
    borderColor = APUNTES_COLORS.definitionBorder
    bgColor = APUNTES_COLORS.definitionBg
    borderSize = 10
  }

  const normalizedTitle = title
    ? title.endsWith(':')
      ? title
      : `${title}:`
    : ''

  const runs: TextRun[] = []
  if (normalizedTitle) {
    runs.push(
      new TextRun({
        text: text ? `${normalizedTitle} ` : normalizedTitle,
        font: 'Roboto',
        bold: true,
        italics,
        size: fontSize,
        color: APUNTES_COLORS.bodyText,
      })
    )
  }
  if (text) {
    runs.push(
      new TextRun({
        text,
        font: 'Roboto',
        italics,
        size: fontSize,
        color: APUNTES_COLORS.bodyText,
      })
    )
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
                size: borderSize,
                color: borderColor,
              },
            },
            margins: { top: 80, bottom: 80, left: 160, right: 120 },
            children: [
              new Paragraph({
                alignment: AlignmentType.JUSTIFIED,
                spacing: { before: 0, after: 0, line: 240 },
                children: runs,
              }),
            ],
          }),
        ],
      }),
    ],
  })
}
