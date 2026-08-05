import { beforeEach, describe, expect, it } from 'vitest'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { eq } from 'drizzle-orm'
import AdmZip from 'adm-zip'
import { tempDataDir } from '@test/fixtures'
import { buildPackage } from '../package-builder'
import { importPackage } from '../package-importer'
import { db, lineupItems, sections, serviceDates, songs, syncImportLog } from './test-helpers'
import { ensureMigrated, resetTables } from './test-helpers'

function seedService(bgPath?: string, date = '2026-08-02') {
  const [song] = db.insert(songs).values({ title: 'Amazing Grace', artist: 'Traditional', backgroundPath: bgPath ?? null }).returning().all()
  db.insert(sections).values([
    { songId: song.id, type: 'verse', label: 'Verse 1', lyrics: 'line one', orderIndex: 0 },
    { songId: song.id, type: 'chorus', label: 'Chorus', lyrics: 'line two', orderIndex: 1 },
  ]).run()
  const [service] = db.insert(serviceDates).values({ date, label: 'Sunday' }).returning().all()
  db.insert(lineupItems).values({
    serviceDateId: service.id,
    songId: song.id,
    itemType: 'song',
    orderIndex: 0,
    selectedSections: JSON.stringify(db.select().from(sections).where(eq(sections.songId, song.id)).all().map(s => s.id)),
  }).run()
  return { song, service }
}

/** Deletes only the service/song/section/lineup rows — simulates a fresh receiving device that has never seen this content, while leaving the published package + any already-copied managed media alone. */
function wipeLocalServiceContent() {
  db.delete(lineupItems).run()
  db.delete(sections).run()
  db.delete(songs).run()
  db.delete(serviceDates).run()
}

