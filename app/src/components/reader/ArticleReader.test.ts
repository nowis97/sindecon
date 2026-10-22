import { describe, it, expect } from 'vitest'
import {
  parseMarkdownBlocks,
  partitionBlocksIntoSheets,
  estimateBlockHeight,
  paginateTwoColumnBlocks,
  A4_TWO_COLUMN_CAPACITY_PX,
} from './ArticleReader'

describe('parseMarkdownBlocks - Bloques Multicolumna (:::columns)', () => {
  it('parsea correctamente un bloque de 2 columnas con encabezados y listas', () => {
    const md = `
# Título Principal

:::columns
### Columna Izquierda
- Criterio 1
- Criterio 2

|||

### Columna Derecha
- Tratamiento A
- Tratamiento B
:::

Párrafo posterior
`.trim()

    const blocks = parseMarkdownBlocks(md)
    expect(blocks.length).toBe(3)
    expect(blocks[0].type).toBe('header')
    expect(blocks[1].type).toBe('columns')
    expect(blocks[2].type).toBe('paragraph')

    if (blocks[1].type === 'columns') {
      expect(blocks[1].columns.length).toBe(2)

      // Columna 1
      const col1 = blocks[1].columns[0]
      expect(col1[0]).toEqual({ type: 'header', level: 3, text: 'Columna Izquierda' })
      expect(col1[1].type).toBe('list')

      // Columna 2
      const col2 = blocks[1].columns[1]
      expect(col2[0]).toEqual({ type: 'header', level: 3, text: 'Columna Derecha' })
      expect(col2[1].type).toBe('list')
    }
  })

  it('parsea dinámicamente 3 columnas con dos separadores |||', () => {
    const md = `
:::columns
### Leve
Amoxicilina

|||

### Moderado
Ceftriaxona

|||

### Severo
Ceftriaxona + Claritromicina
:::
`.trim()

    const blocks = parseMarkdownBlocks(md)
    expect(blocks.length).toBe(1)
    expect(blocks[0].type).toBe('columns')

    if (blocks[0].type === 'columns') {
      expect(blocks[0].columns.length).toBe(3)
      expect(blocks[0].columns[0][0]).toEqual({ type: 'header', level: 3, text: 'Leve' })
      expect(blocks[0].columns[1][0]).toEqual({ type: 'header', level: 3, text: 'Moderado' })
      expect(blocks[0].columns[2][0]).toEqual({ type: 'header', level: 3, text: 'Severo' })
    }
  })

  it('soporta callouts, tablas y formatos anidados dentro de las columnas', () => {
    const md = `
:::columns
> [!WARNING] Alerta
> Criterio de gravedad.

|||

| Fármaco | Dosis |
| --- | --- |
| Amikacina | 15 mg/kg |
:::
`.trim()

    const blocks = parseMarkdownBlocks(md)
    expect(blocks.length).toBe(1)
    expect(blocks[0].type).toBe('columns')

    if (blocks[0].type === 'columns') {
      expect(blocks[0].columns[0][0].type).toBe('callout')
      expect(blocks[0].columns[1][0].type).toBe('table')
    }
  })

  it('cierra automáticamente y sin error un bloque :::columns que no tiene delimitador de cierre al final', () => {
    const md = `
:::columns
### Columna 1
Texto columna 1

|||

### Columna 2
Texto columna 2
`.trim()

    const blocks = parseMarkdownBlocks(md)
    expect(blocks.length).toBe(1)
    expect(blocks[0].type).toBe('columns')
    if (blocks[0].type === 'columns') {
      expect(blocks[0].columns.length).toBe(2)
    }
  })

  it('soporta markdown serializado por WYSIWYG con tags <br /> o <br>', () => {
    const md = ':::columns<br />### Diagnóstico Clínico<br />- Criterios Framingham<br />|||<br />### Tratamiento<br />- Diuréticos<br />:::'
    const blocks = parseMarkdownBlocks(md)
    expect(blocks.length).toBe(1)
    expect(blocks[0].type).toBe('columns')
    if (blocks[0].type === 'columns') {
      expect(blocks[0].columns.length).toBe(2)
      expect(blocks[0].columns[0][0]).toEqual({ type: 'header', level: 3, text: 'Diagnóstico Clínico' })
      expect(blocks[0].columns[0][1].type).toBe('list')
      expect(blocks[0].columns[1][0]).toEqual({ type: 'header', level: 3, text: 'Tratamiento' })
      expect(blocks[0].columns[1][1].type).toBe('list')
    }
  })

  it('soporta variantes en español y escapes de colons/pipes (:::columnas, \\:\\:\\:, \\|\\|\\|)', () => {
    const md = `
\\\\:\\\\:\\\\:columnas
### Col A
Dato 1

\\\\|\\\\|\\\\|

### Col B
Dato 2
\\\\:\\\\:\\\\:
`.trim()

    const blocks = parseMarkdownBlocks(md)
    expect(blocks.length).toBe(1)
    expect(blocks[0].type).toBe('columns')
    if (blocks[0].type === 'columns') {
      expect(blocks[0].columns.length).toBe(2)
      expect(blocks[0].columns[0][0]).toEqual({ type: 'header', level: 3, text: 'Col A' })
      expect(blocks[0].columns[1][0]).toEqual({ type: 'header', level: 3, text: 'Col B' })
    }
  })
})

