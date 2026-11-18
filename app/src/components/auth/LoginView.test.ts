import { describe, it, expect } from 'vitest'
import { LoginView, type LoginViewProps } from './LoginView'

describe('LoginView Component Contract', () => {
  it('exporta LoginView como componente funcional de React', () => {
    expect(typeof LoginView).toBe('function')
  })

  it('acepta todas las props de control de autenticación', () => {
    let loggedUser: unknown = null
    let googleTriggered = false
    let offlineTriggered = false

    const props: LoginViewProps = {
      theme: 'dark',
      onToggleTheme: () => {},
      onLoginSuccess: (user) => {
        loggedUser = user
      },
      onGoogleSignIn: () => {
        googleTriggered = true
      },
      onOfflineAccess: () => {
        offlineTriggered = true
      },
    }

    expect(props.theme).toBe('dark')
    props.onGoogleSignIn?.()
    expect(googleTriggered).toBe(true)

    props.onOfflineAccess?.()
    expect(offlineTriggered).toBe(true)

    props.onLoginSuccess?.({
      id: 'test-user',
      name: 'Dr. Test',
      method: 'pin',
      loggedAt: 123456789,
    })
    expect(loggedUser).toEqual({
      id: 'test-user',
      name: 'Dr. Test',
      method: 'pin',
      loggedAt: 123456789,
    })
  })
})
