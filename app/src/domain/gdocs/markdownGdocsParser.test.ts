import { describe, it, expect } from 'vitest'
import { parseMarkdownToClinicalBlocks, type ClinicalBlock } from './markdownGdocsParser'

describe('markdownGdocsParser', () => {
  it('extrae encabezados H1, H2 y H3', () => {
    const md = '# Título Principal\n## Subtítulo 1\n### Subsección A'
    const blocks: ClinicalBlock[] = parseMarkdownToClinicalBlocks(md)

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

  it('procesa callouts de dosificación, importante y consejos', () => {
    const md = '> [!DOSAGE]\n> 500mg cada 8 horas.\n\n> [!IMPORTANT]\n> Alergia a penicilina.\n\n> [!TIP]\n> Tomar con comidas.'
    const blocks = parseMarkdownToClinicalBlocks(md)

    expect(blocks).toEqual([
      {
        kind: 'callout',
        calloutType: 'dosage',
        title: 'DOSIFICACIÓN',
        text: '500mg cada 8 horas.',
      },
      {
        kind: 'callout',
        calloutType: 'important',
        title: 'IMPORTANTE',
        text: 'Alergia a penicilina.',
      },
      {
        kind: 'callout',
        calloutType: 'note',
        title: 'CONSEJO CLÍNICO',
        text: 'Tomar con comidas.',
      },
    ])
  })

  it('procesa bloques de código estándar no mermaid', () => {
    const md = '```json\n{"status": "ok"}\n```'
    const blocks = parseMarkdownToClinicalBlocks(md)

    expect(blocks).toEqual([
      {
        kind: 'code',
        language: 'json',
        code: '{"status": "ok"}',
      },
    ])
  })

  it('emite líneas con pipes aisladas (< 2 líneas) como párrafos sin perder contenido subsiguiente', () => {
    const md = '| Texto aislado |\n\nSiguiente párrafo.'
    const blocks = parseMarkdownToClinicalBlocks(md)

    expect(blocks).toEqual([
      { kind: 'paragraph', text: '| Texto aislado |' },
      { kind: 'paragraph', text: 'Siguiente párrafo.' },
    ])
  })

  it('soporta saltos de línea Windows CRLF (\\r\\n)', () => {
    const md = '# Título\r\n\r\n> [!NOTE]\r\n> Nota con CRLF.\r\n\r\n- Item 1\r\n- Item 2\r\n'
    const blocks = parseMarkdownToClinicalBlocks(md)

    expect(blocks).toEqual([
      { kind: 'heading', level: 1, text: 'Título' },
      { kind: 'callout', calloutType: 'note', title: 'NOTA CLÍNICA', text: 'Nota con CRLF.' },
      { kind: 'list', ordered: false, items: ['Item 1', 'Item 2'] },
    ])
  })
})
