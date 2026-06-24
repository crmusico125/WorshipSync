import { BrowserWindow, ipcMain } from 'electron'
import { is } from '@electron-toolkit/utils'
import { join } from 'path'
import { screen } from 'electron'
import {
  windows,
  stage,
  getConfidenceLastDisplayId, setConfidenceLastDisplayId,
  setConfidenceWasOpen,
} from '../../lib/state'

export function createConfidenceWindow(displayId?: number): void {
  setConfidenceLastDisplayId(displayId)
  setConfidenceWasOpen(false)

  const displays = screen.getAllDisplays()
  const target = displayId
    ? displays.find(d => d.id === displayId)
    : displays.find(d => d.id !== screen.getPrimaryDisplay().id)
  const targetDisplay = target ?? screen.getPrimaryDisplay()
  const { x, y, width, height } = targetDisplay.bounds

  windows.confidence = new BrowserWindow({
    x,
    y,
    width,
    height,
    title: 'WorshipSync — Confidence Monitor',
    backgroundColor: '#080810',
    fullscreen: !!target,
    frame: !target,
    alwaysOnTop: !!target,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
    show: false,
  })

  windows.confidence.on('ready-to-show', () => {
    windows.confidence?.show()
    windows.control?.webContents.send('window:confidenceOpened')
  })

  windows.confidence.on('closed', () => {
    windows.confidence = null
    windows.control?.webContents.send('window:confidenceClosed')
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    windows.confidence.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/confidence.html`)
  } else {
    windows.confidence.loadFile(join(__dirname, '../renderer/confidence.html'))
  }
}

export function registerConfidenceHandlers(): void {
  ipcMain.on('window:openConfidence', (_event, displayId?: number) => {
    if (!windows.confidence || windows.confidence.isDestroyed()) {
      createConfidenceWindow(displayId)
    } else {
      windows.confidence.focus()
    }
  })

  ipcMain.on('window:moveConfidence', (_event, displayId: number) => {
    if (windows.confidence && !windows.confidence.isDestroyed()) {
      windows.confidence.once('closed', () => createConfidenceWindow(displayId))
      windows.confidence.close()
    } else {
      createConfidenceWindow(displayId)
    }
  })

  ipcMain.on('window:closeConfidence', () => {
    windows.confidence?.close()
    windows.confidence = null
  })

  ipcMain.handle('window:getConfidenceOpen', () => {
    return !!(windows.confidence && !windows.confidence.isDestroyed())
  })

  // Restore last known state when confidence window (re)loads
  ipcMain.on('confidence:ready', () => {
    if (!windows.confidence || windows.confidence.isDestroyed()) return
    if (stage.blank) {
      windows.confidence.webContents.send('slide:blank', true)
    } else if (stage.countdown && (stage.countdown as { running?: boolean }).running) {
      windows.confidence.webContents.send('slide:countdown', stage.countdown)
    } else if (stage.slide) {
      windows.confidence.webContents.send('slide:show', stage.slide)
    }
    // Restore media playback state so the progress bar shows immediately
    if (stage.videoState) {
      windows.confidence.webContents.send('slide:videoState', stage.videoState)
    }
    if (stage.audioState) {
      windows.confidence.webContents.send('slide:audioState', stage.audioState)
    }
  })
}
