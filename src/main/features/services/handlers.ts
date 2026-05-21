import { ipcMain } from 'electron'
import { db } from '../../db/index'
import { serviceDates, lineupItems } from '../../db/schema'
import { asc, desc, eq, gte, like, or, count, and } from 'drizzle-orm'

export function registerServicesHandlers(): void {
  ipcMain.handle('services:getAll', () => {
    return db.select().from(serviceDates)
      .orderBy(asc(serviceDates.date))
      .all()
  })

  ipcMain.handle('services:getByDate', (_e, date: string) => {
    return db.select().from(serviceDates)
      .where(eq(serviceDates.date, date))
      .get() ?? null
  })

  ipcMain.handle('services:create', (_e, data: {
    date: string
    label: string
    status: 'empty' | 'in-progress' | 'ready'
    notes?: string
  }) => {
    const [created] = db.insert(serviceDates).values(data).returning().all()
    return created
  })

  ipcMain.handle('services:updateStatus', (_e, id: number, status: 'empty' | 'in-progress' | 'ready') => {
    db.update(serviceDates)
      .set({ status, updatedAt: new Date().toISOString() })
      .where(eq(serviceDates.id, id))
      .run()
    return db.select().from(serviceDates).where(eq(serviceDates.id, id)).get()
  })

  ipcMain.handle('services:update', (_e, id: number, data: { label?: string; date?: string }) => {
    db.update(serviceDates)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(serviceDates.id, id))
      .run()
    return db.select().from(serviceDates).where(eq(serviceDates.id, id)).get()
  })

  ipcMain.handle('services:delete', (_e, id: number) => {
    db.delete(serviceDates).where(eq(serviceDates.id, id)).run()
    return true
  })

  ipcMain.handle('services:getAllWithCounts', () => {
    const all = db.select().from(serviceDates).orderBy(desc(serviceDates.date)).all()
    return all.map(service => {
      const songRow = db.select({ count: count() })
        .from(lineupItems)
        .where(and(
          eq(lineupItems.serviceDateId, service.id),
          eq(lineupItems.itemType, 'song'),
        )).get()
      const totalRow = db.select({ count: count() }).from(lineupItems)
        .where(eq(lineupItems.serviceDateId, service.id)).get()
      return { ...service, songCount: songRow?.count ?? 0, itemCount: totalRow?.count ?? 0 }
    })
  })

  ipcMain.handle('services:getRecent', () => {
    const today = new Date().toISOString().split('T')[0]
    return db.select().from(serviceDates)
      .where(gte(serviceDates.date, today))
      .orderBy(asc(serviceDates.date))
      .limit(5)
      .all()
  })

  ipcMain.handle('services:search', (_e, q: string) => {
    const term = `%${q}%`
    return db.select().from(serviceDates)
      .where(or(like(serviceDates.label, term), like(serviceDates.date, term)))
      .orderBy(desc(serviceDates.date))
      .limit(10)
      .all()
  })
}
