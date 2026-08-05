import { app } from 'electron'
import { existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { classifyMediaKind } from './asset-manager'
import { atomicWriteJSON, readJSONSafe } from './atomic-json'
import { checksumBuffer, checksumFile } from './checksum'
import { collectServiceContent } from './content-collector'
import { getDeviceIdentity } from './device'
import { getSyncWorkspacePaths, type SyncWorkspacePaths } from './paths'
import { PACKAGE_FORMAT_VERSION, SCHEMA_VERSION } from './types'
import type { PackageManifest, PublishPreview, ServiceJson, SyncHistoryEntry } from './types'
import { buildZip } from './zip'

export interface BuildPackageResult {
  ok: boolean
  error?: string
  filename?: string
  manifest?: PackageManifest
}

/** Next version number for this service's packageId — derived by scanning existing sidecars, never a stored counter. */
function nextVersionFor(packagesDir: string, packageId: string): number {
  if (!existsSync(packagesDir)) return 1
  let max = 0
  for (const filename of readdirSync(packagesDir)) {
    if (!filename.endsWith('.meta.json')) continue
    const manifest = readJSONSafe<PackageManifest | null>(join(packagesDir, filename), null)
    if (manifest?.packageId === packageId) max = Math.max(max, manifest.version)
  }
  return max + 1
}

function sanitizeForFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._ -]+/g, '_').replace(/\s+/g, ' ').trim()
}

/** Fast, no-hashing preview of what a publish would contain — used to show package size before committing. */
export function previewPublish(serviceDateId: number, workspaceRoot: string): PublishPreview {
  const { serviceJson, assetRefs, hasMusicPlayerItem, counts } = collectServiceContent(serviceDateId)
  const paths = getSyncWorkspacePaths(workspaceRoot)

  const seen = new Set<string>()
  let totalSizeBytes = 0
  const kindCounts = { images: 0, audio: 0, video: 0 }
  for (const ref of assetRefs) {
    if (seen.has(ref.absolutePath) || !existsSync(ref.absolutePath)) continue
    seen.add(ref.absolutePath)
    totalSizeBytes += statSync(ref.absolutePath).size
    const kind = classifyMediaKind(ref.absolutePath)
    if (kind === 'image') kindCounts.images++
    else if (kind === 'audio') kindCounts.audio++
    else kindCounts.video++
  }

  return {
    serviceDateId,
    title: `${serviceJson.date} ${serviceJson.label}`,
    counts: { ...counts, ...kindCounts },
    totalSizeBytes,
    hasMusicPlayerItem,
    nextVersion: nextVersionFor(paths.packages, serviceJson.syncUuid),
  }
}

function appendHistory(paths: SyncWorkspacePaths, entry: SyncHistoryEntry): void {
  const filePath = join(paths.history, `${entry.deviceId}.json`)
  const existing = readJSONSafe<SyncHistoryEntry[]>(filePath, [])
  existing.push(entry)
  atomicWriteJSON(filePath, existing)
}

