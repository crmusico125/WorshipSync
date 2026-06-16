import { ipcMain, app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync } from 'fs'
import { db } from '../../db/index'
import { serviceDates } from '../../db/schema'
import { asc, eq } from 'drizzle-orm'

const appStatePath = () => join(app.getPath('userData'), 'app-state.json')

export function readAppState(): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(appStatePath(), 'utf-8'))
  } catch {
    return {}
  }
}

export function writeAppState(data: Record<string, unknown>): void {
  try {
    const current = readAppState()
    writeFileSync(appStatePath(), JSON.stringify({ ...current, ...data }), 'utf-8')
  } catch {}
}

export function registerAppStateHandlers(): void {
  ipcMain.handle('app:getState', () => readAppState())

  ipcMain.handle('app:setState', (_e, data: Record<string, unknown>) => {
    writeAppState(data)
    return true
  })

  ipcMain.handle('app:getBibleApiKey', () => process.env.BIBLE_API_KEY ?? null)

  ipcMain.handle('app:getTodayService', () => {
    const today = new Date().toISOString().split('T')[0]
    const todayService = db.select().from(serviceDates)
      .where(eq(serviceDates.date, today))
      .get()
    if (todayService) return { service: todayService, daysAway: 0 }

    // Find next upcoming service within 7 days
    const upcoming = db.select().from(serviceDates)
      .orderBy(asc(serviceDates.date))
      .all()
      .find(s => s.date > today)

    if (!upcoming) return null

    const daysAway = Math.round(
      (new Date(upcoming.date + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime())
      / (1000 * 60 * 60 * 24)
    )

    if (daysAway > 7) return null
    return { service: upcoming, daysAway }
  })
}