describe('parseMarkdownBlocks - Párrafos y Bloques Estándar para Modo Lector', () => {
  it('parsea correctamente párrafos estándar, citas y listas ordenadas/desordenadas', () => {
    const md = `
# Insuficiencia Cardíaca

La insuficiencia cardíaca es un síndrome clínico complejo caracterizado por anomalías estructurales o funcionales del corazón.

> Criterio clínico fundamental: presencia de síntomas típicos acompañados de signos cardinales.

- Disnea de esfuerzo
- Ortopnea
- Edema maleolar bilateral

1. Solicitar ecocardiograma transtorácico
2. Medir biomarcadores NT-proBNP
`.trim()

    const blocks = parseMarkdownBlocks(md)
    expect(blocks.length).toBe(5)
    expect(blocks[0]).toEqual({ type: 'header', level: 1, text: 'Insuficiencia Cardíaca' })
    expect(blocks[1].type).toBe('paragraph')
    expect(blocks[2].type).toBe('blockquote')
    expect(blocks[3].type).toBe('list')
    expect((blocks[3] as any).ordered).toBe(false)
    expect(blocks[4].type).toBe('list')
    expect((blocks[4] as any).ordered).toBe(true)
  })

  it('parsea callouts clínicos (warning, tip, dosage, note)', () => {
    const md = `
> [!WARNING] Criterios de Alarma
> Ingreso inmediato si PAS < 90 mmHg.

> [!DOSIS] Furosemida
> 20 a 40 mg IV inicial.
`.trim()

    const blocks = parseMarkdownBlocks(md)
    expect(blocks.length).toBe(2)
    expect(blocks[0].type).toBe('callout')
    expect((blocks[0] as any).kind).toBe('warning')
    expect(blocks[1].type).toBe('callout')
    expect((blocks[1] as any).kind).toBe('dosage')
  })

  it('parsea correctamente bloques de imágenes médicas standalone', () => {
    const md = `
# Radiología de Tórax

![FIGURA 51-3 Radiografía de tórax en IC](asset://image-rx-thorax-123)

Párrafo posterior a la imagen.
`.trim()

    const blocks = parseMarkdownBlocks(md)
    expect(blocks.length).toBe(3)
    expect(blocks[0]).toEqual({ type: 'header', level: 1, text: 'Radiología de Tórax' })
    expect(blocks[1]).toEqual({
      type: 'image',
      alt: 'FIGURA 51-3 Radiografía de tórax en IC',
      src: 'asset://image-rx-thorax-123',
    })
    expect(blocks[2].type).toBe('paragraph')
  })

  it('parsea imágenes médicas dentro de bloques de columnas paralelas (:::columns)', () => {
    const md = `
:::columns
### Panel A
![Rx A](asset://panel-a)

|||

### Panel B
![Rx B](asset://panel-b)
:::
`.trim()

    const blocks = parseMarkdownBlocks(md)
    expect(blocks.length).toBe(1)
    expect(blocks[0].type).toBe('columns')
    if (blocks[0].type === 'columns') {
      expect(blocks[0].columns.length).toBe(2)
      expect(blocks[0].columns[0][1]).toEqual({
        type: 'image',
        alt: 'Rx A',
        src: 'asset://panel-a',
      })
      expect(blocks[0].columns[1][1]).toEqual({
        type: 'image',
        alt: 'Rx B',
        src: 'asset://panel-b',
      })
    }
  })

  it('reconoce y parsea bloques de documentos PDF standalone', () => {
    const md = `
# Guía Clínica

[pdf](asset://1111-2222-3333)

[pdf: Guía de Hipertensión 2024](asset://4444-5555)

[algoritmo.pdf](asset://6666-7777)
`
    const blocks = parseMarkdownBlocks(md)
    expect(blocks).toHaveLength(4)
    expect(blocks[0]).toEqual({ type: 'header', level: 1, text: 'Guía Clínica' })
    expect(blocks[1]).toEqual({ type: 'pdf', src: 'asset://1111-2222-3333', title: undefined })
    expect(blocks[2]).toEqual({ type: 'pdf', src: 'asset://4444-5555', title: 'Guía de Hipertensión 2024' })
    expect(blocks[3]).toEqual({ type: 'pdf', src: 'asset://6666-7777', title: 'algoritmo.pdf' })
  })
})