export async function buildPackage(serviceDateId: number, workspaceRoot: string): Promise<BuildPackageResult> {
  const paths = getSyncWorkspacePaths(workspaceRoot)
  mkdirSync(paths.packages, { recursive: true })
  mkdirSync(paths.history, { recursive: true })

  const { serviceJson, assetRefs, counts } = collectServiceContent(serviceDateId)
  const device = getDeviceIdentity()
  const version = nextVersionFor(paths.packages, serviceJson.syncUuid)

  // Dedupe by checksum within this package (e.g. the same background used by two lineup items).
  const pathToZipEntry = new Map<string, string>()
  const checksumToZipEntry = new Map<string, string>()
  const assetChecksums: Record<string, string> = {}
  const kindCounts = { images: 0, audio: 0, video: 0 }

  for (const ref of assetRefs) {
    if (pathToZipEntry.has(ref.absolutePath)) continue
    if (!existsSync(ref.absolutePath)) {
      return { ok: false, error: `Referenced media file is missing: ${ref.absolutePath}` }
    }
    const checksum = await checksumFile(ref.absolutePath)
    const existingEntry = checksumToZipEntry.get(checksum)
    if (existingEntry) {
      pathToZipEntry.set(ref.absolutePath, existingEntry)
      continue
    }
    const kind = classifyMediaKind(ref.absolutePath)
    const ext = ref.absolutePath.slice(ref.absolutePath.lastIndexOf('.'))
    const sub = kind === 'video' ? 'videos' : kind === 'audio' ? 'audio' : 'images'
    const base = sanitizeForFilename(ref.absolutePath.slice(ref.absolutePath.lastIndexOf('/') + 1, ref.absolutePath.length - ext.length)).slice(0, 60) || 'file'
    const zipEntry = `assets/${sub}/${checksum.slice(0, 10)}-${base}${ext}`
    pathToZipEntry.set(ref.absolutePath, zipEntry)
    checksumToZipEntry.set(checksum, zipEntry)
    assetChecksums[zipEntry] = checksum
    if (kind === 'image') kindCounts.images++
    else if (kind === 'audio') kindCounts.audio++
    else kindCounts.video++
  }

  const rewritePath = (p: string | null): string | null => {
    if (!p || p.startsWith('color:')) return p
    return pathToZipEntry.get(p) ?? null // a path that failed to resolve becomes null rather than a dangling local path
  }

  const rewrittenServiceJson: ServiceJson = {
    ...serviceJson,
    songs: serviceJson.songs.map(s => ({ ...s, backgroundPath: rewritePath(s.backgroundPath) })),
    themes: serviceJson.themes.map(t => {
      try {
        const settings = JSON.parse(t.settings) as Record<string, unknown>
        for (const key of ['backgroundPath', 'scriptureBackgroundPath', 'announcementBackgroundPath']) {
          const value = settings[key]
          if (typeof value === 'string') settings[key] = rewritePath(value)
        }
        return { ...t, settings: JSON.stringify(settings) }
      } catch {
        return t
      }
    }),
    lineupItems: serviceJson.lineupItems.map(item => {
      let mediaCollection = item.mediaCollection
      if (mediaCollection) {
        try {
          const cfg = JSON.parse(mediaCollection) as { items?: unknown[] }
          cfg.items = (cfg.items ?? []).map(entry => {
            const p = typeof entry === 'string' ? entry : (entry as { path?: string })?.path
            const rewritten = rewritePath(p ?? null)
            return typeof entry === 'string' ? rewritten : { ...(entry as object), path: rewritten }
          })
          mediaCollection = JSON.stringify(cfg)
        } catch { /* leave as-is */ }
      }
      return {
        ...item,
        overrideBackgroundPath: rewritePath(item.overrideBackgroundPath),
        mediaPath: rewritePath(item.mediaPath),
        mediaCollection,
      }
    }),
  }

  const serviceJsonBuffer = Buffer.from(JSON.stringify(rewrittenServiceJson, null, 2), 'utf-8')
  const totalSizeBytes = Array.from(pathToZipEntry.keys()).reduce((sum, p) => sum + statSync(p).size, 0)

  const manifest: PackageManifest = {
    packageId: serviceJson.syncUuid,
    version,
    packageFormatVersion: PACKAGE_FORMAT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    minAppVersion: app.getVersion(),
    title: `${serviceJson.date} ${serviceJson.label}`,
    serviceDate: serviceJson.date,
    publishedAt: new Date().toISOString(),
    publishedByDeviceId: device.deviceId,
    publishedByDeviceName: device.deviceName,
    counts: { songs: counts.songs, scriptures: counts.scriptures, ...kindCounts },
    totalSizeBytes,
    serviceJsonChecksum: checksumBuffer(serviceJsonBuffer),
    assetChecksums,
    hasUnpackagedMusicPlayer: serviceJson.lineupItems.some(i => i.hasMusicPlayerDir),
  }

  const filename = `${sanitizeForFilename(manifest.serviceDate)} ${sanitizeForFilename(manifest.title.replace(manifest.serviceDate, '').trim())} v${version}.wsservice`
  const outputPath = join(paths.packages, filename)

  buildZip(
    [
      { entryName: 'manifest.json', content: JSON.stringify(manifest, null, 2) },
      { entryName: 'service.json', content: serviceJsonBuffer },
      ...Array.from(pathToZipEntry.entries()).map(([sourcePath, entryName]) => ({ entryName, sourcePath })),
    ],
    outputPath
  )
  atomicWriteJSON(`${outputPath}.meta.json`, manifest)

  appendHistory(getSyncWorkspacePaths(workspaceRoot), {
    type: 'publish',
    syncUuid: manifest.packageId,
    version,
    title: manifest.title,
    at: manifest.publishedAt,
    deviceId: device.deviceId,
    deviceName: device.deviceName,
  })

  return { ok: true, filename, manifest }
}
