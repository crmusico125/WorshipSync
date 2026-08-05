import { describe, expect, it } from 'vitest'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { tempDataDir } from '@test/fixtures'
import { checksumBuffer, checksumFile } from '../checksum'

describe('checksum', () => {
  it('produces the same hash for identical content, different hash for different content', async () => {
    const dir = tempDataDir('checksum')
    const a = join(dir, 'a.txt')
    const b = join(dir, 'b.txt')
    const c = join(dir, 'c.txt')
    writeFileSync(a, 'same content')
    writeFileSync(b, 'same content')
    writeFileSync(c, 'different content')

    const hashA = await checksumFile(a)
    const hashB = await checksumFile(b)
    const hashC = await checksumFile(c)

    expect(hashA).toBe(hashB)
    expect(hashA).not.toBe(hashC)
    expect(hashA).toBe(checksumBuffer(Buffer.from('same content')))
  })
})
