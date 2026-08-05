import { app, dialog } from 'electron'
import { initDatabase } from '../../db'
import { readStorageConfig, writeStorageConfig } from './config'
import { getWorshipSyncPaths, type WorshipSyncPaths } from './paths'
import { validateDataFolder, type FolderValidationResult } from './validate'
import { inspectLock, releaseLock, startHeartbeat, writeLock } from './lock'
import { findConflictCandidates } from './conflict'
import { moveConflictsAside, verifyAndRecover } from './recovery'
import { markOpened } from './metadata'
import { storageState } from './state'

/**
 * Resolves the active data folder, validates it, scans for sync conflicts,
 * acquires the single-device lock, and opens the database — in that order,
 * before any window exists. Blocking decisions (a folder that's locked by
 * another device, a stale lock, a sync conflict) are surfaced with native
 * dialogs since no renderer is available yet.
 *
 * Returns false if the user chose to quit rather than resolve a problem —
 * the caller (main/index.ts) should call app.quit() and stop startup.
 */
export async function bootstrapStorage(): Promise<boolean> {
  const config = readStorageConfig()
  let root = config.activeDataFolder

  for (;;) {
    const paths = getWorshipSyncPaths(root)

    const validation = validateDataFolder(root)
    if (!validation.ok) {
      const next = await handleValidationFailure(root, validation)
      if (next === null) return false
      root = next
      continue
    }

    const conflicts = findConflictCandidates(root)
    if (conflicts.length > 0) {
      const proceed = await resolveConflictsInteractive(paths)
      if (proceed === 'quit') return false
      if (proceed === 'choose-another') {
        const picked = await pickAnotherFolder()
        if (!picked) continue
        root = picked
        continue
      }
      // 'proceed' — user picked a candidate as canonical, recovery already moved the rest aside
    }

    const inspection = inspectLock(paths)

    if (inspection.state === 'fresh') {
      const action = await showFreshLockDialog(inspection.lock.deviceName, inspection.lock.openedAt, inspection.lock.lastHeartbeatAt)
      if (action === 'retry') continue
      if (action === 'choose-another') {
        const picked = await pickAnotherFolder()
        if (!picked) continue
        root = picked
        continue
      }
      return false // quit
    }

    if (inspection.state === 'stale' || inspection.state === 'corrupt') {
      const action = await showStaleLockDialog()
      if (action === 'verify-recover') {
        await verifyAndRecover(paths)
        // fall through — acquire the lock below
      } else if (action === 'choose-another') {
        const picked = await pickAnotherFolder()
        if (!picked) continue
        root = picked
        continue
      } else {
        return false // cancel -> quit
      }
    }

    // Clear to open. Acquire the lock, persist the choice, mark the folder
    // opened-but-not-cleanly-closed, then open the database.
    const lock = writeLock(paths, config.deviceId, config.deviceName)
    const heartbeat = startHeartbeat(paths, lock)
    writeStorageConfig({ activeDataFolder: root })
    markOpened(paths, config.deviceId, config.deviceName, app.getVersion())
    initDatabase(paths.database)

    storageState.paths = paths
    storageState.deviceId = config.deviceId
    storageState.deviceName = config.deviceName
    storageState.lock = lock
    storageState.stopHeartbeat = heartbeat.stop

    console.log('[storage] data folder ready:', root)
    return true
  }
}

/** Releases the lock and stops the heartbeat — safe to call even if bootstrap never fully succeeded. */
export function releaseStorageLock(): void {
  if (storageState.stopHeartbeat) {
    storageState.stopHeartbeat()
    storageState.stopHeartbeat = null
  }
  if (storageState.paths && storageState.deviceId && storageState.lock) {
    releaseLock(storageState.paths, storageState.deviceId, storageState.lock.sessionId)
  }
}

async function handleValidationFailure(root: string, validation: FolderValidationResult): Promise<string | null> {
  const result = await dialog.showMessageBox({
    type: 'error',
    title: 'WorshipSync data folder problem',
    message: `WorshipSync can't use this folder:\n${root}`,
    detail: validation.errors.join('\n'),
    buttons: ['Choose Another Folder', 'Quit'],
    defaultId: 0,
    cancelId: 1,
  })
  if (result.response === 0) {
    const picked = await pickAnotherFolder()
    return picked
  }
  return null
}

async function showFreshLockDialog(deviceName: string, openedAt: string, lastHeartbeatAt: string): Promise<'retry' | 'choose-another' | 'quit'> {
  const ageSeconds = Math.max(0, Math.round((Date.now() - new Date(lastHeartbeatAt).getTime()) / 1000))
  const result = await dialog.showMessageBox({
    type: 'warning',
    title: 'Data folder in use',
    message: 'This WorshipSync data folder appears to be in use by another device.',
    detail:
      `Device: ${deviceName}\n` +
      `Opened: ${new Date(openedAt).toLocaleString()}\n` +
      `Last active: ${ageSeconds}s ago\n\n` +
      `To avoid database corruption, close WorshipSync on the other device before continuing.`,
    buttons: ['Retry', 'Choose Another Folder', 'Quit'],
    defaultId: 0,
    cancelId: 2,
  })
  return (['retry', 'choose-another', 'quit'] as const)[result.response]
}

async function showStaleLockDialog(): Promise<'verify-recover' | 'choose-another' | 'cancel'> {
  const result = await dialog.showMessageBox({
    type: 'warning',
    title: 'Previous session did not close cleanly',
    message: 'The previous WorshipSync session may not have closed correctly.',
    detail: 'WorshipSync can verify the database is intact before continuing.',
    buttons: ['Verify and Recover', 'Choose Another Folder', 'Cancel'],
    defaultId: 0,
    cancelId: 2,
  })
  return (['verify-recover', 'choose-another', 'cancel'] as const)[result.response]
}

async function resolveConflictsInteractive(paths: WorshipSyncPaths): Promise<'proceed' | 'choose-another' | 'quit'> {
  const candidates = findConflictCandidates(paths.root)
  const list = candidates.map(c => `${c.filename} — ${new Date(c.modifiedAt).toLocaleString()} — ${(c.sizeBytes / 1024).toFixed(0)} KB — ${c.integrityOk ? 'valid' : 'may be damaged'}`).join('\n')
  const result = await dialog.showMessageBox({
    type: 'warning',
    title: 'Possible sync conflict detected',
    message: 'WorshipSync found more than one database file in this folder.',
    detail:
      `This can happen when a sync provider creates a conflict copy. WorshipSync will not merge these automatically.\n\n${list}\n\n` +
      `Choosing "Move Conflicts Aside" keeps worshipsync.db as the active database and moves the others into the recovery/ folder — nothing is deleted.`,
    buttons: ['Move Conflicts Aside', 'Choose Another Folder', 'Quit'],
    defaultId: 0,
    cancelId: 2,
  })
  if (result.response === 1) return 'choose-another'
  if (result.response === 2) return 'quit'
  await moveConflictsAside(paths, candidates)
  return 'proceed'
}

async function pickAnotherFolder(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    title: 'Choose a WorshipSync data folder',
    properties: ['openDirectory', 'createDirectory'],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
}
