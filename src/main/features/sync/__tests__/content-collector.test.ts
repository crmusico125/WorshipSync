import { beforeEach, describe, expect, it } from 'vitest'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { tempDataDir } from '@test/fixtures'
import { collectServiceContent, ensureServiceSyncUuid } from '../content-collector'
import { db, lineupItems, sections, serviceDates, songs } from './test-helpers'
import { ensureMigrated, resetTables } from './test-helpers'

describe('collectServiceContent', () => {
  beforeEach(() => {
    ensureMigrated()
    resetTables()
  })

  it('gathers songs, sections, lineup items, and referenced assets', () => {
    const bgDir = tempDataDir('collector-assets')
    const bgPath = join(bgDir, 'bg.jpg')
    writeFileSync(bgPath, 'fake image bytes')

    const [song] = db.insert(songs).values({ title: 'Amazing Grace', artist: '', backgroundPath: bgPath }).returning().all()
    db.insert(sections).values([
      { songId: song.id, type: 'verse', label: 'Verse 1', lyrics: 'line one', orderIndex: 0 },
      { songId: song.id, type: 'chorus', label: 'Chorus', lyrics: 'line two', orderIndex: 1 },
    ]).run()
    const [service] = db.insert(serviceDates).values({ date: '2026-08-02', label: 'Sunday' }).returning().all()
    db.insert(lineupItems).values({
      serviceDateId: service.id,
      songId: song.id,
      itemType: 'song',
      orderIndex: 0,
      selectedSections: JSON.stringify(
        db.select().from(sections).all().map(s => s.id)
      ),
    }).run()

    const result = collectServiceContent(service.id)

    expect(result.serviceJson.songs).toHaveLength(1)
    expect(result.serviceJson.songs[0].title).toBe('Amazing Grace')
    expect(result.serviceJson.songs[0].sections).toHaveLength(2)
    expect(result.serviceJson.lineupItems).toHaveLength(1)
    expect(result.serviceJson.lineupItems[0].selectedSectionPositions).toEqual([0, 1])
    expect(result.assetRefs.map(a => a.absolutePath)).toContain(bgPath)
    expect(result.counts.songs).toBe(1)
  })

  it('generates a stable sync_uuid that persists across calls', () => {
    const [service] = db.insert(serviceDates).values({ date: '2026-08-09', label: 'Sunday' }).returning().all()
    const first = ensureServiceSyncUuid(service.id)
    const second = ensureServiceSyncUuid(service.id)
    expect(first).toBe(second)
  })
})
