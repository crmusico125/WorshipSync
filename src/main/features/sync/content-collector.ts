import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index'
import { lineupItems, sections, serviceDates, songs, themes } from '../../db/schema'
import type { ServiceJson, ServiceJsonLineupItem, ServiceJsonSong, ServiceJsonTheme } from './types'

export interface CollectedAssetRef {
  /** Absolute local path to the file that needs to be packaged. */
  absolutePath: string
}

export interface CollectedContent {
  serviceJson: ServiceJson
  assetRefs: CollectedAssetRef[]
  hasMusicPlayerItem: boolean
  /** songs/scriptures are final here; images/audio/video are always 0 — package-builder fills those in from the actual copied+classified asset list. */
  counts: { songs: number; scriptures: number; images: number; audio: number; video: number }
}

function isPackageableAssetPath(value: string | null | undefined): value is string {
  if (!value) return false
  if (value.startsWith('color:')) return false
  return true
}

/** Ensures a row has a stable sync_uuid, generating and persisting one if it doesn't yet. */
function ensureSongSyncUuid(songId: number): string {
  const song = db.select().from(songs).where(eq(songs.id, songId)).get()
  if (!song) throw new Error(`Song ${songId} not found`)
  if (song.syncUuid) return song.syncUuid
  const uuid = randomUUID()
  db.update(songs).set({ syncUuid: uuid }).where(eq(songs.id, songId)).run()
  return uuid
}

export function ensureServiceSyncUuid(serviceDateId: number): string {
  const service = db.select().from(serviceDates).where(eq(serviceDates.id, serviceDateId)).get()
  if (!service) throw new Error(`Service ${serviceDateId} not found`)
  if (service.syncUuid) return service.syncUuid
  const uuid = randomUUID()
  db.update(serviceDates).set({ syncUuid: uuid }).where(eq(serviceDates.id, serviceDateId)).run()
  return uuid
}

/**
 * Gathers everything a published package needs: the service, its lineup
 * (in order), every referenced song (with sections) and theme, and the list
 * of local asset files that must be copied into the package. Scripture text
 * lives directly on the lineup item already — no separate asset for it.
 */
