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

/**
 * Looks up whether a package is waiting in the workspace for this specific
 * local service — matched by sync_uuid first (a service this device already
 * knows is linked to that package), falling back to matching on the service's
 * date. The date fallback covers a service that exists locally but was never
 * synced before (created independently on this computer, or synced from
 * before this device knew about this chain) — without it, a same-date
 * package from another computer only ever surfaced in Settings > Sync,
 * never as an action on the service itself. Excludes 'already-imported'
 * packages, since those mean this exact package is already fully applied
 * somewhere on this device.
 */
export function findUpdateForService(syncUuid: string | null | undefined, date?: string | null): AvailablePackage | null {
  const { availablePackages } = useSyncStore.getState()
  if (syncUuid) {
    const bySyncUuid = availablePackages.find(p => p.manifest.packageId === syncUuid && p.localState === 'update-available')
    if (bySyncUuid) return bySyncUuid
  }
  if (date) {
    return availablePackages.find(p => p.manifest.serviceDate === date && p.manifest.packageId !== syncUuid && p.localState !== 'already-imported') ?? null
  }
  return null
}
