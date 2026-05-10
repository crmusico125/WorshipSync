import { useEffect, useState, useMemo, useRef } from "react"
import {
  Plus, BookOpen, Trash2, Pencil,
  Radio, Eye, Music2, Calendar, Image as ImageIcon,
  Monitor, Timer, GripVertical, X, Megaphone,
  Play, Pause, SkipBack, SkipForward, Repeat, ListTodo,
} from "lucide-react"
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext, useSortable, verticalListSortingStrategy,
  horizontalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { useServiceStore, type LineupItem as LineupItemWithSong } from "../store/useServiceStore"
import { useSongStore } from "../store/useSongStore"
import LibraryModal from "../components/LibraryModal"
import AddSongModal from "../components/AddSongModal"
import EditLyricsModal from "../components/EditLyricsModal"
import BackgroundPickerPanel from "../components/BackgroundPickerPanel"

// ── Types ────────────────────────────────────────────────────────────────────

interface Slide {
  lines: string[]
  sectionLabel: string
  sectionType: string
  sectionId: number
}

interface ThemeStyle {
  fontFamily: string
  fontSize: number
  fontWeight: string
  textColor: string
  textAlign: "left" | "center" | "right"
  textPosition: "top" | "middle" | "bottom"
  overlayOpacity: number
  textShadowOpacity: number
  maxLinesPerSlide: number
}

const DEFAULT_THEME: ThemeStyle = {
  fontFamily: "Montserrat, sans-serif",
  fontSize: 48,
  fontWeight: "600",
  textColor: "#ffffff",
  textAlign: "center",
  textPosition: "middle",
  overlayOpacity: 45,
  textShadowOpacity: 40,
  maxLinesPerSlide: 2,
}

const SECTION_BADGE_COLORS: Record<string, string> = {
  verse: "bg-green-600",
  chorus: "bg-blue-600",
  bridge: "bg-amber-600",
  "pre-chorus": "bg-violet-600",
  intro: "bg-slate-600",
  outro: "bg-slate-600",
  tag: "bg-red-600",
  interlude: "bg-slate-600",
}


function buildSlides(
  sections: { id: number; type: string; label: string; lyrics: string }[],
  maxLines = 2,
): Slide[] {
  const slides: Slide[] = []
  for (const sec of sections) {
    // Split into paragraphs on blank lines — each paragraph boundary forces a new slide
    const paragraphs: string[][] = []
    let current: string[] = []
    for (const line of sec.lyrics.split("\n")) {
      if (line.trim() === "") {
        if (current.length > 0) { paragraphs.push(current); current = [] }
      } else {
        current.push(line)
      }
    }
    if (current.length > 0) paragraphs.push(current)

    if (paragraphs.length === 0) {
      slides.push({
        lines: [""],
        sectionLabel: sec.label,
        sectionType: sec.type,
        sectionId: sec.id,
      })
      continue
    }
    for (const para of paragraphs) {
      for (let i = 0; i < para.length; i += maxLines) {
        slides.push({
          lines: para.slice(i, i + maxLines),
          sectionLabel: sec.label,
          sectionType: sec.type,
          sectionId: sec.id,
        })
      }
    }
  }
  return slides
}

function sectionsToLyrics(sections: { label: string; lyrics: string }[]): string {
  return sections.map(s => `[${s.label}]\n${s.lyrics}`).join("\n\n")
}

// ── Announcement style ────────────────────────────────────────────────────────

interface AnnouncementStyle {
  fontSize: number
  fontWeight: string
  textColor: string
  textAlign: 'left' | 'center' | 'right'
}

const DEFAULT_ANNOUNCEMENT_STYLE: AnnouncementStyle = {
  fontSize: 48,
  fontWeight: '600',
  textColor: '#ffffff',
  textAlign: 'center',
}

const ANNOUNCEMENT_FONT_SIZES = [
  { label: 'S', value: 32 },
  { label: 'M', value: 48 },
  { label: 'L', value: 64 },
  { label: 'XL', value: 80 },
]

const ANNOUNCEMENT_COLORS = ['#ffffff', '#fef08a', '#93c5fd', '#86efac', '#fca5a5', '#e879f9']

function parseAnnouncementStyle(json: string | null | undefined): AnnouncementStyle {
  if (!json) return DEFAULT_ANNOUNCEMENT_STYLE
  try { return { ...DEFAULT_ANNOUNCEMENT_STYLE, ...JSON.parse(json) } } catch { return DEFAULT_ANNOUNCEMENT_STYLE }
}

// ── Setlist templates ──────────────────────────────────────────────────────────

interface SetlistTemplateItem {
  itemType: string
  songId?: number
  songTitle?: string
  title?: string
}

interface SetlistTemplate {
  id: string
  name: string
  createdAt: string
  items: SetlistTemplateItem[]
}

// ── Duration helpers ─────────────────────────────────────────────────────────

function estimateDuration(item: LineupItemWithSong, themeCache: Record<number, any>): number {
  if (item.itemType === 'countdown') return 300
  if (item.itemType === 'scripture') {
    try { return (JSON.parse(item.scriptureRef ?? '{}').verses ?? []).length * 12 } catch { return 0 }
  }
  if (item.itemType === 'media') return 0
  if (!item.song) return 0
  let maxLines = 2
  if (item.song.themeId && themeCache[item.song.themeId]?.settings) {
    try { maxLines = JSON.parse(themeCache[item.song.themeId].settings).maxLinesPerSlide ?? 2 } catch {}
  }
  const sc = buildSlides(item.song.sections, maxLines).length
  return sc * 15
}

function fmtDur(sec: number): string | null {
  if (sec <= 0) return null
  const m = Math.floor(sec / 60); const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function fmtTotal(sec: number): string {
  const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60)
  return h > 0 ? `${h}h ${m > 0 ? `${m}m` : ''}`.trim() : `${m}m`
}

// ── Main Screen ──────────────────────────────────────────────────────────────

interface Props {
  serviceId: number | null
  onGoLive: () => void
  projectionOpen?: boolean
  onReturnToPresenter?: () => void
}