export function collectServiceContent(serviceDateId: number): CollectedContent {
  const service = db.select().from(serviceDates).where(eq(serviceDates.id, serviceDateId)).get()
  if (!service) throw new Error(`Service ${serviceDateId} not found`)

  const syncUuid = ensureServiceSyncUuid(serviceDateId)
  const items = db.select().from(lineupItems)
    .where(eq(lineupItems.serviceDateId, serviceDateId))
    .orderBy(lineupItems.orderIndex)
    .all()

  const assetRefs: CollectedAssetRef[] = []
  const includedSongIds = new Set<number>()
  const includedThemeIds = new Set<number>()
  const songJsonBySyncUuid = new Map<string, ServiceJsonSong>()
  let hasMusicPlayerItem = false
  const counts = { songs: 0, scriptures: 0, images: 0, audio: 0, video: 0 }

  const jsonLineupItems: ServiceJsonLineupItem[] = items.map(item => {
    let songSyncUuid: string | null = null

    if (item.itemType === 'song' && item.songId) {
      const uuid = ensureSongSyncUuid(item.songId)
      songSyncUuid = uuid
      if (!includedSongIds.has(item.songId)) {
        includedSongIds.add(item.songId)
        counts.songs++
        const song = db.select().from(songs).where(eq(songs.id, item.songId)).get()!
        const songSections = db.select().from(sections)
          .where(eq(sections.songId, item.songId))
          .orderBy(sections.orderIndex)
          .all()
        if (isPackageableAssetPath(song.backgroundPath)) assetRefs.push({ absolutePath: song.backgroundPath! })
        songJsonBySyncUuid.set(uuid, {
          syncUuid: uuid,
          title: song.title,
          artist: song.artist,
          key: song.key,
          tempo: song.tempo,
          ccliNumber: song.ccliNumber,
          copyright: song.copyright,
          backgroundPath: song.backgroundPath,
          tags: song.tags,
          sections: songSections.map(s => ({ type: s.type, label: s.label, lyrics: s.lyrics, orderIndex: s.orderIndex })),
        })
      }
    }

    if (item.itemType === 'scripture' || item.itemType === 'bible') counts.scriptures++
    if (item.itemType === 'music_player' && item.musicPlayerDir) hasMusicPlayerItem = true

    // Remap selectedSections/sectionOrder from local DB ids to positions
    // within the referenced song's exported `sections` array.
    const remapToPositions = (raw: string | null): number[] => {
      if (!raw || !item.songId) return []
      try {
        const localIds = JSON.parse(raw) as number[]
        const songSections = db.select().from(sections)
          .where(eq(sections.songId, item.songId))
          .orderBy(sections.orderIndex)
          .all()
        const idToPosition = new Map(songSections.map((s, i) => [s.id, i]))
        return localIds.map(id => idToPosition.get(id)).filter((p): p is number => p !== undefined)
      } catch {
        return []
      }
    }

    let overrideThemeName: string | null = null
    if (item.overrideThemeId) {
      const theme = db.select().from(themes).where(eq(themes.id, item.overrideThemeId)).get()
      if (theme) {
        overrideThemeName = theme.name
        includedThemeIds.add(theme.id)
      }
    }

    if (isPackageableAssetPath(item.overrideBackgroundPath)) assetRefs.push({ absolutePath: item.overrideBackgroundPath! })
    if (isPackageableAssetPath(item.mediaPath)) assetRefs.push({ absolutePath: item.mediaPath! })
    if (item.mediaCollection) {
      try {
        const cfg = JSON.parse(item.mediaCollection) as { items?: unknown[] }
        for (const entry of cfg.items ?? []) {
          const p = typeof entry === 'string' ? entry : (entry as { path?: string })?.path
          if (isPackageableAssetPath(p)) assetRefs.push({ absolutePath: p! })
        }
      } catch { /* malformed JSON — skip */ }
    }

    return {
      songSyncUuid,
      itemType: item.itemType,
      orderIndex: item.orderIndex,
      selectedSectionPositions: remapToPositions(item.selectedSections),
      sectionOrderPositions: item.sectionOrder ? remapToPositions(item.sectionOrder) : null,
      overrideThemeName,
      overrideBackgroundPath: item.overrideBackgroundPath,
      notes: item.notes,
      title: item.title,
      scriptureRef: item.scriptureRef,
      mediaPath: item.mediaPath,
      itemStyle: item.itemStyle,
      imageScaleMode: item.imageScaleMode,
      mediaCollection: item.mediaCollection,
      hasMusicPlayerDir: item.itemType === 'music_player' && !!item.musicPlayerDir,
    }
  })

  const jsonThemes: ServiceJsonTheme[] = []
  const defaultTheme = db.select().from(themes).where(eq(themes.isDefault, true)).get()
  const themeIdsToInclude = new Set(includedThemeIds)
  if (defaultTheme) themeIdsToInclude.add(defaultTheme.id)
  for (const themeId of themeIdsToInclude) {
    const theme = db.select().from(themes).where(eq(themes.id, themeId)).get()
    if (!theme) continue
    let settings = theme.settings
    try {
      const parsed = JSON.parse(settings) as Record<string, unknown>
      for (const key of ['backgroundPath', 'scriptureBackgroundPath', 'announcementBackgroundPath']) {
        const value = parsed[key]
        if (typeof value === 'string' && isPackageableAssetPath(value)) assetRefs.push({ absolutePath: value })
      }
      settings = JSON.stringify(parsed)
    } catch { /* leave settings as-is */ }
    jsonThemes.push({
      name: theme.name,
      type: theme.type,
      isDefault: theme.isDefault,
      seasonStart: theme.seasonStart,
      seasonEnd: theme.seasonEnd,
      settings,
    })
  }

  return {
    serviceJson: {
      syncUuid,
      label: service.label,
      date: service.date,
      notes: service.notes,
      songs: Array.from(songJsonBySyncUuid.values()),
      themes: jsonThemes,
      lineupItems: jsonLineupItems,
    },
    assetRefs,
    hasMusicPlayerItem,
    counts,
  }
}
