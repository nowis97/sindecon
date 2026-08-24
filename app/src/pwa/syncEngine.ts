import { db } from '../db/db'
import { exportToZip, importFromZip } from '../db/exportImport'
import type { MergeReport } from '../domain/merge'
import {
  getAppDataFileByName,
  downloadAppDataFile,
  uploadAppDataFile,
  type SyncManifest,
} from './googleDrive'

const LAST_SYNC_KEY = 'cuaderno-last-sync-time'
const DEVICE_ID_KEY = 'cuaderno-device-id'

export type SyncState = 'idle' | 'checking' | 'syncing' | 'offline' | 'error'

export interface SyncEngineResult {
  action: 'uploaded' | 'downloaded' | 'merged' | 'up-to-date' | 'skipped'
  timestamp: number
  report?: MergeReport
  message?: string
}

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = `dev-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

export function getLastSyncTime(): number {
  const t = localStorage.getItem(LAST_SYNC_KEY)
  return t ? Number.parseInt(t, 10) : 0
}

export function setLastSyncTime(timestamp: number) {
  localStorage.setItem(LAST_SYNC_KEY, timestamp.toString())
}

/**
 * Obtiene el timestamp más reciente entre todos los nodos locales.
 */
export async function getLocalMaxTimestamp(): Promise<number> {
  const nodes = await db.nodes.toArray()
  let max = 0
  for (const n of nodes) {
    if (n.updated_at > max) max = n.updated_at
  }
  return max
}

/**
 * Ejecuta el ciclo de sincronización bidireccional contra Google Drive AppData.
 */
export async function performGoogleDriveSync(token: string): Promise<SyncEngineResult> {
  if (!navigator.onLine) {
    return {
      action: 'skipped',
      timestamp: getLastSyncTime(),
      message: 'Sin conexión a internet (Offline-First)',
    }
  }

  const deviceId = getDeviceId()
  const lastSync = getLastSyncTime()
  const localMax = await getLocalMaxTimestamp()
  const nodeCount = await db.nodes.count()

  // 1. Buscar archivos remotos en Google Drive
  const manifestFile = await getAppDataFileByName(token, 'sync-manifest.json')
  const backupZipFile = await getAppDataFileByName(token, 'cuaderno-backup.zip')

  // Caso A: No hay respaldo remoto previo en Google Drive -> Subida inicial
  if (!manifestFile || !backupZipFile) {
    const zipBlob = await exportToZip()
    const now = Math.max(Date.now(), localMax)

    const newZip = await uploadAppDataFile(
      token,
      'cuaderno-backup.zip',
      'application/zip',
      zipBlob,
      backupZipFile?.id,
    )

    const manifest: SyncManifest = {
      version: 1,
      timestamp: now,
      deviceId,
      nodeCount,
      updatedAtIso: new Date(now).toISOString(),
    }

    await uploadAppDataFile(
      token,
      'sync-manifest.json',
      'application/json',
      JSON.stringify(manifest, null, 2),
      manifestFile?.id,
    )

    void newZip
    setLastSyncTime(now)
    return { action: 'uploaded', timestamp: now, message: 'Respaldo inicial subido a Google Drive' }
  }

  // Caso B: Existe manifiesto remoto -> Descargar y comparar versión
  const manifestBlob = await downloadAppDataFile(token, manifestFile.id)
  const manifestText = await manifestBlob.text()
  let remoteManifest: SyncManifest

  try {
    remoteManifest = JSON.parse(manifestText) as SyncManifest
  } catch {
    throw new Error('Manifiesto de sincronización en Google Drive corrupto')
  }

  const remoteTime = remoteManifest.timestamp

  // Si la nube tiene cambios más recientes que nuestra última sincronización local
  if (remoteTime > lastSync) {
    const remoteZipBlob = await downloadAppDataFile(token, backupZipFile.id)
    const report = await importFromZip(remoteZipBlob)

    // Si además hicimos modificaciones locales concurrentes, generamos una nueva versión fusionada
    if (localMax > lastSync) {
      const mergedZip = await exportToZip()
      const now = Date.now()

      await uploadAppDataFile(
        token,
        'cuaderno-backup.zip',
        'application/zip',
        mergedZip,
        backupZipFile.id,
      )

      const updatedManifest: SyncManifest = {
        version: 1,
        timestamp: now,
        deviceId,
        nodeCount: await db.nodes.count(),
        updatedAtIso: new Date(now).toISOString(),
      }

      await uploadAppDataFile(
        token,
        'sync-manifest.json',
        'application/json',
        JSON.stringify(updatedManifest, null, 2),
        manifestFile.id,
      )

      setLastSyncTime(now)
      return {
        action: 'merged',
        timestamp: now,
        report,
        message: 'Cambios remotos y locales fusionados con éxito',
      }
    }

    setLastSyncTime(remoteTime)
    return {
      action: 'downloaded',
      timestamp: remoteTime,
      report,
      message: 'Cuaderno actualizado desde Google Drive',
    }
  }

  // Si lo local es más reciente que nuestra última sincronización y la nube
  if (localMax > lastSync) {
    const zipBlob = await exportToZip()
    const now = Math.max(Date.now(), localMax)

    await uploadAppDataFile(
      token,
      'cuaderno-backup.zip',
      'application/zip',
      zipBlob,
      backupZipFile.id,
    )

    const manifest: SyncManifest = {
      version: 1,
      timestamp: now,
      deviceId,
      nodeCount,
      updatedAtIso: new Date(now).toISOString(),
    }

    await uploadAppDataFile(
      token,
      'sync-manifest.json',
      'application/json',
      JSON.stringify(manifest, null, 2),
      manifestFile.id,
    )

    setLastSyncTime(now)
    return { action: 'uploaded', timestamp: now, message: 'Cambios locales respaldados en Google Drive' }
  }

  // Si ambos están al día
  return { action: 'up-to-date', timestamp: remoteTime, message: 'Al día con Google Drive' }
}
