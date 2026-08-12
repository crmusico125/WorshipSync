import { create } from 'zustand'

type UiPrefsState = Awaited<ReturnType<typeof window.worshipsync.uiPrefs.getState>>
type UiPrefsEvent = Parameters<Parameters<typeof window.worshipsync.uiPrefs.onEvent>[0]>[0]

interface UiPrefsStoreState extends UiPrefsState {
  initialized: boolean
  init: () => void
  setZoom: (percent: number) => Promise<void>
  zoomIn: () => Promise<void>
  zoomOut: () => Promise<void>
  resetZoom: () => Promise<void>
  setDensity: (density: UiPrefsState['density']) => Promise<void>
}

// Single shared source of truth for zoom/density — main process owns the
// real state (and is the only place webContents.setZoomFactor is ever
// called); this store just mirrors it via getState() + the event stream,
// matching the useSyncStore/useUpdaterStore pattern already used this
// session. Initialized once from App.tsx.
export const useUiPrefsStore = create<UiPrefsStoreState>((set, get) => ({
  zoomPercent: 100,
  density: 'comfortable',
  initialized: false,

  init: () => {
    if (get().initialized) return
    set({ initialized: true })

    window.worshipsync.uiPrefs.getState().then((s) => set({ ...s })).catch(() => {})

    window.worshipsync.uiPrefs.onEvent((payload: UiPrefsEvent) => {
      if (payload.type === 'zoom-changed') set({ zoomPercent: payload.zoomPercent })
      else if (payload.type === 'density-changed') set({ density: payload.density })
    })
  },

  setZoom: async (percent) => { await window.worshipsync.uiPrefs.setZoom(percent) },
  zoomIn: async () => { await window.worshipsync.uiPrefs.zoomIn() },
  zoomOut: async () => { await window.worshipsync.uiPrefs.zoomOut() },
  resetZoom: async () => { await window.worshipsync.uiPrefs.resetZoom() },
  setDensity: async (density) => { await window.worshipsync.uiPrefs.setDensity(density) },
}))
