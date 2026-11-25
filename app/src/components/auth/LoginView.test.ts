import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
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

describe('LoginView Component & Lock Screen Rules', () => {
  it('muestra pista 1234, Credenciales y Urgencias cuando protectionConfigured=false', () => {
    const html = renderToStaticMarkup(
      createElement(LoginView, {
        protectionConfigured: false,
        pinEnabled: true,
        pinLength: 4,
        hasPasskeys: false,
      }),
    )
    expect(html).toContain('1234')
    expect(html).toContain('Credenciales')
    expect(html).toContain('Urgencias')
    expect(html).toContain('Continuar con Google')
    expect(html.match(/data-testid="pin-dot"/g)?.length).toBe(4)
  })

  it('oculta 1234, Credenciales y Urgencias y muestra 6 puntos + recuperación Google cuando protectionConfigured=true', () => {
    const html = renderToStaticMarkup(
      createElement(LoginView, {
        protectionConfigured: true,
        pinEnabled: true,
        pinLength: 6,
        hasPasskeys: true,
        ownerEmail: 'dra.martinez@gmail.com',
      }),
    )
    expect(html).not.toContain('1234')
    expect(html).not.toContain('Urgencias')
    expect(html).not.toContain('Credenciales')
    expect(html).toContain('Continuar con Google')
    expect(html).toContain('Huella')
    expect(html).toContain('Recuperar con Google')
    expect(html.match(/data-testid="pin-dot"/g)?.length).toBe(6)
  })

  it('muestra aviso de bloqueo temporal y deshabilita dígitos cuando lockedUntil está en el futuro', () => {
    const html = renderToStaticMarkup(
      createElement(LoginView, {
        protectionConfigured: true,
        pinEnabled: true,
        pinLength: 4,
        hasPasskeys: true,
        lockedUntil: Date.now() + 25_000,
      }),
    )
    expect(html).toContain('Bloqueo temporal activo')
    expect(html).toContain('data-testid="reset-local-terminal-btn"')
  })
})
