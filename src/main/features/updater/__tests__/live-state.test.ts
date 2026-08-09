import { afterEach, describe, expect, it } from 'vitest'
import { windows, stage } from '../../../lib/state'
import { isLivePresentationActive } from '../live-state'

function resetState(): void {
  windows.projection = null
  stage.countdown = null
  stage.videoState = null
  stage.audioState = null
}

describe('isLivePresentationActive', () => {
  afterEach(resetState)

  it('is false when nothing is happening', () => {
    expect(isLivePresentationActive()).toBe(false)
  })

  it('is true when the projection window is open', () => {
    windows.projection = { isDestroyed: () => false } as any
    expect(isLivePresentationActive()).toBe(true)
  })

  it('is false when the projection window reference is destroyed', () => {
    windows.projection = { isDestroyed: () => true } as any
    expect(isLivePresentationActive()).toBe(false)
  })

  it('is true when a countdown is running', () => {
    stage.countdown = { targetTime: new Date().toISOString(), running: true }
    expect(isLivePresentationActive()).toBe(true)
  })

  it('is false when a countdown exists but is not running', () => {
    stage.countdown = { targetTime: new Date().toISOString(), running: false }
    expect(isLivePresentationActive()).toBe(false)
  })

  it('is true when video is playing', () => {
    stage.videoState = { isPlaying: true, currentTime: 0, duration: 100, lineupItemId: 1 }
    expect(isLivePresentationActive()).toBe(true)
  })

  it('is false when video exists but is paused', () => {
    stage.videoState = { isPlaying: false, currentTime: 0, duration: 100, lineupItemId: 1 }
    expect(isLivePresentationActive()).toBe(false)
  })

  it('is true when audio is playing', () => {
    stage.audioState = { isPlaying: true, currentTime: 0, duration: 100, lineupItemId: 1 }
    expect(isLivePresentationActive()).toBe(true)
  })

  it('ORs every condition together', () => {
    stage.videoState = { isPlaying: false, currentTime: 0, duration: 100, lineupItemId: 1 }
    stage.countdown = { targetTime: new Date().toISOString(), running: false }
    expect(isLivePresentationActive()).toBe(false)
    windows.projection = { isDestroyed: () => false } as any
    expect(isLivePresentationActive()).toBe(true)
  })
})
