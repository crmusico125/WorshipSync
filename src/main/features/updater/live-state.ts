import { windows, stage } from '../../lib/state'

/**
 * Whether a service is actively being presented right now — projection
 * window open, a countdown running, or media (audio/video) playing. Reads
 * state the app already maintains for the stage/PWA broadcast feature
 * (`lib/state.ts`); this module never mutates it and nothing else needs to
 * know the updater reads it.
 */
export function isLivePresentationActive(): boolean {
  const projectionActive = !!(windows.projection && !windows.projection.isDestroyed())
  const countdownRunning = !!(stage.countdown as { running?: boolean } | null)?.running
  const videoPlaying = !!stage.videoState?.isPlaying
  const audioPlaying = !!stage.audioState?.isPlaying
  return projectionActive || countdownRunning || videoPlaying || audioPlaying
}
