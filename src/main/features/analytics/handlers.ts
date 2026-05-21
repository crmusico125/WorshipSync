import { ipcMain } from 'electron'
import { db } from '../../db/index'
import { songs, serviceDates, lineupItems, songUsage } from '../../db/schema'
import { asc, desc, eq } from 'drizzle-orm'

export function registerAnalyticsHandlers(): void {
  ipcMain.handle('analytics:getSongUsage', () => {
    const allSongs = db.select().from(songs)
      .orderBy(asc(songs.title)).all()

    // Derive usage from lineup_items — always accurate, updates on add/remove
    const lineupRows = db.select({
      songId: lineupItems.songId,
      serviceDateId: lineupItems.serviceDateId,
    }).from(lineupItems).where(eq(lineupItems.itemType, 'song')).all()

    const serviceDateMap = new Map(
      db.select({ id: serviceDates.id, date: serviceDates.date, label: serviceDates.label })
        .from(serviceDates).all().map(s => [s.id, s])
    )

    // Group lineup rows by songId
    const usagesBySong = new Map<number, { date: string; label: string }[]>()
    for (const row of lineupRows) {
      if (row.songId == null) continue
      const svc = serviceDateMap.get(row.serviceDateId)
      if (!svc) continue
      const arr = usagesBySong.get(row.songId) ?? []
      arr.push(svc)
      usagesBySong.set(row.songId, arr)
    }

    return allSongs.map(song => {
      const usages = usagesBySong.get(song.id) ?? []
      const lastService = usages.sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
      return {
        ...song,
        usageCount: usages.length,
        lastUsedDate: lastService?.date ?? null,
        lastUsedLabel: lastService?.label ?? null,
      }
    })
  })

  ipcMain.handle('analytics:getServiceHistory', () => {
    return db.select().from(serviceDates)
      .orderBy(desc(serviceDates.date))
      .all()
  })

  ipcMain.handle('analytics:recordUsage', (_e, songId: number, serviceDateId: number) => {
    // Avoid duplicate entries
    const existing = db.select().from(songUsage)
      .where(eq(songUsage.songId, songId))
      .all()
      .find(u => u.serviceDateId === serviceDateId)

    if (existing) return existing

    const [created] = db.insert(songUsage).values({
      songId,
      serviceDateId,
      usedAt: new Date().toISOString()
    }).returning().all()
    return created
  })
}
