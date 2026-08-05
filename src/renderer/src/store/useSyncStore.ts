import { create } from 'zustand'

type AvailablePackage = Awaited<ReturnType<typeof window.worshipsync.sync.checkWorkspace>>[number]

interface SyncStoreState {
  workspaceReady: boolean
  availablePackages: AvailablePackage[]
  updateCount: number
  checked: boolean
  refresh: () => Promise<void>
}

// Single shared source of truth for "is a Sync Workspace configured" and
// "what packages are sitting in it" — fetched once and shared across every
// screen that shows a Publish/Import button or the Settings badge, instead
// of each one independently re-fetching the same status.
export const useSyncStore = create<SyncStoreState>((set) => ({
  workspaceReady: false,
  availablePackages: [],
  updateCount: 0,
  checked: false,
  refresh: async () => {
    try {
      const status = await window.worshipsync.sync.getStatus()
      if (!status.workspaceFolder) {
        set({ workspaceReady: false, availablePackages: [], updateCount: 0, checked: true })
        return
      }
      const packages = await window.worshipsync.sync.checkWorkspace()
      set({
        workspaceReady: true,
        availablePackages: packages,
        updateCount: packages.filter(p => p.localState !== 'already-imported').length,
        checked: true,
      })
    } catch {
      set({ workspaceReady: false, availablePackages: [], updateCount: 0, checked: true })
    }
  },
}))

/** Looks up whether a newer version of this specific service (by its sync_uuid) is waiting in the workspace. */
export function findUpdateForService(syncUuid: string | null | undefined): AvailablePackage | null {
  if (!syncUuid) return null
  const { availablePackages } = useSyncStore.getState()
  return availablePackages.find(p => p.manifest.packageId === syncUuid && p.localState === 'update-available') ?? null
}
