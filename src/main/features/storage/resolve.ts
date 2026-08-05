import { relative, sep } from 'path'
import { resolveAssetPath } from './paths'
import { storageState } from './state'

/**
 * Resolves a single stored path value (as read from a DB column) to an
 * absolute path the renderer can hand to toFileUrl(). Legacy absolute-path
 * values, the 'color:#rrggbb' sentinel, and null all pass through unchanged.
 * This is the one place relative-path resolution happens — every IPC read
 * handler that returns a path-bearing column routes through here rather
 * than the renderer ever knowing paths can be relative.
 */
export function resolveStoredPath(value: string | null | undefined): string | null {
  if (value == null) return null
  if (!storageState.paths) return value
  return resolveAssetPath(storageState.paths, value)
}

/**
 * The inverse of resolveStoredPath — given an absolute path the renderer
 * handed back (e.g. for a usage-count/delete lookup), returns the relative
 * form it would be stored as if it lives under the active data root, or
 * null if it doesn't (a legacy/external absolute path, which is stored
 * as-is). Callers that need to match a DB column should check both forms,
 * since which one is actually stored depends on when the record was made.
 */
export function toRelativeIfManaged(absolutePath: string): string | null {
  if (!storageState.paths) return null
  const root = storageState.paths.root
  if (!absolutePath.startsWith(root)) return null
  const rel = relative(root, absolutePath)
  if (rel.startsWith('..')) return null
  return rel.split(sep).join('/')
}

const THEME_PATH_KEYS = ['backgroundPath', 'scriptureBackgroundPath', 'announcementBackgroundPath'] as const

/** Resolves the path-bearing keys inside a theme's settings JSON blob. */
export function resolveThemeSettingsJson(settingsJson: string): string {
  if (!storageState.paths) return settingsJson
  try {
    const settings = JSON.parse(settingsJson) as Record<string, unknown>
    let changed = false
    for (const key of THEME_PATH_KEYS) {
      const value = settings[key]
      if (typeof value === 'string' && value) {
        const resolved = resolveStoredPath(value)
        if (resolved !== value) { settings[key] = resolved; changed = true }
      }
    }
    return changed ? JSON.stringify(settings) : settingsJson
  } catch {
    return settingsJson
  }
}

/**
 * Resolves paths inside a media_collection JSON blob (`items: string[]`,
 * see mediaCollection.ts on the renderer side) — leaves everything else
 * (autoAdvance, intervalSeconds, loop) untouched. Also tolerates a
 * `{ path }[]` item shape defensively, though nothing currently produces it.
 */
export function resolveMediaCollectionJson(json: string | null): string | null {
  if (!json || !storageState.paths) return json
  try {
    const cfg = JSON.parse(json) as { items?: unknown[] }
    if (!Array.isArray(cfg.items)) return json
    cfg.items = cfg.items.map(item => {
      if (typeof item === 'string') return resolveStoredPath(item)
      if (item && typeof item === 'object' && 'path' in item) {
        const obj = item as { path: string }
        return { ...obj, path: resolveStoredPath(obj.path) }
      }
      return item
    })
    return JSON.stringify(cfg)
  } catch {
    return json
  }
}
