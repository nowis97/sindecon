import { getStoredClientId } from './googleDrive'

export const GOOGLE_IDENTITY_SCOPES = 'openid email profile'

export interface GoogleIdentityProfile {
  sub: string
  email: string
  name: string
  avatarUrl?: string
  driveConnected?: boolean
}

export interface GoogleLoginCallbacks {
  clientId?: string
  loginHint?: string
  fetchFn?: typeof fetch
  onSuccess: (profile: GoogleIdentityProfile) => void
  onError: (message: string) => void
}

interface GsiGlobal {
  accounts?: {
    oauth2?: {
      initCodeClient?: (config: {
        client_id: string
        scope: string
        ux_mode?: string
        login_hint?: string
        callback: (resp: { code?: string; error?: string; error_description?: string }) => void
      }) => { requestCode: () => void }
      initTokenClient?: (config: {
        client_id: string
        scope: string
        hint?: string
        callback: (resp: { access_token?: string; error?: string; error_description?: string }) => void
      }) => { requestAccessToken: (override?: { prompt?: string }) => void }
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function safeGetStoredClientId(): string {
  try {
    return typeof localStorage !== 'undefined' ? getStoredClientId() : ''
  } catch {
    return ''
  }
}

export async function checkServerAuthSession(
  fetchFn: typeof fetch = fetch,
): Promise<GoogleIdentityProfile | null> {
  try {
    const res = await fetchFn('/api/auth/session', {
      method: 'POST',
      credentials: 'include',
    })
    if (!res.ok) return null
    const data: unknown = await res.json()
    if (!isRecord(data) || data.authenticated !== true || !isRecord(data.user)) return null
    const sub = typeof data.user.sub === 'string' ? data.user.sub : ''
    const email = typeof data.user.email === 'string' ? data.user.email : ''
    if (!email || !sub) return null
    return {
      sub,
      email,
      name: typeof data.user.name === 'string' && data.user.name ? data.user.name : email,
      avatarUrl: typeof data.user.picture === 'string' ? data.user.picture : undefined,
    }
  } catch {
    return null
  }
}

export async function logoutServerAuthSession(fetchFn: typeof fetch = fetch): Promise<void> {
  try {
    await fetchFn('/api/auth/logout', { method: 'POST', credentials: 'include' })
  } catch {
    // Offline o sin Worker: la sesión local igual se cierra.
  }
}

export function initiateGoogleLoginFlow(callbacks: GoogleLoginCallbacks): void {
  const clientId = callbacks.clientId || safeGetStoredClientId()
  if (!clientId) {
    callbacks.onError('Falta configurar el Google Client ID en el entorno de la aplicación.')
    return
  }

  const oauth2 = (globalThis as { google?: GsiGlobal }).google?.accounts?.oauth2
  if (!oauth2) {
    callbacks.onError('Servicio Google Identity no disponible (sin conexión o bloqueado).')
    return
  }

  const fetchFn = callbacks.fetchFn ?? fetch

  const runTokenFallback = () => {
    if (typeof oauth2.initTokenClient !== 'function') {
      callbacks.onError('No hay cliente OAuth disponible para iniciar sesión con Google.')
      return
    }
    const tokenClient = oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_IDENTITY_SCOPES,
      hint: callbacks.loginHint,
      callback: async (resp) => {
        if (resp.error || !resp.access_token) {
          callbacks.onError(resp.error_description || 'Inicio de sesión con Google cancelado.')
          return
        }
        try {
          const uiRes = await fetchFn('https://openidconnect.googleapis.com/v1/userinfo', {
            headers: { Authorization: `Bearer ${resp.access_token}` },
          })
          if (!uiRes.ok) {
            callbacks.onError('Google no devolvió los datos del perfil.')
            return
          }
          const ui: unknown = await uiRes.json()
          if (!isRecord(ui)) {
            callbacks.onError('Google no devolvió los datos del perfil.')
            return
          }
          const sub = typeof ui.sub === 'string' ? ui.sub : ''
          const email = typeof ui.email === 'string' ? ui.email : ''
          if (!email || !sub || ui.email_verified === false) {
            callbacks.onError('La cuenta Google no entregó un correo verificado.')
            return
          }
          callbacks.onSuccess({
            sub,
            email,
            name: typeof ui.name === 'string' && ui.name ? ui.name : email,
            avatarUrl: typeof ui.picture === 'string' ? ui.picture : undefined,
            driveConnected: false,
          })
        } catch {
          callbacks.onError('No se pudo validar tu perfil de Google.')
        }
      },
    })
    tokenClient.requestAccessToken({ prompt: callbacks.loginHint ? '' : 'select_account' })
  }

  if (typeof oauth2.initCodeClient === 'function') {
    const codeClient = oauth2.initCodeClient({
      client_id: clientId,
      scope: GOOGLE_IDENTITY_SCOPES,
      ux_mode: 'popup',
      login_hint: callbacks.loginHint,
      callback: async (resp) => {
        if (resp.error || !resp.code) {
          callbacks.onError(resp.error_description || 'Inicio de sesión con Google cancelado.')
          return
        }
        try {
          const res = await fetchFn('/api/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ code: resp.code }),
          })
          if (res.status === 404 || res.status === 405) {
            runTokenFallback()
            return
          }
          if (!res.ok) {
            callbacks.onError('No se pudo validar el código de Google en el servidor.')
            return
          }
          const data: unknown = await res.json()
          if (!isRecord(data) || !isRecord(data.user)) {
            callbacks.onError('Respuesta incompleta del servidor de autenticación.')
            return
          }
          const sub = typeof data.user.sub === 'string' ? data.user.sub : ''
          const email = typeof data.user.email === 'string' ? data.user.email : ''
          const name = typeof data.user.name === 'string' && data.user.name ? data.user.name : email
          if (!email || !sub) {
            callbacks.onError('Respuesta incompleta del servidor de autenticación.')
            return
          }
          callbacks.onSuccess({
            sub,
            email,
            name,
            avatarUrl: typeof data.user.picture === 'string' ? data.user.picture : undefined,
            driveConnected: Boolean(data.driveConnected),
          })
        } catch {
          callbacks.onError('Sin conexión para validar el acceso con Google.')
        }
      },
    })
    codeClient.requestCode()
    return
  }

  runTokenFallback()
}
