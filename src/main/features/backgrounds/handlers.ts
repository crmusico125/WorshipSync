import { ipcMain, app, dialog } from 'electron'
import { join, extname, basename } from 'path'
import { copyFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'fs'
import { db } from '../../db/index'
import { songs, lineupItems, themes, serviceDates } from '../../db/schema'
import { eq, count, or } from 'drizzle-orm'

const mediaDir = (ext: string): string => {
  const sub =
    /\.(mp4|webm|mov)$/i.test(ext) ? 'Videos' :
    /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(ext) ? 'Audio Tracks' :
    'Pictures'
  const dir = join(app.getPath('userData'), sub)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function copyMediaFile(srcPath: string): string | null {
  const ext = extname(srcPath).toLowerCase()
  const dir = mediaDir(ext)
  const base = basename(srcPath, extname(srcPath))
  let filename = `${base}${ext}`
  let destPath = join(dir, filename)
  let counter = 2
  while (existsSync(destPath)) {
    filename = `${base}_${counter}${ext}`
    destPath = join(dir, filename)
    counter++
  }
  try {
    copyFileSync(srcPath, destPath)
    return destPath
  } catch (e) {
    console.error('[backgrounds] copy failed:', e)
    return null
  }
}

const MEDIA_DIALOG_FILTERS = [
  { name: 'All Media', extensions: ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'webm', 'mov', 'mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'] },
  { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] },
  { name: 'Videos', extensions: ['mp4', 'webm', 'mov'] },
  { name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'] },
]

export function registerBackgroundsHandlers(): void {
  ipcMain.handle('backgrounds:getDir', () => {
    const dir = join(app.getPath('userData'), 'Pictures')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    return dir
  })

  ipcMain.handle('backgrounds:listImages', () => {
    const subdirs = ['Pictures', 'Videos', 'Audio Tracks']
    const files: string[] = []
    for (const sub of subdirs) {
      const dir = join(app.getPath('userData'), sub)
      if (!existsSync(dir)) continue
      readdirSync(dir)
        .filter(f => /\.(jpg|jpeg|png|webp|mp4|webm|mov|mp3|wav|ogg|m4a|aac|flac)$/i.test(f))
        .forEach(f => files.push(join(dir, f)))
    }
    return files
  })

  ipcMain.handle('backgrounds:getUsageCount', (_e, imagePath: string) => {
    const result = db.select({ count: count() })
      .from(songs)
      .where(eq(songs.backgroundPath, imagePath))
      .get()
    return result?.count ?? 0
  })

  ipcMain.handle('backgrounds:getUsingSongs', (_e, imagePath: string) => {
    return db.select({ id: songs.id, title: songs.title, artist: songs.artist })
      .from(songs)
      .where(eq(songs.backgroundPath, imagePath))
      .all()
  })

  ipcMain.handle('backgrounds:getUsingServices', (_e, imagePath: string) => {
    const rows = db.select({
      id: serviceDates.id,
      date: serviceDates.date,
      label: serviceDates.label,
    })
      .from(lineupItems)
      .leftJoin(songs, eq(lineupItems.songId, songs.id))
      .innerJoin(serviceDates, eq(lineupItems.serviceDateId, serviceDates.id))
      .where(or(
        eq(lineupItems.overrideBackgroundPath, imagePath),
        eq(lineupItems.mediaPath, imagePath),
        eq(songs.backgroundPath, imagePath),
      ))
      .all()

    const seen = new Set<number>()
    return rows
      .filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true })
      .sort((a, b) => b.date.localeCompare(a.date))
  })

  ipcMain.handle('backgrounds:pickImage', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choose media file',
      filters: MEDIA_DIALOG_FILTERS,
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return copyMediaFile(result.filePaths[0])
  })

  ipcMain.handle('backgrounds:pickImages', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choose media files',
      filters: MEDIA_DIALOG_FILTERS,
      properties: ['openFile', 'multiSelections']
    })
    if (result.canceled || result.filePaths.length === 0) return []
    return result.filePaths.map(copyMediaFile).filter((p): p is string => p !== null)
  })

  ipcMain.handle('backgrounds:deleteImage', (_e, imagePath: string) => {
    try {
      // Clear from any songs using it as a background
      db.update(songs)
        .set({ backgroundPath: null })
        .where(eq(songs.backgroundPath, imagePath))
        .run()

      // Clear from media lineup items
      db.update(lineupItems)
        .set({ mediaPath: null })
        .where(eq(lineupItems.mediaPath, imagePath))
        .run()

      // Also clear from any themes using it
      const allThemes = db.select().from(themes).all()
      for (const theme of allThemes) {
        try {
          const settings = JSON.parse(theme.settings)
          let changed = false
          if (settings.backgroundPath === imagePath) { settings.backgroundPath = null; changed = true }
          if (settings.scriptureBackgroundPath === imagePath) { settings.scriptureBackgroundPath = null; changed = true }
          if (changed) {
            db.update(themes)
              .set({ settings: JSON.stringify(settings) })
              .where(eq(themes.id, theme.id))
              .run()
          }
        } catch {}
      }

      // Delete the file
      unlinkSync(imagePath)
      return true
    } catch (e) {
      console.error('[backgrounds] delete failed:', e)
      return false
    }
  })
}
