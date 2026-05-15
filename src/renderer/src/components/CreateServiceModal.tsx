import { useState, useEffect, useMemo } from "react"
import {
  Music2, Timer, BookOpen, Megaphone, Film, Check,
  X, Clock, CalendarClock, ChevronRight, Sparkles,
} from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

// ── Types ──────────────────────────────────────────────────────────────────────

interface BuiltinTemplateItem {
  itemType: "countdown" | "song" | "scripture" | "announcement"
  title: string
  estimatedMin: number
}

interface BuiltinTemplate {
  id: string
  name: string
  description: string
  gradient: string
  items: BuiltinTemplateItem[]
}

interface UserTemplate {
  id: string
  name: string
  createdAt: string
  items: { itemType: string; songId?: number; songTitle?: string; title?: string }[]
}

interface ServiceSchedule {
  id: string
  dayOfWeek: number
  startTime: string
  timezone?: string
  label: string
}

// ── Built-in templates ─────────────────────────────────────────────────────────

const BUILTIN: BuiltinTemplate[] = [
  {
    id: "sunday",
    name: "Sunday Service",
    description: "Standard weekly worship",
    gradient: "from-blue-900 via-blue-800 to-indigo-900",
    items: [
      { itemType: "countdown",     title: "Countdown",        estimatedMin: 10 },
      { itemType: "song",          title: "Opening Worship",  estimatedMin: 4  },
      { itemType: "song",          title: "Worship",          estimatedMin: 4  },
      { itemType: "song",          title: "Worship",          estimatedMin: 4  },
      { itemType: "scripture",     title: "Scripture Reading",estimatedMin: 2  },
      { itemType: "song",          title: "Response Song",    estimatedMin: 4  },
      { itemType: "announcement",  title: "Announcements",    estimatedMin: 2  },
    ],
  },
  {
    id: "youth",
    name: "Youth Service",
    description: "High-energy worship",
    gradient: "from-purple-900 via-purple-800 to-pink-900",
    items: [
      { itemType: "countdown",    title: "Countdown",    estimatedMin: 10 },
      { itemType: "song",         title: "Worship",      estimatedMin: 4  },
      { itemType: "song",         title: "Worship",      estimatedMin: 4  },
      { itemType: "song",         title: "Worship",      estimatedMin: 4  },
      { itemType: "announcement", title: "Announcements",estimatedMin: 2  },
    ],
  },
  {
    id: "prayer",
    name: "Prayer Night",
    description: "Worship & intercession",
    gradient: "from-amber-900 via-orange-800 to-red-900",
    items: [
      { itemType: "countdown",    title: "Countdown",    estimatedMin: 10 },
      { itemType: "song",         title: "Worship",      estimatedMin: 4  },
      { itemType: "song",         title: "Worship",      estimatedMin: 4  },
      { itemType: "song",         title: "Worship",      estimatedMin: 4  },
      { itemType: "scripture",    title: "Scripture",    estimatedMin: 2  },
      { itemType: "announcement", title: "Prayer Focus", estimatedMin: 5  },
    ],
  },
  {
    id: "special",
    name: "Special Event",
    description: "Baptism, Easter, Christmas",
    gradient: "from-emerald-900 via-teal-800 to-cyan-900",
    items: [
      { itemType: "countdown",    title: "Countdown",        estimatedMin: 10 },
      { itemType: "announcement", title: "Welcome",          estimatedMin: 2  },
      { itemType: "song",         title: "Worship",          estimatedMin: 4  },
      { itemType: "song",         title: "Worship",          estimatedMin: 4  },
      { itemType: "scripture",    title: "Scripture Reading",estimatedMin: 2  },
      { itemType: "song",         title: "Response Song",    estimatedMin: 4  },
      { itemType: "announcement", title: "Announcements",    estimatedMin: 2  },
    ],
  },
  {
    id: "blank",
    name: "Blank",
    description: "Start from scratch",
    gradient: "from-slate-800 via-slate-700 to-zinc-800",
    items: [],
  },
]

const SERVICE_TYPES = [
  "Regular Service",
  "Youth Service",
  "Prayer Meeting",
  "Special Event",
  "Mid-week Service",
  "Other",
]

const TIMEZONES = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Australia/Sydney",
  "Asia/Manila",
  "Asia/Singapore",
]

// ── Helpers ────────────────────────────────────────────────────────────────────

