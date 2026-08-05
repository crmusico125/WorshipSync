import { app } from 'electron'
import { checksumBuffer } from './checksum'
import { PACKAGE_FORMAT_VERSION, SCHEMA_VERSION } from './types'
import type { PackageManifest, VerifyResult } from './types'
import { listZipEntries, readZipEntryBuffer, readZipEntryText } from './zip'

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0)
  const pb = b.split('.').map(n => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

function isPackageManifest(value: unknown): value is PackageManifest {
  if (!value || typeof value !== 'object') return false
  const m = value as Record<string, unknown>
  return typeof m.packageId === 'string' && typeof m.version === 'number'
    && typeof m.packageFormatVersion === 'number' && typeof m.minAppVersion === 'string'
    && typeof m.serviceJsonChecksum === 'string' && typeof m.assetChecksums === 'object'
}

/**
 * Verifies a package before anything from it is imported: manifest shape,
 * every checksum (service.json + every asset), and compatibility. Never
 * partially proceeds — any failure returns before the importer touches the
 * local database.
 */
export function verifyPackage(zipPath: string): VerifyResult {
  let manifestRaw: string | null
  try {
    manifestRaw = readZipEntryText(zipPath, 'manifest.json')
  } catch (e) {
    return { ok: false, reason: 'corrupted', detail: `Could not open the package: ${e instanceof Error ? e.message : String(e)}` }
  }
  if (!manifestRaw) return { ok: false, reason: 'invalid', detail: 'This file is missing manifest.json and is not a valid .wsservice package.' }

  let manifest: unknown
  try {
    manifest = JSON.parse(manifestRaw)
  } catch {
    return { ok: false, reason: 'corrupted', detail: 'manifest.json is not valid JSON.' }
  }
  if (!isPackageManifest(manifest)) {
    return { ok: false, reason: 'invalid', detail: 'manifest.json is missing required fields.' }
  }

  if (manifest.packageFormatVersion > PACKAGE_FORMAT_VERSION) {
    return { ok: false, reason: 'incompatible', detail: `This package uses a newer package format (${manifest.packageFormatVersion}) than this version of WorshipSync supports (${PACKAGE_FORMAT_VERSION}). Update WorshipSync to import it.` }
  }
  if (manifest.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, reason: 'incompatible', detail: `This package requires a newer WorshipSync schema (v${manifest.schemaVersion}) than this install supports (v${SCHEMA_VERSION}).` }
  }
  if (compareVersions(app.getVersion(), manifest.minAppVersion) < 0) {
    return { ok: false, reason: 'incompatible', detail: `This package requires WorshipSync ${manifest.minAppVersion} or newer.` }
  }

  const entries = new Set(listZipEntries(zipPath))
  if (!entries.has('service.json')) {
    return { ok: false, reason: 'corrupted', detail: 'This package is missing service.json.' }
  }

  const serviceJsonBuffer = readZipEntryBuffer(zipPath, 'service.json')
  if (!serviceJsonBuffer) {
    return { ok: false, reason: 'corrupted', detail: 'Could not read service.json from this package.' }
  }
  const actualServiceChecksum = checksumBuffer(serviceJsonBuffer)
  if (actualServiceChecksum !== manifest.serviceJsonChecksum) {
    return { ok: false, reason: 'corrupted', detail: 'service.json checksum mismatch.', expected: manifest.serviceJsonChecksum, actual: actualServiceChecksum }
  }

  for (const [relativePath, expectedChecksum] of Object.entries(manifest.assetChecksums)) {
    if (!entries.has(relativePath)) {
      return { ok: false, reason: 'corrupted', detail: `Missing asset in package: ${relativePath}` }
    }
    const buffer = readZipEntryBuffer(zipPath, relativePath)
    if (!buffer) {
      return { ok: false, reason: 'corrupted', detail: `Could not read asset: ${relativePath}` }
    }
    const actual = checksumBuffer(buffer)
    if (actual !== expectedChecksum) {
      return { ok: false, reason: 'corrupted', detail: `Checksum mismatch for ${relativePath}`, expected: expectedChecksum, actual }
    }
  }

  return { ok: true, manifest }
}
