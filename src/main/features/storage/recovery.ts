import Database from 'better-sqlite3'
import { existsSync, mkdirSync, renameSync } from 'fs'
import { join } from 'path'
import { createBackup } from './backup'
import { findConflictCandidates, type ConflictCandidate } from './conflict'
import { runIntegrityCheck } from './validate'
import type { WorshipSyncPaths } from './paths'

/**
 * Runs after a stale lock is detected: backs up the database, checks its
 * integrity, and moves any conflict-copy files aside — never merges or
 * deletes anything. Safe to call even if the database doesn't exist yet
 * (fresh folder).
 */
export async function verifyAndRecover(paths: WorshipSyncPaths): Promise<void> {
  if (existsSync(paths.database)) {
    await createBackup(paths, { includeMedia: false, trigger: 'automatic' })

    let integrityOk = true
    try {
      const sqlite = new Database(paths.database, { fileMustExist: true })
      integrityOk = runIntegrityCheck(sqlite)
      sqlite.close()
    } catch {
      integrityOk = false
    }

    if (!integrityOk) {
      mkdirSync(paths.recovery, { recursive: true })
      const dest = join(paths.recovery, `worshipsync-failed-integrity-check-${Date.now()}.db`)
      renameSync(paths.database, dest)
      console.error('[storage] database failed integrity check during recovery — moved to', dest)
    }
  }

  const conflicts = findConflictCandidates(paths.root).filter(c => c.filename.toLowerCase() !== 'worshipsync.db')
  if (conflicts.length > 0) {
    await moveConflictsAside(paths, conflicts)
  }
}

/** Moves every conflict candidate (other than the canonical worshipsync.db) into recovery/, preserving them. */
export async function moveConflictsAside(paths: WorshipSyncPaths, candidates: ConflictCandidate[]): Promise<void> {
  mkdirSync(paths.recovery, { recursive: true })
  for (const candidate of candidates) {
    if (candidate.filename.toLowerCase() === 'worshipsync.db') continue
    if (!existsSync(candidate.path)) continue
    const dest = join(paths.recovery, `${Date.now()}-${candidate.filename}`)
    try {
      renameSync(candidate.path, dest)
      console.log('[storage] moved conflict candidate to recovery:', dest)
    } catch (e) {
      console.error('[storage] failed to move conflict candidate:', candidate.path, e)
    }
  }
}
