import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('worshipsync', {

  slide: {
    show: (payload: SlidePayload) => ipcRenderer.send('slide:show', payload),
    blank: (isBlank: boolean, position?: { lineupItemId: number; slideIndex: number }) =>
      ipcRenderer.send('slide:blank', isBlank, position),
    logo: (show: boolean) => ipcRenderer.send('slide:logo', show),
    countdown: (data: { targetTime: string; running: boolean; firstUp?: { title: string; artist?: string; sectionLabel: string } }) => ipcRenderer.send('slide:countdown', data),
    videoControl: (action: 'play' | 'pause' | 'stop') => ipcRenderer.send('slide:videoControl', action),
    videoSeek: (time: number) => ipcRenderer.send('slide:videoSeek', time),
    videoLoop: (loop: boolean) => ipcRenderer.send('slide:videoLoop', loop),
    stageNext: (data: { nextLines: string[]; nextSectionLabel: string; nextItemType?: string }) => ipcRenderer.send('slide:stageNext', data),
    confidenceHint: (payload: SlidePayload) => ipcRenderer.send('slide:confidenceHint', payload),
    onStageNext: (cb: (data: { nextLines: string[]; nextSectionLabel: string; nextItemType?: string }) => void) => {
      ipcRenderer.on('slide:stageNext', (_e, data) => cb(data))
      return () => ipcRenderer.removeAllListeners('slide:stageNext')
    },

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
    },
    onCountdown: (cb: (data: { targetTime: string; running: boolean; firstUp?: { title: string; artist?: string; sectionLabel: string } }) => void) => {
      ipcRenderer.on('slide:countdown', (_e, data) => cb(data))
      return () => ipcRenderer.removeAllListeners('slide:countdown')
    },
    onVideoControl: (cb: (action: 'play' | 'pause' | 'stop') => void) => {
      ipcRenderer.on('slide:videoControl', (_e, action) => cb(action))
      return () => ipcRenderer.removeAllListeners('slide:videoControl')
    },
    onVideoSeek: (cb: (time: number) => void) => {
      ipcRenderer.on('slide:videoSeek', (_e, time) => cb(time))
      return () => ipcRenderer.removeAllListeners('slide:videoSeek')
    },
    onVideoLoop: (cb: (loop: boolean) => void) => {
      ipcRenderer.on('slide:videoLoop', (_e, loop) => cb(loop))
      return () => ipcRenderer.removeAllListeners('slide:videoLoop')
    },
    onAudioState: (cb: (state: { isPlaying: boolean; currentTime: number; duration: number; lineupItemId: number } | null) => void) => {
      ipcRenderer.on('slide:audioState', (_e, state) => cb(state))
      return () => ipcRenderer.removeAllListeners('slide:audioState')
    },
    onVideoState: (cb: (state: { isPlaying: boolean; currentTime: number; duration: number; lineupItemId: number } | null) => void) => {
      ipcRenderer.on('slide:videoState', (_e, state) => cb(state))
      return () => ipcRenderer.removeAllListeners('slide:videoState')
    },
  },

  window: {
    getDisplayCount: () => ipcRenderer.invoke('window:getDisplayCount'),
    getDisplays: () => ipcRenderer.invoke('window:getDisplays') as Promise<
      { id: number; label: string; width: number; height: number; isPrimary: boolean }[]
    >,
    openProjection: (displayId?: number) => ipcRenderer.send('window:openProjection', displayId),
    moveProjection: (displayId: number) => ipcRenderer.send('window:moveProjection', displayId),
    closeProjection: () => ipcRenderer.send('window:closeProjection'),
    onProjectionReady: (cb: () => void) => {
      ipcRenderer.on('projection:ready', cb)
      return () => ipcRenderer.removeAllListeners('projection:ready')
    },
    onProjectionClosed: (cb: () => void) => {
      ipcRenderer.on('window:projectionClosed', cb)
      return () => ipcRenderer.removeListener('window:projectionClosed', cb)
    },
    onDisplaysChanged: (cb: (displays: { id: number; label: string; width: number; height: number; isPrimary: boolean }[]) => void) => {
      ipcRenderer.on('window:displaysChanged', (_e, displays) => cb(displays))
      return () => ipcRenderer.removeAllListeners('window:displaysChanged')
    }
  },

  projection: {
    ready: () => ipcRenderer.send('projection:ready')
  },
  
  songs: {
    getAll:   ()                => ipcRenderer.invoke('songs:getAll'),
    search:   (q: string)      => ipcRenderer.invoke('songs:search', q),
    getById:  (id: number)     => ipcRenderer.invoke('songs:getById', id),
    create:   (data: unknown)  => ipcRenderer.invoke('songs:create', data),
    update:   (id: number, data: unknown) => ipcRenderer.invoke('songs:update', id, data),
    delete:   (id: number)     => ipcRenderer.invoke('songs:delete', id),
    upsertSections: (songId: number, sections: unknown[]) =>
        ipcRenderer.invoke('sections:upsert', songId, sections)
  },
  services: {
    getAll:        ()                                          => ipcRenderer.invoke('services:getAll'),
    getByDate:     (date: string)                              => ipcRenderer.invoke('services:getByDate', date),
    create:        (data: unknown)                             => ipcRenderer.invoke('services:create', data),
    update:        (id: number, data: { label?: string; date?: string }) => ipcRenderer.invoke('services:update', id, data),
    updateStatus:  (id: number, status: string)               => ipcRenderer.invoke('services:updateStatus', id, status),
    delete:        (id: number)                               => ipcRenderer.invoke('services:delete', id),
    getAllWithCounts: ()                                       => ipcRenderer.invoke('services:getAllWithCounts'),
    getRecent:       ()           => ipcRenderer.invoke('services:getRecent'),
    search:          (q: string)  => ipcRenderer.invoke('services:search', q),
    },

  lineup: {
    getForService:  (serviceDateId: number)                    => ipcRenderer.invoke('lineup:getForService', serviceDateId),
    addSong:        (serviceDateId: number, songId: number)    => ipcRenderer.invoke('lineup:addSong', serviceDateId, songId),
    addCountdown:   (serviceDateId: number)                    => ipcRenderer.invoke('lineup:addCountdown', serviceDateId),
    addScripture:   (serviceDateId: number, data: { title: string; scriptureRef: string }) =>
                        ipcRenderer.invoke('lineup:addScripture', serviceDateId, data),
    addMedia:       (serviceDateId: number, data: { title: string; mediaPath: string; imageScaleMode?: 'cover' | 'contain' | 'stretch' }) =>
                        ipcRenderer.invoke('lineup:addMedia', serviceDateId, data),
    addAnnouncement: (serviceDateId: number, data: { title: string; content: string }) =>
                        ipcRenderer.invoke('lineup:addAnnouncement', serviceDateId, data),
    addSection:      (serviceDateId: number, data: { title: string }) =>
                        ipcRenderer.invoke('lineup:addSection', serviceDateId, data),
    updateAnnouncement: (lineupItemId: number, data: { title?: string; content?: string }) =>
                        ipcRenderer.invoke('lineup:updateAnnouncement', lineupItemId, data),
    updateScripture:    (lineupItemId: number, data: { title?: string; scriptureRef?: string }) =>
                        ipcRenderer.invoke('lineup:updateScripture', lineupItemId, data),
    removeSong:     (lineupItemId: number)                     => ipcRenderer.invoke('lineup:removeSong', lineupItemId),
    reorder:        (serviceDateId: number, ids: number[])     => ipcRenderer.invoke('lineup:reorder', serviceDateId, ids),
    toggleSection:  (lineupItemId: number, sectionId: number, included: boolean) =>
                        ipcRenderer.invoke('lineup:toggleSection', lineupItemId, sectionId, included),
    setSections:    (lineupItemId: number, sectionIds: number[]) =>
                        ipcRenderer.invoke('lineup:setSections', lineupItemId, sectionIds),
    setNotes:       (lineupItemId: number, notes: string) =>
                        ipcRenderer.invoke('lineup:setNotes', lineupItemId, notes),
    setOverrideBg:    (lineupItemId: number, path: string | null) =>
                          ipcRenderer.invoke('lineup:setOverrideBg', lineupItemId, path),
    setSectionOrder:  (lineupItemId: number, sectionIds: number[]) =>
                          ipcRenderer.invoke('lineup:setSectionOrder', lineupItemId, sectionIds),
    setItemStyle:      (lineupItemId: number, style: string) =>
                          ipcRenderer.invoke('lineup:setItemStyle', lineupItemId, style),
    setImageScaleMode: (lineupItemId: number, mode: 'cover' | 'contain' | 'stretch') =>
                          ipcRenderer.invoke('lineup:setImageScaleMode', lineupItemId, mode),
  },
  themes: {
    getAll:     ()                    => ipcRenderer.invoke('themes:getAll'),
    getDefault: ()                    => ipcRenderer.invoke('themes:getDefault'),
    create:     (data: unknown)       => ipcRenderer.invoke('themes:create', data),
    update:     (id: number, data: unknown) => ipcRenderer.invoke('themes:update', id, data),
    delete:     (id: number)          => ipcRenderer.invoke('themes:delete', id),
  },

  analytics: {
    getSongUsage:     ()                                          => ipcRenderer.invoke('analytics:getSongUsage'),
    getServiceHistory: ()                                         => ipcRenderer.invoke('analytics:getServiceHistory'),
    recordUsage:      (songId: number, serviceDateId: number)    => ipcRenderer.invoke('analytics:recordUsage', songId, serviceDateId),
  },
  backgrounds: {
    getDir:      ()               => ipcRenderer.invoke('backgrounds:getDir'),
    pickImage:   ()               => ipcRenderer.invoke('backgrounds:pickImage'),
    pickImages:  ()               => ipcRenderer.invoke('backgrounds:pickImages') as Promise<string[]>,
    setBackground: (songId: number, path: string | null) =>
      ipcRenderer.invoke('songs:setBackground', songId, path),
    listImages: () => ipcRenderer.invoke('backgrounds:listImages'),
    getUsageCount: (imagePath: string) => ipcRenderer.invoke('backgrounds:getUsageCount', imagePath),
    getUsingSongs: (imagePath: string) => ipcRenderer.invoke('backgrounds:getUsingSongs', imagePath),
    getUsingServices: (imagePath: string) => ipcRenderer.invoke('backgrounds:getUsingServices', imagePath),
    deleteImage:   (imagePath: string) => ipcRenderer.invoke('backgrounds:deleteImage', imagePath),
  },
  appState: {
    get:              ()                          => ipcRenderer.invoke('app:getState'),
    set:              (data: Record<string, any>) => ipcRenderer.invoke('app:setState', data),
    getTodayService:  ()                          => ipcRenderer.invoke('app:getTodayService'),
  },
  data: {
    export: () => ipcRenderer.invoke('data:export'),
    import: () => ipcRenderer.invoke('data:import'),
  },
  stageDisplay: {
    start:        (port?: number) => ipcRenderer.invoke('stageDisplay:start', port),
    stop:         ()              => ipcRenderer.invoke('stageDisplay:stop'),
    getStatus:    ()              => ipcRenderer.invoke('stageDisplay:getStatus'),
    sessionStart: ()              => ipcRenderer.invoke('stageDisplay:sessionStart'),
    sessionEnd:   ()              => ipcRenderer.invoke('stageDisplay:sessionEnd'),
  },
  confidence: {
    open:      (displayId?: number) => ipcRenderer.send('window:openConfidence', displayId),
    move:      (displayId: number)  => ipcRenderer.send('window:moveConfidence', displayId),
    close:     ()                   => ipcRenderer.send('window:closeConfidence'),
    isOpen:    ()                   => ipcRenderer.invoke('window:getConfidenceOpen') as Promise<boolean>,
    ready:     ()                   => ipcRenderer.send('confidence:ready'),
    onClosed:  (cb: () => void) => {
      ipcRenderer.on('window:confidenceClosed', cb)
      return () => ipcRenderer.removeListener('window:confidenceClosed', cb)
    },
  },

  pwa: {
    syncLineup: (items: unknown[], currentIdx: number, serviceDate: string | null, serviceTime: string | null) =>
      ipcRenderer.send('pwa:syncLineup', items, currentIdx, serviceDate, serviceTime),
    onStateUpdate: (cb: (update: unknown) => void) => {
      ipcRenderer.on('pwa:stateUpdate', (_e, update) => cb(update))
      return () => ipcRenderer.removeAllListeners('pwa:stateUpdate')
    },
    onAudioCmd: (cb: (data: unknown) => void) => {
      ipcRenderer.on('pwa:audioCmd', (_e, data) => cb(data))
      return () => ipcRenderer.removeAllListeners('pwa:audioCmd')
    },
    broadcastAudioState: (state: unknown) =>
      ipcRenderer.send('pwa:broadcastAudioState', state),
    onVideoCmd: (cb: (data: unknown) => void) => {
      ipcRenderer.on('pwa:videoCmd', (_e, data) => cb(data))
      return () => ipcRenderer.removeAllListeners('pwa:videoCmd')
    },
    broadcastVideoState: (state: unknown) =>
      ipcRenderer.send('pwa:broadcastVideoState', state),
    onCountdownCmd: (cb: (action: string) => void) => {
      ipcRenderer.on('pwa:countdownCmd', (_e, action) => cb(action))
      return () => ipcRenderer.removeAllListeners('pwa:countdownCmd')
    },
  },
})

interface SlidePayload {
  lines: string[]
  songTitle: string
  artist?: string
  sectionLabel: string
  sectionType?: string
  itemType?: string
  slideIndex: number
  totalSlides: number
  backgroundPath?: string
  nextLines?: string[]
  nextSectionLabel?: string
  nextItemType?: string
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