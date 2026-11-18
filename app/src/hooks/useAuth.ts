import { useState, useCallback, useEffect } from 'react'
import {
  type AuthUser,
  AUTH_USER_KEY,
  SAVED_PIN_KEY,
  DEFAULT_PIN,
  validatePin,
  createPinUser,
  validateCredentials,
  createOfflineEmergencyUser,
  createGoogleUser,
} from '../domain/auth'

export { type AuthUser, DEFAULT_PIN }

const AUTH_CHANGE_EVENT = 'sindecon_auth_change'

function notifyAuthChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_CHANGE_EVENT))
  }
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem(AUTH_USER_KEY)
      if (saved) return JSON.parse(saved)
    } catch {
      // Ignorar error de deserialización
    }
    return null
  })

  const [savedPin, setSavedPin] = useState<string>(() => {
    return localStorage.getItem(SAVED_PIN_KEY) || DEFAULT_PIN
  })

  useEffect(() => {
    const handleAuthChange = () => {
      try {
        const saved = localStorage.getItem(AUTH_USER_KEY)
        setUser(saved ? JSON.parse(saved) : null)
      } catch {
        setUser(null)
      }
    }

    window.addEventListener(AUTH_CHANGE_EVENT, handleAuthChange)
    window.addEventListener('storage', handleAuthChange)
    return () => {
      window.removeEventListener(AUTH_CHANGE_EVENT, handleAuthChange)
      window.removeEventListener('storage', handleAuthChange)
    }
  }, [])

  const isAuthenticated = user !== null

  const loginWithPin = useCallback(
    (pin: string): { success: boolean; error?: string } => {
      const targetPin = localStorage.getItem(SAVED_PIN_KEY) || DEFAULT_PIN
      const check = validatePin(pin, targetPin)
      if (check.isValid) {
        const newUser = createPinUser()
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(newUser))
        setUser(newUser)
        notifyAuthChange()
        return { success: true }
      }
      return { success: false, error: check.error }
    },
    [],
  )

  const loginWithCredentials = useCallback(
    (email: string, password: string): { success: boolean; error?: string } => {
      const check = validateCredentials(email, password)
      if (check.isValid && check.user) {
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(check.user))
        setUser(check.user)
        notifyAuthChange()
        return { success: true }
      }
      return { success: false, error: check.error }
    },
    [],
  )

  const loginOffline = useCallback(() => {
    const newUser = createOfflineEmergencyUser()
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(newUser))
    setUser(newUser)
    notifyAuthChange()
  }, [])

  const loginWithGoogle = useCallback((googleEmail?: string) => {
    const newUser = createGoogleUser(googleEmail)
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(newUser))
    setUser(newUser)
    notifyAuthChange()
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_USER_KEY)
    setUser(null)
    notifyAuthChange()
  }, [])

  const changePin = useCallback((newPin: string) => {
    localStorage.setItem(SAVED_PIN_KEY, newPin)
    setSavedPin(newPin)
  }, [])

  return {
    user,
    isAuthenticated,
    savedPin,
    loginWithPin,
    loginWithCredentials,
    loginOffline,
    loginWithGoogle,
    logout,
    changePin,
  }
}
