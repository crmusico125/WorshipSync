import { useState, useEffect, useRef } from "react"
import {
  BookOpen, Search, Radio, X, Loader2, ChevronRight,
  MonitorPlay, BookMarked, ArrowLeft,
} from "lucide-react"
import {
  fetchBiblePassage, fetchApiBibleTranslations,
  FREE_TRANSLATIONS,
  type BibleApiResult, type BibleApiVerse, type BibleTranslation,
} from "../../lib/bibleApi"
import TranslationPicker from "../../components/TranslationPicker"

// ── Types ──────────────────────────────────────────────────────────────────────

interface ResolvedTheme {
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

const DEFAULT_THEME: ResolvedTheme = {
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

// Popular passages shown when no chapter is open
const QUICK_PASSAGES = [
  { ref: "John 3:16",       label: "John 3:16"          },
  { ref: "Psalm 23",        label: "Psalm 23"            },
  { ref: "Romans 8:28",     label: "Romans 8:28"         },
  { ref: "Philippians 4:13",label: "Philippians 4:13"    },
  { ref: "Isaiah 40:31",    label: "Isaiah 40:31"        },
  { ref: "Jeremiah 29:11",  label: "Jeremiah 29:11"      },
  { ref: "Matthew 11:28",   label: "Matthew 11:28"       },
  { ref: "Proverbs 3:5-6",  label: "Proverbs 3:5–6"      },
]

// ── Sub-components ─────────────────────────────────────────────────────────────

function ProjectButton({
  isLive,
  isProjected,
  onClick,
}: {
  isLive: boolean
  isProjected: boolean
  onClick: () => void
}) {
  if (!isLive) {
    return (
      <button
        disabled
        title="Start a live show to project"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-border text-muted-foreground/40 cursor-not-allowed shrink-0"
      >
        <MonitorPlay className="h-3.5 w-3.5" />
        Project
      </button>
    )
  }

  if (isProjected) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-red-500/10 text-red-400 border border-red-500/25 shrink-0">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
        On Screen
      </div>
    )
  }

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors shrink-0"
    >
      <Radio className="h-3 w-3" />
      Project
    </button>
  )
}

function VerseCard({
  verse,
  translationLabel,
  isLive,
  isProjected,
  onProject,
}: {
  verse: BibleApiVerse
  translationLabel: string
  isLive: boolean
  isProjected: boolean
  onProject: () => void
}) {
  return (
    <div className={`rounded-xl border transition-colors ${
      isProjected
        ? "border-red-500/40 bg-red-500/5"
        : "border-border bg-card"
    }`}>
      <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-bold text-foreground">
            {verse.book_name} {verse.chapter}:{verse.verse}
          </span>
          <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {translationLabel}
          </span>
        </div>
        <ProjectButton isLive={isLive} isProjected={isProjected} onClick={onProject} />
      </div>
      <p className="px-4 pb-4 text-sm leading-relaxed text-foreground/90">
        {verse.text}
      </p>
    </div>
  )
}

function ChapterVerseRow({
  verse,
  isLive,
  isProjected,
  onProject,
}: {
  verse: BibleApiVerse
  isLive: boolean
  isProjected: boolean
  onProject: () => void
}) {
  return (
    <div className={`group flex items-start gap-3 px-4 py-2.5 transition-colors rounded-lg ${
      isProjected ? "bg-red-500/8 border border-red-500/20" : "hover:bg-accent/30 border border-transparent"
    }`}>
      <span className="text-[11px] font-bold text-muted-foreground/60 mt-0.5 w-6 shrink-0 text-right">
        {verse.verse}
      </span>
      <p className="flex-1 text-sm leading-relaxed text-foreground/90">
        {verse.text}
      </p>
      <div className="shrink-0 mt-0.5">
        <ProjectButton isLive={isLive} isProjected={isProjected} onClick={onProject} />
      </div>
    </div>
  )
}

// ── Main Screen ────────────────────────────────────────────────────────────────

interface Props {
  projectionOpen: boolean
}

