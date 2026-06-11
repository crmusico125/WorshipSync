import { ipcMain } from 'electron'
import { windows, stage } from '../../lib/state'
import { broadcastAll } from '../../lib/broadcast'

function nextLinesFromLineup(
  lineupIdx: number,
  slideIndex: number | undefined,
): { nextLines: string[]; nextSectionLabel: string } | null {
  const item = stage.lineup[lineupIdx]
  if (!item) return null

  const curPos = slideIndex !== undefined
    ? item.slides.findIndex(s => s.idx === slideIndex)
    : -1

  const nextInItem = curPos >= 0 ? item.slides[curPos + 1] : undefined
  if (nextInItem) {
    return { nextLines: nextInItem.lines, nextSectionLabel: nextInItem.sectionLabel ?? '' }
  }

  for (let k = lineupIdx + 1; k < stage.lineup.length; k++) {
    const ni = stage.lineup[k]
    if (ni.slides.length > 0) {
      return { nextLines: ni.slides[0].lines, nextSectionLabel: `${ni.title} — ${ni.slides[0].sectionLabel ?? ''}` }
    }
  }
  return null
}

export function registerSlideHandlers(): void {
  ipcMain.on('slide:show', (_event, payload) => {
    if (windows.projection && !windows.projection.isDestroyed()) {
      windows.projection.webContents.send('slide:show', payload)
    }

    // Derive lineup context first so nextLinesFromLineup uses the updated index
    const lineupItemId = (payload as any).lineupItemId as number | undefined
    const slideIndex   = (payload as any).slideIndex   as number | undefined
    if (lineupItemId !== undefined) {
      const idx = stage.lineup.findIndex(i => i.id === lineupItemId)
      if (idx !== -1) stage.currentLineupIdx = idx
    }

    // Augment the payload for the confidence window with next lines computed from
    // stage.lineup (the same source the stage display uses).  This guarantees
    // payload.nextLines is always present when onShow fires, regardless of whether
    // sendSlide computed them or whether IPC serialisation stripped them.
    if (windows.confidence && !windows.confidence.isDestroyed()) {
      const next = nextLinesFromLineup(stage.currentLineupIdx, slideIndex)
      const confidencePayload = next
        ? { ...payload, nextLines: next.nextLines, nextSectionLabel: next.nextSectionLabel }
        : payload
      windows.confidence.webContents.send('slide:show', confidencePayload)
    }

    stage.slide = payload
    stage.blank = false
    stage.nextLines = null
    stage.nextLabel = ''

    broadcastAll({ type: 'slide', payload, lineupIdx: stage.currentLineupIdx, slideIdx: slideIndex ?? -1 })
  })

  ipcMain.on('slide:blank', (_event, isBlank: boolean, position?: { lineupItemId: number; slideIndex: number }) => {
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
    if (isBlank) {
      // Include the blank slide's position so the PWA controller's slide grid
      // highlight and lineup selection move onto it too, matching the desktop
      // presenter (otherwise the PWA stays highlighted on the prior slide).
      const lineupIdx = position
        ? stage.lineup.findIndex(i => i.id === position.lineupItemId)
        : -1
      if (lineupIdx !== -1 && position) {
        stage.currentLineupIdx = lineupIdx
        broadcastAll({ type: 'blank', isBlank: true, lineupIdx, slideIdx: position.slideIndex })
      } else {
        broadcastAll({ type: 'blank', isBlank: true })
      }
    }
  })

  // Updates the stage display and confidence monitor "next" section.
  // Called when the blank slide is active so both can still show what's coming next.
  ipcMain.on('slide:stageNext', (_event, data: { nextLines: string[]; nextSectionLabel: string }) => {
    stage.nextLines = data.nextLines
    stage.nextLabel = data.nextSectionLabel
    broadcastAll({ type: 'stageNext', nextLines: data.nextLines, nextSectionLabel: data.nextSectionLabel })
    if (windows.confidence && !windows.confidence.isDestroyed()) {
      windows.confidence.webContents.send('slide:stageNext', data)
    }
  })

  // Sends a slide payload only to the confidence window — does not touch projection.
  // Used for audio items where the projection stays blank but the monitor needs context.
  ipcMain.on('slide:confidenceHint', (_event, payload) => {
    if (windows.confidence && !windows.confidence.isDestroyed()) {
      windows.confidence.webContents.send('slide:show', payload)
    }
  })

  ipcMain.on('slide:logo', (_event, show: boolean) => {
    windows.projection?.webContents.send('slide:logo', show)
    stage.logo = show
    broadcastAll({ type: 'logo', isLogo: show })
  })

  ipcMain.on('slide:countdown', (_event, data: { targetTime: string; running: boolean; firstUp?: { title: string; artist?: string; sectionLabel: string } }) => {
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
