import { existsSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { eq, and } from 'drizzle-orm'
import { db } from '../../db/index'
import { lineupItems, sections, serviceDates, songs, syncImportLog, themes } from '../../db/schema'
import { classifyMediaKind, resolveOrCopyAsset } from './asset-manager'
import { atomicWriteJSON, readJSONSafe } from './atomic-json'
import { getDeviceIdentity } from './device'
import { getSyncWorkspacePaths } from './paths'
import { verifyPackage } from './package-verifier'
import type { ImportResult, ServiceJson, ServiceJsonLineupItem, SyncHistoryEntry } from './types'
import { extractZip, readZipEntryText } from './zip'

function appendHistory(workspaceRoot: string, entry: SyncHistoryEntry): void {
  const paths = getSyncWorkspacePaths(workspaceRoot)
  const filePath = join(paths.history, `${entry.deviceId}.json`)
  const existing = readJSONSafe<SyncHistoryEntry[]>(filePath, [])
  existing.push(entry)
  atomicWriteJSON(filePath, existing)
}

function localMaxImportedVersion(syncUuid: string): number {
  const rows = db.select().from(syncImportLog).where(eq(syncImportLog.syncUuid, syncUuid)).all()
  return rows.reduce((max, r) => Math.max(max, r.version), 0)
}

export async function importPackage(zipPath: string, workspaceRoot: string): Promise<ImportResult> {
  const verification = verifyPackage(zipPath)
  if (!verification.ok) {
    return { ok: false, error: verification.detail }
  }
  const manifest = verification.manifest

  const alreadyImported = db.select().from(syncImportLog)
    .where(and(eq(syncImportLog.syncUuid, manifest.packageId), eq(syncImportLog.version, manifest.version)))
    .get()
  if (alreadyImported) {
    return { ok: false, error: 'This exact version has already been imported.' }
  }
  const localMaxVersion = localMaxImportedVersion(manifest.packageId)
  if (localMaxVersion > manifest.version) {
    return { ok: false, error: 'A newer version of this service is already imported locally.' }
  }

  const serviceJsonRaw = readZipEntryText(zipPath, 'service.json')
  if (!serviceJsonRaw) return { ok: false, error: 'Could not read service.json.' }
  const serviceJson = JSON.parse(serviceJsonRaw) as ServiceJson

  // Extract assets to a temp dir up front — resolveOrCopyAsset does file I/O
  // and DB lookups that must happen before the synchronous DB transaction
  // below (better-sqlite3 transactions can't contain awaited work).
  const tempDir = mkdtempSync(join(tmpdir(), 'worshipsync-sync-import-'))
  const zipEntryToLocalPath = new Map<string, string>()
  try {
    extractZip(zipPath, tempDir)
    for (const [zipEntry, checksum] of Object.entries(manifest.assetChecksums)) {
      const extractedPath = join(tempDir, zipEntry)
      if (!existsSync(extractedPath)) continue
      const kind = classifyMediaKind(zipEntry)
      const originalName = zipEntry.slice(zipEntry.lastIndexOf('/') + 1)
      const localPath = await resolveOrCopyAsset(checksum, extractedPath, kind, originalName)
      zipEntryToLocalPath.set(zipEntry, localPath)
    }

    const rewritePath = (p: string | null): string | null => {
      if (!p || p.startsWith('color:')) return p
      return zipEntryToLocalPath.get(p) ?? null
    }

    const existingService = db.select().from(serviceDates).where(eq(serviceDates.syncUuid, serviceJson.syncUuid)).get()
    const conflictingDateRow = db.select().from(serviceDates).where(eq(serviceDates.date, serviceJson.date)).get()
    if (conflictingDateRow && conflictingDateRow.syncUuid !== serviceJson.syncUuid) {
      return { ok: false, error: `A different local service already exists for ${serviceJson.date}. Rename or remove it before importing this package.` }
    }

    const device = getDeviceIdentity()
    const result = db.transaction((tx) => {
      // ── Songs: reuse by syncUuid if already known locally, else create ──
      const songUuidToLocalId = new Map<string, number>()
      for (const songJson of serviceJson.songs) {
        const existingSong = tx.select().from(songs).where(eq(songs.syncUuid, songJson.syncUuid)).get()
        if (existingSong) {
          songUuidToLocalId.set(songJson.syncUuid, existingSong.id)
          continue
        }
        const [created] = tx.insert(songs).values({
          title: songJson.title,
          artist: songJson.artist,
          key: songJson.key,
          tempo: songJson.tempo as 'slow' | 'medium' | 'fast' | null,
          ccliNumber: songJson.ccliNumber,
          copyright: songJson.copyright,
          backgroundPath: rewritePath(songJson.backgroundPath),
          tags: songJson.tags,
          syncUuid: songJson.syncUuid,
        }).returning().all()
        songUuidToLocalId.set(songJson.syncUuid, created.id)
        if (songJson.sections.length > 0) {
          tx.insert(sections).values(
            songJson.sections.map(s => ({ ...s, songId: created.id }))
          ).run()
        }
      }

      // ── Themes: reuse an existing local theme with the same name+type, else create (never as default) ──
      const themeNameToLocalId = new Map<string, number>()
      for (const themeJson of serviceJson.themes) {
        const existingTheme = tx.select().from(themes)
          .where(and(eq(themes.name, themeJson.name), eq(themes.type, themeJson.type as 'global' | 'seasonal' | 'per-song')))
          .get()
        if (existingTheme) {
          themeNameToLocalId.set(themeJson.name, existingTheme.id)
          continue
        }
        let settings = themeJson.settings
        try {
          const parsed = JSON.parse(settings) as Record<string, unknown>
          for (const key of ['backgroundPath', 'scriptureBackgroundPath', 'announcementBackgroundPath']) {
            const value = parsed[key]
            if (typeof value === 'string') parsed[key] = rewritePath(value)
          }
          settings = JSON.stringify(parsed)
        } catch { /* leave as-is */ }
        const [created] = tx.insert(themes).values({
          name: themeJson.name,
          type: themeJson.type as 'global' | 'seasonal' | 'per-song',
          isDefault: false, // an import must never silently change the receiving device's default theme
          seasonStart: themeJson.seasonStart,
          seasonEnd: themeJson.seasonEnd,
          settings,
        }).returning().all()
        themeNameToLocalId.set(themeJson.name, created.id)
      }

      // ── Service: create or update ──
      let serviceDateId: number
      let created: boolean
      if (existingService) {
        serviceDateId = existingService.id
        created = false
        tx.update(serviceDates).set({
          label: serviceJson.label,
          notes: serviceJson.notes,
          updatedAt: new Date().toISOString(),
        }).where(eq(serviceDates.id, serviceDateId)).run()
        tx.delete(lineupItems).where(eq(lineupItems.serviceDateId, serviceDateId)).run()
      } else {
        const [createdService] = tx.insert(serviceDates).values({
          date: serviceJson.date,
          label: serviceJson.label,
          notes: serviceJson.notes,
          syncUuid: serviceJson.syncUuid,
        }).returning().all()
        serviceDateId = createdService.id
        created = true
      }

      // ── Lineup items ──
      const remapPositionsToSectionIds = (item: ServiceJsonLineupItem, positions: number[]): number[] => {
        if (!item.songSyncUuid || positions.length === 0) return []
        const localSongId = songUuidToLocalId.get(item.songSyncUuid)
        if (!localSongId) return []
        const songSections = tx.select().from(sections).where(eq(sections.songId, localSongId)).orderBy(sections.orderIndex).all()
        return positions.map(pos => songSections[pos]?.id).filter((id): id is number => id !== undefined)
      }

      for (const item of serviceJson.lineupItems) {
        tx.insert(lineupItems).values({
          serviceDateId,
          songId: item.songSyncUuid ? songUuidToLocalId.get(item.songSyncUuid) ?? null : null,
          itemType: item.itemType as typeof lineupItems.$inferInsert.itemType,
          orderIndex: item.orderIndex,
          selectedSections: JSON.stringify(remapPositionsToSectionIds(item, item.selectedSectionPositions)),
          sectionOrder: item.sectionOrderPositions ? JSON.stringify(remapPositionsToSectionIds(item, item.sectionOrderPositions)) : null,
          overrideThemeId: item.overrideThemeName ? themeNameToLocalId.get(item.overrideThemeName) ?? null : null,
          overrideBackgroundPath: rewritePath(item.overrideBackgroundPath),
          notes: item.notes,
          title: item.title,
          scriptureRef: item.scriptureRef,
          mediaPath: rewritePath(item.mediaPath),
          itemStyle: item.itemStyle,
          imageScaleMode: item.imageScaleMode as 'cover' | 'contain' | 'stretch' | null,
          mediaCollection: item.mediaCollection ? rewriteMediaCollection(item.mediaCollection, rewritePath) : null,
          // musicPlayerDir is intentionally never set — it's never packaged (external, user-owned folder).
        }).run()
      }

      tx.insert(syncImportLog).values({
        syncUuid: manifest.packageId,
        version: manifest.version,
        packageFilename: zipPath.slice(zipPath.lastIndexOf('/') + 1),
        sourceDeviceId: manifest.publishedByDeviceId,
        sourceDeviceName: manifest.publishedByDeviceName,
        checksum: manifest.serviceJsonChecksum,
        localServiceDateId: serviceDateId,
      }).run()

      return { serviceDateId, created }
    })

    appendHistory(workspaceRoot, {
      type: 'import',
      syncUuid: manifest.packageId,
      version: manifest.version,
      title: manifest.title,
      at: new Date().toISOString(),
      deviceId: device.deviceId,
      deviceName: device.deviceName,
    })

    return { ok: true, serviceDateId: result.serviceDateId, created: result.created }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

function rewriteMediaCollection(json: string, rewritePath: (p: string | null) => string | null): string {
  try {
    const cfg = JSON.parse(json) as { items?: unknown[] }
    cfg.items = (cfg.items ?? []).map(entry => {
      const p = typeof entry === 'string' ? entry : (entry as { path?: string })?.path
      const rewritten = rewritePath(p ?? null)
      return typeof entry === 'string' ? rewritten : { ...(entry as object), path: rewritten }
    })
    return JSON.stringify(cfg)
  } catch {
    return json
  }
}
