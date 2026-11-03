import { describe, it, expect } from 'vitest'
import {
  CLINICAL_COLORS,
  createClinicalHeader,
  createClinicalHeading,
  createClinicalCallout,
} from './docxClinicalStyles'

describe('docxClinicalStyles', () => {
  it('define los colores clínicos exactos de SINDECON', () => {
    expect(CLINICAL_COLORS.primaryTeal).toBe('008080')
    expect(CLINICAL_COLORS.darkSlate).toBe('0F172A')
    expect(CLINICAL_COLORS.bodyText).toBe('1E293B')
  })

  it('construye el encabezado médico con marca SINDECON y fecha', () => {
    const paragraphs = createClinicalHeader('Cefaleas Agudas', 'Urgencias/Neurología', ['urgente', 'neurologia'], '03/11/2026')
    expect(paragraphs.length).toBeGreaterThanOrEqual(2)
  })

  it('construye títulos H1, H2, H3 con configuración de heading', () => {
    const h1 = createClinicalHeading('Diagnóstico Diferencial', 1)
    const h2 = createClinicalHeading('Criterios de Alarma', 2)
    const h3 = createClinicalHeading('Conducta Inmediata', 3)
    expect(h1).toBeDefined()
    expect(h2).toBeDefined()
    expect(h3).toBeDefined()
  })

  it('construye callouts clínicos como tablas con borde lateral de color', () => {
    const callout = createClinicalCallout('Alerta Farmacológica', 'Suspender si QTc > 500ms', 'warning')
    expect(callout).toBeDefined()
  })
})
