import { randomUUID } from 'crypto'
import { copyFileSync, existsSync, mkdirSync, statSync } from 'fs'
import { basename, extname, join, resolve as resolvePath } from 'path'
import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { mediaAssets, lineupItems, songs, themes } from '../../db/schema'
import { checksumFile } from './fs-utils'
import type { WorshipSyncPaths } from './paths'

export type MediaKind = 'image' | 'audio' | 'video'

export function classifyMediaKind(pathOrExt: string): MediaKind {
  const ext = extname(pathOrExt).toLowerCase()
  if (/\.(mp4|webm|mov)$/i.test(ext)) return 'video'
  if (/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(ext)) return 'audio'
  return 'image'
}

/**
 * Where a newly-imported file of this kind should live, relative to the
 * data root. The filename keeps a sanitized version of the original name
 * plus a short unique suffix (not a bare id) — every existing "display the
 * filename" call site across the renderer (song/lineup titles, media
 * collection labels, confidence monitor) derives its label from the stored
 * path's basename, so a pure UUID filename would replace every one of those
 * with an unreadable id. This keeps them readable without touching any of
 * those call sites, while still guaranteeing collision-free uniqueness (the
 * media_assets.id column holds the full id for anything that needs it).
 */
export function managedRelativePath(id: string, kind: MediaKind, originalPath: string): string {
  const ext = extname(originalPath).toLowerCase()
  const sub = kind === 'video' ? 'videos' : kind === 'audio' ? 'audio' : 'images'
  const sanitizedBase = basename(originalPath, ext)
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'file'
  const shortSuffix = id.replace(/-/g, '').slice(0, 8)
  const filename = `${sanitizedBase}-${shortSuffix}${ext}`
  return join('assets', sub, filename).split('\\').join('/')
}

export async function registerMediaAsset(params: {
  id: string
  type: MediaKind
  originalName: string
  relativePath: string
  absolutePath: string
}): Promise<void> {
  const checksum = await checksumFile(params.absolutePath).catch(() => null)
  const sizeBytes = existsSync(params.absolutePath) ? statSync(params.absolutePath).size : null
  db.insert(mediaAssets).values({
    id: params.id,
    type: params.type,
    originalName: params.originalName,
    relativePath: params.relativePath,
    checksum,
    sizeBytes,
  }).run()
}

// ── Repair scan ──────────────────────────────────────────────────────────────

export interface UnmanagedReference {
  table: 'songs' | 'lineup_items' | 'themes'
  recordId: number
  field: string
  label: string
  path: string
  status: 'external' | 'missing'
}

/**
 * Scans every known path-bearing column for absolute references that live
 * outside the active data folder ("external" — candidates for a safe copy
 * into managed storage) or point at files that no longer exist ("missing" —
 * reported only, never auto-repaired). musicPlayerDir is deliberately never
 * scanned — it's meant to stay an external, user-owned folder.
 */
