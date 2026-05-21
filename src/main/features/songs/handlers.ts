import { ipcMain } from 'electron'
import { db } from '../../db/index'
import { songs, sections } from '../../db/schema'
import { asc, eq, like, or } from 'drizzle-orm'

export function registerSongsHandlers(): void {
  ipcMain.handle('songs:getAll', () => {
    return db.select().from(songs).orderBy(songs.title).all()
  })

  ipcMain.handle('songs:search', (_e, query: string) => {
    const q = `%${query}%`
    return db.select().from(songs).where(
      or(like(songs.title, q), like(songs.artist, q))
    ).orderBy(songs.title).all()
  })

  ipcMain.handle('songs:getById', (_e, id: number) => {
    const song = db.select().from(songs).where(eq(songs.id, id)).get()
    if (!song) return null
    const songSections = db.select().from(sections)
      .where(eq(sections.songId, id))
      .orderBy(sections.orderIndex)
      .all()
    return { ...song, sections: songSections }
  })

  ipcMain.handle('songs:create', (_e, data: {
    title: string
    artist: string
    key?: string
    tempo?: 'slow' | 'medium' | 'fast'
    ccliNumber?: string
    tags: string
    sections: { type: string; label: string; lyrics: string; orderIndex: number }[]
  }) => {
    const { sections: sectionData, ...songData } = data
    const [song] = db.insert(songs).values(songData).returning().all()
    if (sectionData.length > 0) {
      db.insert(sections).values(
        sectionData.map(s => ({ ...s, songId: song.id }))
      ).run()
    }
    return song
  })

  ipcMain.handle('songs:update', (_e, id: number, data: Partial<typeof songs.$inferInsert>) => {
    db.update(songs).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(songs.id, id)).run()
    return db.select().from(songs).where(eq(songs.id, id)).get()
  })

  ipcMain.handle('songs:delete', (_e, id: number) => {
    db.delete(songs).where(eq(songs.id, id)).run()
    return true
  })

  ipcMain.handle('sections:upsert', (_e, songId: number, sectionData: {
    id?: number
    type: string
    label: string
    lyrics: string
    orderIndex: number
  }[]) => {
    db.delete(sections).where(eq(sections.songId, songId)).run()
    if (sectionData.length > 0) {
      db.insert(sections).values(
        sectionData.map(s => ({ ...s, songId }))
      ).run()
    }
    return db.select().from(sections).where(eq(sections.songId, songId)).orderBy(asc(sections.orderIndex)).all()
  })

  ipcMain.handle('songs:setBackground', (_e, songId: number, backgroundPath: string | null) => {
    db.update(songs)
      .set({ backgroundPath, updatedAt: new Date().toISOString() })
      .where(eq(songs.id, songId))
      .run()
    return db.select().from(songs).where(eq(songs.id, songId)).get()
  })
}
