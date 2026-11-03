import { describe, it, expect } from 'vitest'
import {
  sanitizeDocTitle,
  getFallbackDocxFileName,
  isSessionExpiredError,
  type GoogleDocsExportStatus,
} from './GoogleDocsExportModal'
import { GOOGLE_DRIVE_SCOPES } from '../../pwa/googleDrive'

describe('GoogleDocsExportModal Helpers - sanitizeDocTitle', () => {
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
    expect(sanitizeDocTitle(null)).toBe('Nota Clínica')
    expect(sanitizeDocTitle(undefined)).toBe('Nota Clínica')
  })

  it('asigna un título por defecto si solo contiene caracteres de reemplazo o espacios', () => {
    expect(sanitizeDocTitle('::: /// ???')).toBe('Nota Clínica')
    expect(sanitizeDocTitle('   ---   ')).toBe('Nota Clínica')
    expect(sanitizeDocTitle('___')).toBe('Nota Clínica')
  })

  it('remueve caracteres conflictivos en Windows/Linux/Drive como *, <, >, |, ", \\', () => {
    const dangerous = 'Nota *especial* <urgente> | "dosis" \\ final'
    const clean = sanitizeDocTitle(dangerous)
    expect(clean).toBe('Nota -especial- -urgente- - -dosis- - final')
  })

  it('preserva acentos, guiones, paréntesis y números válidos en terminología médica', () => {
    const title = 'Manejo de Cetoacidosis Diabética (CAD) - Guía 2026'
    expect(sanitizeDocTitle(title)).toBe('Manejo de Cetoacidosis Diabética (CAD) - Guía 2026')
  })
})

describe('GoogleDocsExportModal Helpers - getFallbackDocxFileName', () => {
  it('genera el nombre de archivo .docx correcto para la descarga local de rescate', () => {
    const title = 'Hipertensión Arterial: Crisis y Manejo?'
    const fileName = getFallbackDocxFileName(title)
    expect(fileName).toBe('Hipertensión Arterial- Crisis y Manejo-.docx')
  })

  it('genera el nombre por defecto con extensión .docx si el título es vacío o inválido', () => {
    expect(getFallbackDocxFileName('')).toBe('Nota Clínica.docx')
    expect(getFallbackDocxFileName('   ::: ???   ')).toBe('Nota Clínica.docx')
  })
})

describe('GoogleDocsExportModal Helpers - isSessionExpiredError', () => {
  it('detecta códigos HTTP 401 en mensajes de error de Google Drive', () => {
    expect(isSessionExpiredError('Error de Google Drive (401): Unauthorized')).toBe(true)
    expect(isSessionExpiredError('HTTP 401')).toBe(true)
  })

  it('detecta palabras clave de expiración en español e inglés sin distinción de mayúsculas', () => {
    expect(isSessionExpiredError('Sesión de Google Drive expirada')).toBe(true)
    expect(isSessionExpiredError('Token expirado recientemente')).toBe(true)
    expect(isSessionExpiredError('Token has expired')).toBe(true)
  })

  it('detecta códigos de token inválido devueltos por OAuth de Google', () => {
    expect(isSessionExpiredError('invalid_token: the access token is invalid or malformed')).toBe(true)
  })

  it('retorna false para errores que no corresponden a caducidad de sesión', () => {
    expect(isSessionExpiredError('Error de red: connection timeout')).toBe(false)
    expect(isSessionExpiredError('Failed to fetch')).toBe(false)
    expect(isSessionExpiredError('Error 500 Internal Server Error')).toBe(false)
    expect(isSessionExpiredError('')).toBe(false)
    expect(isSessionExpiredError(null)).toBe(false)
    expect(isSessionExpiredError(undefined)).toBe(false)
  })
})

describe('GoogleDocsExportModal Constants & Scopes', () => {
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

  it('asegura que los scopes solicitados para Google Docs incluyan drive.file y drive.appdata', () => {
    expect(GOOGLE_DRIVE_SCOPES).toContain('https://www.googleapis.com/auth/drive.file')
    expect(GOOGLE_DRIVE_SCOPES).toContain('https://www.googleapis.com/auth/drive.appdata')
  })
})
