import React, { useState, useEffect, useCallback } from 'react'
import { generateClinicalDocxBlob } from '../../domain/gdocs/clinicalDocxGenerator'
import { uploadDocxAsGoogleDoc } from '../../pwa/googleDocsUpload'
import {
  getStoredToken,
  setStoredToken,
  clearStoredToken,
  isTokenExpired,
  getStoredClientId,
  GOOGLE_DRIVE_SCOPES,
} from '../../pwa/googleDrive'

export type GoogleDocsExportStatus =
  | 'idle'
  | 'rendering'
  | 'uploading'
  | 'success'
  | 'error'
  | 'offline'

export interface GoogleDocsExportModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  markdown: string
  folderPath?: string
  tags?: string[]
  dateStr?: string
  token?: string | null
  onInitiateOAuth?: () => void
}

/**
 * Sanitiza el título para nombres de archivos y documentos,
 * reemplazando caracteres prohibidos en sistemas de archivos y URLs por guiones.
 */
export function sanitizeDocTitle(rawTitle?: string | null): string {
  if (!rawTitle || typeof rawTitle !== 'string') {
    return 'Nota Clínica'
  }
  const replaced = rawTitle.replace(/[\\/:*?"<>|]/g, '-').trim()
  const withoutDashesOrSpaces = replaced.replace(/[-_\s]/g, '')
  if (!withoutDashesOrSpaces) {
    return 'Nota Clínica'
  }
  return replaced
}

/**
 * Dispara la descarga local en el navegador del Blob DOCX generado.
 */
function triggerBrowserDownload(blob: Blob, rawTitle: string): void {
  const cleanTitle = sanitizeDocTitle(rawTitle)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${cleanTitle}.docx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const GoogleDocsExportModal: React.FC<GoogleDocsExportModalProps> = ({
  isOpen,
  onClose,
  title,
  markdown,
  folderPath,
  tags = [],
  dateStr,
  token: propToken,
  onInitiateOAuth,
}) => {
  const [status, setStatus] = useState<GoogleDocsExportStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [docUrl, setDocUrl] = useState<string | null>(null)
  const [docxBlob, setDocxBlob] = useState<Blob | null>(null)
  const [isDownloading, setIsDownloading] = useState<boolean>(false)

  const cleanTitle = sanitizeDocTitle(title)

  const handleDownloadDocx = useCallback(async () => {
    try {
      setIsDownloading(true)
      let blob = docxBlob
      if (!blob) {
        blob = await generateClinicalDocxBlob(markdown, {
          title: cleanTitle,
          folderPath,
          tags,
          dateStr,
        })
        setDocxBlob(blob)
      }
      triggerBrowserDownload(blob, title)
    } catch (err) {
      setErrorMessage(
        `Error al preparar la descarga local: ${(err as Error).message || 'Error desconocido'}`
      )
    } finally {
      setIsDownloading(false)
    }
  }, [docxBlob, markdown, cleanTitle, folderPath, tags, dateStr, title])

  const executeExport = useCallback(
    async (activeToken: string) => {
      if (!navigator.onLine) {
        try {
          setStatus('rendering')
          const blob = await generateClinicalDocxBlob(markdown, {
            title: cleanTitle,
            folderPath,
            tags,
            dateStr,
          })
          setDocxBlob(blob)
          setStatus('offline')
        } catch (err) {
          setStatus('error')
          setErrorMessage((err as Error).message || 'Error al generar el documento DOCX')
        }
        return
      }

      try {
        setErrorMessage(null)
        setStatus('rendering')

        // 1. Renderizar DOCX con maquetación clínica y diagramas Mermaid
        let blob = docxBlob
        if (!blob) {
          blob = await generateClinicalDocxBlob(markdown, {
            title: cleanTitle,
            folderPath,
            tags,
            dateStr,
          })
          setDocxBlob(blob)
        }

        // 2. Subir a Google Drive con conversión a Google Docs nativo
        setStatus('uploading')
        const uploadResult = await uploadDocxAsGoogleDoc(blob, cleanTitle, activeToken)
        setDocUrl(uploadResult.url)
        setStatus('success')
      } catch (err) {
        const msg = (err as Error).message || 'Error durante la exportación a Google Docs'
        if (
          msg.includes('401') ||
          msg.toLowerCase().includes('expirad') ||
          msg.toLowerCase().includes('invalid_token')
        ) {
          clearStoredToken(false)
          setStatus('error')
          setErrorMessage(
            'Tu sesión de Google Drive ha expirado. Por favor reconecta tu cuenta para continuar sin perder tus datos.'
          )
        } else {
          setStatus('error')
          setErrorMessage(msg)
        }
      }
    },
    [markdown, cleanTitle, folderPath, tags, dateStr, docxBlob]
  )

  const handleOAuthConnect = useCallback(() => {
    if (onInitiateOAuth) {
      onInitiateOAuth()
      return
    }

    const win = window as unknown as {
      google?: {
        accounts?: {
          oauth2?: {
            initTokenClient: (config: {
              client_id: string
              scope: string
              callback: (res: { access_token?: string; expires_in?: number; error?: string }) => void
            }) => { requestAccessToken: (opts?: { prompt?: string }) => void }
          }
        }
      }
    }

    const clientId = getStoredClientId()
    if (!clientId) {
      setStatus('error')
      setErrorMessage(
        'No hay Client ID de Google configurado. Puedes descargar el archivo .docx directamente o configurar tu Client ID en Ajustes.'
      )
      return
    }

    if (!win.google?.accounts?.oauth2) {
      setStatus('error')
      setErrorMessage(
        'Google Identity Services no está listo en el navegador. Por favor verifica tu conexión o descarga el archivo .docx.'
      )
      return
    }

    try {
      const client = win.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GOOGLE_DRIVE_SCOPES,
        callback: (response) => {
          if (response.access_token) {
            setStoredToken(response.access_token, response.expires_in || 3600)
            void executeExport(response.access_token)
          } else if (response.error) {
            setStatus('error')
            setErrorMessage(`Error de Google Identity Services: ${response.error}`)
          }
        },
      })
      client.requestAccessToken({ prompt: '' })
    } catch (e) {
      setStatus('error')
      setErrorMessage((e as Error).message || 'Error al iniciar sesión con Google')
    }
  }, [executeExport, onInitiateOAuth])

  // Inicializar estado cuando se abre el modal
  useEffect(() => {
    if (!isOpen) {
      setStatus('idle')
      setErrorMessage(null)
      setDocUrl(null)
      setDocxBlob(null)
      return
    }

    if (!navigator.onLine) {
      setStatus('offline')
      return
    }

    const currentToken = propToken || getStoredToken()
    if (currentToken && !isTokenExpired(1)) {
      void executeExport(currentToken)
    } else {
      setStatus('idle')
    }
  }, [isOpen, propToken, executeExport])

  // Cierre con Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="gdocs-modal-title"
    >
      <div
        className="modal-content gdocs-export-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '540px',
          width: '92%',
          background: 'var(--bg-surface, #ffffff)',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.08)',
          overflow: 'hidden',
        }}
      >
        {/* Cabecera del Modal */}
        <div className="modal-header" style={{ padding: '20px 24px 16px' }}>
          <div className="header-title-group">
            <div className="topic-modal-title-line" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="topic-modal-icon" style={{ fontSize: '1.4rem' }}>📄</span>
              <h3 id="gdocs-modal-title" style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>
                Exportar a Google Docs
              </h3>
            </div>
            <span
              className="header-subtitle"
              style={{ display: 'block', marginTop: '4px', fontSize: '0.82rem', color: '#64748b' }}
            >
              Maquetación clínica oficial SINDECON con diagramas Mermaid integrados.
            </span>
          </div>
          <button
            type="button"
            className="btn-close"
            onClick={onClose}
            aria-label="Cerrar modal"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.2rem',
              cursor: 'pointer',
              color: '#64748b',
            }}
          >
            ✕
          </button>
        </div>

        <div className="modal-body" style={{ padding: '0 24px 20px' }}>
          {/* Ficha Resumen del Artículo */}
          <div className="pdf-article-preview-badge">
            <span className="preview-icon">📝</span>
            <div className="preview-info">
              <strong className="preview-title">{cleanTitle}</strong>
              {folderPath && <span className="preview-path">📁 {folderPath}</span>}
              {tags && tags.length > 0 && (
                <span className="preview-path">🏷️ {tags.join(', ')}</span>
              )}
            </div>
          </div>

          {/* Estado: Renderizando DOCX en memoria */}
          {status === 'rendering' && (
            <div
              style={{
                textAlign: 'center',
                padding: '24px 16px',
                background: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🎨</div>
              <h4 style={{ margin: '0 0 6px', color: '#008080' }}>
                Renderizando documento clínico...
              </h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                Procesando diagramas Mermaid en alta resolución y estructurando el formato médico oficial.
              </p>
            </div>
          )}

          {/* Estado: Subiendo a Google Drive */}
          {status === 'uploading' && (
            <div
              style={{
                textAlign: 'center',
                padding: '24px 16px',
                background: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>☁️</div>
              <h4 style={{ margin: '0 0 6px', color: '#008080' }}>
                Subiendo a Google Drive...
              </h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                Convirtiendo el documento a Google Docs nativo para su edición y lectura en tablet o PC.
              </p>
            </div>
          )}

          {/* Estado: Éxito */}
          {status === 'success' && (
            <div
              style={{
                textAlign: 'center',
                padding: '20px 16px',
                background: '#f0fdfa',
                borderRadius: '8px',
                border: '1px solid #99f6e4',
              }}
            >
              <div style={{ fontSize: '2.4rem', marginBottom: '8px' }}>✅</div>
              <h4 style={{ margin: '0 0 8px', color: '#0f766e', fontSize: '1.1rem' }}>
                ¡Documento exportado con éxito!
              </h4>
              <p style={{ margin: '0 0 18px', fontSize: '0.88rem', color: '#134e4a' }}>
                El documento ya está disponible en tu Google Drive y listo para abrir en la app de Google Docs.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
                {docUrl && (
                  <a
                    href={docUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '12px 24px',
                      fontSize: '0.95rem',
                      fontWeight: 600,
                      color: '#ffffff',
                      backgroundColor: '#008080',
                      borderRadius: '8px',
                      textDecoration: 'none',
                      width: '100%',
                      boxSizing: 'border-box',
                      boxShadow: '0 4px 6px -1px rgba(0, 128, 128, 0.3)',
                    }}
                  >
                    Abrir en Google Docs ↗
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => void handleDownloadDocx()}
                  disabled={isDownloading}
                  style={{
                    background: 'none',
                    border: '1px solid #cbd5e1',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    color: '#475569',
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  {isDownloading ? 'Preparando descarga...' : '💾 Descargar copia .docx'}
                </button>
              </div>
            </div>
          )}

          {/* Estado: Offline */}
          {status === 'offline' && (
            <div
              style={{
                textAlign: 'center',
                padding: '20px 16px',
                background: '#fffbeb',
                borderRadius: '8px',
                border: '1px solid #fde68a',
              }}
            >
              <div style={{ fontSize: '2.2rem', marginBottom: '8px' }}>📶</div>
              <h4 style={{ margin: '0 0 6px', color: '#b45309' }}>
                Modo Sin Conexión (Offline)
              </h4>
              <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: '#92400e' }}>
                Google Docs requiere conexión a internet para sincronizarse. Sin embargo, puedes descargar el archivo con diseño clínico completo directamente a tu dispositivo.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => void handleDownloadDocx()}
                  disabled={isDownloading}
                  style={{
                    padding: '12px 20px',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    backgroundColor: '#008080',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  {isDownloading ? 'Generando archivo...' : '💾 Descargar archivo .docx'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const currentToken = propToken || getStoredToken()
                    if (currentToken) void executeExport(currentToken)
                    else handleOAuthConnect()
                  }}
                  style={{
                    background: 'none',
                    border: '1px solid #cbd5e1',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    color: '#64748b',
                    cursor: 'pointer',
                  }}
                >
                  🔄 Reintentar conexión
                </button>
              </div>
            </div>
          )}

          {/* Estado: Error */}
          {status === 'error' && (
            <div
              style={{
                padding: '18px 16px',
                background: '#fef2f2',
                borderRadius: '8px',
                border: '1px solid #fecaca',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '1.4rem' }}>⚠️</span>
                <h4 style={{ margin: 0, color: '#b91c1c' }}>
                  No se pudo completar la exportación
                </h4>
              </div>
              <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: '#7f1d1d' }}>
                {errorMessage || 'Ha ocurrido un error inesperado al procesar la solicitud.'}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleOAuthConnect}
                  style={{
                    padding: '10px 18px',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    backgroundColor: '#008080',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  🔑 Conectar con Google y reintentar
                </button>

                <button
                  type="button"
                  onClick={() => void handleDownloadDocx()}
                  disabled={isDownloading}
                  style={{
                    background: 'none',
                    border: '1px solid #cbd5e1',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    color: '#475569',
                    cursor: 'pointer',
                  }}
                >
                  {isDownloading ? 'Generando descarga...' : '💾 Descargar archivo .docx'}
                </button>
              </div>
            </div>
          )}

          {/* Estado: Idle (Autenticación requerida o inicio manual) */}
          {status === 'idle' && (
            <div
              style={{
                textAlign: 'center',
                padding: '20px 16px',
                background: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>☁️</div>
              <h4 style={{ margin: '0 0 6px', color: '#0f172a' }}>
                Conectar con Google Drive
              </h4>
              <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: '#64748b' }}>
                Para crear el documento directamente en Google Docs con tus diagramas y estilos, autoriza el acceso a tu Google Drive.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleOAuthConnect}
                  style={{
                    padding: '12px 20px',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    backgroundColor: '#008080',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  🔑 Conectar con Google Drive
                </button>

                <button
                  type="button"
                  onClick={() => void handleDownloadDocx()}
                  disabled={isDownloading}
                  style={{
                    background: 'none',
                    border: '1px solid #cbd5e1',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    color: '#475569',
                    cursor: 'pointer',
                  }}
                >
                  {isDownloading ? 'Generando archivo...' : '💾 Descargar archivo .docx'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Pie del Modal */}
        <div
          className="modal-footer"
          style={{
            padding: '12px 24px 16px',
            borderTop: '1px solid var(--border-subtle, #f1f5f9)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#475569',
              cursor: 'pointer',
            }}
          >
            {status === 'success' ? 'Listo' : 'Cerrar'}
          </button>
        </div>
      </div>
    </div>
  )
}
