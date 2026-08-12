import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Search, Music2, Timer, Upload, Trash2, Check, Image as ImageIcon, Play, Volume2, Video, Calendar, BookOpen, Megaphone, Loader2, ChevronUp, ChevronDown, X } from "lucide-react"
import { FREE_TRANSLATIONS, type BibleTranslation, type BibleApiResult, fetchBiblePassage } from "../lib/bibleApi"
import { toFileUrl } from "../lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import TranslationPicker from "./TranslationPicker"

interface SongRow {
  id: number
  title: string
  artist: string
  key: string | null
  ccliNumber: string | null
}

interface SongDetail extends SongRow {
  sections: { id: number; type: string; label: string; lyrics: string; orderIndex: number }[]
}

const SECTION_COLORS: Record<string, string> = {
  verse: "text-blue-600",
  chorus: "text-green-600",
  bridge: "text-amber-600",
  "pre-chorus": "text-violet-600",
  intro: "text-slate-500",
  outro: "text-slate-500",
  tag: "text-red-500",
  interlude: "text-slate-500",
}

interface Props {
  onClose: () => void
  onAdd: (songIds: number[]) => void
  onAddCountdown?: () => void
  onAddBibleBrowser?: () => void
  onAddMedia?: (path: string) => void
  onAddMediaCollection?: (paths: string[]) => void
  onAddMusicPlayer?: () => void
  onAddAnnouncement?: (title: string, content: string) => void
  excludeIds?: number[]
  availableTranslations?: BibleTranslation[]
  defaultTranslation?: string
  recentScriptures?: { query: string; translationId: string; translationLabel: string; reference: string }[]
  onAddScriptureByRef?: (query: string, translationId: string) => Promise<void>
  onTranslationChange?: (id: string) => void
  initialTab?: "songs" | "scriptures" | "media" | "presentations" | "widgets"
}

// ── Book name autocomplete ────────────────────────────────────────────────────

const BIBLE_BOOKS = [
  "Genesis","Exodus","Leviticus","Numbers","Deuteronomy",
  "Joshua","Judges","Ruth","1 Samuel","2 Samuel",
  "1 Kings","2 Kings","1 Chronicles","2 Chronicles",
  "Ezra","Nehemiah","Esther","Job","Psalms","Proverbs",
  "Ecclesiastes","Song of Solomon","Isaiah","Jeremiah",
  "Lamentations","Ezekiel","Daniel","Hosea","Joel","Amos",
  "Obadiah","Jonah","Micah","Nahum","Habakkuk","Zephaniah",
  "Haggai","Zechariah","Malachi",
  "Matthew","Mark","Luke","John","Acts","Romans",
  "1 Corinthians","2 Corinthians","Galatians","Ephesians",
  "Philippians","Colossians","1 Thessalonians","2 Thessalonians",
  "1 Timothy","2 Timothy","Titus","Philemon","Hebrews",
  "James","1 Peter","2 Peter","1 John","2 John","3 John",
  "Jude","Revelation",
]

function getBookSuggestions(query: string): string[] {
  if (!query) return []
  // Once the user has typed a full "Book Chapter" pattern, hide suggestions
  const qt = query.trim().toLowerCase()
  for (const book of BIBLE_BOOKS) {
    if (qt.startsWith(book.toLowerCase())) {
      const after = query.trim().slice(book.length)
      if (/^\s+\d/.test(after)) return []
    }
  }
  // Use the raw (untrimmed) query so that "Ezekiel " (trailing space) returns []
  // — no book name starts with "Ezekiel " — hiding the dropdown naturally after selection.
  return BIBLE_BOOKS.filter(b => b.toLowerCase().startsWith(query.toLowerCase())).slice(0, 6)
}

