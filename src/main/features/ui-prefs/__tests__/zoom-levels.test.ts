import { describe, expect, it } from 'vitest'
import { DEFAULT_ZOOM, ZOOM_LEVELS, isZoomLevel, nearestZoomLevel, nextZoomLevel } from '../zoom-levels'

describe('zoom levels', () => {
  it('exposes exactly the six supported levels in ascending order', () => {
    expect(ZOOM_LEVELS).toEqual([75, 90, 100, 110, 125, 150])
  })

  it('defaults to 100%', () => {
    expect(DEFAULT_ZOOM).toBe(100)
  })

  it('recognizes supported levels', () => {
    for (const level of ZOOM_LEVELS) expect(isZoomLevel(level)).toBe(true)
    expect(isZoomLevel(105)).toBe(false)
  })

  it('steps up through every level in order', () => {
    let level: number = 75
    const seen = [level]
    for (let i = 0; i < ZOOM_LEVELS.length - 1; i++) {
      level = nextZoomLevel(level, 'in')
      seen.push(level)
    }
    expect(seen).toEqual([...ZOOM_LEVELS])
  })

  it('steps down through every level in order', () => {
    let level: number = 150
    const seen = [level]
    for (let i = 0; i < ZOOM_LEVELS.length - 1; i++) {
      level = nextZoomLevel(level, 'out')
      seen.push(level)
    }
    expect(seen).toEqual([...ZOOM_LEVELS].reverse())
  })

  it('clamps at the maximum — zooming in at 150% stays at 150%', () => {
    expect(nextZoomLevel(150, 'in')).toBe(150)
  })

  it('clamps at the minimum — zooming out at 75% stays at 75%', () => {
    expect(nextZoomLevel(75, 'out')).toBe(75)
  })

  it('snaps an arbitrary persisted value to the nearest supported level', () => {
    expect(nearestZoomLevel(103)).toBe(100)
    expect(nearestZoomLevel(117)).toBe(110)
    expect(nearestZoomLevel(140)).toBe(150)
    expect(nearestZoomLevel(60)).toBe(75)
    expect(nearestZoomLevel(200)).toBe(150)
  })

  it('stepping from a non-standard current value first snaps, then steps', () => {
    expect(nextZoomLevel(103, 'in')).toBe(110)
    expect(nextZoomLevel(103, 'out')).toBe(90)
  })
})
