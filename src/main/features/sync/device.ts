import { app } from 'electron'
import { hostname } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { atomicWriteJSON, readJSONSafe } from './atomic-json'

export interface DeviceIdentity {
  deviceId: string
  deviceName: string
}

function deviceFilePath(): string {
  return join(app.getPath('userData'), 'sync-device.json')
}

/** Generates and persists a stable device identity on first call; returns the same one on every call after. */
export function getDeviceIdentity(): DeviceIdentity {
  const filePath = deviceFilePath()
  const existing = readJSONSafe<Partial<DeviceIdentity>>(filePath, {})
  if (existing.deviceId && existing.deviceName) {
    return { deviceId: existing.deviceId, deviceName: existing.deviceName }
  }
  const identity: DeviceIdentity = {
    deviceId: existing.deviceId ?? randomUUID(),
    deviceName: existing.deviceName ?? hostname(),
  }
  atomicWriteJSON(filePath, identity)
  return identity
}
