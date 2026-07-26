import { ipcMain, dialog } from 'electron'
import { readdirSync } from 'fs'
import { join, extname, basename } from 'path'

const AUDIO_EXTENSIONS = /\.(mp3|wav|ogg|m4a|aac|flac)$/i

export function registerMusicHandlers(): void {
  ipcMain.handle('music:pickDirectory', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choose a music folder',
      properties: ['openDirectory'],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('music:scanDirectory', (_e, dirPath: string) => {
    if (!dirPath) return []
    try {
      return readdirSync(dirPath)
        .filter(f => AUDIO_EXTENSIONS.test(f))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
        .map(f => ({ path: join(dirPath, f), filename: basename(f, extname(f)) }))
    } catch (e) {
      console.error('[music] failed to scan directory:', dirPath, e)
      return []
    }
  })
}
