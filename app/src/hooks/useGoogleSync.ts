import { useCallback, useEffect, useState } from 'react'
import {
  getStoredToken,
  getStoredEmail,
  setStoredToken,
  clearStoredToken,
  fetchGoogleUserEmail,
  getStoredClientId,
  isGoogleSyncEnabled,
  isTokenExpired,
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

  const isConnected = Boolean(token) || isGoogleSyncEnabled()
  const isSessionExpired = isGoogleSyncEnabled() && (!token || isTokenExpired(0))

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

  const triggerSync = useCallback(async () => {
    const currentToken = getStoredToken()
    // Si no hay token o expiró, NO abrir popups automáticos.
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
      // Si el token caducó (401), invalidar token localmente sin borrar configuración ni abrir ventanas invasivas
      if (msg.includes('expirada') || msg.includes('401')) {
        clearStoredToken(false)
        setToken(null)
        setSyncState('idle')
        setErrorMessage(null)
        return
      }
      setSyncState('error')
      setErrorMessage(msg)
    }
  }, [])

  const disconnect = useCallback(() => {
    clearStoredToken(true) // Desconexión explícita
    setToken(null)
    setUserEmail(null)
    setSyncState('idle')
    setErrorMessage(null)
  }, [])

  // Sincronización automática silenciosa al montar (SOLO si hay token válido y no expirado)
  useEffect(() => {
    const activeToken = getStoredToken()
    if (activeToken && !isTokenExpired(2) && navigator.onLine) {
      void triggerSync()
    }
  }, [triggerSync])

  // Sincronización automática periódica y al recuperar foco (SOLO con token activo, NUNCA abre popups)
  useEffect(() => {
    if (!isConnected) return

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        const activeToken = getStoredToken()
        if (activeToken && !isTokenExpired(2)) {
          void triggerSync()
        }
      }
    }

    const handleOnline = () => {
      const activeToken = getStoredToken()
      if (activeToken && !isTokenExpired(2)) {
        void triggerSync()
      }
    }

    window.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('online', handleOnline)

    // Intervalo cada 5 minutos: sincronizar silenciosamente en segundo plano si el token sigue vigente
    const interval = setInterval(() => {
      if (navigator.onLine && document.visibilityState === 'visible') {
        const activeToken = getStoredToken()
        if (activeToken && !isTokenExpired(2)) {
          void triggerSync()
        }
      }
    }, 5 * 60 * 1000)

    return () => {
      window.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('online', handleOnline)
      clearInterval(interval)
    }
  }, [isConnected, triggerSync])

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
    if (!clientId) {
      setErrorMessage('No hay Client ID de Google configurado')
      return
    }

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
      // Ejecución directa bajo gesto de usuario (click)
      client.requestAccessToken()
    } else {
      setErrorMessage('Google Identity Services no está disponible en este navegador')
    }
  }, [connectWithToken])

  return {
    isConnected,
    isSessionExpired,
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
