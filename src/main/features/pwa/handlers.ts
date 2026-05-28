import { ipcMain } from 'electron'
import { stage, type PwaLineupItem } from '../../lib/state'
import { broadcastAll } from '../../lib/broadcast'

export function registerPwaHandlers(): void {
  ipcMain.on('pwa:syncLineup', (_event, items: PwaLineupItem[], currentIdx: number) => {
    stage.lineup = items
    stage.currentLineupIdx = currentIdx
    broadcastAll({ type: 'lineup', items, currentIdx })
  })

  ipcMain.on('pwa:broadcastAudioState', (_event, state: typeof stage.audioState) => {
    stage.audioState = state
    if (state) broadcastAll({ type: 'audioState', ...state })
  })

  ipcMain.on('pwa:broadcastVideoState', (_event, state: typeof stage.videoState) => {
    stage.videoState = state
    if (state) broadcastAll({ type: 'videoState', ...state })
  })
}
