import { beforeEach, describe, expect, it } from 'vitest'
import { join } from 'path'
import { tempDataDir } from '@test/fixtures'
import { buildPackage } from '../package-builder'
import { importPackage } from '../package-importer'
import { deletePackageFiles, getWorkspaceStats, listAvailablePackages } from '../workspace-scan'
import { db, lineupItems, serviceDates } from './test-helpers'
import { ensureMigrated, resetTables } from './test-helpers'

describe('workspace-scan', () => {
  let workspaceRoot: string

  beforeEach(() => {
    ensureMigrated()
    resetTables()
    workspaceRoot = tempDataDir('scan-workspace')
  })

  it('lists a published package as "new" until it has been imported locally', async () => {
    const [service] = db.insert(serviceDates).values({ date: '2026-08-02', label: 'Sunday' }).returning().all()
    await buildPackage(service.id, workspaceRoot)

    const before = listAvailablePackages(workspaceRoot)
    expect(before).toHaveLength(1)
    expect(before[0].localState).toBe('new')

    await importPackage(join(workspaceRoot, 'packages', before[0].filename), workspaceRoot)

    const after = listAvailablePackages(workspaceRoot)
    expect(after[0].localState).toBe('already-imported')
  })

  it('reports "update-available" when a newer version exists than what was imported', async () => {
    const [service] = db.insert(serviceDates).values({ date: '2026-08-02', label: 'Sunday' }).returning().all()
    const v1 = await buildPackage(service.id, workspaceRoot)
    await importPackage(join(workspaceRoot, 'packages', v1.filename!), workspaceRoot)

    db.insert(lineupItems).values({ serviceDateId: service.id, itemType: 'countdown', orderIndex: 1, selectedSections: '[]' }).run()
    await buildPackage(service.id, workspaceRoot)

    const packages = listAvailablePackages(workspaceRoot)
    expect(packages).toHaveLength(2)
    const latest = packages.find(p => p.manifest.version === 2)!
    expect(latest.localState).toBe('update-available')
    expect(latest.localVersion).toBe(1)
  })

  it('getWorkspaceStats counts packages and total disk usage', async () => {
    const [service] = db.insert(serviceDates).values({ date: '2026-08-02', label: 'Sunday' }).returning().all()
    await buildPackage(service.id, workspaceRoot)

    const stats = getWorkspaceStats(workspaceRoot)
    expect(stats.packageCount).toBe(1)
    expect(stats.diskUsageBytes).toBeGreaterThan(0)
  })

  it('deletePackageFiles removes both the zip and its sidecar', async () => {
    const [service] = db.insert(serviceDates).values({ date: '2026-08-02', label: 'Sunday' }).returning().all()
    const built = await buildPackage(service.id, workspaceRoot)

    deletePackageFiles(workspaceRoot, built.filename!)

    expect(listAvailablePackages(workspaceRoot)).toHaveLength(0)
  })
})
