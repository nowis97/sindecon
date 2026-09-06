import { describe, it, expect } from 'vitest'
import { parseMarkdownBlocks } from './ArticleReader'

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

