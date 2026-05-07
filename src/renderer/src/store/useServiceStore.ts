import { create } from 'zustand'

export type LineupItemType = 'song' | 'scripture' | 'media' | 'countdown' | 'announcement' | 'note'

export interface LineupItem {
  id: number
  serviceDateId: number
  songId: number | null
  itemType: LineupItemType
  orderIndex: number
  selectedSections: string
  overrideThemeId: number | null
  overrideBackgroundPath: string | null
  notes: string | null
  title: string | null
  scriptureRef: string | null
  mediaPath: string | null
  song: {
    id: number
    title: string
    artist: string
    key: string | null
    tempo: string | null
    ccliNumber: string | null
    backgroundPath: string | null
    themeId: number | null
    sections: { id: number; songId: number; type: string; label: string; lyrics: string; orderIndex: number }[]
  } | null
}

export interface ServiceDate {
  id: number
  date: string
  label: string
  status: 'empty' | 'in-progress' | 'ready'
  notes: string | null
  createdAt: string
  updatedAt: string
}

interface ServiceStore {
  services: ServiceDate[]
  selectedService: ServiceDate | null
  lineup: LineupItem[]
  loading: boolean

  loadServices: () => Promise<void>
  selectService: (service: ServiceDate) => Promise<void>
  createService: (date: string, label: string) => Promise<ServiceDate>
  updateService: (id: number, data: { label?: string; date?: string }) => Promise<void>
  updateStatus: (id: number, status: 'empty' | 'in-progress' | 'ready') => Promise<void>
  deleteService: (id: number) => Promise<void>

  loadLineup: (serviceDateId: number) => Promise<void>
  addSongToLineup: (songId: number) => Promise<void>
  addScriptureToLineup: (data: { title: string; scriptureRef: string }) => Promise<void>
  addMediaToLineup: (data: { title: string; mediaPath: string }) => Promise<void>
  addCountdownToLineup: () => Promise<void>
  removeSongFromLineup: (lineupItemId: number) => Promise<void>
  toggleSection: (lineupItemId: number, sectionId: number, included: boolean) => Promise<void>
  reorderLineup: (orderedIds: number[]) => Promise<void>
}

export const useServiceStore = create<ServiceStore>((set, get) => ({
  services: [],
  selectedService: null,
  lineup: [],
  loading: false,

  loadServices: async () => {
    set({ loading: true })
    const services = await window.worshipsync.services.getAll()
    set({ services, loading: false })
  },

  selectService: async (service: ServiceDate) => {
    set({ selectedService: service })
    await get().loadLineup(service.id)
  },

  createService: async (date: string, label: string) => {
    const service = await window.worshipsync.services.create({ date, label, status: 'empty' }) as ServiceDate
    await get().loadServices()
    return service
  },

  updateService: async (id: number, data: { label?: string; date?: string }) => {
    await window.worshipsync.services.update(id, data)
    await get().loadServices()
    const updated = get().services.find(s => s.id === id)
    if (updated && get().selectedService?.id === id) set({ selectedService: updated })
  },

  updateStatus: async (id: number, status: 'empty' | 'in-progress' | 'ready') => {
    await window.worshipsync.services.updateStatus(id, status)
    await get().loadServices()
    const updated = get().services.find(s => s.id === id)
    if (updated) set({ selectedService: updated })
  },

  deleteService: async (id: number) => {
    await window.worshipsync.services.delete(id)
    set({ selectedService: null, lineup: [] })
    await get().loadServices()
  },

  loadLineup: async (serviceDateId: number) => {
    const lineup = await window.worshipsync.lineup.getForService(serviceDateId) as LineupItem[]
    set({ lineup })
  },

  addSongToLineup: async (songId: number) => {
    const { selectedService } = get()
    if (!selectedService) return
    await window.worshipsync.lineup.addSong(selectedService.id, songId)
    await get().loadLineup(selectedService.id)
    if (selectedService.status === 'empty') await get().updateStatus(selectedService.id, 'in-progress')
  },

  addScriptureToLineup: async (data: { title: string; scriptureRef: string }) => {
    const { selectedService } = get()
    if (!selectedService) return
    await window.worshipsync.lineup.addScripture(selectedService.id, data)
    await get().loadLineup(selectedService.id)
    if (selectedService.status === 'empty') await get().updateStatus(selectedService.id, 'in-progress')
  },

  addMediaToLineup: async (data: { title: string; mediaPath: string }) => {
    const { selectedService } = get()
    if (!selectedService) return
    await window.worshipsync.lineup.addMedia(selectedService.id, data)
    await get().loadLineup(selectedService.id)
    if (selectedService.status === 'empty') await get().updateStatus(selectedService.id, 'in-progress')
  },

  addCountdownToLineup: async () => {
    const { selectedService } = get()
    if (!selectedService) return
    await window.worshipsync.lineup.addCountdown(selectedService.id)
    await get().loadLineup(selectedService.id)
    if (selectedService.status === 'empty') await get().updateStatus(selectedService.id, 'in-progress')
  },

  removeSongFromLineup: async (lineupItemId: number) => {
    const { selectedService } = get()
    if (!selectedService) return
    await window.worshipsync.lineup.removeSong(lineupItemId)
    await get().loadLineup(selectedService.id)
  },

  toggleSection: async (lineupItemId: number, sectionId: number, included: boolean) => {
    await window.worshipsync.lineup.toggleSection(lineupItemId, sectionId, included)
    const { selectedService } = get()
    if (selectedService) await get().loadLineup(selectedService.id)
  },

  reorderLineup: async (orderedIds: number[]) => {
    const { selectedService } = get()
    if (!selectedService) return
    await window.worshipsync.lineup.reorder(selectedService.id, orderedIds)
    await get().loadLineup(selectedService.id)
  }
}))
