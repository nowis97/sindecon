import { describe, it, expect } from 'vitest'
import { getSyncStatusDetails } from '../../pwa/syncEngine'

describe('getSyncStatusDetails', () => {
  it('muestra estado desconectado cuando Google Drive no está conectado aunque haya cambios locales', () => {
    const res = getSyncStatusDetails({
      isConnected: false,
      isSessionExpired: false,
      syncState: 'idle',
      hasPendingChanges: true,
      lastSyncedAt: null,
    })
    expect(res.status).toBe('disconnected')
    expect(res.label).toBe('Drive')
  })

  it('muestra progreso cuando está sincronizando activamente', () => {
    const res = getSyncStatusDetails({
      isConnected: true,
      isSessionExpired: false,
      syncState: 'syncing',
      syncProgress: { phase: 'transferring', percent: 62, message: 'Subiendo…' },
      hasPendingChanges: true,
      lastSyncedAt: null,
    })
    expect(res.status).toBe('syncing')
    expect(res.label).toBe('Sync 62%')
  })

  it('muestra estado pending cuando está en idle y hay cambios sin sincronizar', () => {
    const res = getSyncStatusDetails({
      isConnected: true,
      isSessionExpired: false,
      syncState: 'idle',
      hasPendingChanges: true,
      lastSyncedAt: new Date('2026-11-21T18:00:00Z'),
    })
    expect(res.status).toBe('pending')
    expect(res.label).toBe('Pendiente')
    expect(res.title).toContain('pendientes')
  })

  it('muestra aviso de cambios pendientes cuando está offline o con sesión expirada', () => {
    const offlinePending = getSyncStatusDetails({
      isConnected: true,
      isSessionExpired: false,
      syncState: 'offline',
      hasPendingChanges: true,
      lastSyncedAt: null,
    })
    expect(offlinePending.status).toBe('pending')
    expect(offlinePending.label).toBe('Pendiente')
    expect(offlinePending.title).toContain('Offline')

    const pausedPending = getSyncStatusDetails({
      isConnected: true,
      isSessionExpired: true,
      syncState: 'idle',
      hasPendingChanges: true,
      lastSyncedAt: null,
    })
    expect(pausedPending.status).toBe('paused')
    expect(pausedPending.label).toBe('Pendiente')
    expect(pausedPending.title).toContain('sin respaldar')
  })

  it('mantiene synced normal cuando no hay cambios pendientes', () => {
    const res = getSyncStatusDetails({
      isConnected: true,
      isSessionExpired: false,
      syncState: 'idle',
      hasPendingChanges: false,
      lastSyncedAt: null,
    })
    expect(res.status).toBe('synced')
    expect(res.label).toBe('Al día')
  })
})
