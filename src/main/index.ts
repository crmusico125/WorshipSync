import { app, BrowserWindow } from 'electron'

// Must be called before app.ready — disables Chromium's autoplay policy so
// video audio plays in the projection window without requiring a user click.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
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

  // Create the control window
  createControlWindow()

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
