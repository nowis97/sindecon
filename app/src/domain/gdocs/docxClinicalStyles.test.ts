import { describe, it, expect } from 'vitest'
import {
  APUNTES_COLORS,
  CLINICAL_COLORS,
  createApuntesFooter,
  createApuntesRunningHeader,
  createClinicalHeader,
  createClinicalHeading,
  createClinicalCallout,
} from './docxClinicalStyles'

describe('docxClinicalStyles', () => {
  it('define los colores clínicos exactos de SINDECON y Apuntes 5to-2', () => {
    expect(CLINICAL_COLORS.primaryTeal).toBe('008080')
    expect(CLINICAL_COLORS.darkSlate).toBe('0F172A')
    expect(CLINICAL_COLORS.bodyText).toBe('1E293B')
    expect(APUNTES_COLORS.headingBlue).toBe('1F4E79')
    expect(APUNTES_COLORS.titleBorderBlue).toBe('4F81BD')
    expect(APUNTES_COLORS.tableHeaderBg).toBe('D9D2C3')
    expect(APUNTES_COLORS.tableZebraBg).toBe('FAF9F6')
    expect(APUNTES_COLORS.exampleBg).toBe('F2F2F2')
    expect(APUNTES_COLORS.pearlBg).toBe('F3EFE6')
    expect(APUNTES_COLORS.warningBg).toBe('FCE8E6')
    expect(APUNTES_COLORS.definitionBg).toBe('F5F5F5')
  })

  it('construye el encabezado médico sin subtítulo automático cuando no hay subtitleOverride', () => {
    const paragraphs = createClinicalHeader('Cefaleas Agudas', 'Urgencias/Neurología', ['urgente', 'neurologia'], '03/11/2026')
    expect(paragraphs.length).toBe(2)
  })

  it('construye el encabezado solo con el título cuando no hay subtítulo ni tags opcionales', () => {
    const paragraphs = createClinicalHeader('Cefaleas Agudas')
    expect(paragraphs.length).toBe(1)
  })

  it('incluye subtítulo cuando se pasa subtitleOverride explícito', () => {
    const paragraphs = createClinicalHeader('Cefaleas Agudas', undefined, [], undefined, 'Neurología')
    expect(paragraphs.length).toBe(2)
  })

  it('construye running header y footer de Apuntes 5to-2', () => {
    expect(createApuntesRunningHeader('Cardiología')).toBeDefined()
    expect(createApuntesFooter()).toBeDefined()
  })

  it('construye títulos H1..H4 (Título y Título 1..3) con configuración de heading', () => {
    const h1 = createClinicalHeading('Título Principal', 1)
    const h2 = createClinicalHeading('Diagnóstico Diferencial', 2)
    const h3 = createClinicalHeading('Criterios de Alarma', 3)
    const h4 = createClinicalHeading('Conducta Inmediata', 4)
    expect(h1).toBeDefined()
    expect(h2).toBeDefined()
    expect(h3).toBeDefined()
    expect(h4).toBeDefined()
  })

  it('construye callouts clínicos como tablas con borde lateral de color para todas las variantes', () => {
    const warning = createClinicalCallout('Alerta Farmacológica', 'Suspender si QTc > 500ms', 'warning')
    const note = createClinicalCallout('Observación', 'Revaluar en 24h', 'note')
    const dosage = createClinicalCallout('Posología', '500mg c/8h', 'dosage')
    const important = createClinicalCallout('Importante', 'Alergia a penicilina', 'important')
    const example = createClinicalCallout('Ejemplo clínico:', 'Paciente típico.', 'example')
    const pearl = createClinicalCallout('Perla clínica:', 'Dato EUNACOM.', 'pearl')
    const definition = createClinicalCallout('Definición:', 'Criterio formal.', 'definition')
    expect(warning).toBeDefined()
    expect(note).toBeDefined()
    expect(dosage).toBeDefined()
    expect(important).toBeDefined()
    expect(example).toBeDefined()
    expect(pearl).toBeDefined()
    expect(definition).toBeDefined()
  })
})
