import { describe, it, expect, vi, beforeEach } from 'vitest'
import { uploadDocxAsGoogleDoc } from './googleDocsUpload'

describe('googleDocsUpload', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('arma la petición multipart con metadatos de conversión a Google Doc', async () => {
    const mockFileId = 'mock-doc-12345'
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: mockFileId }),
    })
    global.fetch = mockFetch

    const blob = new Blob(['dummy content'], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })

    const result = await uploadDocxAsGoogleDoc(blob, 'Protocolo RCP', 'fake-token')

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, requestInit] = mockFetch.mock.calls[0]
    expect(url).toBe('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart')
    expect(requestInit.method).toBe('POST')
    expect(requestInit.headers.Authorization).toBe('Bearer fake-token')

    // Verificar cabecera multipart y boundary
    const contentType = requestInit.headers['Content-Type']
    expect(contentType).toMatch(/^multipart\/related; boundary=-------sindecon_gdocs_/)

    // Verificar que el payload contiene los metadatos y el tipo mime de Google Doc
    const textDecoder = new TextDecoder()
    const bodyText = textDecoder.decode(requestInit.body as Uint8Array)
    expect(bodyText).toContain('"mimeType":"application/vnd.google-apps.document"')
    expect(bodyText).toContain('"name":"Protocolo RCP"')
    expect(bodyText).toContain('dummy content')

    expect(result.fileId).toBe(mockFileId)
    expect(result.url).toBe(`https://docs.google.com/document/d/${mockFileId}/edit`)
  })

  it('lanza un error claro si la API de Google Drive rechaza la subida', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'Invalid credentials',
    })
    global.fetch = mockFetch

    const blob = new Blob(['test'])
    await expect(uploadDocxAsGoogleDoc(blob, 'Test', 'bad-token')).rejects.toThrow(
      'Error de Google Drive (401)'
    )
  })

  it('usa statusText en el error si response.text() está vacío', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => '',
    })
    global.fetch = mockFetch

    const blob = new Blob(['test'])
    await expect(uploadDocxAsGoogleDoc(blob, 'Test', 'any-token')).rejects.toThrow(
      'Error de Google Drive (500): Internal Server Error'
    )
  })
})
