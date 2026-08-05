import { app } from 'electron'
import { join } from 'path'
import { atomicWriteJSON, readJSONSafe } from './atomic-json'

export interface SyncWorkspaceConfig {
  workspaceFolder: string | null
}

function configFilePath(): string {
  return join(app.getPath('userData'), 'sync-workspace-config.json')
}

export function readWorkspaceConfig(): SyncWorkspaceConfig {
  return readJSONSafe<SyncWorkspaceConfig>(configFilePath(), { workspaceFolder: null })
}

export function writeWorkspaceConfig(patch: Partial<SyncWorkspaceConfig>): SyncWorkspaceConfig {
  const next = { ...readWorkspaceConfig(), ...patch }
  atomicWriteJSON(configFilePath(), next)
  return next
}
