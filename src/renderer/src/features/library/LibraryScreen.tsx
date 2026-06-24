import { useEffect, useState, useMemo, useCallback } from "react"
import {
  Search, Plus, Music2, Pencil, Trash2, X,
  ChevronRight, ChevronLeft, Save, ArrowUpDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useSongStore } from "../../store/useSongStore"
import { toFileUrl } from "../../lib/utils"
import BackgroundPickerPanel from "../../components/BackgroundPickerPanel"
import type { Song, Section } from "../../../../../shared/types"

interface SongWithSections extends Song {
  sections: Section[]
}

const SECTION_ABBREV: Record<string, string> = {
  verse: "V",
  chorus: "C",
  bridge: "B",
  "pre-chorus": "PC",
  intro: "I",
  outro: "O",
  tag: "T",
  interlude: "IL",
}

const SECTION_BADGE_COLORS: Record<string, string> = {
  verse: "bg-emerald-600",
  chorus: "bg-blue-600",
  bridge: "bg-amber-600",
  "pre-chorus": "bg-violet-600",
  intro: "bg-slate-600",
  outro: "bg-slate-600",
  tag: "bg-red-600",
  interlude: "bg-slate-600",
}

const TAG_BUTTONS = ["Verse", "Chorus", "Bridge", "Pre-Chorus", "Tag", "Ending"] as const

// ── Presentation style types & defaults ─────────────────────────────────

interface ThemeSettings {
  fontFamily: string
  fontSize: number
  fontWeight: string
  textColor: string
  textAlign: "left" | "center" | "right"
  textPosition: "top" | "middle" | "bottom"
  overlayOpacity: number
  textShadowOpacity: number
  maxLinesPerSlide: number
  backgroundPath: string | null
}

const DEFAULT_SETTINGS: ThemeSettings = {
  fontFamily: "Montserrat, sans-serif",
  fontSize: 48,
  fontWeight: "600",
  textColor: "#ffffff",
  textAlign: "center",
  textPosition: "middle",
  overlayOpacity: 45,
  textShadowOpacity: 40,
  maxLinesPerSlide: 2,
  backgroundPath: null,
}

const FONT_OPTIONS = [
  "Montserrat, sans-serif",
  "Inter, sans-serif",
  "Georgia, serif",
  "Arial, sans-serif",
  "Times New Roman, serif",
  "Trebuchet MS, sans-serif",
  "Palatino, serif",
]

const TEXT_COLORS = [
  { hex: "#ffffff", label: "White" },
  { hex: "#f5f0e0", label: "Cream" },
  { hex: "#f5c842", label: "Gold" },
  { hex: "#60a5fa", label: "Blue" },
  { hex: "#f472b6", label: "Pink" },
  { hex: "#4ade80", label: "Green" },
]

// ── Helpers: serialize/parse bracket-tag lyrics ─────────────────────────

function sectionsToText(sections: Section[]): string {
  return sections
    .map((s) => `[${s.label}]\n${s.lyrics}`)
    .join("\n\n")
}

function textToSections(text: string): { type: string; label: string; lyrics: string; orderIndex: number }[] {
  const result: { type: string; label: string; lyrics: string; orderIndex: number }[] = []
  const tagPattern = /^\[(.+?)\]$/
  const lines = text.split("\n")
  let current: { type: string; label: string; lyrics: string[] } | null = null

  for (const line of lines) {
    const match = line.match(tagPattern)
    if (match) {
      if (current) {
        result.push({
          type: current.type,
          label: current.label,
          lyrics: current.lyrics.join("\n").trim(),
          orderIndex: result.length,
        })
      }
      const label = match[1]
      const lower = label.toLowerCase()
      let type = "verse"
      if (lower.startsWith("chorus")) type = "chorus"
      else if (lower.startsWith("bridge")) type = "bridge"
      else if (lower.startsWith("pre-chorus") || lower.startsWith("pre chorus")) type = "pre-chorus"
      else if (lower.startsWith("intro")) type = "intro"
      else if (lower.startsWith("outro") || lower.startsWith("ending")) type = "outro"
      else if (lower.startsWith("tag")) type = "tag"
      else if (lower.startsWith("interlude")) type = "interlude"
      current = { type, label, lyrics: [] }
    } else if (current) {
      current.lyrics.push(line)
    }
  }
  if (current) {
    result.push({
      type: current.type,
      label: current.label,
      lyrics: current.lyrics.join("\n").trim(),
      orderIndex: result.length,
    })
  }
  return result
}

