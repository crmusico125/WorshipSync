import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  MonitorOff,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Music,
  Pencil,
  Cast,
  Play,
  Pause,
  Square,
  AlertCircle,
  X,
  Image as ImageIcon,
  Timer,
  BookOpen,
  Film,
  Volume2,
  RefreshCw,
  Keyboard,
  Search,
  Calendar,
  Tv,
  Repeat,
  SkipBack,
  SkipForward,
  Megaphone,
  Plus,
  Layers,
  CheckCircle2,
  Circle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

import { useServiceStore, type ServiceDate } from "../../store/useServiceStore";
import LibraryModal from "../../components/LibraryModal";
import BackgroundPickerPanel from "../../components/BackgroundPickerPanel";
import EditLyricsModal from "../../components/EditLyricsModal";
import type { AnnouncementCard } from "../../../../../shared/types";
import { fetchBiblePassage, bibleResultToScriptureRef, FREE_TRANSLATIONS, fetchApiBibleTranslations, type BibleTranslation } from "../../lib/bibleApi";


// ── Audio singleton — survives PresenterDashboard unmounts ───────────────────
const _audio: {
  el: HTMLAudioElement | null;
  ctx: AudioContext | null;
  analyser: AnalyserNode | null;
  path: string | null;
} = { el: null, ctx: null, analyser: null, path: null };

// ── Types ────────────────────────────────────────────────────────────────────

interface Slide {
  lines: string[];
  sectionLabel: string;
  sectionType: string;
  sectionId: number;
  globalIndex: number;
  cards?: AnnouncementCard[];
}

interface LiveSong {
  lineupItemId: number;
  itemType: "song" | "countdown" | "scripture" | "media" | "announcement" | "section";
  songId: number;
  title: string;
  artist: string;
  key: string | null;
  ccliNumber: string | null;
  backgroundPath: string | null;
  mediaPath: string | null;
  themeId: number | null;
  notes: string | null;
  itemStyle: string | null;
  imageScaleMode: 'cover' | 'contain' | 'stretch' | null;
  slides: Slide[];
}

interface ThemeStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  textColor: string;
  textAlign: "left" | "center" | "right";
  textPosition: "top" | "middle" | "bottom";
  overlayOpacity: number;
  textShadowOpacity: number;
  maxLinesPerSlide: number;
  accentColor?: string;
}

function parseAnnouncementCards(raw: string | null | undefined): AnnouncementCard[] {
  if (!raw) return []
  try {
    const p = JSON.parse(raw)
    if (Array.isArray(p?.cards)) return p.cards
  } catch {}
  return raw.split('\n').filter(l => l.trim()).map((l, i) => ({ id: String(i), heading: l.trim() }))
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
};

const SECTION_ABBREVS: Record<string, string> = {
  verse: "V",
  chorus: "C",
  bridge: "B",
  "pre-chorus": "PC",
  intro: "I",
  outro: "O",
  tag: "T",
  interlude: "IL",
  blank: "B",
};

function buildSlidesForSong(
  sections: { id: number; type: string; label: string; lyrics: string }[],
  maxLines = 2,
): Slide[] {
  const slides: Slide[] = [];
  let globalIdx = 0;
  for (const sec of sections) {
    // Split into paragraphs on blank lines — each paragraph boundary forces a new slide
    const paragraphs: string[][] = [];
    let current: string[] = [];
    for (const line of sec.lyrics.split("\n")) {
      if (line.trim() === "") {
        if (current.length > 0) { paragraphs.push(current); current = []; }
      } else {
        current.push(line);
      }
    }
    if (current.length > 0) paragraphs.push(current);

    if (paragraphs.length === 0) {
      // Media/blank slides: create one slide with empty line so background shows
      slides.push({
        lines: [""],
        sectionLabel: sec.label,
        sectionType: sec.type,
        sectionId: sec.id,
        globalIndex: globalIdx++,
      });
      continue;
    }
    for (const para of paragraphs) {
      for (let i = 0; i < para.length; i += maxLines) {
        slides.push({
          lines: para.slice(i, i + maxLines),
          sectionLabel: sec.label,
          sectionType: sec.type,
          sectionId: sec.id,
          globalIndex: globalIdx++,
        });
      }
    }
  }
  slides.push({
    lines: [""],
    sectionLabel: "Blank",
    sectionType: "blank",
    sectionId: -1,
    globalIndex: globalIdx,
  });
  return slides;
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  projectionOpen: boolean;
  onProjectionChange: (open: boolean) => void;
  onExitLive: () => void;
  onSwitchToBuilder?: () => void;
}

