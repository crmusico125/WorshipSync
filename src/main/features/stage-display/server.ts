import { createServer, IncomingMessage, ServerResponse } from 'http'
import { networkInterfaces, hostname } from 'os'
import { execSync } from 'child_process'
import {
  getSseClients, setSseClients,
  getPwaClients, setPwaClients,
  getStageServer, setStageServer,
  getStagePort, setStagePort,
  getStagePingInterval, setStagePingInterval,
  getBonjourService, setBonjourService,
  bonjour,
  stage, windows,
} from '../../lib/state'
import { broadcastAll, broadcastPwa, formatDuration } from '../../lib/broadcast'
import { STAGE_DISPLAY_HTML } from './html'
import { PWA_CONTROLLER_HTML } from '../pwa/html'

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
      if (req.url === '/events' || req.url === '/controller/events') {
        const isPwa = req.url === '/controller/events'
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
        if (isPwa) {
          setPwaClients([...getPwaClients(), client])
          // Full snapshot for PWA: includes lineup, audio/video state, service date/time
          client.send({ type: 'init', slide: stage.slide, blank: stage.blank, logo: stage.logo, countdown: stage.countdown, nextLines: stage.nextLines, nextSectionLabel: stage.nextLabel, lineup: stage.lineup, currentLineupIdx: stage.currentLineupIdx, serviceDate: stage.serviceDate, serviceTime: stage.serviceTime, audioState: stage.audioState, videoState: stage.videoState })
          req.on('close', () => { setPwaClients(getPwaClients().filter(c => c !== client)) })
          sock.on('error', () => { setPwaClients(getPwaClients().filter(c => c !== client)) })
        } else {
          setSseClients([...getSseClients(), client])
          // Stage display snapshot: slide/blank/countdown only — no lineup or media state
          client.send({ type: 'init', slide: stage.slide, blank: stage.blank, countdown: stage.countdown, nextLines: stage.nextLines, nextSectionLabel: stage.nextLabel })
          req.on('close', () => { setSseClients(getSseClients().filter(c => c !== client)) })
          sock.on('error', () => { setSseClients(getSseClients().filter(c => c !== client)) })
        }
      } else if (req.url === '/controller') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' })
        res.end(PWA_CONTROLLER_HTML)

      } else if (req.url === '/controller/state') {
        const payload = JSON.stringify({
          slide: stage.slide,
          blank: stage.blank,
          logo: stage.logo,
          countdown: stage.countdown,
          nextLines: stage.nextLines,
          nextLabel: stage.nextLabel,
          lineup: stage.lineup,
          currentLineupIdx: stage.currentLineupIdx,
          currentSlideIdx: (stage.slide as any)?.slideIndex ?? -1,
          audioState: stage.audioState,
          videoState: stage.videoState,
          serviceDate: stage.serviceDate,
          serviceTime: stage.serviceTime,
        })
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' })
        res.end(payload)

      } else if (req.url === '/controller/cmd' && req.method === 'POST') {
        handleControllerCommand(req, res)

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
        setPwaClients(getPwaClients().filter(c => c.ping()))
      }, 250))
      resolve(true)
    })
  })
}

