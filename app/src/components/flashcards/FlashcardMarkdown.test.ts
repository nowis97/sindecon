import { describe, it, expect } from 'vitest'
import { renderInlineMarkdown } from './FlashcardMarkdown'

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
})
