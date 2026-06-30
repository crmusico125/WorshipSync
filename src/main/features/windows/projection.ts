import { BrowserWindow, ipcMain, screen, powerSaveBlocker } from 'electron'
import { is } from '@electron-toolkit/utils'
import { join } from 'path'
import {
  windows,
  getPowerSaveBlockerId, setPowerSaveBlockerId,
  getMovingProjection, setMovingProjection,
} from '../../lib/state'

export function createProjectionWindow(displayId?: number): void {
  const displays = screen.getAllDisplays()
  const target = displayId
    ? displays.find(d => d.id === displayId)
    : displays.find(d => d.id !== screen.getPrimaryDisplay().id)
  const targetDisplay = target ?? screen.getPrimaryDisplay()
  const { x, y, width, height } = targetDisplay.bounds

  windows.projection = new BrowserWindow({
    x,
    y,
    width,
    height,
    title: 'WorshipSync — Projection',
    backgroundColor: '#000000',
    fullscreen: !!target,
    frame: !target,
    alwaysOnTop: !!target,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,           // allows file:// image loading
      autoplayPolicy: 'no-user-gesture-required',  // allows video audio without a click
    },
    show: false
  })

  // Prevent display sleep while projecting
  const blockerId = getPowerSaveBlockerId()
  if (blockerId === null || !powerSaveBlocker.isStarted(blockerId)) {
    setPowerSaveBlockerId(powerSaveBlocker.start('prevent-display-sleep'))
  }

  windows.projection.on('ready-to-show', () => {
    windows.projection?.show()
  })

  windows.projection.on('closed', () => {
    windows.projection = null
    if (getMovingProjection()) {
      // Intentional display switch — don't notify the renderer
      setMovingProjection(false)
      return
    }
    // Real close — stop display-sleep prevention and notify renderer
    const id = getPowerSaveBlockerId()
    if (id !== null && powerSaveBlocker.isStarted(id)) {
      powerSaveBlocker.stop(id)
      setPowerSaveBlockerId(null)
    }
    windows.control?.webContents.send('window:projectionClosed')
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const projUrl = `${process.env['ELECTRON_RENDERER_URL']}/projection.html`
    console.log('[projection] loading URL:', projUrl)
    windows.projection.loadURL(projUrl)
  } else {
    const projPath = join(__dirname, '../renderer/projection.html')
    console.log('[projection] loading file:', projPath)
    windows.projection.loadFile(projPath)
  }

  windows.projection.webContents.on('did-finish-load', () => {
    console.log('[projection] window loaded successfully')
  })

  windows.projection.webContents.on('did-fail-load', (_e, code, desc) => {
    console.error('[projection] failed to load:', code, desc)
  })
}

export function registerProjectionHandlers(): void {
  ipcMain.on('window:openProjection', (_event, displayId?: number) => {
    if (!windows.projection || windows.projection.isDestroyed()) {
      createProjectionWindow(displayId)
    } else {
      windows.projection.focus()
    }
  })

  ipcMain.on('window:moveProjection', (_event, displayId: number) => {
    if (windows.projection && !windows.projection.isDestroyed()) {
      setMovingProjection(true)
      windows.projection.once('closed', () => createProjectionWindow(displayId))
      windows.projection.close()
    } else {
      createProjectionWindow(displayId)
    }
  })

  ipcMain.on('window:closeProjection', () => {
    const id = getPowerSaveBlockerId()
    if (id !== null && powerSaveBlocker.isStarted(id)) {
      powerSaveBlocker.stop(id)
      setPowerSaveBlockerId(null)
    }
    windows.projection?.close()
    windows.projection = null
  })

  ipcMain.on('projection:ready', () => {
    windows.control?.webContents.send('projection:ready')
  })

  ipcMain.handle('window:getDisplayCount', () => {
    return screen.getAllDisplays().length
  })

  ipcMain.handle('window:getDisplays', () => {
    const primary = screen.getPrimaryDisplay()
    return screen.getAllDisplays().map(d => ({
      id: d.id,
      label: d.label || `Display ${d.id}`,
      width: d.size.width,
      height: d.size.height,
      isPrimary: d.id === primary.id,
    }))
  })
}
