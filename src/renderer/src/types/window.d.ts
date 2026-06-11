import type { Song, Section, SlidePayload, SongWithSections } from '../../../shared/types'

interface ServiceDate {
  id: number
  date: string
  label: string
  status: 'empty' | 'in-progress' | 'ready'
  notes: string | null
  createdAt: string
  updatedAt: string
}

interface LineupItemWithSong {
  id: number
  serviceDateId: number
  songId: number | null
  itemType: 'song' | 'countdown' | 'scripture' | 'media' | 'announcement' | 'note' | 'section'
  orderIndex: number
  selectedSections: string
  overrideThemeId: number | null
  overrideBackgroundPath: string | null
  notes: string | null
  title: string | null
  scriptureRef: string | null
  mediaPath: string | null
  sectionOrder: string | null
  itemStyle: string | null
  imageScaleMode: 'cover' | 'contain' | 'stretch' | null
  song: SongWithSections | null
}
interface Theme {
  id: number
  name: string
  type: 'global' | 'seasonal' | 'per-song'
  isDefault: boolean
  seasonStart: string | null
  seasonEnd: string | null
  settings: string
  createdAt: string
}

interface ThemeSettings {
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

interface SongWithUsage extends Song {
  usageCount: number
  lastUsedDate: string | null
  lastUsedLabel: string | null
}

interface TodayServiceResult {
  service: ServiceDate
  daysAway: number
}

declare global {
  interface Window {
    worshipsync: {
      slide: {
        show: (payload: SlidePayload) => void
        blank: (isBlank: boolean, position?: { lineupItemId: number; slideIndex: number }) => void
        logo: (show: boolean) => void
        countdown: (data: { targetTime: string; running: boolean; firstUp?: { title: string; artist?: string; sectionLabel: string } }) => void
        videoControl: (action: 'play' | 'pause' | 'stop') => void
        videoSeek: (time: number) => void
        videoLoop: (loop: boolean) => void
        stageNext: (data: { nextLines: string[]; nextSectionLabel: string }) => void
        confidenceHint: (payload: import('../../../../../shared/types').SlidePayload) => void
        onStageNext: (cb: (data: { nextLines: string[]; nextSectionLabel: string }) => void) => () => void
        onShow: (cb: (payload: SlidePayload) => void) => () => void
        onBlank: (cb: (isBlank: boolean) => void) => () => void
        onLogo: (cb: (show: boolean) => void) => () => void
        onCountdown: (cb: (data: { targetTime: string; running: boolean; firstUp?: { title: string; artist?: string; sectionLabel: string } }) => void) => () => void
        onVideoControl: (cb: (action: 'play' | 'pause' | 'stop') => void) => () => void
        onVideoSeek: (cb: (time: number) => void) => () => void
        onVideoLoop: (cb: (loop: boolean) => void) => () => void
        onAudioState: (cb: (state: { isPlaying: boolean; currentTime: number; duration: number; lineupItemId: number } | null) => void) => () => void
        onVideoState: (cb: (state: { isPlaying: boolean; currentTime: number; duration: number; lineupItemId: number } | null) => void) => () => void
      }
      window: {
        getDisplayCount: () => Promise<number>
        getDisplays: () => Promise<
          { id: number; label: string; width: number; height: number; isPrimary: boolean }[]
        >
        openProjection: (displayId?: number) => void
        moveProjection: (displayId: number) => void
        closeProjection: () => void
        onProjectionReady: (cb: () => void) => () => void
        onProjectionClosed: (cb: () => void) => () => void
        onDisplaysChanged: (cb: (displays: { id: number; label: string; width: number; height: number; isPrimary: boolean }[]) => void) => () => void
      }
      projection: {
        ready: () => void
      }
      songs: {
        getAll:         () => Promise<Song[]>
        search:         (q: string) => Promise<Song[]>
        getById:        (id: number) => Promise<SongWithSections | null>
        create:         (data: unknown) => Promise<Song>
        update:         (id: number, data: unknown) => Promise<Song>
        delete:         (id: number) => Promise<boolean>
        upsertSections: (songId: number, sections: unknown[]) => Promise<Section[]>
      }
      services: {
        getAll:           () => Promise<ServiceDate[]>
        getAllWithCounts:  () => Promise<(ServiceDate & { itemCount: number })[]>
        getRecent:        () => Promise<ServiceDate[]>
        search:           (q: string) => Promise<ServiceDate[]>
        getByDate:        (date: string) => Promise<ServiceDate | null>
        create:           (data: unknown) => Promise<ServiceDate>
        update:           (id: number, data: { label?: string; date?: string }) => Promise<ServiceDate>
        updateStatus:     (id: number, status: string) => Promise<ServiceDate>
        delete:           (id: number) => Promise<boolean>
      }
      lineup: {
        getForService:  (serviceDateId: number) => Promise<LineupItemWithSong[]>
        addSong:        (serviceDateId: number, songId: number) => Promise<unknown>
        addCountdown:   (serviceDateId: number) => Promise<unknown>
        addScripture:   (serviceDateId: number, data: { title: string; scriptureRef: string }) => Promise<unknown>
        addMedia:       (serviceDateId: number, data: { title: string; mediaPath: string; imageScaleMode?: 'cover' | 'contain' | 'stretch' }) => Promise<unknown>
        removeSong:     (lineupItemId: number) => Promise<boolean>
        reorder:        (serviceDateId: number, ids: number[]) => Promise<boolean>
        toggleSection:  (lineupItemId: number, sectionId: number, included: boolean) => Promise<number[]>
        setSections:    (lineupItemId: number, sectionIds: number[]) => Promise<number[]>
        setNotes:       (lineupItemId: number, notes: string) => Promise<boolean>
        setOverrideBg:      (lineupItemId: number, path: string | null) => Promise<boolean>
        setSectionOrder:    (lineupItemId: number, sectionIds: number[]) => Promise<boolean>
        addAnnouncement:    (serviceDateId: number, data: { title: string; content: string }) => Promise<unknown>
        addSection:         (serviceDateId: number, data: { title: string }) => Promise<unknown>
        updateAnnouncement: (lineupItemId: number, data: { title?: string; content?: string }) => Promise<boolean>
        updateScripture:    (lineupItemId: number, data: { title?: string; scriptureRef?: string }) => Promise<boolean>
        setItemStyle:       (lineupItemId: number, style: string) => Promise<boolean>
        setImageScaleMode:  (lineupItemId: number, mode: 'cover' | 'contain' | 'stretch') => Promise<boolean>
      }
      themes: {
        getAll:     () => Promise<Theme[]>
        getDefault: () => Promise<Theme | null>
        create:     (data: unknown) => Promise<Theme>
        update:     (id: number, data: unknown) => Promise<Theme>
        delete:     (id: number) => Promise<boolean>
      }
      analytics: {
        getSongUsage:      () => Promise<SongWithUsage[]>
        getServiceHistory: () => Promise<ServiceDate[]>
        recordUsage:       (songId: number, serviceDateId: number) => Promise<unknown>
      }
      backgrounds: {
        getDir:        () => Promise<string>
        pickImage:     () => Promise<string | null>
        pickImages:    () => Promise<string[]>
        setBackground: (songId: number, path: string | null) => Promise<Song>
        listImages: () => Promise<string[]>
        getUsageCount: (imagePath: string) => Promise<number>
        getUsingSongs: (imagePath: string) => Promise<{ id: number; title: string; artist: string }[]>
        getUsingServices: (imagePath: string) => Promise<{ id: number; date: string; label: string }[]>
        deleteImage:   (imagePath: string) => Promise<boolean>
      }
      appState: {
        get:             () => Promise<Record<string, any>>
        set:             (data: Record<string, any>) => Promise<boolean>
        getTodayService: () => Promise<TodayServiceResult | null>
      }
      stageDisplay: {
        start:     (port?: number) => Promise<{ ok: boolean; url: string; port: number }>
        stop:      ()              => Promise<boolean>
        getStatus: ()              => Promise<{
          running: boolean
          url: string
          mdnsUrl: string
          port: number
          clients: number
          localIP: string
          allIPs: { label: string; ip: string; url: string }[]
          stageClients: number
          pwaClients: number
          clientList: { ip: string; device: string; connectedAt: number; connectedForSeconds: number; type: 'stage' | 'pwa' }[]
        }>
        sessionStart: () => Promise<{ ok: boolean; url: string; port: number }>
        sessionEnd:   () => Promise<boolean>
      }
      confidence: {
        open:     (displayId?: number) => void
        move:     (displayId: number)  => void
        close:    ()                   => void
        isOpen:   ()                   => Promise<boolean>
        ready:    ()                   => void
        onClosed: (cb: () => void)     => () => void
      }
      pwa: {
        syncLineup: (items: PwaLineupItem[], currentIdx: number, serviceDate: string | null, serviceTime: string | null) => void
        onStateUpdate: (cb: (update: PwaStateUpdate) => void) => () => void
        onAudioCmd: (cb: (data: { action: string; lineupItemId: number }) => void) => () => void
        broadcastAudioState: (state: { isPlaying: boolean; currentTime: number; duration: number; lineupItemId: number } | null) => void
        onVideoCmd: (cb: (data: { action: string; lineupItemId: number }) => void) => () => void
        broadcastVideoState: (state: { isPlaying: boolean; currentTime: number; duration: number; lineupItemId: number } | null) => void
        onCountdownCmd: (cb: (action: string) => void) => () => void
      }
    }
  }
}

interface PwaLineupItem {
  id: number
  itemType: string
  title: string
  slides: Array<{ idx: number; sectionLabel: string; sectionType: string; lines: string[] }>
  mediaPath?: string | null
  backgroundPath?: string | null
  theme?: Record<string, unknown> | null
}

type PwaStateUpdate =
  | { type: 'slide'; lineupIdx: number; slideIdx: number }
  | { type: 'blank'; isBlank: boolean }
  | { type: 'logo'; isLogo: boolean }

export {}