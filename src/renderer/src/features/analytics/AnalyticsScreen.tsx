import { useEffect, useState } from "react"
import {
  BarChart3, Calendar, Music2, Clock, ChevronDown,
  Download, TrendingUp, TrendingDown,
} from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────────────────

interface SongWithUsage {
  id: number
  title: string
  artist: string
  key: string | null
  usageCount: number
  lastUsedDate: string | null
  lastUsedLabel: string | null
}

interface ServiceDate {
  id: number
  date: string
  label: string
  status: string
  createdAt: string
  updatedAt: string
}

type Period = "3m" | "6m" | "1y" | "all"

const PERIOD_OPTIONS: { key: Period; label: string; months: number | null }[] = [
  { key: "3m",  label: "Last 3 Months", months: 3  },
  { key: "6m",  label: "Last 6 Months", months: 6  },
  { key: "1y",  label: "Last Year",     months: 12 },
  { key: "all", label: "All Time",      months: null },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function periodCutoff(period: Period): Date | null {
  const opt = PERIOD_OPTIONS.find(p => p.key === period)
  if (!opt?.months) return null
  const d = new Date()
  d.setMonth(d.getMonth() - opt.months)
  d.setHours(0, 0, 0, 0)
  return d
}

function daysAgo(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00")
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
}

function formatLastUsed(dateStr: string | null): string {
  if (!dateStr) return "Never used"
  const days = daysAgo(dateStr)
  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7)  return `${days} days ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks} week${weeks > 1 ? "s" : ""} ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months > 1 ? "s" : ""} ago`
  return `${Math.floor(days / 365)} year${days >= 730 ? "s" : ""} ago`
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AnalyticsScreen() {
  const [songUsage, setSongUsage]         = useState<SongWithUsage[]>([])
  const [serviceHistory, setServiceHistory] = useState<ServiceDate[]>([])
  const [loading, setLoading]             = useState(true)
  const [period, setPeriod]               = useState<Period>("6m")
  const [showPeriodMenu, setShowPeriodMenu] = useState(false)
  const [showAllTop, setShowAllTop]       = useState(false)
  const [showAllStagnant, setShowAllStagnant] = useState(false)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const [usage, history] = await Promise.all([
      window.worshipsync.analytics.getSongUsage() as Promise<SongWithUsage[]>,
      window.worshipsync.analytics.getServiceHistory() as Promise<ServiceDate[]>,
    ])
    setSongUsage(usage)
    setServiceHistory(history)
    setLoading(false)
  }

  // ── Derived data ─────────────────────────────────────────────────────────

  const cutoff = periodCutoff(period)

  const filteredServices = cutoff
    ? serviceHistory.filter(s => new Date(s.date + "T00:00:00") >= cutoff)
    : serviceHistory

  const uniqueSongs  = songUsage.filter(s => s.usageCount > 0).length
  const totalPlays   = songUsage.reduce((sum, s) => sum + s.usageCount, 0)
  const neverUsed    = songUsage.filter(s => s.usageCount === 0).length

  const topSongs = [...songUsage]
    .filter(s => s.usageCount > 0)
    .sort((a, b) => b.usageCount - a.usageCount)

  // Stagnant: never used first, then sorted by oldest last-use date
  const stagnantSongs = [...songUsage].sort((a, b) => {
    if (a.usageCount === 0 && b.usageCount === 0) return a.title.localeCompare(b.title)
    if (a.usageCount === 0) return -1
    if (b.usageCount === 0) return 1
    return (a.lastUsedDate ?? "").localeCompare(b.lastUsedDate ?? "")
  })

  const stats = [
    {
      label: "Total Services",
      value: filteredServices.length,
      sub: period === "all" ? "all time" : PERIOD_OPTIONS.find(p => p.key === period)!.label.toLowerCase(),
      icon: Calendar,
    },
    {
      label: "Unique Songs Sung",
      value: uniqueSongs,
      sub: `of ${songUsage.length} in library`,
      icon: Music2,
    },
    {
      label: "Total Song Plays",
      value: totalPlays,
      sub: "across all services",
      icon: TrendingUp,
    },
    {
      label: "Never Used",
      value: neverUsed,
      sub: "songs in library",
      icon: Clock,
      warn: neverUsed > 0,
    },
  ]

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-background text-foreground">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BarChart3 className="h-4 w-4 animate-pulse" />
          Loading analytics…
        </div>
      </div>
    )
  }

  const currentPeriodLabel = PERIOD_OPTIONS.find(p => p.key === period)!.label
  const displayedTop      = showAllTop      ? topSongs      : topSongs.slice(0, 5)
  const displayedStagnant = showAllStagnant ? stagnantSongs : stagnantSongs.slice(0, 5)

  return (
    <div className="h-full overflow-y-auto bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-6 py-6">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold">Analytics & Usage</h1>
          <div className="flex items-center gap-2">

            {/* Period filter */}
            <div className="relative">
              <button
                onClick={() => setShowPeriodMenu(v => !v)}
                className="flex items-center gap-1.5 text-xs font-medium bg-card border border-border rounded-md px-3 py-1.5 hover:bg-accent transition-colors"
              >
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                {currentPeriodLabel}
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </button>
              {showPeriodMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowPeriodMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-md shadow-lg overflow-hidden min-w-[150px]">
                    {PERIOD_OPTIONS.map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => { setPeriod(opt.key); setShowPeriodMenu(false) }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors ${
                          period === opt.key ? "text-primary font-semibold" : "text-foreground"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Export (UI only) */}
            <button className="flex items-center gap-1.5 text-xs font-medium bg-card border border-border rounded-md px-3 py-1.5 hover:bg-accent transition-colors text-muted-foreground">
              <Download className="h-3.5 w-3.5" />
              Export Report
            </button>
          </div>
        </div>

        {/* ── Stat cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {stats.map(stat => {
            const Icon = stat.icon
            return (
              <div key={stat.label} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-tight pr-2">
                    {stat.label}
                  </span>
                  <Icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${stat.warn ? "text-amber-500" : "text-muted-foreground"}`} />
                </div>
                <div className={`text-3xl font-bold leading-none tabular-nums ${stat.warn ? "text-amber-500" : ""}`}>
                  {stat.value}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1.5">{stat.sub}</div>
              </div>
            )
          })}
        </div>

        {/* ── Two-column song lists ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Most Frequently Used */}
          <section className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Most Frequently Used Songs</span>
              </div>
              {topSongs.length > 5 && (
                <button
                  onClick={() => setShowAllTop(v => !v)}
                  className="text-[11px] text-primary hover:text-primary/80 font-medium transition-colors shrink-0"
                >
                  {showAllTop ? "Show less" : "View All"}
                </button>
              )}
            </div>
            <div className="divide-y divide-border">
              {displayedTop.length === 0 ? (
                <div className="px-4 py-10 text-center text-xs text-muted-foreground">
                  No songs have been used yet.
                </div>
              ) : (
                displayedTop.map((song, i) => (
                  <SongRow key={song.id} rank={i + 1} song={song} />
                ))
              )}
            </div>
          </section>

          {/* Rarely Used / Stagnant */}
          <section className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2 min-w-0">
                <TrendingDown className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-semibold truncate">Rarely Used / Stagnant Songs</span>
              </div>
              {stagnantSongs.length > 5 && (
                <button
                  onClick={() => setShowAllStagnant(v => !v)}
                  className="text-[11px] text-primary hover:text-primary/80 font-medium transition-colors shrink-0 ml-2"
                >
                  {showAllStagnant ? "Show less" : "View All"}
                </button>
              )}
            </div>
            <div className="divide-y divide-border">
              {displayedStagnant.length === 0 ? (
                <div className="px-4 py-10 text-center text-xs text-muted-foreground">
                  All songs are in active rotation.
                </div>
              ) : (
                displayedStagnant.map((song, i) => (
                  <SongRow key={song.id} rank={i + 1} song={song} muted />
                ))
              )}
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}

// ── Song row ──────────────────────────────────────────────────────────────────

function SongRow({
  rank,
  song,
  muted,
}: {
  rank: number
  song: SongWithUsage
  muted?: boolean
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors">
      <span className="text-sm font-bold tabular-nums w-5 text-right shrink-0 text-muted-foreground/60">
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{song.title}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
          {song.artist}
          {song.key ? ` • Key ${song.key}` : ""}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-xs font-semibold tabular-nums ${muted && song.usageCount === 0 ? "text-muted-foreground" : ""}`}>
          {song.usageCount} {song.usageCount === 1 ? "play" : "plays"}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {formatLastUsed(song.lastUsedDate)}
        </p>
      </div>
    </div>
  )
}
