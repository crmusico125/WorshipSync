import { existsSync, readdirSync, rmSync, statSync } from 'fs'
import { join } from 'path'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index'
import { syncImportLog } from '../../db/schema'
import { readJSONSafe } from './atomic-json'
import { getSyncWorkspacePaths } from './paths'
import type { AvailablePackage, PackageManifest, SyncHistoryEntry } from './types'

function localMaxImportedVersion(syncUuid: string): number {
  const rows = db.select().from(syncImportLog).where(eq(syncImportLog.syncUuid, syncUuid)).all()
  return rows.reduce((max, r) => Math.max(max, r.version), 0)
}

/** Scans packages/ by reading only the lightweight .meta.json sidecars — never opens the (possibly huge) zips just to list them. */
export function listAvailablePackages(workspaceRoot: string): AvailablePackage[] {
  const paths = getSyncWorkspacePaths(workspaceRoot)
  if (!existsSync(paths.packages)) return []

  const results: AvailablePackage[] = []
  for (const filename of readdirSync(paths.packages)) {
    if (!filename.endsWith('.wsservice')) continue
    const metaPath = join(paths.packages, `${filename}.meta.json`)
    const manifest = readJSONSafe<PackageManifest | null>(metaPath, null)
    if (!manifest) continue

    const localVersion = localMaxImportedVersion(manifest.packageId)
    const localState: AvailablePackage['localState'] =
      localVersion === 0 ? 'new' : localVersion >= manifest.version ? 'already-imported' : 'update-available'

    results.push({ filename, manifest, localState, localVersion: localVersion || null })
  }
  return results.sort((a, b) => b.manifest.publishedAt.localeCompare(a.manifest.publishedAt))
}

export function getWorkspaceStats(workspaceRoot: string): { packageCount: number; diskUsageBytes: number } {
  const paths = getSyncWorkspacePaths(workspaceRoot)
  if (!existsSync(paths.packages)) return { packageCount: 0, diskUsageBytes: 0 }
  const files = readdirSync(paths.packages).filter(f => f.endsWith('.wsservice'))
  const diskUsageBytes = files.reduce((sum, f) => sum + statSync(join(paths.packages, f)).size, 0)
  return { packageCount: files.length, diskUsageBytes }
}

/** Reads every device's own history file (each device only ever writes its own) and merges them, newest first. */
export function getWorkspaceHistory(workspaceRoot: string, limit = 100): SyncHistoryEntry[] {
  const paths = getSyncWorkspacePaths(workspaceRoot)
  if (!existsSync(paths.history)) return []
  const all: SyncHistoryEntry[] = []
  for (const filename of readdirSync(paths.history)) {
    if (!filename.endsWith('.json')) continue
    all.push(...readJSONSafe<SyncHistoryEntry[]>(join(paths.history, filename), []))
  }
  return all.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit)
}

export function deletePackageFiles(workspaceRoot: string, filename: string): void {
  const paths = getSyncWorkspacePaths(workspaceRoot)
  const zipPath = join(paths.packages, filename)
  const metaPath = `${zipPath}.meta.json`
  if (existsSync(zipPath)) rmSync(zipPath)
  if (existsSync(metaPath)) rmSync(metaPath)
}
