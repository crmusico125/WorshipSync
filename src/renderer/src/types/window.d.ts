// Extends the global Window interface so TypeScript knows about
// the API we expose via contextBridge in preload/index.ts

import type { SlidePayload } from '../../../shared/types'

declare global {
  interface Window {
    WorshipSync: {
      slide: {
        show: (payload: SlidePayload) => void
        blank: (isBlank: boolean) => void
        logo: (show: boolean) => void
        onShow: (cb: (payload: SlidePayload) => void) => () => void
        onBlank: (cb: (isBlank: boolean) => void) => () => void
        onLogo: (cb: (show: boolean) => void) => () => void
      }
      window: {
        getDisplayCount: () => Promise<number>
        openProjection: () => void
        closeProjection: () => void
        onProjectionReady: (cb: () => void) => () => void
      }
      projection: {
        ready: () => void
      }
    }
  }
}

export {}