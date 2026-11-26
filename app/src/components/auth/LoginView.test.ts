import { describe, it, expect, afterEach, vi } from 'vitest'
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
  it('muestra configuración inicial obligatoria sin 1234, Credenciales ni Urgencias cuando protectionConfigured=false', () => {
    const html = renderToStaticMarkup(
      createElement(LoginView, {
        protectionConfigured: false,
        pinEnabled: true,
        pinLength: 4,
        hasPasskeys: false,
      }),
    )
    expect(html).toContain('Configura tu acceso inicial')
    expect(html).toContain('Protege tu estación clínica')
    expect(html).toContain('data-testid="setup-pin-input"')
    expect(html).toContain('data-testid="setup-pin-confirm-input"')
    expect(html).toContain('data-testid="setup-pin-submit-btn"')
    expect(html).toContain('data-testid="setup-fido-btn"')
    expect(html).toContain('data-testid="google-login-btn"')
    expect(html).not.toContain('1234')
    expect(html).not.toContain('Credenciales')
    expect(html).not.toContain('Urgencias')
    expect(html).not.toContain('data-testid="pin-dot"')
  })

  it('muestra pantalla de bloqueo con 6 puntos, FIDO y recuperación Google cuando protectionConfigured=true', () => {
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
    expect(html).not.toContain('setup-pin-input')
    expect(html).toContain('Continuar con Google')
    expect(html).toContain('Huella')
    expect(html).toContain('Recuperar con Google')
    expect(html.match(/data-testid="pin-dot"/g)?.length).toBe(6)
  })

  it('muestra tarjeta informativa Google-only cuando protectionConfigured=true sin PIN ni Passkey', () => {
    const html = renderToStaticMarkup(
      createElement(LoginView, {
        protectionConfigured: true,
        pinEnabled: false,
        pinLength: 4,
        hasPasskeys: false,
        ownerEmail: 'dra.martinez@gmail.com',
      }),
    )
    expect(html).toContain('dra.martinez@gmail.com')
    expect(html).toContain('data-testid="google-login-btn"')
    expect(html).not.toContain('data-testid="pin-dot"')
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

  describe('FIDO button testids y tooltip en LoginView', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('muestra title descriptivo en icono FIDO deshabilitado cuando protectionConfigured=true y hasPasskeys=false', () => {
      const html = renderToStaticMarkup(
        createElement(LoginView, {
          protectionConfigured: true,
          pinEnabled: true,
          pinLength: 4,
          hasPasskeys: false,
        }),
      )
      expect(html).toContain('title="Registra una passkey en Seguridad para activar biometría"')
    })

    it('asigna data-testid="fido-unlock-btn" único al botón standalone cuando pinEnabled=false y evita duplicados cuando pinEnabled=true', () => {
      vi.stubGlobal('navigator', { credentials: { create: vi.fn(), get: vi.fn() } })
      vi.stubGlobal('PublicKeyCredential', function PublicKeyCredential() {})

      const fidoOnlyHtml = renderToStaticMarkup(
        createElement(LoginView, {
          protectionConfigured: true,
          pinEnabled: false,
          pinLength: 4,
          hasPasskeys: true,
        }),
      )
      expect(fidoOnlyHtml.match(/data-testid="fido-unlock-btn"/g)?.length).toBe(1)

      const bothHtml = renderToStaticMarkup(
        createElement(LoginView, {
          protectionConfigured: true,
          pinEnabled: true,
          pinLength: 4,
          hasPasskeys: true,
        }),
      )
      expect(bothHtml.match(/data-testid="fido-unlock-btn"/g)?.length).toBe(1)
    })

    it('muestra descripción pública y enlace a /privacy.html tanto en onboarding como en bloqueo', () => {
      const onboardingHtml = renderToStaticMarkup(
        createElement(LoginView, {
          protectionConfigured: false,
          pinEnabled: true,
          pinLength: 4,
          hasPasskeys: false,
        }),
      )
      expect(onboardingHtml).toContain('data-testid="login-privacy-link"')
      expect(onboardingHtml).toContain('href="/privacy.html"')
      expect(onboardingHtml).toContain('Google Calendar')

      const lockedHtml = renderToStaticMarkup(
        createElement(LoginView, {
          protectionConfigured: true,
          pinEnabled: true,
          pinLength: 4,
          hasPasskeys: false,
        }),
      )
      expect(lockedHtml).toContain('data-testid="login-privacy-link"')
      expect(lockedHtml).toContain('href="/privacy.html"')
    })
  })
})
