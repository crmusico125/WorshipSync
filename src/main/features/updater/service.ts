import { app, shell } from 'electron'
// electron-updater is CommonJS and doesn't reliably expose named exports
// under Node's strict ESM loader (the bundled main process runs as real ESM)
// — import the default and destructure, per electron-updater's own guidance.
import electronUpdaterPkg from 'electron-updater'
import type { ReleaseNoteInfo } from 'electron-updater'
import { windows } from '../../lib/state'
import { readAppState, writeAppState } from '../app-state/handlers'
import { isLivePresentationActive } from './live-state'
import { decideAvailableRoute, decideDownloadedRoute } from './routing'
import type { DownloadProgressInfo, UpdateInfoSummary, UpdaterEventPayload, UpdaterState } from './types'

const { autoUpdater } = electronUpdaterPkg

const GITHUB_RELEASES_URL = 'https://github.com/crmusico125/WorshipSync/releases'

const state: UpdaterState = {
  status: 'idle',
  currentVersion: app.getVersion(),
  latestVersion: null,
  releaseNotes: null,
  releaseUrl: null,
  progress: null,
  errorMessage: null,
  lastCheckedAt: null,
}

// Set once a download finishes while a presentation is live — held back from
// the renderer until the presentation ends, per the "never interrupt a live
// show" requirement.
let pendingInstallNotification = false
let liveWatcherInterval: ReturnType<typeof setInterval> | null = null
const LIVE_WATCHER_INTERVAL_MS = 15_000

function send(payload: UpdaterEventPayload): void {
  if (windows.control && !windows.control.isDestroyed()) {
    windows.control.webContents.send('updater:event', payload)
  }
}

function sendSubtle(payload: { type: 'update-available-background' | 'update-ready-background'; version: string }): void {
  if (windows.control && !windows.control.isDestroyed()) {
    windows.control.webContents.send('updater:subtle', payload)
  }
}

function normalizeReleaseNotes(notes: string | ReleaseNoteInfo[] | null | undefined): string | null {
  if (!notes) return null
  if (typeof notes === 'string') return notes
  return notes.map(n => n.note).filter((n): n is string => !!n).join('\n\n') || null
}

function startLiveWatcher(): void {
  if (liveWatcherInterval) return
  liveWatcherInterval = setInterval(() => {
    if (isLivePresentationActive()) return
    stopLiveWatcher()
    if (pendingInstallNotification && state.latestVersion) {
      pendingInstallNotification = false
      state.status = 'downloaded'
      send({ type: 'update-downloaded', info: { version: state.latestVersion, releaseNotes: state.releaseNotes } })
    }
  }, LIVE_WATCHER_INTERVAL_MS)
  liveWatcherInterval.unref?.()
}

function stopLiveWatcher(): void {
  if (liveWatcherInterval) {
    clearInterval(liveWatcherInterval)
    liveWatcherInterval = null
  }
}

/** Wires every autoUpdater event exactly once — call this at app startup regardless of whether a check is actually performed. */
export function initAutoUpdater(): void {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    state.status = 'checking'
    send({ type: 'checking-for-update', lastCheckedAt: state.lastCheckedAt ?? new Date().toISOString() })
  })

  autoUpdater.on('update-available', (info) => {
    state.latestVersion = info.version
    state.releaseNotes = normalizeReleaseNotes(info.releaseNotes)
    const route = decideAvailableRoute(isLivePresentationActive())

    // macOS builds here are only ad-hoc signed (no paid Apple Developer ID),
    // so Squirrel.Mac's own signature validation always fails partway through
    // an in-app download — see the note on 'update-available-manual' in
    // types.ts. Route to a manual-download flow instead of ever attempting
    // autoUpdater.downloadUpdate() on darwin.
    if (process.platform === 'darwin') {
      state.status = 'manual'
      state.releaseUrl = `${GITHUB_RELEASES_URL}/tag/v${info.version}`
      const summary: UpdateInfoSummary = { version: info.version, releaseNotes: state.releaseNotes, releaseDate: info.releaseDate, releaseUrl: state.releaseUrl }
      if (route === 'subtle') {
        sendSubtle({ type: 'update-available-manual-background', version: info.version })
      } else {
        send({ type: 'update-available-manual', info: summary })
      }
      return
    }

    state.status = 'available'
    state.releaseUrl = null
    const summary: UpdateInfoSummary = { version: info.version, releaseNotes: state.releaseNotes, releaseDate: info.releaseDate }
    if (route === 'subtle') {
      sendSubtle({ type: 'update-available-background', version: info.version })
    } else {
      send({ type: 'update-available', info: summary })
    }

    const { autoDownloadUpdates } = readAppState() as { autoDownloadUpdates?: boolean }
    if (autoDownloadUpdates) {
      autoUpdater.downloadUpdate().catch(() => { /* surfaced via the 'error' event */ })
    }
  })

  autoUpdater.on('update-not-available', () => {
    state.status = 'not-available'
    send({ type: 'update-not-available', currentVersion: app.getVersion() })
  })

  autoUpdater.on('download-progress', (progress) => {
    state.status = 'downloading'
    const p: DownloadProgressInfo = {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    }
    state.progress = p
    send({ type: 'download-progress', progress: p })
  })

  autoUpdater.on('update-downloaded', (info) => {
    state.progress = null
    state.latestVersion = info.version
    state.releaseNotes = normalizeReleaseNotes(info.releaseNotes)
    const summary: UpdateInfoSummary = { version: info.version, releaseNotes: state.releaseNotes, releaseDate: info.releaseDate }

    const route = decideDownloadedRoute(isLivePresentationActive())
    if (route === 'defer') {
      pendingInstallNotification = true
      sendSubtle({ type: 'update-ready-background', version: info.version })
      startLiveWatcher()
    } else {
      state.status = 'downloaded'
      send({ type: 'update-downloaded', info: summary })
    }
  })

  autoUpdater.on('error', (err) => {
    state.status = 'error'
    state.errorMessage = err.message
    send({ type: 'error', message: err.message })
  })
}

/** The automatic startup check — gated on app.isPackaged and the user's "Automatically check for updates" setting (default on). */
export function checkForUpdatesOnStartup(): void {
  if (!app.isPackaged) return
  const { autoCheckForUpdates } = readAppState() as { autoCheckForUpdates?: boolean }
  if (autoCheckForUpdates === false) return
  checkForUpdates()
}

export function checkForUpdates(): void {
  state.lastCheckedAt = new Date().toISOString()
  writeAppState({ lastUpdateCheckAt: state.lastCheckedAt })
  autoUpdater.checkForUpdates().catch((e) => {
    state.status = 'error'
    state.errorMessage = e instanceof Error ? e.message : String(e)
    send({ type: 'error', message: state.errorMessage })
  })
}

export function downloadUpdate(): void {
  autoUpdater.downloadUpdate().catch((e) => {
    state.status = 'error'
    state.errorMessage = e instanceof Error ? e.message : String(e)
    send({ type: 'error', message: state.errorMessage })
  })
}

/** Only ever called from an explicit user action (the "Restart & Install" button) — never automatically. */
export function installUpdate(): void {
  autoUpdater.quitAndInstall()
}

/** The macOS manual-download route's action — opens the GitHub release page (falls back to the releases index if no specific version is known). */
export function openReleasePage(): void {
  shell.openExternal(state.releaseUrl ?? GITHUB_RELEASES_URL)
}

export function getUpdaterState(): UpdaterState {
  return { ...state }
}
