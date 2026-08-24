import { useCallback, useEffect, useState } from 'react'
import {
  getStoredToken,
  getStoredEmail,
  setStoredToken,
  clearStoredToken,
  fetchGoogleUserEmail,
  getStoredClientId,
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

  const isConnected = Boolean(token)

  const triggerSync = useCallback(async () => {
    const currentToken = getStoredToken()
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
      setSyncState('error')
      setErrorMessage((e as Error).message)
    }
  }, [])

  const connectWithToken = useCallback(
    async (newToken: string, expiresInSeconds = 3600, email?: string) => {
      let finalEmail = email
      if (!finalEmail) {
        finalEmail = (await fetchGoogleUserEmail(newToken)) || undefined
      }
      setStoredToken(newToken, expiresInSeconds, finalEmail)
      setToken(newToken)
      setUserEmail(finalEmail ?? null)
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

  const disconnect = useCallback(() => {
    clearStoredToken()
    setToken(null)
    setUserEmail(null)
    setSyncState('idle')
    setErrorMessage(null)
  }, [])

  // Sincronización automática periódica y al recuperar foco/conexión
  useEffect(() => {
    if (!token) return

    // Sincronización al montar
    void triggerSync()

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        void triggerSync()
      }
    }

    const handleOnline = () => {
      void triggerSync()
    }

    window.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('online', handleOnline)

    // Intervalo de comprobación cada 5 minutos
    const interval = setInterval(() => {
      if (navigator.onLine && document.visibilityState === 'visible') {
        void triggerSync()
      }
    }, 5 * 60 * 1000)

    return () => {
      window.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('online', handleOnline)
      clearInterval(interval)
    }
  }, [token, triggerSync])

  const initiateOAuthLogin = useCallback(() => {
    // Verificar si GIS está disponible en window.google
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
