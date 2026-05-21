import { ipcMain, app, dialog } from 'electron'
import { join, basename } from 'path'
import { mkdirSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { db } from '../../db/index'
import { songs, sections, serviceDates, lineupItems, themes, songUsage } from '../../db/schema'

export function registerDataHandlers(): void {
  ipcMain.handle('data:export', async () => {
    const result = await dialog.showSaveDialog({
      title: 'Export WorshipSync Data',
      defaultPath: `worshipsync-backup-${new Date().toISOString().split('T')[0]}.worshipsync`,
      filters: [{ name: 'WorshipSync Backup', extensions: ['worshipsync'] }]
    })
    if (result.canceled || !result.filePath) return { success: false, canceled: true }

    // Read all media files as base64 (store subdir prefix so import can restore to correct folder)
    const backgrounds: { filename: string; sub: string; data: string }[] = []
    for (const sub of ['Pictures', 'Videos', 'Audio Tracks']) {
      const bgDir = join(app.getPath('userData'), sub)
      if (!existsSync(bgDir)) continue
      for (const f of readdirSync(bgDir).filter(f => /\.(jpg|jpeg|png|webp|mp4|webm|mov|mp3|wav|ogg|m4a|aac|flac)$/i.test(f))) {
        backgrounds.push({ filename: f, sub, data: readFileSync(join(bgDir, f)).toString('base64') })
      }
    }

    // Convert absolute bg paths to portable filenames
    const portablePath = (p: string | null | undefined): string | null => {
      if (!p || p.startsWith('color:')) return p ?? null
      return basename(p)
    }

    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      songs: db.select().from(songs).all().map(s => ({
        ...s, backgroundPath: portablePath(s.backgroundPath)
      })),
      sections: db.select().from(sections).all(),
      serviceDates: db.select().from(serviceDates).all(),
      lineupItems: db.select().from(lineupItems).all().map(item => ({
        ...item, overrideBackgroundPath: portablePath(item.overrideBackgroundPath)
      })),
      themes: db.select().from(themes).all().map(t => {
        try {
          const s = JSON.parse(t.settings)
          if (s.backgroundPath) s.backgroundPath = portablePath(s.backgroundPath)
          if (s.scriptureBackgroundPath) s.scriptureBackgroundPath = portablePath(s.scriptureBackgroundPath)
          return { ...t, settings: JSON.stringify(s) }
        } catch { return t }
      }),
      songUsage: db.select().from(songUsage).all(),
      backgrounds
    }

    writeFileSync(result.filePath, JSON.stringify(exportData), 'utf-8')
    return { success: true, path: result.filePath }
  })

  ipcMain.handle('data:import', async () => {
    const openResult = await dialog.showOpenDialog({
      title: 'Import WorshipSync Data',
      filters: [{ name: 'WorshipSync Backup', extensions: ['worshipsync'] }],
      properties: ['openFile']
    })
    if (openResult.canceled || !openResult.filePaths[0]) return { success: false, canceled: true }

    const confirmed = await dialog.showMessageBox({
      type: 'warning',
      title: 'Import data',
      message: 'This will replace ALL current data — songs, services, themes, and backgrounds. This cannot be undone.',
      buttons: ['Cancel', 'Replace all data'],
      defaultId: 0,
      cancelId: 0
    })
    if (confirmed.response === 0) return { success: false, canceled: true }

    let data: any
    try {
      data = JSON.parse(readFileSync(openResult.filePaths[0], 'utf-8'))
      if (!data.version) throw new Error('invalid')
    } catch {
      return { success: false, error: 'Invalid or corrupt backup file.' }
    }

    // Write media files back into their typed subdirectories
    const pathMap: Record<string, string> = {}
    for (const bg of (data.backgrounds ?? [])) {
      const sub = bg.sub ?? 'Pictures'
      const bgDir = join(app.getPath('userData'), sub)
      if (!existsSync(bgDir)) mkdirSync(bgDir, { recursive: true })
      const dest = join(bgDir, bg.filename)
      writeFileSync(dest, Buffer.from(bg.data, 'base64'))
      pathMap[bg.filename] = dest
      pathMap[`${sub}/${bg.filename}`] = dest
    }

    const restorePath = (p: string | null | undefined): string | null => {
      if (!p || p.startsWith('color:')) return p ?? null
      return pathMap[p] ?? pathMap[basename(p)] ?? null
    }

    // Clear in FK-safe order
    db.delete(songUsage).run()
    db.delete(lineupItems).run()
    db.delete(sections).run()
    db.delete(songs).run()
    db.delete(serviceDates).run()
    db.delete(themes).run()

    // Restore — preserve original IDs so foreign keys stay consistent
    for (const row of (data.songs ?? [])) {
      db.insert(songs).values({ ...row, backgroundPath: restorePath(row.backgroundPath) }).run()
    }
    for (const row of (data.sections ?? [])) {
      db.insert(sections).values(row).run()
    }
    for (const row of (data.serviceDates ?? [])) {
      db.insert(serviceDates).values(row).run()
    }
    for (const row of (data.lineupItems ?? [])) {
      db.insert(lineupItems).values({ ...row, overrideBackgroundPath: restorePath(row.overrideBackgroundPath) }).run()
    }
    for (const row of (data.themes ?? [])) {
      try {
        const s = JSON.parse(row.settings)
        if (s.backgroundPath) s.backgroundPath = restorePath(s.backgroundPath)
        if (s.scriptureBackgroundPath) s.scriptureBackgroundPath = restorePath(s.scriptureBackgroundPath)
        db.insert(themes).values({ ...row, settings: JSON.stringify(s) }).run()
      } catch {
        db.insert(themes).values(row).run()
      }
    }
    for (const row of (data.songUsage ?? [])) {
      db.insert(songUsage).values(row).run()
    }

    return { success: true }
  })
}