function buildSlides(lyricsText: string, maxLines = DEFAULT_SETTINGS.maxLinesPerSlide) {
  const sections = textToSections(lyricsText)
  const result: { label: string; type: string; abbr: string; lines: string[] }[] = []
  for (const sec of sections) {
    // Split into paragraphs on blank lines — each boundary forces a new slide
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

    const chunks: string[][] = []
    for (const para of paragraphs) {
      for (let i = 0; i < para.length; i += maxLines) {
        chunks.push(para.slice(i, i + maxLines))
      }
    }
    if (chunks.length === 0) continue
    const abbr = SECTION_ABBREV[sec.type] ?? sec.type.charAt(0).toUpperCase()
    const numPart = sec.label.replace(/\D/g, "")
    chunks.forEach((chunk, ci) => {
      result.push({
        label: sec.label + (chunks.length > 1 ? ` (${ci + 1}/${chunks.length})` : ""),
        type: sec.type,
        abbr: abbr + (sec.type === "verse" && numPart ? numPart : ""),
        lines: chunk,
      })
    })
  }
  return result
}

type SortOption = 'title-asc' | 'title-desc' | 'most-used' | 'least-used' | 'last-used'

interface UsageInfo { usageCount: number; lastUsedDate: string | null }

// ── Main Screen ──────────────────────────────────────────────────────────

