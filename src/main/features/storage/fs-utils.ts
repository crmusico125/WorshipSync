import { createHash } from 'crypto'
import { copyFileSync, createReadStream, existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import { copyFile } from 'fs/promises'
import { join } from 'path'

export interface CopiedFile {
  relativePath: string
  sizeBytes: number
  checksum: string
}

/** Streaming SHA-256 — safe for large media files, doesn't load them into memory. */
export function checksumFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('data', chunk => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

/** Recursively lists every file under `dir`, returning paths relative to `dir`. */
export function listFilesRecursive(dir: string): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  const walk = (current: string, prefix: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name)
      const rel = prefix ? join(prefix, entry.name) : entry.name
      if (entry.isDirectory()) walk(full, rel)
      else if (entry.isFile()) out.push(rel)
    }
  }
  walk(dir, '')
  return out
}

/**
 * Copies every file under `srcDir` into `destDir`, verifying each copy by
 * checksum. Throws on the first mismatch/failure — callers are expected to
 * clean up `destDir` on failure (used by migration, where the destination is
 * always a disposable staging directory).
 */
export async function copyDirVerified(srcDir: string, destDir: string): Promise<CopiedFile[]> {
  const files = listFilesRecursive(srcDir)
  const copied: CopiedFile[] = []
  for (const rel of files) {
    const src = join(srcDir, rel)
    const dest = join(destDir, rel)
    mkdirSync(join(dest, '..'), { recursive: true })
    await copyFile(src, dest)
    const [srcSum, destSum] = await Promise.all([checksumFile(src), checksumFile(dest)])
    if (srcSum !== destSum) {
      throw new Error(`Checksum mismatch copying ${rel} — source and copy don't match`)
    }
    copied.push({ relativePath: rel, sizeBytes: statSync(dest).size, checksum: destSum })
  }
  return copied
}

/** Plain recursive copy, no verification — used for lower-stakes operations like manual backups. */
export function copyDirRecursive(srcDir: string, destDir: string): void {
  if (!existsSync(srcDir)) return
  mkdirSync(destDir, { recursive: true })
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    const src = join(srcDir, entry.name)
    const dest = join(destDir, entry.name)
    if (entry.isDirectory()) copyDirRecursive(src, dest)
    else if (entry.isFile()) {
      mkdirSync(destDir, { recursive: true })
      copyFileSync(src, dest)
    }
  }
}

export function dirSizeBytes(dir: string): number {
  if (!existsSync(dir)) return 0
  let total = 0
  for (const rel of listFilesRecursive(dir)) {
    try {
      total += statSync(join(dir, rel)).size
    } catch {
      // file disappeared mid-walk — ignore
    }
  }
  return total
}
