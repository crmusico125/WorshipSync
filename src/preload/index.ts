import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('WorshipSync', {

  slide: {
    show: (payload: SlidePayload) => ipcRenderer.send('slide:show', payload),
    blank: (isBlank: boolean) => ipcRenderer.send('slide:blank', isBlank),
    logo: (show: boolean) => ipcRenderer.send('slide:logo', show),

    onShow: (cb: (payload: SlidePayload) => void) => {
      ipcRenderer.on('slide:show', (_e, payload) => cb(payload))
      return () => ipcRenderer.removeAllListeners('slide:show')
    },
    onBlank: (cb: (isBlank: boolean) => void) => {
      ipcRenderer.on('slide:blank', (_e, isBlank) => cb(isBlank))
      return () => ipcRenderer.removeAllListeners('slide:blank')
    },
    onLogo: (cb: (show: boolean) => void) => {
      ipcRenderer.on('slide:logo', (_e, show) => cb(show))
      return () => ipcRenderer.removeAllListeners('slide:logo')
    }
  },

  window: {
    getDisplayCount: () => ipcRenderer.invoke('window:getDisplayCount'),
    openProjection: () => ipcRenderer.send('window:openProjection'),
    closeProjection: () => ipcRenderer.send('window:closeProjection'),
    onProjectionReady: (cb: () => void) => {
      ipcRenderer.on('projection:ready', cb)
      return () => ipcRenderer.removeAllListeners('projection:ready')
    }
  },

  projection: {
    ready: () => ipcRenderer.send('projection:ready')
  }
})

interface SlidePayload {
  lines: string[]
  songTitle: string
  sectionLabel: string
  slideIndex: number
  totalSlides: number
  backgroundPath?: string
  theme?: {
    fontFamily: string
    fontSize: number
    fontWeight: string
    textColor: string
    textAlign: 'left' | 'center' | 'right'
    textPosition: 'top' | 'middle' | 'bottom'
    overlayOpacity: number
    textShadowOpacity: number
    maxLinesPerSlide: number
  }
}