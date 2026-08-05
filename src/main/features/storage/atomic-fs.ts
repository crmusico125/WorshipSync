import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { randomBytes } from 'crypto'

/**
 * Writes JSON to `filePath` atomically: write to a temp file in the same
 * directory (so the rename stays on one filesystem), then rename over the
 * target. A crash mid-write leaves the original file intact — never a
 * half-written one.
 */
export function atomicWriteJSON(filePath: string, data: unknown): void {
  const dir = dirname(filePath)
  mkdirSync(dir, { recursive: true })
  const tmpPath = join(dir, `.tmp-${randomBytes(6).toString('hex')}-${Date.now()}`)
  writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
  renameSync(tmpPath, filePath)
}

/** Reads and parses JSON, returning `fallback` on any error (missing file, corrupt JSON, etc). */
export function readJSONSafe<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8')) as T
  } catch {
    return fallback
  }
}
