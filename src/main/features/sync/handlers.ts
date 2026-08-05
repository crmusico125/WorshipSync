import { dialog, ipcMain, shell } from 'electron'
import { join } from 'path'
import { db } from '../../db/index'
import { serviceDates } from '../../db/schema'
import { buildPackage, previewPublish } from './package-builder'
import { importPackage } from './package-importer'
import { verifyPackage } from './package-verifier'
import { deletePackageFiles, getWorkspaceHistory, getWorkspaceStats, listAvailablePackages } from './workspace-scan'
import { readWorkspaceConfig, writeWorkspaceConfig } from './workspace-config'
import { getSyncWorkspacePaths } from './paths'
import type { AvailablePackage, ImportResult, PublishPreview, SyncHistoryEntry, VerifyResult } from './types'

export interface SyncStatus {
  workspaceFolder: string | null
  packageCount: number
  diskUsageBytes: number
  lastPublishAt: string | null
  lastImportAt: string | null
}

function requireWorkspace(): string {
  const { workspaceFolder } = readWorkspaceConfig()
  if (!workspaceFolder) throw new Error('No Sync Workspace folder is set — choose one in Settings first.')
  return workspaceFolder
}

export function registerSyncHandlers(): void {
  ipcMain.handle('sync:getStatus', (): SyncStatus => {
    const { workspaceFolder } = readWorkspaceConfig()
    if (!workspaceFolder) {
      return { workspaceFolder: null, packageCount: 0, diskUsageBytes: 0, lastPublishAt: null, lastImportAt: null }
    }
    const stats = getWorkspaceStats(workspaceFolder)
    const history = getWorkspaceHistory(workspaceFolder)
    return {
      workspaceFolder,
      ...stats,
      lastPublishAt: history.find(h => h.type === 'publish')?.at ?? null,
      lastImportAt: history.find(h => h.type === 'import')?.at ?? null,
    }
  })

  ipcMain.handle('sync:chooseWorkspaceFolder', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Choose a Sync Workspace folder',
      properties: ['openDirectory', 'createDirectory'],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    writeWorkspaceConfig({ workspaceFolder: result.filePaths[0] })
    return result.filePaths[0]
  })

  ipcMain.handle('sync:openWorkspaceFolder', async (): Promise<void> => {
    await shell.openPath(requireWorkspace())
  })

  ipcMain.handle('sync:listPublishableServices', () => {
    return db.select().from(serviceDates).orderBy(serviceDates.date).all()
  })

  ipcMain.handle('sync:previewPublish', (_e, serviceDateId: unknown): PublishPreview => {
    if (typeof serviceDateId !== 'number') throw new Error('Invalid service.')
    return previewPublish(serviceDateId, requireWorkspace())
  })

  ipcMain.handle('sync:publishService', async (_e, serviceDateId: unknown) => {
    if (typeof serviceDateId !== 'number') return { ok: false, error: 'Invalid service.' }
    try {
      return await buildPackage(serviceDateId, requireWorkspace())
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle('sync:checkWorkspace', (): AvailablePackage[] => {
    const { workspaceFolder } = readWorkspaceConfig()
    if (!workspaceFolder) return []
    return listAvailablePackages(workspaceFolder)
  })

  ipcMain.handle('sync:verifyPackage', (_e, filename: unknown): VerifyResult => {
    if (typeof filename !== 'string') return { ok: false, reason: 'invalid', detail: 'No package specified.' }
    const paths = getSyncWorkspacePaths(requireWorkspace())
    return verifyPackage(join(paths.packages, filename))
  })

  ipcMain.handle('sync:importPackage', async (_e, filename: unknown): Promise<ImportResult> => {
    if (typeof filename !== 'string') return { ok: false, error: 'No package specified.' }
    const workspaceFolder = requireWorkspace()
    const paths = getSyncWorkspacePaths(workspaceFolder)
    return importPackage(join(paths.packages, filename), workspaceFolder)
  })

  ipcMain.handle('sync:deletePackage', (_e, filename: unknown) => {
    if (typeof filename !== 'string') return { ok: false, error: 'No package specified.' }
    try {
      deletePackageFiles(requireWorkspace(), filename)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle('sync:getHistory', (): SyncHistoryEntry[] => {
    const { workspaceFolder } = readWorkspaceConfig()
    if (!workspaceFolder) return []
    return getWorkspaceHistory(workspaceFolder)
  })
}
