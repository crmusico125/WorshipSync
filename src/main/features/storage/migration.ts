import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statfsSync } from 'fs'
import { basename, dirname, join } from 'path'
import Database from 'better-sqlite3'
import { closeDatabase, initDatabase } from '../../db'
import { runMigrations } from '../../db/migrate'
import { createBackup } from './backup'
import { copyDirVerified, dirSizeBytes, listFilesRecursive } from './fs-utils'
import { releaseLock, startHeartbeat, writeLock } from './lock'
import { getWorshipSyncPaths, type WorshipSyncPaths } from './paths'
import { checkLocationSafety, runIntegrityCheck } from './validate'
import { writeStorageConfig } from './config'
import { storageState } from './state'
import { windows } from '../../lib/state'

export interface MigrationResult {
  ok: boolean
  error?: string
  newRoot?: string
}

const MANAGED_SUBDIRS = ['assets/images', 'assets/audio', 'assets/videos']

// OS-generated metadata that can appear in a folder just from being browsed in a
// file picker (e.g. Finder writes .DS_Store into a directory once you view it) —
// not real user data, so it shouldn't block "the destination must be empty".
const IGNORABLE_ENTRIES = new Set([
  '.DS_Store', '.localized', 'Thumbs.db', 'desktop.ini',
  '.Spotlight-V100', '.Trashes', '.fseventsd', '.TemporaryItems',
  'System Volume Information', '$RECYCLE.BIN',
])

function significantEntries(dir: string): string[] {
  return readdirSync(dir).filter(name => !IGNORABLE_ENTRIES.has(name))
}

/**
 * Moves the active data folder to `destinationRoot`. Copies into a disposable
 * staging directory next to the destination, verifies every file by
 * checksum, opens and integrity-checks the copy, and only then atomically
 * renames staging into place and switches the active folder — in that
 * order, so any failure before the final rename leaves the current data
 * folder completely untouched (rollback is just deleting the staging dir).
 * The source folder itself is never modified or deleted.
 */