export default function LibraryModal({ onClose, onAdd, onAddCountdown, onAddBibleBrowser, onAddMedia, onAddMediaCollection, onAddMusicPlayer, onAddAnnouncement, excludeIds = [], availableTranslations, defaultTranslation, recentScriptures, onAddScriptureByRef, onTranslationChange, initialTab }: Props) {
  const [tab, setTab] = useState<string>(initialTab ?? "songs")
  const [songs, setSongs] = useState<SongRow[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [previewId, setPreviewId] = useState<number | null>(null)
  const [detail, setDetail] = useState<SongDetail | null>(null)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const [bookHighlight, setBookHighlight] = useState(-1)
  const [hideSuggestions, setHideSuggestions] = useState(false)

  const bookSuggestions = useMemo(
    () => tab === "scriptures" && !hideSuggestions ? getBookSuggestions(search) : [],
    [tab, search, hideSuggestions],
  )
  // Reset highlight whenever the suggestion list changes
  useEffect(() => setBookHighlight(-1), [bookSuggestions])

  // ── Scripture lookup state (lifted here so top search bar drives it) ──────
  const [scriptureTranslation, setScriptureTranslation] = useState(defaultTranslation ?? "web")
  const [scriptureLoading, setScriptureLoading] = useState(false)
  const [scriptureError, setScriptureError] = useState<string | null>(null)
  const [bibleApiKey, setBibleApiKey] = useState<string | null>(null)
  const [previewResult, setPreviewResult] = useState<BibleApiResult | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  // Fetch API key once on mount
  useEffect(() => {
    window.worshipsync.appState.getBibleApiKey().then((k: string | null) => setBibleApiKey(k)).catch(() => {})
  }, [])

  // Debounced scripture preview
  useEffect(() => {
    if (tab !== "scriptures") return
    if (!search.trim()) { setPreviewResult(null); setPreviewError(null); return }
    setPreviewLoading(true)
    setPreviewError(null)
    const timer = setTimeout(async () => {
      try {
        const result = await fetchBiblePassage(search.trim(), scriptureTranslation, bibleApiKey)
        setPreviewResult(result)
        setPreviewError(null)
      } catch (err) {
        setPreviewResult(null)
        setPreviewError(err instanceof Error ? err.message : "Not found")
      } finally {
        setPreviewLoading(false)
      }
    }, 700)
    return () => { clearTimeout(timer); setPreviewLoading(false) }
  }, [search, scriptureTranslation, tab, bibleApiKey])

  const submitScriptureByRef = useCallback(async () => {
    if (!search.trim() || !onAddScriptureByRef || scriptureLoading) return
    setScriptureLoading(true)
    setScriptureError(null)
    try {
      await onAddScriptureByRef(search.trim(), scriptureTranslation)
      onClose()
    } catch (err) {
      setScriptureError(err instanceof Error ? err.message : "Not found")
      setScriptureLoading(false)
    }
  }, [search, scriptureTranslation, onAddScriptureByRef, scriptureLoading, onClose])

  // Initial load
  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const all = await window.worshipsync.songs.getAll()
      setSongs((all as SongRow[]).filter((s) => !excludeIds.includes(s.id) && s.artist !== "Scripture" && s.artist !== "Media"))
      setLoading(false)
    })()
  }, [])

  // Debounced search — only for songs tab
  useEffect(() => {
    if (tab === "scriptures") return
    const timer = setTimeout(async () => {
      setLoading(true)
      const result = search.trim()
        ? await window.worshipsync.songs.search(search)
        : await window.worshipsync.songs.getAll()
      setSongs((result as SongRow[]).filter((s) => !excludeIds.includes(s.id) && s.artist !== "Scripture" && s.artist !== "Media"))
      setLoading(false)
    }, 150)
    return () => clearTimeout(timer)
  }, [search, tab])

  // Load detail on preview change
  useEffect(() => {
    if (!previewId) { setDetail(null); return }
    window.worshipsync.songs.getById(previewId).then((s) => setDetail(s as SongDetail))
  }, [previewId])

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleAdd = () => {
    if (selectedIds.length === 0) return
    onAdd(selectedIds)
    onClose()
  }

  // ── Media state ──────────────────────────────────────────────────────────
  const [mediaImages, setMediaImages] = useState<{ path: string; filename: string; usageCount: number }[]>([])
  const [mediaLoading, setMediaLoading] = useState(false)
  const [mediaSelectedPaths, setMediaSelectedPaths] = useState<Set<string>>(new Set())
  const [mediaUploading, setMediaUploading] = useState(false)
  const [mediaUploadProgress, setMediaUploadProgress] = useState<{ done: number; total: number } | null>(null)
  const [mediaUsingSongs,    setMediaUsingSongs]    = useState<{ id: number; title: string; artist: string }[]>([])
  const [mediaUsingServices, setMediaUsingServices] = useState<{ id: number; date: string; label: string }[]>([])
  const [mediaTypeFilter, setMediaTypeFilter] = useState<"all" | "image" | "video" | "audio">("all")

  const loadMediaImages = useCallback(async () => {
    setMediaLoading(true)
    try {
      const paths: string[] = await window.worshipsync.backgrounds.listImages()
      const items = await Promise.all(
        paths.map(async (p) => ({
          path: p,
          filename: p.split("/").pop() ?? p,
          usageCount: await window.worshipsync.backgrounds.getUsageCount(p),
        }))
      )
      setMediaImages(items)
    } catch { setMediaImages([]) }
    setMediaLoading(false)
  }, [])

  useEffect(() => { if (tab === "media") loadMediaImages() }, [tab, loadMediaImages])

  // Load detail info only when exactly one item is selected
  const singleMediaSelected = mediaSelectedPaths.size === 1 ? [...mediaSelectedPaths][0] : null

  useEffect(() => {
    if (!singleMediaSelected) { setMediaUsingSongs([]); setMediaUsingServices([]); return }
    const isMediaFile = /\.(mp4|webm|mov|mp3|wav|ogg|m4a|aac|flac)$/i.test(singleMediaSelected)
    window.worshipsync.backgrounds.getUsingSongs(singleMediaSelected).then(setMediaUsingSongs).catch(() => setMediaUsingSongs([]))
    if (isMediaFile) {
      window.worshipsync.backgrounds.getUsingServices(singleMediaSelected).then(setMediaUsingServices).catch(() => setMediaUsingServices([]))
    } else {
      setMediaUsingServices([])
    }
  }, [singleMediaSelected])

  const mediaCounts = useMemo(() => {
    const counts = { all: mediaImages.length, image: 0, video: 0, audio: 0 }
    for (const i of mediaImages) {
      if (/\.(mp4|webm|mov)$/i.test(i.path)) counts.video++
      else if (/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(i.path)) counts.audio++
      else counts.image++
    }
    return counts
  }, [mediaImages])

  const filteredMedia = useMemo(() => {
    let items = mediaImages
    if (mediaTypeFilter === "video") items = items.filter((i) => /\.(mp4|webm|mov)$/i.test(i.path))
    else if (mediaTypeFilter === "audio") items = items.filter((i) => /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(i.path))
    else if (mediaTypeFilter === "image") items = items.filter((i) => !/\.(mp4|webm|mov|mp3|wav|ogg|m4a|aac|flac)$/i.test(i.path))
    if (!search.trim()) return items
    const q = search.toLowerCase()
    return items.filter((i) => i.filename.toLowerCase().includes(q))
  }, [mediaImages, search, mediaTypeFilter])

  const toggleMediaSelect = useCallback((path: string) => {
    setMediaSelectedPaths(prev => {
      const next = new Set(prev)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })
  }, [])

  // Sets preserve insertion order, so this reorders by rebuilding the Set —
  // that order becomes the collection's playback order.
  const moveSelected = useCallback((path: string, dir: -1 | 1) => {
    setMediaSelectedPaths(prev => {
      const arr = Array.from(prev)
      const i = arr.indexOf(path)
      const next = i + dir
      if (i < 0 || next < 0 || next >= arr.length) return prev
      ;[arr[i], arr[next]] = [arr[next], arr[i]]
      return new Set(arr)
    })
  }, [])

  const handleMediaUpload = async () => {
    setMediaUploading(true)
    try {
      const paths = await window.worshipsync.backgrounds.pickImages()
      if (paths.length > 0) {
        setMediaUploadProgress({ done: 0, total: paths.length })
        await loadMediaImages()
        setMediaUploadProgress(null)
        setMediaSelectedPaths(new Set(paths))
      }
    } finally {
      setMediaUploading(false)
      setMediaUploadProgress(null)
    }
  }

  const handleMediaDelete = async (item: { path: string; usageCount: number }) => {
    const msg = item.usageCount > 0
      ? `This file is used by ${item.usageCount} song${item.usageCount > 1 ? "s" : ""}. Deleting will remove it from those songs too. Continue?`
      : "Delete this file from the library?"
    if (!confirm(msg)) return
    await window.worshipsync.backgrounds.deleteImage(item.path)
    setMediaSelectedPaths(prev => { const next = new Set(prev); next.delete(item.path); return next })
    await loadMediaImages()
  }

  const selectionLabel =
    selectedIds.length === 0
      ? "No items selected"
      : selectedIds.length === 1
        ? "1 item selected"
        : `${selectedIds.length} items selected`

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        hideClose
        className="p-0 gap-0 overflow-hidden rounded-xl border border-border shadow-xl"
        style={{ width: 1100, maxWidth: "95vw", height: 640, maxHeight: "92vh" }}
      >
        <div className="flex flex-col h-full bg-background text-foreground">

          {/* ── Header ─────────────────────────────────────────────── */}
          <DialogHeader className="flex flex-row items-center px-5 pt-4 pb-3 border-b border-border shrink-0">
            <DialogTitle className="flex-1 text-base font-semibold">Library</DialogTitle>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={onClose}>
              ✕
            </Button>
          </DialogHeader>

          {/* ── Search ─────────────────────────────────────────────── */}
          <div className="px-5 py-3 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchRef}
                autoFocus
                className="pl-9"
                placeholder={
                  tab === "scriptures"
                    ? "Type a reference… e.g. John 3:16, Psalm 23, Romans 8:28-39"
                    : tab === "media"
                      ? "Search files by filename..."
                      : "Search songs, scriptures, media..."
                }
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setScriptureError(null)
                  setHideSuggestions(false)
                }}
                onKeyDown={(e) => {
                  if (bookSuggestions.length > 0) {
                    if (e.key === "ArrowDown") {
                      e.preventDefault()
                      setBookHighlight(h => Math.min(h + 1, bookSuggestions.length - 1))
                      return
                    }
                    if (e.key === "ArrowUp") {
                      e.preventDefault()
                      setBookHighlight(h => Math.max(h - 1, 0))
                      return
                    }
                    if (e.key === "Escape") {
                      e.preventDefault()
                      setHideSuggestions(true)
                      return
                    }
                    if (e.key === "Tab" || (e.key === "Enter" && bookHighlight >= 0)) {
                      e.preventDefault()
                      const chosen = bookSuggestions[bookHighlight >= 0 ? bookHighlight : 0]
                      setSearch(chosen + " ")
                      setHideSuggestions(true)
                      setScriptureError(null)
                      return
                    }
                  }
                  if (e.key === "Enter" && tab === "scriptures") {
                    e.preventDefault()
                    submitScriptureByRef()
                  }
                }}
              />

              {/* Book name autocomplete dropdown */}
              {bookSuggestions.length > 0 && (
                <ul className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                  {bookSuggestions.map((book, i) => (
                    <li key={book}>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          setSearch(book + " ")
                          setHideSuggestions(true)
                          setScriptureError(null)
                          searchRef.current?.focus()
                        }}
                        onMouseEnter={() => setBookHighlight(i)}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                          i === bookHighlight
                            ? "bg-primary/10 text-primary"
                            : "text-foreground hover:bg-accent"
                        }`}
                      >
                        {book}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* ── Tabs ───────────────────────────────────────────────── */}
          <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 min-h-0">
            <div className="px-5 border-b border-border shrink-0">
              <TabsList className="h-auto bg-transparent p-0 gap-0 rounded-none">
                {["songs", "scriptures", "media", "presentations", "widgets"].map((t) => (
                  <TabsTrigger
                    key={t}
                    value={t}
                    className="rounded-none border-b-2 border-transparent px-4 py-2 text-xs font-medium text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none capitalize"
                  >
                    {t}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* Tab content — plain div so flex height works reliably */}
            <div className="flex-1 min-h-0 overflow-hidden flex">
              {tab === "songs" ? (
                <>
                  {/* Song list */}
                  <div className="w-72 shrink-0 border-r border-border flex flex-col min-h-0">
                    <div className="flex-1 overflow-y-auto" style={{ scrollbarGutter: "stable" }}>
                      <div className="p-2">
                        {loading ? (
                          <p className="py-8 text-center text-xs text-muted-foreground">Loading...</p>
                        ) : songs.length === 0 ? (
                          <p className="py-8 text-center text-xs text-muted-foreground">
                            {search ? "No matches" : "No songs in library"}
                          </p>
                        ) : (
                          songs.map((song) => {
                            const isChecked = selectedIds.includes(song.id)
                            const isPreviewed = previewId === song.id
                            return (
                              <div
                                key={song.id}
                                onClick={() => setPreviewId(song.id)}
                                className={`
                                  flex items-center gap-3 px-3 py-2 rounded-lg mb-0.5 cursor-pointer transition-colors select-none
                                  ${isChecked
                                    ? "bg-primary/10 border border-primary/20"
                                    : isPreviewed
                                      ? "bg-accent"
                                      : "hover:bg-accent border border-transparent"
                                  }
                                `}
                              >
                                <div className={`h-8 w-8 shrink-0 rounded-md flex items-center justify-center ${isChecked ? "bg-primary/15" : "bg-muted"}`}>
                                  <Music2 className={`h-4 w-4 ${isChecked ? "text-primary" : "text-muted-foreground"}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-medium truncate ${isChecked ? "text-primary" : "text-foreground"}`}>
                                    {song.title}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                    {song.artist || "Unknown"}
                                    {song.key && ` · Key: ${song.key}`}
                                  </p>
                                </div>
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={() => toggleSelect(song.id)}
                                  onClick={(e) => { e.stopPropagation(); setPreviewId(song.id) }}
                                  className="shrink-0"
                                />
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Song detail */}
                  <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-card">
                    {!detail ? (
                      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground bg-card">
                        Select a song to preview
                      </div>
                    ) : (
                      <ScrollArea className="flex-1">
                        <div className="p-6">
                          <h2 className="text-2xl font-bold text-foreground leading-snug mb-1">
                            {detail.title}
                          </h2>
                          <p className="text-sm text-muted-foreground mb-6">
                            {detail.artist || "Unknown artist"}
                            {detail.ccliNumber && ` · CCLI: ${detail.ccliNumber}`}
                            {detail.key && ` · Key: ${detail.key}`}
                          </p>

                          {detail.sections.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No sections added yet</p>
                          ) : (
                            <div className="space-y-5">
                              {detail.sections.map((sec) => (
                                <div key={sec.id}>
                                  <p className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${SECTION_COLORS[sec.type] ?? "text-muted-foreground"}`}>
                                    {sec.label}
                                  </p>
                                  <p className="text-sm leading-loose text-secondary-foreground whitespace-pre-wrap">
                                    {sec.lyrics || <span className="italic text-muted-foreground">empty</span>}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                </>
              ) : tab === "widgets" ? (
                <WidgetsTab
                  onAddCountdown={() => { onAddCountdown?.(); onClose() }}
                  onAddBibleBrowser={() => { onAddBibleBrowser?.(); onClose() }}
                  onAddMusicPlayer={onAddMusicPlayer ? () => { onAddMusicPlayer(); onClose() } : undefined}
                  onAddAnnouncement={(title, content) => { onAddAnnouncement?.(title, content); onClose() }}
                />
              ) : tab === "scriptures" ? (
                <ScriptureTab
                  translation={scriptureTranslation}
                  availableTranslations={availableTranslations}
                  recentScriptures={recentScriptures}
                  onSetSearch={(val) => { setSearch(val); setScriptureError(null) }}
                  onTranslationChange={(id) => {
                    setScriptureTranslation(id)
                    onTranslationChange?.(id)
                  }}
                  previewResult={previewResult}
                  previewLoading={previewLoading}
                  previewError={previewError}
                />
              ) : tab === "media" ? (
                <div className="flex-1 flex min-h-0 overflow-hidden">
                  {/* Media grid */}
                  <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-border flex items-center justify-between shrink-0 gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs text-muted-foreground shrink-0">
                          {filteredMedia.length} {filteredMedia.length === 1 ? "file" : "files"}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {([
                            { key: "all" as const,   label: "All",    icon: null },
                            { key: "image" as const, label: "Images", icon: ImageIcon },
                            { key: "video" as const, label: "Video",  icon: Video },
                            { key: "audio" as const, label: "Audio",  icon: Volume2 },
                          ]).map(({ key, label, icon: Icon }) => (
                            <button
                              key={key}
                              onClick={() => setMediaTypeFilter(key)}
                              disabled={key !== "all" && mediaCounts[key] === 0}
                              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                                mediaTypeFilter === key
                                  ? "bg-primary/10 text-primary"
                                  : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                              }`}
                            >
                              {Icon && <Icon className="h-3 w-3" />}
                              {label}
                              <span className="tabular-nums opacity-60">{mediaCounts[key]}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs shrink-0" onClick={handleMediaUpload} disabled={mediaUploading}>
                        <Upload className="h-3 w-3" />
                        {mediaUploadProgress
                          ? `${mediaUploadProgress.done} / ${mediaUploadProgress.total}`
                          : mediaUploading ? "Uploading…" : "Upload"}
                      </Button>
                    </div>
                    <ScrollArea className="flex-1">
                      {mediaLoading ? (
                        <p className="py-12 text-center text-xs text-muted-foreground">Loading...</p>
                      ) : filteredMedia.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                          <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
                          <p className="text-sm text-muted-foreground">
                            {search
                              ? "No files match your search"
                              : mediaTypeFilter !== "all" ? `No ${mediaTypeFilter} files` : "No media uploaded yet"}
                          </p>
                          {!search && mediaTypeFilter === "all" && (
                            <Button size="sm" className="gap-1.5" onClick={handleMediaUpload}>
                              <Upload className="h-3.5 w-3.5" /> Upload Image
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="p-4 grid grid-cols-3 gap-3">
                          {filteredMedia.map((item) => {
                            const isSel = mediaSelectedPaths.has(item.path)
                            const isVideo = /\.(mp4|webm|mov)$/i.test(item.path)
                            const isAudio = /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(item.path)
                            return (
                              <button
                                key={item.path}
                                onClick={() => toggleMediaSelect(item.path)}
                                className={`group relative rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                                  isSel ? "border-primary ring-2 ring-primary/25" : "border-border hover:border-muted-foreground/40"
                                }`}
                                style={{ aspectRatio: "16/9" }}
                              >
                                {isAudio ? (
                                  <div className="absolute inset-0 bg-muted flex flex-col items-center justify-center gap-1">
                                    <Volume2 className="h-6 w-6 text-muted-foreground" />
                                    <span className="text-[9px] text-muted-foreground uppercase font-semibold">
                                      {item.path.split(".").pop()?.toUpperCase()}
                                    </span>
                                  </div>
                                ) : isVideo ? (
                                  <video
                                    src={`${toFileUrl(item.path)}`}
                                    className="absolute inset-0 w-full h-full object-cover"
                                    muted
                                    preload="none"
                                  />
                                ) : (
                                  <div
                                    className="absolute inset-0 bg-cover bg-center"
                                    style={{ backgroundImage: `url("${toFileUrl(item.path)}")` }}
                                  />
                                )}
                                <div className={`absolute inset-0 transition-colors ${isSel ? "bg-black/10" : "bg-black/0 group-hover:bg-black/20"}`} />
                                {(isVideo || isAudio) && (
                                  <div className="absolute bottom-1.5 right-1.5 h-5 w-5 rounded-full bg-black/60 flex items-center justify-center">
                                    {isAudio
                                      ? <Volume2 className="h-2.5 w-2.5 text-white" />
                                      : <Play className="h-2.5 w-2.5 text-white fill-white" />
                                    }
                                  </div>
                                )}
                                {/* Checkbox */}
                                <div className={`absolute top-1.5 right-1.5 h-5 w-5 rounded-full flex items-center justify-center border-2 transition-all ${
                                  isSel
                                    ? "bg-primary border-primary opacity-100"
                                    : "bg-black/40 border-white/60 opacity-0 group-hover:opacity-100"
                                }`}>
                                  {isSel && <Check className="h-3 w-3 text-primary-foreground" />}
                                </div>
                                {item.usageCount > 0 && (
                                  <div className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded">
                                    {item.usageCount} {item.usageCount === 1 ? "song" : "songs"}
                                  </div>
                                )}
                                {/* Filename — always visible so the operator can tell files apart without hovering/clicking each one first */}
                                <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-gradient-to-t from-black/85 via-black/40 to-transparent">
                                  <p className="text-[10px] leading-tight text-white line-clamp-2" title={item.filename}>{item.filename}</p>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </ScrollArea>
                  </div>

                  {/* Multi-selection sidebar — order here becomes collection playback order */}
                  {mediaSelectedPaths.size > 1 && (
                    <div className="w-56 shrink-0 border-l border-border flex flex-col min-h-0 overflow-hidden">
                      <div className="px-3 py-2.5 border-b border-border shrink-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Selected ({mediaSelectedPaths.size})
                        </span>
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5 leading-relaxed">
                          This order becomes the playback order if you import as a collection.
                        </p>
                      </div>
                      <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {Array.from(mediaSelectedPaths).map((path, i) => {
                          const filename = path.split("/").pop() ?? path
                          const isVideo = /\.(mp4|webm|mov)$/i.test(path)
                          return (
                            <div key={path} className="flex items-center gap-1.5 bg-muted/40 border border-border rounded-md px-2 py-1.5">
                              <span className="text-[10px] text-muted-foreground/50 tabular-nums w-4 text-right shrink-0">{i + 1}</span>
                              {isVideo ? <Play className="h-3 w-3 text-muted-foreground shrink-0" /> : <ImageIcon className="h-3 w-3 text-muted-foreground shrink-0" />}
                              <span className="flex-1 min-w-0 truncate text-[11px] text-foreground" title={filename}>{filename}</span>
                              <div className="flex items-center gap-0.5 shrink-0">
                                <button onClick={() => moveSelected(path, -1)} disabled={i === 0} title="Move up" className="p-0.5 text-muted-foreground/50 hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
                                  <ChevronUp className="h-3 w-3" />
                                </button>
                                <button onClick={() => moveSelected(path, 1)} disabled={i === mediaSelectedPaths.size - 1} title="Move down" className="p-0.5 text-muted-foreground/50 hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
                                  <ChevronDown className="h-3 w-3" />
                                </button>
                                <button onClick={() => toggleMediaSelect(path)} title="Remove from selection" className="p-0.5 text-muted-foreground/50 hover:text-destructive transition-colors">
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Detail sidebar — only for single selection */}
                  {singleMediaSelected && (() => {
                    const item = mediaImages.find((i) => i.path === singleMediaSelected)
                    if (!item) return null
                    return (
                      <div className="w-56 shrink-0 border-l border-border flex flex-col min-h-0 overflow-hidden">
                        <div className="p-3 border-b border-border shrink-0">
                          <div className="rounded-lg overflow-hidden border border-border" style={{ aspectRatio: "16/9" }}>
                            {/\.(mp4|webm|mov)$/i.test(item.path) ? (
                              <video src={`${toFileUrl(item.path)}`} className="w-full h-full object-cover" muted autoPlay loop playsInline />
                            ) : /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(item.path) ? (
                              <div className="w-full h-full bg-muted flex flex-col items-center justify-center gap-2">
                                <Volume2 className="h-8 w-8 text-muted-foreground" />
                                <span className="text-[10px] text-muted-foreground font-semibold uppercase">
                                  {item.path.split(".").pop()?.toUpperCase()}
                                </span>
                              </div>
                            ) : (
                              <img src={`${toFileUrl(item.path)}`} className="w-full h-full object-cover" alt="" />
                            )}
                          </div>
                        </div>
                        <div className="p-3 flex flex-col gap-2 flex-1 overflow-y-auto text-xs">
                          <div>
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Filename</span>
                            <p className="text-foreground truncate mt-0.5">{item.filename}</p>
                          </div>
                          {/\.(mp4|webm|mov|mp3|wav|ogg|m4a|aac|flac)$/i.test(item.path) ? (
                            <div>
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                Services ({mediaUsingServices.length})
                              </span>
                              {mediaUsingServices.length > 0 ? (
                                <div className="flex flex-col gap-1 mt-1">
                                  {mediaUsingServices.map((svc) => (
                                    <div key={svc.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-muted">
                                      <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                                      <div className="min-w-0">
                                        <p className="text-[11px] truncate font-medium">{svc.label}</p>
                                        <p className="text-[10px] text-muted-foreground">
                                          {new Date(svc.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-muted-foreground mt-0.5">Not in any service</p>
                              )}
                            </div>
                          ) : (
                            <div>
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Used by</span>
                              <p className="text-foreground mt-0.5">
                                {item.usageCount > 0 ? `${item.usageCount} ${item.usageCount === 1 ? "song" : "songs"}` : "Not used"}
                              </p>
                              {mediaUsingSongs.filter(s => s.artist !== 'Scripture' && s.artist !== 'Media').length > 0 && (
                                <div className="flex flex-col gap-1 mt-1">
                                  {mediaUsingSongs.filter(s => s.artist !== 'Scripture' && s.artist !== 'Media').map((s) => (
                                    <div key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-muted">
                                      <Music2 className="h-3 w-3 text-muted-foreground shrink-0" />
                                      <span className="text-[11px] truncate">{s.title}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          <div className="mt-auto pt-2">
                            <Button
                              variant="destructive"
                              size="sm"
                              className="gap-1.5 w-full h-7 text-xs"
                              onClick={() => handleMediaDelete(item)}
                            >
                              <Trash2 className="h-3 w-3" /> Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <p className="text-sm">Presentations coming soon</p>
                </div>
              )}
            </div>
          </Tabs>

          {/* ── Footer ─────────────────────────────────────────────── */}
          <div className="flex items-center gap-3 px-5 py-3 border-t border-border bg-muted/40 shrink-0">
            {tab === "scriptures" ? (
              <>
                <div className="flex-1 min-w-0">
                  {scriptureError
                    ? <p className="text-xs text-red-400 truncate">{scriptureError}</p>
                    : <p className="text-xs text-muted-foreground">Type a reference above and press Enter</p>
                  }
                </div>
                <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
                <Button
                  size="sm"
                  disabled={!search.trim() || scriptureLoading || !onAddScriptureByRef}
                  onClick={submitScriptureByRef}
                  className="gap-1.5"
                >
                  {scriptureLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                  + Add to Lineup
                </Button>
              </>
            ) : tab === "media" ? (() => {
              // Audio isn't supported inside a collection (collection items only
              // know how to render "video" or "image") — filter it out so an
              // accidental audio pick doesn't silently break as a broken thumbnail.
              const collectionPaths = Array.from(mediaSelectedPaths).filter(p => !/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(p))
              const audioExcludedCount = mediaSelectedPaths.size - collectionPaths.length
              return (
              <>
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-muted-foreground block">
                    {mediaSelectedPaths.size > 0
                      ? `${mediaSelectedPaths.size} ${mediaSelectedPaths.size === 1 ? "file" : "files"} selected`
                      : "No files selected"}
                  </span>
                  {mediaSelectedPaths.size > 1 && (
                    <span className="text-[10px] text-muted-foreground/60">
                      Collection = one auto-advancing slideshow item. Separate = {mediaSelectedPaths.size} individual lineup items.
                      {audioExcludedCount > 0 && ` Audio can't join a collection — ${audioExcludedCount} will be left out.`}
                    </span>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
                {mediaSelectedPaths.size > 1 && onAddMediaCollection ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        for (const path of mediaSelectedPaths) {
                          onAddMedia?.(path)
                        }
                        onClose()
                      }}
                      title="Add each file as its own separate lineup item"
                    >
                      Add as {mediaSelectedPaths.size} Separate Items
                    </Button>
                    <Button
                      size="sm"
                      disabled={collectionPaths.length < 2}
                      onClick={() => {
                        onAddMediaCollection(collectionPaths)
                        onClose()
                      }}
                      title={collectionPaths.length < 2 ? "Select at least 2 non-audio files to make a collection" : "Add all selected non-audio files as one auto-advancing lineup item, in the order shown"}
                    >
                      + Add as Collection ({collectionPaths.length})
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    disabled={mediaSelectedPaths.size === 0}
                    onClick={() => {
                      for (const path of mediaSelectedPaths) {
                        onAddMedia?.(path)
                      }
                      onClose()
                    }}
                  >
                    + Add to Lineup
                  </Button>
                )}
              </>
              )
            })() : (
              <>
                <span className="flex-1 text-xs text-muted-foreground">{selectionLabel}</span>
                <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
                <Button size="sm" disabled={selectedIds.length === 0} onClick={handleAdd}>
                  + Add to Lineup
                </Button>
              </>
            )}
          </div>

        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── ScriptureTab ─────────────────────────────────────────────────────────────