export default function BuilderScreen({ serviceId, onGoLive, projectionOpen, onReturnToPresenter }: Props) {
  const {
    selectedService, lineup, loadLineup, addSongToLineup, addCountdownToLineup,
    addScriptureToLineup, addMediaToLineup,
    removeSongFromLineup, loadServices, selectService,
    services, reorderLineup, updateStatus, updateService,
    patchLineupItemSectionOrder, setMediaLoop, addAnnouncementToLineup,
  } = useServiceStore()
  const { loadSongs } = useSongStore()

  const [showLibrary, setShowLibrary] = useState(false)
  const [showEditService, setShowEditService] = useState(false)
  const [showAddSong, setShowAddSong] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [templates, setTemplates] = useState<SetlistTemplate[]>([])
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState("")
  const [applyingTemplate, setApplyingTemplate] = useState(false)
  const [editingItemId, setEditingItemId] = useState<number | null>(null)
  const [selectedSongIdx, setSelectedSongIdx] = useState(0)
  const [previewSlideIdx, setPreviewSlideIdx] = useState(0)
  const [notesMap, setNotesMap] = useState<Record<number, string>>({})
  const notesTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})
  const themeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingThemeRef = useRef<Partial<ThemeStyle>>({})
  const announcementTimers = useRef<{ title?: ReturnType<typeof setTimeout>; content?: ReturnType<typeof setTimeout> }>({})

  // Media preview (builder — local only, no projection)
  const [previewVideoPlaying, setPreviewVideoPlaying] = useState(false)
  const [previewVideoTime, setPreviewVideoTime] = useState(0)
  const [previewVideoDuration, setPreviewVideoDuration] = useState(0)
  const [previewAudioPlaying, setPreviewAudioPlaying] = useState(false)
  const [previewAudioTime, setPreviewAudioTime] = useState(0)
  const [previewAudioDuration, setPreviewAudioDuration] = useState(0)
  const [previewWaveformBars, setPreviewWaveformBars] = useState<number[]>(new Array(64).fill(0))
  const [previewAudioLoop, setPreviewAudioLoop] = useState(false)
  const previewVideoRef = useRef<HTMLVideoElement | null>(null)
  const previewVideoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const previewAudioTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const previewAudioCtxRef = useRef<AudioContext | null>(null)
  const previewAnalyserRef = useRef<AnalyserNode | null>(null)
  const previewVizFrameRef = useRef<number | null>(null)

  // Theme data
  const [themeCache, setThemeCache] = useState<Record<number, any>>({})
  const [defaultTheme, setDefaultTheme] = useState<any>(null)
  const [defaultThemeBg, setDefaultThemeBg] = useState<string | null>(null)

  const [themeOverrides, setThemeOverrides] = useState<Partial<ThemeStyle>>({})
  const [bgOverride, setBgOverride] = useState<string | null | undefined>(undefined)
  const [pendingBgPath, setPendingBgPath] = useState<string | null | undefined>(undefined)
  const [savingBg, setSavingBg] = useState(false)
  const [arrangedSectionIds, setArrangedSectionIds] = useState<number[] | null>(null)
  const [arrangementChanged, setArrangementChanged] = useState(false)

  // ── Load ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadSongs()
    loadServices()
    window.worshipsync.themes.getDefault().then((t: any) => {
      setDefaultTheme(t)
      if (t?.settings) {
        try { setDefaultThemeBg(JSON.parse(t.settings).backgroundPath ?? null) } catch {}
      }
    })
    window.worshipsync.themes.getAll().then((all: any[]) => {
      const c: Record<number, any> = {}
      all.forEach(t => { c[t.id] = t })
      setThemeCache(c)
    })
  }, [])

  useEffect(() => {
    window.worshipsync.appState.get().then((state: any) => {
      if (Array.isArray(state.setlistTemplates)) setTemplates(state.setlistTemplates)
    }).catch(() => {})
  }, [])

  // Stop all preview media on unmount (e.g. switching to live mode)
  useEffect(() => {
    return () => {
      if (previewVideoRef.current) { previewVideoRef.current.pause(); previewVideoRef.current.currentTime = 0; }
      if (previewVideoTimerRef.current) { clearInterval(previewVideoTimerRef.current); }
      if (previewVizFrameRef.current) { cancelAnimationFrame(previewVizFrameRef.current); }
      if (previewAudioRef.current) { previewAudioRef.current.pause(); previewAudioRef.current = null; }
      if (previewAudioTimerRef.current) { clearInterval(previewAudioTimerRef.current); }
      previewAudioCtxRef.current?.close();
    }
  }, [])

  useEffect(() => {
    if (serviceId && services.length > 0) {
      const service = services.find(s => s.id === serviceId)
      if (service) selectService(service)
    }
  }, [serviceId, services])

  // Reset selection when switching songs
  useEffect(() => {
    setPreviewSlideIdx(0)
    setThemeOverrides({})
    setBgOverride(undefined)
    setPendingBgPath(undefined)
    pendingThemeRef.current = {}
    stopPreviewMedia()
    if (themeTimerRef.current) { clearTimeout(themeTimerRef.current); themeTimerRef.current = null }
    // Load saved section order for this lineup item if present (not a pending change)
    const item = lineup[selectedSongIdx]
    if (item?.sectionOrder) {
      try { setArrangedSectionIds(JSON.parse(item.sectionOrder)) } catch { setArrangedSectionIds(null) }
    } else {
      setArrangedSectionIds(null)
    }
    setArrangementChanged(false)
  }, [selectedSongIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  // Seed notes from DB whenever lineup changes
  useEffect(() => {
    const map: Record<number, string> = {}
    lineup.forEach(item => { map[item.id] = item.notes ?? "" })
    setNotesMap(map)
  }, [lineup])

  // ── Derived ──────────────────────────────────────────────────────────────
  const isPast = selectedService
    ? new Date(selectedService.date + "T00:00:00") < new Date(new Date().toLocaleDateString("en-CA") + "T00:00:00")
    : false

  const totalDurationSec = useMemo(
    () => lineup.reduce((sum, item) => sum + estimateDuration(item, themeCache), 0),
    [lineup, themeCache],
  )

  const currentItem = lineup[selectedSongIdx] ?? null
  const currentSong = currentItem?.song ?? null
  const currentItemIsMedia = currentItem?.itemType === 'media'

  const effectiveTheme: ThemeStyle = useMemo(() => {
    const t = (currentSong?.themeId ? themeCache[currentSong.themeId] : null) ?? defaultTheme
    let base = DEFAULT_THEME
    if (t?.settings) {
      try { base = { ...DEFAULT_THEME, ...JSON.parse(t.settings) } } catch {}
    }
    return { ...base, ...themeOverrides }
  }, [currentSong, themeCache, defaultTheme, themeOverrides])

  const arrangedSections = useMemo(() => {
    if (!currentSong) return []
    const ids = arrangedSectionIds ?? (() => {
      if (currentItem?.sectionOrder) {
        try { return JSON.parse(currentItem.sectionOrder) as number[] } catch {}
      }
      return null
    })()
    if (!ids) return currentSong.sections
    const ordered = ids.map(id => currentSong.sections.find(s => s.id === id)).filter(Boolean) as typeof currentSong.sections
    return ordered.length === currentSong.sections.length ? ordered : currentSong.sections
  }, [currentSong, arrangedSectionIds, currentItem])

  const slides = useMemo(
    () => arrangedSections.length ? buildSlides(arrangedSections, effectiveTheme.maxLinesPerSlide) : [],
    [arrangedSections, effectiveTheme.maxLinesPerSlide],
  )


  const scriptureVerses = useMemo<{ label: string; text: string }[]>(() => {
    if (currentItem?.itemType !== 'scripture') return []
    try { return JSON.parse(currentItem.scriptureRef ?? '{}').verses ?? [] } catch { return [] }
  }, [currentItem])

  const currentSlide: Slide | null = useMemo(() => {
    if (currentItem?.itemType === 'scripture') {
      const v = scriptureVerses[previewSlideIdx]
      if (!v) return null
      return { lines: [v.text], sectionLabel: v.label, sectionType: 'verse', sectionId: previewSlideIdx }
    }
    return slides[previewSlideIdx] ?? null
  }, [currentItem, scriptureVerses, slides, previewSlideIdx])

  const effectiveBg: string | null = useMemo(() => {
    if (bgOverride !== undefined) return bgOverride
    if (currentItem?.overrideBackgroundPath) return currentItem.overrideBackgroundPath
    if (currentSong?.backgroundPath) return currentSong.backgroundPath
    if (currentSong?.themeId && themeCache[currentSong.themeId]) {
      try { return JSON.parse(themeCache[currentSong.themeId].settings).backgroundPath ?? null } catch {}
    }
    return defaultThemeBg
  }, [currentSong, currentItem, themeCache, defaultThemeBg, bgOverride])

  // ── DnD sensors ──────────────────────────────────────────────────────────
  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: { distance: 4 },
  }))

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = lineup.findIndex(l => l.id === active.id)
    const newIndex = lineup.findIndex(l => l.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const newIds = arrayMove(lineup.map(l => l.id), oldIndex, newIndex)
    await reorderLineup(newIds)
    if (selectedSongIdx === oldIndex) setSelectedSongIdx(newIndex)
    else if (selectedSongIdx > oldIndex && selectedSongIdx <= newIndex) setSelectedSongIdx(selectedSongIdx - 1)
    else if (selectedSongIdx < oldIndex && selectedSongIdx >= newIndex) setSelectedSongIdx(selectedSongIdx + 1)
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleCreated = async (songId: number) => {
    await loadSongs()
    await addSongToLineup(songId)
  }

  const handleLibraryAdd = async (songIds: number[]) => {
    for (const id of songIds) await addSongToLineup(id)
  }

  const handleAddScripture = async (
    title: string,
    verses: { number: number; text: string }[],
    ref: { book: string; chapter: number; translation: string }
  ) => {
    const scriptureRef = JSON.stringify({
      verses: verses.map(v => ({
        label: `${ref.book} ${ref.chapter}:${v.number} ${ref.translation}`,
        text: v.text,
      }))
    })
    await addScriptureToLineup({ title, scriptureRef })
  }

  const handleAddMedia = async (path: string) => {
    const filename = path.split("/").pop() ?? "Media"
    const isVideo = /\.(mp4|webm|mov)$/i.test(path)
    const isAudio = /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(path)
    const label = isVideo ? "Video" : isAudio ? "Audio" : "Image"
    await addMediaToLineup({ title: `${label}: ${filename}`, mediaPath: path })
  }

  const handleLyricsSave = async (newLyrics: string) => {
    if (!currentSong) return
    const typeMap: Record<string, string> = {
      verse: "verse", chorus: "chorus", bridge: "bridge", "pre-chorus": "pre-chorus",
      intro: "intro", outro: "outro", tag: "tag", interlude: "interlude",
    }
    const parsed: { type: string; label: string; lyrics: string; orderIndex: number }[] = []
    let currentType: string | null = null
    let currentLabel = ""
    let currentLines: string[] = []
    let idx = 0
    const flush = () => {
      if (!currentType) return
      parsed.push({
        type: currentType, label: currentLabel,
        lyrics: currentLines.join("\n").trimEnd(), orderIndex: idx++,
      })
      currentLines = []
    }
    for (const line of newLyrics.split("\n")) {
      const match = line.trim().match(/^\[(.+?)\]$/)
      if (match) {
        flush()
        const raw = match[1].toLowerCase().trim().replace(/\s*\d+$/, "")
        currentType = typeMap[raw] ?? "verse"
        currentLabel = match[1].trim()
      } else if (currentType !== null) {
        currentLines.push(line)
      }
    }
    flush()
    if (parsed.length > 0) {
      await window.worshipsync.songs.upsertSections(currentSong.id, parsed)
      if (selectedService) await loadLineup(selectedService.id)
    }
  }

  const markReady = async () => {
    if (!selectedService) return
    await updateStatus(selectedService.id, "ready")
  }

  const handleThemeChange = (key: keyof ThemeStyle, value: any) => {
    setThemeOverrides(prev => ({ ...prev, [key]: value }))
    pendingThemeRef.current = { ...pendingThemeRef.current, [key]: value }
    if (!currentSong) return
    if (themeTimerRef.current) clearTimeout(themeTimerRef.current)
    themeTimerRef.current = setTimeout(async () => {
      const overrides = pendingThemeRef.current
      const base: Partial<ThemeStyle> = currentSong.themeId && themeCache[currentSong.themeId]?.settings
        ? (() => { try { return JSON.parse(themeCache[currentSong.themeId!].settings) } catch { return {} } })()
        : {}
      const fullSettings = { ...DEFAULT_THEME, ...base, ...overrides }
      const settingsJson = JSON.stringify(fullSettings)
      if (currentSong.themeId) {
        await window.worshipsync.themes.update(currentSong.themeId, { settings: settingsJson })
      } else {
        const newTheme = await window.worshipsync.themes.create({
          name: currentSong.title, type: 'per-song', isDefault: false, settings: settingsJson,
        })
        await window.worshipsync.songs.update(currentSong.id, { themeId: newTheme.id })
      }
      const all = await window.worshipsync.themes.getAll()
      const c: Record<number, any> = {}
      all.forEach((t: any) => { c[t.id] = t })
      setThemeCache(c)
      await loadSongs()
    }, 800)
  }

  const stopPreviewMedia = () => {
    if (previewVideoRef.current) { previewVideoRef.current.pause(); previewVideoRef.current.currentTime = 0; }
    if (previewVideoTimerRef.current) { clearInterval(previewVideoTimerRef.current); previewVideoTimerRef.current = null; }
    setPreviewVideoPlaying(false); setPreviewVideoTime(0); setPreviewVideoDuration(0);
    if (previewVizFrameRef.current) { cancelAnimationFrame(previewVizFrameRef.current); previewVizFrameRef.current = null; }
    if (previewAudioRef.current) { previewAudioRef.current.pause(); previewAudioRef.current = null; }
    if (previewAudioTimerRef.current) { clearInterval(previewAudioTimerRef.current); previewAudioTimerRef.current = null; }
    previewAudioCtxRef.current?.close(); previewAudioCtxRef.current = null; previewAnalyserRef.current = null;
    setPreviewAudioPlaying(false); setPreviewAudioTime(0); setPreviewAudioDuration(0);
    setPreviewAudioLoop(false);
    setPreviewWaveformBars(new Array(64).fill(0));
  }

  const handleSectionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const currentIds = arrangedSections.map(s => s.id)
    const oldIdx = currentIds.indexOf(Number(active.id))
    const newIdx = currentIds.indexOf(Number(over.id))
    if (oldIdx === -1 || newIdx === -1) return
    setArrangedSectionIds(arrayMove(currentIds, oldIdx, newIdx))
    setArrangementChanged(true)
  }

  const saveArrangementToSong = async () => {
    if (!currentSong || !arrangedSectionIds) return
    const updated = arrangedSectionIds.map((id, idx) => {
      const sec = currentSong.sections.find(s => s.id === id)!
      return { type: sec.type, label: sec.label, lyrics: sec.lyrics, orderIndex: idx }
    })
    await window.worshipsync.songs.upsertSections(currentSong.id, updated)
    await loadSongs()
    setArrangedSectionIds(null)
    setArrangementChanged(false)
  }

  const saveArrangementToLineup = async () => {
    if (!currentItem || !arrangedSectionIds) return
    patchLineupItemSectionOrder(currentItem.id, arrangedSectionIds)
    setArrangementChanged(false)
    setArrangedSectionIds(null)
    await window.worshipsync.lineup.setSectionOrder(currentItem.id, arrangedSectionIds)
  }

  // ── Setlist template handlers ────────────────────────────────────────────

  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim()) return
    setSavingTemplate(true)
    const items: SetlistTemplateItem[] = lineup.map(item => ({
      itemType: item.itemType,
      songId: item.songId ?? undefined,
      songTitle: item.song?.title ?? item.title ?? undefined,
      title: item.title ?? undefined,
    }))
    const tpl: SetlistTemplate = {
      id: Date.now().toString(),
      name: newTemplateName.trim(),
      createdAt: new Date().toISOString(),
      items,
    }
    const updated = [...templates, tpl]
    setTemplates(updated)
    await window.worshipsync.appState.set({ setlistTemplates: updated })
    setNewTemplateName("")
    setSavingTemplate(false)
  }

  const handleApplyTemplate = async (tpl: SetlistTemplate) => {
    setApplyingTemplate(true)
    for (const item of tpl.items) {
      if (item.itemType === 'song' && item.songId) {
        await addSongToLineup(item.songId).catch(() => {})
      } else if (item.itemType === 'countdown') {
        await addCountdownToLineup().catch(() => {})
      }
    }
    setApplyingTemplate(false)
    setShowTemplates(false)
  }

  const handleDeleteTemplate = async (id: string) => {
    const updated = templates.filter(t => t.id !== id)
    setTemplates(updated)
    await window.worshipsync.appState.set({ setlistTemplates: updated })
  }

  // ── Empty state ──────────────────────────────────────────────────────────
  if (!selectedService) {
    return (
      <div className="h-full flex items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <Calendar className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-2">No service selected</p>
          <p className="text-xs text-muted-foreground">Go to Planner and pick a service to prepare</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background text-foreground">

      {/* ── Top bar ────────────────────────────────────────────────── */}
      <div
        className="h-14 border-b border-border flex items-center px-5 shrink-0 gap-3"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <div className="min-w-0 flex items-center gap-2" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-foreground truncate">{selectedService.label}</h1>
              {!isPast && selectedService.status !== "ready" && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">DRAFT</span>
              )}
              {selectedService.status === "ready" && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-500/15 text-green-500 shrink-0">READY</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(selectedService.date + "T00:00:00").toLocaleDateString("en-US", {
                weekday: "short", month: "short", day: "numeric", year: "numeric",
              })}
              {totalDurationSec > 0 && <span> · {fmtTotal(totalDurationSec)}</span>}
            </p>
          </div>
          <button
            onClick={() => setShowEditService(true)}
            title="Edit service"
            className="shrink-0 h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
          {isPast ? (
            <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-md">View only · past service</span>
          ) : projectionOpen && onReturnToPresenter ? (
            <>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-md bg-[hsl(var(--success)/0.14)] text-[hsl(var(--success))]">
                <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--success))]" /> Show is live
              </span>
              <Button size="sm" className="gap-1.5 h-8 text-xs bg-red-600 hover:bg-red-700 text-white" onClick={onReturnToPresenter}>
                <Monitor className="h-3.5 w-3.5" /> Back to Presenter
              </Button>
            </>
          ) : (
            <>
              {selectedService.status !== "ready" && lineup.length > 0 && !isPast && (
                <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={markReady}>
                  Mark Ready
                </Button>
              )}
              <Button
                variant="outline" size="sm"
                className="gap-1.5 h-8 text-xs"
                onClick={() => setShowTemplates(true)}
              >
                <ListTodo className="h-3.5 w-3.5" /> Templates
              </Button>
              <Button size="sm" className="gap-1.5 h-8 text-xs bg-red-600 hover:bg-red-700 text-white" disabled={lineup.length === 0} onClick={onGoLive}>
                <Radio className="h-3.5 w-3.5" /> Go Live
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Main 3-column layout ─────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ─── LEFT: Lineup ──────────────────────────────────────────── */}
        <div className="w-64 shrink-0 border-r border-border flex flex-col bg-card">
          <div className="flex items-center justify-between px-4 py-2.5 shrink-0 border-b border-border">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Service Lineup</span>
            <span className="text-[10px] text-muted-foreground font-medium">
              {totalDurationSec > 0 ? fmtTotal(totalDurationSec) : `${lineup.length} items`}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-2">
            {lineup.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <Music2 className="h-8 w-8 text-muted-foreground mb-3" />
                <p className="text-xs font-medium text-foreground mb-1">Empty lineup</p>
                <p className="text-[10px] text-muted-foreground mb-4">
                  Add songs from your library or create new ones.
                </p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={lineup.map(l => l.id)} strategy={verticalListSortingStrategy}>
                  {lineup.map((item, i) => {
                    const isSelected = selectedSongIdx === i
                    const isCountdown = item.itemType === 'countdown'
                    const isScripture = item.itemType === 'scripture'
                    const isMedia = item.itemType === 'media'
                    const isAnnouncement = item.itemType === 'announcement'
                    return (
                      <SortableLineupItem
                        key={item.id}
                        id={item.id}
                        index={i}
                        isSelected={isSelected}
                        title={isCountdown ? "Countdown Timer" : isScripture || isMedia || isAnnouncement ? item.title ?? "—" : item.song?.title ?? "—"}
                        subtitle={(() => {
                          const dur = fmtDur(estimateDuration(item, themeCache))
                          const base = isCountdown ? "Countdown"
                            : isScripture ? "Scripture"
                            : isMedia ? "Media"
                            : isAnnouncement ? "Announcement"
                            : `${item.song?.artist || "Unknown"}${item.song?.key ? ` · ${item.song.key}` : ""}`
                          return dur ? `${base} · ${dur}` : base
                        })()}
                        isPast={isPast}
                        onSelect={() => setSelectedSongIdx(i)}
                        onDelete={() => {
                          const label = isCountdown ? "Countdown Timer" : isScripture || isMedia ? item.title ?? "item" : item.song?.title ?? "item"
                          if (confirm(`Remove "${label}" from lineup?`)) {
                            removeSongFromLineup(item.id)
                            if (selectedSongIdx >= lineup.length - 1) {
                              setSelectedSongIdx(Math.max(0, lineup.length - 2))
                            }
                          }
                        }}
                      />
                    )
                  })}
                </SortableContext>
              </DndContext>
            )}
          </div>

          {!isPast && (
            <div className="p-3 border-t border-border shrink-0 space-y-1.5">
              <Button
                variant="outline" size="sm"
                className="w-full gap-1.5 h-8 text-xs"
                onClick={() => setShowLibrary(true)}
              >
                <BookOpen className="h-3.5 w-3.5" /> Add from Library
              </Button>
              <Button
                variant="ghost" size="sm"
                className="w-full gap-1.5 h-8 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setShowAddSong(true)}
              >
                <Plus className="h-3.5 w-3.5" /> Create new song
              </Button>
              <Button
                variant="ghost" size="sm"
                className="w-full gap-1.5 h-8 text-xs text-muted-foreground hover:text-foreground"
                onClick={async () => {
                  const newIdx = lineup.length
                  await addAnnouncementToLineup({ title: 'Announcement', content: '' })
                  setSelectedSongIdx(newIdx)
                }}
              >
                <Megaphone className="h-3.5 w-3.5" /> Add announcement
              </Button>
            </div>
          )}
        </div>

        {/* ─── CENTER: Song editor + sections ────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {currentItem?.itemType === 'countdown' ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
              <Timer className="h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-base font-bold mb-1">Countdown Timer</h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                This countdown will count down to the service start time.
                Configure the start time and timezone in Settings.
              </p>
              <p className="text-xs text-muted-foreground mt-3">
                The countdown must be started manually in the Presenter screen to avoid accidental projection.
              </p>
            </div>
          ) : currentItem?.itemType === 'announcement' ? (
            <>
              <div className="px-5 py-3 border-b border-border bg-card flex items-center gap-3 shrink-0">
                <Megaphone className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Announcement</span>
              </div>
              <div className="flex-1 overflow-y-auto p-5 bg-muted/10">
                <div className="max-w-2xl flex flex-col gap-4">
                  {/* Title */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">Title</label>
                    <input
                      type="text"
                      defaultValue={currentItem.title ?? ''}
                      readOnly={isPast}
                      placeholder="e.g. This Sunday's Events"
                      onChange={(e) => {
                        const val = e.target.value
                        clearTimeout(announcementTimers.current.title)
                        announcementTimers.current.title = setTimeout(() => {
                          window.worshipsync.lineup.updateAnnouncement(currentItem.id, { title: val })
                            .then(() => { if (selectedService) loadLineup(selectedService.id) })
                        }, 600)
                      }}
                      className="w-full h-9 px-3 text-sm bg-background border border-border rounded-md outline-none focus:border-primary/50 transition-colors placeholder:text-muted-foreground/40"
                    />
                  </div>
                  {/* Content */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">Content</label>
                    <textarea
                      defaultValue={currentItem.scriptureRef ?? ''}
                      readOnly={isPast}
                      rows={8}
                      placeholder={"Sunday 6pm — Youth Night\nMonday 7pm — Prayer Meeting\n\nVisit worshipsync.com for more info"}
                      onChange={(e) => {
                        const val = e.target.value
                        clearTimeout(announcementTimers.current.content)
                        announcementTimers.current.content = setTimeout(() => {
                          window.worshipsync.lineup.updateAnnouncement(currentItem.id, { content: val })
                            .then(() => { if (selectedService) loadLineup(selectedService.id) })
                        }, 600)
                      }}
                      className="w-full px-3 py-2.5 text-sm bg-background border border-border rounded-md outline-none focus:border-primary/50 transition-colors resize-none placeholder:text-muted-foreground/40 leading-relaxed"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1.5">Each line becomes a line on the projection screen. Use blank lines to add spacing.</p>
                  </div>
                  {/* Formatting toolbar */}
                  {(() => {
                    const annStyle = parseAnnouncementStyle(currentItem.itemStyle)
                    const saveStyle = (patch: Partial<AnnouncementStyle>) => {
                      const next = { ...annStyle, ...patch }
                      window.worshipsync.lineup.setItemStyle(currentItem.id, JSON.stringify(next))
                        .then(() => { if (selectedService) loadLineup(selectedService.id) })
                    }
                    return (
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">Formatting</label>
                        <div className="flex flex-wrap items-center gap-2 p-3 bg-background border border-border rounded-lg">
                          {/* Bold */}
                          <button
                            onClick={() => saveStyle({ fontWeight: annStyle.fontWeight === '700' ? '400' : '700' })}
                            className={`w-8 h-8 rounded flex items-center justify-center text-sm font-bold transition-colors ${annStyle.fontWeight === '700' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                            title="Bold"
                          >B</button>
                          <div className="w-px h-6 bg-border" />
                          {/* Font size */}
                          {ANNOUNCEMENT_FONT_SIZES.map(({ label, value }) => (
                            <button
                              key={value}
                              onClick={() => saveStyle({ fontSize: value })}
                              className={`px-2.5 h-8 rounded text-xs font-semibold transition-colors ${annStyle.fontSize === value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                            >{label}</button>
                          ))}
                          <div className="w-px h-6 bg-border" />
                          {/* Alignment */}
                          {(['left', 'center', 'right'] as const).map(align => (
                            <button
                              key={align}
                              onClick={() => saveStyle({ textAlign: align })}
                              title={align.charAt(0).toUpperCase() + align.slice(1)}
                              className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${annStyle.textAlign === align ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                            >
                              {align === 'left' && <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="0" y="1" width="14" height="2" rx="1"/><rect x="0" y="5" width="10" height="2" rx="1"/><rect x="0" y="9" width="12" height="2" rx="1"/></svg>}
                              {align === 'center' && <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="0" y="1" width="14" height="2" rx="1"/><rect x="2" y="5" width="10" height="2" rx="1"/><rect x="1" y="9" width="12" height="2" rx="1"/></svg>}
                              {align === 'right' && <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="0" y="1" width="14" height="2" rx="1"/><rect x="4" y="5" width="10" height="2" rx="1"/><rect x="2" y="9" width="12" height="2" rx="1"/></svg>}
                            </button>
                          ))}
                          <div className="w-px h-6 bg-border" />
                          {/* Color swatches */}
                          {ANNOUNCEMENT_COLORS.map(color => (
                            <button
                              key={color}
                              onClick={() => saveStyle({ textColor: color })}
                              title={color}
                              className="w-6 h-6 rounded-full border-2 transition-all"
                              style={{
                                background: color,
                                borderColor: annStyle.textColor === color ? 'hsl(var(--primary))' : 'transparent',
                                boxShadow: annStyle.textColor === color ? '0 0 0 2px hsl(var(--background))' : 'none',
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )
                  })()}
                  {/* Preview */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">Preview</label>
                    <div className="rounded-lg overflow-hidden border border-border bg-gray-950 relative" style={{ aspectRatio: '16/9' }}>
                      {effectiveBg && (
                        effectiveBg.startsWith('color:') ? (
                          <div className="absolute inset-0" style={{ background: effectiveBg.replace('color:', '') }} />
                        ) : (
                          <>
                            <img src={`file://${effectiveBg}`} className="absolute inset-0 w-full h-full object-cover" alt="" />
                            <div className="absolute inset-0" style={{ background: `rgba(0,0,0,0.5)` }} />
                          </>
                        )
                      )}
                      {(() => {
                        const annStyle = parseAnnouncementStyle(currentItem.itemStyle)
                        const previewFontSize = `${(annStyle.fontSize / 80) * 5}cqw`
                        return (
                          <div
                            className="absolute inset-0 flex items-center px-6"
                            style={{ containerType: 'inline-size', justifyContent: annStyle.textAlign === 'left' ? 'flex-start' : annStyle.textAlign === 'right' ? 'flex-end' : 'center' }}
                          >
                            <p
                              className="leading-relaxed whitespace-pre-wrap"
                              style={{
                                fontSize: previewFontSize,
                                fontWeight: annStyle.fontWeight,
                                color: annStyle.textColor,
                                textAlign: annStyle.textAlign,
                              }}
                            >
                              {currentItem.scriptureRef || <span style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', fontWeight: '400' }}>No content yet</span>}
                            </p>
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : currentItemIsMedia ? (
            (() => {
              const mediaPath = currentItem!.mediaPath ?? ''
              const isVideo = /\.(mp4|webm|mov)$/i.test(mediaPath)
              const isAudio = /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(mediaPath)
              const filename = mediaPath.split('/').pop() ?? currentItem!.title ?? 'Media'
              const ext = filename.split('.').pop()?.toUpperCase() ?? ''
              const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`

              if (isVideo) {
                const pct = previewVideoDuration ? (previewVideoTime / previewVideoDuration) * 100 : 0
                const handlePlay = () => {
                  const v = previewVideoRef.current; if (!v) return
                  v.play(); setPreviewVideoPlaying(true)
                  if (previewVideoTimerRef.current) clearInterval(previewVideoTimerRef.current)
                  previewVideoTimerRef.current = setInterval(() => setPreviewVideoTime(previewVideoRef.current?.currentTime ?? 0), 100)
                }
                const handlePause = () => { previewVideoRef.current?.pause(); setPreviewVideoPlaying(false); if (previewVideoTimerRef.current) { clearInterval(previewVideoTimerRef.current); previewVideoTimerRef.current = null } }
                const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => { if (!previewVideoDuration || !previewVideoRef.current) return; const r = e.currentTarget.getBoundingClientRect(); previewVideoRef.current.currentTime = Math.max(0, Math.min(previewVideoDuration, ((e.clientX - r.left) / r.width) * previewVideoDuration)); setPreviewVideoTime(previewVideoRef.current.currentTime) }
                const handleSkip = (d: number) => { if (!previewVideoRef.current) return; previewVideoRef.current.currentTime = Math.max(0, Math.min(previewVideoDuration, previewVideoRef.current.currentTime + d)); setPreviewVideoTime(previewVideoRef.current.currentTime) }
                return (
                  <>
                    <div className="px-5 py-3 border-b border-border bg-card flex items-center justify-between gap-4 shrink-0">
                      <div className="min-w-0">
                        <h1 className="text-base font-semibold truncate">{currentItem!.title?.replace(/^Video:\s*/i, '') ?? filename}</h1>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span>Video</span><span>·</span><span className="tabular-nums">{fmt(previewVideoDuration)}</span><span>·</span><span>{ext}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-muted/20 overflow-y-auto">
                      <div className="w-full max-w-2xl flex flex-col gap-5">
                        <div className="relative rounded-xl overflow-hidden bg-black border border-border shadow-md" style={{ aspectRatio: '16/9' }}>
                          <video ref={previewVideoRef} src={`file://${encodeURI(mediaPath)}`} className="w-full h-full object-cover" playsInline preload="auto"
                            onLoadedMetadata={() => { const v = previewVideoRef.current; if (!v) return; setPreviewVideoDuration(v.duration); v.currentTime = 0.001 }}
                            onEnded={() => { setPreviewVideoPlaying(false); setPreviewVideoTime(0); if (previewVideoTimerRef.current) { clearInterval(previewVideoTimerRef.current); previewVideoTimerRef.current = null } }} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <div className="relative flex items-center cursor-pointer group py-2" onClick={handleSeek}>
                            <div className="w-full h-1.5 bg-secondary rounded-full relative">
                              <div className="absolute left-0 top-0 h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                              <div className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white border-2 border-primary rounded-full shadow-md -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity" style={{ left: `${pct}%` }} />
                            </div>
                          </div>
                          <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums px-0.5">
                            <span>{fmt(previewVideoTime)}</span><span>{fmt(previewVideoDuration)}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-center gap-5">
                          <button onClick={() => handleSkip(-previewVideoDuration)} className="text-muted-foreground hover:text-foreground transition-colors"><SkipBack className="h-5 w-5" /></button>
                          <button onClick={() => handleSkip(-10)} className="text-muted-foreground hover:text-foreground transition-colors text-[11px] font-bold w-8 text-center">−10s</button>
                          <button onClick={previewVideoPlaying ? handlePause : handlePlay} className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all shadow-lg">
                            {previewVideoPlaying ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 fill-current ml-0.5" />}
                          </button>
                          <button onClick={() => handleSkip(10)} className="text-muted-foreground hover:text-foreground transition-colors text-[11px] font-bold w-8 text-center">+10s</button>
                          <button onClick={() => handleSkip(previewVideoDuration)} className="text-muted-foreground hover:text-foreground transition-colors"><SkipForward className="h-5 w-5" /></button>
                        </div>
                        <p className="text-center text-[11px] text-muted-foreground">Preview with audio · playback will stop when going live</p>
                      </div>
                    </div>
                  </>
                )
              }

              if (isAudio) {
                const pct = previewAudioDuration ? (previewAudioTime / previewAudioDuration) * 100 : 0
                const stopViz = () => { if (previewVizFrameRef.current) { cancelAnimationFrame(previewVizFrameRef.current); previewVizFrameRef.current = null } setPreviewWaveformBars(new Array(64).fill(0)) }
                const startViz = () => {
                  const analyser = previewAnalyserRef.current; if (!analyser) return
                  const data = new Uint8Array(analyser.frequencyBinCount)
                  const tick = () => { analyser.getByteFrequencyData(data); setPreviewWaveformBars(Array.from({ length: 64 }, (_, ii) => data[Math.floor((ii / 64) * data.length)] / 255)); previewVizFrameRef.current = requestAnimationFrame(tick) }
                  previewVizFrameRef.current = requestAnimationFrame(tick)
                }
                const ensureAudio = () => {
                  if (!previewAudioRef.current) {
                    previewAudioRef.current = new Audio(`file://${encodeURI(mediaPath)}`)
                    previewAudioRef.current.onloadedmetadata = () => setPreviewAudioDuration(previewAudioRef.current?.duration ?? 0)
                    previewAudioRef.current.onended = () => { setPreviewAudioPlaying(false); setPreviewAudioTime(0); if (previewAudioTimerRef.current) { clearInterval(previewAudioTimerRef.current); previewAudioTimerRef.current = null } stopViz() }
                    const ctx = new AudioContext(); const analyser = ctx.createAnalyser(); analyser.fftSize = 256
                    ctx.createMediaElementSource(previewAudioRef.current).connect(analyser); analyser.connect(ctx.destination)
                    previewAudioCtxRef.current = ctx; previewAnalyserRef.current = analyser
                  }
                  return previewAudioRef.current
                }
                const handlePlay = () => { const a = ensureAudio(); previewAudioCtxRef.current?.resume(); a.loop = previewAudioLoop; a.play(); setPreviewAudioPlaying(true); if (previewAudioTimerRef.current) clearInterval(previewAudioTimerRef.current); previewAudioTimerRef.current = setInterval(() => setPreviewAudioTime(previewAudioRef.current?.currentTime ?? 0), 100); startViz() }
                const handlePause = () => { previewAudioRef.current?.pause(); setPreviewAudioPlaying(false); if (previewAudioTimerRef.current) { clearInterval(previewAudioTimerRef.current); previewAudioTimerRef.current = null } stopViz() }
                const handleToggleLoop = () => { const next = !previewAudioLoop; setPreviewAudioLoop(next); if (previewAudioRef.current) previewAudioRef.current.loop = next; setMediaLoop(currentItem!.id, next) }
                const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => { if (!previewAudioDuration || !previewAudioRef.current) return; const r = e.currentTarget.getBoundingClientRect(); previewAudioRef.current.currentTime = Math.max(0, Math.min(previewAudioDuration, ((e.clientX - r.left) / r.width) * previewAudioDuration)); setPreviewAudioTime(previewAudioRef.current.currentTime) }
                const handleSkip = (d: number) => { if (!previewAudioRef.current) return; previewAudioRef.current.currentTime = Math.max(0, Math.min(previewAudioDuration, previewAudioRef.current.currentTime + d)); setPreviewAudioTime(previewAudioRef.current.currentTime) }
                return (
                  <>
                    <div className="px-5 py-3 border-b border-border bg-card flex items-center justify-between gap-4 shrink-0">
                      <div className="min-w-0">
                        <h1 className="text-base font-semibold truncate">{currentItem!.title?.replace(/^Audio:\s*/i, '') ?? filename}</h1>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span>Audio</span><span>·</span><span className="tabular-nums">{fmt(previewAudioDuration)}</span><span>·</span><span>{ext}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-muted/20 overflow-y-auto">
                      <div className="w-full max-w-2xl flex flex-col gap-6">
                        <div className="relative rounded-xl overflow-hidden bg-black/70 border border-border/60" style={{ height: 160 }}>
                          <div className="absolute inset-0 flex items-center gap-[2px] px-4 py-5">
                            {previewWaveformBars.map((v, i) => (
                              <div key={i} className="flex-1 flex flex-col" style={{ height: '100%' }}>
                                <div className="flex-1 flex flex-col justify-end"><div className="w-full rounded-t-[1px] bg-primary" style={{ height: `${Math.max(3, v * 100)}%`, opacity: 0.85 }} /></div>
                                <div className="flex-1 flex flex-col justify-start"><div className="w-full rounded-b-[1px] bg-primary" style={{ height: `${Math.max(3, v * 100) * 0.55}%`, opacity: 0.35 }} /></div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <div className="relative flex items-center cursor-pointer group py-2" onClick={handleSeek}>
                            <div className="w-full h-1.5 bg-secondary rounded-full relative">
                              <div className="absolute left-0 top-0 h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                              <div className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white border-2 border-primary rounded-full shadow-md -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity" style={{ left: `${pct}%` }} />
                            </div>
                          </div>
                          <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums px-0.5">
                            <span>{fmt(previewAudioTime)}</span><span>{fmt(previewAudioDuration)}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-center gap-5">
                          <button onClick={() => handleSkip(-previewAudioDuration)} className="text-muted-foreground hover:text-foreground transition-colors"><SkipBack className="h-5 w-5" /></button>
                          <button onClick={() => handleSkip(-10)} className="text-muted-foreground hover:text-foreground transition-colors text-[11px] font-bold w-8 text-center">−10s</button>
                          <button onClick={previewAudioPlaying ? handlePause : handlePlay} className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all shadow-lg">
                            {previewAudioPlaying ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 fill-current ml-0.5" />}
                          </button>
                          <button onClick={() => handleSkip(10)} className="text-muted-foreground hover:text-foreground transition-colors text-[11px] font-bold w-8 text-center">+10s</button>
                          <button onClick={() => handleSkip(previewAudioDuration)} className="text-muted-foreground hover:text-foreground transition-colors"><SkipForward className="h-5 w-5" /></button>
                          <button onClick={handleToggleLoop} title={previewAudioLoop ? "Loop on" : "Loop off"} className={`transition-colors ${previewAudioLoop ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                            <Repeat className="h-5 w-5" />
                          </button>
                        </div>
                        <p className="text-center text-[11px] text-muted-foreground">Preview only · loop setting carries over to the presenter</p>
                      </div>
                    </div>
                  </>
                )
              }

              // Image media
              return (
                <>
                  <div className="px-5 py-3 border-b border-border bg-card flex items-center justify-between gap-4 shrink-0">
                    <div className="min-w-0">
                      <h1 className="text-base font-semibold truncate">{currentItem!.title?.replace(/^Image:\s*/i, '') ?? filename}</h1>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>Image</span><span>·</span><span>{ext}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center p-8 bg-muted/20">
                    <div className="w-full max-w-2xl flex flex-col gap-4">
                      <div className="rounded-xl overflow-hidden border border-border bg-black shadow-md" style={{ aspectRatio: '16/9' }}>
                        {mediaPath ? (
                          <img src={`file://${mediaPath}`} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="h-16 w-16 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>
                      <p className="text-center text-[11px] text-muted-foreground">This image will be shown full-screen on the projection display</p>
                    </div>
                  </div>
                </>
              )
            })()
          ) : currentItem?.itemType === 'scripture' ? (
            <>
              <div className="px-6 pt-5 pb-4 border-b border-border shrink-0">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                  <h2 className="text-lg font-bold text-foreground truncate">{currentItem.title ?? "Scripture"}</h2>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {scriptureVerses.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">No verses found.</p>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Verses ({scriptureVerses.length})
                      </span>
                      <span className="text-[10px] text-muted-foreground">Click to preview on right</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2.5">
                      {scriptureVerses.map((v, i) => {
                        const isPreview = previewSlideIdx === i
                        return (
                          <button
                            key={i}
                            onClick={() => setPreviewSlideIdx(i)}
                            className={`rounded-lg overflow-hidden border-2 transition-all text-left ${
                              isPreview
                                ? "border-primary ring-2 ring-primary/30"
                                : "border-border hover:border-primary/50"
                            }`}
                          >
                            <div className="bg-gray-900 p-2.5 relative" style={{ aspectRatio: "16/9" }}>
                              <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase text-white bg-violet-600 max-w-[90%] truncate block">
                                {v.label}
                              </span>
                              <div className="flex items-center justify-center h-full px-1">
                                <p className="text-[9px] text-white text-center leading-relaxed line-clamp-4">
                                  {v.text}
                                </p>
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            </>
          ) : currentSong ? (
            <>
              {/* Song header */}
              <div className="px-5 py-3 border-b border-border bg-card shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Song</span>
                      {currentSong.ccliNumber && (
                        <span className="text-[10px] text-muted-foreground">CCLI #{currentSong.ccliNumber}</span>
                      )}
                    </div>
                    <h2 className="text-lg font-bold text-foreground truncate">{currentSong.title}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {currentSong.artist || "Unknown artist"}
                      {currentSong.key && ` · Key: ${currentSong.key}`}
                    </p>
                  </div>
                  {currentItem?.itemType === 'song' && !isPast && (
                    <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs shrink-0" onClick={() => setEditingItemId(currentItem!.id)}>
                      <Pencil className="h-3.5 w-3.5" /> Edit Lyrics
                    </Button>
                  )}
                </div>
              </div>

              {currentSong.sections.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
                  <Pencil className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm font-medium text-foreground mb-1">No lyrics yet</p>
                  <p className="text-xs text-muted-foreground mb-4">Add lyrics and sections to this song to build slides.</p>
                  {currentItem?.itemType === 'song' && !isPast && (
                    <Button size="sm" className="gap-1.5" onClick={() => setEditingItemId(currentItem!.id)}>
                      <Pencil className="h-3.5 w-3.5" /> Edit Lyrics
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {/* Section tabs — draggable to reorder */}
                  <div className="px-5 py-2.5 border-b border-border bg-card shrink-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Arrangement</span>
                      <span className="text-[10px] text-muted-foreground">· {slides.length} slides</span>
                      <span className="ml-auto text-[10px] text-muted-foreground/60 italic">Drag to reorder</span>
                    </div>
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
                      <SortableContext items={arrangedSections.map(s => s.id)} strategy={horizontalListSortingStrategy}>
                        <div className="flex gap-1.5 flex-wrap">
                          {arrangedSections.map(section => (
                            <SortableSectionTab
                              key={section.id}
                              id={section.id}
                              label={section.label}
                              color={SECTION_BADGE_COLORS[section.type] ?? 'bg-slate-600'}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </div>

                  {/* Pending arrangement action bar */}
                  {arrangementChanged && arrangedSectionIds && (
                    <div className="px-5 py-2 border-b border-border bg-amber-500/10 shrink-0 flex items-center gap-2">
                      <span className="text-[11px] text-amber-400 flex-1 font-medium">Arrangement changed</span>
                      <button onClick={() => { setArrangedSectionIds(null); setArrangementChanged(false) }} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">Reset</button>
                      <button onClick={saveArrangementToLineup} className="text-[11px] font-semibold px-2.5 py-1 rounded bg-background border border-border hover:bg-accent transition-colors">
                        This service only
                      </button>
                      <button onClick={saveArrangementToSong} className="text-[11px] font-semibold px-2.5 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                        Save to song
                      </button>
                    </div>
                  )}

                  {/* Flat slide grid */}
                  <div className="flex-1 overflow-y-auto px-5 py-4">
                    <div className="grid grid-cols-3 gap-2.5">
                      {slides.map((slide, i) => {
                        const isPreview = previewSlideIdx === i
                        return (
                          <button
                            key={i}
                            onClick={() => setPreviewSlideIdx(i)}
                            className={`rounded-lg overflow-hidden border-2 transition-all ${
                              isPreview ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/50'
                            }`}
                          >
                            <div className="bg-gray-900 relative" style={{ aspectRatio: '16/9' }}>
                              <span className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase text-white z-10 ${SECTION_BADGE_COLORS[slide.sectionType] ?? 'bg-slate-600'}`}>
                                {slide.sectionLabel}
                              </span>
                              <div className="absolute inset-0 flex items-center justify-center px-2">
                                <p className="text-[10px] text-white text-center leading-relaxed whitespace-pre-wrap">
                                  {slide.lines.join('\n') || ' '}
                                </p>
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
              <Music2 className="h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-base font-bold mb-1">Pick a song to edit</h2>
              <p className="text-sm text-muted-foreground mb-5 max-w-xs">
                Select a song from the lineup on the left, or add songs from your library.
              </p>
              <Button size="sm" className="gap-1.5" onClick={() => setShowLibrary(true)}>
                <BookOpen className="h-3.5 w-3.5" /> Browse Library
              </Button>
            </div>
          )}

        </div>

        {/* ─── RIGHT: Item Settings ──── */}
        <div className="w-[300px] shrink-0 border-l border-border flex flex-col bg-card overflow-hidden">
          <ItemSettingsPanel
            currentItem={currentItem}
            notes={notesMap[currentItem?.id ?? -1] ?? ""}
            onNotesChange={(val) => {
              if (!currentItem) return
              setNotesMap(prev => ({ ...prev, [currentItem.id]: val }))
              clearTimeout(notesTimers.current[currentItem.id])
              notesTimers.current[currentItem.id] = setTimeout(() => {
                window.worshipsync.lineup.setNotes(currentItem.id, val)
              }, 600)
            }}
            onNotesBlur={(val) => {
              if (!currentItem) return
              const id = currentItem.id
              clearTimeout(notesTimers.current[id])
              delete notesTimers.current[id]
              window.worshipsync.lineup.setNotes(id, val)
            }}
            slide={currentSlide}
            theme={effectiveTheme}
            bg={effectiveBg}
            canCustomize={!!currentSong || currentItem?.itemType === 'scripture'}
            readOnly={isPast}
            isOverridden={(bgOverride !== undefined && bgOverride !== null) || !!currentItem?.overrideBackgroundPath}
            onThemeChange={handleThemeChange}
            onBgChange={(path) => {
              setBgOverride(path)
              if (currentSong) {
                // Songs: preview immediately, ask where to save
                setPendingBgPath(path)
              } else if (currentItem) {
                // Scripture / other non-song items: save to lineup item directly
                window.worshipsync.lineup.setOverrideBg(currentItem.id, path)
                  .then(() => { if (selectedService) loadLineup(selectedService.id) })
              }
            }}
            pendingBg={pendingBgPath !== undefined}
            savingBg={savingBg}
            onSaveBgToSong={currentSong ? async () => {
              setSavingBg(true)
              try {
                await window.worshipsync.backgrounds.setBackground(currentSong.id, pendingBgPath ?? null)
                // Clear any lineup-level override so the song background wins
                if (currentItem) await window.worshipsync.lineup.setOverrideBg(currentItem.id, null)
                await loadSongs()
                if (selectedService) await loadLineup(selectedService.id)
                setBgOverride(undefined)
                setPendingBgPath(undefined)
              } finally { setSavingBg(false) }
            } : undefined}
            onSaveBgToService={currentItem ? async () => {
              setSavingBg(true)
              try {
                await window.worshipsync.lineup.setOverrideBg(currentItem.id, pendingBgPath ?? null)
                if (selectedService) await loadLineup(selectedService.id)
                setPendingBgPath(undefined)
              } finally { setSavingBg(false) }
            } : undefined}
            onDiscardBg={() => {
              setBgOverride(undefined)
              setPendingBgPath(undefined)
            }}
          />
        </div>

      </div>

      {/* ── Modals ──────────────────────────────────────────────────── */}
      {showLibrary && (
        <LibraryModal
          onClose={() => setShowLibrary(false)}
          onAdd={handleLibraryAdd}
          onAddCountdown={addCountdownToLineup}
          onAddScripture={handleAddScripture}
          onAddMedia={handleAddMedia}
          excludeIds={lineup.filter(item => item.songId != null).map(item => item.songId!)}
        />
      )}
      {showAddSong && (
        <AddSongModal
          onClose={() => setShowAddSong(false)}
          onCreated={handleCreated}
        />
      )}
      {editingItemId !== null && currentSong && (
        <EditLyricsModal
          songTitle={currentSong.title}
          artist={currentSong.artist}
          initialLyrics={sectionsToLyrics(currentSong.sections)}
          onClose={() => setEditingItemId(null)}
          onSave={handleLyricsSave}
        />
      )}
      {showEditService && selectedService && (
        <EditServiceModal
          label={selectedService.label}
          date={selectedService.date}
          onClose={() => setShowEditService(false)}
          onSave={async (label, date) => {
            await updateService(selectedService.id, { label, date })
            setShowEditService(false)
          }}
        />
      )}
      {showTemplates && (
        <Dialog open onOpenChange={(open) => !open && setShowTemplates(false)}>
          <DialogContent
            className="p-0 gap-0 overflow-hidden rounded-xl border border-border shadow-2xl"
            style={{ width: 480, maxWidth: "95vw" }}
          >
            <div className="flex flex-col bg-background text-foreground max-h-[80vh]">
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border shrink-0">
                <DialogTitle className="text-base font-semibold">Setlist Templates</DialogTitle>
              </div>

              <div className="overflow-y-auto flex-1">
                {/* Save current lineup */}
                <div className="px-5 py-4 border-b border-border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Save current lineup as template</p>
                  {lineup.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Lineup is empty — add items before saving as template.</p>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newTemplateName}
                        onChange={(e) => setNewTemplateName(e.target.value)}
                        placeholder="e.g. Sunday Morning Flow"
                        onKeyDown={(e) => e.key === 'Enter' && !savingTemplate && newTemplateName.trim() && handleSaveTemplate()}
                        className="flex-1 h-9 px-3 text-sm bg-background border border-border rounded-md outline-none focus:border-primary/50 transition-colors placeholder:text-muted-foreground/40"
                      />
                      <Button
                        size="sm"
                        disabled={!newTemplateName.trim() || savingTemplate}
                        onClick={handleSaveTemplate}
                      >
                        Save
                      </Button>
                    </div>
                  )}
                </div>

                {/* Saved templates */}
                <div className="px-5 py-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Saved templates</p>
                  {templates.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No templates saved yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {templates.map((tpl) => (
                        <div key={tpl.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{tpl.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {tpl.items.length} items · {new Date(tpl.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <Button
                            size="sm" variant="outline"
                            disabled={applyingTemplate}
                            onClick={() => handleApplyTemplate(tpl)}
                          >
                            Apply
                          </Button>
                          <button
                            onClick={() => handleDeleteTemplate(tpl.id)}
                            className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

// ── Sortable Section Tab ─────────────────────────────────────────────────────

function SortableSectionTab({ id, label, color }: { id: number; label: string; color: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={`${color} text-white text-[10px] font-bold px-2 py-0.5 rounded cursor-grab active:cursor-grabbing touch-none select-none`}
    >
      {label}
    </div>
  )
}

// ── Item Settings Panel (Right Sidebar) ─────────────────────────────────────

function ItemSettingsPanel({
  currentItem, notes, onNotesChange, onNotesBlur,
  slide, theme, bg, canCustomize, readOnly, isOverridden,
  pendingBg, savingBg, onSaveBgToSong, onSaveBgToService, onDiscardBg,
  onThemeChange, onBgChange,
}: {
  currentItem: LineupItemWithSong | null
  notes: string
  onNotesChange: (val: string) => void
  onNotesBlur: (val: string) => void
  slide: Slide | null
  theme: ThemeStyle
  bg: string | null
  canCustomize: boolean
  readOnly?: boolean
  isOverridden: boolean
  pendingBg: boolean
  savingBg: boolean
  onSaveBgToSong?: () => void
  onSaveBgToService?: () => void
  onDiscardBg: () => void
  onThemeChange: (key: keyof ThemeStyle, value: any) => void
  onBgChange: (path: string | null) => void
}) {
  const [showBgPicker, setShowBgPicker] = useState(false)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Item Settings</span>
      </div>
      <div className="flex-1 overflow-y-auto">

        {/* Cue Notes */}
        <div className="px-4 py-3 border-b border-border">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">Cue Notes</label>
          <textarea
            value={notes}
            onChange={e => onNotesChange(e.target.value)}
            onBlur={e => onNotesBlur(e.target.value)}
            placeholder={readOnly ? "No notes." : "Keys start softly. Full band on Verse 2…"}
            readOnly={readOnly || !currentItem}
            rows={3}
            className="w-full text-xs text-foreground bg-background border border-border rounded-md px-3 py-2 resize-none outline-none placeholder:text-muted-foreground/40 focus:border-primary/50 transition-colors leading-relaxed"
          />
        </div>

        {/* Slide preview */}
        {canCustomize && (
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Preview</span>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Eye className="h-3 w-3" /> Not broadcasting
              </span>
            </div>
            <div className="rounded-lg overflow-hidden border border-border bg-gray-950 relative" style={{ aspectRatio: "16/9" }}>
              {bg && slide && <img src={`file://${bg}`} className="absolute inset-0 w-full h-full object-cover" alt="" />}
              {bg && slide && <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${theme.overlayOpacity / 100})` }} />}
              {slide ? (
                <div className={`relative h-full flex p-4 ${
                  theme.textPosition === "top" ? "items-start" : theme.textPosition === "bottom" ? "items-end" : "items-center"
                } justify-center`}>
                  <p className="text-xs leading-relaxed whitespace-pre-wrap"
                    style={{ color: theme.textColor, fontFamily: theme.fontFamily, fontWeight: Number(theme.fontWeight) || 600, textAlign: theme.textAlign, textShadow: theme.textShadowOpacity > 0 ? `0 2px 4px rgba(0,0,0,${theme.textShadowOpacity / 100})` : "none" }}>
                    {slide.lines.join("\n")}
                  </p>
                </div>
              ) : (
                <div className="relative h-full flex items-center justify-center">
                  <p className="text-[10px] text-gray-600">No slide selected</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Background */}
        {canCustomize && (
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Background</label>
              {isOverridden && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">Overridden</span>}
            </div>
            <div
              onClick={() => !readOnly && setShowBgPicker(true)}
              className={`flex items-center gap-2.5 p-2 rounded-md bg-background/40 border border-border transition-colors ${readOnly ? "opacity-50" : "cursor-pointer hover:bg-accent/30"}`}
            >
              <div className="w-14 h-8 rounded overflow-hidden shrink-0 border border-border bg-black flex items-center justify-center">
                {bg ? (
                  bg.startsWith("color:") ? (
                    <div className="w-full h-full" style={{ background: bg.replace("color:", "") }} />
                  ) : (
                    <img src={`file://${bg}`} className="w-full h-full object-cover" alt="" />
                  )
                ) : (
                  <ImageIcon className="h-3.5 w-3.5 text-muted-foreground/40" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium truncate">
                  {bg ? (bg.split('/').pop() ?? 'Background') : 'No background'}
                </p>
                <p className={`text-[10px] ${bg ? (/\.(mp4|webm|mov)$/i.test(bg) ? 'text-green-400' : 'text-muted-foreground') : 'text-muted-foreground'}`}>
                  {bg ? (/\.(mp4|webm|mov)$/i.test(bg) ? 'Playing • Looped' : 'Static') : 'Click to set one'}
                </p>
              </div>
              {bg && (
                <button
                  onClick={e => { e.stopPropagation(); onBgChange(null); }}
                  disabled={readOnly}
                  className="shrink-0 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                  title="Clear background"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Pending save action bar */}
            {pendingBg && (
              <div className="mt-2 p-2.5 rounded-md bg-amber-500/10 border border-amber-500/20 flex flex-col gap-2">
                <p className="text-[10px] text-amber-400 font-medium">Background changed — where should it apply?</p>
                <div className="flex gap-1.5">
                  <button
                    onClick={onDiscardBg}
                    disabled={savingBg}
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                  >
                    Discard
                  </button>
                  <div className="flex-1" />
                  {onSaveBgToService && (
                    <button
                      onClick={onSaveBgToService}
                      disabled={savingBg}
                      className="text-[10px] font-semibold px-2 py-1 rounded border border-border bg-background hover:bg-accent transition-colors disabled:opacity-40"
                    >
                      This service only
                    </button>
                  )}
                  {onSaveBgToSong && (
                    <button
                      onClick={onSaveBgToSong}
                      disabled={savingBg}
                      className="text-[10px] font-semibold px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40"
                    >
                      {savingBg ? "Saving…" : "Save to song"}
                    </button>
                  )}
                </div>
              </div>
            )}

            {showBgPicker && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowBgPicker(false)}>
                <div className="bg-card border border-border rounded-xl shadow-2xl w-[420px] max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
                    <span className="text-sm font-semibold">Background</span>
                    <button onClick={() => setShowBgPicker(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="overflow-y-auto p-4">
                    <BackgroundPickerPanel
                      currentBackground={bg}
                      previewLabel={currentItem?.title ?? ""}
                      onSelect={(path) => { onBgChange(path); setShowBgPicker(false); }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Theme Styling */}
        {canCustomize && (
          <div className={`px-4 py-3 ${readOnly ? "pointer-events-none opacity-50" : ""}`}>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-3">Theme Styling</label>
            <div className="space-y-3">
              <div>
                <p className="text-[10px] text-muted-foreground mb-1.5">Text Layout</p>
                <div className="flex gap-1.5">
                  {(["left", "center", "right"] as const).map(align => (
                    <button key={align} onClick={() => onThemeChange("textAlign", align)}
                      className={`flex-1 h-8 rounded-md border flex items-center justify-center text-sm transition-colors ${theme.textAlign === align ? "bg-primary/10 text-primary border-primary/30" : "border-input text-muted-foreground hover:text-foreground hover:bg-accent"}`}>
                      {align === "left" ? "⫷" : align === "center" ? "☰" : "⫸"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground mb-1.5">Position</p>
                <div className="flex gap-1.5">
                  {(["top", "middle", "bottom"] as const).map(pos => (
                    <button key={pos} onClick={() => onThemeChange("textPosition", pos)}
                      className={`flex-1 h-8 rounded-md border text-xs capitalize transition-colors ${theme.textPosition === pos ? "bg-primary/10 text-primary border-primary/30" : "border-input text-muted-foreground hover:text-foreground hover:bg-accent"}`}>
                      {pos}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground mb-1.5">Font</p>
                <select className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                  value={theme.fontFamily} onChange={e => onThemeChange("fontFamily", e.target.value)}>
                  {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground mb-1.5">Overlay Opacity</p>
                <div className="flex items-center gap-2">
                  <input type="range" className="flex-1 h-1 accent-primary" min={0} max={100} step={5}
                    value={theme.overlayOpacity} onChange={e => onThemeChange("overlayOpacity", Number(e.target.value))} />
                  <span className="text-xs text-muted-foreground w-10 text-right">{theme.overlayOpacity}%</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Appearance Panel (Right Sidebar) ────────────────────────────────────────

const FONT_OPTIONS = [
  { value: "Inter, sans-serif", label: "Inter" },
  { value: "Montserrat, sans-serif", label: "Montserrat" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "Roboto, sans-serif", label: "Roboto" },
]

// ── SortableLineupItem ────────────────────────────────────────────────────────

function SortableLineupItem({
  id, index, isSelected,
  title, subtitle, isPast, onSelect, onDelete,
}: {
  id: number
  index: number
  isSelected: boolean
  title: string
  subtitle: string
  isPast: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 10 : undefined,
      }}
      className={`group rounded-md mb-0.5 transition-colors ${
        isSelected ? "bg-primary/10 border border-primary/30" : "border border-transparent hover:bg-accent/50"
      }`}
    >
      <div className="w-full flex items-center gap-1 pr-2.5 text-left">
        {/* Drag handle */}
        {!isPast && (
          <button
            {...attributes}
            {...listeners}
            className="flex-shrink-0 pl-1.5 py-2 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground touch-none"
            tabIndex={-1}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          onClick={onSelect}
          className="flex items-center gap-2 py-2 text-left flex-1 min-w-0"
          style={{ paddingLeft: isPast ? "10px" : undefined }}
        >
          <span className={`text-[10px] font-mono w-4 shrink-0 ${
            isSelected ? "text-primary" : "text-muted-foreground"
          }`}>
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className={`text-xs font-medium truncate ${
              isSelected ? "text-primary" : "text-foreground"
            }`}>
              {title}
            </p>
            <p className="text-[10px] text-muted-foreground truncate mt-0.5">{subtitle}</p>
          </div>
        </button>
        {/* Delete — visible on hover or when selected */}
        {!isPast && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            title="Remove"
            className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

    </div>
  )
}

// ── EditServiceModal ──────────────────────────────────────────────────────────

function EditServiceModal({
  label: initialLabel, date: initialDate, onClose, onSave,
}: {
  label: string
  date: string
  onClose: () => void
  onSave: (label: string, date: string) => Promise<void>
}) {
  const [label, setLabel] = useState(initialLabel)
  const [date, setDate] = useState(initialDate)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const save = async () => {
    if (!label.trim()) { setError("Service name is required"); return }
    if (!date) { setError("Date is required"); return }
    setSaving(true)
    try {
      await onSave(label.trim(), date)
    } catch (e: any) {
      setError(e?.message?.includes("UNIQUE") ? "A service already exists for this date." : "Failed to save.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent hideClose className="p-0 gap-0 overflow-hidden rounded-xl border border-border shadow-xl" style={{ width: 420, maxWidth: "95vw" }}>
        <div className="flex flex-col bg-background text-foreground">
          <div className="px-6 pt-5 pb-1">
            <DialogTitle className="text-lg font-bold">Edit service</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">Update the name or date for this service.</p>
          </div>

          <div className="px-6 py-5 flex flex-col gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Service name</label>
              <Input
                autoFocus
                value={label}
                onChange={(e) => { setLabel(e.target.value); setError("") }}
                onKeyDown={(e) => e.key === "Enter" && save()}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="date"
                  className="pl-9"
                  value={date}
                  onChange={(e) => { setDate(e.target.value); setError("") }}
                />
              </div>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" disabled={saving} onClick={save} className="gap-1.5">
              <Pencil className="h-3.5 w-3.5" />
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
