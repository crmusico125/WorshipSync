import { useState, useEffect, useRef, useMemo } from "react"
import {
  BookOpen, Search, X, Loader2, ChevronLeft, ChevronRight,
  Play, Clock, MonitorPlay, Star, Maximize2, EyeOff, RefreshCw,
} from "lucide-react"
import {
  fetchBiblePassage, fetchApiBibleTranslations,
  FREE_TRANSLATIONS,
  type BibleApiVerse, type BibleTranslation,
} from "../../lib/bibleApi"
import TranslationPicker from "../../components/TranslationPicker"
import { toFileUrl } from "../../lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

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

interface SessionEntry {
  verse: BibleApiVerse
  translationLabel: string
  label: string
}

interface RecentPassage {
  query: string
  translationId: string
  translationLabel: string
  reference: string
}

interface SavedVerse {
  book: string
  chapter: number
  verse: number
  text: string
  translationId: string
  translationLabel: string
  label: string
}

// ── Bible data ────────────────────────────────────────────────────────────────

const OT_BOOKS = [
  "Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges","Ruth",
  "1 Samuel","2 Samuel","1 Kings","2 Kings","1 Chronicles","2 Chronicles",
  "Ezra","Nehemiah","Esther","Job","Psalms","Proverbs","Ecclesiastes",
  "Song of Solomon","Isaiah","Jeremiah","Lamentations","Ezekiel","Daniel",
  "Hosea","Joel","Amos","Obadiah","Jonah","Micah","Nahum","Habakkuk",
  "Zephaniah","Haggai","Zechariah","Malachi",
]
const NT_BOOKS = [
  "Matthew","Mark","Luke","John","Acts","Romans","1 Corinthians","2 Corinthians",
  "Galatians","Ephesians","Philippians","Colossians","1 Thessalonians","2 Thessalonians",
  "1 Timothy","2 Timothy","Titus","Philemon","Hebrews","James","1 Peter","2 Peter",
  "1 John","2 John","3 John","Jude","Revelation",
]
const BIBLE_BOOKS = [...OT_BOOKS, ...NT_BOOKS]

const CHAPTER_COUNTS: Record<string, number> = {
  Genesis:50,Exodus:40,Leviticus:27,Numbers:36,Deuteronomy:34,Joshua:24,Judges:21,Ruth:4,
  "1 Samuel":31,"2 Samuel":24,"1 Kings":22,"2 Kings":25,"1 Chronicles":29,"2 Chronicles":36,
  Ezra:10,Nehemiah:13,Esther:10,Job:42,Psalms:150,Proverbs:31,Ecclesiastes:12,
  "Song of Solomon":8,Isaiah:66,Jeremiah:52,Lamentations:5,Ezekiel:48,Daniel:12,
  Hosea:14,Joel:3,Amos:9,Obadiah:1,Jonah:4,Micah:7,Nahum:3,Habakkuk:3,
  Zephaniah:3,Haggai:2,Zechariah:14,Malachi:4,
  Matthew:28,Mark:16,Luke:24,John:21,Acts:28,Romans:16,
  "1 Corinthians":16,"2 Corinthians":13,Galatians:6,Ephesians:6,Philippians:4,
  Colossians:4,"1 Thessalonians":5,"2 Thessalonians":3,"1 Timothy":6,"2 Timothy":4,
  Titus:3,Philemon:1,Hebrews:13,James:5,"1 Peter":5,"2 Peter":3,
  "1 John":5,"2 John":1,"3 John":1,Jude:1,Revelation:22,
}

const BOOK_ABBREVIATIONS: Record<string, string> = {
  gen:"Genesis", ex:"Exodus", exo:"Exodus", lev:"Leviticus",
  num:"Numbers", deut:"Deuteronomy", dt:"Deuteronomy",
  josh:"Joshua", jdg:"Judges", judg:"Judges",
  ru:"Ruth", rth:"Ruth",
  "1sa":"1 Samuel","1sam":"1 Samuel","2sa":"2 Samuel","2sam":"2 Samuel",
  "1ki":"1 Kings","1kgs":"1 Kings","2ki":"2 Kings","2kgs":"2 Kings",
  "1ch":"1 Chronicles","1chr":"1 Chronicles","1chron":"1 Chronicles",
  "2ch":"2 Chronicles","2chr":"2 Chronicles","2chron":"2 Chronicles",
  ezr:"Ezra", neh:"Nehemiah", est:"Esther", esth:"Esther",
  ps:"Psalms", psa:"Psalms", psalm:"Psalms",
  prov:"Proverbs", pro:"Proverbs", pr:"Proverbs",
  eccl:"Ecclesiastes", ecc:"Ecclesiastes",
  sos:"Song of Solomon", song:"Song of Solomon", ss:"Song of Solomon",
  isa:"Isaiah", jer:"Jeremiah", lam:"Lamentations",
  ezek:"Ezekiel", eze:"Ezekiel", dan:"Daniel", hos:"Hosea",
  am:"Amos", ob:"Obadiah", oba:"Obadiah",
  jon:"Jonah", mic:"Micah", nah:"Nahum", hab:"Habakkuk",
  zeph:"Zephaniah", hag:"Haggai", zech:"Zechariah", zec:"Zechariah",
  mal:"Malachi",
  mt:"Matthew", matt:"Matthew", mk:"Mark", mar:"Mark",
  lk:"Luke", luk:"Luke", jn:"John", joh:"John",
  ac:"Acts", act:"Acts",
  ro:"Romans", rom:"Romans",
  "1co":"1 Corinthians","1cor":"1 Corinthians",
  "2co":"2 Corinthians","2cor":"2 Corinthians",
  gal:"Galatians", eph:"Ephesians",
  php:"Philippians", phil:"Philippians",
  col:"Colossians",
  "1th":"1 Thessalonians","1thes":"1 Thessalonians","1thess":"1 Thessalonians",
  "2th":"2 Thessalonians","2thes":"2 Thessalonians","2thess":"2 Thessalonians",
  "1ti":"1 Timothy","1tim":"1 Timothy",
  "2ti":"2 Timothy","2tim":"2 Timothy",
  tit:"Titus", phm:"Philemon", phlm:"Philemon",
  heb:"Hebrews",
  jas:"James", jam:"James",
  "1pe":"1 Peter","1pet":"1 Peter","1pt":"1 Peter",
  "2pe":"2 Peter","2pet":"2 Peter","2pt":"2 Peter",
  "1jn":"1 John","1jo":"1 John",
  "2jn":"2 John","2jo":"2 John",
  "3jn":"3 John","3jo":"3 John",
  jud:"Jude",
  rev:"Revelation",
}

