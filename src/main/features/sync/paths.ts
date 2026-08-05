import { join } from 'path'
import { getDbPath } from '../../db/index'
import { mediaDir } from '../backgrounds/handlers'
import type { MediaKind } from './types'

export interface SyncWorkspacePaths {
  root: string
  packages: string
  history: string
}

/**
 * Only `packages/` and `history/` are actually read or written anywhere in
 * the publish/import flow — the spec's `services/`/`songs/`/`media/`
 * top-level folders aren't created since nothing populates them (see the
 * plan's scope decisions).
 */
export function getSyncWorkspacePaths(root: string): SyncWorkspacePaths {
  return {
    root,
    packages: join(root, 'packages'),
    history: join(root, 'history'),
  }
}

/** The local database file this device reads/writes — same path db/index.ts already opens. */
export function getLocalDbPath(): string {
  return getDbPath()
}

/** The local managed-media folder for a given kind — same folders backgrounds/handlers.ts already uses. */
export function getLocalMediaDir(kind: MediaKind): string {
  const ext = kind === 'video' ? '.mp4' : kind === 'audio' ? '.mp3' : '.jpg'
  return mediaDir(ext)
}
