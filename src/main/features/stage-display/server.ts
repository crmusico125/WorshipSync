import { createServer } from 'http'
import { networkInterfaces, hostname } from 'os'
import { execSync } from 'child_process'
import {
  getSseClients, setSseClients,
  getStageServer, setStageServer,
  getStagePort, setStagePort,
  getStagePingInterval, setStagePingInterval,
  getBonjourService, setBonjourService,
  bonjour,
  stage,
} from '../../lib/state'
import { broadcastAll, formatDuration } from '../../lib/broadcast'
import { STAGE_DISPLAY_HTML } from './html'

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

export function getMdnsHostname(): string {
  try {
    if (process.platform === 'darwin') {
      return execSync('scutil --get LocalHostName', { encoding: 'utf8' }).trim() + '.local'
    }
  } catch { /* fall through */ }
  return hostname() + '.local'
}

export function getLocalIP(): string {
  for (const ifaces of Object.values(networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address
    }
  }
  return 'localhost'
}

export function startStageServer(port = 4040): Promise<boolean> {
  return new Promise((resolve) => {
    if (getStageServer()) { resolve(true); return }
    setStagePort(port)
    const server = createServer((req, res) => {
      if (req.url === '/events') {
        const sock = req.socket
        sock.setNoDelay(true)
        sock.setKeepAlive(true, 1000)
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
          'Access-Control-Allow-Origin': '*',
        })
        // Use res.write() — the standard SSE path. res.write() owns the chunked
        // encoding, cork/uncork, and flush lifecycle correctly. Writing directly to
        // the socket while res is still open interferes with that and adds latency.
        const sseSend = (data: string): boolean => {
          if (!res.writable) return false
          try { res.write(data); return true } catch { return false }
        }
        const client = {
          socket: sock,
          send: (event: unknown) => sseSend(`data: ${JSON.stringify(event)}\n\n`),
          ping: () => sseSend(': ping\n\n'),
          ip: (sock.remoteAddress ?? '').replace('::ffff:', ''),
          userAgent: req.headers['user-agent'] ?? '',
          connectedAt: Date.now(),
        }
        setSseClients([...getSseClients(), client])
        // Stage display only needs slide/blank/countdown — no lineup
        client.send({ type: 'init', slide: stage.slide, blank: stage.blank, countdown: stage.countdown, nextLines: stage.nextLines, nextSectionLabel: stage.nextLabel })
        req.on('close', () => { setSseClients(getSseClients().filter(c => c !== client)) })
        sock.on('error', () => { setSseClients(getSseClients().filter(c => c !== client)) })
      } else if (req.url === '/status') {
        const clientData = getSseClients().map(c => ({
          ip: c.ip,
          device: parseDeviceLabel(c.userAgent),
          connectedFor: formatDuration(Date.now() - c.connectedAt),
        }))
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
        res.end(JSON.stringify({ clients: clientData }))
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(STAGE_DISPLAY_HTML)
      }
    })
    server.once('error', (err) => {
      console.error('[stage] failed to start:', err)
      setStageServer(null)
      resolve(false)
    })
    server.listen(port, () => {
      setStageServer(server)
      console.log(`[stage] listening on http://localhost:${port}`)
      try {
        setBonjourService(bonjour.publish({ name: 'WorshipSync', type: 'http', port }))
      } catch (e) {
        console.warn('[stage] mDNS publish failed:', e)
      }
      setStagePingInterval(setInterval(() => {
        setSseClients(getSseClients().filter(c => c.ping()))
      }, 250))
      resolve(true)
    })
  })
}

export function stopStageServer(): void {
  const pingInterval = getStagePingInterval()
  if (pingInterval) { clearInterval(pingInterval); setStagePingInterval(null) }
  getSseClients().forEach(c => {
    try { c.send({ type: 'shutdown' }) } catch { /* ignore */ }
    try { c.socket.destroy() } catch { /* ignore */ }
  })
  setSseClients([])
  getStageServer()?.close()
  setStageServer(null)
  const svc = getBonjourService()
  if (svc) {
    try { svc.stop() } catch { /* ignore */ }
    setBonjourService(null)
  }
}
