import type { Song, Section, SlidePayload } from '../../../shared/types'

interface SongWithSections extends Song {
  sections: Section[]
}

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
  songId: number
  orderIndex: number
  selectedSections: string
  overrideThemeId: number | null
  overrideBackgroundPath: string | null
  song: SongWithSections
}

declare global {
  interface Window {
    worshipsync: {
      slide: {
        show: (payload: SlidePayload) => void
        blank: (isBlank: boolean) => void
        logo: (show: boolean) => void
        onShow: (cb: (payload: SlidePayload) => void) => () => void
        onBlank: (cb: (isBlank: boolean) => void) => () => void
        onLogo: (cb: (show: boolean) => void) => () => void
      }
      window: {
        getDisplayCount: () => Promise<number>
        openProjection: () => void
        closeProjection: () => void
        onProjectionReady: (cb: () => void) => () => void
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
        getAll:       () => Promise<ServiceDate[]>
        getByDate:    (date: string) => Promise<ServiceDate | null>
        create:       (data: unknown) => Promise<ServiceDate>
        updateStatus: (id: number, status: string) => Promise<ServiceDate>
        delete:       (id: number) => Promise<boolean>
      }
      lineup: {
        getForService:  (serviceDateId: number) => Promise<LineupItemWithSong[]>
        addSong:        (serviceDateId: number, songId: number) => Promise<unknown>
        removeSong:     (lineupItemId: number) => Promise<boolean>
        reorder:        (serviceDateId: number, ids: number[]) => Promise<boolean>
        toggleSection:  (lineupItemId: number, sectionId: number, included: boolean) => Promise<number[]>
      }
    }
  }
}

export {}