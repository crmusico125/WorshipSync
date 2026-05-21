import { ipcMain } from 'electron'
import { windows, stage } from '../../lib/state'
import { broadcastAll } from '../../lib/broadcast'

export function registerSlideHandlers(): void {
  ipcMain.on('slide:show', (_event, payload) => {
    if (windows.projection && !windows.projection.isDestroyed()) {
      windows.projection.webContents.send('slide:show', payload)
    }
    if (windows.confidence && !windows.confidence.isDestroyed()) {
      windows.confidence.webContents.send('slide:show', payload)
    }
    stage.slide = payload
    stage.blank = false
    stage.nextLines = null
    stage.nextLabel = ''
    broadcastAll({ type: 'slide', payload })
  })

  ipcMain.on('slide:blank', (_event, isBlank: boolean) => {
    if (windows.projection && !windows.projection.isDestroyed()) {
      windows.projection.webContents.send('slide:blank', isBlank)
    }
    if (windows.confidence && !windows.confidence.isDestroyed()) {
      windows.confidence.webContents.send('slide:blank', isBlank)
    }
    stage.blank = isBlank
    // blank=true → broadcast immediately.
    // blank=false → the subsequent slide:show already implies unblank on the client;
    // no separate broadcast needed (avoids a double repaint on slow devices).
    if (isBlank) broadcastAll({ type: 'blank', isBlank: true })
  })

  // Updates the stage display "next" section only — does not affect projection or confidence windows.
  // Used when the blank slide is active so operators can still see what's coming next.
  ipcMain.on('slide:stageNext', (_event, data: { nextLines: string[]; nextSectionLabel: string }) => {
    stage.nextLines = data.nextLines
    stage.nextLabel = data.nextSectionLabel
    broadcastAll({ type: 'stageNext', nextLines: data.nextLines, nextSectionLabel: data.nextSectionLabel })
  })

  ipcMain.on('slide:logo', (_event, show: boolean) => {
    windows.projection?.webContents.send('slide:logo', show)
  })

  ipcMain.on('slide:countdown', (_event, data: { targetTime: string; running: boolean }) => {
    if (windows.projection && !windows.projection.isDestroyed()) {
      windows.projection.webContents.send('slide:countdown', data)
    }
    if (windows.confidence && !windows.confidence.isDestroyed()) {
      windows.confidence.webContents.send('slide:countdown', data)
    }
    stage.countdown = data
    broadcastAll({ type: 'countdown', data })
  })

  ipcMain.on('slide:videoControl', (_event, action: 'play' | 'pause' | 'stop') => {
    if (windows.projection && !windows.projection.isDestroyed()) {
      windows.projection.webContents.send('slide:videoControl', action)
    }
  })

  ipcMain.on('slide:videoSeek', (_event, time: number) => {
    if (windows.projection && !windows.projection.isDestroyed()) {
      windows.projection.webContents.send('slide:videoSeek', time)
    }
  })

  ipcMain.on('slide:videoLoop', (_event, loop: boolean) => {
    if (windows.projection && !windows.projection.isDestroyed()) {
      windows.projection.webContents.send('slide:videoLoop', loop)
    }
  })
}
