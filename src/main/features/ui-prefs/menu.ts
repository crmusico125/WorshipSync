import { Menu, type MenuItemConstructorOptions } from 'electron'
import { ZOOM_LEVELS, type ZoomLevel } from './zoom-levels'

export interface MenuCallbacks {
  onZoomIn: () => void
  onZoomOut: () => void
  onResetZoom: () => void
  onSetZoom: (percent: ZoomLevel) => void
}

/**
 * Builds the full application menu, replacing Electron's auto-generated
 * default — needed because the Zoom Level submenu's checkmark is dynamic
 * (Electron menus aren't reactive; the caller rebuilds this whenever zoom
 * changes). Standard items use `role:` so existing OS-native behavior
 * (copy/paste, Quit, Hide, window management, etc.) is preserved exactly.
 */
export function buildAppMenu(currentZoomPercent: ZoomLevel, callbacks: MenuCallbacks): Menu {
  const zoomLevelSubmenu: MenuItemConstructorOptions[] = ZOOM_LEVELS.map((level) => ({
    label: `${level}%`,
    type: 'radio',
    checked: level === currentZoomPercent,
    click: () => callbacks.onSetZoom(level),
  }))

  const viewMenu: MenuItemConstructorOptions = {
    label: 'View',
    submenu: [
      { label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', click: callbacks.onZoomIn },
      // Registers the un-shifted "=" key too, since "+" is Shift+= on most
      // keyboards and users commonly press Cmd/Ctrl+= expecting zoom in.
      // Hidden so it doesn't show as a second, confusing "Zoom In" row —
      // Electron still binds the accelerator for non-visible menu items.
      { label: 'Zoom In', accelerator: 'CmdOrCtrl+=', click: callbacks.onZoomIn, visible: false },
      { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: callbacks.onZoomOut },
      { label: 'Reset Zoom', accelerator: 'CmdOrCtrl+0', click: callbacks.onResetZoom },
      { type: 'separator' },
      { label: `Zoom Level (${currentZoomPercent}%)`, submenu: zoomLevelSubmenu },
      { type: 'separator' },
      { role: 'togglefullscreen' },
    ],
  }

  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' as const }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    viewMenu,
    { role: 'windowMenu' },
  ]

  return Menu.buildFromTemplate(template)
}