function resolveBook(name: string): string | null {
  const lower = name.toLowerCase().trim()
  const exact = BIBLE_BOOKS.find(b => b.toLowerCase() === lower)
  if (exact) return exact
  const abbr = BOOK_ABBREVIATIONS[lower]
  if (abbr) return abbr
  return BIBLE_BOOKS.find(b => b.toLowerCase().startsWith(lower)) ?? null
}

function getBookSuggestions(query: string): string[] {
  if (!query) return []
  const qt = query.trim().toLowerCase()
  for (const book of BIBLE_BOOKS) {
    if (qt.startsWith(book.toLowerCase())) {
      const after = query.trim().slice(book.length)
      if (/^\s+\d/.test(after)) return []
    }
  }
  const m = qt.match(/^(\S+)\s+\d/)
  if (m && (BOOK_ABBREVIATIONS[m[1]] || BIBLE_BOOKS.find(b => b.toLowerCase() === m[1]))) return []
  const byPrefix = BIBLE_BOOKS.filter(b => b.toLowerCase().startsWith(qt))
  if (byPrefix.length) return byPrefix.slice(0, 6)
  const abbr = BOOK_ABBREVIATIONS[qt]
  return abbr ? [abbr] : []
}

const BOOKMARKS_KEY = "worshipsync:bible-bookmarks"

// Persists session history across navigation (component unmount/remount)
let _sessionHistoryCache: SessionEntry[] = []

// ── Main component ────────────────────────────────────────────────────────────

interface Props { projectionOpen: boolean }