export default function PresenterDashboard({
  projectionOpen,
  onProjectionChange,
  onExitLive,
  onSwitchToBuilder,
}: Props) {
  const {
    selectedService,
    lineup,
    loadLineup,
    selectService,
    addSongToLineup,
    addCountdownToLineup,
    addScriptureToLineup,
    addMediaToLineup,
    addAnnouncementToLineup,
    reorderLineup,
    mediaLoopPrefs,
    patchImageScaleMode,
  } = useServiceStore();

  const [liveSongs, setLiveSongs] = useState<LiveSong[]>([]);
  const [selectedSongIdx, setSelectedSongIdx] = useState(0);
  const [activeSlideIdx, setActiveSlideIdx] = useState(-1);
  const [isBlank, setIsBlank] = useState(false);
  const [isLogo, setIsLogo] = useState(false);
  const [isTextCleared, setIsTextCleared] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [confirmEndShow, setConfirmEndShow] = useState(false);
  const confirmEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [themeCache, setThemeCache] = useState<Record<number, any>>({});
  const [defaultTheme, setDefaultTheme] = useState<any>(null);
  const [defaultThemeBg, setDefaultThemeBg] = useState<string | null>(null);
  const defaultScriptureThemeBgRef = useRef<string | null>(null);
  const defaultAnnouncementThemeBgRef = useRef<string | null>(null);
  const [imgScaleMode, setImgScaleMode] = useState<'cover' | 'contain' | 'stretch'>('contain');
  const [showLibrary, setShowLibrary] = useState(false);
  const [insertAfterSectionId, setInsertAfterSectionId] = useState<number | null>(null);
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [pendingBgSave, setPendingBgSave] = useState<{ songId: number; lineupItemId: number; itemType: string; path: string | null } | null>(null);
  const [savingBg, setSavingBg] = useState(false);
  const [showEditLyrics, setShowEditLyrics] = useState(false);
  const [editLyricsInitial, setEditLyricsInitial] = useState("");
  const [displays, setDisplays] = useState<
    {
      id: number;
      label: string;
      width: number;
      height: number;
      isPrimary: boolean;
    }[]
  >([]);
  const [selectedDisplayId, setSelectedDisplayId] = useState<
    number | undefined
  >(undefined);
  const [confidenceOpen, setConfidenceOpen] = useState(false);
  const [selectedConfidenceDisplayId, setSelectedConfidenceDisplayId] = useState<number | undefined>(undefined);
  const [outputBarCollapsed, setOutputBarCollapsed] = useState(false);
  const slideGridRef    = useRef<HTMLDivElement>(null);
  const liveItemIdxRef  = useRef<number>(-1);
  const liveSlideIdxRef = useRef<number>(-1);
  const liveImgScaleModeRef = useRef<'cover' | 'contain' | 'stretch'>('contain');
  const triggerAudioPlayRef  = useRef<(() => void) | null>(null);
  const triggerAudioPauseRef = useRef<(() => void) | null>(null);
  const pendingAudioPlayRef  = useRef<number | null>(null);
  const triggerVideoPlayRef   = useRef<(() => void) | null>(null);
  const triggerVideoResumeRef = useRef<(() => void) | null>(null);
  const triggerVideoPauseRef  = useRef<(() => void) | null>(null);
  const pendingVideoPlayRef   = useRef<number | null>(null);

  // ── Scripture picker ─────────────────────────────────────────────────────


  // ── Run-of-show inline search ────────────────────────────────────────────
  const [rosSearch, setRosSearch] = useState("")
  const [rosResults, setRosResults] = useState<{ id: number; title: string; artist: string }[]>([])
  const rosSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Quick-add scripture ──────────────────────────────────────────────────
  const [scriptureQuery, setScriptureQuery] = useState("")
  const [scriptureTranslation, setScriptureTranslation] = useState("web")
  const [scriptureQueryLoading, setScriptureQueryLoading] = useState(false)
  const [scriptureQueryError, setScriptureQueryError] = useState<string | null>(null)
  const [bibleApiKey, setBibleApiKey] = useState<string | null>(null)
  const [availableTranslations, setAvailableTranslations] = useState<BibleTranslation[]>(FREE_TRANSLATIONS)
  const [recentScriptures, setRecentScriptures] = useState<{ query: string; translationId: string; translationLabel: string; reference: string }[]>([])
  const autoProjectRef = useRef(false)

  useEffect(() => {
    let lastTranslationId: string | null = null
    window.worshipsync.appState.get().then((state: Record<string, unknown>) => {
      if (typeof state.lastBibleTranslation === 'string') lastTranslationId = state.lastBibleTranslation
      if (Array.isArray(state.recentScriptures)) setRecentScriptures(state.recentScriptures as typeof recentScriptures)
    }).catch(() => {})

    window.worshipsync.appState.getBibleApiKey().then(async key => {
      setBibleApiKey(key)
      if (key) {
        try {
          const keyed = await fetchApiBibleTranslations(key)
          const keyedLabels = new Set(keyed.map(t => t.label))
          const free = FREE_TRANSLATIONS.filter(t => !keyedLabels.has(t.label.toUpperCase()))
          const all = [...keyed, ...free]
          setAvailableTranslations(all)
          // Restore last used translation, fall back to NIV then web
          if (lastTranslationId && all.some(t => t.id === lastTranslationId)) {
            setScriptureTranslation(lastTranslationId)
          } else {
            const niv = keyed.find(t => t.label === 'NIV')
            if (niv) setScriptureTranslation(niv.id)
          }
        } catch {
          // Fall back to free translations
        }
      } else if (lastTranslationId && FREE_TRANSLATIONS.some(t => t.id === lastTranslationId)) {
        setScriptureTranslation(lastTranslationId)
      }
    }).catch(() => {})
  }, [])

  const handleRosSearch = useCallback((q: string) => {
    setRosSearch(q)
    if (rosSearchTimer.current) clearTimeout(rosSearchTimer.current)
    if (!q.trim()) { setRosResults([]); return }
    rosSearchTimer.current = setTimeout(async () => {
      const results = await window.worshipsync.songs.search(q)
      setRosResults(results as { id: number; title: string; artist: string }[])
    }, 200)
  }, [])

  async function handleScriptureQuickAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!scriptureQuery.trim() || scriptureQueryLoading) return
    setScriptureQueryLoading(true)
    setScriptureQueryError(null)
    try {
      const result = await fetchBiblePassage(scriptureQuery.trim(), scriptureTranslation, bibleApiKey)
      await refreshDefaultScriptureBg()
      const prevLen = useServiceStore.getState().lineup.length
      await addScriptureToLineup({ title: result.reference, scriptureRef: bibleResultToScriptureRef(result) })
      const translationLabel = availableTranslations.find(t => t.id === scriptureTranslation)?.label ?? scriptureTranslation.toUpperCase()
      const entry = { query: scriptureQuery.trim(), translationId: scriptureTranslation, translationLabel, reference: result.reference }
      const updated = [entry, ...recentScriptures.filter(r => r.query !== entry.query || r.translationId !== entry.translationId)].slice(0, 5)
      setRecentScriptures(updated)
      window.worshipsync.appState.set({ lastBibleTranslation: scriptureTranslation, recentScriptures: updated }).catch(() => {})
      setScriptureQuery("")
      autoProjectRef.current = true
      setSelectedSongIdx(prevLen)
    } catch (err) {
      setScriptureQueryError(err instanceof Error ? err.message : 'Not found')
    } finally {
      setScriptureQueryLoading(false)
    }
  }

  // ── Service switcher ─────────────────────────────────────────────────────
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [switcherSearch, setSwitcherSearch] = useState("");
  const [recentServices, setRecentServices] = useState<ServiceDate[]>([]);
  const [switcherResults, setSwitcherResults] = useState<ServiceDate[]>([]);
  const switcherSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Countdown state
  const [countdownRunning, setCountdownRunning] = useState(false);
  const [countdownDisplay, setCountdownDisplay] = useState("00:00:00");
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoLoop, setVideoLoop] = useState(false);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const videoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const videoTimerStoppedAtRef = useRef<number | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioLoop, setAudioLoop] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vizFrameRef = useRef<number | null>(null);
  const [waveformBars, setWaveformBars] = useState<number[]>(new Array(64).fill(0));
  const [serviceTime, setServiceTime] = useState("11:00");
  const [serviceTimezone, setServiceTimezone] = useState("America/Los_Angeles");
  const [serviceSchedules, setServiceSchedules] = useState<Array<{
    id: string; dayOfWeek: number; startTime: string; endTime: string;
    label: string; timezone?: string;
  }>>([]);
  const [projectionFontSize, setProjectionFontSize] = useState(48);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  // Live runtime timer
  const liveStartRef = useRef<number>(0);
  const [liveRuntime, setLiveRuntime] = useState("00:00:00");

  // ── Load ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (selectedService) loadLineup(selectedService.id);
    window.worshipsync.window.getDisplays().then((d) => {
      setDisplays(d);
      const ext = d.find((x) => !x.isPrimary);
      setSelectedDisplayId(ext?.id ?? d[0]?.id);
      setSelectedConfidenceDisplayId(ext?.id ?? d[0]?.id);
    });
    window.worshipsync.themes.getDefault().then((t: any) => {
      setDefaultTheme(t);
      if (t?.settings) {
        try {
          const s = JSON.parse(t.settings);
          setDefaultThemeBg(s.backgroundPath ?? null);
          defaultScriptureThemeBgRef.current = s.scriptureBackgroundPath ?? null;
          defaultAnnouncementThemeBgRef.current = s.announcementBackgroundPath ?? null;
        } catch {}
      }
    });
    window.worshipsync.themes.getAll().then((all: any[]) => {
      const c: Record<number, any> = {};
      all.forEach((t) => {
        c[t.id] = t;
      });
      setThemeCache(c);
    });
    // Load service time settings
    window.worshipsync.appState
      .get()
      .then((state: Record<string, any>) => {
        if (state.serviceTime)      setServiceTime(state.serviceTime);
        if (state.serviceTimezone)  setServiceTimezone(state.serviceTimezone);
        if (state.serviceSchedules) setServiceSchedules(state.serviceSchedules);
        if (state.projectionFontSize) setProjectionFontSize(state.projectionFontSize);
      })
      .catch(() => {});

    const cleanupDisplays = window.worshipsync.window.onDisplaysChanged((d) => {
      setDisplays(d);
      setSelectedDisplayId((prev) => {
        if (prev !== undefined && d.find((x) => x.id === prev)) return prev;
        return d.find((x) => !x.isPrimary)?.id ?? d[0]?.id;
      });
    });

    // Check if confidence window is already open (e.g. survived a navigation)
    window.worshipsync.confidence.isOpen().then((open) => setConfidenceOpen(open)).catch(() => {});

    const cleanupConfidence = window.worshipsync.confidence.onClosed(() => {
      setConfidenceOpen(false);
    });

    return () => {
      cleanupDisplays();
      cleanupConfidence();
    };
  }, []);

  // ── Build live songs ─────────────────────────────────────────────────────
  useEffect(() => {
    const built: LiveSong[] = lineup.map((item) => {
      if (item.itemType === "section") {
        return {
          lineupItemId: item.id,
          itemType: "section" as const,
          songId: 0,
          title: item.title ?? "Section",
          artist: "",
          key: null,
          ccliNumber: null,
          backgroundPath: null,
          mediaPath: null,
          themeId: null,
          notes: null,
          itemStyle: null,
          imageScaleMode: null,
          slides: [],
        };
      }
      if (item.itemType === "countdown") {
        return {
          lineupItemId: item.id,
          itemType: "countdown" as const,
          songId: 0,
          title: "Countdown Timer",
          artist: "",
          key: null,
          ccliNumber: null,
          backgroundPath: null,
          mediaPath: null,
          themeId: null,
          notes: item.notes ?? null,
          itemStyle: null,
          imageScaleMode: null,
          slides: [],
        };
      }

      // First-class scripture items — build slides from parsed verses
      if (item.itemType === "scripture") {
        let verses: { label: string; text: string }[] = [];
        try { verses = JSON.parse(item.scriptureRef ?? "{}").verses ?? []; } catch {}
        let globalIdx = 0;
        const scriptureSlides: Slide[] = verses.map(v => ({
          lines: [v.text],
          sectionLabel: v.label,
          sectionType: "verse",
          sectionId: globalIdx,
          globalIndex: globalIdx++,
        }));
        scriptureSlides.push({ lines: [""], sectionLabel: "Blank", sectionType: "blank", sectionId: -1, globalIndex: globalIdx });
        return {
          lineupItemId: item.id,
          itemType: "scripture" as const,
          songId: 0,
          title: item.title ?? "Scripture",
          artist: "",
          key: null,
          ccliNumber: null,
          backgroundPath: item.overrideBackgroundPath ?? null,
          mediaPath: null,
          themeId: null,
          notes: item.notes ?? null,
          itemStyle: null,
          imageScaleMode: null,
          slides: scriptureSlides,
        };
      }

      // Announcement items — single slide built from structured event cards
      if (item.itemType === "announcement") {
        const cards = parseAnnouncementCards(item.scriptureRef)
        const lines = cards.length
          ? [item.title ?? '', ...cards.map(c =>
              [c.heading, [c.day, c.time].filter(Boolean).join(' '), c.location, c.description].filter(Boolean).join(' — ')
            )]
          : ['']
        const announcementSlides: Slide[] = cards.length ? [{
          lines, cards,
          sectionLabel: "Announcement",
          sectionType: "announcement",
          sectionId: 0,
          globalIndex: 0,
        }] : [];
        announcementSlides.push({ lines: [""], sectionLabel: "Blank", sectionType: "blank", sectionId: -1, globalIndex: announcementSlides.length });
        return {
          lineupItemId: item.id,
          itemType: "announcement" as const,
          songId: 0,
          title: item.title ?? "Announcement",
          artist: "",
          key: null,
          ccliNumber: null,
          backgroundPath: item.overrideBackgroundPath ?? null,
          mediaPath: null,
          themeId: null,
          notes: item.notes ?? null,
          itemStyle: item.itemStyle ?? null,
          imageScaleMode: null,
          slides: announcementSlides,
        };
      }

      // First-class media items — no slides
      if (item.itemType === "media") {
        return {
          lineupItemId: item.id,
          itemType: "media" as const,
          songId: 0,
          title: item.title ?? "Media",
          artist: "",
          key: null,
          ccliNumber: null,
          backgroundPath: null,
          mediaPath: item.mediaPath ?? null,
          themeId: null,
          notes: item.notes ?? null,
          itemStyle: null,
          imageScaleMode: (item.imageScaleMode as 'cover' | 'contain' | 'stretch') ?? 'contain',
          slides: [],
        };
      }

      // Skip items with missing song data
      if (!item.song) {
        return {
          lineupItemId: item.id,
          itemType: "song" as const,
          songId: 0,
          title: "Unknown",
          artist: "",
          key: null,
          ccliNumber: null,
          backgroundPath: null,
          mediaPath: null,
          themeId: null,
          notes: item.notes ?? null,
          itemStyle: null,
          imageScaleMode: null,
          slides: [],
        };
      }

      let filtered = item.song.sections;
      if (item.sectionOrder) {
        try {
          const ids: number[] = JSON.parse(item.sectionOrder);
          const reordered = ids.map(id => filtered.find(s => s.id === id)).filter(Boolean) as typeof filtered;
          if (reordered.length === filtered.length) filtered = reordered;
        } catch {}
      }

      // Resolve per-song maxLinesPerSlide from theme
      let maxLines = DEFAULT_THEME.maxLinesPerSlide;
      const songThemeId = item.song.themeId;
      if (songThemeId && themeCache[songThemeId]?.settings) {
        try {
          const parsed = JSON.parse(themeCache[songThemeId].settings);
          if (parsed.maxLinesPerSlide) maxLines = parsed.maxLinesPerSlide;
        } catch {}
      }

      return {
        lineupItemId: item.id,
        itemType: "song" as const,
        songId: item.song.id,
        title: item.song.title,
        artist: item.song.artist ?? "",
        key: item.song.key ?? null,
        ccliNumber: item.song.ccliNumber ?? null,
        backgroundPath: item.overrideBackgroundPath ?? item.song.backgroundPath ?? null,
        mediaPath: null,
        themeId: item.song.themeId ?? null,
        notes: item.notes ?? null,
        itemStyle: null,
        imageScaleMode: null,
        slides: buildSlidesForSong(filtered, maxLines),
      };
    });
    setLiveSongs(built);
  }, [lineup, themeCache]);


  // ── Theme + background resolution ────────────────────────────────────────
  const resolveTheme = useCallback(
    (song: LiveSong): ThemeStyle => {
      const t =
        (song.themeId ? themeCache[song.themeId] : null) ?? defaultTheme;
      let base = DEFAULT_THEME;
      if (t?.settings) {
        try {
          base = { ...DEFAULT_THEME, ...JSON.parse(t.settings) };
        } catch {}
      }
      return base;
    },
    [themeCache, defaultTheme],
  );

  const resolveBg = useCallback(
    (song: LiveSong): string | undefined => {
      if (song.backgroundPath) return song.backgroundPath;
      const isScripture = song.itemType === "scripture";
      const isAnnouncement = song.itemType === "announcement";
      if (song.themeId && themeCache[song.themeId]) {
        try {
          const s = JSON.parse(themeCache[song.themeId].settings);
          if (isScripture && s.scriptureBackgroundPath) return s.scriptureBackgroundPath;
          if (isAnnouncement && s.announcementBackgroundPath) return s.announcementBackgroundPath;
          return s.backgroundPath ?? undefined;
        } catch {}
      }
      if (isScripture && defaultScriptureThemeBgRef.current) return defaultScriptureThemeBgRef.current;
      if (isAnnouncement && defaultAnnouncementThemeBgRef.current) return defaultAnnouncementThemeBgRef.current;
      return defaultThemeBg ?? undefined;
    },
    [themeCache, defaultThemeBg],
  );

  // Sync lineup + resolved bg/theme to PWA controller after every liveSongs/selection change.
  // Placed after resolveTheme/resolveBg so they are in scope.
  useEffect(() => {
    const items = liveSongs.map(s => ({
      id: s.lineupItemId,
      itemType: s.itemType,
      title: s.title,
      mediaPath: s.mediaPath,
      backgroundPath: resolveBg(s) ?? null,
      theme: (() => {
        const t = resolveTheme(s)
        return {
          ...t,
          // Match sendSlide logic: use display-calibrated size when theme uses the default
          fontSize: t.fontSize !== DEFAULT_THEME.fontSize ? t.fontSize : projectionFontSize,
        } as unknown as Record<string, unknown>
      })(),
      imageScaleMode: s.imageScaleMode ?? null,
      mediaSubtype: s.itemType === 'media'
        ? (/\.(mp4|webm|mov)$/i.test(s.mediaPath ?? '') ? 'video' as const
          : /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(s.mediaPath ?? '') ? 'audio' as const
          : 'image' as const)
        : null,
      slides: s.slides.map((sl, idx) => ({
        idx,
        sectionLabel: sl.sectionLabel,
        sectionType: sl.sectionType,
        lines: sl.lines,
        ...(sl.cards ? { cards: sl.cards } : {}),
      })),
    }))
    window.worshipsync.pwa?.syncLineup?.(items, selectedSongIdx, selectedService?.date ?? null, serviceTime)
  }, [liveSongs, selectedSongIdx, resolveTheme, resolveBg, selectedService, serviceTime, projectionFontSize])

  // ── Slide projection ─────────────────────────────────────────────────────
  const sendSlide = useCallback(
    (songIdx: number, slideIdx: number) => {
      const song = liveSongs[songIdx];
      if (!song) return;
      const slide = song.slides[slideIdx];
      if (!slide) return;
      const baseTheme = resolveTheme(song);
      const itemStyleOverride = song.itemStyle ? (() => { try { return JSON.parse(song.itemStyle); } catch { return {}; } })() : {};
      const theme = { ...baseTheme, ...itemStyleOverride };
      const bg = resolveBg(song);
      setSelectedSongIdx(songIdx);
      setActiveSlideIdx(slideIdx);
      setIsBlank(false);
      setIsLogo(false);
      setIsTextCleared(false);
      if (countdownRunningRef.current) {
        setCountdownRunning(false);
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      }
      // Record what's actually live so Run-of-Show navigation can restore it
      liveItemIdxRef.current  = songIdx;
      liveSlideIdxRef.current = slideIdx;

      // Compute next slide for stage display / confidence monitor.
      // Skip terminal blank slides so the "next" preview is always real content.
      let nextLines: string[] | undefined;
      let nextSectionLabel: string | undefined;
      let nextItemType: string | undefined;
      const isRealSlide = (s: { sectionType: string; lines: string[] }) =>
        s.sectionType !== "blank" && s.lines.filter(Boolean).length > 0;
      const nextSlideInSong = song.slides.slice(slideIdx + 1).find(isRealSlide);
      if (nextSlideInSong) {
        nextLines = nextSlideInSong.lines;
        nextSectionLabel = nextSlideInSong.sectionLabel;
        nextItemType = song.itemType;
      }
      if (!nextLines) {
        // Cross-item: skip items with no real content (e.g. empty notes, section dividers)
        for (let k = songIdx + 1; k < liveSongs.length; k++) {
          const firstReal = liveSongs[k].slides.find(isRealSlide);
          if (firstReal) {
            nextLines = firstReal.lines;
            nextSectionLabel = `${liveSongs[k].title} \u2014 ${firstReal.sectionLabel}`;
            nextItemType = liveSongs[k].itemType;
            break;
          }
        }
      }

      if (slide.sectionType === "blank") {
        window.worshipsync.slide.blank(true, { lineupItemId: song.lineupItemId, slideIndex: slide.globalIndex });
        // Keep the stage display "next" section current even while the screen is blank
        if (nextLines?.length) {
          window.worshipsync.slide.stageNext({
            nextLines,
            nextSectionLabel: nextSectionLabel ?? "",
            nextItemType,
          });
        }
        setIsBlank(true);
      } else {
        window.worshipsync.slide.blank(false);
        window.worshipsync.slide.logo(false);
        window.worshipsync.slide.show({
          lines: slide.lines,
          songTitle: song.title,
          artist: song.artist,
          sectionLabel: slide.sectionLabel,
          sectionType: slide.sectionType,
          itemType: song.itemType,
          slideIndex: slide.globalIndex,
          totalSlides: song.slides.length,
          lineupItemId: song.lineupItemId,
          backgroundPath: bg,
          nextLines,
          nextSectionLabel,
          nextItemType,
          announcementCards: slide.cards,
          theme: {
            fontFamily: theme.fontFamily,
            fontSize:
              theme.fontSize !== DEFAULT_THEME.fontSize
                ? theme.fontSize
                : projectionFontSize,
            fontWeight: theme.fontWeight,
            textColor: theme.textColor,
            textAlign: theme.textAlign,
            textPosition: theme.textPosition,
            overlayOpacity: theme.overlayOpacity,
            textShadowOpacity: theme.textShadowOpacity,
            maxLinesPerSlide: theme.maxLinesPerSlide,
            accentColor: theme.accentColor,
          },
        });
        // Explicitly broadcast next lines so the confidence monitor receives them
        // via its dedicated stageNext listener (belt-and-suspenders alongside the payload)
        window.worshipsync.slide.stageNext({
          nextLines: nextLines ?? [],
          nextSectionLabel: nextSectionLabel ?? "",
          nextItemType,
        });
      }
    },
    [liveSongs, resolveTheme, resolveBg, projectionFontSize],
  );

  // Refs that always hold the latest projection state — used inside the
  // projection:ready callback so display moves restore the correct content.
  const countdownRunningRef = useRef(countdownRunning);
  countdownRunningRef.current = countdownRunning;
  const startCountdownRef = useRef<(() => void) | null>(null);
  const stopCountdownRef  = useRef<(() => void) | null>(null);
  const isBlankRef = useRef(isBlank);
  isBlankRef.current = isBlank;
  const isLogoRef = useRef(isLogo);
  isLogoRef.current = isLogo;
  const activeSlideIdxRef = useRef(activeSlideIdx);
  activeSlideIdxRef.current = activeSlideIdx;
  const selectedSongIdxRef = useRef(selectedSongIdx);
  selectedSongIdxRef.current = selectedSongIdx;

  // ── Controls ─────────────────────────────────────────────────────────────
  const clearAll = useCallback(() => {
    window.worshipsync.slide.blank(true);
    setIsBlank(true);
    setIsLogo(false);
    setIsTextCleared(false);
    setActiveSlideIdx(-1);
  }, []);
  const clearText = useCallback(() => {
    if (isTextCleared) {
      // Restore — re-send the active slide
      if (activeSlideIdx >= 0) sendSlide(selectedSongIdx, activeSlideIdx);
      setIsTextCleared(false);
      return;
    }
    const song = liveSongs[selectedSongIdx];
    if (!song) {
      window.worshipsync.slide.blank(true);
      setIsBlank(true);
      return;
    }
    const currentSlide = song.slides[activeSlideIdx];
    // Blank-type slides have no text to clear — blank the screen instead
    if (currentSlide?.sectionType === "blank") {
      window.worshipsync.slide.blank(true);
      setIsBlank(true);
      return;
    }
    const theme = resolveTheme(song);
    const bg = resolveBg(song);
    window.worshipsync.slide.blank(false);
    window.worshipsync.slide.logo(false);
    window.worshipsync.slide.show({
      lines: [],
      songTitle: song.title,
      artist: song.artist,
      sectionLabel: currentSlide?.sectionLabel ?? "",
      slideIndex: currentSlide?.globalIndex ?? 0,
      totalSlides: song.slides.length,
      backgroundPath: bg,
      theme: {
        fontFamily: theme.fontFamily,
        fontSize: theme.fontSize !== DEFAULT_THEME.fontSize ? theme.fontSize : projectionFontSize,
        fontWeight: theme.fontWeight,
        textColor: theme.textColor,
        textAlign: theme.textAlign,
        textPosition: theme.textPosition,
        overlayOpacity: theme.overlayOpacity,
        textShadowOpacity: theme.textShadowOpacity,
        maxLinesPerSlide: theme.maxLinesPerSlide,
      },
    });
    setIsBlank(false);
    setIsLogo(false);
    setIsTextCleared(true);
  }, [isTextCleared, activeSlideIdx, selectedSongIdx, liveSongs, sendSlide, resolveTheme, resolveBg, projectionFontSize]);
  const toBlack = useCallback(() => {
    window.worshipsync.slide.blank(true);
    setIsBlank(true);
    setIsLogo(false);
    setIsTextCleared(false);
  }, []);
  const showLogo = useCallback(() => {
    window.worshipsync.slide.logo(true);
    setIsBlank(false);
    setIsLogo(true);
    setIsTextCleared(false);
  }, []);

  // Auto-project first slide after scripture quick-add
  useEffect(() => {
    if (!autoProjectRef.current) return
    const song = liveSongs[selectedSongIdx]
    if (song?.itemType === 'scripture' && song.slides?.length > 0) {
      autoProjectRef.current = false
      sendSlide(selectedSongIdx, 0)
    }
  }, [selectedSongIdx, liveSongs, sendSlide])

  const jumpToItem = useCallback((idx: number) => {
    const item = liveSongs[idx];
    if (!item) return;
    // Items without slides (countdown, media, etc.) just select via state
    if (!item.slides || item.slides.length === 0) {
      setSelectedSongIdx(idx);
      setActiveSlideIdx(-1);
    } else {
      sendSlide(idx, 0);
    }
  }, [liveSongs, sendSlide]);

  // ── Audio viz (component-level so they survive song switches / remounts) ───
  const stopViz = useCallback(() => {
    if (vizFrameRef.current) { cancelAnimationFrame(vizFrameRef.current); vizFrameRef.current = null; }
    setWaveformBars(new Array(64).fill(0));
  }, []);

  const startViz = useCallback(() => {
    if (!analyserRef.current) return;
    const analyser = analyserRef.current;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      setWaveformBars(Array.from({ length: 64 }, (_, ii) => {
        const idx = Math.floor((ii / 64) * data.length);
        return data[idx] / 255;
      }));
      vizFrameRef.current = requestAnimationFrame(tick);
    };
    vizFrameRef.current = requestAnimationFrame(tick);
  }, []);

  const goNextSong = useCallback(() => {
    // Skip section headers when navigating
    let next = selectedSongIdx + 1;
    while (next < liveSongs.length && liveSongs[next]?.itemType === "section") next++;
    if (next < liveSongs.length) jumpToItem(next);
  }, [selectedSongIdx, liveSongs, jumpToItem]);

  const goPrevSong = useCallback(() => {
    let prev = selectedSongIdx - 1;
    while (prev >= 0 && liveSongs[prev]?.itemType === "section") prev--;
    if (prev >= 0) jumpToItem(prev);
  }, [selectedSongIdx, liveSongs, jumpToItem]);

  const goPrevSlide = useCallback(() => {
    const prev = activeSlideIdx - 1;
    if (prev >= 0) sendSlide(selectedSongIdx, prev);
  }, [activeSlideIdx, selectedSongIdx, sendSlide]);

  const goNextSlide = useCallback(() => {
    const song = liveSongs[selectedSongIdx];
    if (!song) return;
    const next = activeSlideIdx + 1;
    if (next < song.slides.length) sendSlide(selectedSongIdx, next);
    else goNextSong();
  }, [activeSlideIdx, selectedSongIdx, liveSongs, sendSlide, goNextSong]);

  // Sync imgScaleMode toggle from the lineup item when the selected item changes.
  // Only updates UI state — liveImgScaleModeRef tracks what was last *projected*
  // and is only written in showImage().
  useEffect(() => {
    const song = liveSongs[selectedSongIdx];
    if (song?.itemType === "media") {
      setImgScaleMode(song.imageScaleMode ?? 'contain');
    }
  }, [selectedSongIdx, liveSongs]);

  const startLive = () => {
    window.worshipsync.window.openProjection(selectedDisplayId);
    onProjectionChange(true);
  };

  const endShow = () => {
    if (!confirmEndShow) {
      setConfirmEndShow(true);
      confirmEndTimer.current = setTimeout(() => setConfirmEndShow(false), 3000);
      return;
    }
    if (confirmEndTimer.current) clearTimeout(confirmEndTimer.current);
    setConfirmEndShow(false);
    // Stop video
    if (videoPreviewRef.current) { videoPreviewRef.current.pause(); videoPreviewRef.current.currentTime = 0; }
    if (videoTimerRef.current) { clearInterval(videoTimerRef.current); videoTimerRef.current = null; }
    setVideoPlaying(false); setVideoCurrentTime(0); setVideoDuration(0); setVideoLoop(false);
    // Stop audio and tear down singleton
    if (_audio.el) { _audio.el.pause(); _audio.el = null; }
    if (_audio.ctx) { _audio.ctx.close(); _audio.ctx = null; }
    _audio.analyser = null; _audio.path = null;
    audioRef.current = null; audioContextRef.current = null; analyserRef.current = null;
    if (audioTimerRef.current) { clearInterval(audioTimerRef.current); audioTimerRef.current = null; }
    stopViz();
    setAudioPlaying(false); setAudioCurrentTime(0); setAudioDuration(0);
    window.worshipsync.slide.blank(true);
    window.worshipsync.window.closeProjection();
    window.worshipsync.stageDisplay.sessionEnd().catch(() => {});
    onProjectionChange(false);
    onExitLive();
  };

  // ── Switcher callbacks ───────────────────────────────────────────────────
  const [pendingSwitch, setPendingSwitch] = useState<ServiceDate | null>(null);

  const openSwitcher = useCallback(async () => {
    const recent = await window.worshipsync.services.getRecent();
    setRecentServices(recent);
    setSwitcherSearch("");
    setSwitcherResults([]);
    setPendingSwitch(null);
    setShowSwitcher(true);
  }, []);

  const handleSwitcherSearch = useCallback((q: string) => {
    setSwitcherSearch(q);
    setPendingSwitch(null);
    if (switcherSearchTimer.current) clearTimeout(switcherSearchTimer.current);
    if (!q.trim()) {
      setSwitcherResults([]);
      return;
    }
    switcherSearchTimer.current = setTimeout(async () => {
      const results = await window.worshipsync.services.search(q);
      setSwitcherResults(results);
    }, 300);
  }, []);

  const requestSwitch = useCallback((svc: ServiceDate) => {
    if (svc.id === selectedService?.id) return;
    setPendingSwitch(svc);
  }, [selectedService]);

  const confirmSwitch = useCallback(async () => {
    if (!pendingSwitch) return;
    await selectService(pendingSwitch);
    setSelectedSongIdx(0);
    setActiveSlideIdx(-1);
    setShowSwitcher(false);
    setPendingSwitch(null);
  }, [pendingSwitch, selectService]);


  const refreshDefaultScriptureBg = async () => {
    const t = await window.worshipsync.themes.getDefault() as any;
    if (t?.settings) {
      try {
        const s = JSON.parse(t.settings);
        defaultScriptureThemeBgRef.current = s.scriptureBackgroundPath ?? null;
        defaultAnnouncementThemeBgRef.current = s.announcementBackgroundPath ?? null;
      } catch {}
    }
  };

  const repositionAfterSection = async (sectionLineupItemId: number, prevLen: number) => {
    const fresh = useServiceStore.getState().lineup;
    if (fresh.length <= prevLen) return;
    // Find the section by its stable lineupItemId — immune to index drift
    const sectionIdx = fresh.slice(0, prevLen).findIndex(item => item.id === sectionLineupItemId);
    if (sectionIdx === -1) return;
    let insertAfterPos = sectionIdx;
    for (let j = sectionIdx + 1; j < prevLen; j++) {
      if (fresh[j].itemType === "section") break;
      insertAfterPos = j;
    }
    const newIds = fresh.slice(prevLen).map(item => item.id);
    const before  = fresh.slice(0, prevLen).map(item => item.id);
    before.splice(insertAfterPos + 1, 0, ...newIds);
    await reorderLineup(before);
  };

  const handleLibraryAdd = async (songIds: number[]) => {
    const prevLen = useServiceStore.getState().lineup.length;
    for (const id of songIds) await addSongToLineup(id);
    if (insertAfterSectionId !== null) await repositionAfterSection(insertAfterSectionId, prevLen);
  };

  const handleAddScripture = async (
    title: string,
    verses: { number: number; text: string }[],
    ref: { book: string; chapter: number; translation: string },
  ) => {
    const scriptureRef = JSON.stringify({
      verses: verses.map(v => ({
        label: `${ref.book} ${ref.chapter}:${v.number} ${ref.translation}`,
        text: v.text,
      }))
    });
    await refreshDefaultScriptureBg();
    const prevLen = useServiceStore.getState().lineup.length;
    await addScriptureToLineup({ title, scriptureRef });
    if (insertAfterSectionId !== null) await repositionAfterSection(insertAfterSectionId, prevLen);
  };

  const handleAddMedia = async (path: string) => {
    const filename = path.split("/").pop() ?? "Media";
    const isVideo = /\.(mp4|webm|mov)$/i.test(path);
    const isAudio = /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(path);
    const label = isVideo ? "Video" : isAudio ? "Audio" : "Image";
    const prevLen = useServiceStore.getState().lineup.length;
    await addMediaToLineup({ title: `${label}: ${filename}`, mediaPath: path });
    if (insertAfterSectionId !== null) await repositionAfterSection(insertAfterSectionId, prevLen);
  };

  // ── Background picker ────────────────────────────────────────────────────
  const handleBackgroundSelect = useCallback(async (bg: string | null) => {
    const song = liveSongs[selectedSongIdx];
    if (!song) return;
    // Apply immediately to the live session
    setLiveSongs(prev => prev.map((s, i) =>
      i === selectedSongIdx ? { ...s, backgroundPath: bg } : s
    ));
    if (song.itemType === 'scripture') {
      // Scripture items save directly to the lineup item — no "session only" concept
      await window.worshipsync.lineup.setOverrideBg(song.lineupItemId, bg);
      if (selectedService) await loadLineup(selectedService.id);
      setShowBgPicker(false);
    } else {
      setPendingBgSave({ songId: song.songId, lineupItemId: song.lineupItemId, itemType: song.itemType, path: bg });
    }
  }, [liveSongs, selectedSongIdx, selectedService, loadLineup]);

  const handleSaveBg = useCallback(async () => {
    if (!pendingBgSave) return;
    setSavingBg(true);
    try {
      await window.worshipsync.backgrounds.setBackground(pendingBgSave.songId, pendingBgSave.path);
      setPendingBgSave(null);
      setShowBgPicker(false);
    } finally {
      setSavingBg(false);
    }
  }, [pendingBgSave]);

  // ── Edit lyrics ──────────────────────────────────────────────────────────
  const handleOpenEditLyrics = useCallback(async () => {
    const song = liveSongs[selectedSongIdx];
    if (!song) return;
    const full = await window.worshipsync.songs.getById(song.songId);
    if (!full) return;
    const raw = full.sections.map((s: { label: string; lyrics: string }) => `[${s.label}]\n${s.lyrics}`).join("\n\n");
    setEditLyricsInitial(raw);
    setShowEditLyrics(true);
  }, [liveSongs, selectedSongIdx]);

  const handleSaveLyrics = useCallback(async (lyrics: string) => {
    const song = liveSongs[selectedSongIdx];
    if (!song) return;
    const full = await window.worshipsync.songs.getById(song.songId);
    if (!full) return;
    // Parse sections from the edited text and upsert
    const sections: { type: string; label: string; lyrics: string; orderIndex: number }[] = [];
    const blocks = lyrics.split(/\n(?=\[)/);
    blocks.forEach((block, i) => {
      const match = block.match(/^\[([^\]]+)\]\n?([\s\S]*)$/);
      if (!match) return;
      const label = match[1].trim();
      const sectionLyrics = match[2].trimEnd();
      const existing = full.sections.find((s: { label: string; type: string }) => s.label === label);
      sections.push({ type: existing?.type ?? "verse", label, lyrics: sectionLyrics, orderIndex: i });
    });
    await window.worshipsync.songs.upsertSections(song.songId, sections);
    await loadLineup(selectedService!.id);
    setShowEditLyrics(false);
  }, [liveSongs, selectedSongIdx, selectedService, loadLineup]);

  // ── Countdown ───────────────────────────────────────────────────────────
  // Resolve the timezone for the current service: match day-of-week to a saved schedule,
  // fall back to the global serviceTimezone setting.
  const getEffectiveTz = useCallback(() => {
    if (selectedService?.date && serviceSchedules.length > 0) {
      const dow = new Date(selectedService.date + "T12:00:00").getDay();
      const match = serviceSchedules.find((s) => s.dayOfWeek === dow);
      if (match?.timezone) return match.timezone;
    }
    return serviceTimezone;
  }, [selectedService, serviceSchedules, serviceTimezone]);

  const getTargetTime = useCallback(() => {
    const tz = getEffectiveTz();
    const dateStr = selectedService?.date ?? new Date().toLocaleDateString("en-CA", { timeZone: tz });
    // Return a UTC ISO string (with Z suffix) so every consumer — projection window,
    // stage display, PWA browser — parses it unambiguously regardless of timezone.
    return new Date(`${dateStr}T${serviceTime}:00`).toISOString();
  }, [serviceTime, getEffectiveTz, selectedService]);

  // Restore whatever is currently active on a freshly created projection window.
  // Uses refs so the callback is stable but always sees current state.
  const restoreProjectionState = useCallback(() => {
    if (countdownRunningRef.current) {
      window.worshipsync.slide.logo(false);
      window.worshipsync.slide.countdown({ targetTime: getTargetTime(), running: true });
    } else if (isLogoRef.current) {
      window.worshipsync.slide.logo(true);
    } else if (activeSlideIdxRef.current >= 0 && !isBlankRef.current) {
      sendSlide(selectedSongIdxRef.current, activeSlideIdxRef.current);
    } else {
      window.worshipsync.slide.blank(true);
    }
  }, [getTargetTime, sendSlide]);

  // Keep a stable ref so the projection:ready listener always calls the latest
  // version without making it a reactive dep of the effect below.
  const restoreProjectionStateRef = useRef(restoreProjectionState);
  restoreProjectionStateRef.current = restoreProjectionState;

  // Sync presenter state when PWA controller projects a slide or changes output state
  useEffect(() => {
    const cleanup = window.worshipsync.pwa?.onStateUpdate?.((update) => {
      const u = update as { type: string; lineupIdx?: number; slideIdx?: number; isBlank?: boolean; isLogo?: boolean }
      if (u.type === 'slide' && u.lineupIdx !== undefined && u.slideIdx !== undefined) {
        setSelectedSongIdx(u.lineupIdx)
        setActiveSlideIdx(u.slideIdx)
        setIsBlank(false)
        setIsLogo(false)
        setIsTextCleared(false)
        if (countdownRunningRef.current) {
          setCountdownRunning(false)
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current)
            countdownIntervalRef.current = null
          }
        }
        liveItemIdxRef.current  = u.lineupIdx
        liveSlideIdxRef.current = u.slideIdx
      } else if (u.type === 'blank') {
        setIsBlank(Boolean(u.isBlank))
        if (u.isBlank) setIsLogo(false)
        // Navigating onto the synthetic terminal "blank" slide carries its position —
        // keep the slide grid's "LIVE" highlight in sync so it doesn't stay stuck on
        // the previous (last lyrics) slide.
        if (u.lineupIdx !== undefined && u.slideIdx !== undefined) {
          setSelectedSongIdx(u.lineupIdx)
          setActiveSlideIdx(u.slideIdx)
          setIsTextCleared(false)
          if (countdownRunningRef.current) {
            setCountdownRunning(false)
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current)
              countdownIntervalRef.current = null
            }
          }
          liveItemIdxRef.current  = u.lineupIdx
          liveSlideIdxRef.current = u.slideIdx
        }
      } else if (u.type === 'logo') {
        setIsLogo(Boolean(u.isLogo))
        if (u.isLogo) setIsBlank(false)
      }
    })
    return () => cleanup?.()
  }, [])

  // Handle audio play/pause commands from PWA controller
  useEffect(() => {
    const cleanup = window.worshipsync.pwa?.onAudioCmd?.((data) => {
      const { action, lineupItemId } = data as { action: string; lineupItemId: number }
      const idx = liveSongs.findIndex(s => s.lineupItemId === lineupItemId)
      if (action === 'audio-play') {
        if (triggerAudioPlayRef.current && idx === selectedSongIdxRef.current) {
          // Panel already rendered — call directly
          triggerAudioPlayRef.current()
        } else {
          // Navigate to item first, then auto-play after render
          if (idx !== -1) setSelectedSongIdx(idx)
          pendingAudioPlayRef.current = lineupItemId
        }
      } else if (action === 'audio-pause') {
        triggerAudioPauseRef.current?.()
      } else if (action === 'audio-stop') {
        triggerAudioPauseRef.current?.()
        if (audioRef.current) { audioRef.current.currentTime = 0; setAudioCurrentTime(0); }
      }
    })
    return () => cleanup?.()
  }, [liveSongs])

  // Execute pending auto-play after the audio item is selected and rendered
  useEffect(() => {
    if (pendingAudioPlayRef.current === null) return
    const song = liveSongs[selectedSongIdx]
    if (!song || song.lineupItemId !== pendingAudioPlayRef.current) return
    pendingAudioPlayRef.current = null
    requestAnimationFrame(() => triggerAudioPlayRef.current?.())
  }, [selectedSongIdx, liveSongs])

  // Handle countdown start/stop from PWA controller
  useEffect(() => {
    const cleanup = window.worshipsync.pwa?.onCountdownCmd?.((action: string) => {
      if (action === 'start' && !countdownRunningRef.current) startCountdownRef.current?.()
      else if (action === 'stop' && countdownRunningRef.current)  stopCountdownRef.current?.()
    })
    return () => cleanup?.()
  }, [])

  // Handle video play/pause commands from PWA controller
  useEffect(() => {
    const cleanup = window.worshipsync.pwa?.onVideoCmd?.((data) => {
      const { action, lineupItemId } = data as { action: string; lineupItemId: number }
      const idx = liveSongs.findIndex(s => s.lineupItemId === lineupItemId)
      if (action === 'video-play') {
        if (triggerVideoPlayRef.current && idx === selectedSongIdxRef.current) {
          const currentTime = videoPreviewRef.current?.currentTime ?? 0
          if (currentTime > 0.1 && triggerVideoResumeRef.current) {
            triggerVideoResumeRef.current()
          } else {
            triggerVideoPlayRef.current()
          }
        } else {
          if (idx !== -1) setSelectedSongIdx(idx)
          pendingVideoPlayRef.current = lineupItemId
        }
      } else if (action === 'video-pause') {
        triggerVideoPauseRef.current?.()
      } else if (action === 'video-stop') {
        triggerVideoPauseRef.current?.()
        if (videoPreviewRef.current) { videoPreviewRef.current.currentTime = 0; setVideoCurrentTime(0); }
        window.worshipsync.slide.blank(true); setIsBlank(true);
      }
    })
    return () => cleanup?.()
  }, [liveSongs])

  // Execute pending video auto-play after item is selected and rendered
  useEffect(() => {
    if (pendingVideoPlayRef.current === null) return
    const song = liveSongs[selectedSongIdx]
    if (!song || song.lineupItemId !== pendingVideoPlayRef.current) return
    pendingVideoPlayRef.current = null
    requestAnimationFrame(() => triggerVideoPlayRef.current?.())
  }, [selectedSongIdx, liveSongs])

  // Broadcast current time every second while playing so PWA progress bar stays in sync
  useEffect(() => {
    if (!audioPlaying) return
    const interval = setInterval(() => {
      if (!audioRef.current) return
      const song = liveSongs[selectedSongIdxRef.current]
      if (!song) return
      window.worshipsync.pwa?.broadcastAudioState?.({
        isPlaying: true,
        currentTime: audioRef.current.currentTime,
        duration: audioRef.current.duration || 0,
        lineupItemId: song.lineupItemId,
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [audioPlaying, liveSongs])

  // Resync the preview and progress UI from the projection window's actual playback
  // position. The preview and projection are separate <video> elements that can drift
  // apart over a long video — the projection's reported position is authoritative and
  // also drives the videoState broadcast to the confidence monitor / PWA controller
  // (see slide:videoProgress handler in main).
  useEffect(() => {
    const cleanup = window.worshipsync.slide.onVideoProgress?.((data) => {
      const song = liveSongs[selectedSongIdxRef.current]
      if (!song || data.lineupItemId !== song.lineupItemId) return
      setVideoCurrentTime(data.currentTime)
      if (data.duration) setVideoDuration(data.duration)
      const preview = videoPreviewRef.current
      if (preview && Math.abs(preview.currentTime - data.currentTime) > 0.75) {
        preview.currentTime = data.currentTime
      }
    })
    return () => cleanup?.()
  }, [liveSongs])

  // When going live, auto-start the network server (stage display + PWA controller)
  // and register the projection:ready listener. Server stops automatically when
  // the session ends unless the operator has "always-on" enabled in settings.
  useEffect(() => {
    if (!projectionOpen) return;
    window.worshipsync.stageDisplay.sessionStart().catch(() => {});
    window.worshipsync.slide.blank(true);
    setIsBlank(true);
    setActiveSlideIdx(-1);
    const cleanup = window.worshipsync.window.onProjectionReady(() => restoreProjectionStateRef.current());
    return cleanup;
  }, [projectionOpen]); // intentionally excludes restoreProjectionState — use ref above

  // Live runtime counter
  useEffect(() => {
    if (!projectionOpen) return;
    liveStartRef.current = Date.now();
    setLiveRuntime("00:00:00");
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - liveStartRef.current) / 1000);
      const h = Math.floor(elapsed / 3600);
      const m = Math.floor((elapsed % 3600) / 60);
      const s = elapsed % 60;
      const pad = (n: number) => String(n).padStart(2, "0");
      setLiveRuntime(`${pad(h)}:${pad(m)}:${pad(s)}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [projectionOpen]);

  // On mount: restore audio state from singleton if audio was playing before unmount
  useEffect(() => {
    if (_audio.el && !_audio.el.paused) {
      audioRef.current = _audio.el;
      audioContextRef.current = _audio.ctx;
      analyserRef.current = _audio.analyser;
      setAudioPlaying(true);
      setAudioDuration(_audio.el.duration || 0);
      setAudioCurrentTime(_audio.el.currentTime);
      if (audioTimerRef.current) clearInterval(audioTimerRef.current);
      audioTimerRef.current = setInterval(() => setAudioCurrentTime(_audio.el?.currentTime ?? 0), 100);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync audioLoop from builder preference when selecting an audio item
  useEffect(() => {
    const song = liveSongs[selectedSongIdx];
    if (song?.itemType === "media" && /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(song.mediaPath ?? "")) {
      const saved = mediaLoopPrefs[song.lineupItemId] ?? false;
      setAudioLoop(saved);
      if (audioRef.current) audioRef.current.loop = saved;
      if (_audio.el) _audio.el.loop = saved;
    }
  }, [selectedSongIdx, liveSongs, mediaLoopPrefs]);

  // When the selected item changes, stop viz/timer if leaving audio; reconnect if returning
  useEffect(() => {
    const song = liveSongs[selectedSongIdx];
    const isAudio = song?.itemType === "media" &&
      /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(song?.mediaPath ?? "");
    if (!isAudio) {
      stopViz();
      if (audioTimerRef.current) { clearInterval(audioTimerRef.current); audioTimerRef.current = null; }
      return;
    }
    // Returned to audio item — reconnect singleton and restart viz/timer if playing
    if (_audio.el && !_audio.el.paused) {
      audioRef.current = _audio.el;
      audioContextRef.current = _audio.ctx;
      analyserRef.current = _audio.analyser;
      if (!vizFrameRef.current) startViz();
      if (!audioTimerRef.current) {
        audioTimerRef.current = setInterval(() => setAudioCurrentTime(_audio.el?.currentTime ?? 0), 100);
      }
    }
  }, [liveSongs, selectedSongIdx, startViz, stopViz]);

  const computeCountdownDisplay = useCallback(() => {
    const dateStr = selectedService?.date ?? new Date().toLocaleDateString("en-CA");
    const target = new Date(`${dateStr}T${serviceTime}:00`);
    if (isNaN(target.getTime())) return "00:00:00";
    const diff = target.getTime() - Date.now();
    if (diff <= 0) return "00:00:00";
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return d > 0
      ? `${pad(d)}d ${pad(h)}:${pad(m)}:${pad(s)}`
      : `${pad(h)}:${pad(m)}:${pad(s)}`;
  }, [serviceTime, selectedService]);

  const startCountdown = useCallback(() => {
    setCountdownRunning(true);
    setIsBlank(false);
    const targetTime = getTargetTime();

    const firstSong = liveSongs.find((s) => s.itemType === "song");
    const firstUp = firstSong
      ? {
          title: firstSong.title,
          artist: firstSong.artist || undefined,
          sectionLabel: firstSong.slides[0]?.sectionLabel ?? "",
        }
      : undefined;

    // Send initial state to projection
    window.worshipsync.slide.logo(false);
    window.worshipsync.slide.countdown({ targetTime, running: true, firstUp });

    // Update local display every second
    const update = () => setCountdownDisplay(computeCountdownDisplay());
    update();
    countdownIntervalRef.current = setInterval(() => {
      const display = computeCountdownDisplay();
      setCountdownDisplay(display);
      if (display === "00:00:00") {
        stopCountdown();
      }
    }, 1000);
  }, [getTargetTime, computeCountdownDisplay, liveSongs]);

  const stopCountdown = useCallback(() => {
    setCountdownRunning(false);
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    window.worshipsync.slide.countdown({ targetTime: "", running: false });
    window.worshipsync.slide.blank(true);
  }, []);

  // Keep refs current so the PWA countdown handler always calls the latest version
  startCountdownRef.current = startCountdown;
  stopCountdownRef.current  = stopCountdown;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (confirmEndTimer.current) clearTimeout(confirmEndTimer.current);
      if (countdownIntervalRef.current)
        clearInterval(countdownIntervalRef.current);
      if (videoTimerRef.current) clearInterval(videoTimerRef.current);
      if (audioTimerRef.current) clearInterval(audioTimerRef.current);
      if (vizFrameRef.current) cancelAnimationFrame(vizFrameRef.current);
      // Don't pause audio or close AudioContext — singleton keeps it alive across navigation
      audioRef.current = null;
      audioContextRef.current = null;
      analyserRef.current = null;
    };
  }, []);

  // ── Keyboard nav ─────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        goNextSlide();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrevSlide();
      } else if (e.key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) goPrevSong();
        else goNextSong();
      } else if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        if (isBlank) {
          if (activeSlideIdx >= 0) sendSlide(selectedSongIdx, activeSlideIdx);
          else { window.worshipsync.slide.blank(false); setIsBlank(false); }
        } else {
          toBlack();
        }
      } else if (e.key === "u" || e.key === "U") {
        e.preventDefault();
        if (isBlank) {
          if (activeSlideIdx >= 0) sendSlide(selectedSongIdx, activeSlideIdx);
          else { window.worshipsync.slide.blank(false); setIsBlank(false); }
        }
      } else if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        setShowHelp((v) => !v);
      } else if (e.key === "Escape") {
        setShowHelp(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNextSlide, goPrevSlide, goNextSong, goPrevSong, isBlank, activeSlideIdx, selectedSongIdx, sendSlide, toBlack]);



  // Scroll active slide into view when it changes
  useEffect(() => {
    if (activeSlideIdx < 0 || !slideGridRef.current) return;
    const el = slideGridRef.current.querySelector<HTMLElement>(`[data-slide-idx="${activeSlideIdx}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeSlideIdx, selectedSongIdx]);

  // ── Derived ──────────────────────────────────────────────────────────────
  const currentSong = liveSongs[selectedSongIdx] ?? null;
  const currentSlide = currentSong?.slides[activeSlideIdx] ?? null;
  const nextSong = liveSongs[selectedSongIdx + 1] ?? null;
  const effectiveTheme = currentSong
    ? resolveTheme(currentSong)
    : DEFAULT_THEME;
  const effectiveBg = currentSong ? resolveBg(currentSong) : undefined;

  // Output preview always shows what's actually live, not what's currently selected.
  const liveSong = liveSongs[liveItemIdxRef.current] ?? null;
  const liveSlide = liveSong?.slides[liveSlideIdxRef.current] ?? null;
  const liveTheme = liveSong ? resolveTheme(liveSong) : DEFAULT_THEME;
  const liveBg = liveSong ? resolveBg(liveSong) : undefined;
  const liveNextUp = (() => {
    if (!liveSong || liveSlideIdxRef.current < 0) return null;
    const isReal = (s: { sectionType: string; lines: string[] }) =>
      s.sectionType !== "blank" && s.lines.filter(Boolean).length > 0;
    const nextInSong = liveSong.slides.slice(liveSlideIdxRef.current + 1).find(isReal);
    if (nextInSong) return { slide: nextInSong, songTitle: null as string | null, itemType: liveSong.itemType };
    for (let k = liveItemIdxRef.current + 1; k < liveSongs.length; k++) {
      const first = liveSongs[k].slides.find(isReal);
      if (first) return { slide: first, songTitle: liveSongs[k].title, itemType: liveSongs[k].itemType };
    }
    return null;
  })();

  // Shown in the mini confidence-monitor preview on the last lyrics slide of an item —
  // mirrors the actual confidence monitor, which only shows this strip when the next
  // slide is a later section of the SAME song. When the next item is a different song,
  // the actual confidence monitor hides this strip (the trailing blank slide's enlarged
  // "Next Song" preview covers that transition instead), so this stays hidden too.
  const showLiveNextPanel = liveSong?.itemType !== "scripture" && !!liveNextUp && !liveNextUp.songTitle
    && liveNextUp.slide.sectionType !== "blank" && liveNextUp.slide.lines.filter(Boolean).length > 0;
  const liveNextPanel = liveNextUp && (
    <div className="shrink-0 px-1.5 pt-0.5 pb-1" style={{ borderTop: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" }}>
      <p className="text-[6px] font-black uppercase tracking-wider leading-none mb-0.5" style={{ color: "rgba(255,255,255,0.28)" }}>
        Next
      </p>
      <p className="text-[7px] leading-snug line-clamp-1 text-center" style={{ color: "rgba(255,255,255,0.45)" }}>
        {liveNextUp.slide.lines.filter(Boolean)[0]}
      </p>
    </div>
  );

  // Enlarged "Next Song" treatment for the trailing blank slide — mirrors the centered
  // preview shown on the actual confidence monitor (song title + first 2 lines).
  const liveEnlargedNext = liveNextUp?.songTitle && liveNextUp.itemType === "song" && (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-2 text-center" style={{ background: "#000" }}>
      <span className="text-[6px] font-extrabold uppercase tracking-widest" style={{ color: "rgba(251,191,36,0.6)" }}>Next Song</span>
      <span className="text-[11px] font-extrabold leading-tight line-clamp-1" style={{ color: "#fbbf24" }}>{liveNextUp.songTitle}</span>
      {liveNextUp.slide.sectionLabel && (
        <span className="text-[5px] font-bold uppercase tracking-wider rounded px-1 py-px" style={{ color: "rgba(251,191,36,0.5)", border: "1px solid rgba(251,191,36,0.3)", background: "rgba(251,191,36,0.08)" }}>
          {liveNextUp.slide.sectionLabel}
        </span>
      )}
      <div className="text-[7px] leading-snug line-clamp-2" style={{ color: "rgba(255,255,255,0.45)" }}>
        {liveNextUp.slide.lines.filter(Boolean).slice(0, 2).map((line, i) => <div key={i}>{line}</div>)}
      </div>
    </div>
  );

  const nextUp = useMemo(() => {
    if (!currentSong || activeSlideIdx < 0) return null;
    const nextIdx = activeSlideIdx + 1;
    if (nextIdx < currentSong.slides.length) {
      return { slide: currentSong.slides[nextIdx], songTitle: null };
    }
    if (nextSong && nextSong.slides.length > 0) {
      return { slide: nextSong.slides[0], songTitle: nextSong.title };
    }
    return null;
  }, [currentSong, activeSlideIdx, nextSong]);

  const sectionTabs = useMemo(() => {
    if (!currentSong || currentSong.slides.length === 0) return [];
    const seen = new Set<number>();
    const tabs: { sectionId: number; label: string; fullLabel: string; firstSlideIdx: number }[] = [];
    currentSong.slides.forEach((slide, i) => {
      if (slide.sectionType === "blank" || seen.has(slide.sectionId)) return;
      seen.add(slide.sectionId);
      let label: string;
      if (currentSong.itemType === "scripture") {
        const verseMatch = slide.sectionLabel.match(/:(\d+)/);
        label = verseMatch ? verseMatch[1] : String(tabs.length + 1);
      } else {
        const abbrev = SECTION_ABBREVS[slide.sectionType] ?? slide.sectionLabel[0]?.toUpperCase() ?? "?";
        const numMatch = slide.sectionLabel.match(/\d+$/);
        label = numMatch ? abbrev + numMatch[0] : abbrev;
      }
      tabs.push({ sectionId: slide.sectionId, label, fullLabel: slide.sectionLabel, firstSlideIdx: i });
    });
    return tabs;
  }, [currentSong]);

  const activeSectionId = currentSlide?.sectionId ?? -1;

  if (!selectedService) {
    return (
      <div className="h-full flex items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <Music className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-2">
            No service loaded
          </p>
          <p className="text-xs text-muted-foreground">
            Go to Builder, prepare a lineup, and click Go Live
          </p>
        </div>
      </div>
    );
  }

  // ── Pre-live idle ──────────────────────────────────────────────────────
  if (!projectionOpen) {
    return (
      <PreLiveIdle
        serviceLabel={selectedService.label}
        songs={liveSongs}
        canGoLive={liveSongs.length > 0}
        onStartLive={startLive}
        displays={displays}
        selectedDisplayId={selectedDisplayId}
        onDisplayChange={setSelectedDisplayId}
        confidenceOpen={confidenceOpen}
        onToggleConfidence={() => {
          if (confidenceOpen) { window.worshipsync.confidence.close(); setConfidenceOpen(false); }
          else { window.worshipsync.confidence.open(selectedConfidenceDisplayId); setConfidenceOpen(true); }
        }}
      />
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background text-foreground relative">
      {/* Click-away overlay for switcher */}
      {showSwitcher && (
        <div className="fixed inset-0 z-40" onClick={() => { setShowSwitcher(false); setPendingSwitch(null); }} />
      )}

      {/* ═════ TOP HEADER BAR ═════ */}
      <div
        className="h-11 shrink-0 border-b border-border bg-card/95 flex items-center px-3 gap-2.5 relative z-10"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        {/* ON AIR badge */}
        <div className="flex items-center gap-1.5 shrink-0 bg-red-500/10 border border-red-500/30 rounded px-2 py-1" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
          <span className="text-[10px] font-black text-red-400 tracking-widest">ON AIR</span>
        </div>

        <div className="h-4 w-px bg-border shrink-0" />

        {/* Service name + switcher */}
        <div className="relative" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
          <button
            onClick={openSwitcher}
            className="flex items-center gap-1 group hover:text-primary transition-colors"
          >
            <span className="text-sm font-semibold truncate max-w-[180px]">{selectedService.label}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
          </button>

          {/* Switcher dropdown */}
          {showSwitcher && (
            <div className="absolute top-full left-0 mt-1 w-72 z-50 bg-card border border-border shadow-xl rounded-lg overflow-hidden">
              <div className="p-2 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    autoFocus
                    value={switcherSearch}
                    onChange={(e) => handleSwitcherSearch(e.target.value)}
                    placeholder="Search lineups…"
                    className="w-full pl-7 pr-2 py-1.5 text-xs bg-input rounded border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="max-h-60 overflow-y-auto">
                {!switcherSearch.trim() ? (
                  <>
                    <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Upcoming Lineups</p>
                    {recentServices.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">No upcoming services</p>}
                    {recentServices.map((svc) => (
                      <SwitcherRow key={svc.id} svc={svc} isCurrent={svc.id === selectedService.id} isPending={pendingSwitch?.id === svc.id} onSelect={() => requestSwitch(svc)} />
                    ))}
                  </>
                ) : switcherResults.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">No results</p>
                ) : (
                  switcherResults.map((svc) => (
                    <SwitcherRow key={svc.id} svc={svc} isCurrent={svc.id === selectedService.id} isPending={pendingSwitch?.id === svc.id} onSelect={() => requestSwitch(svc)} />
                  ))
                )}
              </div>
              {pendingSwitch && (
                <div className="border-t border-border bg-amber-500/10 px-3 py-2 flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <p className="text-[11px] text-amber-500 font-medium flex-1 truncate min-w-0">Switch to "{pendingSwitch.label}"?</p>
                  <button onClick={() => { setShowSwitcher(false); setPendingSwitch(null); }} className="text-[11px] text-muted-foreground hover:text-foreground shrink-0">Cancel</button>
                  <button onClick={confirmSwitch} className="text-[11px] font-semibold text-amber-500 hover:text-amber-400 shrink-0">Confirm</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Live Runtime — center, prominent */}
        <div className="flex-1 flex justify-center">
          <span className="text-xs font-semibold tabular-nums text-muted-foreground tracking-wide">{liveRuntime}</span>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1.5 shrink-0" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
          {/* Keyboard help */}
          <button
            onClick={() => setShowHelp(true)}
            title="Keyboard shortcuts (?)"
            className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          >
            <Keyboard className="h-3.5 w-3.5" />
          </button>

          {/* Edit in Builder */}
          {onSwitchToBuilder && (
            <button
              onClick={onSwitchToBuilder}
              className="h-7 flex items-center gap-1.5 px-2.5 rounded text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors border border-border"
            >
              <Pencil className="h-3 w-3" /> Builder
            </button>
          )}

          <div className="h-4 w-px bg-border" />

          {/* End Show */}
          <button
            onClick={endShow}
            className={`h-7 flex items-center gap-1.5 px-3 rounded text-xs font-semibold transition-colors ${
              confirmEndShow
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground border border-destructive/30"
            }`}
          >
            {confirmEndShow ? "Confirm?" : "End Show"}
          </button>
        </div>
      </div>

      {/* ═════ BODY: Left + Center + Right ═════ */}
      <div className="flex-1 flex overflow-hidden min-h-0">

      {/* ═════ LEFT: Run of Show (240px) ═════ */}
      <div className="w-[240px] shrink-0 border-r border-border flex flex-col bg-card">
        <div className="px-3 py-2.5 border-b border-border flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Run of Show</span>
          <button onClick={() => setShowLibrary(true)} className="text-[10px] font-semibold text-primary/70 hover:text-primary transition-colors flex items-center gap-0.5">
            <Plus className="h-3 w-3" />Add
          </button>
        </div>

        {/* Inline song search */}
        <div className="px-2 py-2 border-b border-border shrink-0">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
            <input
              value={rosSearch}
              onChange={e => handleRosSearch(e.target.value)}
              placeholder="Quick-add song…"
              className="w-full pl-6 pr-6 py-1.5 text-xs bg-input border border-border rounded focus:outline-none focus:border-primary/50 transition-colors placeholder:text-muted-foreground/50"
            />
            {rosSearch && (
              <button
                onClick={() => { setRosSearch(""); setRosResults([]); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          {rosResults.length > 0 && (
            <div className="mt-1.5 border border-border rounded-md bg-background shadow-lg overflow-hidden">
              {rosResults.slice(0, 6).map(song => (
                <button
                  key={song.id}
                  onClick={async () => {
                    await addSongToLineup(song.id)
                    setRosSearch("")
                    setRosResults([])
                    setSelectedSongIdx(liveSongs.length)
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-accent/40 transition-colors border-b border-border last:border-0 text-left"
                >
                  <Music className="h-3 w-3 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium truncate">{song.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{song.artist || "Unknown"}</p>
                  </div>
                  <Plus className="h-3 w-3 text-primary shrink-0" />
                </button>
              ))}
            </div>
          )}
          {rosSearch.trim() && rosResults.length === 0 && (
            <p className="text-[10px] text-muted-foreground mt-1.5 px-1">No songs found</p>
          )}
        </div>

        {/* Quick-add scripture */}
        <form onSubmit={handleScriptureQuickAdd} className="px-2 py-2 border-b border-border shrink-0 flex flex-col gap-1.5">
          <div className="relative">
            <BookOpen className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
            <input
              value={scriptureQuery}
              onChange={e => { setScriptureQuery(e.target.value); setScriptureQueryError(null) }}
              placeholder="Scripture… e.g. John 3:16"
              disabled={scriptureQueryLoading}
              className="w-full pl-6 pr-6 py-1.5 text-xs bg-input border border-border rounded focus:outline-none focus:border-primary/50 transition-colors placeholder:text-muted-foreground/50 disabled:opacity-70"
            />
            {scriptureQueryLoading
              ? <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-muted-foreground" />
              : scriptureQuery && (
                <button type="button" onClick={() => { setScriptureQuery(""); setScriptureQueryError(null) }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              )
            }
          </div>
          <select
            value={scriptureTranslation}
            onChange={e => setScriptureTranslation(e.target.value)}
            disabled={scriptureQueryLoading}
            className="w-full px-2 py-1 text-xs bg-input border border-border rounded focus:outline-none focus:border-primary/50 cursor-pointer disabled:opacity-70"
          >
            {availableTranslations.map(t => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          {scriptureQueryError && (
            <p className="text-[10px] text-red-400 px-1">{scriptureQueryError}</p>
          )}
        </form>

        {/* Recently used scriptures */}
        {recentScriptures.length > 0 && !scriptureQuery && (
          <div className="px-2 pb-1">
            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60 px-1 mb-1">Recent</p>
            <div className="flex flex-col gap-0.5">
              {recentScriptures.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setScriptureQuery(r.query)
                    if (availableTranslations.some(t => t.id === r.translationId)) setScriptureTranslation(r.translationId)
                  }}
                  className="flex items-center justify-between gap-2 px-2 py-1 rounded hover:bg-muted/50 transition-colors text-left group"
                >
                  <span className="text-[11px] text-foreground/80 group-hover:text-foreground truncate">{r.reference}</span>
                  <span className="text-[10px] font-bold text-muted-foreground shrink-0">{r.translationLabel}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {liveSongs.map((song, i) => {
            const isCurrent = selectedSongIdx === i;
            const isFinished = i < selectedSongIdx;
            const isNextItem = i === selectedSongIdx + 1;
            const isSection = song.itemType === "section";
            const isCountdown = song.itemType === "countdown";
            const isScripture = song.itemType === "scripture";
            const isMedia = song.itemType === "media";
            const isAudioItem = isMedia && /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(song.mediaPath ?? "");
            const isVideoItem = isMedia && /\.(mp4|webm|mov)$/i.test(song.mediaPath ?? "");
            const isAnnouncement = song.itemType === "announcement";

            // Section headers — visual dividers with per-section add button
            if (isSection) {
              return (
                <div key={song.lineupItemId} className="flex flex-col mt-1">
                  <div className="flex items-center gap-1.5 px-2 pt-2.5 pb-1.5 mx-2 rounded-md bg-muted/40">
                    <Layers className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/80 truncate flex-1">
                      {song.title}
                    </span>
                    <button
                      onClick={() => { setInsertAfterSectionId(song.lineupItemId); setShowLibrary(true); }}
                      className="text-[9px] text-muted-foreground/50 hover:text-primary transition-colors font-semibold shrink-0 flex items-center gap-0.5"
                    >
                      <Plus className="h-2.5 w-2.5" />Add
                    </button>
                  </div>
                </div>
              );
            }

            const Icon = isCountdown ? Timer : isScripture ? BookOpen : isMedia ? (isVideoItem ? Film : isAudioItem ? Volume2 : ImageIcon) : isAnnouncement ? Megaphone : Music;
            return (
              <button
                key={song.lineupItemId}
                onClick={() => {
                  const isLiveItem = i === liveItemIdxRef.current;
                  setSelectedSongIdx(i);
                  if (isLiveItem) {
                    // Restore the projected slide so the grid scrolls back to it
                    setActiveSlideIdx(liveSlideIdxRef.current);
                  } else {
                    // New item — reset to -1 and scroll grid to top
                    setActiveSlideIdx(-1);
                    requestAnimationFrame(() => {
                      if (slideGridRef.current) slideGridRef.current.scrollTop = 0;
                    });
                  }
                  // Stop the timer — stamp when we stopped so restore can calculate elapsed time
                  if (videoTimerRef.current) {
                    clearInterval(videoTimerRef.current);
                    videoTimerRef.current = null;
                    if (videoPlaying) videoTimerStoppedAtRef.current = Date.now();
                  }
                  if (vizFrameRef.current) { cancelAnimationFrame(vizFrameRef.current); vizFrameRef.current = null; }
                  // Keep audio playing — viz/timer are handled by the currentSong effect
                  audioRef.current = null;
                  audioContextRef.current = null;
                  analyserRef.current = null;
                }}
                className={`w-full text-left flex items-center gap-2 px-3 py-3 border-b border-border/60 transition-colors ${
                  isCurrent ? "bg-red-500/10 border-l-[3px] border-l-red-500" : isFinished ? "opacity-40" : "hover:bg-accent/40"
                }`}
              >
                <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${isCurrent ? "bg-red-500 text-white shadow-[0_0_8px_rgba(239,68,68,0.4)]" : "bg-muted text-muted-foreground"}`}>
                  <Icon className="h-3 w-3" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-[12px] font-medium truncate ${isCurrent ? "text-red-400 font-semibold" : isFinished ? "text-muted-foreground" : "text-foreground"}`}>
                    {song.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {isCountdown ? "Countdown" : isScripture ? "Scripture" : isMedia ? (isVideoItem ? "Video" : isAudioItem ? "Audio" : "Image") : isAnnouncement ? "Announcement" : song.artist || "Song"}
                    {!isCountdown && !isMedia && song.slides.length > 0 && (
                      <span className="ml-1 opacity-50">· {song.slides.filter(s => s.sectionType !== "blank").length} slides</span>
                    )}
                  </p>
                </div>
                {isFinished && <span className="text-[9px] font-semibold text-muted-foreground/70 shrink-0 bg-muted px-1 py-0.5 rounded leading-none">Done</span>}
                {isNextItem && <span className="text-[9px] font-semibold text-primary shrink-0 bg-primary/10 px-1 py-0.5 rounded leading-none">NEXT</span>}
                {isCurrent && <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── CENTER + RIGHT + OUTPUT BAR column ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      <div className="flex-1 flex overflow-hidden min-h-0">

      {/* ═════ CENTER: Main Slide Area ═════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
        {currentSong?.itemType === "section" ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-3">
            <Layers className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm font-semibold text-foreground">{currentSong.title}</p>
            <p className="text-xs text-muted-foreground max-w-xs">This is a section divider. Select an item below it to continue presenting.</p>
          </div>
        ) : currentSong?.itemType === "announcement" ? (
          /* ── Announcement ── */
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex items-center gap-2 px-6 pt-5 pb-3 shrink-0">
              <Megaphone className="h-4 w-4 text-muted-foreground shrink-0" />
              <h2 className="text-sm font-bold">{currentSong.title || "Announcement"}</h2>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-2">
              {(currentSong.slides[0]?.cards ?? []).filter(c => c.heading).length > 0 ? (
                (currentSong.slides[0]?.cards ?? []).filter(c => c.heading).map(card => (
                  <div key={card.id} className="flex gap-3 p-3 bg-card rounded-lg border border-border">
                    {(card.day || card.time) && (
                      <div className="shrink-0 rounded px-2 py-1 text-center text-[10px] font-bold leading-tight"
                        style={{ background: '#fbbf24', color: '#000', minWidth: 40 }}>
                        {card.day && <div>{card.day}</div>}
                        {card.time && <div>{card.time}</div>}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-tight">{card.heading}</p>
                      {card.location && <p className="text-xs text-muted-foreground mt-0.5">{card.location}</p>}
                      {card.description && <p className="text-xs text-muted-foreground">{card.description}</p>}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">No events yet — add them in the builder.</p>
              )}
            </div>
            <div className="shrink-0 px-6 pb-5 pt-2 border-t border-border">
              <Button
                size="lg" className="gap-2 w-full"
                disabled={!(currentSong.slides[0]?.cards ?? []).filter(c => c.heading).length}
                onClick={() => sendSlide(selectedSongIdx, 0)}
              >
                <Cast className="h-5 w-5" /> Show on Screen
              </Button>
            </div>
          </div>
        ) : currentSong?.itemType === "countdown" ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <Timer className="h-16 w-16 text-muted-foreground mb-6" />
            <h2 className="text-lg font-bold mb-2">Countdown Timer</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Counting down to service at{" "}
              <span className="font-semibold text-foreground">
                {new Date(`2000-01-01T${serviceTime}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
              </span>
              {" "}
              <span className="text-xs font-medium bg-muted rounded px-1.5 py-0.5">
                {(() => {
                  const tz = getEffectiveTz();
                  try {
                    return new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value ?? tz;
                  } catch { return tz; }
                })()}
              </span>
            </p>
            <div className="rounded-2xl border border-border bg-card px-12 py-8 mb-8">
              <span className="text-6xl font-mono font-bold tracking-wider text-foreground">
                {countdownRunning ? countdownDisplay : computeCountdownDisplay()}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {!countdownRunning ? (
                <Button size="lg" className="gap-2" onClick={startCountdown}>
                  <Play className="h-5 w-5 fill-current" /> Start Countdown
                </Button>
              ) : (
                <Button size="lg" variant="destructive" className="gap-2" onClick={stopCountdown}>
                  <Square className="h-4 w-4 fill-current" /> Stop Countdown
                </Button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-6 max-w-sm">
              The countdown will be shown on the projection screen when started. It stops automatically when it reaches zero.
            </p>
          </div>
        ) : currentSong?.itemType === "media" && /\.(mp4|webm|mov)$/i.test(currentSong.mediaPath ?? "") ? (
          /* ── Video media ── */
          (() => {
            const bg = currentSong.mediaPath!;
            const pct = videoDuration ? (videoCurrentTime / videoDuration) * 100 : 0;
            const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
            const ext = bg.split(".").pop()?.toUpperCase() ?? "VIDEO";

            const stopVideo = () => {
              window.worshipsync.slide.videoControl("stop");
              if (videoPreviewRef.current) { videoPreviewRef.current.pause(); videoPreviewRef.current.currentTime = 0; }
              videoTimerStoppedAtRef.current = null;
              setVideoPlaying(false); setVideoCurrentTime(0); setIsBlank(true);
              if (videoTimerRef.current) { clearInterval(videoTimerRef.current); videoTimerRef.current = null; }
            };
            const broadcastVideoNow = (seekTime?: number) => {
              const song = liveSongs[selectedSongIdxRef.current];
              if (!song) return;
              window.worshipsync.pwa?.broadcastVideoState?.({
                isPlaying: videoPlaying,
                currentTime: seekTime ?? videoPreviewRef.current?.currentTime ?? 0,
                duration: videoPreviewRef.current?.duration || videoDuration,
                lineupItemId: song.lineupItemId,
              });
            };
            const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
              if (!videoDuration) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const seekTo = Math.max(0, Math.min(videoDuration, ((e.clientX - rect.left) / rect.width) * videoDuration));
              if (videoPreviewRef.current) videoPreviewRef.current.currentTime = seekTo;
              setVideoCurrentTime(seekTo);
              window.worshipsync.slide.videoSeek(seekTo);
              broadcastVideoNow(seekTo);
            };
            const handleSkipVideo = (delta: number) => {
              const newTime = Math.max(0, Math.min(videoDuration, (videoPreviewRef.current?.currentTime ?? 0) + delta));
              if (videoPreviewRef.current) videoPreviewRef.current.currentTime = newTime;
              setVideoCurrentTime(newTime);
              window.worshipsync.slide.videoSeek(newTime);
              broadcastVideoNow(newTime);
            };
            const handlePlay = () => {
              const preview = videoPreviewRef.current;
              const dur = preview?.duration ?? 0;
              setVideoDuration(dur); setVideoCurrentTime(0);
              window.worshipsync.slide.blank(false);
              window.worshipsync.slide.logo(false);
              window.worshipsync.slide.show({
                lines: [],
                songTitle: currentSong.title,
                sectionLabel: "",
                itemType: "media",
                slideIndex: 0,
                totalSlides: 1,
                lineupItemId: currentSong.lineupItemId,
                backgroundPath: bg,
                theme: {
                  fontFamily: DEFAULT_THEME.fontFamily,
                  fontSize: DEFAULT_THEME.fontSize,
                  fontWeight: DEFAULT_THEME.fontWeight,
                  textColor: DEFAULT_THEME.textColor,
                  textAlign: DEFAULT_THEME.textAlign,
                  textPosition: DEFAULT_THEME.textPosition,
                  overlayOpacity: 0,
                  textShadowOpacity: 0,
                  maxLinesPerSlide: DEFAULT_THEME.maxLinesPerSlide,
                },
              });
              window.worshipsync.slide.videoLoop(videoLoop);
              setIsBlank(false);
              window.worshipsync.slide.videoControl("play");
              if (preview) { preview.loop = videoLoop; preview.play(); }
              setVideoPlaying(true);
              if (videoTimerRef.current) clearInterval(videoTimerRef.current);
              videoTimerRef.current = setInterval(() => { setVideoCurrentTime(videoPreviewRef.current?.currentTime ?? 0); }, 100);
              window.worshipsync.pwa?.broadcastVideoState?.({ isPlaying: true, currentTime: 0, duration: dur, lineupItemId: currentSong.lineupItemId });
            };
            const handlePause = () => {
              window.worshipsync.slide.videoControl("pause");
              videoPreviewRef.current?.pause();
              setVideoPlaying(false);
              if (videoTimerRef.current) { clearInterval(videoTimerRef.current); videoTimerRef.current = null; }
              window.worshipsync.pwa?.broadcastVideoState?.({ isPlaying: false, currentTime: videoPreviewRef.current?.currentTime ?? 0, duration: videoPreviewRef.current?.duration || videoDuration, lineupItemId: currentSong.lineupItemId });
            };
            const handleResume = () => {
              const syncTime = videoPreviewRef.current?.currentTime ?? 0;
              // Ensure the slide is visible and projection is pre-positioned before playing.
              // This fixes blank→resume de-sync (projection remounts from 0 without a seek).
              window.worshipsync.slide.blank(false);
              setIsBlank(false);
              window.worshipsync.slide.videoSeek(syncTime);
              window.worshipsync.slide.videoControl("play");
              videoPreviewRef.current?.play().catch(() => {});
              setVideoPlaying(true);
              if (videoTimerRef.current) clearInterval(videoTimerRef.current);
              videoTimerRef.current = setInterval(() => setVideoCurrentTime(videoPreviewRef.current?.currentTime ?? 0), 100);
              window.worshipsync.pwa?.broadcastVideoState?.({ isPlaying: true, currentTime: syncTime, duration: videoPreviewRef.current?.duration || videoDuration, lineupItemId: currentSong.lineupItemId });
            };
            // Expose to PWA command handler
            triggerVideoPlayRef.current   = handlePlay;
            triggerVideoResumeRef.current = handleResume;
            triggerVideoPauseRef.current  = handlePause;
            const handleToggleLoop = () => {
              const next = !videoLoop;
              setVideoLoop(next);
              if (videoPreviewRef.current) videoPreviewRef.current.loop = next;
              window.worshipsync.slide.videoLoop(next);
            };

            return (
              <>
                {/* Header */}
                <div className="px-5 py-3 border-b border-border bg-card flex items-center justify-between gap-4 shrink-0">
                  <div className="min-w-0">
                    <h1 className="text-base font-semibold truncate">{currentSong.title}</h1>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>Video</span><span>·</span><span className="tabular-nums">{fmt(videoDuration)}</span><span>·</span><span>{ext}</span>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" className="gap-1.5 h-8 text-xs shrink-0" onClick={() => setShowLibrary(true)}>
                    <RefreshCw className="h-3.5 w-3.5" /> Replace
                  </Button>
                </div>

                {/* Player body */}
                <div className="flex-1 flex flex-col items-center justify-center p-8 bg-muted/20 overflow-y-auto">
                  <div className="w-full max-w-2xl flex flex-col gap-5">

                    {/* Video preview */}
                    <div className="relative rounded-xl overflow-hidden bg-black border border-border shadow-md" style={{ aspectRatio: "16/9" }}>
                      <video
                        ref={videoPreviewRef}
                        src={`file://${encodeURI(bg)}`}
                        className="w-full h-full object-cover"
                        muted playsInline preload="auto"
                        loop={videoLoop}
                        onLoadedMetadata={() => {
                          const v = videoPreviewRef.current;
                          if (!v) return;
                          setVideoDuration(v.duration);
                          if (videoPlaying) {
                            // Calculate where the projection currently is
                            const elapsed = videoTimerStoppedAtRef.current
                              ? (Date.now() - videoTimerStoppedAtRef.current) / 1000
                              : 0;
                            videoTimerStoppedAtRef.current = null;
                            const seekTo = Math.min(videoCurrentTime + elapsed, v.duration - 0.05);
                            v.currentTime = seekTo;
                            window.worshipsync.slide.videoSeek(seekTo);
                            v.play().catch(() => {});
                            if (videoTimerRef.current) clearInterval(videoTimerRef.current);
                            videoTimerRef.current = setInterval(() => setVideoCurrentTime(videoPreviewRef.current?.currentTime ?? 0), 100);
                          } else {
                            v.currentTime = videoCurrentTime || 0.001;
                          }
                        }}
                        onEnded={videoLoop ? undefined : stopVideo}
                      />
                    </div>

                    {/* Seek bar + timestamps */}
                    <div className="flex flex-col gap-1.5">
                      <div className="relative flex items-center cursor-pointer group py-2" onClick={handleSeek}>
                        <div className="w-full h-1.5 bg-secondary rounded-full relative">
                          <div className="absolute left-0 top-0 h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                          <div
                            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white border-2 border-primary rounded-full shadow-md -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ left: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums px-0.5">
                        <span>{fmt(videoCurrentTime)}</span>
                        <span>{fmt(videoDuration)}</span>
                      </div>
                    </div>

                    {/* Transport controls */}
                    <div className="flex items-center justify-center gap-5">
                      <button onClick={() => handleSkipVideo(-videoDuration)} title="Skip to start" className="text-muted-foreground hover:text-foreground transition-colors">
                        <SkipBack className="h-5 w-5" />
                      </button>
                      <button onClick={() => handleSkipVideo(-10)} title="Back 10s" className="text-muted-foreground hover:text-foreground transition-colors text-[11px] font-bold w-8 text-center">
                        −10s
                      </button>
                      <button
                        onClick={videoPlaying ? handlePause : videoCurrentTime > 0.1 ? handleResume : handlePlay}
                        className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all shadow-lg"
                      >
                        {videoPlaying ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 fill-current ml-0.5" />}
                      </button>
                      <button onClick={() => handleSkipVideo(10)} title="Forward 10s" className="text-muted-foreground hover:text-foreground transition-colors text-[11px] font-bold w-8 text-center">
                        +10s
                      </button>
                      <button onClick={() => handleSkipVideo(videoDuration)} title="Skip to end" className="text-muted-foreground hover:text-foreground transition-colors">
                        <SkipForward className="h-5 w-5" />
                      </button>
                      <button
                        onClick={handleToggleLoop}
                        title={videoLoop ? "Loop on" : "Loop off"}
                        className={`transition-colors ${videoLoop ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        <Repeat className="h-5 w-5" />
                      </button>
                    </div>

                    <p className="text-center text-[11px] text-muted-foreground">
                      Preview plays here (muted) · Audio plays on the projection screen
                    </p>
                  </div>
                </div>
              </>
            );
          })()
        ) : currentSong?.itemType === "media" && /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(currentSong.mediaPath ?? "") ? (
          /* ── Audio media ── */
          (() => {
            const bg = currentSong.mediaPath!;
            const pct = audioDuration ? (audioCurrentTime / audioDuration) * 100 : 0;
            const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
            const ext = bg.split(".").pop()?.toUpperCase() ?? "AUDIO";
            const ensureAudio = () => {
              if (!audioRef.current) {
                if (_audio.el && _audio.path === bg) {
                  // Restore from singleton (same file, still alive)
                  audioRef.current = _audio.el;
                  audioContextRef.current = _audio.ctx;
                  analyserRef.current = _audio.analyser;
                } else {
                  // New file — tear down any previous singleton
                  if (_audio.el) { _audio.el.pause(); }
                  if (_audio.ctx) { _audio.ctx.close(); }
                  audioRef.current = new Audio(`file://${encodeURI(bg)}`);
                  audioRef.current.loop = audioLoop;
                  audioRef.current.onloadedmetadata = () => setAudioDuration(audioRef.current?.duration ?? 0);
                  audioRef.current.onended = () => {
                    setAudioPlaying(false); setAudioCurrentTime(0);
                    if (audioTimerRef.current) { clearInterval(audioTimerRef.current); audioTimerRef.current = null; }
                    stopViz();
                    window.worshipsync.pwa?.broadcastAudioState?.({ isPlaying: false, currentTime: 0, duration: audioRef.current?.duration ?? 0, lineupItemId: currentSong.lineupItemId });
                  };
                  const ctx = new AudioContext();
                  const analyser = ctx.createAnalyser();
                  analyser.fftSize = 256;
                  ctx.createMediaElementSource(audioRef.current).connect(analyser);
                  analyser.connect(ctx.destination);
                  audioContextRef.current = ctx;
                  analyserRef.current = analyser;
                  // Save to singleton
                  _audio.el = audioRef.current;
                  _audio.ctx = ctx;
                  _audio.analyser = analyser;
                  _audio.path = bg;
                }
              }
              return audioRef.current;
            };
            const handlePlay = () => {
              window.worshipsync.slide.blank(true);
              setIsBlank(true);
              // Tell the confidence monitor what's playing without affecting projection
              window.worshipsync.slide.confidenceHint({
                lines: [],
                songTitle: currentSong.title,
                sectionLabel: "",
                itemType: "media",
                slideIndex: 0,
                totalSlides: 1,
                lineupItemId: currentSong.lineupItemId,
              });
              const audio = ensureAudio();
              audioContextRef.current?.resume();
              audio.play();
              setAudioPlaying(true);
              if (audioTimerRef.current) clearInterval(audioTimerRef.current);
              audioTimerRef.current = setInterval(() => setAudioCurrentTime(audioRef.current?.currentTime ?? 0), 100);
              startViz();
              window.worshipsync.pwa?.broadcastAudioState?.({ isPlaying: true, currentTime: audioRef.current?.currentTime ?? 0, duration: audioRef.current?.duration || audioDuration, lineupItemId: currentSong.lineupItemId });
            };
            const handlePause = () => {
              audioRef.current?.pause();
              setAudioPlaying(false);
              if (audioTimerRef.current) { clearInterval(audioTimerRef.current); audioTimerRef.current = null; }
              stopViz();
              window.worshipsync.pwa?.broadcastAudioState?.({ isPlaying: false, currentTime: audioRef.current?.currentTime ?? 0, duration: audioRef.current?.duration || audioDuration, lineupItemId: currentSong.lineupItemId });
            };
            // Expose to PWA command handler
            triggerAudioPlayRef.current  = handlePlay;
            triggerAudioPauseRef.current = handlePause;
            const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
              if (!audioDuration || !audioRef.current) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const seekTo = Math.max(0, Math.min(audioDuration, ((e.clientX - rect.left) / rect.width) * audioDuration));
              audioRef.current.currentTime = seekTo;
              setAudioCurrentTime(seekTo);
              window.worshipsync.pwa?.broadcastAudioState?.({ isPlaying: audioPlaying, currentTime: seekTo, duration: audioRef.current.duration || audioDuration, lineupItemId: currentSong.lineupItemId });
            };
            const handleSkip = (delta: number) => {
              if (!audioRef.current) return;
              const newTime = Math.max(0, Math.min(audioDuration, audioRef.current.currentTime + delta));
              audioRef.current.currentTime = newTime;
              setAudioCurrentTime(newTime);
              window.worshipsync.pwa?.broadcastAudioState?.({ isPlaying: audioPlaying, currentTime: newTime, duration: audioRef.current.duration || audioDuration, lineupItemId: currentSong.lineupItemId });
            };
            const handleToggleLoop = () => { const next = !audioLoop; setAudioLoop(next); if (audioRef.current) audioRef.current.loop = next; };
            return (
              <>
                {/* Header */}
                <div className="px-5 py-3 border-b border-border bg-card flex items-center justify-between gap-4 shrink-0">
                  <div className="min-w-0">
                    <h1 className="text-base font-semibold truncate">{currentSong.title}</h1>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>Audio</span><span>·</span><span className="tabular-nums">{fmt(audioDuration)}</span><span>·</span><span>{ext}</span>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" className="gap-1.5 h-8 text-xs shrink-0" onClick={() => setShowLibrary(true)}>
                    <RefreshCw className="h-3.5 w-3.5" /> Replace
                  </Button>
                </div>

                {/* Player body */}
                <div className="flex-1 flex flex-col items-center justify-center p-8 bg-muted/20">
                  <div className="w-full max-w-2xl flex flex-col gap-6">

                    {/* Waveform — mirrored bars */}
                    <div className="relative rounded-xl overflow-hidden bg-black/70 border border-border/60" style={{ height: 160 }}>
                      <div className="absolute inset-0 flex items-center gap-[2px] px-4 py-5">
                        {waveformBars.map((v, wbi) => {
                          const h = Math.max(3, v * 100);
                          return (
                            <div key={wbi} className="flex-1 flex flex-col" style={{ height: "100%" }}>
                              {/* Top half — grows up from center */}
                              <div className="flex-1 flex flex-col justify-end">
                                <div className="w-full rounded-t-[1px] bg-primary" style={{ height: `${h}%`, opacity: 0.85 }} />
                              </div>
                              {/* Bottom half — mirror, shorter + more transparent */}
                              <div className="flex-1 flex flex-col justify-start">
                                <div className="w-full rounded-b-[1px] bg-primary" style={{ height: `${h * 0.55}%`, opacity: 0.35 }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Seek bar + timestamps */}
                    <div className="flex flex-col gap-1.5">
                      <div
                        className="relative flex items-center cursor-pointer group py-2"
                        onClick={handleSeek}
                      >
                        <div className="w-full h-1.5 bg-secondary rounded-full relative">
                          <div className="absolute left-0 top-0 h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                          <div
                            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white border-2 border-primary rounded-full shadow-md -translate-x-1/2 transition-opacity opacity-0 group-hover:opacity-100"
                            style={{ left: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums px-0.5">
                        <span>{fmt(audioCurrentTime)}</span>
                        <span>{fmt(audioDuration)}</span>
                      </div>
                    </div>

                    {/* Transport controls */}
                    <div className="flex items-center justify-center gap-5">
                      {/* Skip to start */}
                      <button
                        onClick={() => handleSkip(-audioDuration)}
                        title="Skip to start"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <SkipBack className="h-5 w-5" />
                      </button>

                      {/* −10s */}
                      <button
                        onClick={() => handleSkip(-10)}
                        title="Back 10 seconds"
                        className="text-muted-foreground hover:text-foreground transition-colors text-[11px] font-bold w-8 text-center"
                      >
                        −10s
                      </button>

                      {/* Play / Pause */}
                      <button
                        onClick={audioPlaying ? handlePause : handlePlay}
                        className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all shadow-lg"
                      >
                        {audioPlaying
                          ? <Pause className="h-6 w-6 fill-current" />
                          : <Play className="h-6 w-6 fill-current ml-0.5" />}
                      </button>

                      {/* +10s */}
                      <button
                        onClick={() => handleSkip(10)}
                        title="Forward 10 seconds"
                        className="text-muted-foreground hover:text-foreground transition-colors text-[11px] font-bold w-8 text-center"
                      >
                        +10s
                      </button>

                      {/* Skip to end */}
                      <button
                        onClick={() => handleSkip(audioDuration)}
                        title="Skip to end"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <SkipForward className="h-5 w-5" />
                      </button>

                      {/* Loop toggle */}
                      <button
                        onClick={handleToggleLoop}
                        title={audioLoop ? "Loop on" : "Loop off"}
                        className={`transition-colors ${audioLoop ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        <Repeat className="h-5 w-5" />
                      </button>
                    </div>

                    <p className="text-center text-[11px] text-muted-foreground">
                      Audio plays through this computer only · Nothing is shown on the projection screen
                    </p>
                  </div>
                </div>
              </>
            );
          })()
        ) : currentSong?.itemType === "media" ? (
          /* ── Image media ── */
          (() => {
            const imgPath = currentSong.mediaPath;
            const isLive = !isBlank && !isLogo && activeSlideIdx === 0 && liveItemIdxRef.current === selectedSongIdx;
            const previewObjectFit = imgScaleMode === "stretch" ? "fill" : imgScaleMode;
            return (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-5 py-3 border-b border-border bg-card shrink-0 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-semibold truncate">{currentSong.title}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {isLive ? "On screen" : "Not on screen"}
                  </span>
                </div>

                {/* Image preview — fills available space */}
                <div className="flex-1 flex items-center justify-center p-6 min-h-0 bg-background/50">
                  <div
                    className={`relative overflow-hidden rounded-xl border-2 w-full transition-all duration-200 ${
                      isLive
                        ? "border-red-500/70 shadow-[0_0_24px_rgba(239,68,68,0.18)]"
                        : "border-border"
                    }`}
                    style={{ aspectRatio: "16/9", maxHeight: "100%", background: "#000" }}
                  >
                    {imgPath ? (
                      <img
                        src={`file://${imgPath}`}
                        className="absolute inset-0 w-full h-full"
                        style={{ objectFit: previewObjectFit }}
                        alt=""
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <ImageIcon className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </div>

              </div>
            );
          })()
        ) : currentSong ? (
          /* ── Song / Scripture — hero LIVE preview layout ── */
          <>
            {/* LIVE Preview — full width hero */}
            <div className="shrink-0 border-b border-border bg-card px-4 pt-3 pb-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="flex h-2 w-2 relative shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
                <span className="text-[10px] font-black text-red-400 tracking-widest">LIVE — AUDIENCE VIEW</span>
                <span className="flex-1" />
                {currentSlide && <span className="text-[10px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">{currentSlide.sectionLabel}</span>}
              </div>
              <div className="flex justify-center">
              <div className="relative overflow-hidden rounded-xl border-2 border-red-500/70 bg-black shadow-[0_0_24px_rgba(239,68,68,0.18)]" style={{ height: "clamp(140px, 28vh, 300px)", aspectRatio: "16/9", containerType: "inline-size" }}>
                {!isLogo && effectiveBg && currentSlide && !isBlank && (
                  effectiveBg.startsWith("color:") ? (
                    <div className="absolute inset-0" style={{ background: effectiveBg.replace("color:", "") }} />
                  ) : /\.(mp4|webm|mov)$/i.test(effectiveBg) ? (
                    <video src={`file://${encodeURI(effectiveBg)}`} className="absolute inset-0 w-full h-full object-cover" muted preload="metadata" />
                  ) : (
                    <>
                      <img src={`file://${effectiveBg}`} className="absolute inset-0 w-full h-full object-cover" alt="" />
                      <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${effectiveTheme.overlayOpacity / 100})` }} />
                    </>
                  )
                )}
                {isLogo ? (
                  <div className="absolute inset-0 bg-black flex items-center justify-center">
                    <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "rgba(255,255,255,0.15)", letterSpacing: "-0.03em", fontSize: 14 }}>
                      WorshipSync
                    </span>
                  </div>
                ) : currentSlide && !isBlank ? (
                  currentSlide.sectionType === "verse" && currentSong?.itemType === "scripture" ? (
                    <div className="absolute inset-0 flex flex-col px-3 pt-2 pb-1.5">
                      <div className="flex-1 flex items-center justify-center min-h-0">
                        <p className="text-center font-bold leading-snug whitespace-pre-wrap relative z-10 w-full"
                          style={{ fontSize: "4.5cqw", color: effectiveTheme.textColor, fontFamily: effectiveTheme.fontFamily }}>
                          {isTextCleared ? "" : currentSlide.lines.join("\n")}
                        </p>
                      </div>
                      <p className="text-center font-semibold relative z-10 shrink-0 truncate"
                        style={{ fontSize: "2.2cqw", color: "rgba(255,255,255,0.65)", fontFamily: effectiveTheme.fontFamily }}>
                        {currentSlide.sectionLabel}
                      </p>
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center px-3">
                      <p className="text-center font-bold leading-snug whitespace-pre-wrap relative z-10 w-full"
                        style={{ fontSize: "5cqw", color: effectiveTheme.textColor, fontFamily: effectiveTheme.fontFamily, textAlign: effectiveTheme.textAlign, textShadow: effectiveTheme.textShadowOpacity > 0 ? `0 1px 3px rgba(0,0,0,${effectiveTheme.textShadowOpacity / 100})` : "none" }}>
                        {isTextCleared ? "" : currentSlide.lines.join("\n")}
                      </p>
                    </div>
                  )
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <MonitorOff className="h-5 w-5 text-gray-600" />
                  </div>
                )}
              </div>
              </div>{/* end flex justify-center */}
              {/* Slide text readout — shows exactly what's projected */}
              {currentSlide && !isBlank && !isLogo && currentSlide.sectionType !== "blank" && (
                <div className="mt-2 px-1 min-h-[1.6rem] flex items-center justify-center">
                  <p className="text-center text-[11px] font-medium text-zinc-400 leading-snug line-clamp-2 whitespace-pre-wrap">
                    {isTextCleared ? <span className="italic text-zinc-600">Text cleared</span> : currentSlide.lines.filter(Boolean).join(" · ")}
                  </p>
                </div>
              )}
              {(isBlank || isLogo) && (
                <div className="mt-2 px-1 min-h-[1.6rem] flex items-center justify-center">
                  <p className="text-[11px] font-semibold text-amber-500/70 italic">
                    {isBlank ? "Screen is blank" : "Logo showing"}
                  </p>
                </div>
              )}
            </div>

            {/* Song header + section tabs */}
            <div className="shrink-0 px-4 py-2.5 border-b border-border bg-card flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                <h2 className="text-sm font-bold truncate max-w-[160px]">{currentSong.title}</h2>
                <div className="flex gap-1 flex-wrap">
                  {sectionTabs.map(tab => (
                    <button
                      key={tab.sectionId}
                      onClick={() => sendSlide(selectedSongIdx, tab.firstSlideIdx)}
                      title={tab.fullLabel}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full leading-none transition-all duration-150 whitespace-nowrap ${
                        activeSectionId === tab.sectionId
                          ? "bg-red-500 text-white shadow-[0_0_8px_rgba(239,68,68,0.45)]"
                          : "bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {tab.fullLabel.length <= 8 ? tab.fullLabel : tab.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {activeSlideIdx >= 0 && currentSong.slides.length > 1 && (
                  <span className="text-[10px] tabular-nums text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {activeSlideIdx + 1} / {currentSong.slides.filter(s => s.sectionType !== "blank").length}
                  </span>
                )}
                {currentSong.itemType === "song" && (
                  <Button size="sm" className="h-7 text-xs gap-1 px-2" onClick={handleOpenEditLyrics}>
                    <Pencil className="h-3 w-3" /> Lyrics
                  </Button>
                )}
              </div>
            </div>

            {/* Slide grid — 4 columns */}
            <div ref={slideGridRef} className="flex-1 overflow-y-auto p-3">
              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
                {currentSong.slides.map((slide, i) => {
                  const isActive = activeSlideIdx === i;
                  const isNextSlide = activeSlideIdx >= 0 && i === activeSlideIdx + 1;
                  const bg = resolveBg(currentSong);
                  const abbrev = SECTION_ABBREVS[slide.sectionType] ?? slide.sectionLabel[0];
                  return (
                    <div key={i} data-slide-idx={i} className="flex flex-col gap-1">
                      {/* Label row */}
                      <div className="flex items-center justify-between gap-1 px-0.5 h-4">
                        <div className="flex items-center gap-1 min-w-0">
                          {currentSong.itemType !== "scripture" && slide.sectionType !== "blank" && (
                            <span className={`text-[9px] font-bold px-1 py-0.5 rounded leading-none shrink-0 ${isActive ? "bg-red-500 text-white" : isNextSlide ? "bg-green-500 text-white" : "bg-muted-foreground text-background"}`}>
                              {abbrev}
                            </span>
                          )}
                          <span className={`text-[10px] font-semibold truncate ${isActive ? "text-red-400" : isNextSlide ? "text-green-400" : "text-muted-foreground"}`}>
                            {slide.sectionLabel}
                          </span>
                        </div>
                        {isActive && <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-red-500/20 text-red-400 leading-none shrink-0">LIVE</span>}
                        {isNextSlide && <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-green-500/20 text-green-300 leading-none shrink-0">NEXT</span>}
                      </div>
                      <button
                        onClick={(e) => { e.currentTarget.blur(); sendSlide(selectedSongIdx, i); }}
                        className={`relative w-full overflow-hidden rounded-md focus:outline-none border-2 transition-all duration-150 ${
                          isActive
                            ? "border-red-500 ring-2 ring-red-500/25 scale-[1.015]"
                            : isNextSlide
                            ? "border-green-500/60"
                            : "border-transparent hover:border-muted-foreground/30"
                        }`}
                        style={{ outline: "none" }}
                      >
                        <div className="w-full" style={{ paddingBottom: "56.25%" }} />
                        <div className="absolute inset-0">
                          {/* Background */}
                          {bg && slide.sectionType !== "blank" ? (
                            bg.startsWith("color:") ? (
                              <div className="absolute inset-0" style={{ background: bg.replace("color:", "") }} />
                            ) : /\.(mp4|webm|mov)$/i.test(bg) ? (
                              <video src={`file://${encodeURI(bg)}`} className="absolute inset-0 w-full h-full object-cover" muted preload="metadata" />
                            ) : (
                              <>
                                <img src={`file://${bg}`} className="absolute inset-0 w-full h-full object-cover" alt="" />
                                <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${effectiveTheme.overlayOpacity / 100})` }} />
                              </>
                            )
                          ) : (
                            <div className="absolute inset-0 bg-black" />
                          )}

                          {slide.sectionType === "verse" && currentSong.itemType === "scripture" ? (
                            /* Scripture: verse text centered + reference at bottom */
                            <div className="absolute inset-0 flex flex-col px-2 pt-2 pb-1.5">
                              <div className="flex-1 flex items-center justify-center min-h-0">
                                <p className="text-center font-bold text-[10px] leading-snug whitespace-pre-wrap relative z-10"
                                  style={{ color: effectiveTheme.textColor, fontFamily: effectiveTheme.fontFamily }}>
                                  {slide.lines.join("\n")}
                                </p>
                              </div>
                              <p className="text-center text-[9px] font-semibold relative z-10 shrink-0 truncate"
                                style={{ color: "rgba(255,255,255,0.6)", fontFamily: effectiveTheme.fontFamily }}>
                                {slide.sectionLabel}
                              </p>
                            </div>
                          ) : (
                            /* Songs / other: original centered layout */
                            <div className="absolute inset-0 flex items-center justify-center px-2">
                              <p className="relative z-10 text-center font-bold text-[11px] leading-snug whitespace-pre-wrap"
                                style={{ color: effectiveTheme.textColor, fontFamily: effectiveTheme.fontFamily, textShadow: effectiveTheme.textShadowOpacity > 0 ? `0 1px 3px rgba(0,0,0,${effectiveTheme.textShadowOpacity / 100})` : "none" }}>
                                {slide.sectionType === "blank" ? "" : slide.lines.join("\n")}
                              </p>
                            </div>
                          )}
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Select an item from the lineup</p>
          </div>
        )}
      </div>

      {/* ═════ RIGHT: Controls Panel (272px) ═════ */}
      <div className="w-[272px] shrink-0 border-l border-border flex flex-col bg-card overflow-hidden">

        {/* ── Zone 1: TO BLACK — primary safety button, hero size ── */}
        <div className="p-3 pb-2 shrink-0">
          {isBlank ? (
            <button
              onClick={() => {
                if (activeSlideIdx >= 0) sendSlide(selectedSongIdx, activeSlideIdx);
                else { window.worshipsync.slide.blank(false); setIsBlank(false); }
              }}
              className="w-full py-4 rounded-xl text-sm font-black uppercase tracking-wide flex items-center justify-center gap-3 transition-all duration-150
                         bg-amber-500/10 border-2 border-amber-400/50 text-amber-300
                         hover:bg-amber-500/20 hover:border-amber-400/70 active:scale-[0.98]
                         shadow-[0_0_20px_rgba(251,191,36,0.12)]"
            >
              <span className="flex h-2.5 w-2.5 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400" />
              </span>
              <span>Screen Blanked</span>
              <span className="ml-auto text-[10px] font-bold bg-amber-500/15 text-amber-400/80 px-1.5 py-0.5 rounded-md">[B]</span>
            </button>
          ) : (
            <button
              onClick={toBlack}
              className="w-full py-4 rounded-xl text-sm font-black uppercase tracking-wide flex items-center justify-center gap-3 transition-all duration-150
                         bg-zinc-900 border-2 border-zinc-700 text-zinc-200
                         hover:bg-zinc-800 hover:border-zinc-500 hover:text-white active:scale-[0.98]
                         hover:shadow-[0_0_16px_rgba(239,68,68,0.12)]"
            >
              <MonitorOff className="h-4.5 w-4.5 shrink-0" />
              <span>To Black</span>
              <span className="ml-auto text-[10px] font-normal text-zinc-500">[B]</span>
            </button>
          )}
        </div>

        {/* ── Zone 2: Quick Actions — 3-up ── */}
        <div className="px-3 pb-3 border-b border-border shrink-0">
          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={clearText}
              className={`py-2 px-2 rounded-lg text-[11px] font-semibold border transition-all duration-150 text-center active:scale-[0.97] ${isTextCleared ? "bg-primary/15 text-primary border-primary/35 shadow-[0_0_8px_rgba(139,92,246,0.15)]" : "bg-muted/40 border-border/60 hover:bg-muted hover:text-foreground text-muted-foreground"}`}
            >
              {isTextCleared ? "Restore" : "Clear Text"}
            </button>
            <button
              onClick={clearAll}
              className="py-2 px-2 rounded-lg text-[11px] font-semibold border border-border/60 bg-muted/40 hover:bg-muted hover:text-foreground text-muted-foreground transition-all duration-150 text-center active:scale-[0.97]"
            >
              Clear All
            </button>
            <button
              onClick={() => {
                if (isLogo) {
                  window.worshipsync.slide.logo(false);
                  setIsLogo(false);
                  window.worshipsync.slide.blank(true);
                  setIsBlank(true);
                } else {
                  showLogo();
                }
              }}
              className={`py-2 px-2 rounded-lg text-[11px] font-semibold border transition-all duration-150 text-center active:scale-[0.97] ${isLogo ? "bg-amber-500/15 text-amber-400 border-amber-500/35" : "bg-muted/40 border-border/60 hover:bg-muted hover:text-foreground text-muted-foreground"}`}
            >
              {isLogo ? "Hide Logo" : "Logo"}
            </button>
          </div>
        </div>

        {/* ── Zone 3: Item Navigation — shows what you're jumping to ── */}
        {(() => {
          let prevIdx = selectedSongIdx - 1;
          while (prevIdx >= 0 && liveSongs[prevIdx]?.itemType === "section") prevIdx--;
          let nextIdx = selectedSongIdx + 1;
          while (nextIdx < liveSongs.length && liveSongs[nextIdx]?.itemType === "section") nextIdx++;
          const prevItem = prevIdx >= 0 ? liveSongs[prevIdx] : null;
          const nextItem = nextIdx < liveSongs.length ? liveSongs[nextIdx] : null;
          return (
            <div className="px-3 py-2.5 border-b border-border shrink-0">
              <div className="flex gap-1.5">
                <button
                  onClick={goPrevSong}
                  disabled={!prevItem}
                  title={prevItem?.title}
                  className="flex-1 flex items-center gap-1 py-2 px-2 rounded-lg text-xs font-semibold border border-border/70 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-150 disabled:opacity-25 disabled:cursor-not-allowed active:scale-[0.97] min-w-0"
                >
                  <SkipBack className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{prevItem?.title ?? "—"}</span>
                </button>
                <button
                  onClick={goNextSong}
                  disabled={!nextItem}
                  title={nextItem?.title}
                  className="flex-1 flex items-center justify-end gap-1 py-2 px-2 rounded-lg text-xs font-semibold border border-border/70 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-150 disabled:opacity-25 disabled:cursor-not-allowed active:scale-[0.97] min-w-0"
                >
                  <span className="truncate">{nextItem?.title ?? "—"}</span>
                  <SkipForward className="h-3.5 w-3.5 shrink-0" />
                </button>
              </div>
            </div>
          );
        })()}

        {/* ── Zone 4: NEXT Preview ── */}
        {nextUp && nextUp.slide.sectionType !== "blank" && (() => {
          const nextUpSong = nextUp.songTitle ? nextSong : currentSong;
          const nextUpTheme = nextUpSong ? resolveTheme(nextUpSong) : effectiveTheme;
          const nextUpBg = nextUpSong ? resolveBg(nextUpSong) : effectiveBg;
          return (
            <div className="px-3 py-2.5 border-b border-border shrink-0">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[10px] font-black text-green-400 tracking-wider">NEXT</span>
                <span className="text-[10px] text-muted-foreground truncate">
                  {nextUp.songTitle ? `${nextUp.songTitle} — ${nextUp.slide.sectionLabel}` : nextUp.slide.sectionLabel}
                </span>
              </div>
              <div className="relative overflow-hidden rounded-lg border border-green-500/35 bg-black" style={{ aspectRatio: "16/9", containerType: "inline-size" }}>
                {nextUpBg && (
                  nextUpBg.startsWith("color:") ? (
                    <div className="absolute inset-0" style={{ background: nextUpBg.replace("color:", "") }} />
                  ) : (
                    <>
                      <img src={`file://${nextUpBg}`} className="absolute inset-0 w-full h-full object-cover" alt="" />
                      <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${nextUpTheme.overlayOpacity / 100})` }} />
                    </>
                  )
                )}
                {nextUp.slide.sectionType === "verse" && nextUpSong?.itemType === "scripture" ? (
                  <div className="absolute inset-0 flex flex-col px-2 pt-1.5 pb-1">
                    <div className="flex-1 flex items-center justify-center min-h-0">
                      <p className="text-center font-bold leading-snug whitespace-pre-wrap relative z-10 w-full"
                        style={{ fontSize: "4.5cqw", color: nextUpTheme.textColor, fontFamily: nextUpTheme.fontFamily }}>
                        {nextUp.slide.lines.join("\n")}
                      </p>
                    </div>
                    <p className="text-center font-semibold relative z-10 shrink-0 truncate"
                      style={{ fontSize: "2.2cqw", color: "rgba(255,255,255,0.65)" }}>
                      {nextUp.slide.sectionLabel}
                    </p>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center px-2">
                    <p className="text-center font-bold leading-snug whitespace-pre-wrap relative z-10 w-full"
                      style={{ fontSize: "5cqw", color: nextUpTheme.textColor, fontFamily: nextUpTheme.fontFamily, textAlign: nextUpTheme.textAlign }}>
                      {nextUp.slide.lines.join("\n")}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ── Image controls — shown only for image media items (not audio/video) ── */}
        {currentSong?.itemType === "media" && !/\.(mp4|webm|mov|mp3|wav|ogg|m4a|aac|flac)$/i.test(currentSong.mediaPath ?? "") && (() => {
          const imgPath = currentSong.mediaPath;
          const isLive = !isBlank && !isLogo && activeSlideIdx === 0 && liveItemIdxRef.current === selectedSongIdx;
          const showImage = () => {
            if (!imgPath) return;
            window.worshipsync.slide.blank(false);
            window.worshipsync.slide.logo(false);
            window.worshipsync.slide.show({
              lines: [],
              songTitle: currentSong.title,
              sectionLabel: "",
              itemType: "media",
              slideIndex: 0,
              totalSlides: 1,
              lineupItemId: currentSong.lineupItemId,
              backgroundPath: imgPath,
              theme: {
                fontFamily: DEFAULT_THEME.fontFamily,
                fontSize: DEFAULT_THEME.fontSize,
                fontWeight: DEFAULT_THEME.fontWeight,
                textColor: DEFAULT_THEME.textColor,
                textAlign: DEFAULT_THEME.textAlign,
                textPosition: DEFAULT_THEME.textPosition,
                overlayOpacity: 0,
                textShadowOpacity: 0,
                maxLinesPerSlide: DEFAULT_THEME.maxLinesPerSlide,
                backgroundScaleMode: imgScaleMode,
              },
            });
            setIsBlank(false);
            setIsLogo(false);
            setActiveSlideIdx(0);
            liveItemIdxRef.current      = selectedSongIdx;
            liveSlideIdxRef.current     = 0;
            liveImgScaleModeRef.current = imgScaleMode;
          };
          const scaleModes: { value: typeof imgScaleMode; label: string }[] = [
            { value: "cover",   label: "Fill" },
            { value: "contain", label: "Fit" },
            { value: "stretch", label: "Stretch" },
          ];
          const handleScaleMode = (mode: typeof imgScaleMode) => {
            setImgScaleMode(mode);
            patchImageScaleMode(currentSong.lineupItemId, mode);
          };
          return (
            <div className="px-3 py-3 border-b border-border shrink-0 flex flex-col gap-2.5">
              {/* Scale mode toggle */}
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Scale Mode</h3>
                <div className="flex rounded-lg overflow-hidden border border-border">
                  {scaleModes.map(m => (
                    <button
                      key={m.value}
                      onClick={() => handleScaleMode(m.value)}
                      className={`flex-1 py-1.5 text-[11px] font-semibold transition-colors ${
                        imgScaleMode === m.value
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-muted-foreground hover:bg-accent/40"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Show on Screen */}
              <button
                onClick={showImage}
                disabled={!imgPath || (isLive && imgScaleMode === liveImgScaleModeRef.current)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black uppercase tracking-wide transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_12px_rgba(139,92,246,0.2)]"
              >
                <Cast className="h-4 w-4" />
                {isLive && imgScaleMode !== liveImgScaleModeRef.current ? "Update Scale" : "Show on Screen"}
              </button>
            </div>
          );
        })()}

        {/* Active Background — not shown for media items (image/audio/video) */}
        {!(currentSong?.itemType === "media") && <div className="px-3 py-3 border-b border-border shrink-0">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Active Background</h3>
          <div
            className="flex items-center gap-2.5 p-2 rounded-md bg-background/40 border border-border cursor-pointer hover:bg-accent/30 transition-colors"
            onClick={() => setShowBgPicker(v => !v)}
          >
            <div className="w-14 h-8 rounded overflow-hidden shrink-0 border border-border bg-black flex items-center justify-center">
              {effectiveBg ? (
                effectiveBg.startsWith("color:") ? (
                  <div className="w-full h-full" style={{ background: effectiveBg.replace("color:", "") }} />
                ) : (
                  <img src={`file://${effectiveBg}`} className="w-full h-full object-cover" alt="" />
                )
              ) : (
                <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              {effectiveBg ? (
                <>
                  <p className="text-[11px] font-medium truncate">{effectiveBg.split("/").pop() ?? "Background"}</p>
                  <p className={`text-[10px] ${/\.(mp4|webm|mov)$/i.test(effectiveBg) ? "text-green-400" : "text-muted-foreground"}`}>
                    {/\.(mp4|webm|mov)$/i.test(effectiveBg) ? "Playing • Looped" : "Static"}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[11px] font-medium text-muted-foreground">No background</p>
                  <p className="text-[10px] text-muted-foreground/60">Click to set one</p>
                </>
              )}
            </div>
          </div>
        </div>}

        {/* Cue Notes */}
        {currentSong?.notes && (
          <div className="px-3 py-3 border-b border-border shrink-0 bg-amber-500/5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
              <h3 className="text-[10px] font-black uppercase tracking-wider text-amber-400/80">Cue Notes</h3>
            </div>
            <p className="text-[11px] text-amber-300/80 leading-relaxed whitespace-pre-wrap break-words">
              {currentSong.notes}
            </p>
          </div>
        )}

        <div className="flex-1" />

        {/* Next Slide button */}
        <div className="p-3 shrink-0">
          <button
            onClick={goNextSlide}
            className="w-full py-3 bg-foreground text-background rounded-lg text-sm font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            Next Slide <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      </div>{/* end inner row */}

      {/* ═════ BOTTOM OUTPUT BAR ═════ */}
      {outputBarCollapsed ? (

        /* ── Collapsed: 32px status strip ── */
        <div className="shrink-0 border-t border-border bg-card flex items-center px-4 gap-3" style={{ height: 32 }}>
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${!isBlank && !isLogo && activeSlideIdx >= 0 ? "bg-green-500" : "bg-muted-foreground/30"}`} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground shrink-0">Main</span>
            <span className="text-[10px] text-muted-foreground/60 truncate">
              — {displays.find(d => d.id === selectedDisplayId)?.label ?? "—"}
            </span>
          </div>
          <div className="h-4 w-px bg-border shrink-0" />
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${confidenceOpen ? "bg-amber-400" : "bg-muted-foreground/30"}`} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground shrink-0">Confidence</span>
            <span className={`text-[10px] font-semibold shrink-0 ${confidenceOpen ? "text-amber-400" : "text-muted-foreground/50"}`}>
              {confidenceOpen ? "ON" : "OFF"}
            </span>
            {confidenceOpen && (
              <span className="text-[10px] text-muted-foreground/60 truncate">
                — {displays.find(d => d.id === selectedConfidenceDisplayId)?.label ?? "—"}
              </span>
            )}
          </div>
          <button
            onClick={() => setOutputBarCollapsed(false)}
            className="ml-auto shrink-0 flex items-center gap-1.5 h-6 px-2 rounded text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
            title="Expand output bar"
          >
            <Tv className="h-3 w-3" />
            <span className="text-[9px] font-black uppercase tracking-widest">Outputs</span>
            <ChevronUp className="h-3 w-3" />
          </button>
        </div>

      ) : (

        /* ── Expanded: full 116px bar ── */
        <div className="shrink-0 border-t border-border bg-card flex" style={{ height: 125 }}>

          {/* ─ Main Projection ─ */}
          <div className="flex-1 flex items-center gap-3 px-4 border-r border-border min-w-0">
            <div className="shrink-0 rounded-md overflow-hidden border border-border bg-black relative" style={{ width: 180, height: 101 }}>
              {/* Background layer */}
              {!isBlank && !isLogo && liveBg && liveSlide?.sectionType !== "blank" && (
                liveBg.startsWith("color:") ? (
                  <div className="absolute inset-0" style={{ background: liveBg.replace("color:", "") }} />
                ) : /\.(mp4|webm|mov)$/i.test(liveBg) ? (
                  <video src={`file://${encodeURI(liveBg)}`} className="absolute inset-0 w-full h-full object-cover" muted preload="metadata" />
                ) : (
                  <>
                    <img src={`file://${liveBg}`} className="absolute inset-0 w-full h-full object-cover" alt="" />
                    <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${liveTheme.overlayOpacity / 100})` }} />
                  </>
                )
              )}
              {/* Content / state overlay */}
              {isLogo ? (
                <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-black flex flex-col items-center justify-center gap-1">
                  <Tv className="h-4 w-4 text-muted-foreground/40" />
                  <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/40">Logo</span>
                </div>
              ) : isBlank ? (
                <div className="absolute inset-0 bg-black flex flex-col items-center justify-center gap-1">
                  <MonitorOff className="h-4 w-4 text-muted-foreground/25" />
                  <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/25">Blank</span>
                </div>
              ) : countdownRunning ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.52) 0%, rgba(0,0,0,0.62) 100%), linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)" }}>
                  <div style={{ fontSize: 7, fontWeight: 800, letterSpacing: "0.3em", textTransform: "uppercase", color: "#fff", marginBottom: 2 }}>Welcome</div>
                  <div style={{ fontSize: 5, color: "rgba(255,255,255,0.7)", marginBottom: 5 }}>Our Sunday Service will begin in</div>
                  {(() => {
                    const hasDays = countdownDisplay.includes("d");
                    const timePart = hasDays ? (countdownDisplay.split(" ")[1] ?? "00:00:00") : countdownDisplay;
                    const dayVal = hasDays ? (countdownDisplay.split(" ")[0] ?? "").replace("d", "") : null;
                    const segs = timePart.split(":");
                    const showHours = hasDays || Number(segs[0]) > 0;
                    const segments: { v: string; lbl: string }[] = [];
                    if (dayVal && Number(dayVal) > 0) segments.push({ v: dayVal, lbl: "Days" });
                    if (showHours) segments.push({ v: segs[0] ?? "00", lbl: "Hrs" });
                    segments.push({ v: segs[segs.length - 2] ?? "00", lbl: "Min" });
                    segments.push({ v: segs[segs.length - 1] ?? "00", lbl: "Sec" });
                    return (
                      <div style={{ display: "flex", alignItems: "flex-end", gap: 0 }}>
                        {segments.map((seg, i) => (
                          <div key={seg.lbl} style={{ display: "flex", alignItems: "flex-end" }}>
                            {i > 0 && <span style={{ fontSize: 14, fontWeight: 800, color: "rgba(255,255,255,0.4)", lineHeight: 1, paddingBottom: 6, margin: "0 1px" }}>:</span>}
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                              <span style={{ fontSize: 20, fontWeight: 800, color: "#fff", lineHeight: 1, fontVariantNumeric: "tabular-nums", letterSpacing: "0.03em" }}>{seg.v}</span>
                              <span style={{ fontSize: 4, fontWeight: 600, color: "rgba(255,255,255,0.5)", letterSpacing: "0.2em", textTransform: "uppercase", marginTop: 2 }}>{seg.lbl}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  <div style={{ fontSize: 5, color: "rgba(255,255,255,0.55)", marginTop: 5, textAlign: "center" }}>Please find your seats</div>
                </div>
              ) : liveSlide && liveSlide.sectionType !== "blank" ? (
                <div className="absolute inset-0 flex items-center justify-center p-2">
                  <p className="text-[9px] text-white/90 font-medium text-center leading-snug line-clamp-4 whitespace-pre-wrap" style={{ color: liveTheme.textColor }}>
                    {liveSlide.lines.join("\n")}
                  </p>
                </div>
              ) : (
                <div className="absolute inset-0 bg-zinc-950 flex items-center justify-center">
                  <span className="text-[9px] text-muted-foreground/30">Nothing live</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
              <div className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${!isBlank && !isLogo && (countdownRunning || liveSlideIdxRef.current >= 0) ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Main Projection</span>
              </div>
              <select
                className="w-full bg-input text-[11px] text-foreground border border-border rounded px-2 py-1.5 outline-none cursor-pointer"
                value={selectedDisplayId ?? ""}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  setSelectedDisplayId(id);
                  if (projectionOpen) window.worshipsync.window.moveProjection(id);
                }}
              >
                {displays.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}{d.isPrimary ? " (Primary)" : ""} — {d.width}×{d.height}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ─ Confidence Monitor ─ */}
          <div className="flex-1 flex items-center gap-3 px-4 border-r border-border min-w-0">
            {/* Miniature confidence monitor — matches the actual window's look */}
            <div
              className="shrink-0 rounded-md overflow-hidden border relative"
              style={{
                width: 180, height: 101,
                background: "#080810",
                borderColor: confidenceOpen ? "rgba(139,92,246,0.35)" : "rgba(255,255,255,0.08)",
              }}
            >
              {!confidenceOpen ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                  <MonitorOff className="h-3.5 w-3.5" style={{ color: "rgba(255,255,255,0.15)" }} />
                  <span className="text-[8px] font-medium" style={{ color: "rgba(255,255,255,0.15)" }}>Off</span>
                </div>
              ) : isBlank ? (
                liveEnlargedNext ? liveEnlargedNext : (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ background: "#000" }}>
                    <span className="text-[7px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.12)" }}>Screen Blank</span>
                  </div>
                )
              ) : countdownRunning ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                  <span className="font-bold tabular-nums" style={{ fontSize: 22, letterSpacing: "-0.03em", fontFamily: "'SF Mono','Fira Code',monospace", color: "#ffffff" }}>
                    {countdownDisplay}
                  </span>
                  <span className="text-[6px] font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>Until Service Starts</span>
                </div>
              ) : liveSlide && liveSlide.sectionType !== "blank" && liveSong?.itemType === "announcement" && liveSlide.cards?.filter(c => c.heading).length ? (
                <div className="absolute inset-0 flex flex-col justify-center gap-1 px-2 py-1.5 overflow-hidden">
                  <span className="text-[7px] font-black uppercase tracking-widest text-center" style={{ color: "#fbbf24", opacity: 0.8 }}>
                    {liveSong.title}
                  </span>
                  {liveSlide.cards.filter(c => c.heading).slice(0, 3).map(card => (
                    <div key={card.id} className="flex items-center gap-1 min-w-0">
                      {(card.day || card.time) && (
                        <span className="shrink-0 rounded px-1 text-[5px] font-black leading-tight text-center" style={{ background: liveTheme.accentColor ?? '#fbbf24', color: '#000', minWidth: 18 }}>
                          {card.day && <span style={{ display: 'block' }}>{card.day}</span>}
                          {card.time && <span style={{ display: 'block' }}>{card.time}</span>}
                        </span>
                      )}
                      <span className="text-[7px] font-semibold leading-tight truncate" style={{ color: '#fff' }}>{card.heading}</span>
                    </div>
                  ))}
                  {liveSlide.cards.filter(c => c.heading).length > 3 && (
                    <span className="text-[6px] text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>+{liveSlide.cards.filter(c => c.heading).length - 3} more</span>
                  )}
                </div>
              ) : liveSlide && liveSlide.sectionType !== "blank" && liveSlide.lines.filter(Boolean).length > 0 ? (
                <div className="absolute inset-0 flex flex-col">
                  {/* Text — left-aligned for scripture, centered for lyrics */}
                  <div className="flex-1 flex items-center justify-center px-2 pt-1.5 min-h-0 overflow-hidden">
                    <p className={`text-[8px] font-bold leading-snug line-clamp-4 whitespace-pre-wrap w-full ${liveSong?.itemType === "scripture" ? "text-left" : "text-center"}`} style={{ color: "#ffffff" }}>
                      {liveSlide.lines.filter(Boolean).join("\n")}
                    </p>
                  </div>
                  {/* Next panel — hidden for scripture, matches the trailing blank-slide preview */}
                  {showLiveNextPanel && liveNextPanel}
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[7px]" style={{ color: "rgba(255,255,255,0.18)" }}>Waiting for slides…</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
              <div className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${confidenceOpen ? "bg-amber-400" : "bg-muted-foreground/30"}`} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Confidence</span>
                <button
                  onClick={() => {
                    if (confidenceOpen) { window.worshipsync.confidence.close(); setConfidenceOpen(false); }
                    else { window.worshipsync.confidence.open(selectedConfidenceDisplayId); setConfidenceOpen(true); }
                  }}
                  className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                    confidenceOpen
                      ? "bg-amber-500/20 text-amber-400 hover:bg-red-500/15 hover:text-red-400"
                      : "bg-muted text-muted-foreground hover:bg-primary/20 hover:text-primary"
                  }`}
                >
                  {confidenceOpen ? "ON" : "OFF"}
                </button>
              </div>
              <select
                className="w-full bg-input text-[11px] text-foreground border border-border rounded px-2 py-1.5 outline-none cursor-pointer"
                value={selectedConfidenceDisplayId ?? ""}
                onChange={(e) => {
                  const id = Number(e.target.value) || undefined;
                  setSelectedConfidenceDisplayId(id);
                  if (confidenceOpen && id !== undefined) window.worshipsync.confidence.move(id);
                }}
              >
                {displays.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}{d.isPrimary ? " (Primary)" : ""} — {d.width}×{d.height}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ─ Outputs label + collapse ─ */}
          <div
            className="shrink-0 flex flex-col items-center justify-center self-stretch border-l border-border gap-1.5 px-3 cursor-pointer hover:bg-accent/20 transition-colors group"
            onClick={() => setOutputBarCollapsed(true)}
            title="Collapse output bar"
          >
            <Tv className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
            <span className="text-[7px] font-black uppercase tracking-[0.15em] text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors">Outputs</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
          </div>

        </div>
      )}

      </div>{/* end CENTER+RIGHT+OUTPUT column */}

      </div>{/* end BODY */}

      {/* Keyboard shortcuts overlay */}
      {showHelp && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="bg-card border border-border rounded-xl shadow-2xl w-[420px] max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Keyboard className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Keyboard Shortcuts</h3>
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Shortcut groups */}
            <div className="px-5 py-4 space-y-5 text-sm">
              {(
                [
                  {
                    group: "Navigation",
                    items: [
                      { keys: ["→", "Space"], label: "Next slide" },
                      { keys: ["←"], label: "Previous slide" },
                      { keys: ["Tab"], label: "Next item" },
                      { keys: ["⇧ Tab"], label: "Previous item" },
                    ],
                  },
                  {
                    group: "Output",
                    items: [
                      { keys: ["B"], label: "Toggle blank screen (black)" },
                      { keys: ["U"], label: "Unblank screen" },
                    ],
                  },
                  {
                    group: "Interface",
                    items: [
                      { keys: ["?"], label: "Toggle this help overlay" },
                      { keys: ["Esc"], label: "Close overlay" },
                    ],
                  },
                ] as { group: string; items: { keys: string[]; label: string }[] }[]
              ).map(({ group, items }) => (
                <div key={group}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                    {group}
                  </p>
                  <div className="space-y-1.5">
                    {items.map(({ keys, label }) => (
                      <div key={label} className="flex items-center justify-between gap-4">
                        <span className="text-foreground/80">{label}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {keys.map((k, i) => (
                            <React.Fragment key={k}>
                              {i > 0 && (
                                <span className="text-[10px] text-muted-foreground">or</span>
                              )}
                              <kbd className="inline-flex items-center justify-center min-w-[28px] h-6 px-1.5 rounded border border-border bg-background text-[11px] font-mono font-medium shadow-sm">
                                {k}
                              </kbd>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <p className="px-5 pb-4 text-[10px] text-muted-foreground">
              Press <kbd className="inline-flex items-center px-1 rounded border border-border bg-background font-mono text-[10px]">Esc</kbd> or click outside to dismiss.
            </p>
          </div>
        </div>
      )}

      {/* Library modal */}
      {showLibrary && (
        <LibraryModal
          onClose={() => { setShowLibrary(false); setInsertAfterSectionId(null); }}
          onAdd={handleLibraryAdd}
          onAddCountdown={async () => {
            const prevLen = useServiceStore.getState().lineup.length;
            await addCountdownToLineup();
            if (insertAfterSectionId !== null) await repositionAfterSection(insertAfterSectionId, prevLen);
          }}
          onAddScripture={handleAddScripture}
          onAddMedia={handleAddMedia}
          onAddAnnouncement={async (title, content) => {
            const prevLen = useServiceStore.getState().lineup.length;
            await addAnnouncementToLineup({ title, content });
            if (insertAfterSectionId !== null) await repositionAfterSection(insertAfterSectionId, prevLen);
          }}
          excludeIds={liveSongs
            .filter((s) => s.itemType === "song")
            .map((s) => s.songId)}
        />
      )}

      {showBgPicker && liveSongs[selectedSongIdx] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setShowBgPicker(false); setPendingBgSave(null); }}>
          <div className="bg-card border border-border rounded-xl shadow-2xl w-[420px] max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
              <span className="text-sm font-semibold">Background</span>
              <button onClick={() => { setShowBgPicker(false); setPendingBgSave(null); }} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              <BackgroundPickerPanel
                currentBackground={liveSongs[selectedSongIdx].backgroundPath}
                previewLabel={liveSongs[selectedSongIdx].title}
                onSelect={handleBackgroundSelect}
              />
            </div>
            {pendingBgSave && (
              <div className="shrink-0 border-t border-border bg-muted/40 px-4 py-3 flex items-center gap-3">
                <p className="text-xs text-muted-foreground flex-1">
                  Applied for this session only.
                </p>
                <button
                  onClick={() => { setPendingBgSave(null); setShowBgPicker(false); }}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Keep session only
                </button>
                <Button size="sm" className="h-7 text-xs gap-1.5" onClick={handleSaveBg} disabled={savingBg}>
                  {savingBg ? "Saving…" : "Save to song"}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {showEditLyrics && liveSongs[selectedSongIdx] && (
        <EditLyricsModal
          songTitle={liveSongs[selectedSongIdx].title}
          artist={liveSongs[selectedSongIdx].artist}
          initialLyrics={editLyricsInitial}
          onClose={() => setShowEditLyrics(false)}
          onSave={handleSaveLyrics}
        />
      )}
    </div>
  );
}

// ── Service Switcher Row ─────────────────────────────────────────────────────

function SwitcherRow({
  svc,
  isCurrent,
  isPending,
  onSelect,
}: {
  svc: ServiceDate;
  isCurrent: boolean;
  isPending: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      disabled={isCurrent}
      className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors
        ${isCurrent ? "bg-accent/40 cursor-default" : "hover:bg-accent"}
        ${isPending ? "bg-amber-500/10" : ""}`}
    >
      <Calendar className={`h-3.5 w-3.5 shrink-0 ${isPending ? "text-amber-500" : "text-muted-foreground"}`} />
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-medium truncate ${isPending ? "text-amber-500" : ""}`}>{svc.label}</p>
        <p className="text-[10px] text-muted-foreground">
          {new Date(svc.date + "T00:00:00").toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>
      {isCurrent && (
        <span className="text-[10px] font-semibold text-primary shrink-0">Active</span>
      )}
      {isPending && (
        <span className="text-[10px] font-semibold text-amber-500 shrink-0">Tap confirm</span>
      )}
    </button>
  );
}

// ── Pre-Live Idle State ──────────────────────────────────────────────────────

function PreLiveIdle({
  serviceLabel, songs, canGoLive, onStartLive,
  displays, selectedDisplayId, onDisplayChange,
  confidenceOpen, onToggleConfidence,
}: {
  serviceLabel: string
  songs: LiveSong[]
  canGoLive: boolean
  onStartLive: () => void
  displays: { id: number; label: string; width: number; height: number; isPrimary: boolean }[]
  selectedDisplayId: number | undefined
  onDisplayChange: (id: number) => void
  confidenceOpen: boolean
  onToggleConfidence: () => void
}) {
  const totalSlides = songs.reduce((sum, s) => sum + s.slides.filter(sl => sl.sectionType !== "blank").length, 0)
  const itemCount = songs.filter(s => s.itemType !== "section").length

  // Find the first real slide for the preview
  const firstSlide = useMemo(() => {
    for (const song of songs) {
      const slide = song.slides.find(s => s.sectionType !== "blank" && s.lines.filter(Boolean).length > 0)
      if (slide) return { song, slide }
    }
    return null
  }, [songs])

  const checks = [
    { label: `${itemCount} item${itemCount !== 1 ? "s" : ""} in lineup`, done: itemCount > 0, warn: itemCount === 0 },
    { label: "Output display selected", done: selectedDisplayId !== undefined, warn: false },
    { label: `Confidence monitor ${confidenceOpen ? "ON" : "OFF"}`, done: confidenceOpen, warn: false },
  ]

  return (
    <div className="h-full flex flex-col bg-background text-foreground overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-card shrink-0 flex items-center gap-3">
        <div className="flex h-2 w-2 relative">
          <span className="relative inline-flex rounded-full h-2 w-2 bg-muted-foreground/40" />
        </div>
        <div className="min-w-0">
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Pre-Flight Check</span>
          <p className="text-sm font-semibold text-foreground truncate">{serviceLabel}</p>
        </div>
      </div>

      {/* Body — two columns */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* Left: checklist + controls */}
        <div className="w-[340px] shrink-0 border-r border-border flex flex-col p-6 gap-5 overflow-y-auto">

          {/* Checklist */}
          <div className="flex flex-col gap-2">
            <h3 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1">Checklist</h3>
            {checks.map(c => (
              <div key={c.label} className="flex items-center gap-2.5">
                {c.done
                  ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  : c.warn
                    ? <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
                    : <Circle className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                }
                <span className={`text-[13px] ${c.done ? "text-foreground" : c.warn ? "text-amber-400" : "text-muted-foreground"}`}>
                  {c.label}
                </span>
              </div>
            ))}
          </div>

          <div className="h-px bg-border" />

          {/* Output display */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Output Display</label>
            <div className="flex items-center gap-2">
              <Tv className="h-4 w-4 text-muted-foreground shrink-0" />
              <select
                className="flex-1 bg-input border border-border rounded-md px-3 py-1.5 text-[13px] text-foreground cursor-pointer outline-none focus:border-primary/50"
                value={selectedDisplayId ?? ""}
                onChange={(e) => onDisplayChange(Number(e.target.value))}
              >
                {displays.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}{d.isPrimary ? " (Primary)" : ""} — {d.width}×{d.height}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Confidence monitor */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Confidence Monitor</label>
            <button
              onClick={onToggleConfidence}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${
                confidenceOpen
                  ? "bg-amber-500/10 border-amber-500/40 text-amber-300"
                  : "bg-muted/40 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <span className={`h-2 w-2 rounded-full shrink-0 ${confidenceOpen ? "bg-amber-400" : "bg-muted-foreground/40"}`} />
              <span className="text-[13px] font-medium flex-1 text-left">
                {confidenceOpen ? "On — showing to presenter" : "Off — click to enable"}
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${confidenceOpen ? "bg-amber-500/20 text-amber-400" : "bg-muted text-muted-foreground"}`}>
                {confidenceOpen ? "ON" : "OFF"}
              </span>
            </button>
          </div>

          {/* Stats */}
          {canGoLive && (
            <div className="flex gap-4 mt-auto pt-2">
              <div className="text-center">
                <p className="text-2xl font-black text-foreground">{itemCount}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Items</p>
              </div>
              <div className="h-full w-px bg-border" />
              <div className="text-center">
                <p className="text-2xl font-black text-foreground">{totalSlides}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Slides</p>
              </div>
            </div>
          )}
          {!canGoLive && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-400">No items in this lineup. Add songs in the Builder first.</p>
            </div>
          )}
        </div>

        {/* Right: first slide preview */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">First Slide</p>
          {firstSlide ? (
            <div className="w-full max-w-lg flex flex-col gap-2">
              <div
                className="relative overflow-hidden rounded-xl border-2 border-border bg-black w-full shadow-[0_0_32px_rgba(0,0,0,0.4)]"
                style={{ aspectRatio: "16/9", containerType: "inline-size" }}
              >
                {firstSlide.song.backgroundPath && (
                  <>
                    <img src={`file://${firstSlide.song.backgroundPath}`} className="absolute inset-0 w-full h-full object-cover" alt="" />
                    <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.45)" }} />
                  </>
                )}
                <div className="absolute inset-0 flex items-center justify-center px-8">
                  <p className="text-center font-bold leading-snug text-white" style={{ fontSize: "5cqw" }}>
                    {firstSlide.slide.lines.filter(Boolean).join("\n")}
                  </p>
                </div>
              </div>
              <p className="text-center text-[11px] text-muted-foreground">
                {firstSlide.song.title}
                {firstSlide.slide.sectionLabel ? ` · ${firstSlide.slide.sectionLabel}` : ""}
              </p>
            </div>
          ) : (
            <div className="w-full max-w-lg aspect-video rounded-xl border border-dashed border-border bg-muted/20 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">No slides to preview</p>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground/60 text-center max-w-xs">
            This is what the congregation will see the moment you go live.
          </p>
        </div>
      </div>

      {/* Bottom: big START LIVE button */}
      <div className="px-6 py-4 border-t border-border bg-card shrink-0">
        <button
          onClick={onStartLive}
          disabled={!canGoLive}
          className="w-full py-4 rounded-xl text-base font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed
            bg-green-600 hover:bg-green-500 text-white
            shadow-[0_0_24px_rgba(34,197,94,0.2)] hover:shadow-[0_0_32px_rgba(34,197,94,0.35)]
            active:scale-[0.99]"
        >
          <Play className="h-5 w-5 fill-white" />
          Start Live
        </button>
      </div>
    </div>
  )
}
