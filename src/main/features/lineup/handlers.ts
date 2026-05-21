import { ipcMain } from 'electron'
import { db } from '../../db/index'
import { songs, sections, lineupItems } from '../../db/schema'
import { asc, eq } from 'drizzle-orm'

export function registerLineupHandlers(): void {
  ipcMain.handle('lineup:getForService', (_e, serviceDateId: number) => {
    const items = db.select().from(lineupItems)
      .where(eq(lineupItems.serviceDateId, serviceDateId))
      .orderBy(asc(lineupItems.orderIndex))
      .all()

    return items.map(item => {
      const itemType = item.itemType || 'song'

      // Non-song types carry their data directly on the item
      if (itemType !== 'song') {
        return { ...item, itemType, song: null }
      }

      if (!item.songId) return { ...item, itemType: 'song', song: null }

      const song = db.select().from(songs).where(eq(songs.id, item.songId)).get()
      if (!song) return { ...item, itemType: 'song', song: null }

      const songSections = db.select().from(sections)
        .where(eq(sections.songId, item.songId))
        .orderBy(asc(sections.orderIndex))
        .all()
      return { ...item, itemType: 'song', song: { ...song, sections: songSections } }
    })
  })

  ipcMain.handle('lineup:addSong', (_e, serviceDateId: number, songId: number) => {
    // Get current max order index
    const existing = db.select().from(lineupItems)
      .where(eq(lineupItems.serviceDateId, serviceDateId))
      .all()
    const orderIndex = existing.length

    // Default selected sections = all section ids for this song
    const songSections = db.select().from(sections)
      .where(eq(sections.songId, songId))
      .orderBy(asc(sections.orderIndex))
      .all()
    const selectedSections = JSON.stringify(songSections.map(s => s.id))

    const [item] = db.insert(lineupItems).values({
      serviceDateId,
      songId,
      orderIndex,
      selectedSections
    }).returning().all()

    return item
  })

  ipcMain.handle('lineup:addCountdown', (_e, serviceDateId: number) => {
    const existing = db.select().from(lineupItems)
      .where(eq(lineupItems.serviceDateId, serviceDateId))
      .all()
    const orderIndex = existing.length

    const [item] = db.insert(lineupItems).values({
      serviceDateId,
      orderIndex,
      itemType: 'countdown',
      selectedSections: '[]',
    }).returning().all()

    return item
  })

  ipcMain.handle('lineup:addScripture', (_e, serviceDateId: number, data: {
    title: string
    scriptureRef: string
  }) => {
    const existing = db.select().from(lineupItems)
      .where(eq(lineupItems.serviceDateId, serviceDateId))
      .all()
    const [item] = db.insert(lineupItems).values({
      serviceDateId,
      orderIndex: existing.length,
      itemType: 'scripture',
      selectedSections: '[]',
      title: data.title,
      scriptureRef: data.scriptureRef,
    }).returning().all()
    return item
  })

  ipcMain.handle('lineup:addAnnouncement', (_e, serviceDateId: number, data: {
    title: string
    content: string
  }) => {
    const existing = db.select().from(lineupItems)
      .where(eq(lineupItems.serviceDateId, serviceDateId))
      .all()
    const [item] = db.insert(lineupItems).values({
      serviceDateId,
      orderIndex: existing.length,
      itemType: 'announcement',
      selectedSections: '[]',
      title: data.title,
      scriptureRef: data.content,
    }).returning().all()
    return item
  })

  ipcMain.handle('lineup:addSection', (_e, serviceDateId: number, data: { title: string }) => {
    const existing = db.select().from(lineupItems)
      .where(eq(lineupItems.serviceDateId, serviceDateId))
      .all()
    const [item] = db.insert(lineupItems).values({
      serviceDateId,
      orderIndex: existing.length,
      itemType: 'section',
      selectedSections: '[]',
      title: data.title,
    }).returning().all()
    return item
  })

  ipcMain.handle('lineup:updateAnnouncement', (_e, lineupItemId: number, data: {
    title?: string
    content?: string
  }) => {
    if (data.title !== undefined) {
      db.update(lineupItems).set({ title: data.title }).where(eq(lineupItems.id, lineupItemId)).run()
    }
    if (data.content !== undefined) {
      db.update(lineupItems).set({ scriptureRef: data.content }).where(eq(lineupItems.id, lineupItemId)).run()
    }
    return true
  })

  ipcMain.handle('lineup:updateScripture', (_e, lineupItemId: number, data: {
    title?: string
    scriptureRef?: string
  }) => {
    if (data.title !== undefined) {
      db.update(lineupItems).set({ title: data.title }).where(eq(lineupItems.id, lineupItemId)).run()
    }
    if (data.scriptureRef !== undefined) {
      db.update(lineupItems).set({ scriptureRef: data.scriptureRef }).where(eq(lineupItems.id, lineupItemId)).run()
    }
    return true
  })

  ipcMain.handle('lineup:addMedia', (_e, serviceDateId: number, data: {
    title: string
    mediaPath: string
  }) => {
    const existing = db.select().from(lineupItems)
      .where(eq(lineupItems.serviceDateId, serviceDateId))
      .all()
    const [item] = db.insert(lineupItems).values({
      serviceDateId,
      orderIndex: existing.length,
      itemType: 'media',
      selectedSections: '[]',
      title: data.title,
      mediaPath: data.mediaPath,
    }).returning().all()
    return item
  })

  ipcMain.handle('lineup:removeSong', (_e, lineupItemId: number) => {
    db.delete(lineupItems).where(eq(lineupItems.id, lineupItemId)).run()
    return true
  })

  ipcMain.handle('lineup:reorder', (_e, serviceDateId: number, orderedIds: number[]) => {
    for (let i = 0; i < orderedIds.length; i++) {
      db.update(lineupItems)
        .set({ orderIndex: i })
        .where(eq(lineupItems.id, orderedIds[i]))
        .run()
    }
    return true
  })

  ipcMain.handle('lineup:toggleSection', (_e, lineupItemId: number, sectionId: number, included: boolean) => {
    const item = db.select().from(lineupItems)
      .where(eq(lineupItems.id, lineupItemId))
      .get()
    if (!item) return null

    const current: number[] = JSON.parse(item.selectedSections || '[]')
    const updated = included
      ? [...new Set([...current, sectionId])]
      : current.filter(id => id !== sectionId)

    db.update(lineupItems)
      .set({ selectedSections: JSON.stringify(updated) })
      .where(eq(lineupItems.id, lineupItemId))
      .run()

    return updated
  })

  ipcMain.handle('lineup:setSections', (_e, lineupItemId: number, sectionIds: number[]) => {
    db.update(lineupItems)
      .set({ selectedSections: JSON.stringify(sectionIds) })
      .where(eq(lineupItems.id, lineupItemId))
      .run()
    return sectionIds
  })

  ipcMain.handle('lineup:setNotes', (_e, lineupItemId: number, notes: string) => {
    db.update(lineupItems)
      .set({ notes: notes || null })
      .where(eq(lineupItems.id, lineupItemId))
      .run()
    return true
  })

  ipcMain.handle('lineup:setOverrideBg', (_e, lineupItemId: number, path: string | null) => {
    db.update(lineupItems)
      .set({ overrideBackgroundPath: path || null })
      .where(eq(lineupItems.id, lineupItemId))
      .run()
    return true
  })

  ipcMain.handle('lineup:setItemStyle', (_e, lineupItemId: number, style: string) => {
    db.update(lineupItems)
      .set({ itemStyle: style })
      .where(eq(lineupItems.id, lineupItemId))
      .run()
    return true
  })

  ipcMain.handle('lineup:setSectionOrder', (_e, lineupItemId: number, sectionIds: number[]) => {
    db.update(lineupItems)
      .set({ sectionOrder: JSON.stringify(sectionIds) })
      .where(eq(lineupItems.id, lineupItemId))
      .run()
    return true
  })
}
