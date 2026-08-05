import Database from 'better-sqlite3'
import { app } from 'electron'
import { accessSync, constants, mkdirSync } from 'fs'
import { dirname, resolve, sep } from 'path'
import { tmpdir } from 'os'
import { getWorshipSyncPaths, managedSubfolders } from './paths'

export interface FolderValidationResult {
  ok: boolean
  errors: string[]
  warnings: string[]
}

/**
 * The non-mutating half of validation: is this location even appropriate to
 * consider, before touching the filesystem at all. Split out from
 * validateDataFolder() because moveData() needs to check destination safety
 * *without* eagerly creating subfolders/a database there — that eager
 * creation is fine (even desirable, for instant "choose folder" feedback)
 * everywhere else, but it silently defeats moveData()'s atomic
 * rename-staging-into-place step, which requires the destination to still
 * be genuinely absent/empty at that point.
 */
export function checkLocationSafety(root: string): FolderValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const normalizedRoot = resolve(root)

  const tmp = resolve(tmpdir())
  if (isInside(normalizedRoot, tmp)) {
    errors.push('This folder is a temporary system directory and cannot be used for WorshipSync data — its contents can be deleted by the operating system at any time.')
  }

  // Only meaningful for a real installed bundle — in dev, app.getAppPath()
  // *is* the project root, which is also the intentional dev-mode data
  // location, so this check would always (incorrectly) fire.
  if (app.isPackaged) {
    const appDir = resolve(dirname(app.getAppPath()))
    if (isInside(normalizedRoot, appDir)) {
      errors.push('This folder is inside the WorshipSync application itself and cannot be used for data storage.')
    }
  }

  return { ok: errors.length === 0, errors, warnings }
}

/**
 * Runs every safety check from the spec before a folder is allowed to
 * become (or stay) the active data folder. Opens and closes its own throwaway
 * SQLite connection to check openability/integrity — never touches the
 * app's real connection. Creates the folder and required subfolders as a
 * side effect (see checkLocationSafety() for the non-mutating alternative).
 */
export function validateDataFolder(root: string): FolderValidationResult {
  const safety = checkLocationSafety(root)
  if (!safety.ok) return safety

  const normalizedRoot = resolve(root)
  const errors: string[] = []
  const warnings: string[] = []

  try {
    mkdirSync(normalizedRoot, { recursive: true })
  } catch (e) {
    errors.push(`Could not create the folder: ${message(e)}`)
    return { ok: false, errors, warnings }
  }

  try {
    accessSync(normalizedRoot, constants.R_OK)
  } catch {
    errors.push('The folder is not readable.')
  }
  try {
    accessSync(normalizedRoot, constants.W_OK)
  } catch {
    errors.push('The folder is not writable.')
  }
  if (errors.length) return { ok: false, errors, warnings }

  const paths = getWorshipSyncPaths(normalizedRoot)
  try {
    for (const dir of managedSubfolders(paths)) mkdirSync(dir, { recursive: true })
  } catch (e) {
    errors.push(`Could not create required subfolders: ${message(e)}`)
    return { ok: false, errors, warnings }
  }

  let sqlite: Database.Database | null = null
  try {
    sqlite = new Database(paths.database)
    if (!runIntegrityCheck(sqlite)) {
      errors.push('The database at this location failed an integrity check.')
    }
  } catch (e) {
    errors.push(`Could not open the database: ${message(e)}`)
  } finally {
    sqlite?.close()
  }

  return { ok: errors.length === 0, errors, warnings }
}

/** Runs `PRAGMA integrity_check` against an already-open connection. */
export function runIntegrityCheck(sqlite: Database.Database): boolean {
  try {
    const rows = sqlite.pragma('integrity_check') as { integrity_check: string }[]
    return rows.length === 1 && rows[0].integrity_check === 'ok'
  } catch {
    return false
  }
}

function isInside(candidate: string, dir: string): boolean {
  return candidate === dir || candidate.startsWith(dir + sep)
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
