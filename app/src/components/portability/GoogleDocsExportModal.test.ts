import { describe, it, expect, vi } from 'vitest'
import {
  sanitizeDocTitle,
  getFallbackDocxFileName,
  isSessionExpiredError,
  resolveTokenForDocsExport,
  uploadDocxWithTokenRetry,
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

describe('GoogleDocsExportModal Helpers - Silent Refresh & Retry', () => {
  it('resolveTokenForDocsExport reutiliza token vigente y refresca vía BFF si caducó', async () => {
    const ensureToken = vi.fn().mockResolvedValue('ya29.refreshed-docs')

    const fromProp = await resolveTokenForDocsExport('ya29.prop', {
      getToken: () => null,
      isExpired: () => true,
      ensureToken,
    })
    expect(fromProp).toBe('ya29.prop')
    expect(ensureToken).not.toHaveBeenCalled()

    const refreshed = await resolveTokenForDocsExport(null, {
      getToken: () => null,
      isExpired: () => true,
      ensureToken,
    })
    expect(refreshed).toBe('ya29.refreshed-docs')
    expect(ensureToken).toHaveBeenCalledWith(false)
  })

  it('resolveTokenForDocsExport reutiliza el token almacenado si no está próximo a expirar y refresca si ya expiró', async () => {
    const ensureToken = vi.fn().mockResolvedValue('ya29.refreshed-after-expiry')

    const fromStorage = await resolveTokenForDocsExport(undefined, {
      getToken: () => 'ya29.stored-valid',
      isExpired: (margin) => {
        expect(margin).toBe(1)
        return false
      },
      ensureToken,
    })
    expect(fromStorage).toBe('ya29.stored-valid')
    expect(ensureToken).not.toHaveBeenCalled()

    const refreshedExpired = await resolveTokenForDocsExport(undefined, {
      getToken: () => 'ya29.stored-expiring',
      isExpired: () => true,
      ensureToken,
    })
    expect(refreshedExpired).toBe('ya29.refreshed-after-expiry')
    expect(ensureToken).toHaveBeenCalledTimes(1)
    expect(ensureToken).toHaveBeenCalledWith(false)
  })

  it('uploadDocxWithTokenRetry reintenta una vez ante error 401 usando ensureToken(true)', async () => {
    const blob = new Blob(['docx'], { type: 'application/octet-stream' })
    const upload = vi
      .fn()
      .mockRejectedValueOnce(new Error('Error de Google Drive (401): Unauthorized'))
      .mockResolvedValueOnce({ fileId: 'doc-1', url: 'https://docs.google.com/document/d/doc-1/edit' })
    const ensureToken = vi.fn().mockResolvedValue('ya29.rotated')

    const res = await uploadDocxWithTokenRetry(blob, 'Protocolo Shock', 'ya29.stale', {
      upload,
      ensureToken,
    })

    expect(ensureToken).toHaveBeenCalledWith(true)
    expect(upload).toHaveBeenCalledTimes(2)
    expect(upload).toHaveBeenNthCalledWith(1, blob, 'Protocolo Shock', 'ya29.stale')
    expect(upload).toHaveBeenNthCalledWith(2, blob, 'Protocolo Shock', 'ya29.rotated')
    expect(res.fileId).toBe('doc-1')
  })

  it('uploadDocxWithTokenRetry propaga errores que no son de sesión sin refrescar token', async () => {
    const blob = new Blob(['docx'], { type: 'application/octet-stream' })
    const upload = vi.fn().mockRejectedValueOnce(new Error('Error de Google Drive (500): Internal Server Error'))
    const ensureToken = vi.fn()

    await expect(
      uploadDocxWithTokenRetry(blob, 'Protocolo Shock', 'ya29.ok', {
        upload,
        ensureToken,
      }),
    ).rejects.toThrow('Error de Google Drive (500): Internal Server Error')

    expect(ensureToken).not.toHaveBeenCalled()
    expect(upload).toHaveBeenCalledTimes(1)
  })

  it('uploadDocxWithTokenRetry relanza el 401 si ensureToken(true) retorna null y no entra en bucle si el reintento también falla', async () => {
    const blob = new Blob(['docx'], { type: 'application/octet-stream' })

    const uploadNoRefresh = vi
      .fn()
      .mockRejectedValueOnce(new Error('Error de Google Drive (401): Unauthorized'))
    const ensureNull = vi.fn().mockResolvedValue(null)

    await expect(
      uploadDocxWithTokenRetry(blob, 'Protocolo Shock', 'ya29.stale', {
        upload: uploadNoRefresh,
        ensureToken: ensureNull,
      }),
    ).rejects.toThrow('Error de Google Drive (401): Unauthorized')
    expect(ensureNull).toHaveBeenCalledWith(true)
    expect(uploadNoRefresh).toHaveBeenCalledTimes(1)

    const uploadDouble401 = vi
      .fn()
      .mockRejectedValueOnce(new Error('Error de Google Drive (401): Unauthorized'))
      .mockRejectedValueOnce(new Error('Error de Google Drive (401): Still Unauthorized'))
    const ensureRotated = vi.fn().mockResolvedValue('ya29.rotated')

    await expect(
      uploadDocxWithTokenRetry(blob, 'Protocolo Shock', 'ya29.stale', {
        upload: uploadDouble401,
        ensureToken: ensureRotated,
      }),
    ).rejects.toThrow('Error de Google Drive (401): Still Unauthorized')
    expect(ensureRotated).toHaveBeenCalledTimes(1)
    expect(uploadDouble401).toHaveBeenCalledTimes(2)
  })
})
