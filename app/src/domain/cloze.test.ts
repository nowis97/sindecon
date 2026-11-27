import { describe, it, expect } from 'vitest'
import { isCloze, parseCloze, renderCloze } from './cloze'

describe('cloze', () => {
  it('detecta un cloze', () => {
    expect(isCloze('se recomienda {{c1::usar CPAP}}.')).toBe(true)
    expect(isCloze('sin cloze')).toBe(false)
  })

  it('parsea huecos', () => {
    const r = parseCloze('A {{c1::uno}} y {{c2::dos}}.')
    expect(r.plain).toBe('A […] y […].')
    expect(r.deletions).toEqual(['uno', 'dos'])
  })

  it('oculta los huecos no revelados', () => {
    const t = 'A {{c1::uno}} y {{c2::dos}}.'
    expect(renderCloze(t, new Set())).toBe('A […] y […].')
    expect(renderCloze(t, new Set([1]))).toBe('A uno y […].')
    expect(renderCloze(t, new Set([1, 2]))).toBe('A uno y dos.')
  })

  it('texto sin cloze se devuelve igual', () => {
    expect(renderCloze('plano', new Set())).toBe('plano')
  })

  it('soporta cloze con formato interno', () => {
    const t = 'Usar {{c1::**noradrenalina** a 0.05 mcg/kg/min}}.'
    expect(renderCloze(t, new Set([1]))).toBe(
      'Usar **noradrenalina** a 0.05 mcg/kg/min.',
    )
  })
})