export async function moveData(destinationRoot: string): Promise<MigrationResult> {
  if (storageState.migrationInProgress) {
    return { ok: false, error: 'A move is already in progress.' }
  }
  const sourcePaths = storageState.paths
  if (!sourcePaths) return { ok: false, error: 'No active data folder to move from.' }

  storageState.migrationInProgress = true
  let stagingDir: string | null = null

  try {
    const safety = checkLocationSafety(destinationRoot)
    if (!safety.ok) {
      return { ok: false, error: safety.errors.join(' ') }
    }
    if (resolveSame(destinationRoot, sourcePaths.root)) {
      return { ok: false, error: 'This is already the active data folder.' }
    }
    if (existsSync(destinationRoot)) {
      const entries = significantEntries(destinationRoot)
      if (entries.length > 0) {
        return { ok: false, error: `The destination folder must be empty. It currently contains: ${entries.slice(0, 5).join(', ')}${entries.length > 5 ? ', …' : ''}.` }
      }
      // Only OS-generated metadata (if anything) is left — clear it so the final
      // atomic rename below (which requires a genuinely empty target) succeeds.
      for (const name of readdirSync(destinationRoot)) {
        try { rmSync(join(destinationRoot, name), { recursive: true, force: true }) } catch { /* best effort */ }
      }
    }

    const sourceFileCount = countManagedFiles(sourcePaths)
    const sourceSizeBytes = MANAGED_SUBDIRS.reduce((sum, sub) => sum + dirSizeBytes(join(sourcePaths.root, sub)), 0)
      + (existsSync(sourcePaths.database) ? dirSizeBytes(dirname(sourcePaths.database)) : 0)

    const spaceCheck = checkAvailableSpace(destinationRoot, sourceSizeBytes)
    if (spaceCheck.status === 'insufficient') {
      const needed = formatBytes(Math.ceil(sourceSizeBytes * 1.1))
      const available = spaceCheck.availableBytes != null ? formatBytes(spaceCheck.availableBytes) : 'an unknown amount'
      return {
        ok: false,
        error: `Not enough free space at the destination for this move. This move needs about ${needed} free (your ${formatBytes(sourceSizeBytes)} of data plus working room); only ${available} is available there.`,
      }
    }

    console.log(`[storage] starting move: ${sourcePaths.root} -> ${destinationRoot} (${sourceFileCount} files)`)

    // Safety backup of the source database before touching anything.
    await createBackup(sourcePaths, { includeMedia: false, trigger: 'automatic' })

    // Stop writes against the source DB for the duration of the copy.
    closeDatabase()

    stagingDir = `${destinationRoot}.migrating-${Date.now()}`
    await copyToStaging(sourcePaths, stagingDir)

    const verification = await verifyStaging(stagingDir)
    if (!verification.ok) {
      throw new Error(verification.error)
    }

    // Everything checks out — activate. This is the only step that touches
    // the real destination path; if it throws, the .migrating dir is still
    // cleaned up below and the source remains the active folder.
    renameSync(stagingDir, destinationRoot)
    stagingDir = null

    const newPaths = getWorshipSyncPaths(destinationRoot)
    writeStorageConfig({ activeDataFolder: destinationRoot, previousDataFolder: sourcePaths.root })

    // Move the lock: release the old one, acquire a fresh one at the new location.
    if (storageState.stopHeartbeat) storageState.stopHeartbeat()
    if (storageState.deviceId && storageState.lock) releaseLock(sourcePaths, storageState.deviceId, storageState.lock.sessionId)
    if (storageState.deviceId && storageState.deviceName) {
      const lock = writeLock(newPaths, storageState.deviceId, storageState.deviceName)
      const heartbeat = startHeartbeat(newPaths, lock)
      storageState.lock = lock
      storageState.stopHeartbeat = heartbeat.stop
    }

    initDatabase(newPaths.database)
    runMigrations()
    storageState.paths = newPaths

    windows.control?.webContents.send('storage:dataFolderChanged', destinationRoot)

    console.log('[storage] move complete:', destinationRoot)
    return { ok: true, newRoot: destinationRoot }
  } catch (e) {
    // Reopen the source DB so the app keeps working even though the move failed.
    if (!storageState.paths || storageState.paths.root !== sourcePaths.root) {
      try { initDatabase(sourcePaths.database) } catch { /* best effort */ }
    }
    const errorMessage = e instanceof Error ? e.message : String(e)
    console.error('[storage] move failed, source folder unchanged:', errorMessage)
    return { ok: false, error: errorMessage }
  } finally {
    if (stagingDir && existsSync(stagingDir)) {
      try { rmSync(stagingDir, { recursive: true, force: true }) } catch { /* best effort */ }
    }
    storageState.migrationInProgress = false
  }
}

function resolveSame(a: string, b: string): boolean {
  return join(a) === join(b)
}

function countManagedFiles(paths: WorshipSyncPaths): number {
  let count = existsSync(paths.database) ? 1 : 0
  for (const sub of MANAGED_SUBDIRS) count += listFilesRecursive(join(paths.root, sub)).length
  return count
}

interface SpaceCheckResult {
  status: 'ok' | 'insufficient' | 'unknown'
  availableBytes?: number
}

