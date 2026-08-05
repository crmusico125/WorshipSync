import { beforeEach, describe, expect, it } from 'vitest'
import { join } from 'path'
import AdmZip from 'adm-zip'
import { tempDataDir } from '@test/fixtures'
import { buildPackage } from '../package-builder'
import { verifyPackage } from '../package-verifier'
import { db, serviceDates } from './test-helpers'
import { ensureMigrated, resetTables } from './test-helpers'

describe('verifyPackage', () => {
  let workspaceRoot: string
  let packagePath: string

  beforeEach(async () => {
    ensureMigrated()
    resetTables()
    workspaceRoot = tempDataDir('verify-workspace')
    const [service] = db.insert(serviceDates).values({ date: '2026-08-02', label: 'Sunday' }).returning().all()
    const result = await buildPackage(service.id, workspaceRoot)
    packagePath = join(workspaceRoot, 'packages', result.filename!)
  })

  it('accepts a freshly built package', () => {
    const result = verifyPackage(packagePath)
    expect(result.ok).toBe(true)
  })

  it('rejects a package with a tampered service.json (checksum mismatch)', () => {
    const zip = new AdmZip(packagePath)
    zip.updateFile('service.json', Buffer.from('{"tampered":true}'))
    zip.writeZip(packagePath)

    const result = verifyPackage(packagePath)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('corrupted')
      expect(result.expected).toBeTruthy()
      expect(result.actual).toBeTruthy()
      expect(result.expected).not.toBe(result.actual)
    }
  })

  it('rejects a package with an unsupported package format version', () => {
    const zip = new AdmZip(packagePath)
    const manifest = JSON.parse(zip.readAsText('manifest.json'))
    manifest.packageFormatVersion = 999
    zip.updateFile('manifest.json', Buffer.from(JSON.stringify(manifest)))
    zip.writeZip(packagePath)

    const result = verifyPackage(packagePath)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('incompatible')
  })

  it('rejects a package requiring a newer app version with a clear message', () => {
    const zip = new AdmZip(packagePath)
    const manifest = JSON.parse(zip.readAsText('manifest.json'))
    manifest.minAppVersion = '999.0.0'
    zip.updateFile('manifest.json', Buffer.from(JSON.stringify(manifest)))
    zip.writeZip(packagePath)

    const result = verifyPackage(packagePath)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.detail).toMatch(/999\.0\.0 or newer/)
  })

  it('rejects a file that is not a valid package', () => {
    const notAPackage = join(workspaceRoot, 'not-a-package.wsservice')
    const zip = new AdmZip()
    zip.addFile('readme.txt', Buffer.from('hi'))
    zip.writeZip(notAPackage)

    const result = verifyPackage(notAPackage)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('invalid')
  })
})
