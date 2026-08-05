import { app } from 'electron'
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'fs'
import { join } from 'path'
import Database from 'better-sqlite3'
import { isDatabaseOpen, sqlite } from '../../db'
import { atomicWriteJSON, readJSONSafe } from './atomic-fs'
import { copyDirRecursive } from './fs-utils'
import type { WorshipSyncPaths } from './paths'

export interface BackupManifest {
  createdAt: string
  trigger: 'automatic' | 'manual'
  includesMedia: boolean
  appVersion: string
  sourceRoot: string
}

export interface BackupResult {
  ok: boolean
  backupDir?: string
  error?: string
}

export interface RestoreResult {
  ok: boolean
  error?: string
}

const AUTOMATIC_BACKUP_RETENTION = 10

/**
 * Snapshots the database and (optionally) media into backups/<timestamp>/.
 * Uses better-sqlite3's online backup API rather than copying the live .db
 * file — safe to call while the app is actively reading/writing.
 */
export async function createBackup(
  paths: WorshipSyncPaths,
  options: { includeMedia: boolean; trigger?: 'automatic' | 'manual' }
): Promise<BackupResult> {
  const trigger = options.trigger ?? 'manual'
  const backupDir = uniqueBackupDir(paths, timestampForFilename())
  try {
    mkdirSync(backupDir, { recursive: true })
    await snapshotDatabase(paths, join(backupDir, 'worshipsync.db'))
    if (existsSync(paths.metadata)) copyFileSync(paths.metadata, join(backupDir, 'metadata.json'))

    if (options.includeMedia) {
      copyDirRecursive(paths.images, join(backupDir, 'assets', 'images'))
      copyDirRecursive(paths.audio, join(backupDir, 'assets', 'audio'))
      copyDirRecursive(paths.videos, join(backupDir, 'assets', 'videos'))
    }

    const manifest: BackupManifest = {
      createdAt: new Date().toISOString(),
      trigger,
      includesMedia: options.includeMedia,
      appVersion: app.getVersion(),
      sourceRoot: paths.root,
    }
    atomicWriteJSON(join(backupDir, 'backup-manifest.json'), manifest)

    if (trigger === 'automatic' && !options.includeMedia) pruneAutomaticBackups(paths)

    console.log('[storage] backup created:', backupDir)
    return { ok: true, backupDir }
  } catch (e) {
    try { rmSync(backupDir, { recursive: true, force: true }) } catch { /* best effort */ }
    return { ok: false, error: message(e) }
  }
}

/** Uses the live connection's backup API when open, otherwise a plain file copy (safe — nothing is writing to a closed DB). */
async function snapshotDatabase(paths: WorshipSyncPaths, destination: string): Promise<void> {
  if (isDatabaseOpen()) {
    await sqlite.backup(destination)
  } else {
    copyFileSync(paths.database, destination)
  }
}

export function listBackups(paths: WorshipSyncPaths): { dir: string; manifest: BackupManifest | null }[] {
  if (!existsSync(paths.backups)) return []
  return readdirSync(paths.backups, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => {
      const dir = join(paths.backups, e.name)
      const manifest = readJSONSafe<BackupManifest | null>(join(dir, 'backup-manifest.json'), null)
      return { dir, manifest }
    })
    .sort((a, b) => (b.manifest?.createdAt ?? '').localeCompare(a.manifest?.createdAt ?? ''))
}

function pruneAutomaticBackups(paths: WorshipSyncPaths): void {
  const automatic = listBackups(paths).filter(b => b.manifest?.trigger === 'automatic' && !b.manifest.includesMedia)
  for (const stale of automatic.slice(AUTOMATIC_BACKUP_RETENTION)) {
    try {
      rmSync(stale.dir, { recursive: true, force: true })
      console.log('[storage] pruned old automatic backup:', stale.dir)
    } catch (e) {
      console.error('[storage] failed to prune backup:', stale.dir, e)
    }
  }
}

/**
 * Restores a backup's database (and media, if the backup included it) over
 * the active data folder. Caller is responsible for closing the active DB
 * connection first and reopening it afterward — this only touches files.
 */
export function restoreBackupFiles(paths: WorshipSyncPaths, backupDir: string): RestoreResult {
  const dbBackupPath = join(backupDir, 'worshipsync.db')
  if (!existsSync(dbBackupPath)) return { ok: false, error: 'This backup does not contain a database file.' }

  try {
    const check = new Database(dbBackupPath, { readonly: true, fileMustExist: true })
    const rows = check.pragma('integrity_check') as { integrity_check: string }[]
    check.close()
    if (rows.length !== 1 || rows[0].integrity_check !== 'ok') {
      return { ok: false, error: 'This backup failed an integrity check and was not restored.' }
    }
  } catch (e) {
    return { ok: false, error: `Could not verify this backup: ${message(e)}` }
  }

  copyFileSync(dbBackupPath, paths.database)

  const mediaDir = join(backupDir, 'assets')
  if (existsSync(mediaDir)) {
    copyDirRecursive(join(mediaDir, 'images'), paths.images)
    copyDirRecursive(join(mediaDir, 'audio'), paths.audio)
    copyDirRecursive(join(mediaDir, 'videos'), paths.videos)
  }

  return { ok: true }
}

export function timestampForFilename(): string {
  return new Date().toISOString().replace(/:/g, '-').replace(/\.\d+Z$/, '')
}

/** The timestamp is only second-precision, so two backups within the same second need a disambiguating suffix rather than silently overwriting each other. */
function uniqueBackupDir(paths: WorshipSyncPaths, timestamp: string): string {
  let candidate = join(paths.backups, timestamp)
  let suffix = 2
  while (existsSync(candidate)) {
    candidate = join(paths.backups, `${timestamp}-${suffix}`)
    suffix++
  }
  return candidate
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
