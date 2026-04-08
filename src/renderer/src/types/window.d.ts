import type { Song, Section, SlidePayload } from '../../../shared/types'

interface SongWithSections extends Song {
  sections: Section[]
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
    }
  }
}

export {}