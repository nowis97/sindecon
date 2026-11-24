import { describe, it, expect } from 'vitest'
import {
  matchNaturalPearlParagraph,
  resolveBracketCallout,
} from './callouts'

describe('callouts.ts - Nombres dados y sintaxis entre corchetes en Perlas', () => {
  it('mantiene el nombre dado en callouts de 1 o varias líneas (> [!PERLA] Nombre)', () => {
    const single = resolveBracketCallout('[!PERLA] Hiponatremia en IC', [])
    expect(single).toMatchObject({
      kind: 'tip',
      title: 'Hiponatremia en IC',
      text: '',
      hasCustomTitle: true,
    })

    const singleWithColon = resolveBracketCallout('[!PERLA] Criterio de Light: LDH > 0.6', [])
    expect(singleWithColon).toMatchObject({
      kind: 'tip',
      title: 'Criterio de Light',
      text: 'LDH > 0.6',
      hasCustomTitle: true,
    })
  })

  it('limpia corchetes cuando el nombre va en [Nombre], [!PERLA: Nombre] o [!Nombre]', () => {
    expect(resolveBracketCallout('[!PERLA] [Criterio de Light]', ['LDH > 2/3 LSN'])).toMatchObject({
      kind: 'tip',
      title: 'Criterio de Light',
      text: 'LDH > 2/3 LSN',
      hasCustomTitle: true,
    })

    expect(resolveBracketCallout('[!PERLA][Triada de Beck]', [])).toMatchObject({
      kind: 'tip',
      title: 'Triada de Beck',
      text: '',
      hasCustomTitle: true,
    })

    expect(resolveBracketCallout('[!PERLA: Potasio sérico]', ['Vigilar cada 4h'])).toMatchObject({
      kind: 'tip',
      title: 'Potasio sérico',
      text: 'Vigilar cada 4h',
      hasCustomTitle: true,
    })

    expect(resolveBracketCallout('[!Perla de ECG]', ['QRS ancho > 120 ms'])).toMatchObject({
      kind: 'tip',
      title: 'Perla de ECG',
      text: 'QRS ancho > 120 ms',
      hasCustomTitle: true,
    })

    expect(resolveBracketCallout('[!Criterio de Light]', ['Exudado si proteínas > 0.5'])).toMatchObject({
      kind: 'tip',
      title: 'Criterio de Light',
      text: 'Exudado si proteínas > 0.5',
      hasCustomTitle: true,
    })
  })

  it('rescata nombre en [Nombre] o **Nombre:** desde el cuerpo y evita duplicar Perla Clínica', () => {
    const bracketBody = resolveBracketCallout('[!PERLA]', ['[Criterio de Light]', 'LDH pleural/sérica > 0.6'])
    expect(bracketBody).toMatchObject({
      kind: 'tip',
      title: 'Criterio de Light',
      text: 'LDH pleural/sérica > 0.6',
      hasCustomTitle: true,
    })

    const boldBody = resolveBracketCallout('[!PERLA]', ['**Control hemodinámico:** Betabloqueantes primero.'])
    expect(boldBody).toMatchObject({
      kind: 'tip',
      title: 'Control hemodinámico',
      text: 'Betabloqueantes primero.',
      hasCustomTitle: true,
    })

    const legacySmartImport = resolveBracketCallout('[!TIP]', ['**Perla Clínica:** Nunca usar adrenalina IV.'])
    expect(legacySmartImport).toMatchObject({
      kind: 'tip',
      title: 'Perla Clínica',
      text: 'Nunca usar adrenalina IV.',
      hasCustomTitle: false,
    })
  })

  it('desescapa corchetes de Milkdown y no rompe links Markdown ni wikilinks', () => {
    const milkdownEscaped = resolveBracketCallout('\\[!PERLA\\] \\[Signo de Blumberg\\]', ['Irritación peritoneal.'])
    expect(milkdownEscaped).toMatchObject({
      kind: 'tip',
      title: 'Signo de Blumberg',
      text: 'Irritación peritoneal.',
      hasCustomTitle: true,
    })

    const mdLinkBody = resolveBracketCallout('[!PERLA]', ['[Guía MINSAL](https://minsal.cl) recomendada'])
    expect(mdLinkBody).toMatchObject({
      kind: 'tip',
      title: 'Perla clínica',
      text: '[Guía MINSAL](https://minsal.cl) recomendada',
      hasCustomTitle: false,
    })

    const wikiBody = resolveBracketCallout('[!PERLA]', ['[[uuid-1|Fibrilación Auricular]] requiere control de ritmo'])
    expect(wikiBody).toMatchObject({
      kind: 'tip',
      title: 'Perla clínica',
      hasCustomTitle: false,
    })
  })

  it('distingue perla natural genérica vs perla natural con nombre propio', () => {
    expect(matchNaturalPearlParagraph('Perla clínica: dato EUNACOM.')).toMatchObject({
      title: 'Perla clínica:',
      text: 'dato EUNACOM.',
      hasCustomTitle: false,
      inlineFormat: true,
    })

    expect(matchNaturalPearlParagraph('**Perla de ECG:** Onda T picuda en hiperkalemia.')).toMatchObject({
      title: 'Perla de ECG',
      text: 'Onda T picuda en hiperkalemia.',
      hasCustomTitle: true,
      inlineFormat: false,
    })

    expect(matchNaturalPearlParagraph('Perla [Criterio de Light]: Relación > 0.6.')).toMatchObject({
      title: 'Criterio de Light',
      text: 'Relación > 0.6.',
      hasCustomTitle: true,
      inlineFormat: false,
    })
  })
})
