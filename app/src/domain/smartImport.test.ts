import { describe, it, expect } from 'vitest'
import {
  cleanWordHtml,
  enrichClinicalMarkdown,
  extractSuggestedTitle,
  processImportText,
} from './smartImport'

describe('smartImport (Limpieza y Enriquecimiento Clínico)', () => {
  it('limpia fragmentos HTML sucios de Word y preserva tablas', () => {
    const wordHtml = `
      <!--[if gte mso 9]><xml><w:WordDocument></w:WordDocument></xml><![endif]-->
      <p class="MsoNormal" style="margin-bottom:0cm">
        <span style="font-family:Arial"><b>Manejo de Cetoacidosis Diabética</b></span>
      </p>
      <table class="MsoTableGrid" border="1">
        <tr>
          <td><p class="MsoNormal">Fármaco</p></td>
          <td><p class="MsoNormal">Dosis</p></td>
        </tr>
        <tr>
          <td><p class="MsoNormal">Insulina Cristalina</p></td>
          <td><p class="MsoNormal">0.1 UI/kg/h</p></td>
        </tr>
      </table>
    `

    const md = cleanWordHtml(wordHtml)
    expect(md).toContain('**Manejo de Cetoacidosis Diabética**')
    expect(md).toContain('| Fármaco | Dosis |')
    expect(md).toContain('| Insulina Cristalina | 0.1 UI/kg/h |')
    expect(md).not.toContain('MsoNormal')
    expect(md).not.toContain('<!--[if')
  })

  it('transforma patrones clínicos en Callouts estandarizados', () => {
    const raw = `
# Anafilaxia

ADVERTENCIA: Administrar Adrenalina IM de inmediato en cara anterolateral del muslo.
DOSIS: 0.3 - 0.5 mg IM (ampolla 1:1000 sin diluir).
PERLA CLÍNICA: Nunca usar adrenalina IV en bolo directo salvo en paro inminente.
IMPORTANTE: Mantener en observación al menos 6 a 8 horas por riesgo de reacción bifásica.
    `.trim()

    const enriched = enrichClinicalMarkdown(raw)

    expect(enriched).toContain('> [!WARNING]')
    expect(enriched).toContain('> **Advertencia:** Administrar Adrenalina IM')
    expect(enriched).toContain('> [!DOSIS]')
    expect(enriched).toContain('> **Dosificación:** 0.3 - 0.5 mg IM')
    expect(enriched).toContain('> [!TIP]')
    expect(enriched).toContain('> **Perla Clínica:** Nunca usar adrenalina IV')
    expect(enriched).toContain('> [!IMPORTANT]')
    expect(enriched).toContain('> **Importante:** Mantener en observación')
  })

  it('no transforma advertencias que están dentro de bloques de código', () => {
    const codeBlockText = `
\`\`\`
ADVERTENCIA: Este texto esta dentro de un bloque de codigo
\`\`\`
    `.trim()

    const enriched = enrichClinicalMarkdown(codeBlockText)
    expect(enriched).not.toContain('> [!WARNING]')
    expect(enriched).toContain('ADVERTENCIA: Este texto esta dentro')
  })

  it('extrae título sugerido correctamente', () => {
    expect(extractSuggestedTitle('# Crisis Hipertensiva\nTexto...')).toBe('Crisis Hipertensiva')
    expect(extractSuggestedTitle('## Síndrome Coronario Agudo\nTexto...')).toBe('Síndrome Coronario Agudo')
    expect(extractSuggestedTitle('**Fiebre Tifoidea**\nTexto...')).toBe('Fiebre Tifoidea')
    expect(extractSuggestedTitle('Insuficiencia Respiratoria\nTexto...')).toBe('Insuficiencia Respiratoria')
  })

  it('procesa texto de ChatGPT con tablas y callouts combinados', () => {
    const chatGptOutput = `
# Neumonía Adquirida en la Comunidad

ALERTA: Evaluar criterios CURB-65 para decidir ingreso a UCI o sala.

| Criterio | Puntuación |
| --- | --- |
| Confusión | 1 |
| Urea > 7 mmol/L | 1 |

DOSIS: Amoxicilina / Clavulánico 1g cada 8h VO.
    `.trim()

    const processed = processImportText(chatGptOutput)
    expect(processed).toContain('# Neumonía Adquirida en la Comunidad')
    expect(processed).toContain('> [!WARNING]')
    expect(processed).toContain('> [!DOSIS]')
    expect(processed).toContain('| Criterio | Puntuación |')
  })
})
