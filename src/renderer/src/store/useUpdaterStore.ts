import { create } from 'zustand'

type UpdaterState = Awaited<ReturnType<typeof window.worshipsync.updater.getState>>
type UpdaterEventPayload = Parameters<Parameters<typeof window.worshipsync.updater.onEvent>[0]>[0]
type UpdaterSubtlePayload = Parameters<Parameters<typeof window.worshipsync.updater.onSubtle>[0]>[0]

interface UpdaterStoreState extends UpdaterState {
  subtleNotice: UpdaterSubtlePayload | null
  dismissed: boolean
  initialized: boolean
  init: () => void
  checkForUpdates: () => Promise<void>
  downloadUpdate: () => Promise<void>
  installUpdate: () => Promise<void>
  dismiss: () => void
  dismissSubtle: () => void
}

// Single shared source of truth for update status — mirrors main's UpdaterState
// exactly and reacts to its event stream. Initialized once from App.tsx;
// UpdateDialog / the subtle toast / the Settings tab all just read this, none
// of them talk to the main process directly.
export const useUpdaterStore = create<UpdaterStoreState>((set, get) => ({
  status: 'idle',
  currentVersion: '',
  latestVersion: null,
  releaseNotes: null,
  progress: null,
  errorMessage: null,
  lastCheckedAt: null,
  subtleNotice: null,
  dismissed: false,
  initialized: false,

  init: () => {
    if (get().initialized) return
    set({ initialized: true })

    window.worshipsync.updater.getState().then((s) => set({ ...s })).catch(() => {})

    window.worshipsync.updater.onEvent((payload: UpdaterEventPayload) => {
      switch (payload.type) {
        case 'checking-for-update':
          set({ status: 'checking', errorMessage: null, lastCheckedAt: payload.lastCheckedAt })
          break
        case 'update-available':
          set({ status: 'available', latestVersion: payload.info.version, releaseNotes: payload.info.releaseNotes, dismissed: false })
          break
        case 'update-not-available':
          set({ status: 'not-available', currentVersion: payload.currentVersion })
          break
        case 'download-progress':
          set({ status: 'downloading', progress: payload.progress })
          break
        case 'update-downloaded':
          set({ status: 'downloaded', latestVersion: payload.info.version, releaseNotes: payload.info.releaseNotes, progress: null, dismissed: false })
          break
        case 'error':
          set({ status: 'error', errorMessage: payload.message })
          break
      }
    })

    window.worshipsync.updater.onSubtle((payload: UpdaterSubtlePayload) => {
      set({ subtleNotice: payload })
    })
  },

  checkForUpdates: async () => {
    await window.worshipsync.updater.checkForUpdates()
  },
  downloadUpdate: async () => {
    await window.worshipsync.updater.downloadUpdate()
  },
  installUpdate: async () => {
    await window.worshipsync.updater.installUpdate()
  },
  dismiss: () => set({ dismissed: true }),
  dismissSubtle: () => set({ subtleNotice: null }),
}))
