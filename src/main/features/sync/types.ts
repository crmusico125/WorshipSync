export type MediaKind = 'image' | 'audio' | 'video'

export const PACKAGE_FORMAT_VERSION = 1
export const SCHEMA_VERSION = 1

export interface PackageManifest {
  packageId: string // = the service's sync_uuid
  version: number
  packageFormatVersion: number
  schemaVersion: number
  minAppVersion: string
  title: string
  serviceDate: string
  publishedAt: string
  publishedByDeviceId: string
  publishedByDeviceName: string
  counts: { songs: number; scriptures: number; images: number; audio: number; video: number }
  totalSizeBytes: number
  serviceJsonChecksum: string
  assetChecksums: Record<string, string> // relativePath (assets/...) -> sha256
  hasUnpackagedMusicPlayer: boolean
}

export interface ServiceJsonSection {
  type: string
  label: string
  lyrics: string
  orderIndex: number
}

export interface ServiceJsonSong {
  syncUuid: string
  title: string
  artist: string
  key: string | null
  tempo: string | null
  ccliNumber: string | null
  copyright: string | null
  backgroundPath: string | null // package-relative (assets/...) or 'color:#rrggbb' or null
  tags: string
  sections: ServiceJsonSection[]
}

export interface ServiceJsonTheme {
  name: string
  type: string
  isDefault: boolean
  seasonStart: string | null
  seasonEnd: string | null
  settings: string // JSON string; path-bearing keys already rewritten to package-relative
}

export interface ServiceJsonLineupItem {
  songSyncUuid: string | null
  itemType: string
  orderIndex: number
  // Positions (0-based) into the referenced song's `sections` array, not raw
  // local DB ids — those aren't portable across devices. Remapped back to
  // newly-created local section ids on import (sections are always recreated
  // in the same order they were exported in).
  selectedSectionPositions: number[]
  sectionOrderPositions: number[] | null
  overrideThemeName: string | null
  overrideBackgroundPath: string | null
  notes: string | null
  title: string | null
  scriptureRef: string | null
  mediaPath: string | null
  itemStyle: string | null
  imageScaleMode: string | null
  mediaCollection: string | null
  hasMusicPlayerDir: boolean // musicPlayerDir itself is never packaged
}

export interface ServiceJson {
  syncUuid: string
  label: string
  date: string
  notes: string | null
  songs: ServiceJsonSong[]
  themes: ServiceJsonTheme[]
  lineupItems: ServiceJsonLineupItem[]
}

export interface PublishPreview {
  serviceDateId: number
  title: string
  counts: PackageManifest['counts']
  totalSizeBytes: number
  hasMusicPlayerItem: boolean
  nextVersion: number
}

export type VerifyResult =
  | { ok: true; manifest: PackageManifest }
  | { ok: false; reason: 'corrupted'; detail: string; expected?: string; actual?: string }
  | { ok: false; reason: 'incompatible'; detail: string }
  | { ok: false; reason: 'invalid'; detail: string }

export interface AvailablePackage {
  filename: string
  manifest: PackageManifest
  localState: 'new' | 'update-available' | 'already-imported'
  localVersion: number | null
}

export interface ImportResult {
  ok: boolean
  error?: string
  serviceDateId?: number
  created?: boolean // true = new local service, false = updated existing
}

export interface SyncHistoryEntry {
  type: 'publish' | 'import'
  syncUuid: string
  version: number
  title: string
  at: string
  deviceId: string
  deviceName: string
}
