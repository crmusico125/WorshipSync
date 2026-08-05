import { app } from 'electron'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { hostname } from 'os'
import { atomicWriteJSON, readJSONSafe } from './atomic-fs'
import { getDefaultDataRoot } from './paths'

/**
 * Which data folder is active, plus a stable per-device identity. Lives in
 * Electron's userData dir — deliberately OUTSIDE any synced folder, so the
 * app always knows where to look and who "this device" is even before the
 * data folder itself is reachable (e.g. an unmounted network share).
 */
export interface DataFolderSettings {
  deviceId: string
  deviceName: string
  activeDataFolder: string
  previousDataFolder?: string
}

const configPath = (): string => join(app.getPath('userData'), 'storage-config.json')

export function readStorageConfig(): DataFolderSettings {
  const existing = readJSONSafe<Partial<DataFolderSettings>>(configPath(), {})
  const needsDefaults = !existing.deviceId || !existing.activeDataFolder
  const config: DataFolderSettings = {
    deviceId: existing.deviceId ?? randomUUID(),
    deviceName: existing.deviceName ?? safeHostname(),
    activeDataFolder: existing.activeDataFolder ?? getDefaultDataRoot(),
    previousDataFolder: existing.previousDataFolder,
  }
  if (needsDefaults) atomicWriteJSON(configPath(), config)
  return config
}

export function writeStorageConfig(patch: Partial<DataFolderSettings>): DataFolderSettings {
  const updated = { ...readStorageConfig(), ...patch }
  atomicWriteJSON(configPath(), updated)
  return updated
}

function safeHostname(): string {
  try {
    return hostname()
  } catch {
    return 'This device'
  }
}
