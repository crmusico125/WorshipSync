import { app, BrowserWindow, ipcMain, shell, screen } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

let controlWindow: BrowserWindow | null = null
let projectionWindow: BrowserWindow | null = null

function createControlWindow(): void {
  controlWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    title: 'WorshipSync',
    backgroundColor: '#0c0c10',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false
  })

  controlWindow.on('ready-to-show', () => {
    controlWindow?.show()
  })

  controlWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    controlWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    controlWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createProjectionWindow(): void {
  const displays = screen.getAllDisplays()
  const externalDisplay = displays.find(d => d.id !== screen.getPrimaryDisplay().id)
  const targetDisplay = externalDisplay ?? screen.getPrimaryDisplay()
  const { x, y, width, height } = targetDisplay.bounds

  projectionWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    title: 'WorshipSync — Projection',
    backgroundColor: '#000000',
    fullscreen: !!externalDisplay,
    frame: !externalDisplay,
    alwaysOnTop: !!externalDisplay,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false
  })

  projectionWindow.on('ready-to-show', () => {
    projectionWindow?.show()
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    projectionWindow.loadURL(
      `${process.env['ELECTRON_RENDERER_URL']}/projection.html`
    )
  } else {
    projectionWindow.loadFile(join(__dirname, '../renderer/projection.html'))
  }
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

ipcMain.on('slide:show', (_event, payload) => {
  projectionWindow?.webContents.send('slide:show', payload)
})

ipcMain.on('slide:blank', (_event, isBlank: boolean) => {
  projectionWindow?.webContents.send('slide:blank', isBlank)
})

ipcMain.on('slide:logo', (_event, show: boolean) => {
  projectionWindow?.webContents.send('slide:logo', show)
})

ipcMain.on('projection:ready', () => {
  controlWindow?.webContents.send('projection:ready')
})

ipcMain.handle('window:getDisplayCount', () => {
  return screen.getAllDisplays().length
})

ipcMain.on('window:openProjection', () => {
  if (!projectionWindow || projectionWindow.isDestroyed()) {
    createProjectionWindow()
  } else {
    projectionWindow.focus()
  }
})

ipcMain.on('window:closeProjection', () => {
  projectionWindow?.close()
  projectionWindow = null
})

// ── Lifecycle ─────────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.worshipsync')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createControlWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createControlWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})