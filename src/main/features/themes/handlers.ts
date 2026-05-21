import { ipcMain } from 'electron'
import { db } from '../../db/index'
import { themes } from '../../db/schema'
import { asc, eq } from 'drizzle-orm'

export function registerThemesHandlers(): void {
  ipcMain.handle('themes:getAll', () => {
    return db.select().from(themes).orderBy(asc(themes.name)).all()
  })

  ipcMain.handle('themes:getDefault', () => {
    return db.select().from(themes).where(eq(themes.isDefault, true)).get() ?? null
  })

  ipcMain.handle('themes:create', (_e, data: {
    name: string
    type: 'global' | 'seasonal' | 'per-song'
    isDefault: boolean
    seasonStart?: string
    seasonEnd?: string
    settings: string
  }) => {
    const [created] = db.insert(themes).values(data).returning().all()
    return created
  })

  ipcMain.handle('themes:update', (_e, id: number, data: {
    name?: string
    settings?: string
    isDefault?: boolean
    seasonStart?: string
    seasonEnd?: string
  }) => {
    db.update(themes).set(data).where(eq(themes.id, id)).run()
    return db.select().from(themes).where(eq(themes.id, id)).get()
  })

  ipcMain.handle('themes:delete', (_e, id: number) => {
    db.delete(themes).where(eq(themes.id, id)).run()
    return true
  })
}
