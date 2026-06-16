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

export interface PwaAnnouncementCard {
  id: string
  heading: string
  day?: string
  time?: string
  location?: string
  description?: string
}

export interface PwaSlide {
  idx: number
  sectionLabel: string
  sectionType: string
  lines: string[]
  cards?: PwaAnnouncementCard[]
}

export interface PwaItemTheme {
  fontFamily: string
  fontSize: number
  fontWeight: string
  textColor: string
  textAlign: string
  textPosition: string
  overlayOpacity: number
  textShadowOpacity: number
  maxLinesPerSlide: number
  accentColor?: string
}

export interface PwaLineupItem {
  id: number
  itemType: string
  title: string
  slides: PwaSlide[]
  mediaPath?: string | null
  backgroundPath?: string | null
  theme?: PwaItemTheme | null
  imageScaleMode?: string | null
  mediaSubtype?: 'image' | 'audio' | 'video' | null
}

export const stage: {
  slide: unknown
  blank: boolean
  logo: boolean
  countdown: unknown
  nextLines: string[] | null
  nextLabel: string
  nextItemType: string | null
  lineup: PwaLineupItem[]
  currentLineupIdx: number
  serviceDate: string | null
  serviceTime: string | null
  audioState: { isPlaying: boolean; currentTime: number; duration: number; lineupItemId: number } | null
  videoState: { isPlaying: boolean; currentTime: number; duration: number; lineupItemId: number } | null
} = {
  slide: null,
  blank: false,
  logo: false,
  countdown: null,
  nextLines: null,
  nextLabel: '',
  nextItemType: null,
  lineup: [],
  currentLineupIdx: -1,
  serviceDate: null,
  serviceTime: null,
  audioState: null,
  videoState: null,
}

// ── SSE clients ───────────────────────────────────────────────────────────────

// Stage display clients — receive slide/blank/logo/countdown/stageNext only
let _sseClients: StageClient[] = []

export function getSseClients(): StageClient[] { return _sseClients }
export function setSseClients(clients: StageClient[]): void { _sseClients = clients }

// PWA controller clients — receive all events including lineup/audioState/videoState
let _pwaClients: StageClient[] = []

export function getPwaClients(): StageClient[] { return _pwaClients }
export function setPwaClients(clients: StageClient[]): void { _pwaClients = clients }

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
