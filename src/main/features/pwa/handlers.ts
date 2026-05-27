import { ipcMain } from 'electron'
import { stage, type PwaLineupItem } from '../../lib/state'
import { broadcastAll } from '../../lib/broadcast'

export function registerPwaHandlers(): void {
  // Renderer calls this whenever liveSongs or selectedSongIdx changes
  ipcMain.on('pwa:syncLineup', (_event, items: PwaLineupItem[], currentIdx: number) => {
    stage.lineup = items
    stage.currentLineupIdx = currentIdx
    broadcastAll({ type: 'lineup', items, currentIdx })
  })
}
