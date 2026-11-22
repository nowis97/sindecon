import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  FileOutput,
  FileText,
  Folder,
  Tag,
  Cloud,
  CheckCircle2,
  WifiOff,
  AlertTriangle,
  ExternalLink,
  Download,
  RefreshCw,
  KeyRound,
  Loader2,
} from 'lucide-react'
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
import { BaseModal, PILL_BTN_PRIMARY, PILL_BTN_SECONDARY } from '../common/DialogModal'

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

const EMPTY_TAGS: string[] = []

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
 * Genera el nombre de archivo con extensión .docx a partir del título limpio.
 */
export function getFallbackDocxFileName(rawTitle: string): string {
  const cleanTitle = sanitizeDocTitle(rawTitle)
  return `${cleanTitle}.docx`
}

/**
 * Determina si un error reportado por Google Drive corresponde a sesión expirada / 401.
 */
export function isSessionExpiredError(msg?: string | null): boolean {
  if (!msg) return false
  const lower = msg.toLowerCase()
  return (
    msg.includes('401') ||
    lower.includes('expir') ||
    lower.includes('invalid_token') ||
    lower.includes('unauthorized')
  )
}

function triggerBrowserDownload(blob: Blob, rawTitle: string): void {
  const fileName = getFallbackDocxFileName(rawTitle)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
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
  tags = EMPTY_TAGS,
  dateStr,
  token: propToken,
  onInitiateOAuth,
}) => {
  const [status, setStatus] = useState<GoogleDocsExportStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [docUrl, setDocUrl] = useState<string | null>(null)
  const [, setDocxBlob] = useState<Blob | null>(null)
  const [isDownloading, setIsDownloading] = useState<boolean>(false)

  const isMountedRef = useRef(true)
  const hasStartedRef = useRef(false)
  const docxBlobRef = useRef<Blob | null>(null)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const cleanTitle = sanitizeDocTitle(title)

  const handleDownloadDocx = useCallback(async () => {
    try {
      setIsDownloading(true)
      let blob = docxBlobRef.current
      if (!blob) {
        blob = await generateClinicalDocxBlob(markdown, {
          title: cleanTitle,
          folderPath,
          tags,
          dateStr,
        })
        if (!isMountedRef.current) return
        docxBlobRef.current = blob
        setDocxBlob(blob)
      }
      triggerBrowserDownload(blob, title)
    } catch (err) {
      if (!isMountedRef.current) return
      setErrorMessage(
        `Error al preparar la descarga local: ${(err as Error).message || 'Error desconocido'}`,
      )
    } finally {
      if (isMountedRef.current) {
        setIsDownloading(false)
      }
    }
  }, [markdown, cleanTitle, folderPath, tags, dateStr, title])

  const executeExport = useCallback(
    async (activeToken: string) => {
      if (!navigator.onLine) {
        try {
          if (!isMountedRef.current) return
          setStatus('rendering')
          let blob = docxBlobRef.current
          if (!blob) {
            blob = await generateClinicalDocxBlob(markdown, {
              title: cleanTitle,
              folderPath,
              tags,
              dateStr,
            })
            if (!isMountedRef.current) return
            docxBlobRef.current = blob
            setDocxBlob(blob)
          }
          if (!isMountedRef.current) return
          setStatus('offline')
        } catch (err) {
          if (!isMountedRef.current) return
          setStatus('error')
          setErrorMessage((err as Error).message || 'Error al generar el documento DOCX')
        }
        return
      }

      try {
        if (!isMountedRef.current) return
        setErrorMessage(null)
        setStatus('rendering')

        let blob = docxBlobRef.current
        if (!blob) {
          blob = await generateClinicalDocxBlob(markdown, {
            title: cleanTitle,
            folderPath,
            tags,
            dateStr,
          })
          if (!isMountedRef.current) return
          docxBlobRef.current = blob
          setDocxBlob(blob)
        }

        if (!isMountedRef.current) return
        setStatus('uploading')
        const uploadResult = await uploadDocxAsGoogleDoc(blob, cleanTitle, activeToken)
        if (!isMountedRef.current) return
        setDocUrl(uploadResult.url)
        setStatus('success')
      } catch (err) {
        if (!isMountedRef.current) return
        const msg = (err as Error).message || 'Error durante la exportación a Google Docs'
        if (isSessionExpiredError(msg)) {
          clearStoredToken(false)
          setStatus('error')
          setErrorMessage(
            'Tu sesión de Google Drive ha expirado. Reconecta tu cuenta para continuar sin perder tus datos.',
          )
        } else {
          setStatus('error')
          setErrorMessage(msg)
        }
      }
    },
    [markdown, cleanTitle, folderPath, tags, dateStr],
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
      if (!isMountedRef.current) return
      setStatus('error')
      setErrorMessage(
        'No hay Client ID de Google configurado. Puedes descargar el archivo .docx directamente o configurarlo en Sincronización Drive.',
      )
      return
    }

    if (!win.google?.accounts?.oauth2) {
      if (!isMountedRef.current) return
      setStatus('error')
      setErrorMessage(
        'Google Identity Services no está listo en el navegador. Verifica tu conexión o descarga el archivo .docx.',
      )
      return
    }

    try {
      const client = win.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GOOGLE_DRIVE_SCOPES,
        callback: (response) => {
          if (!isMountedRef.current) return
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
      if (!isMountedRef.current) return
      setStatus('error')
      setErrorMessage((e as Error).message || 'Error al iniciar sesión con Google')
    }
  }, [executeExport, onInitiateOAuth])

  useEffect(() => {
    if (!isOpen) {
      hasStartedRef.current = false
      docxBlobRef.current = null
      setStatus('idle')
      setErrorMessage(null)
      setDocUrl(null)
      setDocxBlob(null)
      return
    }

    if (hasStartedRef.current) return
    hasStartedRef.current = true

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

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Exportar a Google Docs"
      subtitle="Maquetación clínica SINDECON con diagramas Mermaid integrados."
      icon={<FileOutput className="h-5 w-5" />}
      titleId="gdocs-modal-title"
      maxWidthClass="max-w-lg"
      footer={
        <button type="button" className={PILL_BTN_SECONDARY} onClick={onClose}>
          {status === 'success' ? 'Listo' : 'Cerrar'}
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Summary Chip */}
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/70 p-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]">
            <FileText className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <strong className="block truncate text-sm font-semibold text-[var(--ch-text-primary)]">
              {cleanTitle}
            </strong>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-[11px] text-[var(--ch-text-muted)]">
              {folderPath && (
                <span className="inline-flex items-center gap-1">
                  <Folder className="h-3 w-3" />
                  {folderPath}
                </span>
              )}
              {tags && tags.length > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  {tags.map((t) => `#${t}`).join(' ')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Rendering / Uploading */}
        {(status === 'rendering' || status === 'uploading') && (
          <div className="flex flex-col items-center rounded-2xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/50 p-6 text-center">
            <Loader2 className="mb-3 h-8 w-8 animate-spin text-[var(--ch-accent)]" />
            <h4 className="font-serif text-base font-semibold text-[var(--ch-text-primary)]">
              {status === 'rendering'
                ? 'Renderizando documento clínico…'
                : 'Subiendo a Google Drive…'}
            </h4>
            <p className="mt-1 text-xs leading-relaxed text-[var(--ch-text-muted)]">
              {status === 'rendering'
                ? 'Procesando diagramas Mermaid en alta resolución y maquetación médica.'
                : 'Convirtiendo el documento a Google Docs nativo para editarlo en cualquier equipo.'}
            </p>
          </div>
        )}

        {/* Success */}
        {status === 'success' && (
          <div className="flex flex-col items-center rounded-2xl border border-emerald-500/35 bg-emerald-500/8 p-5 text-center">
            <CheckCircle2 className="mb-2 h-10 w-10 text-emerald-600" />
            <h4 className="font-serif text-base font-semibold text-[var(--ch-text-primary)]">
              Documento exportado con éxito
            </h4>
            <p className="mt-1 mb-4 text-xs text-[var(--ch-text-secondary)]">
              Ya está disponible en tu Google Drive y listo para abrir en Google Docs.
            </p>
            <div className="flex w-full flex-col gap-2">
              {docUrl && (
                <a
                  href={docUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${PILL_BTN_PRIMARY} w-full`}
                >
                  <span>Abrir en Google Docs</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              <button
                type="button"
                onClick={() => void handleDownloadDocx()}
                disabled={isDownloading}
                className={`${PILL_BTN_SECONDARY} w-full`}
              >
                <Download className="h-3.5 w-3.5" />
                <span>{isDownloading ? 'Preparando descarga…' : 'Descargar copia .docx'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Offline */}
        {status === 'offline' && (
          <div className="flex flex-col items-center rounded-2xl border border-amber-500/35 bg-amber-500/10 p-5 text-center">
            <WifiOff className="mb-2 h-9 w-9 text-amber-600" />
            <h4 className="font-serif text-base font-semibold text-[var(--ch-text-primary)]">
              Modo sin conexión (Offline)
            </h4>
            <p className="mt-1 mb-4 text-xs leading-relaxed text-[var(--ch-text-secondary)]">
              Google Docs requiere internet para sincronizarse, pero puedes descargar ahora mismo
              el archivo .docx con todo el diseño clínico.
            </p>
            <div className="flex w-full flex-col gap-2">
              <button
                type="button"
                className={`${PILL_BTN_PRIMARY} w-full`}
                onClick={() => void handleDownloadDocx()}
                disabled={isDownloading}
              >
                <Download className="h-3.5 w-3.5" />
                <span>{isDownloading ? 'Generando archivo…' : 'Descargar archivo .docx'}</span>
              </button>
              <button
                type="button"
                className={`${PILL_BTN_SECONDARY} w-full`}
                onClick={() => {
                  const currentToken = propToken || getStoredToken()
                  if (currentToken) void executeExport(currentToken)
                  else handleOAuthConnect()
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Reintentar conexión</span>
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="flex flex-col gap-3 rounded-2xl border border-red-500/35 bg-red-500/8 p-4">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <h4 className="font-serif text-sm font-semibold">
                No se pudo completar la exportación
              </h4>
            </div>
            <p className="text-xs leading-relaxed text-[var(--ch-text-secondary)]">
              {errorMessage || 'Ha ocurrido un error inesperado al procesar la solicitud.'}
            </p>
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                className={`${PILL_BTN_PRIMARY} w-full`}
                onClick={handleOAuthConnect}
              >
                <KeyRound className="h-3.5 w-3.5" />
                <span>Conectar con Google y reintentar</span>
              </button>
              <button
                type="button"
                onClick={() => void handleDownloadDocx()}
                disabled={isDownloading}
                className={`${PILL_BTN_SECONDARY} w-full`}
              >
                <Download className="h-3.5 w-3.5" />
                <span>{isDownloading ? 'Generando descarga…' : 'Descargar archivo .docx'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Idle */}
        {status === 'idle' && (
          <div className="flex flex-col items-center rounded-2xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/50 p-5 text-center">
            <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]">
              <Cloud className="h-5 w-5" />
            </span>
            <h4 className="font-serif text-base font-semibold text-[var(--ch-text-primary)]">
              Conectar con Google Drive
            </h4>
            <p className="mt-1 mb-4 text-xs leading-relaxed text-[var(--ch-text-muted)]">
              Autoriza el acceso para crear el documento nativo en Google Docs con tus diagramas
              clínicos integrados.
            </p>
            <div className="flex w-full flex-col gap-2">
              <button
                type="button"
                className={`${PILL_BTN_PRIMARY} w-full`}
                onClick={handleOAuthConnect}
              >
                <KeyRound className="h-3.5 w-3.5" />
                <span>Conectar con Google Drive</span>
              </button>
              <button
                type="button"
                onClick={() => void handleDownloadDocx()}
                disabled={isDownloading}
                className={`${PILL_BTN_SECONDARY} w-full`}
              >
                <Download className="h-3.5 w-3.5" />
                <span>{isDownloading ? 'Generando archivo…' : 'Descargar archivo .docx'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </BaseModal>
  )
}
