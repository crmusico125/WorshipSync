import { ipcMain } from 'electron'
import { startStageServer, stopStageServer, getLocalIP, getMdnsHostname } from './server'
import { getSseClients, getStageServer, getStagePort } from '../../lib/state'

// writeAppState is provided by a callback to avoid circular deps
let _writeAppState: ((data: Record<string, unknown>) => void) | null = null

export function registerStageDisplayHandlers(writeAppState: (data: Record<string, unknown>) => void): void {
  _writeAppState = writeAppState

  ipcMain.handle('stageDisplay:start', async (_e, port: number = 4040) => {
    const ok = await startStageServer(port)
    if (ok && _writeAppState) _writeAppState({ stageDisplayEnabled: true, stageDisplayPort: port })
    return { ok, url: `http://${getLocalIP()}:${getStagePort()}`, port: getStagePort() }
  })

  ipcMain.handle('stageDisplay:stop', () => {
    stopStageServer()
    if (_writeAppState) _writeAppState({ stageDisplayEnabled: false })
    return true
  })

  ipcMain.handle('stageDisplay:getStatus', () => {
    const now = Date.now()
    const clients = getSseClients()
    return {
      running: !!getStageServer(),
      url: `http://${getLocalIP()}:${getStagePort()}`,
      mdnsUrl: `http://${getMdnsHostname()}:${getStagePort()}`,
      port: getStagePort(),
      clients: clients.length,
      localIP: getLocalIP(),
      clientList: clients.map(c => ({
        ip: c.ip,
        device: parseDeviceLabel(c.userAgent),
        connectedAt: c.connectedAt,
        connectedForSeconds: Math.floor((now - c.connectedAt) / 1000),
      })),
    }
  })
}

function parseDeviceLabel(ua: string): string {
  if (/iPhone/i.test(ua))                      return 'iPhone'
  if (/iPad/i.test(ua))                        return 'iPad'
  if (/Android/i.test(ua) && /Mobile/i.test(ua)) return 'Android Phone'
  if (/Android/i.test(ua))                     return 'Android Tablet'
  if (/Macintosh|Mac OS X/i.test(ua))          return 'Mac'
  if (/Windows/i.test(ua))                     return 'Windows PC'
  if (/Linux/i.test(ua))                       return 'Linux'
  if (/CrOS/i.test(ua))                        return 'Chromebook'
  return 'Unknown Device'
}
