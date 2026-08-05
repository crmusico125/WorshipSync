import { createHash } from 'crypto'
import { createReadStream } from 'fs'

/** Streaming SHA-256 — safe for large video files without loading them fully into memory. */
export function checksumFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

export function checksumBuffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}
