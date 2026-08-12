import { Menu } from 'electron'
import { windows } from '../../lib/state'
import { readAppState, writeAppState } from '../app-state/handlers'
import { buildAppMenu } from './menu'
import { DEFAULT_ZOOM, nearestZoomLevel, nextZoomLevel, type ZoomLevel } from './zoom-levels'

export type Density = 'comfortable' | 'compact'
export const DEFAULT_DENSITY: Density = 'comfortable'

export interface UiPrefsState {
  zoomPercent: ZoomLevel
  density: Density
}

export type UiPrefsEvent =
  | { type: 'zoom-changed'; zoomPercent: ZoomLevel }
  | { type: 'density-changed'; density: Density }

const state: UiPrefsState = {
  zoomPercent: DEFAULT_ZOOM,
  density: DEFAULT_DENSITY,
}

function send(payload: UiPrefsEvent): void {
  if (windows.control && !windows.control.isDestroyed()) {
    windows.control.webContents.send('uiPrefs:event', payload)
  }
}

/** Rebuilds the application menu so the Zoom Level submenu's checkmark reflects the current state — Electron menus aren't reactive. */
function rebuildMenu(): void {
  Menu.setApplicationMenu(buildAppMenu(state.zoomPercent, {
    onZoomIn: zoomIn,
    onZoomOut: zoomOut,
    onResetZoom: resetZoom,
    onSetZoom: setZoom,
  }))
}

/** The only place `webContents.setZoomFactor` is called — always on the Control window, never Projection/Confidence. */
export function applyZoomToWindow(percent: ZoomLevel): void {
  if (windows.control && !windows.control.isDestroyed()) {
    windows.control.webContents.setZoomFactor(percent / 100)
  }
}

export function setZoom(percent: number): void {
  const level = nearestZoomLevel(percent)
  state.zoomPercent = level
  applyZoomToWindow(level)
  writeAppState({ uiZoomPercent: level })
  send({ type: 'zoom-changed', zoomPercent: level })
  rebuildMenu()
}

export function zoomIn(): void {
  setZoom(nextZoomLevel(state.zoomPercent, 'in'))
}

export function zoomOut(): void {
  setZoom(nextZoomLevel(state.zoomPercent, 'out'))
}

export function resetZoom(): void {
  setZoom(DEFAULT_ZOOM)
}

export function setDensity(density: Density): void {
  state.density = density
  writeAppState({ uiDensity: density })
  send({ type: 'density-changed', density })
}

export function getUiPrefsState(): UiPrefsState {
  return { ...state }
}

/** Reads persisted prefs and applies both — called once after the Control window is ready. Also builds the initial application menu. */
export function restoreUiPrefsOnStartup(): void {
  const saved = readAppState() as { uiZoomPercent?: number; uiDensity?: Density }
  state.zoomPercent = typeof saved.uiZoomPercent === 'number' ? nearestZoomLevel(saved.uiZoomPercent) : DEFAULT_ZOOM
  state.density = saved.uiDensity === 'compact' ? 'compact' : DEFAULT_DENSITY

  applyZoomToWindow(state.zoomPercent)
  if (windows.control && !windows.control.isDestroyed()) {
    windows.control.webContents.setVisualZoomLevelLimits(1, 1)
  }
  rebuildMenu()
}