/** Best-effort disk space check — not all platforms/Node builds support statfs, so this never blocks a move on its own failure. */
function checkAvailableSpace(destinationRoot: string, requiredBytes: number): SpaceCheckResult {
  try {
    const checkDir = existsSync(destinationRoot) ? destinationRoot : dirname(destinationRoot)
    const stats = statfsSync(checkDir)
    const availableBytes = stats.bavail * stats.bsize
    // Require some headroom beyond the raw copy size for the staging copy to exist alongside the source.
    return { status: availableBytes > requiredBytes * 1.1 ? 'ok' : 'insufficient', availableBytes }
  } catch (e) {
    console.error('[storage] disk space check unavailable, proceeding without it:', e)
    return { status: 'unknown' }
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`
}

/** Copies exactly the database file and managed asset subdirs into a fresh staging directory — never the whole root (which would also sweep up backups/, recovery/, and the lock file). */
async function copyToStaging(sourcePaths: WorshipSyncPaths, stagingDir: string): Promise<void> {
  mkdirSync(stagingDir, { recursive: true })
  if (existsSync(sourcePaths.database)) {
    copyFileSync(sourcePaths.database, join(stagingDir, basename(sourcePaths.database)))
  }
  for (const sub of MANAGED_SUBDIRS) {
    const src = join(sourcePaths.root, sub)
    if (!existsSync(src)) continue
    await copyDirVerified(src, join(stagingDir, sub))
  }
}

async function verifyStaging(stagingDir: string): Promise<{ ok: boolean; error?: string }> {
  const stagedDbPath = join(stagingDir, 'worshipsync.db')
  if (!existsSync(stagedDbPath)) {
    return { ok: false, error: 'The database did not copy successfully.' }
  }

  let sqlite: Database.Database | null = null
  try {
    sqlite = new Database(stagedDbPath, { fileMustExist: true })
    if (!runIntegrityCheck(sqlite)) {
      return { ok: false, error: 'The copied database failed an integrity check.' }
    }

    // Cross-check that every managed (relative-path) media reference in the
    // copied database resolves to a real file in the staged assets folders.
    // Queries the staged connection directly (raw SQL, no drizzle) rather
    // than going through the app's shared db singleton — that connection is
    // closed for the duration of a move, and even when open is never
    // pointed at a staging directory.
    const missing = countMissingManagedReferences(sqlite, stagingDir)
    if (missing > 0) {
      return { ok: false, error: `${missing} managed media file(s) did not copy correctly.` }
    }
  } catch (e) {
    return { ok: false, error: `Could not open the copied database: ${e instanceof Error ? e.message : String(e)}` }
  } finally {
    sqlite?.close()
  }

  return { ok: true }
}

function countMissingManagedReferences(sqlite: Database.Database, stagingDir: string): number {
  const isManagedRelativePath = (p: string | null | undefined): p is string =>
    !!p && !p.startsWith('color:') && !p.startsWith('/') && !/^[a-zA-Z]:[\\/]/.test(p)

  let missing = 0
  const checkPath = (p: string | null | undefined): void => {
    if (isManagedRelativePath(p) && !existsSync(join(stagingDir, p))) missing++
  }

  for (const row of sqlite.prepare('SELECT background_path FROM songs').all() as { background_path: string | null }[]) {
    checkPath(row.background_path)
  }

  const itemRows = sqlite.prepare('SELECT media_path, override_background_path, media_collection FROM lineup_items').all() as
    { media_path: string | null; override_background_path: string | null; media_collection: string | null }[]
  for (const row of itemRows) {
    checkPath(row.media_path)
    checkPath(row.override_background_path)
    if (row.media_collection) {
      try {
        const cfg = JSON.parse(row.media_collection) as { items?: unknown[] }
        for (const entry of cfg.items ?? []) {
          checkPath(typeof entry === 'string' ? entry : (entry as { path?: string })?.path)
        }
      } catch { /* malformed JSON — skip */ }
    }
  }

  for (const row of sqlite.prepare('SELECT settings FROM themes').all() as { settings: string }[]) {
    try {
      const settings = JSON.parse(row.settings) as Record<string, unknown>
      for (const key of ['backgroundPath', 'scriptureBackgroundPath', 'announcementBackgroundPath']) {
        const value = settings[key]
        if (typeof value === 'string') checkPath(value)
      }
    } catch { /* malformed JSON — skip */ }
  }

  return missing
}
