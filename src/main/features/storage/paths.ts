import { app } from 'electron'
import { join } from 'path'

export interface WorshipSyncPaths {
  root: string
  database: string
  images: string
  audio: string
  videos: string
  thumbnails: string
  backups: string
  recovery: string
  metadata: string
  lockFile: string
}

const DB_FILENAME = 'worshipsync.db'

/**
 * Builds every managed path from a single root. Never reads or writes
 * anything — pure path arithmetic so it's trivially testable.
 */
export function getWorshipSyncPaths(root: string): WorshipSyncPaths {
  return {
    root,
    database: join(root, DB_FILENAME),
    images: join(root, 'assets', 'images'),
    audio: join(root, 'assets', 'audio'),
    videos: join(root, 'assets', 'videos'),
    thumbnails: join(root, 'thumbnails'),
    backups: join(root, 'backups'),
    recovery: join(root, 'recovery'),
    metadata: join(root, 'metadata.json'),
    lockFile: join(root, '.worshipsync-lock.json'),
  }
}

/** Subfolders that must exist for a data folder to be considered valid/ready. */
export function managedSubfolders(paths: WorshipSyncPaths): string[] {
  return [paths.images, paths.audio, paths.videos, paths.thumbnails, paths.backups, paths.recovery]
}

/**
 * Resolves a relative asset path (e.g. "assets/videos/<id>.mp4", as stored
 * in media_assets.relative_path or a managed lineup media_path) against the
 * active data folder. Absolute paths are returned unchanged — legacy
 * records predating this feature already store absolute paths.
 */
export function resolveAssetPath(paths: WorshipSyncPaths, storedPath: string): string {
  if (!storedPath) return storedPath
  if (storedPath.startsWith('color:')) return storedPath
  const isAbsolute = storedPath.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(storedPath)
  return isAbsolute ? storedPath : join(paths.root, storedPath)
}

/**
 * The data folder used before the user ever chooses one — preserves exact
 * current behavior so existing installs (and fresh ones) need no migration:
 * dev keeps using the project root, packaged builds keep using userData.
 */
export function getDefaultDataRoot(): string {
  if (process.env.NODE_ENV === 'development') {
    return process.cwd()
  }
  return app.getPath('userData')
}