const ITEM_META: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  countdown:    { icon: Timer,    color: "text-blue-400",   bg: "bg-blue-500/15"   },
  song:         { icon: Music2,   color: "text-violet-400", bg: "bg-violet-500/15" },
  scripture:    { icon: BookOpen, color: "text-amber-400",  bg: "bg-amber-500/15"  },
  announcement: { icon: Megaphone,color: "text-green-400",  bg: "bg-green-500/15"  },
  media:        { icon: Film,     color: "text-sky-400",    bg: "bg-sky-500/15"    },
}

function fmtMin(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

function fmt12(t: string): string {
  if (!t) return ""
  const [h, m] = t.split(":").map(Number)
  const ampm = h >= 12 ? "PM" : "AM"
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`
}

function getTzAbbr(tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })
      .formatToParts(new Date())
      .find(p => p.type === "timeZoneName")?.value ?? tz
  } catch { return tz }
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void
  onCreated: (serviceId: number) => void
}

export default function CreateServiceModal({ onClose, onCreated }: Props) {
  // Settings loaded from appState
  const [schedules,        setSchedules]        = useState<ServiceSchedule[]>([])
  const [defaultTimezone,  setDefaultTimezone]  = useState("America/Los_Angeles")
  const [userTemplates,    setUserTemplates]     = useState<UserTemplate[]>([])

  useEffect(() => {
    window.worshipsync.appState.get().then((s: any) => {
      if (s.serviceSchedules)  setSchedules(s.serviceSchedules)
      if (s.serviceTimezone)   setDefaultTimezone(s.serviceTimezone)
      if (Array.isArray(s.setlistTemplates)) setUserTemplates(s.setlistTemplates)
    }).catch(() => {})
  }, [])

  // Form state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [serviceType,  setServiceType]  = useState("Regular Service")
  const [serviceName,  setServiceName]  = useState("Sunday Service")
  const [nameEdited,   setNameEdited]   = useState(false)
  const [date,         setDate]         = useState("")
  const [startTime,    setStartTime]    = useState("")
  const [timezone,     setTimezone]     = useState(defaultTimezone)
  const [notes,        setNotes]        = useState("")
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState("")

  // Sync timezone default once loaded
  useEffect(() => { setTimezone(defaultTimezone) }, [defaultTimezone])

  // Auto-fill from schedule when date changes
  useEffect(() => {
    if (!date || schedules.length === 0) return
    const dow = new Date(date + "T12:00:00").getDay()
    const match = schedules.find(s => s.dayOfWeek === dow)
    if (match) {
      setStartTime(match.startTime)
      if (match.timezone) setTimezone(match.timezone)
    }
  }, [date, schedules])

  // Auto-fill service name when type or template changes (if not manually edited)
  useEffect(() => {
    if (nameEdited) return
    if (selectedTemplateId) {
      const builtin = BUILTIN.find(t => t.id === selectedTemplateId)
      if (builtin && builtin.id !== "blank") { setServiceName(builtin.name); return }
      const user = userTemplates.find(t => t.id === selectedTemplateId)
      if (user) { setServiceName(user.name); return }
    }
    setServiceName(serviceType === "Regular Service" ? "Sunday Service" : serviceType)
  }, [selectedTemplateId, serviceType, nameEdited, userTemplates])

  // Resolve active template items for preview
  const previewItems = useMemo((): { itemType: string; title: string; estimatedMin: number }[] => {
    if (!selectedTemplateId) return []
    const builtin = BUILTIN.find(t => t.id === selectedTemplateId)
    if (builtin) return builtin.items
    const user = userTemplates.find(t => t.id === selectedTemplateId)
    if (!user) return []
    return user.items.map(i => ({
      itemType: i.itemType,
      title: i.songTitle ?? i.title ?? i.itemType,
      estimatedMin: i.itemType === "countdown" ? 10 : i.itemType === "song" ? 4 : i.itemType === "scripture" ? 2 : 2,
    }))
  }, [selectedTemplateId, userTemplates])

  const totalMin = useMemo(() => previewItems.reduce((a, i) => a + i.estimatedMin, 0), [previewItems])

  const formattedDate = useMemo(() => {
    if (!date) return ""
    return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    })
  }, [date])

  // ── Apply template items to a newly created service ────────────────────────

  async function applyTemplateItems(serviceId: number) {
    const builtin = BUILTIN.find(t => t.id === selectedTemplateId)
    if (builtin) {
      for (const item of builtin.items) {
        if (item.itemType === "countdown") {
          await window.worshipsync.lineup.addCountdown(serviceId)
        } else if (item.itemType === "announcement") {
          await window.worshipsync.lineup.addAnnouncement(serviceId, { title: item.title, content: "" })
        } else if (item.itemType === "scripture") {
          await window.worshipsync.lineup.addScripture(serviceId, { title: item.title, scriptureRef: "{}" })
        }
        // songs without IDs are skipped — operator adds them in builder
      }
      return
    }
    const user = userTemplates.find(t => t.id === selectedTemplateId)
    if (!user) return
    for (const item of user.items) {
      if (item.itemType === "countdown") {
        await window.worshipsync.lineup.addCountdown(serviceId)
      } else if (item.itemType === "song" && item.songId) {
        await window.worshipsync.lineup.addSong(serviceId, item.songId).catch(() => {})
      } else if (item.itemType === "announcement") {
        await window.worshipsync.lineup.addAnnouncement(serviceId, { title: item.title ?? "Announcement", content: "" })
      } else if (item.itemType === "scripture") {
        await window.worshipsync.lineup.addScripture(serviceId, { title: item.title ?? "Scripture", scriptureRef: "{}" })
      }
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!date) { setError("Please pick a date."); return }
    if (!serviceName.trim()) { setError("Please enter a service name."); return }
    setSaving(true)
    setError("")
    try {
      const svc = await window.worshipsync.services.create({
        date,
        label: serviceName.trim(),
        status: "empty",
        notes: notes.trim() || undefined,
      }) as { id: number }

      if (selectedTemplateId) await applyTemplateItems(svc.id)

      onCreated(svc.id)
    } catch (e: any) {
      setError(e?.message?.includes("UNIQUE")
        ? "A service already exists for this date."
        : "Failed to create service.")
      setSaving(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent
        hideClose
        className="p-0 gap-0 overflow-hidden rounded-2xl border border-border shadow-2xl"
        style={{ width: 1040, maxWidth: "96vw", height: 660, maxHeight: "94vh" }}
      >
        <div className="flex flex-col h-full bg-background text-foreground">

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0 bg-card">
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronRight className="h-3.5 w-3.5 rotate-180" />
                Back to Planner
              </button>
              <span className="text-muted-foreground/40">/</span>
              <DialogTitle className="text-sm font-semibold">Create New Service</DialogTitle>
            </div>
            <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* ── Body ────────────────────────────────────────────────────── */}
          <div className="flex-1 flex min-h-0 overflow-hidden">

            {/* Left — form */}
            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
              <div className="p-6 space-y-7">

                {/* Step 1 — Template */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="h-5 w-5 rounded-full bg-primary/15 text-primary text-[11px] font-bold flex items-center justify-center shrink-0">1</span>
                    <p className="text-sm font-semibold">Choose a Template <span className="text-muted-foreground font-normal">(Optional)</span></p>
                  </div>

                  {/* Built-in cards */}
                  <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
                    {BUILTIN.map(tpl => {
                      const isSel = selectedTemplateId === tpl.id
                      return (
                        <button
                          key={tpl.id}
                          onClick={() => setSelectedTemplateId(isSel ? null : tpl.id)}
                          className={`relative flex-shrink-0 rounded-xl overflow-hidden border-2 transition-all group ${
                            isSel ? "border-primary ring-2 ring-primary/25" : "border-border hover:border-muted-foreground/40"
                          }`}
                          style={{ width: 160, aspectRatio: "16/9" }}
                        >
                          <div className={`absolute inset-0 bg-gradient-to-br ${tpl.gradient}`} />
                          <div className="absolute inset-0 bg-black/20" />
                          <div className="absolute inset-0 flex flex-col justify-end p-2.5">
                            <p className="text-[12px] font-bold text-white leading-tight">{tpl.name}</p>
                            <p className="text-[10px] text-white/60 mt-0.5">
                              {tpl.items.length === 0 ? "Empty lineup" : `${tpl.items.length} items`}
                            </p>
                          </div>
                          {isSel && (
                            <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                              <Check className="h-3 w-3 text-primary-foreground" />
                            </div>
                          )}
                        </button>
                      )
                    })}

                    {/* User saved templates */}
                    {userTemplates.map(tpl => {
                      const isSel = selectedTemplateId === tpl.id
                      return (
                        <button
                          key={tpl.id}
                          onClick={() => setSelectedTemplateId(isSel ? null : tpl.id)}
                          className={`relative flex-shrink-0 rounded-xl overflow-hidden border-2 transition-all ${
                            isSel ? "border-primary ring-2 ring-primary/25" : "border-border hover:border-muted-foreground/40"
                          }`}
                          style={{ width: 160, aspectRatio: "16/9" }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-900" />
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                            <Sparkles className="h-5 w-5 text-white/50" />
                          </div>
                          <div className="absolute inset-0 flex flex-col justify-end p-2.5">
                            <p className="text-[12px] font-bold text-white leading-tight truncate">{tpl.name}</p>
                            <p className="text-[10px] text-white/60 mt-0.5">{tpl.items.length} items · Saved</p>
                          </div>
                          {isSel && (
                            <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                              <Check className="h-3 w-3 text-primary-foreground" />
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Step 2 — Details */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="h-5 w-5 rounded-full bg-primary/15 text-primary text-[11px] font-bold flex items-center justify-center shrink-0">2</span>
                    <p className="text-sm font-semibold">Service Details</p>
                  </div>

                  <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                    {/* Service Name */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Service Name *</label>
                      <Input
                        value={serviceName}
                        onChange={e => { setServiceName(e.target.value); setNameEdited(true) }}
                        placeholder="e.g. Sunday Morning Service"
                      />
                    </div>

                    {/* Service Type */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Service Type</label>
                      <select
                        value={serviceType}
                        onChange={e => { setServiceType(e.target.value); setNameEdited(false) }}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        {SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>

                    {/* Date */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Date *</label>
                      <div className="relative">
                        <CalendarClock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                          type="date"
                          className="pl-9"
                          value={date}
                          onChange={e => { setDate(e.target.value); setError("") }}
                        />
                      </div>
                    </div>

                    {/* Start Time */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Start Time</label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                          type="time"
                          className="pl-9"
                          value={startTime}
                          onChange={e => setStartTime(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Timezone */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Timezone</label>
                      <select
                        value={timezone}
                        onChange={e => setTimezone(e.target.value)}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        {TIMEZONES.map(tz => (
                          <option key={tz} value={tz}>{tz} ({getTzAbbr(tz)})</option>
                        ))}
                      </select>
                    </div>

                    {/* Notes */}
                    <div className="space-y-1.5 col-span-2">
                      <label className="text-xs font-medium text-foreground">Notes <span className="text-muted-foreground font-normal">(optional)</span></label>
                      <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        rows={2}
                        placeholder="e.g. Guest speaker, special theme…"
                        className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md outline-none focus:ring-1 focus:ring-ring resize-none placeholder:text-muted-foreground/50"
                      />
                    </div>
                  </div>

                  {error && <p className="text-xs text-destructive mt-3">{error}</p>}
                </div>
              </div>
            </div>

            {/* Right — Preview panel */}
            <div className="w-[280px] shrink-0 border-l border-border flex flex-col bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border shrink-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Service Preview</p>
              </div>

              {/* Service header */}
              <div className="px-4 py-3 border-b border-border shrink-0">
                <p className="text-sm font-bold text-foreground truncate">{serviceName || "New Service"}</p>
                {formattedDate && (
                  <p className="text-xs text-muted-foreground mt-0.5">{formattedDate}</p>
                )}
                {startTime && (
                  <p className="text-xs text-muted-foreground">
                    {fmt12(startTime)} {getTzAbbr(timezone)}
                  </p>
                )}
              </div>

              {/* Item list */}
              <div className="flex-1 overflow-y-auto">
                {previewItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full px-4 text-center gap-2">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <Sparkles className="h-5 w-5 text-muted-foreground/50" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {selectedTemplateId === "blank"
                        ? "Empty lineup — add items in the builder"
                        : "Select a template to preview the lineup"}
                    </p>
                  </div>
                ) : (
                  <div className="px-3 py-2 space-y-1">
                    {previewItems.map((item, i) => {
                      const meta = ITEM_META[item.itemType] ?? ITEM_META.song
                      const Icon = meta.icon
                      return (
                        <div key={i} className="flex items-center gap-2.5 py-1.5 px-2 rounded-md">
                          <div className={`h-6 w-6 rounded flex items-center justify-center shrink-0 ${meta.bg}`}>
                            <Icon className={`h-3 w-3 ${meta.color}`} />
                          </div>
                          <span className="flex-1 text-[12px] text-foreground truncate">{item.title}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                            {item.estimatedMin} min
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Total duration */}
              {totalMin > 0 && (
                <div className="px-4 py-3 border-t border-border shrink-0 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Estimated</span>
                  <span className="text-sm font-bold tabular-nums">{fmtMin(totalMin)}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Footer ──────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-card shrink-0">
            <p className="text-xs text-muted-foreground">
              {selectedTemplateId && selectedTemplateId !== "blank"
                ? "Template structure will be applied. Songs can be added in the builder."
                : "You can add songs and media after creating the service."}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
              <Button size="sm" disabled={!date || !serviceName.trim() || saving} onClick={handleCreate} className="gap-1.5">
                {saving ? "Creating…" : "Create Service"}
              </Button>
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  )
}
