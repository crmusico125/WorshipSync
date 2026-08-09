import { ipcMain } from 'electron'
import { checkForUpdates, downloadUpdate, installUpdate, getUpdaterState } from './service'
import type { UpdaterState } from './types'

export function registerUpdaterHandlers(): void {
  ipcMain.handle('updater:checkForUpdates', () => {
    checkForUpdates()
    return true
  })

  ipcMain.handle('updater:downloadUpdate', () => {
    downloadUpdate()
    return true
  })

  ipcMain.handle('updater:installUpdate', () => {
    installUpdate()
    return true
  })

  ipcMain.handle('updater:getState', (): UpdaterState => getUpdaterState())
}
