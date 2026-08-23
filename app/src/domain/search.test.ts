import { describe, it, expect } from 'vitest'
import { buildIndex, searchIndex } from './search'

describe('búsqueda local (spec search)', () => {
  const corpus = [
    {
      id: 'a',
      title: 'Fibrilación auricular',
      body: 'Arritmia supraventricular con R irregular. Tratamiento: amiodarona.',
      tags: 'arritmia corazón palpitaciones',
    },
    {
      id: 'b',
      title: 'Hipertensión arterial',
      body: 'Presión arterial elevada sostenida. CHA2DS2-VASc para riesgo.',
      tags: 'cardio presión',
    },
    {
      id: 'c',
      title: 'Diabetes mellitus tipo 2',
      body: 'Resistencia a la insulina. Metformina primera línea.',
      tags: 'endocrino insulina glucosa',
    },
  ]

  it('buildIndex no falla con corpus vacío', () => {
    const idx = buildIndex([])
    expect(searchIndex(idx, 'cualquier cosa')).toEqual([])
  })

  it('encuentra por título (con boost)', () => {
    const idx = buildIndex(corpus)
    const results = searchIndex(idx, 'hipertensión')
    expect(results[0].id).toBe('b')
  })

  it('encuentra por contenido del cuerpo', () => {
    const idx = buildIndex(corpus)
    const results = searchIndex(idx, 'amiodarona')
    expect(results[0].id).toBe('a')
  })

  it('encuentra por tag', () => {
    const idx = buildIndex(corpus)
    const results = searchIndex(idx, 'palpitaciones')
    expect(results[0].id).toBe('a')
  })

  it('query vacía no devuelve nada', () => {
    const idx = buildIndex(corpus)
    expect(searchIndex(idx, '')).toEqual([])
    expect(searchIndex(idx, '   ')).toEqual([])
  })

  it('respeta el límite', () => {
    const idx = buildIndex(corpus)
    const results = searchIndex(idx, 'la', 2)
    expect(results.length).toBeLessThanOrEqual(2)
  })
})