export default function LibraryScreen() {
  const {
    songs, selectedSong, searchQuery, loading,
    loadSongs, selectSong, setSearchQuery,
  } = useSongStore()

  const [editingSong,  setEditingSong]  = useState<SongWithSections | "new" | null>(null)
  const [sortBy,       setSortBy]       = useState<SortOption>('title-asc')
  const [filterKey,    setFilterKey]    = useState<string | null>(null)
  const [filterLetter, setFilterLetter] = useState<string | null>(null)
  const [showFilters,  setShowFilters]  = useState(false)
  const [usageMap,     setUsageMap]     = useState<Record<number, UsageInfo>>({})

  useEffect(() => { loadSongs() }, [])

  useEffect(() => {
    window.worshipsync.analytics.getSongUsage().then((list: any[]) => {
      const map: Record<number, UsageInfo> = {}
      list.forEach((s: any) => { map[s.id] = { usageCount: s.usageCount ?? 0, lastUsedDate: s.lastUsedDate ?? null } })
      setUsageMap(map)
    }).catch(() => {})
  }, [songs.length])

  // Unique keys for filter chips
  const allKeys = useMemo(() =>
    [...new Set(songs.map(s => s.key).filter((k): k is string => !!k))].sort()
  , [songs])

  // Apply filter + sort to song list
  const displayedSongs = useMemo(() => {
    let list = [...songs]
    if (filterKey)    list = list.filter(s => s.key === filterKey)
    if (filterLetter) list = list.filter(s => s.title.trim().toUpperCase().startsWith(filterLetter))
    switch (sortBy) {
      case 'title-desc':  list.sort((a, b) => b.title.localeCompare(a.title)); break
      case 'most-used':   list.sort((a, b) => (usageMap[b.id]?.usageCount ?? 0) - (usageMap[a.id]?.usageCount ?? 0)); break
      case 'least-used':  list.sort((a, b) => (usageMap[a.id]?.usageCount ?? 0) - (usageMap[b.id]?.usageCount ?? 0)); break
      case 'last-used':   list.sort((a, b) => {
        const da = usageMap[a.id]?.lastUsedDate ?? ''
        const db = usageMap[b.id]?.lastUsedDate ?? ''
        return db.localeCompare(da)
      }); break
      default:            list.sort((a, b) => a.title.localeCompare(b.title)); break
    }
    return list
  }, [songs, filterKey, filterLetter, sortBy, usageMap])

  // Show the add/edit screen as a full overlay
  if (editingSong) {
    return (
      <SongFormScreen
        song={editingSong === "new" ? null : editingSong}
        onClose={() => setEditingSong(null)}
        onSaved={async (savedId) => {
          setEditingSong(null)
          await loadSongs()
          if (savedId) await selectSong(savedId)
        }}
      />
    )
  }

  return (
    <div className="h-full flex overflow-hidden bg-background text-foreground">

      {/* ── Left: song list (380px) ──────────────────────────────────── */}
      <div className="w-[380px] shrink-0 flex flex-col border-r border-border bg-card overflow-hidden">

        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-border shrink-0 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Song Library</h2>
            <Button size="sm" className="gap-1.5 h-8 text-[13px]" onClick={() => setEditingSong("new")}>
              <Plus className="h-3.5 w-3.5" /> New Song
            </Button>
          </div>

          {/* Search + Sort + Filter toggle row */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                className="pl-9 text-[13px]"
                placeholder="Search songs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="relative shrink-0">
              <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as SortOption)}
                className="h-9 pl-8 pr-2 text-[12px] bg-input border border-border rounded-md outline-none focus:border-primary/50 cursor-pointer text-foreground appearance-none"
              >
                <option value="title-asc">A → Z</option>
                <option value="title-desc">Z → A</option>
                <option value="most-used">Most Used</option>
                <option value="least-used">Least Used</option>
                <option value="last-used">Last Used</option>
              </select>
            </div>
            <button
              onClick={() => setShowFilters(v => !v)}
              className={`relative h-9 px-3 rounded-md text-[12px] font-semibold border transition-colors shrink-0 ${
                showFilters || filterKey || filterLetter
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              Filter
              {(filterKey || filterLetter) && (
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary" />
              )}
            </button>
          </div>

          {/* Collapsible filters */}
          {showFilters && (
            <div className="flex flex-col gap-3 pt-1">
              {/* Musical key */}
              {allKeys.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Musical Key</span>
                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      onClick={() => setFilterKey(null)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                        filterKey === null
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                      }`}
                    >Any</button>
                    {allKeys.map(k => (
                      <button
                        key={k}
                        onClick={() => setFilterKey(filterKey === k ? null : k)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                          filterKey === k
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                        }`}
                      >{k}</button>
                    ))}
                  </div>
                </div>
              )}
              {/* A–Z first letter */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Starts with</span>
                <div className="flex gap-1 flex-wrap">
                  {['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'].map(l => (
                    <button
                      key={l}
                      onClick={() => setFilterLetter(filterLetter === l ? null : l)}
                      className={`w-6 h-6 rounded text-[11px] font-semibold transition-colors ${
                        filterLetter === l
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent"
                      }`}
                    >{l}</button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Result count / clear */}
        {(searchQuery || filterKey || filterLetter) && (
          <div className="px-4 py-1.5 border-b border-border shrink-0 flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">
              {displayedSongs.length} {displayedSongs.length === 1 ? "song" : "songs"}
              {filterKey && ` · key ${filterKey}`}{filterLetter && ` · starts with ${filterLetter}`}
            </span>
            <button onClick={() => { setSearchQuery(""); setFilterKey(null); setFilterLetter(null) }}
              className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 ml-auto">
              <X className="h-3 w-3" /> Clear
            </button>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {!loading && songs.length === 0 && !searchQuery && !filterKey && !filterLetter && (
            <EmptyLibrary onCreate={() => setEditingSong("new")} />
          )}
          {!loading && displayedSongs.length === 0 && (searchQuery || filterKey || filterLetter || songs.length > 0) && (
            <div className="flex flex-col items-center justify-center text-center p-8 gap-3">
              <Search className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                No songs match{searchQuery ? ` "${searchQuery}"` : ""}
                {filterKey ? ` in key ${filterKey}` : ""}
                {filterLetter ? ` starting with "${filterLetter}"` : ""}
              </p>
              <button onClick={() => { setSearchQuery(""); setFilterKey(null); setFilterLetter(null) }}
                className="text-xs text-primary hover:underline">Clear filters</button>
            </div>
          )}
          {displayedSongs.map((song) => (
            <SongRow
              key={song.id}
              song={song}
              usage={usageMap[song.id]}
              selected={selectedSong?.id === song.id}
              onClick={() => selectSong(song.id)}
              onEdit={() => selectSong(song.id).then(() => setEditingSong(useSongStore.getState().selectedSong!))}
            />
          ))}
        </div>
      </div>

      {/* ── Center + Right: detail & preview ─────────────────────────── */}
      <div className="flex-1 flex min-w-0 overflow-hidden">
        {selectedSong ? (
          <SongDetailView
            song={selectedSong}
            usage={usageMap[selectedSong.id]}
            onEdit={() => setEditingSong(selectedSong)}
            onDelete={async () => {
              if (!confirm(`Delete "${selectedSong.title}"? This cannot be undone.`)) return
              await window.worshipsync.songs.delete(selectedSong.id)
              useSongStore.getState().clearSelection()
              loadSongs()
            }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center px-6 text-center">
            <div>
              <Music2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Select a song to see its details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Song Row ─────────────────────────────────────────────────────────────

function SongRow({
  song, selected, usage, onClick, onEdit,
}: {
  song: Song
  selected: boolean
  usage?: UsageInfo
  onClick: () => void
  onEdit: () => void
}) {
  const fmtDate = (d: string | null | undefined) => {
    if (!d) return null
    return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }
  const count = usage?.usageCount ?? 0
  const lastDate = fmtDate(usage?.lastUsedDate)

  return (
    <div className={`relative group border-b border-border ${selected ? "bg-primary/5 border-l-[3px] border-l-primary" : "border-l-[3px] border-l-transparent hover:bg-accent/30"}`}>
      <button
        onClick={onClick}
        className="w-full text-left flex flex-col gap-1 px-4 py-3 pr-10 transition-colors cursor-pointer"
      >
        <div className="flex items-start justify-between gap-2">
          <span className={`text-sm truncate ${selected ? "font-semibold text-primary" : "font-medium text-foreground"}`}>
            {song.title}
          </span>
          {song.key && (
            <span className="shrink-0 text-[11px] font-semibold text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded-full border border-primary/20">
              {song.key}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-muted-foreground truncate">{song.artist || "Unknown"}</span>
          <span className="text-muted-foreground/40 text-[11px]">·</span>
          <span className={`text-[11px] shrink-0 ${count === 0 ? "text-muted-foreground/50" : "text-muted-foreground"}`}>
            {count === 0 ? "Never used" : `${count}×${lastDate ? ` · ${lastDate}` : ""}`}
          </span>
        </div>
      </button>
      {/* Hover-reveal edit button */}
      <button
        onClick={(e) => { e.stopPropagation(); onEdit() }}
        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-accent transition-all text-muted-foreground hover:text-foreground"
        title="Edit song"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ── Song Detail View (center + right, read-only with inline edit) ───────

function SongDetailView({
  song, usage, onEdit, onDelete,
}: {
  song: SongWithSections
  usage?: UsageInfo
  onEdit: () => void
  onDelete: () => void
}) {
  const lyricsText = useMemo(() => sectionsToText(song.sections), [song.sections])

  // Load per-song theme settings
  const [songTheme, setSongTheme] = useState<ThemeSettings>({ ...DEFAULT_SETTINGS, backgroundPath: song.backgroundPath ?? null })
  useEffect(() => {
    if (song.themeId) {
      window.worshipsync.themes.getAll().then((all: any[]) => {
        const t = all.find((th: any) => th.id === song.themeId)
        if (t?.settings) {
          try {
            const parsed = JSON.parse(t.settings)
            setSongTheme({ ...DEFAULT_SETTINGS, ...parsed, backgroundPath: song.backgroundPath ?? parsed.backgroundPath ?? null })
          } catch {}
        }
      })
    } else {
      setSongTheme({ ...DEFAULT_SETTINGS, backgroundPath: song.backgroundPath ?? null })
    }
  }, [song.id, song.themeId, song.backgroundPath])

  const slides = useMemo(() => buildSlides(lyricsText, songTheme.maxLinesPerSlide), [lyricsText, songTheme.maxLinesPerSlide])

  return (
    <>
      {/* ── Center: song details + lyrics (read-only) ────────────── */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-border overflow-hidden">

        {/* Header */}
        <div className="px-5 py-4 border-b border-border bg-card shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold truncate">{song.title}</h2>
              <p className="text-[13px] text-muted-foreground mt-0.5 truncate">
                {song.artist || "Unknown artist"}
                {song.ccliNumber && ` · CCLI #${song.ccliNumber}`}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-8 text-xs"
                onClick={onEdit}
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground hover:text-destructive gap-1.5"
                onClick={onDelete}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {song.key && (
              <span className="text-[11px] font-semibold text-primary/70 bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20">
                {song.key}
              </span>
            )}
            {song.tempo && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border">
                {song.tempo} BPM
              </span>
            )}
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border">
              {song.sections.length} {song.sections.length === 1 ? "section" : "sections"}
            </span>
          </div>

          {/* Usage history */}
          {(() => {
            const count = usage?.usageCount ?? 0
            const last = usage?.lastUsedDate
              ? new Date(usage.lastUsedDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
              : null
            return (
              <p className={`text-[11px] mt-2 ${count > 0 ? "text-emerald-500" : "text-amber-500/80"}`}>
                {count > 0 ? `Used ${count} ${count === 1 ? "time" : "times"}${last ? ` · Last: ${last}` : ""}` : "Never used in a service"}
              </p>
            )
          })()}
        </div>

        {/* Lyrics (read-only) */}
        <div className="flex-1 overflow-hidden">
          <Textarea
            className="w-full h-full border-0 rounded-none font-mono text-sm leading-relaxed focus-visible:ring-0 shadow-none resize-none p-5 cursor-default"
            placeholder="No lyrics yet — click Edit to add."
            value={lyricsText}
            readOnly
          />
        </div>
      </div>

      {/* ── Right: slide preview ─────────────────────────────────────── */}
      <SlidePreviewPanel slides={slides} style={songTheme} />
    </>
  )
}

// ── Slide Preview Panel — single slide with section tabs + prev/next ─────

function SlidePreviewPanel({ slides, style }: {
  slides: { label: string; type: string; abbr: string; lines: string[] }[]
  style?: Partial<ThemeSettings>
}) {
  const [current, setCurrent] = useState(0)
  const idx = Math.min(current, Math.max(0, slides.length - 1))

  // Section tabs: one per unique section label
  const sectionTabs = useMemo(() => {
    const seen = new Set<string>()
    const tabs: { label: string; type: string; abbr: string; firstIdx: number }[] = []
    slides.forEach((s, i) => {
      const key = s.label.replace(/\s*\(\d+\/\d+\)$/, "")
      if (!seen.has(key)) { seen.add(key); tabs.push({ label: key, type: s.type, abbr: s.abbr, firstIdx: i }) }
    })
    return tabs
  }, [slides])

  const activeSection = useMemo(() => {
    const slide = slides[idx]
    return slide ? slide.label.replace(/\s*\(\d+\/\d+\)$/, "") : ""
  }, [slides, idx])

  if (slides.length === 0) {
    return (
      <div className="w-[340px] shrink-0 flex flex-col bg-background overflow-hidden border-l border-border items-center justify-center">
        <p className="text-xs text-muted-foreground">Add lyrics to see slide previews</p>
      </div>
    )
  }

  return (
    <div className="w-[340px] shrink-0 flex flex-col bg-background overflow-hidden border-l border-border">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-card shrink-0 flex items-center justify-between">
        <span className="text-[13px] font-semibold">Slide Preview</span>
        <span className="text-[11px] text-muted-foreground tabular-nums">{idx + 1} / {slides.length}</span>
      </div>

      {/* Section tabs */}
      <div className="px-3 py-2 border-b border-border bg-card/50 shrink-0 flex gap-1.5 flex-wrap">
        {sectionTabs.map(tab => (
          <button
            key={tab.label}
            onClick={() => setCurrent(tab.firstIdx)}
            className={`text-[10px] font-bold px-2 py-1 rounded-full transition-all ${
              activeSection === tab.label
                ? `${SECTION_BADGE_COLORS[tab.type] ?? "bg-slate-600"} text-white`
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Large single slide */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4 overflow-hidden">
        <div className="w-full">
          <SlideThumb lines={slides[idx].lines} style={style} />
        </div>

        {/* Prev / Next */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setCurrent(i => Math.max(0, i - 1))}
            disabled={idx === 0}
            className="p-1.5 rounded-md border border-border hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-[11px] text-muted-foreground min-w-[80px] text-center truncate">
            {slides[idx].label}
          </span>
          <button
            onClick={() => setCurrent(i => Math.min(slides.length - 1, i + 1))}
            disabled={idx === slides.length - 1}
            className="p-1.5 rounded-md border border-border hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Empty State ──────────────────────────────────────────────────────────

function EmptyLibrary({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="h-full flex items-center justify-center text-center px-6">
      <div className="max-w-xs">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <Music2 className="h-6 w-6 text-primary" />
        </div>
        <h3 className="text-sm font-bold mb-1">Your song library is empty</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Add your first song to start building service lineups.
        </p>
        <Button size="sm" className="gap-1.5" onClick={onCreate}>
          <Plus className="h-3.5 w-3.5" /> Add a song
        </Button>
      </div>
    </div>
  )
}

// ── Full-screen Add/Edit Song Form ──────────────────────────────────────

function SongFormScreen({
  song, onClose, onSaved,
}: {
  song: SongWithSections | null
  onClose: () => void
  onSaved: (savedId?: number) => Promise<void>
}) {
  const isEdit = !!song
  const [title, setTitle] = useState(song?.title ?? "")
  const [artist, setArtist] = useState(song?.artist ?? "")
  const [key, setKey] = useState(song?.key ?? "")
  const [tempo, setTempo] = useState<"slow" | "medium" | "fast" | "">(
    (song?.tempo as any) ?? "",
  )
  const [ccli,      setCcli]      = useState(song?.ccliNumber ?? "")
  const [copyright, setCopyright] = useState(song?.copyright ?? "")
  const [lyricsText, setLyricsText] = useState(
    song ? sectionsToText(song.sections) : "",
  )
  const [styleSettings, setStyleSettings] = useState<ThemeSettings>({
    ...DEFAULT_SETTINGS,
    backgroundPath: song?.backgroundPath ?? null,
  })
  const [existingThemeId] = useState<number | null>(song?.themeId ?? null)
  const [saving,      setSaving]      = useState(false)
  const [showStyle,   setShowStyle]   = useState(false)

  // Load existing per-song theme settings on mount
  useEffect(() => {
    if (song?.themeId) {
      window.worshipsync.themes.getAll().then((allThemes: any[]) => {
        const t = allThemes.find((th: any) => th.id === song.themeId)
        if (t?.settings) {
          try {
            const parsed = JSON.parse(t.settings)
            setStyleSettings((prev) => ({
              ...prev,
              ...parsed,
              backgroundPath: song.backgroundPath ?? parsed.backgroundPath ?? null,
            }))
          } catch {}
        }
      })
    }
  }, [])

  const insertTag = useCallback((tag: string) => {
    setLyricsText((prev) => {
      const suffix = prev.length > 0 && !prev.endsWith("\n\n") ? (prev.endsWith("\n") ? "\n" : "\n\n") : ""
      return prev + suffix + `[${tag}]\n`
    })
  }, [])

  const slides = useMemo(() => buildSlides(lyricsText, styleSettings.maxLinesPerSlide), [lyricsText, styleSettings.maxLinesPerSlide])

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)

    const parsed = textToSections(lyricsText)
    const themeSettingsJson = JSON.stringify(styleSettings)

    let savedId: number | undefined

    if (isEdit && song) {
      // Update or create per-song theme
      let themeId = existingThemeId
      if (themeId) {
        await window.worshipsync.themes.update(themeId, { settings: themeSettingsJson })
      } else {
        const created = await window.worshipsync.themes.create({
          name: `Song: ${title.trim()}`,
          type: "per-song",
          isDefault: false,
          settings: themeSettingsJson,
        }) as { id: number }
        themeId = created.id
      }

      await window.worshipsync.songs.update(song.id, {
        title: title.trim(),
        artist: artist.trim(),
        key: key.trim() || null,
        tempo: tempo || null,
        ccliNumber: ccli.trim() || null,
        copyright: copyright.trim() || null,
        backgroundPath: styleSettings.backgroundPath,
        themeId,
      })
      await window.worshipsync.songs.upsertSections(song.id, parsed)
      savedId = song.id
    } else {
      // Create per-song theme first
      const createdTheme = await window.worshipsync.themes.create({
        name: `Song: ${title.trim()}`,
        type: "per-song",
        isDefault: false,
        settings: themeSettingsJson,
      }) as { id: number }

      const created = await window.worshipsync.songs.create({
        title: title.trim(),
        artist: artist.trim(),
        key: key.trim() || null,
        tempo: tempo || null,
        ccliNumber: ccli.trim() || null,
        copyright: copyright.trim() || null,
        tags: "[]",
        sections: parsed,
      }) as { id: number } | undefined
      savedId = created?.id

      if (savedId) {
        // Link theme and set background on newly created song
        await window.worshipsync.songs.update(savedId, {
          themeId: createdTheme.id,
          backgroundPath: styleSettings.backgroundPath,
        })
      }
    }

    setSaving(false)
    await onSaved(savedId)
  }

  const canSave = title.trim().length > 0

  return (
    <div className="h-full flex flex-col bg-background text-foreground overflow-hidden">

      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <div className="px-5 py-3.5 border-b border-border bg-card shrink-0 flex items-center gap-4">
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground min-w-0">
          <button onClick={onClose} className="hover:text-foreground transition-colors shrink-0">Song Library</button>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          <span className="text-foreground font-medium truncate">{title || (isEdit ? "Edit Song" : "New Song")}</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowStyle(v => !v)}
            className={`h-8 px-3 rounded-md text-[12px] font-semibold border transition-colors ${
              showStyle
                ? "bg-primary/10 text-primary border-primary/30"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
          >
            Style
          </button>
          <Button variant="ghost" size="sm" className="h-8 text-[13px]" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="h-8 text-[13px] gap-1.5" disabled={!canSave || saving} onClick={handleSave}>
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {/* ── Workspace ────────────────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* Left: song metadata (260px) */}
        <div className="w-[260px] shrink-0 flex flex-col border-r border-border bg-card overflow-y-auto">
          <div className="p-4 flex flex-col gap-3.5">
            <Field label="Song Title *">
              <Input autoFocus placeholder="e.g. 10,000 Reasons" value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field label="Artist / Author">
              <Input placeholder="e.g. Matt Redman" value={artist} onChange={(e) => setArtist(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Key">
                <select
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  className="h-9 w-full px-2.5 text-[13px] bg-input border border-border rounded-md outline-none focus:border-primary/50 cursor-pointer text-foreground"
                >
                  <option value="">—</option>
                  {['C','C#/Db','D','D#/Eb','E','F','F#/Gb','G','G#/Ab','A','A#/Bb','B'].map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </Field>
              <Field label="Tempo">
                <Select value={tempo} onChange={(e) => setTempo(e.target.value as typeof tempo)}>
                  <option value="">—</option>
                  <option value="slow">Slow</option>
                  <option value="medium">Medium</option>
                  <option value="fast">Fast</option>
                </Select>
              </Field>
            </div>
            <Field label="CCLI Number">
              <Input placeholder="e.g. 6016351" value={ccli} onChange={(e) => setCcli(e.target.value)} />
            </Field>
            <Field label="Copyright">
              <Input placeholder="e.g. © 2013 Hillsong Music" value={copyright} onChange={(e) => setCopyright(e.target.value)} />
            </Field>
          </div>
        </div>

        {/* Center: lyrics editor */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">

          {/* Editor toolbar */}
          <div className="px-5 pt-4 pb-2 border-b border-border shrink-0 flex flex-col gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground shrink-0">Insert</span>
              {TAG_BUTTONS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => insertTag(tag)}
                  className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary border border-border hover:border-primary/30 transition-colors"
                >
                  [{tag}]
                </button>
              ))}
              <div className="flex-1" />
              {slides.length > 0 && (
                <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                  {slides.length} {slides.length === 1 ? "slide" : "slides"}
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground/60">
              Start each section with a tag on its own line — e.g. <span className="font-mono text-muted-foreground">[Verse 1]</span>. Blank lines between sections create new slides.
            </p>
          </div>

          {/* Lyrics textarea — takes all remaining space */}
          <div className="flex-1 overflow-hidden">
            <Textarea
              className="w-full h-full border-0 rounded-none font-mono text-[14px] leading-[1.75] focus-visible:ring-0 shadow-none resize-none p-5 bg-transparent"
              placeholder={"[Verse 1]\nThe sun comes up it's a new day dawning\nIt's time to sing Your song again\n\n[Chorus]\nBless the Lord O my soul\nO my soul\nWorship His holy name"}
              value={lyricsText}
              onChange={(e) => setLyricsText(e.target.value)}
            />
          </div>
        </div>

        {/* Right: slide preview (always visible) */}
        <SlidePreviewPanel slides={slides} style={styleSettings} />

        {/* Far right: Presentation Style (collapsible) */}
        {showStyle && (
          <PresentationStylePanel settings={styleSettings} onSettingsChange={setStyleSettings} />
        )}
      </div>
    </div>
  )
}

// ── Slide Thumbnail (shared) ────────────────────────────────────────────

function SlideThumb({ lines, backgroundPath, small, style }: {
  lines: string[]
  backgroundPath?: string | null
  small?: boolean
  style?: Partial<ThemeSettings>
}) {
  const bg = backgroundPath ?? style?.backgroundPath
  const isColor = bg?.startsWith("color:")
  const isImage = bg && !isColor

  const textColor = style?.textColor ?? DEFAULT_SETTINGS.textColor
  const textAlign = style?.textAlign ?? DEFAULT_SETTINGS.textAlign
  const textPosition = style?.textPosition ?? DEFAULT_SETTINGS.textPosition
  const overlayOpacity = style?.overlayOpacity ?? DEFAULT_SETTINGS.overlayOpacity
  const textShadowOpacity = style?.textShadowOpacity ?? DEFAULT_SETTINGS.textShadowOpacity
  const fontFamily = style?.fontFamily ?? DEFAULT_SETTINGS.fontFamily

  const positionClass = textPosition === "top" ? "items-start" : textPosition === "bottom" ? "items-end" : "items-center"

  return (
    <div className="relative w-full border border-border rounded-lg overflow-hidden bg-black"
      style={{ paddingBottom: "56.25%" }}
    >
      {isImage && (
        <img
          src={`${toFileUrl(bg)}`}
          className="absolute inset-0 w-full h-full object-cover"
          alt=""
        />
      )}
      {isColor && (
        <div
          className="absolute inset-0"
          style={{ background: bg!.replace("color:", "") }}
        />
      )}
      <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${overlayOpacity / 100})` }} />
      <div className={`absolute inset-0 flex ${positionClass} justify-center p-2`}>
        <span className={`font-semibold leading-snug ${small ? "text-[8px]" : "text-[9px]"}`}
          style={{
            color: textColor,
            textAlign,
            textShadow: `0 1px 4px rgba(0,0,0,${textShadowOpacity / 100})`,
            fontFamily,
            display: "block",
            width: "100%",
          }}
        >
          {lines.map((line, li) => (
            <span key={li}>
              {line}
              {li < lines.length - 1 && <br />}
            </span>
          ))}
        </span>
      </div>
    </div>
  )
}

// ── Presentation Style Panel (right column in form screen) ──────────────

function PresentationStylePanel({ settings, onSettingsChange }: {
  settings: ThemeSettings
  onSettingsChange: (s: ThemeSettings) => void
}) {
  const update = <K extends keyof ThemeSettings>(key: K, value: ThemeSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value })
  }

  return (
    <div className="w-[388px] shrink-0 flex flex-col border-l border-border bg-card overflow-y-auto">
      <div className="p-5 flex flex-col gap-5">
        {/* Header */}
        <div>
          <h2 className="text-base font-semibold">Presentation Style</h2>
          <p className="text-[13px] text-muted-foreground mt-1">
            Choose projection background, text treatment, and font settings for this song.
          </p>
        </div>

        {/* Background picker */}
        <StyleCard title="Background">
          <BackgroundPickerPanel
            currentBackground={settings.backgroundPath}
            previewLabel=""
            onSelect={(bg) => update("backgroundPath", bg)}
          />
        </StyleCard>

        {/* Typography */}
        <StyleCard title="Typography">
          <Field label="Font Family">
            <Select value={settings.fontFamily} onChange={(e) => update("fontFamily", e.target.value)}>
              {FONT_OPTIONS.map((f) => (
                <option key={f} value={f}>{f.split(",")[0]}</option>
              ))}
            </Select>
          </Field>
          <Field label={`Font Size (${settings.fontSize}px)`}>
            <input
              type="range"
              min={24}
              max={96}
              step={2}
              value={settings.fontSize}
              onChange={(e) => update("fontSize", Number(e.target.value))}
              className="w-full accent-primary"
            />
          </Field>
          <Field label="Text Color">
            <div className="flex gap-2 flex-wrap">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c.hex}
                  title={c.label}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    settings.textColor === c.hex ? "border-primary scale-110" : "border-border"
                  }`}
                  style={{ background: c.hex }}
                  onClick={() => update("textColor", c.hex)}
                />
              ))}
            </div>
          </Field>
          <Field label="Text Align">
            <Select value={settings.textAlign} onChange={(e) => update("textAlign", e.target.value as ThemeSettings["textAlign"])}>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </Select>
          </Field>
          <Field label="Text Position">
            <Select value={settings.textPosition} onChange={(e) => update("textPosition", e.target.value as ThemeSettings["textPosition"])}>
              <option value="top">Top</option>
              <option value="middle">Middle</option>
              <option value="bottom">Bottom</option>
            </Select>
          </Field>
        </StyleCard>

        {/* Text Effects */}
        <StyleCard title="Text Effects">
          <Field label={`Overlay Opacity (${settings.overlayOpacity}%)`}>
            <input
              type="range"
              min={0}
              max={100}
              value={settings.overlayOpacity}
              onChange={(e) => update("overlayOpacity", Number(e.target.value))}
              className="w-full accent-primary"
            />
          </Field>
          <Field label={`Text Shadow (${settings.textShadowOpacity}%)`}>
            <input
              type="range"
              min={0}
              max={100}
              value={settings.textShadowOpacity}
              onChange={(e) => update("textShadowOpacity", Number(e.target.value))}
              className="w-full accent-primary"
            />
          </Field>
          <Field label="Max Lines Per Slide">
            <Select value={String(settings.maxLinesPerSlide)} onChange={(e) => update("maxLinesPerSlide", Number(e.target.value))}>
              <option value="2">2 lines</option>
              <option value="3">3 lines</option>
              <option value="4">4 lines</option>
              <option value="6">6 lines</option>
            </Select>
          </Field>
        </StyleCard>
      </div>
    </div>
  )
}

function StyleCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-input p-3.5 flex flex-col gap-3">
      <span className="text-[13px] font-medium">{title}</span>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[13px] font-medium text-foreground">{label}</label>
      {children}
    </div>
  )
}