export function findUnmanagedMedia(paths: WorshipSyncPaths): UnmanagedReference[] {
  const root = resolvePath(paths.root)
  const results: UnmanagedReference[] = []

  const classify = (value: string | null): 'external' | 'missing' | 'ok' | 'skip' => {
    if (!value || value.startsWith('color:')) return 'skip'
    const isAbsolute = value.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(value)
    if (!isAbsolute) return 'ok' // already a managed relative path
    if (!existsSync(value)) return 'missing'
    return resolvePath(value).startsWith(root) ? 'ok' : 'external'
  }

  for (const song of db.select().from(songs).all()) {
    const state = classify(song.backgroundPath)
    if (state === 'external' || state === 'missing') {
      results.push({ table: 'songs', recordId: song.id, field: 'backgroundPath', label: song.title, path: song.backgroundPath!, status: state })
    }
  }

  for (const item of db.select().from(lineupItems).all()) {
    for (const field of ['mediaPath', 'overrideBackgroundPath'] as const) {
      const value = item[field]
      const state = classify(value)
      if (state === 'external' || state === 'missing') {
        results.push({ table: 'lineup_items', recordId: item.id, field, label: item.title ?? `Item #${item.id}`, path: value!, status: state })
      }
    }
    if (item.mediaCollection) {
      try {
        const cfg = JSON.parse(item.mediaCollection) as { items?: unknown[] }
        for (const entry of cfg.items ?? []) {
          const p = typeof entry === 'string' ? entry : (entry as { path?: string })?.path
          if (!p) continue
          const state = classify(p)
          if (state === 'external' || state === 'missing') {
            results.push({ table: 'lineup_items', recordId: item.id, field: 'mediaCollection', label: item.title ?? `Collection #${item.id}`, path: p, status: state })
          }
        }
      } catch { /* malformed JSON — skip */ }
    }
    // musicPlayerDir intentionally not scanned — external by design.
  }

  for (const theme of db.select().from(themes).all()) {
    try {
      const settings = JSON.parse(theme.settings) as Record<string, unknown>
      for (const key of ['backgroundPath', 'scriptureBackgroundPath', 'announcementBackgroundPath']) {
        const value = settings[key]
        if (typeof value !== 'string') continue
        const state = classify(value)
        if (state === 'external' || state === 'missing') {
          results.push({ table: 'themes', recordId: theme.id, field: key, label: theme.name, path: value, status: state })
        }
      }
    } catch { /* malformed JSON — skip */ }
  }

  return results
}

/** Copies an external file into managed storage and updates the owning record. Only for status: 'external' entries. */
export async function consolidateReference(paths: WorshipSyncPaths, ref: UnmanagedReference): Promise<{ ok: boolean; error?: string }> {
  if (ref.status !== 'external') return { ok: false, error: 'Only externally-located files can be consolidated.' }
  try {
    const id = randomUUID()
    const kind = classifyMediaKind(ref.path)
    const relativePath = managedRelativePath(id, kind, ref.path)
    const absoluteDest = join(paths.root, relativePath)
    mkdirSync(join(absoluteDest, '..'), { recursive: true })
    copyFileSync(ref.path, absoluteDest)
    await registerMediaAsset({
      id,
      type: kind,
      originalName: ref.path.split(/[\\/]/).pop() ?? ref.path,
      relativePath,
      absolutePath: absoluteDest,
    })

    if (ref.table === 'songs') {
      db.update(songs).set({ backgroundPath: relativePath }).where(eq(songs.id, ref.recordId)).run()
    } else if (ref.table === 'lineup_items' && ref.field !== 'mediaCollection') {
      db.update(lineupItems).set({ [ref.field]: relativePath }).where(eq(lineupItems.id, ref.recordId)).run()
    } else if (ref.table === 'lineup_items' && ref.field === 'mediaCollection') {
      const item = db.select().from(lineupItems).where(eq(lineupItems.id, ref.recordId)).get()
      if (item?.mediaCollection) {
        const cfg = JSON.parse(item.mediaCollection) as { items: unknown[] }
        cfg.items = cfg.items.map(entry => {
          const p = typeof entry === 'string' ? entry : (entry as { path?: string })?.path
          if (p !== ref.path) return entry
          return typeof entry === 'string' ? relativePath : { ...(entry as object), path: relativePath }
        })
        db.update(lineupItems).set({ mediaCollection: JSON.stringify(cfg) }).where(eq(lineupItems.id, ref.recordId)).run()
      }
    } else if (ref.table === 'themes') {
      const theme = db.select().from(themes).where(eq(themes.id, ref.recordId)).get()
      if (theme) {
        const settings = JSON.parse(theme.settings) as Record<string, unknown>
        settings[ref.field] = relativePath
        db.update(themes).set({ settings: JSON.stringify(settings) }).where(eq(themes.id, ref.recordId)).run()
      }
    }

    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
