export type AppScreen =
  | "overview"
  | "planner"
  | "service"
  | "library"
  | "media"
  | "themes"
  | "analytics"
  | "settings"
  | "bible"

export interface Song {
  id: number
  title: string
  artist: string
  key: string | null
  tempo: string | null
  ccliNumber: string | null
  copyright: string | null
  backgroundPath: string | null
  themeId: number | null
  tags: string
  createdAt: string
  updatedAt: string
}

export interface Section {
  id: number
  songId: number
  type: string
  label: string
  lyrics: string
  orderIndex: number
}

export interface SongWithSections extends Song {
  sections: Section[]
}

export interface AnnouncementCard {
  id: string
  heading: string
  day?: string
  time?: string
  location?: string
  description?: string
}

export interface SlidePayload {
  lines: string[]
  songTitle: string
  sectionLabel: string
  sectionType?: string
  itemType?: string
  artist?: string
  slideIndex?: number
  totalSlides?: number
  lineupItemId?: number
  backgroundPath?: string | null
  nextLines?: string[]
  nextSectionLabel?: string
  announcementCards?: AnnouncementCard[]
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
    backgroundScaleMode?: 'cover' | 'contain' | 'stretch'
    accentColor?: string
  }
}
