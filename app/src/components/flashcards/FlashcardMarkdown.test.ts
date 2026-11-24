import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { FlashcardMarkdown, renderInlineMarkdown } from './FlashcardMarkdown'

describe('FlashcardMarkdown', () => {
  it('renderiza texto plano', () => {
    const result = renderInlineMarkdown('Texto simple sin formato')
    expect(result).toBeTruthy()
  })

  it('renderiza negrita y cursiva', () => {
    const result = renderInlineMarkdown('**Dosis:** *0.05 a 2 mcg/kg/min*')
    expect(result).toBeTruthy()
  })

  it('renderiza codigo inline y resaltado', () => {
    const result = renderInlineMarkdown('Usar Noradrenalina en caso de ==shock séptico==')
    expect(result).toBeTruthy()
  })

  it('renderiza perlas con nombre dado y entre corchetes en tarjetas', () => {
    const html = renderToStaticMarkup(
      React.createElement(FlashcardMarkdown, {
        content: [
          '> \\[!PERLA\\] \\[Criterio de Light\\]',
          '> Exudado si LDH > 2/3 LSN.',
          '',
          '> [!Signo de Beck]',
          '> Tríada de taponamiento.',
        ].join('\n'),
      }),
    )
    expect(html).toContain('callout-tip')
    expect(html).toContain('<strong>Criterio de Light</strong>')
    expect(html).toContain('<strong>Signo de Beck</strong>')
    expect(html).not.toContain('>[!PERLA]')
  })
})