export default function BibleScreen({ projectionOpen }: Props) {

  // Translation
  const [translation, setTranslation]                     = useState("web")
  const [availableTranslations, setAvailableTranslations] = useState<BibleTranslation[]>(FREE_TRANSLATIONS)
  const [bibleApiKey, setBibleApiKey]                     = useState<string | null>(null)
  const [translationsLoading, setTranslationsLoading]     = useState(false)
  const [translationsError, setTranslationsError]         = useState<string | null>(null)

  // Browse navigation
  const [activeBook, setActiveBook]       = useState<string | null>(null)
  const [activeChapter, setActiveChapter] = useState<number | null>(null)
  const [bookFilter, setBookFilter]       = useState("")
  const [col1Tab, setCol1Tab]             = useState<"browse" | "bookmarks">("browse")
  const [chapterInput, setChapterInput]   = useState("")

  // Chapter verses
  const [chapterVerses, setChapterVerses]   = useState<BibleApiVerse[]>([])
  const [chapterLoading, setChapterLoading] = useState(false)
  const [chapterError, setChapterError]     = useState<string | null>(null)

  // Selected verse and optional range highlight
  const [selectedIdx, setSelectedIdx]                   = useState<number | null>(null)
  const selectedIdxRef                                  = useRef<number | null>(null)
  const [highlightedVerseNums, setHighlightedVerseNums] = useState<Set<number>>(new Set())

  // History preview override (re-project from history without disrupting browse)
  const [historyPreview, setHistoryPreview] = useState<{ verse: BibleApiVerse; translationLabel: string } | null>(null)

  // Search
  const [searchQuery, setSearchQuery]         = useState("")
  const [searchHidden, setSearchHidden]       = useState(false)
  const [searchHighlight, setSearchHighlight] = useState(-1)

  // Projection
  const [projectedLabel, setProjectedLabel] = useState<string | null>(null)
  const [sessionHistory, setSessionHistory] = useState<SessionEntry[]>(_sessionHistoryCache)
  const recentPassagesRef                   = useRef<RecentPassage[]>([])

  // Bookmarks (persisted to localStorage)
  const [bookmarks, setBookmarks] = useState<SavedVerse[]>([])

  // UI overlays
  const [showHistoryPopover, setShowHistoryPopover] = useState(false)
  const [showPreviewModal, setShowPreviewModal]     = useState(false)

  // Theme / background
  const [scriptureBackgroundPath, setScriptureBackgroundPath] = useState<string | null>(null)
  const [defaultThemeBg, setDefaultThemeBg]                   = useState<string | null>(null)
  const [resolvedTheme, setResolvedTheme]                     = useState<ResolvedTheme>(DEFAULT_THEME)

  // Scripture-specific display settings
  const [scriptureFontSize, setScriptureFontSize]       = useState(48)
  const [scriptureTextAlign, setScriptureTextAlign]     = useState<"left" | "center">("center")
  const [scriptureRefPosition, setScriptureRefPosition] = useState<"top" | "bottom-right" | "bottom-center" | "hidden">("bottom-right")

  const searchRef          = useRef<HTMLInputElement>(null)
  const verseListRef       = useRef<HTMLDivElement>(null)
  const projectVerseRef    = useRef<(verse: BibleApiVerse, tLabel?: string) => void>(() => {})
  const historyPopoverRef  = useRef<HTMLDivElement>(null)

  useEffect(() => { selectedIdxRef.current = selectedIdx }, [selectedIdx])

  const bookSuggestions = useMemo(
    () => searchHidden ? [] : getBookSuggestions(searchQuery),
    [searchQuery, searchHidden],
  )
  useEffect(() => setSearchHighlight(-1), [bookSuggestions])

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  useEffect(() => {
    // Load bookmarks from localStorage
    try {
      const saved = localStorage.getItem(BOOKMARKS_KEY)
      if (saved) setBookmarks(JSON.parse(saved))
    } catch {}

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
          const preferred = keyed.find(t => t.label === "NIV" || t.label.startsWith("NIV")) ?? keyed[0]
          if (preferred) setTranslation(preferred.id)
        } catch (err) {
          setTranslationsError(err instanceof Error ? err.message : "Failed to load translations from API.Bible")
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
      if (state.scriptureFontSize)    setScriptureFontSize(state.scriptureFontSize as number)
      if (state.scriptureTextAlign)   setScriptureTextAlign(state.scriptureTextAlign as "left" | "center")
      if (state.scriptureRefPosition) setScriptureRefPosition(state.scriptureRefPosition as typeof scriptureRefPosition)
      if (Array.isArray(state.recentScriptures)) {
        recentPassagesRef.current = state.recentScriptures as RecentPassage[]
      }
    }).catch(() => {})
  }, [])

  // Persist bookmarks whenever they change
  useEffect(() => {
    try { localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks)) } catch {}
  }, [bookmarks])

  // Close history popover on outside click
  useEffect(() => {
    if (!showHistoryPopover) return
    const handler = (e: MouseEvent) => {
      if (historyPopoverRef.current && !historyPopoverRef.current.contains(e.target as Node)) {
        setShowHistoryPopover(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [showHistoryPopover])

  // Sync scripture settings changed live from SettingsScreen
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<Record<string, any>>).detail
      if (detail.scriptureFontSize    !== undefined) setScriptureFontSize(detail.scriptureFontSize as number)
      if (detail.scriptureTextAlign   !== undefined) setScriptureTextAlign(detail.scriptureTextAlign as "left" | "center")
      if (detail.scriptureRefPosition !== undefined) setScriptureRefPosition(detail.scriptureRefPosition as typeof scriptureRefPosition)
    }
    window.addEventListener("worshipsync:settings-change", handler)
    return () => window.removeEventListener("worshipsync:settings-change", handler)
  }, [])

  // Reload chapter when translation changes
  useEffect(() => {
    if (activeBook && activeChapter !== null) {
      doLoadChapter(activeBook, activeChapter)
    }
  }, [translation]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Chapter loading ────────────────────────────────────────────────────────

  const doLoadChapter = async (book: string, chapter: number): Promise<BibleApiVerse[]> => {
    setChapterLoading(true)
    setChapterError(null)
    setChapterVerses([])
    setSelectedIdx(null)
    setHighlightedVerseNums(new Set())
    setHistoryPreview(null)
    try {
      const r = await fetchBiblePassage(`${book} ${chapter}`, translation, bibleApiKey)
      setChapterVerses(r.verses)
      return r.verses
    } catch (err) {
      setChapterError(err instanceof Error ? err.message : "Failed to load chapter")
      return []
    } finally {
      setChapterLoading(false)
    }
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  const selectBook = (book: string) => {
    setActiveBook(book)
    setActiveChapter(null)
    setChapterVerses([])
    setSelectedIdx(null)
    setChapterError(null)
    setBookFilter("")
    setChapterInput("")
    // Auto-select the only chapter for single-chapter books
    if ((CHAPTER_COUNTS[book] ?? 1) === 1) {
      setActiveChapter(1)
      doLoadChapter(book, 1)
    }
  }

  const selectChapter = async (chapter: number) => {
    if (!activeBook) return
    setActiveChapter(chapter)
    setChapterInput("")
    await doLoadChapter(activeBook, chapter)
    verseListRef.current?.scrollTo({ top: 0 })
  }

  const prevChapter = () => {
    if (!activeBook || !activeChapter || activeChapter <= 1) return
    const ch = activeChapter - 1
    setActiveChapter(ch)
    doLoadChapter(activeBook, ch)
    verseListRef.current?.scrollTo({ top: 0 })
  }

  const nextChapter = () => {
    if (!activeBook || activeChapter === null) return
    const total = CHAPTER_COUNTS[activeBook] ?? 1
    if (activeChapter >= total) return
    const ch = activeChapter + 1
    setActiveChapter(ch)
    doLoadChapter(activeBook, ch)
    verseListRef.current?.scrollTo({ top: 0 })
  }

  const selectVerse = (idx: number) => {
    setHistoryPreview(null)
    setHighlightedVerseNums(new Set())
    setSelectedIdx(prev => prev === idx ? null : idx)
  }

  // ── Projection ─────────────────────────────────────────────────────────────

  const projectVerse = (verse: BibleApiVerse, tLabel?: string) => {
    const translationLabel = tLabel ?? availableTranslations.find(t => t.id === translation)?.label ?? translation.toUpperCase()
    const label = `${verse.book_name} ${verse.chapter}:${verse.verse} ${translationLabel}`
    setProjectedLabel(label)

    setSessionHistory(prev => {
      const entry: SessionEntry = { verse, translationLabel, label }
      const next = [entry, ...prev.filter(e => e.label !== label)].slice(0, 20)
      _sessionHistoryCache = next
      return next
    })

    const reference = `${verse.book_name} ${verse.chapter}:${verse.verse}`
    const rpEntry: RecentPassage = { query: reference, translationId: translation, translationLabel, reference }
    const prev = recentPassagesRef.current
    const updated = [rpEntry, ...prev.filter(r => r.reference !== reference || r.translationId !== translation)].slice(0, 8)
    recentPassagesRef.current = updated
    window.worshipsync.appState.set({ recentScriptures: updated, lastBibleTranslation: translation }).catch(() => {})

    const bg = scriptureBackgroundPath ?? defaultThemeBg
    window.worshipsync.slide.show({
      lines: [verse.text],
      songTitle: `${verse.book_name} ${verse.chapter}`,
      sectionLabel: label,
      sectionType: "verse",
      itemType: "scripture",
      backgroundPath: bg,
      theme: {
        ...resolvedTheme,
        fontSize: scriptureFontSize,
        textAlign: scriptureTextAlign,
        maxLinesPerSlide: 1,
        scriptureRefPosition,
      },
    })
  }

  projectVerseRef.current = projectVerse

  const handleProjectNow = () => {
    if (selectedIdx === null) return
    projectVerse(chapterVerses[selectedIdx])
  }

  const clearScreen = () => {
    window.worshipsync.slide.blank(true)
    setProjectedLabel(null)
  }

  // ── Translation retry ──────────────────────────────────────────────────────

  const retryTranslations = async () => {
    if (!bibleApiKey) return
    setTranslationsLoading(true)
    setTranslationsError(null)
    try {
      const keyed = await fetchApiBibleTranslations(bibleApiKey)
      const keyedLabels = new Set(keyed.map(t => t.label))
      const free = FREE_TRANSLATIONS.filter(t => !keyedLabels.has(t.label.toUpperCase()))
      setAvailableTranslations([...keyed, ...free])
      const preferred = keyed.find(t => t.label === "NIV" || t.label.startsWith("NIV")) ?? keyed[0]
      if (preferred) setTranslation(preferred.id)
    } catch (err) {
      setTranslationsError(err instanceof Error ? err.message : "Failed to load translations")
    } finally {
      setTranslationsLoading(false)
    }
  }

  // ── Bookmarks ──────────────────────────────────────────────────────────────

  const toggleBookmark = (verse: BibleApiVerse) => {
    const tLabel = availableTranslations.find(t => t.id === translation)?.label ?? translation.toUpperCase()
    setBookmarks(prev => {
      const exists = prev.some(b => b.book === verse.book_name && b.chapter === verse.chapter && b.verse === verse.verse)
      if (exists) {
        return prev.filter(b => !(b.book === verse.book_name && b.chapter === verse.chapter && b.verse === verse.verse))
      }
      const bm: SavedVerse = {
        book: verse.book_name,
        chapter: verse.chapter,
        verse: verse.verse,
        text: verse.text,
        translationId: translation,
        translationLabel: tLabel,
        label: `${verse.book_name} ${verse.chapter}:${verse.verse} ${tLabel}`,
      }
      return [bm, ...prev]
    })
  }

  const isVerseBookmarked = (verse: BibleApiVerse) =>
    bookmarks.some(b => b.book === verse.book_name && b.chapter === verse.chapter && b.verse === verse.verse)

  const jumpToBookmark = async (bm: SavedVerse) => {
    setActiveBook(bm.book)
    setActiveChapter(bm.chapter)
    setCol1Tab("browse")
    const verses = await doLoadChapter(bm.book, bm.chapter)
    const idx = verses.findIndex(v => v.verse === bm.verse)
    if (idx >= 0) {
      setSelectedIdx(idx)
      setTimeout(() => {
        const el = verseListRef.current?.children[idx] as HTMLElement | undefined
        el?.scrollIntoView({ behavior: "smooth", block: "center" })
      }, 50)
    }
  }

  // ── Session history ────────────────────────────────────────────────────────

  const jumpToHistory = async (entry: SessionEntry) => {
    const { book_name, chapter, verse: verseNum } = entry.verse
    setActiveBook(book_name)
    setActiveChapter(chapter)
    setShowHistoryPopover(false)
    const verses = await doLoadChapter(book_name, chapter)
    const idx = verses.findIndex(v => v.verse === verseNum)
    if (idx >= 0) {
      setSelectedIdx(idx)
      setTimeout(() => {
        const el = verseListRef.current?.children[idx] as HTMLElement | undefined
        el?.scrollIntoView({ behavior: "smooth", block: "center" })
      }, 50)
    }
  }

  const reprojectHistory = (entry: SessionEntry) => {
    setHistoryPreview({ verse: entry.verse, translationLabel: entry.translationLabel })
    projectVerse(entry.verse, entry.translationLabel)
  }

  // ── Search jump-to ─────────────────────────────────────────────────────────

  const jumpToRef = async (ref: string) => {
    const m = ref.trim().match(/^([\w\s]+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?/)
    if (!m) return
    const book = resolveBook(m[1])
    if (!book) return
    const chapter    = parseInt(m[2])
    const startVerse = m[3] ? parseInt(m[3]) : null
    const endVerse   = m[4] ? parseInt(m[4]) : startVerse
    setActiveBook(book)
    setActiveChapter(chapter)
    const verses = await doLoadChapter(book, chapter)
    if (startVerse !== null) {
      const startIdx = verses.findIndex(v => v.verse === startVerse)
      if (startIdx >= 0) {
        setSelectedIdx(startIdx)
        selectedIdxRef.current = startIdx
        if (endVerse !== null && endVerse > startVerse) {
          const nums = new Set<number>()
          for (let v = startVerse; v <= endVerse; v++) nums.add(v)
          setHighlightedVerseNums(nums)
        }
        setTimeout(() => {
          const el = verseListRef.current?.children[startIdx] as HTMLElement | undefined
          el?.scrollIntoView({ behavior: "smooth", block: "center" })
        }, 50)
      }
    }
    setSearchQuery("")
    setSearchHidden(false)
  }

  // ── Keyboard navigation ────────────────────────────────────────────────────

  useEffect(() => {
    if (!chapterVerses.length) return
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault()
        if (highlightedVerseNums.size > 0) {
          // Navigate within the highlighted range only
          const rangeNums = Array.from(highlightedVerseNums).sort((a, b) => a - b)
          const currentVerse = chapterVerses[selectedIdxRef.current ?? 0]?.verse ?? rangeNums[0]
          const currentPos = rangeNums.indexOf(currentVerse)
          const nextPos = e.key === "ArrowDown"
            ? Math.min(currentPos + 1, rangeNums.length - 1)
            : Math.max(currentPos - 1, 0)
          const nextVerseNum = rangeNums[nextPos]
          const next = chapterVerses.findIndex(v => v.verse === nextVerseNum)
          if (next >= 0) {
            setSelectedIdx(next)
            selectedIdxRef.current = next
            const el = verseListRef.current?.children[next] as HTMLElement | undefined
            el?.scrollIntoView({ behavior: "smooth", block: "nearest" })
            if (projectionOpen) projectVerseRef.current(chapterVerses[next])
          }
        } else {
          const current = selectedIdxRef.current ?? -1
          const next = e.key === "ArrowDown"
            ? Math.min(current + 1, chapterVerses.length - 1)
            : Math.max(current - 1, 0)
          setSelectedIdx(next)
          selectedIdxRef.current = next
          const el = verseListRef.current?.children[next] as HTMLElement | undefined
          el?.scrollIntoView({ behavior: "smooth", block: "nearest" })
          if (projectionOpen) projectVerseRef.current(chapterVerses[next])
        }
      }
      if ((e.key === "Enter" || e.key === " ") && projectionOpen) {
        e.preventDefault()
        const idx = selectedIdxRef.current
        if (idx !== null && chapterVerses[idx]) projectVerseRef.current(chapterVerses[idx])
      }
      if (e.key === "Escape" && showHistoryPopover) {
        setShowHistoryPopover(false)
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [chapterVerses, projectionOpen, highlightedVerseNums, showHistoryPopover]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ────────────────────────────────────────────────────────────────

  const translationLabel       = availableTranslations.find(t => t.id === translation)?.label ?? translation.toUpperCase()
  const browseSelectedVerse    = selectedIdx !== null ? chapterVerses[selectedIdx] : null
  const selectedVerse          = historyPreview?.verse ?? browseSelectedVerse
  const selectedVerseTranslation = historyPreview?.translationLabel ?? translationLabel
  const totalChapters          = activeBook ? (CHAPTER_COUNTS[activeBook] ?? 1) : 0
  const isProjected            = selectedVerse
    ? projectedLabel === `${selectedVerse.book_name} ${selectedVerse.chapter}:${selectedVerse.verse} ${selectedVerseTranslation}`
    : false

  const filteredOT = bookFilter ? OT_BOOKS.filter(b => b.toLowerCase().includes(bookFilter.toLowerCase())) : OT_BOOKS
  const filteredNT = bookFilter ? NT_BOOKS.filter(b => b.toLowerCase().includes(bookFilter.toLowerCase())) : NT_BOOKS

  const previewFontPx = Math.max(8, Math.min(14, scriptureFontSize / 5))
  const modalFontPx   = Math.max(14, Math.min(32, scriptureFontSize / 2.2))
  const previewBg     = scriptureBackgroundPath ?? defaultThemeBg

  // Range tracking for display
  const rangeNums = useMemo(() => Array.from(highlightedVerseNums).sort((a, b) => a - b), [highlightedVerseNums])
  const currentVerseInRange = selectedIdx !== null ? chapterVerses[selectedIdx]?.verse : undefined
  const rangePosDisplay = currentVerseInRange !== undefined && rangeNums.length > 0
    ? `${rangeNums.indexOf(currentVerseInRange) + 1}/${rangeNums.length}`
    : null

  // ── Tip text ───────────────────────────────────────────────────────────────

  const tipText = (() => {
    if (rangeNums.length > 0 && selectedVerse) {
      return `Range v.${rangeNums[0]}–${rangeNums[rangeNums.length - 1]} · ↓↑ advances through range · Enter to project`
    }
    if (selectedVerse) return "Press Enter or click Project Now to go live."
    return "Click any verse to preview · press Enter to project."
  })()

  // ── Shared slide preview renderer ──────────────────────────────────────────

  const renderSlidePreview = (fontPx: number, rounded = "rounded-lg") => (
    <div className={`w-full aspect-video ${rounded} border border-border overflow-hidden relative bg-black`}>
      {previewBg ? (
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${toFileUrl(previewBg)})` }} />
      ) : (
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 55% 40%, #1a0d40 0%, #06030f 100%)" }} />
      )}
      <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${resolvedTheme.overlayOpacity / 100})` }} />

      {selectedVerse ? (
        <>
          {scriptureRefPosition === "top" && (
            <div className="absolute top-0 inset-x-0 px-3 pt-2 z-10">
              <p className="font-semibold leading-none" style={{ fontSize: `${fontPx * 0.45}px`, textAlign: scriptureTextAlign, color: resolvedTheme.textColor, opacity: 0.55 }}>
                {selectedVerse.book_name} {selectedVerse.chapter}:{selectedVerse.verse} · {selectedVerseTranslation}
              </p>
            </div>
          )}
          <div className="absolute inset-0 flex flex-col justify-center px-3 py-4 z-10" style={{ alignItems: scriptureTextAlign === "left" ? "flex-start" : "center" }}>
            <p className="leading-[1.55]" style={{ fontSize: `${fontPx}px`, fontFamily: resolvedTheme.fontFamily, fontWeight: resolvedTheme.fontWeight, color: resolvedTheme.textColor, textAlign: scriptureTextAlign, textShadow: `0 1px 3px rgba(0,0,0,${resolvedTheme.textShadowOpacity / 100})` }}>
              {selectedVerse.text}
            </p>
          </div>
          {(scriptureRefPosition === "bottom-right" || scriptureRefPosition === "bottom-center") && (
            <div className="absolute bottom-0 inset-x-0 px-3 pb-2 z-10">
              <p className="font-semibold leading-none" style={{ fontSize: `${fontPx * 0.45}px`, textAlign: scriptureRefPosition === "bottom-right" ? "right" : "center", color: resolvedTheme.textColor, opacity: 0.55 }}>
                {selectedVerse.book_name} {selectedVerse.chapter}:{selectedVerse.verse} · {selectedVerseTranslation}
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 z-10">
          <MonitorPlay className="h-4 w-4 text-white/15" />
          <p className="text-[7.5px] font-semibold text-white/20 uppercase tracking-widest">Select a verse</p>
        </div>
      )}
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background text-foreground">

      {/* ── Preview expand modal ── */}
      {showPreviewModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-8"
          onClick={() => setShowPreviewModal(false)}
        >
          <div className="w-full max-w-2xl relative" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowPreviewModal(false)}
              className="absolute -top-9 right-0 flex items-center gap-1.5 text-white/60 hover:text-white text-xs transition-colors"
            >
              <X className="h-3.5 w-3.5" /> Close
            </button>
            {renderSlidePreview(modalFontPx, "rounded-xl")}
            {selectedVerse && (
              <div className="mt-3 text-center">
                <p className="text-sm font-semibold text-white/80">
                  {selectedVerse.book_name} {selectedVerse.chapter}:{selectedVerse.verse} · {selectedVerseTranslation}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="relative h-11 shrink-0 border-b border-border flex items-center gap-2.5 px-3">
        {/* Reference search */}
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            ref={searchRef}
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setSearchHidden(false) }}
            onKeyDown={e => {
              if (bookSuggestions.length > 0) {
                if (e.key === "ArrowDown") { e.preventDefault(); setSearchHighlight(h => Math.min(h + 1, bookSuggestions.length - 1)); return }
                if (e.key === "ArrowUp")   { e.preventDefault(); setSearchHighlight(h => Math.max(h - 1, 0)); return }
                if (e.key === "Escape")    { e.preventDefault(); setSearchHidden(true); return }
                if (e.key === "Tab" || (e.key === "Enter" && searchHighlight >= 0)) {
                  e.preventDefault()
                  const chosen = bookSuggestions[searchHighlight >= 0 ? searchHighlight : 0]
                  setSearchQuery(chosen + " ")
                  setSearchHidden(true)
                  return
                }
              }
              if (e.key === "Enter") { e.preventDefault(); jumpToRef(searchQuery) }
            }}
            placeholder="Go to reference…  e.g. John 3:16, Ps 23:1, John 3:16-18"
            aria-label="Go to Bible reference"
            className="w-full h-8 pl-8 pr-7 text-sm bg-card border border-border rounded-md focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/30 transition-colors placeholder:text-muted-foreground/40"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => { setSearchQuery(""); setSearchHidden(false); searchRef.current?.focus() }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
          {/* Book autocomplete */}
          {bookSuggestions.length > 0 && (
            <ul className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-lg shadow-xl overflow-hidden">
              {bookSuggestions.map((book, i) => (
                <li key={book}>
                  <button
                    type="button"
                    onMouseDown={e => {
                      e.preventDefault()
                      setSearchQuery(book + " ")
                      setSearchHidden(true)
                      searchRef.current?.focus()
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${i === searchHighlight ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent"}`}
                  >
                    <BookOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span>
                      <span className="font-semibold text-primary">{book.slice(0, searchQuery.length)}</span>
                      {book.slice(searchQuery.length)}
                    </span>
                    <span className="ml-auto text-[10px] text-muted-foreground">{CHAPTER_COUNTS[book]} ch</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Translation error + retry */}
        {translationsError && (
          <button
            onClick={retryTranslations}
            title={translationsError}
            aria-label={`${translationsError}. Retry translations`}
            role="alert"
            className="flex items-center gap-1 text-destructive hover:text-destructive/80 transition-colors shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="text-[10px] font-semibold hidden lg:block">Retry translations</span>
          </button>
        )}

        {!bibleApiKey && !translationsLoading && !translationsError && (
          <span className="text-[10px] text-muted-foreground/40 hidden lg:block shrink-0">
            Add API.Bible key in Settings for NIV, NLT…
          </span>
        )}

        {/* History popover button */}
        <button
          onClick={() => setShowHistoryPopover(p => !p)}
          title="Session history"
          aria-label="Session history"
          aria-expanded={showHistoryPopover}
          className={`relative shrink-0 w-8 h-8 flex items-center justify-center rounded-md transition-colors ${showHistoryPopover ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}
        >
          <Clock className="h-4 w-4" />
          {sessionHistory.length > 0 && (
            <span className="absolute top-0.5 right-0.5 min-w-[14px] h-[14px] bg-primary text-white text-[8px] font-black rounded-full flex items-center justify-center px-0.5">
              {sessionHistory.length}
            </span>
          )}
        </button>

        {/* History popover — absolute inside toolbar so it clears the right panel */}
        {showHistoryPopover && (
          <div
            ref={historyPopoverRef}
            className="absolute z-40 w-80 max-h-[420px] flex flex-col bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
            style={{ top: "calc(100% + 4px)", right: "256px" }}
          >
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border shrink-0">
              <span className="text-xs font-bold text-foreground">Session History</span>
              {sessionHistory.length > 0 && (
                <span className="text-[10px] text-muted-foreground">{sessionHistory.length} verse{sessionHistory.length !== 1 ? "s" : ""}</span>
              )}
              <button onClick={() => setShowHistoryPopover(false)} aria-label="Close session history" className="ml-auto text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {sessionHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
                  <Clock className="h-5 w-5 text-muted-foreground/25" />
                  <p className="text-sm font-medium text-muted-foreground/60">No history yet</p>
                  <p className="text-xs text-muted-foreground/40 leading-relaxed">Verses you project will appear here.</p>
                </div>
              ) : (
                sessionHistory.map(entry => {
                  const isOnScreen = projectedLabel === entry.label
                  return (
                    <div
                      key={entry.label}
                      onClick={() => jumpToHistory(entry)}
                      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); jumpToHistory(entry) } }}
                      role="button"
                      tabIndex={0}
                      aria-label={`Jump to ${entry.label}`}
                      className={`group flex items-start border-b border-border/50 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:ring-inset ${isOnScreen ? "bg-primary/8" : "hover:bg-accent/40"}`}
                    >
                      <div className="flex-1 min-w-0 px-3 py-2.5">
                        <div className="flex items-center gap-1.5 mb-1">
                          {isOnScreen && <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse shrink-0" />}
                          <span className={`text-[13px] font-bold truncate ${isOnScreen ? "text-primary" : "text-foreground"}`}>
                            {entry.verse.book_name} {entry.verse.chapter}:{entry.verse.verse}
                          </span>
                          <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1 py-px rounded shrink-0">
                            {entry.translationLabel}
                          </span>
                        </div>
                        <p className="text-[12px] text-muted-foreground/60 leading-snug line-clamp-2">{entry.verse.text}</p>
                      </div>
                      {projectionOpen && (
                        <button
                          onClick={e => { e.stopPropagation(); reprojectHistory(entry) }}
                          title="Project again"
                          aria-label={`Project ${entry.label} again`}
                          className="shrink-0 self-center mr-2 w-7 h-7 rounded flex items-center justify-center bg-primary text-white opacity-25 group-hover:opacity-100 hover:bg-primary/80 transition-all"
                        >
                          <Play className="h-3 w-3 fill-current" />
                        </button>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Three-column body ── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* ── COL 1: Browse / Bookmarks (200px) ── */}
        <div className="w-[200px] shrink-0 border-r border-border flex flex-col overflow-hidden bg-card">

          {/* Tabs */}
          <div className="flex shrink-0 border-b border-border">
            <button
              onClick={() => setCol1Tab("browse")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold tracking-wide transition-colors ${col1Tab === "browse" ? "text-primary bg-primary/8" : "text-muted-foreground hover:text-foreground"}`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              Browse
            </button>
            <button
              onClick={() => setCol1Tab("bookmarks")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold tracking-wide transition-colors relative ${col1Tab === "bookmarks" ? "text-primary bg-primary/8" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Star className="h-3.5 w-3.5" />
              Saved
              {bookmarks.length > 0 && (
                <span className="absolute top-1.5 right-2 min-w-[15px] h-[15px] bg-primary text-white text-[8px] font-black rounded-full flex items-center justify-center px-0.5">
                  {bookmarks.length}
                </span>
              )}
            </button>
          </div>

          {/* Browse panel */}
          {col1Tab === "browse" && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="px-2.5 py-2 shrink-0 border-b border-border">
                <input
                  value={bookFilter}
                  onChange={e => setBookFilter(e.target.value)}
                  placeholder="Filter books…"
                  aria-label="Filter books"
                  className="w-full h-7 px-2.5 text-[13px] bg-background border border-border rounded focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/30 transition-colors placeholder:text-muted-foreground/40"
                />
              </div>
              <div className="flex-1 overflow-y-auto py-1">
                {filteredOT.length > 0 && (
                  <>
                    <div className="px-3 pt-2.5 pb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 sticky top-0 bg-card z-10">Old Testament</div>
                    {filteredOT.map(book => (
                      <button
                        key={book}
                        onClick={() => selectBook(book)}
                        className={`w-full text-left px-3 py-2 text-[13px] transition-colors ${activeBook === book ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                      >
                        {book}
                      </button>
                    ))}
                  </>
                )}
                {filteredNT.length > 0 && (
                  <>
                    <div className="px-3 pt-3.5 pb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 sticky top-0 bg-card z-10">New Testament</div>
                    {filteredNT.map(book => (
                      <button
                        key={book}
                        onClick={() => selectBook(book)}
                        className={`w-full text-left px-3 py-2 text-[13px] transition-colors ${activeBook === book ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                      >
                        {book}
                      </button>
                    ))}
                  </>
                )}
                {filteredOT.length === 0 && filteredNT.length === 0 && (
                  <p className="text-center text-xs text-muted-foreground/40 py-6 px-3">No books match</p>
                )}
              </div>
            </div>
          )}

          {/* Bookmarks panel */}
          {col1Tab === "bookmarks" && (
            <div className="flex-1 overflow-y-auto">
              {bookmarks.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
                  <Star className="h-5 w-5 text-muted-foreground/25" />
                  <p className="text-sm font-medium text-muted-foreground/60">No saved verses</p>
                  <p className="text-xs text-muted-foreground/40 leading-relaxed">
                    Click the ★ next to any verse to save it here across sessions.
                  </p>
                </div>
              ) : (
                bookmarks.map(bm => (
                  <div
                    key={bm.label}
                    onClick={() => jumpToBookmark(bm)}
                    onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); jumpToBookmark(bm) } }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Jump to saved verse ${bm.label}`}
                    className="group flex items-start border-b border-border/50 cursor-pointer hover:bg-accent/40 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:ring-inset"
                  >
                    <div className="flex-1 min-w-0 px-3 py-2.5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[13px] font-bold truncate text-foreground">
                          {bm.book} {bm.chapter}:{bm.verse}
                        </span>
                        <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1 py-px rounded shrink-0">
                          {bm.translationLabel}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground/60 leading-snug line-clamp-2">{bm.text}</p>
                    </div>
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        setBookmarks(prev => prev.filter(b => b.label !== bm.label))
                      }}
                      title="Remove bookmark"
                      aria-label={`Remove bookmark ${bm.label}`}
                      className="shrink-0 self-center mr-2 w-6 h-6 rounded flex items-center justify-center text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* ── COL 2: Chapters (210px) ── */}
        <div className="w-[210px] shrink-0 border-r border-border flex flex-col overflow-hidden">
          <div className="px-3 pt-3 pb-2.5 border-b border-border shrink-0">
            <div className="text-[15px] font-bold text-foreground truncate">
              {activeBook ?? "Select a book"}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {activeBook ? `${totalChapters} chapter${totalChapters !== 1 ? "s" : ""}` : "—"}
            </div>
          </div>

          {/* Quick chapter jump — only for books with more than 6 chapters */}
          {activeBook && totalChapters > 6 && (
            <div className="px-2.5 py-2 border-b border-border shrink-0">
              <input
                type="number"
                min={1}
                max={totalChapters}
                value={chapterInput}
                onChange={e => setChapterInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    const n = parseInt(chapterInput)
                    if (n >= 1 && n <= totalChapters) selectChapter(n)
                  }
                }}
                placeholder={`Go to ch. 1–${totalChapters}`}
                aria-label={`Go to chapter, 1 through ${totalChapters}`}
                className="w-full h-7 px-2.5 text-[13px] bg-background border border-border rounded focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/30 transition-colors placeholder:text-muted-foreground/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          )}

          {activeBook ? (
            <div className="flex-1 overflow-y-auto p-2.5">
              {/* Row layout for small books (≤6 chapters), grid for larger */}
              {totalChapters <= 6 ? (
                <div className="flex flex-wrap gap-2 content-start">
                  {Array.from({ length: totalChapters }, (_, i) => i + 1).map(ch => (
                    <button
                      key={ch}
                      onClick={() => selectChapter(ch)}
                      className={`h-10 px-4 flex items-center justify-center text-[13px] font-medium rounded-md transition-all ${
                        activeChapter === ch
                          ? "bg-primary text-white font-bold shadow-sm shadow-primary/30"
                          : "bg-accent/50 border border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      {activeChapter === ch && chapterLoading
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : ch}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 content-start">
                  {Array.from({ length: totalChapters }, (_, i) => i + 1).map(ch => (
                    <button
                      key={ch}
                      onClick={() => selectChapter(ch)}
                      className={`aspect-square min-h-[42px] flex items-center justify-center text-[13px] font-medium rounded-md transition-all ${
                        activeChapter === ch
                          ? "bg-primary text-white font-bold shadow-sm shadow-primary/30"
                          : "bg-accent/50 border border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      {activeChapter === ch && chapterLoading
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : ch}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4 gap-2">
              <div className="text-2xl text-muted-foreground/15">①</div>
              <p className="text-xs font-semibold text-muted-foreground/50">Pick a book</p>
              <p className="text-[11px] text-muted-foreground/30 leading-relaxed">
                Select any book from the list on the left to see its chapters here.
              </p>
            </div>
          )}
        </div>

        {/* ── COL 3: Verses + Preview ── */}
        <div className="flex-1 flex overflow-hidden min-w-0">

          {/* Verse list */}
          <div className="flex-1 flex flex-col overflow-hidden border-r border-border">
            {/* Header: ← Book Ch [TranslationPicker] count → */}
            <div className="h-10 shrink-0 border-b border-border flex items-center gap-1.5 px-1.5">
              <button
                onClick={prevChapter}
                disabled={!activeBook || !activeChapter || activeChapter <= 1}
                title="Previous chapter"
                aria-label="Previous chapter"
                className="w-7 h-7 shrink-0 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {activeBook && activeChapter ? (
                <span className="font-bold text-foreground text-sm truncate">{activeBook} {activeChapter}</span>
              ) : (
                <span className="text-sm text-muted-foreground/40 truncate">Select a chapter</span>
              )}
              <div className="ml-auto flex items-center gap-1.5 shrink-0">
                {chapterVerses.length > 0 && (
                  <span className="text-[11px] text-muted-foreground">{chapterVerses.length} v.</span>
                )}
                {/* Translation picker — moved here so it's adjacent to the content it controls */}
                <TranslationPicker
                  translations={availableTranslations}
                  value={translation}
                  onChange={setTranslation}
                  loading={translationsLoading}
                />
                <button
                  onClick={nextChapter}
                  disabled={!activeBook || !activeChapter || activeChapter >= totalChapters}
                  title="Next chapter"
                  aria-label="Next chapter"
                  className="w-7 h-7 shrink-0 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 relative overflow-hidden">
              {chapterLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
              {chapterError && (
                <div role="alert" className="flex flex-col items-center justify-center gap-3 p-8 text-center">
                  <p className="text-sm text-destructive">{chapterError}</p>
                  <button
                    onClick={() => activeBook && activeChapter !== null && doLoadChapter(activeBook, activeChapter)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground border border-border rounded-md px-3 py-1.5 hover:border-border/80 transition-colors"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Try again
                  </button>
                </div>
              )}
              {!chapterLoading && !chapterError && chapterVerses.length === 0 && (
                <div className="flex flex-col items-center justify-center text-center px-8 py-12 gap-2">
                  <div className="text-2xl text-muted-foreground/15">{activeBook ? "②" : "①②"}</div>
                  <p className="text-sm font-medium text-muted-foreground/60">
                    {activeBook ? "Now pick a chapter" : "Pick a book, then a chapter"}
                  </p>
                  <p className="text-[12px] text-muted-foreground/40 leading-relaxed max-w-[200px]">
                    {activeBook
                      ? `Select a chapter from the ${activeBook} panel to read its verses.`
                      : "Use the Books panel on the left to get started."}
                  </p>
                </div>
              )}
              {!chapterLoading && chapterVerses.length > 0 && (
                <div ref={verseListRef} className="h-full overflow-y-auto px-2.5 py-1.5">
                  {chapterVerses.map((verse, idx) => {
                    const isOnScreen    = projectedLabel === `${verse.book_name} ${verse.chapter}:${verse.verse} ${translationLabel}`
                    const isPrimary     = selectedIdx === idx
                    const isInRange     = highlightedVerseNums.size > 0 && highlightedVerseNums.has(verse.verse)
                    const isHighlighted = isInRange || (highlightedVerseNums.size === 0 && isPrimary)
                    // Context: 1-2 verses before the selected one (no range active)
                    const isContext     = highlightedVerseNums.size === 0 && selectedIdx !== null && !isHighlighted && !isOnScreen
                      && (idx === selectedIdx - 1 || idx === selectedIdx - 2) && idx >= 0
                    const bookmarked    = isVerseBookmarked(verse)

                    return (
                      <div
                        key={verse.verse}
                        onClick={() => selectVerse(idx)}
                        onKeyDown={e => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            e.stopPropagation()
                            selectVerse(idx)
                            if (projectionOpen) projectVerseRef.current(chapterVerses[idx])
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        aria-pressed={isPrimary}
                        aria-label={`Verse ${verse.verse}${isOnScreen ? " (live)" : ""}: ${verse.text}`}
                        className={`group flex gap-2.5 px-2.5 py-2.5 rounded-md cursor-pointer transition-colors border min-h-[44px] items-start select-none mb-0.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 ${
                          isOnScreen
                            ? "bg-green-500/8 border-green-500/25"
                            : isPrimary && highlightedVerseNums.size > 0
                              ? "bg-primary/12 border-primary/40"
                              : isHighlighted
                                ? "bg-primary/8 border-primary/30"
                                : isContext
                                  ? "bg-accent/20 border-transparent opacity-55"
                                  : "border-transparent hover:bg-accent/40"
                        }`}
                      >
                        <span className={`text-[13px] font-bold min-w-[22px] pt-0.5 shrink-0 text-right tabular-nums ${
                          isOnScreen ? "text-green-400" : isHighlighted ? "text-primary" : "text-muted-foreground"
                        }`}>
                          {verse.verse}
                        </span>
                        <p className="flex-1 text-[13.5px] leading-[1.7] text-foreground/90">{verse.text}</p>
                        {/* Bookmark star */}
                        <button
                          onClick={e => { e.stopPropagation(); toggleBookmark(verse) }}
                          title={bookmarked ? "Remove bookmark" : "Save verse"}
                          aria-label={bookmarked ? `Remove bookmark for verse ${verse.verse}` : `Save verse ${verse.verse}`}
                          className={`shrink-0 self-start mt-1 w-5 h-5 flex items-center justify-center rounded transition-all ${
                            bookmarked
                              ? "text-yellow-400 opacity-100"
                              : "text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:text-yellow-400"
                          }`}
                        >
                          <Star className="h-3.5 w-3.5" fill={bookmarked ? "currentColor" : "none"} />
                        </button>
                        {isOnScreen && (
                          <span className="shrink-0 text-[9px] font-black text-green-400 self-start mt-1 tracking-wider">LIVE</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Preview + Actions (256px) ── */}
          <div className="w-[256px] shrink-0 flex flex-col overflow-hidden bg-card">

            {/* Live status bar */}
            <div className={`flex items-center gap-2 px-3 py-2 border-b border-border shrink-0 min-h-[38px] ${projectedLabel ? "bg-primary/5" : ""}`}>
              <span className={`h-2 w-2 rounded-full shrink-0 transition-colors ${projectedLabel ? "bg-primary animate-pulse" : "bg-muted-foreground/25"}`} />
              <span className={`text-[10px] font-black uppercase tracking-widest ${projectedLabel ? "text-primary" : "text-muted-foreground/40"}`}>
                {projectedLabel ? "Live Now" : "Not Live"}
              </span>
              {projectedLabel && (
                <span className="ml-auto text-[10px] font-semibold text-muted-foreground truncate max-w-[90px]">
                  {projectedLabel.replace(/ [A-Z]+$/, "")}
                </span>
              )}
            </div>

            {/* Slide preview */}
            <div className="px-3 pt-2.5 pb-2 shrink-0">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[9.5px] font-bold uppercase tracking-widest text-muted-foreground/40">Slide Preview</p>
                <button
                  onClick={() => setShowPreviewModal(true)}
                  title="Expand preview"
                  aria-label="Expand slide preview"
                  disabled={!selectedVerse}
                  className="text-muted-foreground/40 hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                >
                  <Maximize2 className="h-3 w-3" />
                </button>
              </div>
              {renderSlidePreview(previewFontPx)}
              {/* Range position indicator */}
              {rangePosDisplay && (
                <p className="mt-1 text-center text-[10px] font-semibold text-primary">
                  Verse {rangePosDisplay} in range
                </p>
              )}
            </div>

            {/* Project Now button */}
            <div className="px-3 pb-1.5 shrink-0">
              <button
                onClick={handleProjectNow}
                disabled={!selectedVerse || !projectionOpen}
                className={`w-full h-12 rounded-lg font-bold text-[15px] flex items-center justify-center gap-2 transition-all ${
                  isProjected
                    ? "bg-green-600 text-white shadow-md shadow-green-600/30"
                    : selectedVerse && projectionOpen
                      ? "bg-primary text-white shadow-md shadow-primary/30 hover:bg-primary/90 hover:-translate-y-px active:translate-y-0"
                      : "bg-primary/15 text-primary/40 cursor-not-allowed"
                }`}
              >
                {isProjected ? (
                  <><span className="h-2 w-2 rounded-full bg-white animate-pulse" />Live</>
                ) : (
                  <><Play className="h-4 w-4 fill-current" />Project Now</>
                )}
              </button>
            </div>

            {/* Clear Screen — only visible when something is live */}
            {projectedLabel && projectionOpen && (
              <div className="px-3 pb-1.5 shrink-0">
                <button
                  onClick={clearScreen}
                  className="w-full h-8 rounded-lg border border-border text-muted-foreground text-xs font-semibold flex items-center justify-center gap-1.5 hover:border-destructive/40 hover:text-destructive transition-colors"
                >
                  <EyeOff className="h-3.5 w-3.5" />
                  Clear Screen
                </button>
              </div>
            )}

            {!projectionOpen && (
              <p className="text-center text-[10.5px] text-muted-foreground/40 px-3 pb-1">
                Open a projection window to project
              </p>
            )}

            {/* Tip */}
            <div className="px-3 mt-auto pb-3">
              <p className="text-[11px] text-muted-foreground/35 leading-relaxed">{tipText}</p>
            </div>

          </div>
        </div>
      </div>

      {/* ── Footer: live status ── */}
      <div className="h-9 shrink-0 border-t border-border bg-card flex items-center gap-2.5 px-4">
        <span className={`h-1.5 w-1.5 rounded-full shrink-0 transition-colors ${projectedLabel ? "bg-primary animate-pulse" : "bg-muted-foreground/25"}`} />
        <span className={`text-xs font-semibold truncate transition-colors ${projectedLabel ? "text-foreground" : "text-muted-foreground/40"}`}>
          {projectedLabel ?? "Nothing projected"}
        </span>
      </div>

    </div>
  )
}
