import type { WorshipSyncPaths } from './paths'
import type { LockInfo } from './lock'

/** Runtime state for whichever data folder is currently active — set once by bootstrap(). */
export const storageState: {
  paths: WorshipSyncPaths | null
  deviceId: string | null
  deviceName: string | null
  lock: LockInfo | null
  stopHeartbeat: (() => void) | null
  migrationInProgress: boolean
} = {
  paths: null,
  deviceId: null,
  deviceName: null,
  lock: null,
  stopHeartbeat: null,
  migrationInProgress: false,
}