describe('parseMarkdownBlocks - Callouts clínicos con corchetes escapados y directos', () => {
  it('parsea callout con corchetes escapados (ej. \\[!DOSIS\\])', () => {
    const md = `
\\[!DOSIS\\]
Dosificación: Revisar protocolo de dosis
400–800 μg.
`.trim()

    const blocks = parseMarkdownBlocks(md)
    expect(blocks.length).toBe(1)
    expect(blocks[0].type).toBe('callout')
    if (blocks[0].type === 'callout') {
      expect(blocks[0].kind).toBe('dosage')
      expect(blocks[0].title).toBe('Dosificación: Revisar protocolo de dosis')
      expect(blocks[0].text).toContain('400–800 μg.')
    }
  })

  it('parsea callout con bloque de cita escapado (> \\[!DOSIS\\])', () => {
    const md = `
> \\[!DOSIS\\] Pauta rápida
> 100 μg IV bolo lento.
`.trim()

    const blocks = parseMarkdownBlocks(md)
    expect(blocks.length).toBe(1)
    expect(blocks[0].type).toBe('callout')
    if (blocks[0].type === 'callout') {
      expect(blocks[0].kind).toBe('dosage')
      expect(blocks[0].title).toBe('Pauta rápida')
      expect(blocks[0].text).toBe('100 μg IV bolo lento.')
    }
  })

  it('limpia backslashes de salto de línea al final de línea', () => {
    const md = `
Dosis

1 g IV en 10 mL\\
Concentración: 100 mg/mL.
`.trim()

    const blocks = parseMarkdownBlocks(md)
    expect(blocks.length).toBe(3)
    if (blocks[1].type === 'paragraph') {
      expect(blocks[1].text).not.toContain('mL\\')
    }
  })
})

describe('partitionBlocksIntoSheets - Segmentación en Hojas A4', () => {
  it('retorna una única hoja vacía si no hay bloques', () => {
    const sheets = partitionBlocksIntoSheets([])
    expect(sheets.length).toBe(1)
    expect(sheets[0]).toEqual([])
  })

  it('mantiene todos los bloques en una sola hoja si no hay regla horizontal', () => {
    const md = `
# Sección 1
Texto de la primera sección.

## Sección 2
Texto de la segunda sección.
`.trim()

    const blocks = parseMarkdownBlocks(md)
    const sheets = partitionBlocksIntoSheets(blocks)

    expect(sheets.length).toBe(1)
    expect(sheets[0].length).toBe(4)
    expect(sheets[0][0].type).toBe('header')
    expect(sheets[0][1].type).toBe('paragraph')
  })

  it('segmenta en múltiples hojas A4 cuando hay saltos de página con reglas horizontales (---)', () => {
    const md = `
# Página 1
Contenido médico inicial.

---

# Página 2
Contenido médico en la siguiente hoja.

---

# Página 3
Conclusiones y tratamiento.
`.trim()

    const blocks = parseMarkdownBlocks(md)
    const sheets = partitionBlocksIntoSheets(blocks)

    expect(sheets.length).toBe(3)

    // Hoja 1
    expect(sheets[0].length).toBe(2)
    expect(sheets[0][0]).toEqual({ type: 'header', level: 1, text: 'Página 1' })
    expect(sheets[0][1]).toEqual({ type: 'paragraph', text: 'Contenido médico inicial.' })

    // Hoja 2
    expect(sheets[1].length).toBe(2)
    expect(sheets[1][0]).toEqual({ type: 'header', level: 1, text: 'Página 2' })
    expect(sheets[1][1]).toEqual({ type: 'paragraph', text: 'Contenido médico en la siguiente hoja.' })

    // Hoja 3
    expect(sheets[2].length).toBe(2)
    expect(sheets[2][0]).toEqual({ type: 'header', level: 1, text: 'Página 3' })
    expect(sheets[2][1]).toEqual({ type: 'paragraph', text: 'Conclusiones y tratamiento.' })
  })

  it('no genera hojas fantasma si hay una regla horizontal al final del documento', () => {
    const md = `
# Título
Párrafo único.

---
`.trim()

    const blocks = parseMarkdownBlocks(md)
    const sheets = partitionBlocksIntoSheets(blocks)

    expect(sheets.length).toBe(1)
    expect(sheets[0].length).toBe(2)
  })
})