export default function BibleScreen({ projectionOpen }: Props) {
  const [query, setQuery]                           = useState("")
  const [translation, setTranslation]               = useState("web")
  const [availableTranslations, setAvailableTranslations] = useState<BibleTranslation[]>(FREE_TRANSLATIONS)
  const [bibleApiKey, setBibleApiKey]               = useState<string | null>(null)
  const [translationsLoading, setTranslationsLoading] = useState(false)
  const [translationsError, setTranslationsError]   = useState<string | null>(null)

  const [result, setResult]                         = useState<BibleApiResult | null>(null)
  const [loading, setLoading]                       = useState(false)
  const [error, setError]                           = useState<string | null>(null)

  const [chapterResult, setChapterResult]           = useState<BibleApiResult | null>(null)
  const [chapterLoading, setChapterLoading]         = useState(false)
  const [chapterError, setChapterError]             = useState<string | null>(null)

  const [projectedLabel, setProjectedLabel]         = useState<string | null>(null)

  const [scriptureBackgroundPath, setScriptureBackgroundPath] = useState<string | null>(null)
  const [defaultThemeBg, setDefaultThemeBg]                   = useState<string | null>(null)
  const [resolvedTheme, setResolvedTheme]                     = useState<ResolvedTheme>(DEFAULT_THEME)

  const inputRef        = useRef<HTMLInputElement>(null)
  const scrollToVerseRef = useRef<number | null>(null)

  // ── Bootstrap ────────────────────────────────────────────────────────────────

  useEffect(() => {
    window.worshipsync.appState.getBibleApiKey().then(async (key: string | null) => {
      setBibleApiKey(key)
      if (key) {
        setTranslationsLoading(true)
        setTranslationsError(null)
        try {
          const keyed = await fetchApiBibleTranslations(key)
          const keyedLabels = new Set(keyed.map(t => t.label))
          const free = FREE_TRANSLATIONS.filter(t => !keyedLabels.has(t.label.toUpperCase()))
          setAvailableTranslations([...keyed, ...free])
          // Pre-select NIV if available, otherwise first keyed translation
          const preferred = keyed.find(t => t.label === "NIV" || t.label.startsWith("NIV")) ?? keyed[0]
          if (preferred) setTranslation(preferred.id)
        } catch (err) {
          setTranslationsError(
            err instanceof Error ? err.message : "Failed to load translations from API.Bible"
          )
        } finally {
          setTranslationsLoading(false)
        }
      }
    }).catch(() => {})

    window.worshipsync.themes.getDefault().then((t: any) => {
      if (t?.settings) {
        try {
          const s = JSON.parse(t.settings)
          setDefaultThemeBg(s.backgroundPath ?? null)
          setScriptureBackgroundPath(s.scriptureBackgroundPath ?? null)
          setResolvedTheme({ ...DEFAULT_THEME, ...s })
        } catch {}
      }
    }).catch(() => {})

    window.worshipsync.appState.get().then((state: Record<string, any>) => {
      if (state.projectionFontSize) {
        setResolvedTheme(prev => ({ ...prev, fontSize: state.projectionFontSize }))
      }
    }).catch(() => {})
  }, [])

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleSearch = async (e?: React.FormEvent, overrideQuery?: string) => {
    e?.preventDefault()
    const q = (overrideQuery ?? query).trim()
    if (!q) return
    setLoading(true)
    setError(null)
    setResult(null)
    setChapterResult(null)
    try {
      const r = await fetchBiblePassage(q, translation, bibleApiKey)
      setResult(r)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch passage")
    } finally {
      setLoading(false)
    }
  }

  const handleReadChapter = async () => {
    if (!result?.verses[0]) return
    const { book_name, chapter, verse } = result.verses[0]
    const ref = `${book_name} ${chapter}`
    scrollToVerseRef.current = verse
    setChapterLoading(true)
    setChapterError(null)
    try {
      const r = await fetchBiblePassage(ref, translation, bibleApiKey)
      setChapterResult(r)
    } catch (err) {
      setChapterError(err instanceof Error ? err.message : "Failed to load chapter")
    } finally {
      setChapterLoading(false)
    }
  }

  // Scroll to the originating verse after the chapter reader renders
  useEffect(() => {
    if (!chapterResult || scrollToVerseRef.current == null) return
    const targetVerse = scrollToVerseRef.current
    scrollToVerseRef.current = null
    // Let the DOM paint first, then scroll
    requestAnimationFrame(() => {
      const el = document.getElementById(`chapter-verse-${targetVerse}`)
      el?.scrollIntoView({ behavior: "smooth", block: "center" })
    })
  }, [chapterResult])

  const handleQuickPassage = (ref: string) => {
    setQuery(ref)
    handleSearch(undefined, ref)
  }

  const projectVerse = (verse: BibleApiVerse) => {
    const tLabel = availableTranslations.find(t => t.id === translation)?.label ?? translation.toUpperCase()
    const label = `${verse.book_name} ${verse.chapter}:${verse.verse} ${tLabel}`
    setProjectedLabel(label)
    // Scripture background takes priority over general theme background
    const bg = scriptureBackgroundPath ?? defaultThemeBg
    window.worshipsync.slide.show({
      lines: [verse.text],
      songTitle: `${verse.book_name} ${verse.chapter}`,
      sectionLabel: label,
      sectionType: "verse",
      itemType: "scripture",
      backgroundPath: bg,
      theme: resolvedTheme,
    })
  }

  const translationLabel = availableTranslations.find(t => t.id === translation)?.label
    ?? translation.toUpperCase()

  // ── Derived ───────────────────────────────────────────────────────────────────

  const chapterRef = result?.verses[0]
    ? `${result.verses[0].book_name} ${result.verses[0].chapter}`
    : null

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background text-foreground">

      {/* ── Top bar ── */}
      <div className="h-12 shrink-0 border-b border-border flex items-center px-5 gap-3">
        <BookOpen className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-semibold">Bible</span>
        <div className="flex-1" />
        {projectionOpen && (
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-red-400 bg-red-500/10 border border-red-500/25 px-2.5 py-1 rounded-lg">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
            LIVE
          </div>
        )}
      </div>

      {/* ── Two-panel body ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ─── LEFT: Search + results ─────────────────────────────────────── */}
        <div className="w-[380px] shrink-0 border-r border-border flex flex-col overflow-hidden">

          {/* Search form */}
          <div className="px-4 pt-4 pb-3 shrink-0">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => { setQuery(e.target.value); setError(null) }}
                  placeholder="John 3:16, Psalm 23, Romans 8:28–39…"
                  className="w-full h-9 pl-9 pr-8 text-sm bg-input border border-border rounded-lg focus:outline-none focus:border-primary/50 transition-colors placeholder:text-muted-foreground/50"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => { setQuery(""); setResult(null); setError(null); inputRef.current?.focus() }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="h-9 px-3.5 flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 shrink-0"
              >
                {loading
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <ChevronRight className="h-4 w-4" />}
              </button>
            </form>

            {/* Translation picker */}
            <div className="mt-3 flex items-center gap-2">
              <TranslationPicker
                translations={availableTranslations}
                value={translation}
                onChange={setTranslation}
                loading={translationsLoading}
              />
              {translationsError && (
                <span className="text-[11px] text-destructive">⚠ {translationsError}</span>
              )}
              {!bibleApiKey && !translationsLoading && (
                <span className="text-[10px] text-muted-foreground/50">
                  Add API.Bible key in Settings for NIV, NLT…
                </span>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mx-4 mb-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs text-destructive shrink-0">
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* Results */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">

            {/* Loading */}
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Verse results */}
            {!loading && result && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {result.verses.length} verse{result.verses.length !== 1 ? "s" : ""} · {translationLabel}
                  </span>
                </div>

                {result.verses.map((verse) => {
                  const label = `${verse.book_name} ${verse.chapter}:${verse.verse} ${translationLabel}`
                  return (
                    <VerseCard
                      key={`${verse.chapter}-${verse.verse}`}
                      verse={verse}
                      translationLabel={translationLabel}
                      isLive={projectionOpen}
                      isProjected={projectedLabel === label}
                      onProject={() => projectVerse(verse)}
                    />
                  )
                })}

                {/* Read chapter CTA */}
                {chapterRef && (
                  <button
                    onClick={handleReadChapter}
                    disabled={chapterLoading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors disabled:opacity-50"
                  >
                    {chapterLoading
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <BookMarked className="h-4 w-4" />}
                    {chapterLoading ? "Loading…" : `Read all of ${chapterRef} →`}
                  </button>
                )}
                {chapterError && (
                  <p className="text-xs text-destructive text-center">{chapterError}</p>
                )}
              </div>
            )}

            {/* Empty state — quick passages */}
            {!loading && !result && !error && (
              <div className="flex flex-col gap-4 pt-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                    Popular passages
                  </p>
                  <div className="flex flex-col gap-1">
                    {QUICK_PASSAGES.map(p => (
                      <button
                        key={p.ref}
                        onClick={() => handleQuickPassage(p.ref)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors text-left"
                      >
                        <BookOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── RIGHT: Chapter reader ──────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {chapterResult ? (
            <>
              {/* Chapter header */}
              <div className="h-12 shrink-0 border-b border-border flex items-center gap-3 px-5">
                <button
                  onClick={() => setChapterResult(null)}
                  className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </button>
                <div className="h-4 w-px bg-border" />
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-bold truncate">
                    {chapterResult.verses[0]?.book_name} {chapterResult.verses[0]?.chapter}
                  </span>
                  <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                    {translationLabel}
                  </span>
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {chapterResult.verses.length} verses
                  </span>
                </div>
                {!projectionOpen && (
                  <span className="ml-auto text-[11px] text-muted-foreground/60 italic shrink-0">
                    Go live to project
                  </span>
                )}
              </div>

              {/* Verses */}
              <div className="flex-1 overflow-y-auto px-4 py-3">
                <div className="max-w-2xl mx-auto flex flex-col gap-0.5">
                  {chapterResult.verses.map(verse => {
                    const label = `${verse.book_name} ${verse.chapter}:${verse.verse} ${translationLabel}`
                    return (
                      <div key={verse.verse} id={`chapter-verse-${verse.verse}`}>
                        <ChapterVerseRow
                          verse={verse}
                          isLive={projectionOpen}
                          isProjected={projectedLabel === label}
                          onProject={() => projectVerse(verse)}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          ) : (
            /* Empty state — no chapter loaded */
            <div className="flex-1 flex flex-col items-center justify-center text-center px-10">
              <div className="h-14 w-14 rounded-2xl bg-primary/8 border border-border flex items-center justify-center mb-4">
                <BookMarked className="h-7 w-7 text-primary/60" />
              </div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Chapter reader
              </p>
              <p className="text-[13px] text-muted-foreground/60 max-w-xs leading-relaxed">
                Search for a verse on the left, then click "Read all of…" to browse the full chapter here and project any verse while live.
              </p>
              {!projectionOpen && (
                <p className="mt-4 text-[11px] text-muted-foreground/40 flex items-center gap-1.5">
                  <Radio className="h-3.5 w-3.5" />
                  Project buttons activate when a show is live
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
