import { useEffect, useState, useMemo } from "react"
import {
  Calendar, ChevronRight, Plus, Music2, CheckCircle2,
  Circle, AlertCircle, Trash2, Sparkles, Pencil, Clock,
  Timer, BookOpen, Megaphone, Film, Layers, ListMusic,
  Play,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { useServiceStore } from "../../store/useServiceStore"
import CreateServiceModal from "../../components/CreateServiceModal"

// ── Helpers ──────────────────────────────────────────────────────────────────

function getNextSundays(count: number): string[] {
  const sundays: string[] = []
  const d = new Date()
  const daysUntil = (7 - d.getDay()) % 7 || 7
  d.setDate(d.getDate() + daysUntil)
  for (let i = 0; i < count; i++) {
    sundays.push(d.toISOString().split("T")[0])
    d.setDate(d.getDate() + 7)
  }
  return sundays
}

function getDaysAway(dateStr: string): number {
  const target = new Date(dateStr + "T00:00:00")
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  })
}

function formatShort(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric",
  })
}

function daysAwayLabel(d: number): string {
  if (d < 0) return `${Math.abs(d)} day${Math.abs(d) === 1 ? "" : "s"} ago`
  if (d === 0) return "Today"
  if (d === 1) return "Tomorrow"
  return `In ${d} days`
}

function estimateLineupMinutes(items: any[]): number {
  return items.reduce((acc: number, item: any) => {
    switch (item.itemType) {
      case 'countdown': return acc + 10
      case 'song': return acc + 4
      case 'scripture': return acc + 2
      case 'media': return acc + 3
      case 'announcement': return acc + 2
      default: return acc + 1
    }
  }, 0)
}

// ── Main Screen ──────────────────────────────────────────────────────────────

interface Props {
  onOpenService: (serviceId: number) => void
  onGoLive: (serviceId: number) => void
}

