import { useEffect, useState, useCallback, useRef } from 'react'

export interface PWAUpdateState {
  needRefresh: boolean
  offlineReady: boolean
  updateApp: () => void
  closeToast: () => void
  lastChecked: number | null
}

const CHECK_INTERVAL_MS = 3 * 60 * 1000 // 3 minutos

export function usePWAUpdate(): PWAUpdateState {
  const [needRefresh, setNeedRefresh] = useState(false)
  const [offlineReady, setOfflineReady] = useState(false)
  const [lastChecked, setLastChecked] = useState<number | null>(null)
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)

  const updateApp = useCallback(() => {
    if (registrationRef.current?.waiting) {
      registrationRef.current.waiting.postMessage({ type: 'SKIP_WAITING' })
    }
    // Recargar la ventana para montar el bundle fresco
    window.location.reload()
  }, [])

  const closeToast = useCallback(() => {
    setNeedRefresh(false)
  }, [])

  const checkForUpdate = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return
    try {
      setLastChecked(Date.now())
      const registration =
        registrationRef.current || (await navigator.serviceWorker.getRegistration())
      if (registration) {
        registrationRef.current = registration
        await registration.update()
      }
    } catch {
      // Ignorar errores de red o modo offline al comprobar actualización
    }
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let isMounted = true

    // Obtener y escuchar registro del Service Worker
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg || !isMounted) return
      registrationRef.current = reg

      // Si ya hay un worker esperando al abrir
      if (reg.waiting) {
        setNeedRefresh(true)
      }

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        if (!newWorker) return

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // Nueva versión disponible instalada en segundo plano
              if (isMounted) setNeedRefresh(true)
            } else {
              // Contenido en caché para uso offline inicial
              if (isMounted) setOfflineReady(true)
            }
          }
        })
      })
    })

    // Escuchar cambio de controlador
    const handleControllerChange = () => {
      if (isMounted) {
        setNeedRefresh(true)
      }
    }
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)

    // 1. Sondeo periódico cada 3 minutos
    const intervalId = setInterval(() => {
      void checkForUpdate()
    }, CHECK_INTERVAL_MS)

    // 2. Comprobar cuando la pestaña vuelve a ser visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkForUpdate()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // 3. Comprobar cuando la ventana recupera el foco
    const handleFocus = () => {
      void checkForUpdate()
    }
    window.addEventListener('focus', handleFocus)

    // 4. Comprobar al recuperar conexión
    const handleOnline = () => {
      void checkForUpdate()
    }
    window.addEventListener('online', handleOnline)

    // Comprobación inicial al montar
    void checkForUpdate()

    return () => {
      isMounted = false
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('online', handleOnline)
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
    }
  }, [checkForUpdate])

  return {
    needRefresh,
    offlineReady,
    updateApp,
    closeToast,
    lastChecked,
  }
}
