import { existsSync, unlinkSync } from 'fs'
import { app } from 'electron'
import { atomicWriteJSON, readJSONSafe } from './atomic-fs'
import type { WorshipSyncPaths } from './paths'

export interface LockInfo {
  deviceId: string
  deviceName: string
  processId: number
  appVersion: string
  openedAt: string
  lastHeartbeatAt: string
  sessionId: string
}

export const HEARTBEAT_INTERVAL_MS = 30_000
// 3 missed heartbeats — generous enough to absorb a slow sync round-trip or
// a brief system sleep without misreporting a live session as stale.
export const STALE_LOCK_THRESHOLD_MS = HEARTBEAT_INTERVAL_MS * 3

export type LockInspection =
  | { state: 'none' }
  | { state: 'fresh'; lock: LockInfo }
  | { state: 'stale'; lock: LockInfo }
  | { state: 'corrupt' }

/**
 * Reads and classifies whatever lock file currently exists. Deliberately
 * never uses processId to judge liveness — a PID from another machine means
 * nothing on this one. Only heartbeat age matters.
 */
export function inspectLock(paths: WorshipSyncPaths): LockInspection {
  if (!existsSync(paths.lockFile)) return { state: 'none' }
  const lock = readJSONSafe<LockInfo | null>(paths.lockFile, null)
  if (!lock || !lock.lastHeartbeatAt || !lock.deviceId || !lock.sessionId) {
    return { state: 'corrupt' }
  }
  const age = Date.now() - new Date(lock.lastHeartbeatAt).getTime()
  if (!Number.isFinite(age) || age < 0 || age > STALE_LOCK_THRESHOLD_MS) {
    return { state: 'stale', lock }
  }
  return { state: 'fresh', lock }
}

/** Writes a brand-new lock, unconditionally. Callers must have already decided this is safe. */
export function writeLock(paths: WorshipSyncPaths, deviceId: string, deviceName: string): LockInfo {
  const now = new Date().toISOString()
  const lock: LockInfo = {
    deviceId,
    deviceName,
    processId: process.pid,
    appVersion: app.getVersion(),
    openedAt: now,
    lastHeartbeatAt: now,
    sessionId: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  }
  atomicWriteJSON(paths.lockFile, lock)
  return lock
}

export function refreshHeartbeat(paths: WorshipSyncPaths, lock: LockInfo): LockInfo {
  const updated: LockInfo = { ...lock, lastHeartbeatAt: new Date().toISOString() }
  atomicWriteJSON(paths.lockFile, updated)
  return updated
}

/**
 * Starts the periodic heartbeat. Returns a stop function; caller is
 * responsible for calling it (and releaseLock separately) on shutdown.
 */
export function startHeartbeat(paths: WorshipSyncPaths, lock: LockInfo): { stop: () => void } {
  let current = lock
  const timer = setInterval(() => {
    try {
      current = refreshHeartbeat(paths, current)
    } catch (e) {
      console.error('[storage] failed to refresh lock heartbeat:', e)
    }
  }, HEARTBEAT_INTERVAL_MS)
  timer.unref?.()
  return { stop: () => clearInterval(timer) }
}

/** Removes the lock file — only if it still belongs to us, so we never clobber a newer lock. */
export function releaseLock(paths: WorshipSyncPaths, ourDeviceId: string, ourSessionId: string): void {
  const current = readJSONSafe<LockInfo | null>(paths.lockFile, null)
  if (!current) return
  if (current.deviceId !== ourDeviceId || current.sessionId !== ourSessionId) return
  try {
    unlinkSync(paths.lockFile)
  } catch (e) {
    console.error('[storage] failed to remove lock file on shutdown:', e)
  }
}
