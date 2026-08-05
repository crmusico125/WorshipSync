import { dialog, ipcMain, shell } from 'electron'
import { existsSync, statSync } from 'fs'
import { createBackup, listBackups, restoreBackupFiles } from './backup'
import { closeDatabase, initDatabase } from '../../db'
import { runMigrations } from '../../db/migrate'
import { dirSizeBytes } from './fs-utils'
import { inspectLock } from './lock'
import { consolidateReference, findUnmanagedMedia, type UnmanagedReference } from './media-assets'
import { moveData, type MigrationResult } from './migration'
import { getDefaultDataRoot, type WorshipSyncPaths } from './paths'
import { storageState } from './state'

export interface StorageStatus {
  root: string
  isDefaultLocation: boolean
  databaseSizeBytes: number
  imagesSizeBytes: number
  audioSizeBytes: number
  videosSizeBytes: number
  lastBackupAt: string | null
  deviceName: string | null
  lockState: 'held-by-us' | 'none'
  migrationInProgress: boolean
}

function currentPaths(): WorshipSyncPaths {
  if (!storageState.paths) throw new Error('Storage is not initialized yet')
  return storageState.paths
}

function requireNotMigrating(): void {
  if (storageState.migrationInProgress) {
    throw new Error('A data folder move is already in progress — please wait for it to finish.')
  }
}

export function registerStorageHandlers(): void {
  ipcMain.handle('storage:getStatus', (): StorageStatus => {
    const paths = currentPaths()
    const backups = listBackups(paths)
    return {
      root: paths.root,
      isDefaultLocation: paths.root === getDefaultDataRoot(),
      databaseSizeBytes: existsSync(paths.database) ? statSync(paths.database).size : 0,
      imagesSizeBytes: dirSizeBytes(paths.images),
      audioSizeBytes: dirSizeBytes(paths.audio),
      videosSizeBytes: dirSizeBytes(paths.videos),
      lastBackupAt: backups[0]?.manifest?.createdAt ?? null,
      deviceName: storageState.deviceName,
      lockState: storageState.lock ? 'held-by-us' : 'none',
      migrationInProgress: storageState.migrationInProgress,
    }
  })

  ipcMain.handle('storage:chooseFolder', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Choose a WorshipSync data folder',
      properties: ['openDirectory', 'createDirectory'],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('storage:openFolder', async (): Promise<void> => {
    await shell.openPath(currentPaths().root)
  })

  ipcMain.handle('storage:createBackup', async (_e, options: unknown) => {
    const includeMedia = isRecord(options) && Boolean(options.includeMedia)
    return createBackup(currentPaths(), { includeMedia, trigger: 'manual' })
  })

  ipcMain.handle('storage:listBackups', () => {
    return listBackups(currentPaths()).map(b => ({ dir: b.dir, manifest: b.manifest }))
  })

  ipcMain.handle('storage:restoreBackup', async (_e, backupDir: unknown) => {
    if (typeof backupDir !== 'string' || !backupDir.trim()) {
      return { ok: false, error: 'No backup was specified.' }
    }
    requireNotMigrating()
    const paths = currentPaths()
    // Preserve current state before overwriting, per the "backup before restore" requirement.
    await createBackup(paths, { includeMedia: false, trigger: 'automatic' })
    closeDatabase()
    const result = restoreBackupFiles(paths, backupDir)
    initDatabase(paths.database)
    if (result.ok) runMigrations()
    return result
  })

  ipcMain.handle('storage:getLockStatus', () => inspectLock(currentPaths()))

  ipcMain.handle('storage:moveData', async (_e, destination: unknown): Promise<MigrationResult> => {
    if (typeof destination !== 'string' || !destination.trim()) {
      return { ok: false, error: 'No destination folder was provided.' }
    }
    requireNotMigrating()
    return moveData(destination)
  })

  ipcMain.handle('storage:useDefaultFolder', async (): Promise<MigrationResult> => {
    requireNotMigrating()
    const defaultRoot = getDefaultDataRoot()
    if (currentPaths().root === defaultRoot) {
      return { ok: false, error: 'Already using the default location.' }
    }
    return moveData(defaultRoot)
  })

  ipcMain.handle('storage:findUnmanagedMedia', (): UnmanagedReference[] => {
    return findUnmanagedMedia(currentPaths())
  })

  ipcMain.handle('storage:consolidateMedia', async (_e, ref: unknown) => {
    if (!isUnmanagedReference(ref)) {
      return { ok: false, error: 'Invalid media reference.' }
    }
    return consolidateReference(currentPaths(), ref)
  })
}

function isUnmanagedReference(value: unknown): value is UnmanagedReference {
  if (!isRecord(value)) return false
  return typeof value.table === 'string' && typeof value.recordId === 'number'
    && typeof value.field === 'string' && typeof value.path === 'string' && typeof value.status === 'string'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
