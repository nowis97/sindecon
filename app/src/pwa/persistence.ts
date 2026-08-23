import { db } from '../db/db'

const KEY = 'storage_persist'

/**
 * Solicita almacenamiento persistente al primer arranque (spec offline-shell).
 * El resultado queda registrado en meta para que la UI muestre el aviso.
 */
export async function ensurePersistentStorage(): Promise<boolean> {
  let granted = false
  try {
    granted = (await navigator.storage?.persist?.()) ?? false
  } catch {
    granted = false
  }
  await db.meta.put({ key: KEY, value: granted })
  return granted
}