describe('estimateBlockHeight', () => {
  it('calcula alturas estimadas acordes a la jerarquía de encabezados', () => {
    expect(estimateBlockHeight({ type: 'header', level: 1, text: 'H1' })).toBe(46)
    expect(estimateBlockHeight({ type: 'header', level: 2, text: 'H2' })).toBe(36)
    expect(estimateBlockHeight({ type: 'header', level: 3, text: 'H3' })).toBe(28)
  })

  it('calcula la altura de párrafos y citas en base a su longitud', () => {
    const shortP = { type: 'paragraph' as const, text: 'Corto' }
    const longP = { type: 'paragraph' as const, text: 'A'.repeat(180) }
    expect(estimateBlockHeight(shortP)).toBe(25)
    expect(estimateBlockHeight(longP)).toBe(82)
  })

  it('calcula alturas de elementos especiales (mermaid, imágenes, tablas, hr)', () => {
    expect(estimateBlockHeight({ type: 'mermaid', code: 'graph TD' })).toBe(240)
    expect(estimateBlockHeight({ type: 'image', src: 'img.png', alt: '' })).toBe(200)
    expect(estimateBlockHeight({ type: 'hr' })).toBe(0)
    expect(
      estimateBlockHeight({
        type: 'table',
        headers: ['A', 'B'],
        rows: [['1', '2'], ['3', '4']],
      })
    ).toBe(3 * 28 + 14)
  })
})

describe('paginateTwoColumnBlocks - Paginación A4 a Dos Columnas', () => {
  it('retorna [[]] para una lista de bloques vacía', () => {
    expect(paginateTwoColumnBlocks([])).toEqual([[]])
  })

  it('mantiene todos los bloques en una sola hoja si su altura total no supera la capacidad A4', () => {
    const md = `
# Diagnóstico Clínico
Paciente femenino de 45 años con cefalea tensional.
Se indica reposo e hidratación.
`.trim()
    const blocks = parseMarkdownBlocks(md)
    const sheets = paginateTwoColumnBlocks(blocks)
    expect(sheets.length).toBe(1)
    expect(sheets[0].length).toBe(blocks.length)
  })

  it('pagina secuencialmente en múltiples hojas A4 cuando el contenido excede la capacidad de dos columnas', () => {
    const paragraphs = Array.from(
      { length: 40 },
      (_, i) => `Párrafo ${i}: Observación clínica detallada con sintomatología persistente y evolución favorable del paciente.`
    ).join('\n\n')

    const md = `# Historia Clínica Completa\n\n${paragraphs}`
    const blocks = parseMarkdownBlocks(md)
    const sheets = paginateTwoColumnBlocks(blocks, A4_TWO_COLUMN_CAPACITY_PX)

    expect(sheets.length).toBeGreaterThanOrEqual(2)
    const totalBlocks = sheets.reduce((acc, s) => acc + s.length, 0)
    expect(totalBlocks).toBe(blocks.length)
    expect(sheets[0][0]).toEqual(blocks[0])
  })

  it('respeta saltos de página explícitos con reglas horizontales (---)', () => {
    const md = `
# Hoja Uno
Contenido de la primera hoja.

---

# Hoja Dos
Contenido forzado a la segunda hoja.
`.trim()
    const blocks = parseMarkdownBlocks(md)
    const sheets = paginateTwoColumnBlocks(blocks)

    expect(sheets.length).toBe(2)
    expect(sheets[0][0]).toEqual({ type: 'header', level: 1, text: 'Hoja Uno' })
    expect(sheets[1][0]).toEqual({ type: 'header', level: 1, text: 'Hoja Dos' })
  })

  it('no genera hojas vacías si el documento termina con ---', () => {
    const md = `
# Título
Texto de prueba.

---
`.trim()
    const blocks = parseMarkdownBlocks(md)
    const sheets = paginateTwoColumnBlocks(blocks)

    expect(sheets.length).toBe(1)
    expect(sheets[0].length).toBe(2)
  })

  it('asigna un bloque individual excesivamente alto a su propia hoja sin causar bucles infinitos', () => {
    const hugeBlock = {
      type: 'paragraph' as const,
      text: 'A'.repeat(7000),
    }
    const normalBlock = {
      type: 'paragraph' as const,
      text: 'Párrafo posterior normal.',
    }
    const sheets = paginateTwoColumnBlocks([hugeBlock, normalBlock], 2000)

    expect(sheets.length).toBe(2)
    expect(sheets[0]).toEqual([hugeBlock])
    expect(sheets[1]).toEqual([normalBlock])
  })
})