describe('importPackage', () => {
  let workspaceRoot: string

  beforeEach(() => {
    ensureMigrated()
    resetTables()
    workspaceRoot = tempDataDir('import-workspace')
  })

  it('round-trips a service: publish, wipe locally, import recreates songs/sections/lineup with correct remapping', async () => {
    const bgDir = tempDataDir('import-assets')
    const bgPath = join(bgDir, 'bg.jpg')
    writeFileSync(bgPath, 'fake image bytes')
    const { service } = seedService(bgPath)

    const built = await buildPackage(service.id, workspaceRoot)
    expect(built.ok).toBe(true)

    wipeLocalServiceContent()
    expect(db.select().from(serviceDates).all()).toHaveLength(0)

    const result = await importPackage(join(workspaceRoot, 'packages', built.filename!), workspaceRoot)

    expect(result.ok).toBe(true)
    expect(result.created).toBe(true)
    const restoredService = db.select().from(serviceDates).where(eq(serviceDates.id, result.serviceDateId!)).get()
    expect(restoredService?.label).toBe('Sunday')
    const restoredItems = db.select().from(lineupItems).where(eq(lineupItems.serviceDateId, result.serviceDateId!)).all()
    expect(restoredItems).toHaveLength(1)
    const restoredSong = db.select().from(songs).where(eq(songs.id, restoredItems[0].songId!)).get()
    expect(restoredSong?.title).toBe('Amazing Grace')
    // Section-position remap: selectedSections should point at the two newly-created local section ids, in order.
    const restoredSections = db.select().from(sections).where(eq(sections.songId, restoredSong!.id)).orderBy(sections.orderIndex).all()
    expect(JSON.parse(restoredItems[0].selectedSections)).toEqual(restoredSections.map(s => s.id))
    // The background image was copied into managed storage, not left pointing at the original external path.
    expect(restoredSong?.backgroundPath).not.toBe(bgPath)
  })

  it('reuses an identical asset by checksum instead of copying it twice', async () => {
    const bgDir = tempDataDir('dedup-assets')
    const bgPathA = join(bgDir, 'a.jpg')
    const bgPathB = join(bgDir, 'b.jpg') // different filename, identical bytes
    writeFileSync(bgPathA, 'identical bytes')
    writeFileSync(bgPathB, 'identical bytes')

    // Two unrelated services (different dates, so no unique-constraint conflict),
    // each referencing a different source file with byte-identical content.
    const { service: serviceA } = seedService(bgPathA, '2026-08-02')
    const builtA = await buildPackage(serviceA.id, workspaceRoot)
    const { service: serviceB } = seedService(bgPathB, '2026-08-09')
    const builtB = await buildPackage(serviceB.id, workspaceRoot)

    wipeLocalServiceContent()

    const importA = await importPackage(join(workspaceRoot, 'packages', builtA.filename!), workspaceRoot)
    const importB = await importPackage(join(workspaceRoot, 'packages', builtB.filename!), workspaceRoot)
    const itemA = db.select().from(lineupItems).where(eq(lineupItems.serviceDateId, importA.serviceDateId!)).get()!
    const itemB = db.select().from(lineupItems).where(eq(lineupItems.serviceDateId, importB.serviceDateId!)).get()!
    const songA = db.select().from(songs).where(eq(songs.id, itemA.songId!)).get()
    const songB = db.select().from(songs).where(eq(songs.id, itemB.songId!)).get()

    expect(songA?.backgroundPath).toBe(songB?.backgroundPath) // same local file reused, not duplicated
  })

  it('rejects importing the exact same package twice without creating a duplicate service', async () => {
    const { service } = seedService()
    const built = await buildPackage(service.id, workspaceRoot)
    wipeLocalServiceContent()

    const first = await importPackage(join(workspaceRoot, 'packages', built.filename!), workspaceRoot)
    expect(first.ok).toBe(true)

    const second = await importPackage(join(workspaceRoot, 'packages', built.filename!), workspaceRoot)
    expect(second.ok).toBe(false)
    expect(second.error).toMatch(/already been imported/i)
    expect(db.select().from(serviceDates).all()).toHaveLength(1)
    expect(db.select().from(syncImportLog).all()).toHaveLength(1)
  })

  it('re-importing a newer version updates the same local service instead of duplicating it', async () => {
    const { service } = seedService()
    const v1 = await buildPackage(service.id, workspaceRoot)
    wipeLocalServiceContent()
    const firstImport = await importPackage(join(workspaceRoot, 'packages', v1.filename!), workspaceRoot)
    expect(firstImport.created).toBe(true)

    // The freshly-imported local copy already carries the same sync_uuid —
    // editing and republishing *it* (as this device now would) simulates a
    // newer version becoming available, without needing a second db.
    db.insert(lineupItems).values({ serviceDateId: firstImport.serviceDateId!, itemType: 'countdown', orderIndex: 1, selectedSections: '[]' }).run()
    const v2 = await buildPackage(firstImport.serviceDateId!, workspaceRoot)
    expect(v2.manifest?.version).toBe(2)

    const secondImport = await importPackage(join(workspaceRoot, 'packages', v2.filename!), workspaceRoot)

    expect(secondImport.ok).toBe(true)
    expect(secondImport.created).toBe(false)
    expect(secondImport.serviceDateId).toBe(firstImport.serviceDateId) // same local service, not a duplicate
    const finalItems = db.select().from(lineupItems).where(eq(lineupItems.serviceDateId, firstImport.serviceDateId!)).all()
    expect(finalItems).toHaveLength(2)
    expect(db.select().from(serviceDates).all()).toHaveLength(1)
  })

  it('rejects a corrupted package before making any local database changes', async () => {
    const { service } = seedService()
    const built = await buildPackage(service.id, workspaceRoot)
    wipeLocalServiceContent()
    const packagePath = join(workspaceRoot, 'packages', built.filename!)

    const zip = new AdmZip(packagePath)
    zip.updateFile('service.json', Buffer.from('{"tampered":true}'))
    zip.writeZip(packagePath)

    const beforeCount = db.select().from(serviceDates).all().length
    const result = await importPackage(packagePath, workspaceRoot)

    expect(result.ok).toBe(false)
    expect(db.select().from(serviceDates).all()).toHaveLength(beforeCount)
  })
})
