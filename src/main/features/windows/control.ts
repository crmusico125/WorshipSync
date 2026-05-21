import { BrowserWindow, shell, screen } from 'electron'
import { electronApp, is } from '@electron-toolkit/utils'
import { join } from 'path'
import { windows } from '../../lib/state'

export function createControlWindow(): void {
  windows.control = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    title: 'WorshipSync',
    backgroundColor: '#0c0c10',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false  // ← allows file:// image loading
    },
    show: false
  })

  windows.control.on('ready-to-show', () => {
    windows.control?.show()
    windows.control?.maximize()
  })

  windows.control.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    windows.control.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    windows.control.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

export function notifyDisplaysChanged(): void {
  const primary = screen.getPrimaryDisplay()
  const displays = screen.getAllDisplays().map(d => ({
    id: d.id,
    label: d.label || `Display ${d.id}`,
    width: d.size.width,
    height: d.size.height,
    isPrimary: d.id === primary.id,
  }))
  windows.control?.webContents.send('window:displaysChanged', displays)
}
