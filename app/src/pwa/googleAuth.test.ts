import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  GOOGLE_IDENTITY_SCOPES,
  initiateGoogleLoginFlow,
  checkServerAuthSession,
  logoutServerAuthSession,
} from './googleAuth'

describe('googleAuth (openid email profile + fallback dev)', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('usa initCodeClient con openid email profile y canjea code en /api/auth/google', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          user: {
            sub: 'sub-1',
            email: 'dra.martinez@gmail.com',
            name: 'Dra. Martínez',
            picture: 'https://avatar.test/1.png',
          },
          driveConnected: false,
        }),
        { status: 200 },
      ),
    )

    let capturedScope = ''
    vi.stubGlobal('google', {
      accounts: {
        oauth2: {
          initCodeClient: (cfg: { scope: string; callback: (r: { code?: string }) => void }) => {
            capturedScope = cfg.scope
            return { requestCode: () => void cfg.callback({ code: 'auth-code-99' }) }
          },
        },
      },
    })

    const onSuccess = vi.fn()
    const onError = vi.fn()
    initiateGoogleLoginFlow({
      clientId: 'client-123.apps.googleusercontent.com',
      fetchFn: fetchMock,
      onSuccess,
      onError,
    })

    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
    expect(capturedScope).toBe(GOOGLE_IDENTITY_SCOPES)
    expect(onError).not.toHaveBeenCalled()
    expect(onSuccess.mock.calls[0]?.[0]).toMatchObject({
      email: 'dra.martinez@gmail.com',
      driveConnected: false,
    })
  })

  it('degrada a initTokenClient en 404 (vite dev sin Worker) y consulta userinfo', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('Not found', { status: 404 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            sub: 'sub-dev',
            email: 'dev@hospital.cl',
            name: 'Dev User',
          }),
          { status: 200 },
        ),
      )

    vi.stubGlobal('google', {
      accounts: {
        oauth2: {
          initCodeClient: (cfg: { callback: (r: { code?: string }) => void }) => ({
            requestCode: () => void cfg.callback({ code: 'dev-code' }),
          }),
          initTokenClient: (cfg: { callback: (r: { access_token?: string }) => void }) => ({
            requestAccessToken: () => void cfg.callback({ access_token: 'tok-dev' }),
          }),
        },
      },
    })

    const onSuccess = vi.fn()
    const onError = vi.fn()
    initiateGoogleLoginFlow({
      clientId: 'client-123.apps.googleusercontent.com',
      fetchFn: fetchMock,
      onSuccess,
      onError,
    })

    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
    expect(onSuccess.mock.calls[0]?.[0]).toMatchObject({ email: 'dev@hospital.cl' })
    expect(onError).not.toHaveBeenCalled()
  })

  it('consulta /api/auth/session y cierra sesión en /api/auth/logout', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            authenticated: true,
            user: { sub: 's1', email: 'doc@cl.org', name: 'Dr. S' },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))

    const session = await checkServerAuthSession(fetchMock)
    expect(session?.email).toBe('doc@cl.org')
    await logoutServerAuthSession(fetchMock)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('reporta error claro si falta clientId y no falla en entorno Node sin localStorage', () => {
    const onSuccess = vi.fn()
    const onError = vi.fn()
    initiateGoogleLoginFlow({
      fetchFn: fetchMock,
      onSuccess,
      onError,
    })
    expect(onSuccess).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledWith(
      'Falta configurar el Google Client ID en el entorno de la aplicación.',
    )
  })

  it('maneja JSON malformado o no-objeto en /api/auth/session y /api/auth/google sin lanzar TypeError', async () => {
    fetchMock.mockResolvedValueOnce(new Response('null', { status: 200 }))
    const session = await checkServerAuthSession(fetchMock)
    expect(session).toBeNull()

    fetchMock.mockResolvedValueOnce(new Response('null', { status: 200 }))
    vi.stubGlobal('google', {
      accounts: {
        oauth2: {
          initCodeClient: (cfg: { callback: (r: { code?: string }) => void }) => ({
            requestCode: () => void cfg.callback({ code: 'code-null' }),
          }),
        },
      },
    })
    const onSuccess = vi.fn()
    const onError = vi.fn()
    initiateGoogleLoginFlow({
      clientId: 'client-123.apps.googleusercontent.com',
      fetchFn: fetchMock,
      onSuccess,
      onError,
    })
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1))
    expect(onSuccess).not.toHaveBeenCalled()
  })
})
