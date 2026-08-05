import Database from 'better-sqlite3'
import { readdirSync, statSync } from 'fs'
import { join } from 'path'
import { runIntegrityCheck } from './validate'

export interface ConflictCandidate {
  filename: string
  path: string
  sizeBytes: number
  modifiedAt: string
  integrityOk: boolean | null
}

const SUSPICIOUS_PATTERNS = [
  /conflicted copy/i,
  /\bconflict\b/i,
  /\bduplicate\b/i,
  / copy\b/i,
  /-copy\b/i,
  /\(.*'s conflicted copy.*\)/i,
]

/**
 * Scans the data-folder root for files that look like a cloud-sync provider
 * left behind a second copy of the database (Dropbox/Google Drive/OneDrive
 * "conflicted copy" naming, or a plain "-copy" suffix). Only looks at files
 * that resemble worshipsync.db by name — never touches media.
 */
export function findConflictCandidates(root: string): ConflictCandidate[] {
  let entries: string[]
  try {
    entries = readdirSync(root)
  } catch {
    return []
  }

  const candidates: ConflictCandidate[] = []
  for (const filename of entries) {
    const lower = filename.toLowerCase()
    if (!lower.endsWith('.db')) continue
    const isPrimary = lower === 'worshipsync.db'
    const looksSuspicious = lower.startsWith('worshipsync') && !isPrimary
    const matchesPattern = SUSPICIOUS_PATTERNS.some(p => p.test(filename))
    if (!looksSuspicious && !matchesPattern) continue

    const fullPath = join(root, filename)
    let sizeBytes = 0
    let modifiedAt = ''
    try {
      const stat = statSync(fullPath)
      sizeBytes = stat.size
      modifiedAt = stat.mtime.toISOString()
    } catch {
      continue
    }

    let integrityOk: boolean | null = null
    try {
      const sqlite = new Database(fullPath, { readonly: true, fileMustExist: true })
      integrityOk = runIntegrityCheck(sqlite)
      sqlite.close()
    } catch {
      integrityOk = false
    }

    candidates.push({ filename, path: fullPath, sizeBytes, modifiedAt, integrityOk })
  }
  return candidates
}
