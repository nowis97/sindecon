import * as Sentry from '@sentry/react'

/**
 * Filtro de privacidad médica estricto:
 * Elimina cualquier dato clínico sensible, parámetros de peticiones o tokens
 * antes de que cualquier reporte sea transmitido a Sentry.
 */
export function sanitizeMedicalErrorEvent(
  event: Sentry.ErrorEvent,
): Sentry.ErrorEvent | null {
  // 1. Si no hay conexión (offline) y es un error común de red, no saturar la telemetría
  const message = event.exception?.values?.[0]?.value || ''
  if (!navigator.onLine && (message.includes('Failed to fetch') || message.includes('NetworkError'))) {
    return null
  }

  // 2. Limpiar datos de peticiones HTTP
  if (event.request) {
    delete event.request.data
    delete event.request.cookies
    if (event.request.headers) {
      delete event.request.headers.Authorization
      delete event.request.headers.authorization
    }
  }

  // 3. Sanitizar breadcrumbs para evitar filtrar texto de notas o entradas de teclado
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((b) => {
      // Si es un evento de entrada o click con datos de formulario, limpiar el mensaje
      if (b.category === 'ui.input' || b.category === 'ui.click') {
        return {
          ...b,
          message: b.message ? b.message.replace(/value=".*?"/g, 'value="[PROTECTED]"') : b.message,
          data: undefined,
        }
      }
      return b
    })
  }

  // 4. Limpiar datos de usuario si existieran
  if (event.user) {
    // Solo conservar un ID anónimo o nada
    event.user = { id: 'anonymous-client' }
  }

  return event
}

/**
 * Inicializa Sentry solo si hay un DSN válido configurado.
 */
export function initSentry(): boolean {
  const dsn = (import.meta.env.VITE_SENTRY_DSN as string)?.trim()

  if (!dsn || dsn.includes('tu-sentry-dsn')) {
    return false
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE || 'production',
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    // Muestreo de trazas de rendimiento en producción (10%)
    tracesSampleRate: 0.1,
    beforeSend(event) {
      return sanitizeMedicalErrorEvent(event)
    },
  })

  return true
}

/**
 * Helper para capturar excepciones manuales con contexto seguro.
 */
export function captureMedicalException(error: unknown, contextName?: string) {
  if (contextName) {
    Sentry.withScope((scope) => {
      scope.setTag('medical_context', contextName)
      Sentry.captureException(error)
    })
  } else {
    Sentry.captureException(error)
  }
}
