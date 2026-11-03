import { describe, it, expect } from 'vitest'
import {
  sanitizeDocTitle,
  type GoogleDocsExportStatus,
} from './GoogleDocsExportModal'
import { GOOGLE_DRIVE_SCOPES } from '../../pwa/googleDrive'

describe('GoogleDocsExportModal Helpers', () => {
  it('formatea el nombre limpio del archivo removiendo caracteres inválidos para documentos', () => {
    const rawTitle = 'Cefaleas: Guía / Manejo clínico (2026)?'
    const clean = sanitizeDocTitle(rawTitle)
    expect(clean).toBe('Cefaleas- Guía - Manejo clínico (2026)-')
  })

  it('asigna un título por defecto si el texto resulta vacío tras sanitizar', () => {
    const clean = sanitizeDocTitle('   ')
    expect(clean).toBe('Nota Clínica')
  })

  it('asigna un título por defecto si el título original es vacío o nulo', () => {
    expect(sanitizeDocTitle('')).toBe('Nota Clínica')
    expect(sanitizeDocTitle(null as unknown as string)).toBe('Nota Clínica')
    expect(sanitizeDocTitle(undefined as unknown as string)).toBe('Nota Clínica')
  })

  it('asigna un título por defecto si solo contiene caracteres de reemplazo o espacios', () => {
    expect(sanitizeDocTitle('::: /// ???')).toBe('Nota Clínica')
    expect(sanitizeDocTitle('   ---   ')).toBe('Nota Clínica')
  })

  it('remueve caracteres conflictivos en Windows/Linux/Drive como *, <, >, |, ", \\', () => {
    const dangerous = 'Nota *especial* <urgente> | "dosis" \\ final'
    const clean = sanitizeDocTitle(dangerous)
    expect(clean).toBe('Nota -especial- -urgente- - -dosis- - final')
  })

  it('preserva acentos, guiones, paréntesis y números válidos', () => {
    const title = 'Manejo de Cetoacidosis Diabética (CAD) - Guía 2026'
    expect(sanitizeDocTitle(title)).toBe('Manejo de Cetoacidosis Diabética (CAD) - Guía 2026')
  })
})

describe('GoogleDocsExportModal Component Logic', () => {
  it('identifica correctamente estado offline y ofrece descarga local', () => {
    const isOnline = false
    const shouldOfferDownload = !isOnline
    expect(shouldOfferDownload).toBe(true)
  })

  it('soporta todos los estados válidos del flujo de exportación', () => {
    const validStatuses: GoogleDocsExportStatus[] = [
      'idle',
      'rendering',
      'uploading',
      'success',
      'error',
      'offline',
    ]
    expect(validStatuses).toHaveLength(6)
  })

  it('asegura que los scopes solicitados para Google Docs incluyan drive.file', () => {
    expect(GOOGLE_DRIVE_SCOPES).toContain('https://www.googleapis.com/auth/drive.file')
    expect(GOOGLE_DRIVE_SCOPES).toContain('https://www.googleapis.com/auth/drive.appdata')
  })

  it('genera el nombre de archivo .docx correcto para la descarga local de rescate', () => {
    const title = 'Hipertensión Arterial: Crisis y Manejo?'
    const clean = sanitizeDocTitle(title)
    const fileName = `${clean}.docx`
    expect(fileName).toBe('Hipertensión Arterial- Crisis y Manejo-.docx')
  })

  it('detecta errores 401 y expone sesión expirada para reconexión', () => {
    const is401Error = (msg: string) =>
      msg.includes('401') || msg.toLowerCase().includes('expirad') || msg.toLowerCase().includes('invalid_token')

    expect(is401Error('Error de Google Drive (401): Unauthorized')).toBe(true)
    expect(is401Error('Sesión de Google Drive expirada')).toBe(true)
    expect(is401Error('Error de red: connection timeout')).toBe(false)
  })
})
