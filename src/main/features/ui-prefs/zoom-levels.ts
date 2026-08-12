/**
 * Pure zoom-level logic — no Electron imports, so it's testable without a
 * real BrowserWindow. The six discrete levels the UI actually offers, not
 * Chromium's default continuous 10% zoom steps.
 */

export const ZOOM_LEVELS = [75, 90, 100, 110, 125, 150] as const
export type ZoomLevel = (typeof ZOOM_LEVELS)[number]

export const DEFAULT_ZOOM: ZoomLevel = 100

export function isZoomLevel(value: number): value is ZoomLevel {
  return (ZOOM_LEVELS as readonly number[]).includes(value)
}

/** Snaps an arbitrary percent to the nearest supported level (used to sanitize whatever was persisted). */
export function nearestZoomLevel(percent: number): ZoomLevel {
  if (isZoomLevel(percent)) return percent
  return ZOOM_LEVELS.reduce((closest, level) =>
    Math.abs(level - percent) < Math.abs(closest - percent) ? level : closest
  , DEFAULT_ZOOM as number) as ZoomLevel
}

/** Steps to the next/previous discrete level from the current one, clamped at the ends (never wraps). */
export function nextZoomLevel(current: number, direction: 'in' | 'out'): ZoomLevel {
  const normalized = nearestZoomLevel(current)
  const index = ZOOM_LEVELS.indexOf(normalized)
  const nextIndex = direction === 'in' ? index + 1 : index - 1
  const clampedIndex = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, nextIndex))
  return ZOOM_LEVELS[clampedIndex]
}
