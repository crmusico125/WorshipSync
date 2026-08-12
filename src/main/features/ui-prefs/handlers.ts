import { ipcMain } from 'electron'
import { getUiPrefsState, resetZoom, setDensity, setZoom, zoomIn, zoomOut, type Density, type UiPrefsState } from './service'

export function registerUiPrefsHandlers(): void {
  ipcMain.handle('uiPrefs:getState', (): UiPrefsState => getUiPrefsState())

  ipcMain.handle('uiPrefs:setZoom', (_e, percent: unknown) => {
    if (typeof percent !== 'number') return false
    setZoom(percent)
    return true
  })

  ipcMain.handle('uiPrefs:zoomIn', () => {
    zoomIn()
    return true
  })

  ipcMain.handle('uiPrefs:zoomOut', () => {
    zoomOut()
    return true
  })

  ipcMain.handle('uiPrefs:resetZoom', () => {
    resetZoom()
    return true
  })

  ipcMain.handle('uiPrefs:setDensity', (_e, density: unknown) => {
    if (density !== 'comfortable' && density !== 'compact') return false
    setDensity(density as Density)
    return true
  })
}
