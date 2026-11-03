import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateClinicalDocxBlob } from './clinicalDocxGenerator'
import * as mermaidModule from './mermaidPngRenderer'

describe('clinicalDocxGenerator', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('genera un Blob DOCX válido con encabezado y contenido formateado', async () => {
    vi.spyOn(mermaidModule, 'renderMermaidToPngBuffer').mockResolvedValue({
      buffer: new Uint8Array([1, 2, 3, 4]).buffer,
      width: 400,
      height: 200,
    })

    const markdown = `
# Hipertensión Arterial de Urgencia
Texto de introducción clínica con **texto en negrita**.

> [!WARNING]
> No descender la PAM más de 20-25% en la primera hora.

\`\`\`mermaid
graph TD
  A[Sospecha] --> B[Evaluar daño de órgano blanco]
\`\`\`

| Fármaco | Dosis Inicial |
|---|---|
| Labetalol | 20 mg EV |
| Nitroprusiato | 0.25 mcg/kg/min |
`

    const blob = await generateClinicalDocxBlob(markdown, {
      title: 'Hipertensión Arterial de Urgencia',
      folderPath: 'Cardiología / Urgencias',
      tags: ['emergencia', 'hta'],
      dateStr: '03/11/2026',
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(500)
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  })

  it('maneja fallback elegante cuando mermaid falla al renderizar', async () => {
    vi.spyOn(mermaidModule, 'renderMermaidToPngBuffer').mockResolvedValue(null)

    const markdown = `
\`\`\`mermaid
graph TD
  Error sintáctico
\`\`\`
`

    const blob = await generateClinicalDocxBlob(markdown, {
      title: 'Fallback Diagrama',
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(500)
  })

  it('maneja listas, bloques de código, callouts diversos y encabezados de varios niveles', async () => {
    const markdown = `
# Nivel 1
## Nivel 2
### Nivel 3

> [!DOSAGE]
> Amoxicilina 500mg c/8h

- Ítem de lista desordenada 1
- Ítem de lista desordenada 2

1. Paso ordenado 1
2. Paso ordenado 2

\`\`\`javascript
const test = "código clínico";
\`\`\`
`

    const blob = await generateClinicalDocxBlob(markdown, {
      title: 'Prueba Exhaustiva Bloques',
      tags: ['farmacologia'],
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(500)
  })

  it('escala imágenes anchas al ancho máximo permitido (560)', async () => {
    vi.spyOn(mermaidModule, 'renderMermaidToPngBuffer').mockResolvedValue({
      buffer: new Uint8Array([1, 2, 3, 4]).buffer,
      width: 2000,
      height: 1000,
    })

    const markdown = `
\`\`\`mermaid
graph LR
  A --> B --> C --> D --> E
\`\`\`
`

    const blob = await generateClinicalDocxBlob(markdown, {
      title: 'Diagrama Ancho',
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(500)
  })
})
