import { beforeEach, describe, expect, it } from 'vitest'
import { existsSync, readdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tempDataDir } from '@test/fixtures'
import { buildPackage, previewPublish } from '../package-builder'
import { db, lineupItems, serviceDates, songs } from './test-helpers'
import { ensureMigrated, resetTables } from './test-helpers'

describe('buildPackage', () => {
  let workspaceRoot: string

  beforeEach(() => {
    ensureMigrated()
    resetTables()
    workspaceRoot = tempDataDir('publish-workspace')
  })

  it('writes a .wsservice package and a sidecar .meta.json into packages/', async () => {
    const [service] = db.insert(serviceDates).values({ date: '2026-08-02', label: 'Sunday' }).returning().all()

    const result = await buildPackage(service.id, workspaceRoot)

    expect(result.ok).toBe(true)
    const packagesDir = join(workspaceRoot, 'packages')
    const files = readdirSync(packagesDir)
    expect(files).toContain(result.filename)
    expect(files).toContain(`${result.filename}.meta.json`)
    expect(result.manifest?.version).toBe(1)
  })

  it('increments the version on each republish of the same service', async () => {
    const [service] = db.insert(serviceDates).values({ date: '2026-08-02', label: 'Sunday' }).returning().all()

    const first = await buildPackage(service.id, workspaceRoot)
    const second = await buildPackage(service.id, workspaceRoot)

    expect(first.manifest?.version).toBe(1)
    expect(second.manifest?.version).toBe(2)
  })

  it('fails cleanly when a referenced media file is missing', async () => {
    const [song] = db.insert(songs).values({ title: 'Missing BG', artist: '', backgroundPath: '/nonexistent/path/bg.jpg' }).returning().all()
    const [service] = db.insert(serviceDates).values({ date: '2026-08-02', label: 'Sunday' }).returning().all()
    db.insert(lineupItems).values({
      serviceDateId: service.id, songId: song.id, itemType: 'song', orderIndex: 0, selectedSections: '[]',
    }).run()

    const result = await buildPackage(service.id, workspaceRoot)

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/missing/i)
    expect(existsSync(join(workspaceRoot, 'packages'))).toBe(true)
    expect(readdirSync(join(workspaceRoot, 'packages')).filter(f => f.endsWith('.wsservice'))).toHaveLength(0)
  })

  it('previewPublish reports counts and size without building a package', async () => {
    const bgDir = tempDataDir('preview-assets')
    const bgPath = join(bgDir, 'bg.jpg')
    writeFileSync(bgPath, 'x'.repeat(1000))
    const [song] = db.insert(songs).values({ title: 'Song', artist: '', backgroundPath: bgPath }).returning().all()
    const [service] = db.insert(serviceDates).values({ date: '2026-08-02', label: 'Sunday' }).returning().all()
    db.insert(lineupItems).values({
      serviceDateId: service.id, songId: song.id, itemType: 'song', orderIndex: 0, selectedSections: '[]',
    }).run()

    const preview = previewPublish(service.id, workspaceRoot)

    expect(preview.counts.songs).toBe(1)
    expect(preview.counts.images).toBe(1)
    expect(preview.totalSizeBytes).toBe(1000)
    expect(preview.nextVersion).toBe(1)
    expect(readdirSync(workspaceRoot)).not.toContain('packages')
  })
})
