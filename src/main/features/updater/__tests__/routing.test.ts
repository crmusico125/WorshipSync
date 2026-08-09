import { describe, expect, it } from 'vitest'
import { decideAvailableRoute, decideDownloadedRoute } from '../routing'

describe('update event routing', () => {
  it('routes "update available" to the full dialog when not live', () => {
    expect(decideAvailableRoute(false)).toBe('full')
  })

  it('routes "update available" to a subtle notice when live', () => {
    expect(decideAvailableRoute(true)).toBe('subtle')
  })

  it('routes "update downloaded" to the restart prompt when not live', () => {
    expect(decideDownloadedRoute(false)).toBe('full')
  })

  it('defers "update downloaded" when live, rather than prompting mid-presentation', () => {
    expect(decideDownloadedRoute(true)).toBe('defer')
  })
})