function ScriptureTab({ translation, availableTranslations, recentScriptures, onSetSearch, onTranslationChange, previewResult, previewLoading, previewError }: {
  translation: string
  availableTranslations?: BibleTranslation[]
  recentScriptures?: { query: string; translationId: string; translationLabel: string; reference: string }[]
  onSetSearch: (val: string) => void
  onTranslationChange?: (id: string) => void
  previewResult: BibleApiResult | null
  previewLoading: boolean
  previewError: string | null
}) {
  return (
    <div className="flex-1 flex min-h-0 overflow-hidden">
      {/* Left: options panel */}
      <div className="w-64 shrink-0 border-r border-border flex flex-col min-h-0 overflow-y-auto">

        {/* Translation picker */}
        <div className="p-4 border-b border-border shrink-0 flex flex-col gap-2">
          <span className="text-xs font-semibold">Translation</span>
          <TranslationPicker
            translations={availableTranslations ?? FREE_TRANSLATIONS}
            value={translation}
            onChange={id => onTranslationChange?.(id)}
          />
        </div>

        {/* Recent scriptures */}
        {recentScriptures && recentScriptures.length > 0 && (
          <div className="p-4 shrink-0 flex flex-col gap-1.5">
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50">Recent</span>
            {recentScriptures.map(r => (
              <button
                key={r.query + r.translationId}
                onClick={() => { onSetSearch(r.query); onTranslationChange?.(r.translationId) }}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-accent/50 transition-colors"
              >
                <p className="text-[11px] font-medium truncate">{r.reference}</p>
                <p className="text-[10px] text-muted-foreground">{r.translationLabel}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right: preview panel */}
      <div className="flex-1 flex flex-col min-h-0 bg-card">
        {previewLoading ? (
          <div className="flex-1 flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Looking up passage…</span>
          </div>
        ) : previewError ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <BookOpen className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Passage not found</p>
              <p className="text-xs text-muted-foreground/60 mt-1">{previewError}</p>
            </div>
          </div>
        ) : previewResult ? (
          <ScrollArea className="flex-1">
            <div className="p-6">
              <div className="flex items-start justify-between gap-3 mb-4">
                <h2 className="text-lg font-bold leading-snug">{previewResult.reference}</h2>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded shrink-0 mt-0.5">
                  {previewResult.translation_id.toUpperCase()}
                </span>
              </div>
              <div className="space-y-2">
                {previewResult.verses.map(v => (
                  <p key={v.verse} className="text-sm leading-relaxed text-secondary-foreground">
                    <span className="text-[10px] font-bold text-muted-foreground/60 mr-1.5 align-top leading-5">{v.verse}</span>
                    {v.text}
                  </p>
                ))}
              </div>
            </div>
          </ScrollArea>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <BookOpen className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Type a reference in the search bar above</p>
              <p className="text-xs text-muted-foreground/60 mt-1">e.g. John 3:16 · Psalm 23 · Romans 8:28-39</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── WidgetsTab ────────────────────────────────────────────────────────────────

function WidgetsTab({ onAddCountdown, onAddBibleBrowser, onAddMusicPlayer, onAddAnnouncement }: {
  onAddCountdown: () => void
  onAddBibleBrowser: () => void
  onAddMusicPlayer?: () => void
  onAddAnnouncement: (title: string, content: string) => void
}) {
  const [annTitle,   setAnnTitle]   = useState("")
  const [annContent, setAnnContent] = useState("")

  return (
    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
      {/* Countdown */}
      <button
        onClick={onAddCountdown}
        className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-accent hover:border-primary/30 transition-colors text-left group"
      >
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors shrink-0">
          <Timer className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium">Countdown Timer</p>
          <p className="text-xs text-muted-foreground mt-0.5">Count down to service start time</p>
        </div>
      </button>

      {/* Bible Browser */}
      <button
        onClick={onAddBibleBrowser}
        className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-accent hover:border-primary/30 transition-colors text-left group"
      >
        <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors shrink-0">
          <BookOpen className="h-5 w-5 text-blue-500" />
        </div>
        <div>
          <p className="text-sm font-medium">Bible Browser</p>
          <p className="text-xs text-muted-foreground mt-0.5">Search, compare translations, and project scripture live</p>
        </div>
      </button>

      {/* Music Player */}
      {onAddMusicPlayer && (
        <button
          onClick={onAddMusicPlayer}
          className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-accent hover:border-primary/30 transition-colors text-left group"
        >
          <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors shrink-0">
            <Music2 className="h-5 w-5 text-green-500" />
          </div>
          <div>
            <p className="text-sm font-medium">Music Player</p>
            <p className="text-xs text-muted-foreground mt-0.5">Browse a folder of audio files and play them one at a time</p>
          </div>
        </button>
      )}

      {/* Announcement */}
      <div className="flex flex-col gap-3 p-4 rounded-xl border border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
            <Megaphone className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <p className="text-sm font-medium">Announcement</p>
            <p className="text-xs text-muted-foreground mt-0.5">Display a title and message on screen</p>
          </div>
        </div>
        <input
          value={annTitle}
          onChange={e => setAnnTitle(e.target.value)}
          placeholder="Title (e.g. Welcome, Offering…)"
          className="w-full text-xs bg-input border border-border rounded-md px-3 py-2 focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/50"
        />
        <textarea
          value={annContent}
          onChange={e => setAnnContent(e.target.value)}
          placeholder="Content (optional)"
          rows={3}
          className="w-full text-xs bg-input border border-border rounded-md px-3 py-2 resize-none focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/50"
        />
        <Button
          size="sm"
          className="self-end gap-1.5 h-7 text-xs"
          disabled={!annTitle.trim()}
          onClick={() => onAddAnnouncement(annTitle.trim(), annContent.trim())}
        >
          <Check className="h-3 w-3" />Add Announcement
        </Button>
      </div>
    </div>
  )
}
