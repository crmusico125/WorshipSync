import type { BrowserWindow } from 'electron'
import type { Socket } from 'net'
import type { Server } from 'http'
import { Bonjour } from 'bonjour-service'

// ── Stage client interface ────────────────────────────────────────────────────

export interface StageClient {
  socket: Socket
  send: (event: unknown) => boolean
  ping: () => boolean
  ip: string
  userAgent: string
  connectedAt: number
}

// ── Window state ──────────────────────────────────────────────────────────────

export const windows: {
  control: BrowserWindow | null
  projection: BrowserWindow | null
  confidence: BrowserWindow | null
} = {
  control: null,
  projection: null,
  confidence: null,
}

// ── Stage display state ───────────────────────────────────────────────────────

export const stage: {
  slide: unknown
  blank: boolean
  countdown: unknown
  nextLines: string[] | null
  nextLabel: string
} = {
  slide: null,
  blank: false,
  countdown: null,
  nextLines: null,
  nextLabel: '',
}

// ── SSE clients ───────────────────────────────────────────────────────────────

let _sseClients: StageClient[] = []

export function getSseClients(): StageClient[] {
  return _sseClients
}

export function setSseClients(clients: StageClient[]): void {
  _sseClients = clients
}

// ── Stage server ──────────────────────────────────────────────────────────────

let _stageServer: Server | null = null
let _stagePort = 4040
let _stagePingInterval: ReturnType<typeof setInterval> | null = null

export function getStageServer(): Server | null {
  return _stageServer
}

export function setStageServer(server: Server | null): void {
  _stageServer = server
}

export function getStagePort(): number {
  return _stagePort
}

export function setStagePort(port: number): void {
  _stagePort = port
}

export function getStagePingInterval(): ReturnType<typeof setInterval> | null {
  return _stagePingInterval
}

export function setStagePingInterval(interval: ReturnType<typeof setInterval> | null): void {
  _stagePingInterval = interval
}

// ── Power save / display tracking ─────────────────────────────────────────────

let _powerSaveBlockerId: number | null = null
let _confidenceWasOpen = false
let _confidenceLastDisplayId: number | undefined
let _movingProjection = false

export function getPowerSaveBlockerId(): number | null {
  return _powerSaveBlockerId
}

export function setPowerSaveBlockerId(id: number | null): void {
  _powerSaveBlockerId = id
}

export function getConfidenceWasOpen(): boolean {
  return _confidenceWasOpen
}

export function setConfidenceWasOpen(val: boolean): void {
  _confidenceWasOpen = val
}

export function getConfidenceLastDisplayId(): number | undefined {
  return _confidenceLastDisplayId
}

export function setConfidenceLastDisplayId(id: number | undefined): void {
  _confidenceLastDisplayId = id
}

export function getMovingProjection(): boolean {
  return _movingProjection
}

export function setMovingProjection(val: boolean): void {
  _movingProjection = val
}

// ── Bonjour ───────────────────────────────────────────────────────────────────

export const bonjour = new Bonjour()

let _bonjourService: ReturnType<typeof bonjour.publish> | null = null

export function getBonjourService(): ReturnType<typeof bonjour.publish> | null {
  return _bonjourService
}

export function setBonjourService(svc: ReturnType<typeof bonjour.publish> | null): void {
  _bonjourService = svc
}
