import { describe, it, expect } from 'vitest'
import {
  chunkClinicalMarkdown,
  detectSectionType,
  countWords,
  getSectionSpecializedPrompt,
} from './clinicalChunker'

describe('clinicalChunker', () => {
  it('detecta correctamente tipos de secciones clínicas', () => {
    expect(detectSectionType('Criterios Diagnósticos', 'El electrocardiograma muestra elevación del ST')).toBe('diagnosis')
    expect(detectSectionType('Tratamiento Farmacológico', 'Dosis de inicio de Aspirina 300 mg VO')).toBe('treatment')
    expect(detectSectionType('Signos de Alarma', '> [!WARNING] Deterioro hemodinámico')).toBe('alert')
    expect(detectSectionType('Definición', 'El infarto agudo al miocardio es una necrosis')).toBe('general')
  })

  it('cuenta palabras de forma precisa', () => {
    expect(countWords('')).toBe(0)
    expect(countWords('   ')).toBe(0)
    expect(countWords('Infarto agudo de miocardio')).toBe(4)
  })

  it('divide un artículo con encabezados H2/H3 en chunks semánticos', () => {
    const markdown = `
# Infarto Agudo de Miocardio

## Cuadro Clínico y Diagnóstico
Dolor retroesternal opresivo de más de 20 minutos con irradiación a mandíbula o brazo izquierdo.
El electrocardiograma de 12 derivaciones es el estudio inicial mandatorio.

## Tratamiento y Dosis de Urgencia
Manejo inicial con esquema MONA:
- Aspirina: 300 mg VO masticados.
- Clopidogrel: dosis de carga de 300 a 600 mg VO.
- Nitroglicerina sublingual si no hay hipotensión ni infarto de ventrículo derecho.

## Criterios de Alarma y Red Flags
> [!WARNING]
> Hipotensión arterial (PAS < 90 mmHg), estertores crepitantes bilaterales y taquicardia sugieren Shock Cardiogénico.
    `.trim()

    const chunks = chunkClinicalMarkdown('Infarto Agudo de Miocardio', markdown, 300)
    expect(chunks.length).toBeGreaterThanOrEqual(3)
    expect(chunks.some(c => c.sectionType === 'diagnosis')).toBe(true)
    expect(chunks.some(c => c.sectionType === 'treatment')).toBe(true)
    expect(chunks.some(c => c.sectionType === 'alert')).toBe(true)
  })

  it('genera prompts clínicos especializados según el tipo de sección', () => {
    const chunkDiag = {
      title: 'Diagnóstico de Apendicitis',
      sectionType: 'diagnosis' as const,
      content: 'Escala de Alvarado > 7 puntos indica alta probabilidad.',
      wordCount: 8,
    }
    const promptDiag = getSectionSpecializedPrompt('Apendicitis', chunkDiag, 2)
    expect(promptDiag).toContain('Criterios diagnósticos cardinales')
    expect(promptDiag).toContain('Gold Standard')
    expect(promptDiag).toContain('EXACTAMENTE 2')

    const chunkTrat = {
      title: 'Tratamiento de Neumonía',
      sectionType: 'treatment' as const,
      content: 'Amoxicilina / Ácido Clavulánico 875/125 mg cada 8 horas.',
      wordCount: 8,
    }
    const promptTrat = getSectionSpecializedPrompt('Neumonía', chunkTrat, 1)
    expect(promptTrat).toContain('Dosis exactas con unidades')
    expect(promptTrat).toContain('EXACTAMENTE 1')
  })

  it('maneja textos sin encabezados dividiendo por párrafos sin perder contenido', () => {
    const plainText = `
Primer párrafo sobre epidemiología general de la hipertensión arterial esencial en adultos mayores.

Segundo párrafo que describe la toma correcta de presión arterial y el mapa de 24 horas.

Tercer párrafo sobre cambios en el estilo de vida y dieta DASH baja en sodio.
    `.trim()

    const chunks = chunkClinicalMarkdown('Hipertensión', plainText, 20)
    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks[0].title).toContain('Hipertensión')
  })
})
