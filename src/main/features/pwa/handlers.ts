import { ipcMain } from 'electron'
import { windows, stage, type PwaLineupItem } from '../../lib/state'
import { broadcastPwa } from '../../lib/broadcast'

export function registerPwaHandlers(): void {
  ipcMain.on('pwa:syncLineup', (_event, items: PwaLineupItem[], currentIdx: number, serviceDate: string | null, serviceTime: string | null) => {
    stage.lineup = items
    stage.currentLineupIdx = currentIdx
    stage.serviceDate = serviceDate ?? null
    stage.serviceTime = serviceTime ?? null
    broadcastPwa({ type: 'lineup', items, currentIdx, serviceDate, serviceTime })
  })

  ipcMain.on('pwa:broadcastAudioState', (_event, state: typeof stage.audioState) => {
    stage.audioState = state
    if (state) broadcastPwa({ type: 'audioState', ...state })
    if (windows.confidence && !windows.confidence.isDestroyed()) {
      windows.confidence.webContents.send('slide:audioState', state)
    }
  })

  ipcMain.on('pwa:broadcastVideoState', (_event, state: typeof stage.videoState) => {
    stage.videoState = state
    if (state) broadcastPwa({ type: 'videoState', ...state })
    if (windows.confidence && !windows.confidence.isDestroyed()) {
      windows.confidence.webContents.send('slide:videoState', state)
    }
  })
}
