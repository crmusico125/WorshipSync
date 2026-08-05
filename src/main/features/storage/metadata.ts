import { existsSync } from 'fs'
import { atomicWriteJSON, readJSONSafe } from './atomic-fs'
import type { WorshipSyncPaths } from './paths'

export interface DataFolderMetadata {
  schemaVersion: number
  lastOpenedByDeviceId: string | null
  lastOpenedByDeviceName: string | null
  lastOpenedAt: string | null
  lastClosedAt: string | null
  lastCleanShutdown: boolean
  appVersion: string | null
}

const CURRENT_SCHEMA_VERSION = 1

function defaults(): DataFolderMetadata {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    lastOpenedByDeviceId: null,
    lastOpenedByDeviceName: null,
    lastOpenedAt: null,
    lastClosedAt: null,
    lastCleanShutdown: true,
    appVersion: null,
  }
}

export function readMetadata(paths: WorshipSyncPaths): DataFolderMetadata {
  return readJSONSafe<DataFolderMetadata>(paths.metadata, defaults())
}

export function metadataExists(paths: WorshipSyncPaths): boolean {
  return existsSync(paths.metadata)
}

export function writeMetadata(paths: WorshipSyncPaths, patch: Partial<DataFolderMetadata>): DataFolderMetadata {
  const updated = { ...readMetadata(paths), ...patch }
  atomicWriteJSON(paths.metadata, updated)
  return updated
}

/** Called right after successfully opening a folder for writing — marks the session as "not yet cleanly closed." */
export function markOpened(paths: WorshipSyncPaths, deviceId: string, deviceName: string, appVersion: string): DataFolderMetadata {
  return writeMetadata(paths, {
    lastOpenedByDeviceId: deviceId,
    lastOpenedByDeviceName: deviceName,
    lastOpenedAt: new Date().toISOString(),
    lastCleanShutdown: false,
    appVersion,
  })
}

/** Called at the end of a successful clean-shutdown sequence. */
export function markClosedCleanly(paths: WorshipSyncPaths): DataFolderMetadata {
  return writeMetadata(paths, {
    lastClosedAt: new Date().toISOString(),
    lastCleanShutdown: true,
  })
}
