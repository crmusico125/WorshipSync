// ─── Core domain types ────────────────────────────────────────────────────────
// These are shared between the Electron main process and the React renderer
// via the IPC bridge. Keep them serializable (no class instances, no functions).

export type SectionType =
  | 'verse'
  | 'chorus'
  | 'bridge'
  | 'pre-chorus'
  | 'intro'
  | 'outro'
  | 'tag'
  | 'interlude'

export type ServiceStatus = 'empty' | 'in_progress' | 'ready'

export type ScreenMode = 'black' | 'logo' | 'live'

// ─── Song ─────────────────────────────────────────────────────────────────────
export interface Song {
  id: number
  title: string
  artist: string | null
  ccliNumber: string | null
  songKey: string | null
  tempo: string | null
  tags: string[]
  backgroundPath: string | null
  themeId: number | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface Section {
  id: number
  songId: number
  type: SectionType
  label: string       // e.g. "Verse 1", "Chorus"
  lyrics: string
  sortOrder: number
  createdAt: string
}

// Song with its sections pre-loaded (common query shape)
export interface SongWithSections extends Song {
  sections: Section[]
}

// ─── Service date ─────────────────────────────────────────────────────────────
export interface ServiceDate {
  id: number
  date: string        // ISO date string "2025-04-20"
  label: string | null
  status: ServiceStatus
  notes: string | null
  createdAt: string
  updatedAt: string
}

// ─── Lineup ───────────────────────────────────────────────────────────────────
export interface LineupItem {
  id: number
  serviceDateId: number
  songId: number
  sortOrder: number
  backgroundPath: string | null  // override for this service
  themeId: number | null         // override for this service
  createdAt: string
  // Joined data
  song?: Song
  sections?: LineupSection[]
}

export interface LineupSection {
  id: number
  lineupItemId: number
  sectionId: number
  sortOrder: number
  isIncluded: boolean
  // Joined data
  section?: Section
}

// ─── Theme ────────────────────────────────────────────────────────────────────
export interface Theme {
  id: number
  name: string
  type: 'global' | 'seasonal' | 'custom'
  fontFamily: string
  fontSize: number
  fontWeight: string
  textColor: string
  textAlign: 'left' | 'center' | 'right'
  textPosition: 'top' | 'center' | 'bottom'
  overlayOpacity: number
  shadowOpacity: number
  maxLines: number
  lineSpacing: number
  isDefault: boolean
  seasonalStart: string | null
  seasonalEnd: string | null
  createdAt: string
  updatedAt: string
}

// ─── Presenter / live slide data ──────────────────────────────────────────────
export interface SlideData {
  // What to display
  lyrics: string
  sectionLabel: string
  songTitle: string
  slideIndex: number
  totalSlides: number
  // Appearance
  theme: Theme
  backgroundPath: string | null
  // Context for operator panel
  nextLyrics: string | null
}

export interface PresenterState {
  currentServiceDateId: number | null
  currentLineupItemId: number | null
  currentSectionId: number | null
  currentSlideIndex: number
  screenMode: ScreenMode
  isDisplayConnected: boolean
}

// ─── IPC channel names ────────────────────────────────────────────────────────
// Centralized so typos cause compile errors rather than runtime silence
export const IPC = {
  // Songs
  SONGS_GET_ALL:     'songs:get-all',
  SONGS_GET_BY_ID:   'songs:get-by-id',
  SONGS_CREATE:      'songs:create',
  SONGS_UPDATE:      'songs:update',
  SONGS_DELETE:      'songs:delete',
  SONGS_SEARCH:      'songs:search',
  // Sections
  SECTIONS_UPSERT:   'sections:upsert',
  SECTIONS_DELETE:   'sections:delete',
  // Services
  SERVICES_GET_ALL:  'services:get-all',
  SERVICES_GET_BY_ID:'services:get-by-id',
  SERVICES_CREATE:   'services:create',
  SERVICES_UPDATE:   'services:update',
  SERVICES_DELETE:   'services:delete',
  // Lineup
  LINEUP_GET:        'lineup:get',
  LINEUP_ADD_SONG:   'lineup:add-song',
  LINEUP_REMOVE_SONG:'lineup:remove-song',
  LINEUP_REORDER:    'lineup:reorder',
  LINEUP_TOGGLE_SECTION: 'lineup:toggle-section',
  LINEUP_REORDER_SECTIONS: 'lineup:reorder-sections',
  // Themes
  THEMES_GET_ALL:    'themes:get-all',
  THEMES_CREATE:     'themes:create',
  THEMES_UPDATE:     'themes:update',
  THEMES_DELETE:     'themes:delete',
  // Presenter
  PRESENTER_SHOW_SLIDE:    'presenter:show-slide',
  PRESENTER_SET_SCREEN:    'presenter:set-screen',
  PRESENTER_OPEN_DISPLAY:  'presenter:open-display',
  PRESENTER_CLOSE_DISPLAY: 'presenter:close-display',
  PRESENTER_GET_DISPLAY_CONNECTED: 'presenter:get-display-connected',
  // Display window receives
  DISPLAY_SHOW_SLIDE:  'display:show-slide',
  DISPLAY_SET_SCREEN:  'display:set-screen',
  // Usage / analytics
  USAGE_LOG:           'usage:log',
  USAGE_GET_STATS:     'usage:get-stats',
} as const

// ─── IPC payload types ────────────────────────────────────────────────────────
export interface CreateSongPayload {
  title: string
  artist?: string
  ccliNumber?: string
  songKey?: string
  tempo?: string
  tags?: string[]
  backgroundPath?: string
  themeId?: number
  notes?: string
  sections: Array<{
    type: SectionType
    label: string
    lyrics: string
    sortOrder: number
  }>
}

export interface UpdateSongPayload extends Partial<CreateSongPayload> {
  id: number
}

export interface CreateServicePayload {
  date: string
  label?: string
  notes?: string
}

export interface AddSongToLineupPayload {
  serviceDateId: number
  songId: number
  sortOrder?: number
}