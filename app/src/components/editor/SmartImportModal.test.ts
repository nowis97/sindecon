import { describe, it, expect } from 'vitest'
import { SmartImportModal, type SmartImportModalProps } from './SmartImportModal'
import { extractSuggestedTitle, processImportText } from '../../domain/smartImport'

describe('SmartImportModal - Google Docs Export Contract', () => {
  it('exporta SmartImportModal como un componente React válido', () => {
    expect(typeof SmartImportModal).toBe('function')
  })

  it('acepta onExportToGoogleDocs dentro de sus props tipadas', () => {
    let capturedTitle = ''
    let capturedMd = ''

    const props: SmartImportModalProps = {
      isOpen: true,
      onClose: () => {},
      nodes: [],
      onAppendToCurrentArticle: async () => {},
      onReplaceCurrentArticle: async () => {},
      onCreateNewArticle: async () => {},
      onSaveToInbox: async () => {},
      onExportToGoogleDocs: (title, md) => {
        capturedTitle = title
        capturedMd = md
      },
    }

    expect(props.onExportToGoogleDocs).toBeDefined()
    props.onExportToGoogleDocs?.('Criterios Diagnósticos', '# Criterios Diagnósticos')
    expect(capturedTitle).toBe('Criterios Diagnósticos')
    expect(capturedMd).toBe('# Criterios Diagnósticos')
  })

  it('procesa texto de ChatGPT y deriva el título automáticamente para exportación a Docs', () => {
    const rawText = `
# Manejo de Asma Severa en Urgencias
ADVERTENCIA: Monitorear saturación y pico flujo continuo.
    `.trim()

    const processed = processImportText(rawText, { enrichCallouts: true })
    const suggestedTitle = extractSuggestedTitle(processed)

    expect(suggestedTitle).toBe('Manejo de Asma Severa en Urgencias')
    expect(processed).toContain('> [!WARNING]')
  })
})
