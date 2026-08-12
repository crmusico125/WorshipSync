import { app, BrowserWindow } from 'electron'

// Must be called before app.ready — disables Chromium's autoplay policy so
// video audio plays in the projection window without requiring a user click.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
// Removes the 60fps compositor cap so the projection window can render at the
// monitor's native refresh rate (important for smooth video on secondary displays).
app.commandLine.appendSwitch('disable-frame-rate-limit')
// Force the GPU rasterizer on — Windows sometimes falls back to software
// rendering on secondary monitors, causing video stutter.
app.commandLine.appendSwitch('enable-gpu-rasterization')
app.commandLine.appendSwitch('ignore-gpu-blocklist')
// Force software video decode. Hardware video decode on a GPU/driver combo that
// Chromium's blocklist normally protects against (which ignore-gpu-blocklist above
// bypasses) is a known source of exactly this symptom: stutter that gets worse over
// time and eventually drops the audio track entirely, because the hardware decoder
// itself is degrading rather than just being resource-constrained. Software decode
// costs more CPU but is far more predictable.
app.commandLine.appendSwitch('disable-accelerated-video-decode')
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { screen } from 'electron'
import { runMigrations } from './db/migrate'
import { seedIfEmpty } from './db/seed'
import {
  bonjour,
  windows,
  getConfidenceWasOpen, setConfidenceWasOpen,
  getConfidenceLastDisplayId,
} from './lib/state'

// ── Feature registrations ──────────────────────────────────────────────────────
import { createControlWindow, notifyDisplaysChanged } from './features/windows/control'
import { registerProjectionHandlers } from './features/windows/projection'
import { registerConfidenceHandlers, createConfidenceWindow } from './features/windows/confidence'
import { registerSlideHandlers } from './features/slide/handlers'
import { registerStageDisplayHandlers } from './features/stage-display/handlers'
import { startStageServer } from './features/stage-display/server'
import { stopStageServer } from './features/stage-display/server'
import { registerSongsHandlers } from './features/songs/handlers'
import { registerServicesHandlers } from './features/services/handlers'
import { registerLineupHandlers } from './features/lineup/handlers'
import { registerThemesHandlers } from './features/themes/handlers'
import { registerBackgroundsHandlers } from './features/backgrounds/handlers'
import { registerAnalyticsHandlers } from './features/analytics/handlers'
import { registerAppStateHandlers, readAppState, writeAppState } from './features/app-state/handlers'
import { registerDataHandlers } from './features/data/handlers'
import { registerPwaHandlers } from './features/pwa/handlers'
import { registerMusicHandlers } from './features/music/handlers'
import { registerSyncHandlers } from './features/sync/handlers'
import { registerUpdaterHandlers } from './features/updater/handlers'
import { initAutoUpdater, checkForUpdatesOnStartup } from './features/updater/service'
import { registerUiPrefsHandlers } from './features/ui-prefs/handlers'
import { restoreUiPrefsOnStartup } from './features/ui-prefs/service'

// ── App lifecycle ──────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  // Database first — before any windows open
  runMigrations()
  seedIfEmpty()
  electronApp.setAppUserModelId('com.worshipsync')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Register all IPC handlers
  registerSlideHandlers()
  registerProjectionHandlers()
  registerConfidenceHandlers()
  registerStageDisplayHandlers(writeAppState)
  registerSongsHandlers()
  registerServicesHandlers()
  registerLineupHandlers()
  registerThemesHandlers()
  registerBackgroundsHandlers()
  registerAnalyticsHandlers()
  registerAppStateHandlers()
  registerDataHandlers()
  registerPwaHandlers()
  registerMusicHandlers()
  registerSyncHandlers()
  registerUpdaterHandlers()
  registerUiPrefsHandlers()

  // Create the control window
  createControlWindow()

  // UI zoom/density: restores persisted prefs onto the Control window and
  // builds the application menu — never touches Projection/Confidence.
  restoreUiPrefsOnStartup()

  // Auto-update: wire events immediately (cheap — just listener registration),
  // but delay the actual startup check a few seconds so it never competes
  // with the app's first window paint/render for CPU and network setup.
  initAutoUpdater()
  setTimeout(checkForUpdatesOnStartup, 5000).unref?.()

  // Auto-start stage display if previously enabled
  const savedState = readAppState()
  if (savedState.stageDisplayEnabled) {
    startStageServer((savedState.stageDisplayPort as number | undefined) ?? 4040).catch(() => {})
  }

  // Notify renderer when displays are added or removed
  screen.on('display-removed', () => {
    // Snapshot whether confidence was open before Electron closes the window
    setConfidenceWasOpen(!!(windows.confidence && !windows.confidence.isDestroyed()))
    notifyDisplaysChanged()
  })

  screen.on('display-added', () => {
    notifyDisplaysChanged()
    // Auto-reopen confidence window on the reconnected display
    if (getConfidenceWasOpen()) {
      setConfidenceWasOpen(false)
      setTimeout(() => createConfidenceWindow(getConfidenceLastDisplayId()), 800)
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createControlWindow()
    }
  })
})

app.on('window-all-closed', () => {
  stopStageServer()
  try { bonjour.destroy() } catch { /* ignore */ }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
