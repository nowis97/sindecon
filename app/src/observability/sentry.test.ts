import { describe, it, expect, vi } from 'vitest'
import { sanitizeMedicalErrorEvent } from './sentry'
import type * as Sentry from '@sentry/react'

describe('Sentry Medical Privacy Sanitizer', () => {
  it('elimina datos de peticiones, cookies y cabeceras de autorización', () => {
    const rawEvent = {
      event_id: '12345',
      timestamp: Date.now(),
      request: {
        url: 'https://sindecon.app/api/data',
        data: 'diagnostico: paciente con fibrilacion auricular',
        cookies: { session: 'secret-cookie-123' },
        headers: {
          Authorization: 'Bearer secret-oauth-token',
          'Content-Type': 'application/json',
        },
      },
    } as unknown as Sentry.ErrorEvent

    const sanitized = sanitizeMedicalErrorEvent(rawEvent)
    expect(sanitized).not.toBeNull()
    expect(sanitized?.request?.data).toBeUndefined()
    expect(sanitized?.request?.cookies).toBeUndefined()
    expect(sanitized?.request?.headers?.Authorization).toBeUndefined()
    expect(sanitized?.request?.headers?.['Content-Type']).toBe('application/json')
  })

  it('sanitiza breadcrumbs de interfaz para evitar filtrar texto clínico', () => {
    const rawEvent = {
      event_id: '67890',
      breadcrumbs: [
        {
          category: 'ui.input',
          message: 'input[name="article"] value="Paciente hipertenso 160/100"',
          data: { sensitive: 'text' },
        },
        {
          category: 'navigation',
          message: 'to /cardiologia',
        },
      ],
    } as unknown as Sentry.ErrorEvent

    const sanitized = sanitizeMedicalErrorEvent(rawEvent)
    expect(sanitized?.breadcrumbs?.[0].message).toBe('input[name="article"] value="[PROTECTED]"')
    expect(sanitized?.breadcrumbs?.[0].data).toBeUndefined()
    expect(sanitized?.breadcrumbs?.[1].message).toBe('to /cardiologia')
  })

  it('anonimiza los datos de usuario', () => {
    const rawEvent = {
      event_id: 'user-test',
      user: {
        id: '1234',
        email: 'medico@hospital.cl',
        username: 'Dr. Perez',
      },
    } as unknown as Sentry.ErrorEvent

    const sanitized = sanitizeMedicalErrorEvent(rawEvent)
    expect(sanitized?.user).toEqual({ id: 'anonymous-client' })
  })

  it('descarta errores comunes de fetch cuando no hay conexión a internet (offline)', () => {
    // Simular offline
    vi.stubGlobal('navigator', { onLine: false })

    const rawEvent = {
      event_id: 'offline-error',
      exception: {
        values: [
          {
            type: 'TypeError',
            value: 'Failed to fetch',
          },
        ],
      },
    } as unknown as Sentry.ErrorEvent

    const sanitized = sanitizeMedicalErrorEvent(rawEvent)
    expect(sanitized).toBeNull()

    vi.unstubAllGlobals()
  })
})
