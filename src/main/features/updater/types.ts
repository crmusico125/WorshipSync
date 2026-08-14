export interface UpdateInfoSummary {
  version: string
  releaseNotes: string | null
  releaseDate?: string
  /** Only set for the macOS manual-download route — the GitHub release page for this version. */
  releaseUrl?: string
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
  // macOS-only route: this build is ad-hoc signed (no Apple Developer ID), so
  // Squirrel.Mac's own code-signature validation always fails partway through
  // an in-app download/install — rather than surface that as a scary raw
  // error, a new version on macOS routes here instead of 'update-available',
  // pointing the operator at the GitHub release page for a manual .dmg install.
  | { type: 'update-available-manual'; info: UpdateInfoSummary }
  | { type: 'update-not-available'; currentVersion: string }
  | { type: 'download-progress'; progress: DownloadProgressInfo }
  | { type: 'update-downloaded'; info: UpdateInfoSummary }
  | { type: 'error'; message: string }

export type UpdaterSubtlePayload =
  | { type: 'update-available-background'; version: string }
  | { type: 'update-available-manual-background'; version: string }
  | { type: 'update-ready-background'; version: string }

export type UpdaterStatus = 'idle' | 'checking' | 'available' | 'manual' | 'downloading' | 'downloaded' | 'not-available' | 'error'

export interface UpdaterState {
  status: UpdaterStatus
  currentVersion: string
  latestVersion: string | null
  releaseNotes: string | null
  /** Only set once state.status is 'manual' — the GitHub release page for latestVersion. */
  releaseUrl: string | null
  progress: DownloadProgressInfo | null
  errorMessage: string | null
  lastCheckedAt: string | null
}