function handleControllerCommand(req: IncomingMessage, res: ServerResponse): void {
  const cors = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  let body = ''
  req.on('data', chunk => { body += chunk })
  req.on('end', () => {
    let cmd: Record<string, unknown>
    try { cmd = JSON.parse(body) } catch {
      res.writeHead(400, cors); res.end(JSON.stringify({ error: 'bad json' })); return
    }

    const send = (channel: string, ...args: unknown[]) => {
      if (windows.projection && !windows.projection.isDestroyed())
        windows.projection.webContents.send(channel, ...args)
      if (windows.confidence && !windows.confidence.isDestroyed())
        windows.confidence.webContents.send(channel, ...args)
    }

    switch (cmd.action) {
      case 'blank': {
        const isBlank = Boolean(cmd.value)
        send('slide:blank', isBlank)
        stage.blank = isBlank
        if (isBlank) {
          stage.logo = false
          broadcastAll({ type: 'blank', isBlank: true })
        } else {
          broadcastAll({ type: 'blank', isBlank: false })
        }
        notifyControl({ type: 'blank', isBlank })
        break
      }
      case 'logo': {
        const isLogo = Boolean(cmd.value)
        windows.projection?.webContents.send('slide:logo', isLogo)
        stage.logo = isLogo
        if (isLogo) stage.blank = false
        broadcastAll({ type: 'logo', isLogo })
        notifyControl({ type: 'logo', isLogo })
        break
      }
      case 'show-slide': {
        const { lineupItemId, slideIdx } = cmd as { lineupItemId: number; slideIdx: number }
        const item = stage.lineup.find(i => i.id === lineupItemId)
        if (!item) { res.writeHead(404, cors); res.end(JSON.stringify({ error: 'item not found' })); return }

        // Media items have no slides array — build payload directly from mediaPath
        if (item.itemType === 'media') {
          const payload = {
            lines: [] as string[],
            songTitle: item.title,
            sectionLabel: '',
            sectionType: 'media',
            itemType: 'media',
            slideIndex: 0,
            backgroundPath: item.mediaPath ?? null,
            theme: item.theme
              ? { ...item.theme, overlayOpacity: 0, textShadowOpacity: 0, backgroundScaleMode: item.imageScaleMode ?? 'contain' }
              : { overlayOpacity: 0, textShadowOpacity: 0, backgroundScaleMode: item.imageScaleMode ?? 'contain' },
          }
          send('slide:show', payload)
          stage.slide = payload
          stage.blank = false
          stage.logo = false
          const lineupIdx = stage.lineup.indexOf(item)
          stage.currentLineupIdx = lineupIdx
          broadcastAll({ type: 'slide', payload, lineupIdx, slideIdx: 0 })
          notifyControl({ type: 'slide', lineupIdx, slideIdx: 0 })
          break
        }

        const slide = item.slides[slideIdx as number]
        if (!slide) { res.writeHead(404, cors); res.end(JSON.stringify({ error: 'slide not found' })); return }
        const payload = buildSlidePayload(item, slide)
        send('slide:show', payload)
        stage.slide = payload
        stage.blank = false
        stage.logo = false
        const lineupIdx = stage.lineup.indexOf(item)
        stage.currentLineupIdx = lineupIdx
        broadcastAll({ type: 'slide', payload, lineupIdx, slideIdx })
        broadcastStageNext(item, slideIdx as number)
        notifyControl({ type: 'slide', lineupIdx, slideIdx })
        break
      }
      case 'next-slide':
      case 'prev-slide': {
        const delta = cmd.action === 'next-slide' ? 1 : -1
        const item = stage.lineup[stage.currentLineupIdx]
        if (item?.slides.length) {
          const cur = (stage.slide as any)?.slideIndex ?? 0
          const next = Math.max(0, Math.min(item.slides.length - 1, cur + delta))
          const slide = item.slides[next]
          if (slide) {
            const payload = buildSlidePayload(item, slide)
            send('slide:show', payload)
            stage.slide = payload
            stage.blank = false
            stage.logo = false
            broadcastAll({ type: 'slide', payload, lineupIdx: stage.currentLineupIdx, slideIdx: next })
            broadcastStageNext(item, next)
            notifyControl({ type: 'slide', lineupIdx: stage.currentLineupIdx, slideIdx: next })
          }
        }
        break
      }
      case 'countdown': {
        const data = { targetTime: String(cmd.targetTime), running: Boolean(cmd.running) }
        send('slide:countdown', data)
        stage.countdown = data
        broadcastAll({ type: 'countdown', data })
        break
      }
      case 'countdown-start':
      case 'countdown-stop': {
        if (windows.control && !windows.control.isDestroyed()) {
          windows.control.webContents.send('pwa:countdownCmd',
            cmd.action === 'countdown-start' ? 'start' : 'stop')
        }
        break
      }
      case 'audio-play':
      case 'audio-pause':
      case 'audio-stop':
      case 'video-play':
      case 'video-pause':
      case 'video-stop': {
        const channel = (cmd.action as string).startsWith('audio') ? 'pwa:audioCmd' : 'pwa:videoCmd'
        if (windows.control && !windows.control.isDestroyed()) {
          windows.control.webContents.send(channel, {
            action: cmd.action,
            lineupItemId: cmd.lineupItemId as number,
          })
        }
        break
      }
      default:
        res.writeHead(400, cors); res.end(JSON.stringify({ error: 'unknown action' })); return
    }

    res.writeHead(200, cors)
    res.end(JSON.stringify({ ok: true }))
  })
}

function buildSlidePayload(item: import('../../lib/state').PwaLineupItem, slide: import('../../lib/state').PwaSlide) {
  return {
    lines: slide.lines,
    songTitle: item.title,
    sectionLabel: slide.sectionLabel,
    sectionType: slide.sectionType,
    itemType: item.itemType,
    slideIndex: slide.idx,
    backgroundPath: item.backgroundPath ?? null,
    theme: item.theme ?? undefined,
  }
}

function broadcastStageNext(item: import('../../lib/state').PwaLineupItem, currentSlideIdx: number): void {
  const nextSlide = item.slides[currentSlideIdx + 1]
  if (nextSlide) {
    stage.nextLines = nextSlide.lines
    stage.nextLabel = nextSlide.sectionLabel
    broadcastAll({ type: 'stageNext', nextLines: nextSlide.lines, nextSectionLabel: nextSlide.sectionLabel })
  } else {
    // Try the first slide of the next lineup item
    const nextItem = stage.lineup[stage.currentLineupIdx + 1]
    const firstSlide = nextItem?.slides[0]
    if (firstSlide) {
      stage.nextLines = firstSlide.lines
      stage.nextLabel = firstSlide.sectionLabel
      broadcastAll({ type: 'stageNext', nextLines: firstSlide.lines, nextSectionLabel: firstSlide.sectionLabel })
    } else {
      stage.nextLines = null
      stage.nextLabel = ''
    }
  }
}

function notifyControl(update: Record<string, unknown>): void {
  if (windows.control && !windows.control.isDestroyed()) {
    windows.control.webContents.send('pwa:stateUpdate', update)
  }
}

export function stopStageServer(): void {
  const pingInterval = getStagePingInterval()
  if (pingInterval) { clearInterval(pingInterval); setStagePingInterval(null) }
  const allClients = [...getSseClients(), ...getPwaClients()]
  allClients.forEach(c => {
    try { c.send({ type: 'shutdown' }) } catch { /* ignore */ }
    try { c.socket.destroy() } catch { /* ignore */ }
  })
  setSseClients([])
  setPwaClients([])
  getStageServer()?.close()
  setStageServer(null)
  const svc = getBonjourService()
  if (svc) {
    try { svc.stop() } catch { /* ignore */ }
    setBonjourService(null)
  }
}
