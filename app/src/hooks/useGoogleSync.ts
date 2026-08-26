import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getStoredToken,
  getStoredEmail,
  setStoredToken,
  clearStoredToken,
  fetchGoogleUserEmail,
  getStoredClientId,
  isGoogleSyncEnabled,
  isTokenExpired,
  requestSilentAccessToken,
} from '../pwa/googleDrive'
import {
  performGoogleDriveSync,
  getLastSyncTime,
  type SyncState,
} from '../pwa/syncEngine'

export function useGoogleSync() {
  const [token, setToken] = useState<string | null>(() => getStoredToken())
  const [userEmail, setUserEmail] = useState<string | null>(() => getStoredEmail())
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [lastSyncedTime, setLastSyncedTime] = useState<number>(() => getLastSyncTime())
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const isRefreshingRef = useRef(false)

  const isConnected = Boolean(token) || isGoogleSyncEnabled()

  const connectWithToken = useCallback(
    async (newToken: string, expiresInSeconds = 3600, email?: string) => {
      let finalEmail = email
      if (!finalEmail) {
        finalEmail = (await fetchGoogleUserEmail(newToken)) || undefined
      }
      setStoredToken(newToken, expiresInSeconds, finalEmail)
      setToken(newToken)
      if (finalEmail) {
        setUserEmail(finalEmail)
      }
      setSyncState('idle')
      setErrorMessage(null)

      // Ejecutar sincronización inicial inmediata
      try {
        setSyncState('syncing')
        const res = await performGoogleDriveSync(newToken)
        setLastSyncedTime(res.timestamp)
        setSyncState('idle')
      } catch (e) {
        setSyncState('error')
        setErrorMessage((e as Error).message)
      }
    },
    [],
  )

  const refreshSilentToken = useCallback((): Promise<string | null> => {
    if (!isGoogleSyncEnabled() || isRefreshingRef.current) return Promise.resolve(null)
    const clientId = getStoredClientId()
    if (!clientId) return Promise.resolve(null)

    isRefreshingRef.current = true

    return new Promise<string | null>((resolve) => {
      requestSilentAccessToken(
        clientId,
        async (newToken, expiresIn) => {
          isRefreshingRef.current = false
          await connectWithToken(newToken, expiresIn)
          resolve(newToken)
        },
        (err) => {
          isRefreshingRef.current = false
          // Si el refresco silencioso no pudo completarse (ej. cookies de terceros bloqueadas)
          if (err && !err.includes('no está listo')) {
            setErrorMessage(`Sesión de Google Drive expirada: ${err}`)
          }
          resolve(null)
        },
      )
    })
  }, [connectWithToken])

  const triggerSync = useCallback(async () => {
    let currentToken = getStoredToken()
    if (!currentToken && isGoogleSyncEnabled()) {
      // Intentar renovación silenciosa previa
      currentToken = await refreshSilentToken()
    }
    if (!currentToken) return

    if (!navigator.onLine) {
      setSyncState('offline')
      return
    }

    try {
      setSyncState('syncing')
      setErrorMessage(null)
      const res = await performGoogleDriveSync(currentToken)
      setLastSyncedTime(res.timestamp)
      setSyncState('idle')
    } catch (e) {
      const msg = (e as Error).message
      // Si el error fue por token caducado (401), intentar renovación silenciosa y reintentar
      if (msg.includes('expirada') || msg.includes('401')) {
        const refreshedToken = await refreshSilentToken()
        if (refreshedToken) {
          try {
            const retryRes = await performGoogleDriveSync(refreshedToken)
            setLastSyncedTime(retryRes.timestamp)
            setSyncState('idle')
            return
          } catch {
            // Reintento fallido
          }
        }
      }
      setSyncState('error')
      setErrorMessage(msg)
    }
  }, [refreshSilentToken])

  const disconnect = useCallback(() => {
    clearStoredToken(true) // Desconexión explícita
    setToken(null)
    setUserEmail(null)
    setSyncState('idle')
    setErrorMessage(null)
  }, [])

  // Auto-reconexión silenciosa al montar la aplicación
  useEffect(() => {
    if (isGoogleSyncEnabled() && (!token || isTokenExpired(5))) {
      let attempts = 0
      const maxAttempts = 10
      const checkGisInterval = setInterval(() => {
        attempts++
        const win = window as unknown as { google?: { accounts?: { oauth2?: unknown } } }
        if (win.google?.accounts?.oauth2) {
          clearInterval(checkGisInterval)
          void refreshSilentToken()
        } else if (attempts >= maxAttempts) {
          clearInterval(checkGisInterval)
        }
      }, 500)

      return () => clearInterval(checkGisInterval)
    }
  }, [token, refreshSilentToken])

  // Sincronización automática periódica, al recuperar foco y refresco proactivo
  useEffect(() => {
    if (!isConnected) return

    if (token) {
      void triggerSync()
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        if (isGoogleSyncEnabled() && (!getStoredToken() || isTokenExpired(5))) {
          void refreshSilentToken().then(() => void triggerSync())
        } else {
          void triggerSync()
        }
      }
    }

    const handleOnline = () => {
      if (isGoogleSyncEnabled() && (!getStoredToken() || isTokenExpired(5))) {
        void refreshSilentToken().then(() => void triggerSync())
      } else {
        void triggerSync()
      }
    }

    window.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('online', handleOnline)

    // Intervalo cada 5 minutos: sincronizar y renovar token si está próximo a expirar (15 min)
    const interval = setInterval(() => {
      if (navigator.onLine && document.visibilityState === 'visible') {
        if (isGoogleSyncEnabled() && isTokenExpired(15)) {
          void refreshSilentToken().then(() => void triggerSync())
        } else {
          void triggerSync()
        }
      }
    }, 5 * 60 * 1000)

    return () => {
      window.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('online', handleOnline)
      clearInterval(interval)
    }
  }, [isConnected, token, triggerSync, refreshSilentToken])

  const initiateOAuthLogin = useCallback(() => {
    const win = window as unknown as {
      google?: {
        accounts?: {
          oauth2?: {
            initTokenClient: (config: {
              client_id: string
              scope: string
              callback: (res: { access_token?: string; expires_in?: number; error?: string }) => void
            }) => { requestAccessToken: () => void }
          }
        }
      }
    }

    const clientId = getStoredClientId()

    if (win.google?.accounts?.oauth2) {
      const client = win.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.appdata',
        callback: (response) => {
          if (response.access_token) {
            void connectWithToken(response.access_token, response.expires_in || 3600)
          } else if (response.error) {
            setErrorMessage(`Error de Google: ${response.error}`)
          }
        },
      })
      client.requestAccessToken()
    } else {
      setErrorMessage('Google Identity Services no está disponible en este navegador')
    }
  }, [connectWithToken])

  return {
    isConnected,
    syncState,
    lastSyncedAt: lastSyncedTime ? new Date(lastSyncedTime) : null,
    errorMessage,
    userEmail,
    connectWithToken,
    disconnect,
    triggerSync,
    initiateOAuthLogin,
  }
}
