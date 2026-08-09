export interface UpdateInfoSummary {
  version: string
  releaseNotes: string | null
  releaseDate?: string
}

export interface DownloadProgressInfo {
  percent: number
  bytesPerSecond: number
  transferred: number
  total: number
}

export type UpdaterEventPayload =
  | { type: 'checking-for-update'; lastCheckedAt: string }
  | { type: 'update-available'; info: UpdateInfoSummary }
  | { type: 'update-not-available'; currentVersion: string }
  | { type: 'download-progress'; progress: DownloadProgressInfo }
  | { type: 'update-downloaded'; info: UpdateInfoSummary }
  | { type: 'error'; message: string }

export type UpdaterSubtlePayload =
  | { type: 'update-available-background'; version: string }
  | { type: 'update-ready-background'; version: string }

export type UpdaterStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error'

export interface UpdaterState {
  status: UpdaterStatus
  currentVersion: string
  latestVersion: string | null
  releaseNotes: string | null
  progress: DownloadProgressInfo | null
  errorMessage: string | null
  lastCheckedAt: string | null
}