export default function PlannerScreen({ onOpenService, onGoLive }: Props) {
  const {
    services, loadServices, createService, deleteService, updateService,
  } = useServiceStore()
  const [showNew, setShowNew] = useState(false)
  const [editingService, setEditingService] = useState<any | null>(null)
  const [initializing, setInitializing] = useState(false)
  const [_songCounts, setSongCounts] = useState<Record<number, number>>({})
  const [itemCounts, setItemCounts] = useState<Record<number, number>>({})
  const [nextServiceLineup, setNextServiceLineup] = useState<any[]>([])

  useEffect(() => { loadServices() }, [])

  // Load lineup counts for all services
  useEffect(() => {
    if (services.length === 0) return
    window.worshipsync.services.getAllWithCounts().then((rows: any[]) => {
      const songs: Record<number, number> = {}
      const items: Record<number, number> = {}
      rows.forEach((r) => { songs[r.id] = r.songCount; items[r.id] = r.itemCount })
      setSongCounts(songs)
      setItemCounts(items)
    }).catch(() => {})
  }, [services])

  // ── Derived: find the "next" service to prepare ─────────────────────────
  const sortedUpcoming = useMemo(() => {
    return [...services]
      .filter((s) => getDaysAway(s.date) >= 0)
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [services])

  const nextService = sortedUpcoming[0] ?? null

  useEffect(() => {
    if (nextService) {
      window.worshipsync.lineup.getForService(nextService.id)
        .then((items: any) => setNextServiceLineup(items))
        .catch(() => {})
    } else {
      setNextServiceLineup([])
    }
  }, [nextService?.id])

  const pastServices = useMemo(() =>
    [...services]
      .filter((s) => getDaysAway(s.date) < 0)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5),
    [services]
  )

  const handleInitSundays = async () => {
    setInitializing(true)
    const sundays = getNextSundays(6)
    for (const date of sundays) {
      const exists = services.find((s) => s.date === date)
      if (!exists) await createService(date, "Sunday Service")
    }
    setInitializing(false)
  }

  const openInBuilder = (service: any) => {
    onOpenService(service.id)
  }

  const goLive = () => {
    if (nextService) onGoLive(nextService.id)
  }

  if (services.length === 0) {
    return (
      <EmptyState onCreate={() => setShowNew(true)} onInit={handleInitSundays} initializing={initializing} />
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-8 py-8">

        {/* ── Hero: Next service to prepare ────────────────────────────── */}
        {nextService && (
          <NextServiceHero
            service={nextService}
            itemCount={itemCounts[nextService.id] ?? 0}
            lineup={nextServiceLineup}
            onPrepare={() => openInBuilder(nextService)}
            onGoLive={goLive}
            onEdit={() => setEditingService(nextService)}
          />
        )}

        {/* ── Upcoming services ────────────────────────────────────────── */}
        <section className="mt-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Upcoming Services
            </h2>
            <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => setShowNew(true)}>
              <Plus className="h-3.5 w-3.5" /> New service
            </Button>
          </div>

          {sortedUpcoming.length <= 1 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                No other upcoming services scheduled.
              </p>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={handleInitSundays} disabled={initializing}>
                <Sparkles className="h-3.5 w-3.5" />
                {initializing ? "Adding…" : "Add next 6 Sundays"}
              </Button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {sortedUpcoming.slice(1).map((service) => (
                <ServiceRow
                  key={service.id}
                  service={service}
                  itemCount={itemCounts[service.id] ?? 0}
                  onOpen={() => openInBuilder(service)}
                  onEdit={() => setEditingService(service)}
                  onDelete={() => { if (confirm("Delete this service?")) deleteService(service.id) }}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Past services ────────────────────────────────────────────── */}
        {pastServices.length > 0 && (
          <section className="mt-10">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Past Services
            </h2>
            <div className="space-y-1.5">
              {pastServices.map((service) => (
                <ServiceRow
                  key={service.id}
                  service={service}
                  itemCount={itemCounts[service.id] ?? 0}
                  past
                  onOpen={() => openInBuilder(service)}
                  onEdit={() => setEditingService(service)}
                  onDelete={() => { if (confirm("Delete this service?")) deleteService(service.id) }}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {showNew && (
        <CreateServiceModal
          onClose={() => setShowNew(false)}
          onCreated={async (serviceId) => {
            await loadServices()
            setShowNew(false)
            onOpenService(serviceId)
          }}
        />
      )}

      {editingService && (
        <EditServiceDialog
          service={editingService}
          onClose={() => setEditingService(null)}
          onSave={async (data) => {
            await updateService(editingService.id, data)
            setEditingService(null)
          }}
        />
      )}

    </div>
  )
}

// ── Next Service Hero ────────────────────────────────────────────────────────

function lineupItemIcon(itemType: string) {
  switch (itemType) {
    case 'countdown':    return Timer
    case 'scripture':    return BookOpen
    case 'announcement': return Megaphone
    case 'media':        return Film
    case 'section':      return Layers
    default:             return Music2
  }
}

function NextServiceHero({
  service, itemCount, lineup, onPrepare, onGoLive, onEdit,
}: {
  service: any
  itemCount: number
  lineup: any[]
  onPrepare: () => void
  onGoLive: () => void
  onEdit: () => void
}) {
  const daysAway = getDaysAway(service.date)
  const isToday = daysAway === 0
  const isSoon = daysAway <= 3 && daysAway > 0
  const estimatedMin = useMemo(() => estimateLineupMinutes(lineup), [lineup])

  // Visible lineup items (skip section dividers)
  const visibleItems = lineup.filter(i => i.itemType !== 'section')

  const checks = useMemo(() => [
    { label: "Service created", done: true },
    { label: "Items in lineup", done: visibleItems.length > 0 },
    { label: "At least 3 items", done: visibleItems.length >= 3 },
    { label: "Marked as ready", done: service.status === "ready" },
  ], [visibleItems.length, service.status])

  const completedCount = checks.filter((c) => c.done).length
  const progress = (completedCount / checks.length) * 100
  const firstIssue = checks.find(c => !c.done)

  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Banner */}
      <div className={`px-5 py-2 flex items-center gap-2 text-[11px] font-bold tracking-widest ${
        isToday
          ? "bg-green-500/10 text-green-400 border-b border-green-500/20"
          : isSoon
            ? "bg-amber-500/10 text-amber-400 border-b border-amber-500/20"
            : "bg-primary/5 text-primary border-b border-primary/10"
      }`}>
        <div className={`h-1.5 w-1.5 rounded-full ${isToday ? "bg-green-500 animate-pulse" : isSoon ? "bg-amber-500" : "bg-primary"}`} />
        {isToday ? "TODAY'S SERVICE" : isSoon ? `IN ${daysAway} DAYS` : "NEXT UP"}
        <span className="ml-auto font-normal text-[11px] tracking-normal text-muted-foreground">{formatDate(service.date)}</span>
        <button onClick={onEdit} className="ml-2 p-1 rounded hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground">
          <Pencil className="h-3 w-3" />
        </button>
      </div>

      <div className="p-5 flex flex-col gap-5">
        {/* Title + quick stats */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground truncate">{service.label}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <ListMusic className="h-3 w-3" />{visibleItems.length} items
              </span>
              {estimatedMin > 0 && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />~{estimatedMin} min
                </span>
              )}
            </div>
          </div>
          {/* Readiness badge */}
          <div className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
            progress === 100
              ? "bg-green-500/10 text-green-400 border-green-500/25"
              : "bg-amber-500/10 text-amber-400 border-amber-500/25"
          }`}>
            {progress === 100
              ? <><CheckCircle2 className="h-3.5 w-3.5" /> Ready</>
              : <><Circle className="h-3.5 w-3.5" /> {completedCount}/{checks.length} ready</>
            }
          </div>
        </div>

        {/* Inline service flow pills */}
        {visibleItems.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {visibleItems.map((item: any, i: number) => {
              const Icon = lineupItemIcon(item.itemType)
              return (
                <div
                  key={item.id ?? i}
                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted/60 border border-border/50 text-[11px] text-muted-foreground max-w-[160px]"
                  title={item.title ?? item.song?.title ?? item.itemType}
                >
                  <Icon className="h-3 w-3 shrink-0" />
                  <span className="truncate">{item.title ?? item.song?.title ?? item.itemType}</span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-amber-400/80 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            Lineup is empty — open in Builder to add songs and items.
          </div>
        )}

        {/* Readiness bar */}
        <div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1.5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                progress === 100 ? "bg-green-500" : progress >= 50 ? "bg-amber-500" : "bg-primary"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          {firstIssue && (
            <p className="text-[11px] text-muted-foreground/70">
              Next: <span className="text-foreground/70">{firstIssue.label}</span>
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className={`flex gap-2 ${isToday ? "flex-col" : ""}`}>
          <button
            onClick={onPrepare}
            className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-150 border border-border bg-background hover:bg-accent text-foreground active:scale-[0.98]"
          >
            <Pencil className="h-4 w-4" />
            {isToday ? "Edit in Builder" : "Prepare Lineup"}
          </button>
          {isToday && (
            <button
              onClick={onGoLive}
              disabled={itemCount === 0}
              className="w-full py-3 rounded-xl text-sm font-black uppercase tracking-wide flex items-center justify-center gap-2.5 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed
                bg-green-600 hover:bg-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.25)] hover:shadow-[0_0_28px_rgba(34,197,94,0.35)] active:scale-[0.98]"
            >
              <Play className="h-4 w-4 fill-white" />
              Go Live
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

// ── Service Row ──────────────────────────────────────────────────────────────

function ServiceRow({
  service, itemCount, past, onOpen, onEdit, onDelete,
}: {
  service: any
  itemCount: number
  past?: boolean
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const daysAway = getDaysAway(service.date)

  return (
    <div
      className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-border hover:border-primary/30 hover:bg-accent/40 transition-all cursor-pointer"
      onClick={onOpen}
    >
      {/* Date chip */}
      <div className="h-11 w-11 shrink-0 rounded-xl bg-secondary flex flex-col items-center justify-center text-center">
        <span className="text-[9px] uppercase font-bold text-muted-foreground leading-none">
          {new Date(service.date + "T00:00:00").toLocaleDateString("en-US", { month: "short" })}
        </span>
        <span className="text-base font-bold text-foreground leading-none mt-0.5">
          {new Date(service.date + "T00:00:00").getDate()}
        </span>
      </div>

      {/* Main */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">{service.label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {past ? formatShort(service.date) : daysAwayLabel(daysAway)}
          {" · "}
          {itemCount} {itemCount === 1 ? "item" : "items"}{itemCount > 0 ? ` · ~${Math.round(itemCount * 3.5)} min` : ""}
        </p>
      </div>

      {/* Status pill */}
      <StatusPill status={service.status} past={past} />

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost" size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          title="Edit"
          onClick={(e) => { e.stopPropagation(); onEdit() }}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost" size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          title="Delete"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </div>
  )
}

function StatusPill({ status, past }: { status: string; past?: boolean }) {
  if (past) {
    return (
      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
        Past
      </span>
    )
  }
  if (status === "ready") {
    return (
      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-green-500/15 text-green-500">
        Ready
      </span>
    )
  }
  if (status === "in-progress") {
    return (
      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500">
        In prep
      </span>
    )
  }
  return (
    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
      Draft
    </span>
  )
}

// ── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({
  onCreate, onInit, initializing,
}: {
  onCreate: () => void
  onInit: () => void
  initializing: boolean
}) {
  return (
    <div className="h-full flex items-center justify-center bg-background text-foreground">
      <div className="text-center max-w-md px-6">
        <div className="h-16 w-16 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-4">
          <Calendar className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-xl font-bold mb-2">Welcome to WorshipSync</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Plan your service lineups and present them live. Start by adding your
          upcoming service dates.
        </p>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onCreate}>
            <Plus className="h-3.5 w-3.5" /> New service
          </Button>
          <Button size="sm" className="gap-1.5" onClick={onInit} disabled={initializing}>
            <Sparkles className="h-3.5 w-3.5" />
            {initializing ? "Creating…" : "Add next 6 Sundays"}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Edit Service Dialog ──────────────────────────────────────────────────────

function EditServiceDialog({
  service, onClose, onSave,
}: {
  service: any
  onClose: () => void
  onSave: (data: { label: string; date: string }) => Promise<void>
}) {
  const [label, setLabel] = useState(service.label)
  const [date, setDate] = useState(service.date)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const save = async () => {
    if (!date) { setError("Please pick a date"); return }
    if (!label.trim()) { setError("Please enter a service name"); return }
    setSaving(true)
    try {
      await onSave({ label: label.trim(), date })
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

