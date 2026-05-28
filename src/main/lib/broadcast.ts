import { getSseClients, setSseClients, getPwaClients, setPwaClients } from './state'

/** Send to both stage display and PWA controller clients (slide, blank, logo, countdown, stageNext). */
export function broadcastAll(event: unknown): void {
  const stamped = Object.assign({}, event as object, { sentAt: Date.now() })
  setSseClients(getSseClients().filter(c => c.send(stamped)))
  setPwaClients(getPwaClients().filter(c => c.send(stamped)))
}

/** Send only to PWA controller clients (lineup, audioState, videoState). */
export function broadcastPwa(event: unknown): void {
  const stamped = Object.assign({}, event as object, { sentAt: Date.now() })
  setPwaClients(getPwaClients().filter(c => c.send(stamped)))
}

export function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}
