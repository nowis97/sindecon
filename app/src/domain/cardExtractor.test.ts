import { describe, it, expect } from 'vitest'
import { extractCardsFromMarkdown, estimateFlashcardsFromWords } from './cardExtractor'

describe('Structural Flashcard Extractor', () => {
  it('extracts explicit Q/A and P/R pairs', () => {
    const md = `
# Cefaleas
Q: ¿Cuál es el tratamiento abortivo de primera línea en crisis de migraña moderada-grave?
A: Triptanes por vía oral o subcutánea (ej. Sumatriptán 50-100 mg).
`
    const cards = extractCardsFromMarkdown('Cefaleas', md)
    expect(cards.length).toBe(1)
    expect(cards[0].front).toContain('¿Cuál es el tratamiento abortivo')
    expect(cards[0].back).toContain('Sumatriptán')
  })

  it('extracts clinical callouts (e.g. PEARL, WARNING)', () => {
    const md = `
# Disección Aórtica
> [!PEARL] Control Hemodinámico
> Iniciar betabloqueantes antes que vasodilatadores para evitar taquicardia refleja.
`
    const cards = extractCardsFromMarkdown('Disección Aórtica', md)
    expect(cards.length).toBe(1)
    expect(cards[0].front).toBe('Disección Aórtica — 💡 Perla Clínica: Control Hemodinámico')
    expect(cards[0].back).toContain('Iniciar betabloqueantes antes')
  })

  it('extracts bold list items (- **Term:** Definition)', () => {
    const md = `
# Síndromes Clínicos
- **Signo de Murphy:** Detención inspiratoria dolorosa a la palpación del hipocondrio derecho.
- **Tríada de Charcot:** Fiebre, dolor en hipocondrio derecho e ictericia.
`
    const cards = extractCardsFromMarkdown('Síndromes Clínicos', md)
    expect(cards.length).toBe(2)
    expect(cards[0].front).toBe('Síndromes Clínicos — ¿Qué es / Qué indica **Signo de Murphy**?')
    expect(cards[0].back).toContain('Detención inspiratoria')
    expect(cards[1].front).toBe('Síndromes Clínicos — ¿Qué es / Qué indica **Tríada de Charcot**?')
  })

  it('extracts rows from medical tables', () => {
    const md = `
# Farmacología en Shock
| Fármaco | Dosis | Mecanismo |
|---|---|---|
| Noradrenalina | 0.05 - 1 mcg/kg/min | Agonista alfa-1 > beta-1 |
| Dobutamina | 2.5 - 20 mcg/kg/min | Agonista beta-1 inotrópico |
`
    const cards = extractCardsFromMarkdown('Farmacología en Shock', md)
    expect(cards.length).toBe(2)
    expect(cards[0].front).toBe('Farmacología en Shock — Noradrenalina (Dosis, Mecanismo)')
    expect(cards[0].back).toContain('**Dosis:** 0.05 - 1 mcg/kg/min')
    expect(cards[0].back).toContain('**Mecanismo:** Agonista alfa-1 > beta-1')
  })

  it('extracts from section headings (## Section)', () => {
    const md = `
# Insuficiencia Cardíaca
## Criterios de Framingham
Se requieren 2 criterios mayores o 1 mayor y 2 menores.
- Mayores: DPN, ingurgitación yugular, estertores crepitantes.
- Menores: Edema maleolar, disnea de esfuerzo, tos nocturna.
`
    const cards = extractCardsFromMarkdown('Insuficiencia Cardíaca', md)
    expect(cards.some((c) => c.front.includes('Criterios de Framingham'))).toBe(true)
  })

  it('estimates flashcards based on medical word count rules', () => {
    // Texto vacío
    expect(estimateFlashcardsFromWords('').estimatedCards).toBe(0)
    
    // Texto corto (< 30 palabras)
    expect(estimateFlashcardsFromWords('Paciente con fiebre.').estimatedCards).toBe(0)
    
    // Artículo estándar de ~180 palabras (debe estimar ~3 flashcards)
    const midText = 'Esta es una palabra clínica médica importante para diagnosticar pacientes. '.repeat(18)
    const midEstimate = estimateFlashcardsFromWords(midText)
    expect(midEstimate.wordCount).toBeGreaterThan(150)
    expect(midEstimate.estimatedCards).toBeGreaterThanOrEqual(3)
    
    // Guía extensa de ~1200 palabras (debe estimar ~20 flashcards)
    const longText = 'Fármaco tratamiento diagnóstico clínica signo síntoma dosis patología. '.repeat(150)
    const longEstimate = estimateFlashcardsFromWords(longText)
    expect(longEstimate.estimatedCards).toBeGreaterThanOrEqual(15)
  })
})

import { cleanAndTruncateMarkdownForAi } from './ai/cloudAiClient'

describe('cleanAndTruncateMarkdownForAi', () => {
  it('strips heavy base64 images to conserve prompt tokens', () => {
    const hugeBase64 = 'data:image/png;base64,' + 'A'.repeat(5000)
    const md = `# Caso Clínico\n\n![Radiografía](${hugeBase64})\n\nPaciente con disnea.`
    const cleaned = cleanAndTruncateMarkdownForAi(md, 1000)
    expect(cleaned).not.toContain('data:image/png;base64')
    expect(cleaned).toContain('![Radiografía]([imagen])')
    expect(cleaned).toContain('Paciente con disnea.')
  })

  it('truncates excessively long text to stay within context window limits', () => {
    const longText = 'Línea de información médica importante.\n'.repeat(500)
    const cleaned = cleanAndTruncateMarkdownForAi(longText, 500)
    expect(cleaned.length).toBeLessThan(700)
    expect(cleaned).toContain('[...contenido restante omitido para optimizar contexto...]')
  })

  it('preserves short text unmodified', () => {
    const shortMd = '# Diagnóstico\nPaciente normotenso.'
    expect(cleanAndTruncateMarkdownForAi(shortMd, 5000)).toBe(shortMd)
  })
})
