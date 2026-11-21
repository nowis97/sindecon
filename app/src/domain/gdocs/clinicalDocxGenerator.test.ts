import { describe, it, expect, vi, beforeEach } from 'vitest'
import JSZip from 'jszip'
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

    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    const docXml = await zip.file('word/document.xml')?.async('string')
    expect(docXml).not.toContain('Asignatura · Apuntes 5to-2')
    expect(docXml).not.toContain('Apuntes 5to-2')
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

  it('genera DOCX con los estilos exactos y marcadores de Plantilla Apuntes 5to-2 y secciones continuas 1/2 columnas', async () => {
    const markdown = `
# TÍTULO DEL TEMA
@SUBTÍTULO: Cardiología · Apuntes 5to-2

## INTRODUCCIÓN
Texto del apunte.

### SUBTÍTULO CLÍNICO
#### Hallazgo específico
- Elemento nivel 1
  - Elemento nivel 2
1. Paso numerado 1

> [!EJEMPLO]
> paciente típico.

> [!PERLA]
> dato de alto rendimiento.

> [!ADVERTENCIA]
> urgencia clínica.

> [!DEFINICIÓN]
> criterio formal.

## TABLA O ALGORITMO A ANCHO COMPLETO
> [!NOTA]
> Este bloque está en una sola columna.

| Situación | Hallazgo / criterio | Conducta |
| --- | --- | --- |
| Paciente estable | Sin criterios | Manejo habitual |
| Paciente de riesgo | Con hallazgos | Vigilar |

*FIGURA:* Tabla de ejemplo.

## CONTINUACIÓN DEL APUNTE
Vuelve a dos columnas.

REF: Autor. Guía clínica. 2026.
`

    const blob = await generateClinicalDocxBlob(markdown, {
      title: 'Insuficiencia Cardíaca',
      folderPath: 'Cardiología',
    })

    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    const docXml = await zip.file('word/document.xml')?.async('string')
    const headerXml = await zip.file('word/header1.xml')?.async('string')
    const footerXml = await zip.file('word/footer1.xml')?.async('string')
    const numberingXml = await zip.file('word/numbering.xml')?.async('string')

    expect(docXml).toBeDefined()
    expect(headerXml).toBeUndefined()
    expect(footerXml).toContain('Página')

    // Jerarquía de tamaños Word en half-points: Título 18pt (36), H1 14.5pt (29), H2 12.5pt (25), H3 11pt (22)
    expect(docXml).toContain('w:val="36"')
    expect(docXml).toContain('w:val="29"')
    expect(docXml).toContain('w:val="25"')
    expect(docXml).toContain('w:val="22"')

    // Viñetas nivel 1 y nivel 2 en numbering.xml y document.xml
    expect(numberingXml).toBeDefined()
    expect(docXml).toContain('w:ilvl w:val="1"')

    // Marcadores limpios sin prefijos crudos ni pérdida de contenido
    expect(docXml).not.toContain('@SUBTÍTULO:')
    expect(docXml).not.toContain('REF:')
    expect(docXml).toContain('Autor. Guía clínica. 2026.')

    // Colores exactos de la plantilla en document.xml
    expect(docXml).toContain('1F4E79')
    expect(docXml).toContain('4F81BD')
    expect(docXml).toContain('D9D2C3')
    expect(docXml).toContain('FAF9F6')
    expect(docXml).toContain('F2F2F2')
    expect(docXml).toContain('F3EFE6')
    expect(docXml).toContain('FCE8E6')
    expect(docXml).toContain('F5F5F5')
    // Alternancia de secciones continuas de 1 y 2 columnas, manteniendo Bibliografía en flujo secuencial de 2 columnas
    expect(docXml).toContain('continuous')
    expect(docXml).toContain('w:num="2"')
    const sectPrMatches = docXml?.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/g) ?? []
    expect(sectPrMatches.length).toBeGreaterThanOrEqual(2)
    const lastSectPr = sectPrMatches[sectPrMatches.length - 1]
    expect(lastSectPr).toContain('w:num="2"')
  })

  it('omite el subtítulo placeholder "Asignatura · Apuntes 5to-2" en la exportación DOCX', async () => {
    const markdown = `
# Dolor Torácico
@SUBTÍTULO: Asignatura · Apuntes 5to-2

## Enfoque inicial
Descartar causas potencialmente letales.
`
    const blob = await generateClinicalDocxBlob(markdown, {
      title: 'Dolor Torácico',
      folderPath: 'Urgencias',
    })
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    const docXml = await zip.file('word/document.xml')?.async('string')
    expect(docXml).toContain('Dolor Torácico')
    expect(docXml).not.toContain('Asignatura · Apuntes 5to-2')
    expect(docXml).not.toContain('Urgencias · Apuntes 5to-2')
    expect(docXml).not.toContain('Apuntes 5to-2')
  })
})
