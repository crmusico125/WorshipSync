import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { basename, extname, join } from 'path'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index'
import { syncKnownAssets } from '../../db/schema'
import { checksumFile } from './checksum'
import { getLocalMediaDir } from './paths'
import type { MediaKind } from './types'

export function classifyMediaKind(pathOrExt: string): MediaKind {
  const ext = extname(pathOrExt).toLowerCase()
  if (/\.(mp4|webm|mov)$/i.test(ext)) return 'video'
  if (/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(ext)) return 'audio'
  return 'image'
}

const MEDIA_EXTENSIONS: Record<MediaKind, RegExp> = {
  image: /\.(jpg|jpeg|png|webp)$/i,
  audio: /\.(mp3|wav|ogg|m4a|aac|flac)$/i,
  video: /\.(mp4|webm|mov)$/i,
}

/**
 * Lazily indexes any not-yet-known files already sitting in the target media
 * folder, so a file added manually (outside this sync module) is still
 * found as a duplicate rather than being copied a second time.
 */
async function indexExistingFiles(kind: MediaKind): Promise<void> {
  const dir = getLocalMediaDir(kind)
  if (!existsSync(dir)) return
  const known = new Set(db.select({ path: syncKnownAssets.absolutePath }).from(syncKnownAssets).all().map(r => r.path))
  for (const filename of readdirSync(dir)) {
    if (!MEDIA_EXTENSIONS[kind].test(filename)) continue
    const absolutePath = join(dir, filename)
    if (known.has(absolutePath)) continue
    const checksum = await checksumFile(absolutePath)
    const existing = db.select().from(syncKnownAssets).where(eq(syncKnownAssets.checksum, checksum)).get()
    if (!existing) {
      db.insert(syncKnownAssets).values({ checksum, absolutePath, kind }).run()
    }
  }
}

/**
 * Returns the local absolute path holding these exact bytes, copying the
 * source file into managed media storage only if no byte-identical file
 * already exists locally (matched by SHA-256, not filename).
 */
export async function resolveOrCopyAsset(
  checksum: string,
  sourcePath: string,
  kind: MediaKind,
  originalName: string
): Promise<string> {
  const indexed = db.select().from(syncKnownAssets).where(eq(syncKnownAssets.checksum, checksum)).get()
  if (indexed && existsSync(indexed.absolutePath)) return indexed.absolutePath

  await indexExistingFiles(kind)
  const foundAfterIndex = db.select().from(syncKnownAssets).where(eq(syncKnownAssets.checksum, checksum)).get()
  if (foundAfterIndex && existsSync(foundAfterIndex.absolutePath)) return foundAfterIndex.absolutePath

  const dir = getLocalMediaDir(kind)
  mkdirSync(dir, { recursive: true })
  const ext = extname(originalName)
  const base = basename(originalName, ext).replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 60) || 'file'
  const shortHash = checksum.slice(0, 10)
  let filename = `${shortHash}-${base}${ext}`
  let destPath = join(dir, filename)
  let counter = 2
  while (existsSync(destPath)) {
    filename = `${shortHash}-${base}_${counter}${ext}`
    destPath = join(dir, filename)
    counter++
  }
  copyFileSync(sourcePath, destPath)

  if (indexed) {
    // Stale index entry (file was deleted/moved outside this module) — replace it.
    db.update(syncKnownAssets).set({ absolutePath: destPath }).where(eq(syncKnownAssets.checksum, checksum)).run()
  } else {
    db.insert(syncKnownAssets).values({ checksum, absolutePath: destPath, kind }).run()
  }
  return destPath
}
