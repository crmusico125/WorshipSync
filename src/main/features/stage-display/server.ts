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

let _controllerPin: string | null = null

export function setControllerPin(pin: string | null): void { _controllerPin = pin ?? null }
export function getControllerPin(): string | null { return _controllerPin }

export function startStageServer(port = 4040, pin?: string | null): Promise<boolean> {
  if (pin !== undefined) _controllerPin = pin ?? null
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
      } else if (req.url === '/controller' || req.url?.startsWith('/controller?')) {
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
          pinRequired: !!_controllerPin,
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
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' })
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

    if (_controllerPin && cmd.pin !== _controllerPin) {
      res.writeHead(401, cors); res.end(JSON.stringify({ error: 'unauthorized' })); return
    }

    switch (cmd.action) {
      case 'blank': {
        const isBlank = Boolean(cmd.value)
        sendToOutputs('slide:blank', isBlank)
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
          sendToOutputs('slide:show', payload)
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
        projectSlide(stage.lineup.indexOf(item), slideIdx as number)
        break
      }
      case 'next-slide':
      case 'prev-slide': {
        const isNext = cmd.action === 'next-slide'
        const delta = isNext ? 1 : -1
        const item = stage.lineup[stage.currentLineupIdx]
        const cur = (stage.slide as any)?.slideIndex ?? 0
        const targetSlideIdx = cur + delta

        if (item?.slides.length) {
          if (targetSlideIdx >= 0 && targetSlideIdx < item.slides.length) {
            // Stay within current item
            projectSlide(stage.currentLineupIdx, targetSlideIdx)
          } else if (isNext) {
            // Past last slide — advance to first slide of next item (skip sections)
            let nextIdx = stage.currentLineupIdx + 1
            while (nextIdx < stage.lineup.length && stage.lineup[nextIdx]?.itemType === 'section') nextIdx++
            if (nextIdx < stage.lineup.length) projectSlide(nextIdx, 0)
          } else {
            // Before first slide — go to last slide of previous item (skip sections)
            let prevIdx = stage.currentLineupIdx - 1
            while (prevIdx >= 0 && stage.lineup[prevIdx]?.itemType === 'section') prevIdx--
            const prevItem = stage.lineup[prevIdx]
            if (prevItem?.slides.length) projectSlide(prevIdx, prevItem.slides.length - 1)
          }
        }
        break
      }
      case 'countdown': {
        const data = { targetTime: String(cmd.targetTime), running: Boolean(cmd.running) }
        sendToOutputs('slide:countdown', data)
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
      case 'ping':
        break  // no-op — used to verify PIN without side effects
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

// A slide counts as "real" content for the next-up preview if it isn't the synthetic
// terminal "blank" slide and has at least one non-empty line.
function isRealSlide(s: import('../../lib/state').PwaSlide): boolean {
  return s.sectionType !== 'blank' && s.lines.some(Boolean)
}

// Find the next slide with real content, searching forward within the current item
// then into subsequent lineup items — mirrors the desktop presenter's lookahead so
// the "next" preview never points at the synthetic blank slide or empty lines.
function findNextReal(lineupIdx: number, slideIdx: number): { nextLines: string[]; nextSectionLabel: string } | null {
  const item = stage.lineup[lineupIdx]
  if (item) {
    const real = item.slides.slice(slideIdx + 1).find(isRealSlide)
    if (real) return { nextLines: real.lines, nextSectionLabel: real.sectionLabel ?? '' }
  }
  for (let k = lineupIdx + 1; k < stage.lineup.length; k++) {
    const ni = stage.lineup[k]
    const real = ni.slides.find(isRealSlide)
    if (real) return { nextLines: real.lines, nextSectionLabel: `${ni.title} — ${real.sectionLabel ?? ''}` }
  }
  return null
}

function sendToOutputs(channel: string, ...args: unknown[]): void {
  if (windows.projection && !windows.projection.isDestroyed())
    windows.projection.webContents.send(channel, ...args)
  if (windows.confidence && !windows.confidence.isDestroyed())
    windows.confidence.webContents.send(channel, ...args)
}

// Sends slide:show — original payload to projection, next-lines-augmented to confidence.
function sendSlideShow(payload: ReturnType<typeof buildSlidePayload>, augmented: typeof payload & { nextLines?: string[]; nextSectionLabel?: string }): void {
  if (windows.projection && !windows.projection.isDestroyed())
    windows.projection.webContents.send('slide:show', payload)
  if (windows.confidence && !windows.confidence.isDestroyed())
    windows.confidence.webContents.send('slide:show', augmented)
}

// Project a slide to projection/confidence/stage-display. The synthetic terminal
// "blank" slide is treated like the desktop presenter's blank toggle — it blacks out
// the screen instead of projecting an empty slide — so the enlarged "next song"
// preview on stage display / confidence monitor can take over the empty center area.
function projectSlide(lineupIdx: number, slideIdx: number): void {
  const item = stage.lineup[lineupIdx]
  if (!item) return
  const slide = item.slides[slideIdx]
  if (!slide) return

  stage.currentLineupIdx = lineupIdx

  if (slide.sectionType === 'blank') {
    // Bump the tracked slide index so subsequent next/prev presses advance past
    // the blank slide, without touching the previously-projected slide content.
    stage.slide = { ...(stage.slide as Record<string, unknown> ?? {}), slideIndex: slideIdx }
    stage.blank = true
    stage.logo = false
    sendToOutputs('slide:blank', true)
    broadcastAll({ type: 'blank', isBlank: true, lineupIdx, slideIdx })
    broadcastStageNext(lineupIdx, slideIdx)
    notifyControl({ type: 'blank', isBlank: true, lineupIdx, slideIdx })
    return
  }

  const payload = buildSlidePayload(item, slide)
  const next = findNextReal(lineupIdx, slideIdx)
  const augmented = next ? { ...payload, ...next } : payload
  sendSlideShow(payload, augmented)
  stage.slide = payload
  stage.blank = false
  stage.logo = false
  broadcastAll({ type: 'slide', payload: augmented, lineupIdx, slideIdx })
  broadcastStageNext(lineupIdx, slideIdx)
  notifyControl({ type: 'slide', lineupIdx, slideIdx })
}

function broadcastStageNext(lineupIdx: number, slideIdx: number): void {
  const next = findNextReal(lineupIdx, slideIdx)
  const data = { nextLines: next?.nextLines ?? [], nextSectionLabel: next?.nextSectionLabel ?? '' }
  stage.nextLines = next ? data.nextLines : null
  stage.nextLabel = data.nextSectionLabel
  broadcastAll({ type: 'stageNext', ...data })
  if (windows.confidence && !windows.confidence.isDestroyed())
    windows.confidence.webContents.send('slide:stageNext', data)
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
