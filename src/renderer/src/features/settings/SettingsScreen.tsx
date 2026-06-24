import { useState, useEffect, useCallback, useRef } from "react"
import { QRCodeSVG } from "qrcode.react"
import {
  Download, Upload, CheckCircle2, AlertCircle, Database, Clock,
  Church, CalendarDays, Plus, Trash2, X, Monitor, Wifi, Copy, Check,
  Users, Lock, BookOpen, Eye, EyeOff, Signal,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"

// ── Types & helpers ───────────────────────────────────────────────────────────

interface ServiceSchedule {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
  label: string
  timezone?: string
}

function getTzAbbr(tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value ?? tz
  } catch {
    return tz
  }
}

const DAYS_FULL  = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
const DAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]

function toMins(t: string): number {
  const [h, m] = t.split(":").map(Number)
  return h * 60 + m
}

function fmt12(t: string): string {
  const [h, m] = t.split(":").map(Number)
  const ampm = h >= 12 ? "PM" : "AM"
  const h12 = h % 12 || 12
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`
}

function hasConflict(
  schedules: ServiceSchedule[],
  candidate: Pick<ServiceSchedule, "dayOfWeek" | "startTime" | "endTime">,
  excludeId?: string,
): boolean {
  return schedules
    .filter((s) => s.id !== excludeId && s.dayOfWeek === candidate.dayOfWeek)
    .some((s) => {
      const sS = toMins(s.startTime), sE = toMins(s.endTime)
      const cS = toMins(candidate.startTime), cE = toMins(candidate.endTime)
      return cS < sE && sS < cE
    })
}

const TIMEZONES = [
  { value: "Pacific/Honolulu",          label: "Pacific/Honolulu" },
  { value: "America/Anchorage",         label: "America/Anchorage" },
  { value: "America/Los_Angeles",       label: "America/Los_Angeles" },
  { value: "America/Vancouver",         label: "America/Vancouver" },
  { value: "America/Tijuana",           label: "America/Tijuana" },
  { value: "America/Phoenix",           label: "America/Phoenix" },
  { value: "America/Denver",            label: "America/Denver" },
  { value: "America/Edmonton",          label: "America/Edmonton" },
  { value: "America/Chicago",           label: "America/Chicago" },
  { value: "America/Winnipeg",          label: "America/Winnipeg" },
  { value: "America/Mexico_City",       label: "America/Mexico_City" },
  { value: "America/New_York",          label: "America/New_York" },
  { value: "America/Toronto",           label: "America/Toronto" },
  { value: "America/Indiana/Indianapolis", label: "America/Indiana/Indianapolis" },
  { value: "America/Halifax",           label: "America/Halifax" },
  { value: "America/St_Johns",          label: "America/St_Johns" },
  { value: "America/Sao_Paulo",         label: "America/Sao_Paulo" },
  { value: "America/Argentina/Buenos_Aires", label: "America/Argentina/Buenos_Aires" },
  { value: "America/Santiago",          label: "America/Santiago" },
  { value: "America/Bogota",            label: "America/Bogota" },
  { value: "America/Lima",              label: "America/Lima" },
  { value: "America/Caracas",           label: "America/Caracas" },
  { value: "Atlantic/Reykjavik",        label: "Atlantic/Reykjavik" },
  { value: "Europe/London",             label: "Europe/London" },
  { value: "Europe/Lisbon",             label: "Europe/Lisbon" },
  { value: "Europe/Dublin",             label: "Europe/Dublin" },
  { value: "Europe/Paris",              label: "Europe/Paris" },
  { value: "Europe/Berlin",             label: "Europe/Berlin" },
  { value: "Europe/Rome",               label: "Europe/Rome" },
  { value: "Europe/Madrid",             label: "Europe/Madrid" },
  { value: "Europe/Amsterdam",          label: "Europe/Amsterdam" },
  { value: "Europe/Brussels",           label: "Europe/Brussels" },
  { value: "Europe/Warsaw",             label: "Europe/Warsaw" },
  { value: "Europe/Stockholm",          label: "Europe/Stockholm" },
  { value: "Europe/Zurich",             label: "Europe/Zurich" },
  { value: "Europe/Athens",             label: "Europe/Athens" },
  { value: "Europe/Helsinki",           label: "Europe/Helsinki" },
  { value: "Europe/Bucharest",          label: "Europe/Bucharest" },
  { value: "Europe/Istanbul",           label: "Europe/Istanbul" },
  { value: "Europe/Moscow",             label: "Europe/Moscow" },
  { value: "Africa/Cairo",              label: "Africa/Cairo" },
  { value: "Africa/Lagos",              label: "Africa/Lagos" },
  { value: "Africa/Nairobi",            label: "Africa/Nairobi" },
  { value: "Africa/Johannesburg",       label: "Africa/Johannesburg" },
  { value: "Asia/Dubai",                label: "Asia/Dubai" },
  { value: "Asia/Riyadh",               label: "Asia/Riyadh" },
  { value: "Asia/Tehran",               label: "Asia/Tehran" },
  { value: "Asia/Karachi",              label: "Asia/Karachi" },
  { value: "Asia/Kolkata",              label: "Asia/Kolkata" },
  { value: "Asia/Colombo",              label: "Asia/Colombo" },
  { value: "Asia/Dhaka",                label: "Asia/Dhaka" },
  { value: "Asia/Yangon",               label: "Asia/Yangon" },
  { value: "Asia/Bangkok",              label: "Asia/Bangkok" },
  { value: "Asia/Ho_Chi_Minh",          label: "Asia/Ho_Chi_Minh" },
  { value: "Asia/Jakarta",              label: "Asia/Jakarta" },
  { value: "Asia/Kuala_Lumpur",         label: "Asia/Kuala_Lumpur" },
  { value: "Asia/Singapore",            label: "Asia/Singapore" },
  { value: "Asia/Manila",               label: "Asia/Manila" },
  { value: "Asia/Hong_Kong",            label: "Asia/Hong_Kong" },
  { value: "Asia/Shanghai",             label: "Asia/Shanghai" },
  { value: "Asia/Taipei",               label: "Asia/Taipei" },
  { value: "Asia/Seoul",                label: "Asia/Seoul" },
  { value: "Asia/Tokyo",                label: "Asia/Tokyo" },
  { value: "Australia/Perth",           label: "Australia/Perth" },
  { value: "Australia/Darwin",          label: "Australia/Darwin" },
  { value: "Australia/Adelaide",        label: "Australia/Adelaide" },
  { value: "Australia/Brisbane",        label: "Australia/Brisbane" },
  { value: "Australia/Sydney",          label: "Australia/Sydney" },
  { value: "Australia/Melbourne",       label: "Australia/Melbourne" },
  { value: "Pacific/Auckland",          label: "Pacific/Auckland" },
  { value: "Pacific/Fiji",              label: "Pacific/Fiji" },
  { value: "Pacific/Guam",              label: "Pacific/Guam" },
]

// ── Shared UI primitives ──────────────────────────────────────────────────────

function SectionCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-card shadow-sm ${className}`}>
      {children}
    </div>
  )
}

function SectionHeader({ icon: Icon, title, description }: {
  icon: React.ElementType
  title: string
  description?: string
}) {
  return (
    <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-border">
      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>
    </div>
  )
}

function SettingRow({ label, description, children, last = false }: {
  label: string
  description?: string
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <div className={`flex items-center justify-between gap-6 px-5 py-4 ${!last ? "border-b border-border" : ""}`}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function SegmentedControl<T extends string | number>({
  options, value, onChange,
}: {
  options: { label: string; value: T }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-secondary/40 p-0.5 gap-0.5">
      {options.map(opt => (
        <button
          key={String(opt.value)}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            value === opt.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const [savedPulse, setSavedPulse] = useState(false)

  // Church
  const [churchName, setChurchName] = useState("")

  // Bible API key
  const [bibleApiKey, setBibleApiKey]       = useState("")
  const [bibleApiKeySaved, setBibleApiKeySaved] = useState(false)
  const [bibleApiKeyVisible, setBibleApiKeyVisible] = useState(false)

  // Service schedules
  const [schedules, setSchedules]     = useState<ServiceSchedule[]>([])
  const [adding, setAdding]           = useState(false)
  const [newDay, setNewDay]           = useState(0)
  const [newStart, setNewStart]       = useState("09:00")
  const [newEnd, setNewEnd]           = useState("11:00")
  const [newLabel, setNewLabel]       = useState("")
  const [newTimezone, setNewTimezone] = useState("America/Los_Angeles")
  const [scheduleError, setScheduleError] = useState("")

  // Countdown fallback
  const [serviceTime, setServiceTime]         = useState("11:00")
  const [serviceTimezone, setServiceTimezone] = useState("America/Los_Angeles")

  // Display
  const [projectionFontSize, setProjectionFontSize] = useState(48)
  const [slideTransitionMs, setSlideTransitionMs]   = useState(300)
  const [displays, setDisplays] = useState<{ id: number; label: string; width: number; height: number; isPrimary: boolean }[]>([])
  const [outputDisplayId, setOutputDisplayId]           = useState<number | undefined>(undefined)
  const [confidenceDisplayId, setConfidenceDisplayId]   = useState<number | undefined>(undefined)
  const [confidenceEnabled, setConfidenceEnabled]       = useState(false)

  // Network / stage display
  const [stageRunning, setStageRunning]       = useState(false)
  const [stageURL, setStageURL]               = useState("")
  const [stageMdnsURL, setStageMdnsURL]       = useState("")
  const [stagePortInput, setStagePortInput]   = useState("4040")
  const [stageClients, setStageClients]       = useState(0)
  const [stageClientList, setStageClientList] = useState<{ ip: string; device: string; connectedAt: number; connectedForSeconds: number; type?: 'stage' | 'pwa' }[]>([])
  const [stageCopied, setStageCopied]         = useState(false)
  const [stageMdnsCopied, setStageMdnsCopied] = useState(false)
  const [stageLoading, setStageLoading]       = useState(false)
  const [showQR, setShowQR]                   = useState<'controller' | 'stage' | null>(null)
  const [controllerPin, setControllerPin]     = useState("")
  const [pinSaved, setPinSaved]               = useState(false)

  // Data
  const [dataStatus, setDataStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null)

  // Nav
  type Tab = "general" | "schedule" | "display" | "network" | "data"
  const [activeTab, setActiveTab] = useState<Tab>("general")

  // Auto-save debounce
  const saveTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSave = useRef<Record<string, any>>({})

  function queueSave(updates: Record<string, any>) {
    pendingSave.current = { ...pendingSave.current, ...updates }
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      await window.worshipsync.appState.set(pendingSave.current)
      pendingSave.current = {}
      setSavedPulse(true)
      setTimeout(() => setSavedPulse(false), 1800)
    }, 600)
  }

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  const refreshStageStatus = useCallback(async () => {
    const s = await window.worshipsync.stageDisplay.getStatus()
    setStageRunning(s.running)
    setStageURL(s.url)
    setStageMdnsURL(s.mdnsUrl)
    setStagePortInput(String(s.port))
    setStageClients(s.clients)
    setStageClientList(s.clientList ?? [])
  }, [])

  useEffect(() => {
    Promise.all([
      window.worshipsync.appState.get().catch(() => ({} as Record<string, any>)),
      window.worshipsync.window.getDisplays().catch(() => [] as typeof displays),
    ]).then(([state, d]) => {
      if (state.churchName)         setChurchName(state.churchName)
      if (state.bibleApiKey)        setBibleApiKey(state.bibleApiKey as string)
      if (state.serviceSchedules)   setSchedules(state.serviceSchedules)
      if (state.serviceTime)        setServiceTime(state.serviceTime)
      if (state.serviceTimezone) {
        setServiceTimezone(state.serviceTimezone)
        setNewTimezone(state.serviceTimezone)
      }
      if (state.projectionFontSize) setProjectionFontSize(state.projectionFontSize)
      if (state.slideTransitionMs !== undefined) setSlideTransitionMs(state.slideTransitionMs)
      if (state.controllerPin !== undefined)     setControllerPin(state.controllerPin ?? "")
      setDisplays(d)
      const fallback = d.find((x: typeof d[0]) => !x.isPrimary)?.id ?? d[0]?.id
      // Always honour the saved preference even if the display isn't connected yet;
      // only fall back to a default if no preference has ever been saved.
      setOutputDisplayId(
        typeof state.outputDisplayId === 'number' ? state.outputDisplayId : fallback
      )
      setConfidenceDisplayId(
        typeof state.confidenceDisplayId === 'number' ? state.confidenceDisplayId : fallback
      )
      if (typeof state.confidenceEnabled === 'boolean') setConfidenceEnabled(state.confidenceEnabled)
    })
    refreshStageStatus().catch(() => {})
  }, [refreshStageStatus])

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSaveBibleApiKey = async () => {
    await window.worshipsync.appState.set({ bibleApiKey: bibleApiKey.trim() || null })
    setBibleApiKeySaved(true)
    setTimeout(() => setBibleApiKeySaved(false), 2000)
  }

  const persistSchedules = async (updated: ServiceSchedule[]) => {
    setSchedules(updated)
    await window.worshipsync.appState.set({ serviceSchedules: updated })
    setSavedPulse(true)
    setTimeout(() => setSavedPulse(false), 1800)
  }

  const handleAddSchedule = async () => {
    setScheduleError("")
    if (toMins(newEnd) <= toMins(newStart)) {
      setScheduleError("End time must be after start time.")
      return
    }
    const candidate = { dayOfWeek: newDay, startTime: newStart, endTime: newEnd }
    if (hasConflict(schedules, candidate)) {
      setScheduleError("This time slot conflicts with an existing schedule on that day.")
      return
    }
    await persistSchedules([
      ...schedules,
      { id: Date.now().toString(), label: newLabel.trim(), timezone: newTimezone, ...candidate },
    ])
    setAdding(false)
    setNewDay(0); setNewStart("09:00"); setNewEnd("11:00"); setNewLabel("")
  }

  const handleDeleteSchedule = async (id: string) =>
    persistSchedules(schedules.filter((s) => s.id !== id))

  const handleSavePin = async () => {
    const pin = controllerPin.trim()
    await window.worshipsync.appState.set({ controllerPin: pin || null })
    setControllerPin(pin)
    setPinSaved(true)
    setTimeout(() => setPinSaved(false), 2000)
  }

  const handleExport = async () => {
    setDataStatus(null)
    const res = await (window.worshipsync as any).data.export()
    if (res?.success)       setDataStatus({ type: "success", msg: "Backup saved successfully." })
    else if (!res?.canceled) setDataStatus({ type: "error",   msg: "Export failed." })
  }

  const handleImport = async () => {
    setDataStatus(null)
    const res = await (window.worshipsync as any).data.import()
    if (res?.success)   setDataStatus({ type: "success", msg: "Data imported. Restart the app to reload everything." })
    else if (res?.error) setDataStatus({ type: "error",   msg: res.error })
  }

  const sortedSchedules = [...schedules].sort(
    (a, b) => a.dayOfWeek - b.dayOfWeek || toMins(a.startTime) - toMins(b.startTime),
  )

  const handleStageToggle = async () => {
    setStageLoading(true)
    if (stageRunning) {
      await window.worshipsync.stageDisplay.stop()
    } else {
      const port = parseInt(stagePortInput) || 4040
      await window.worshipsync.stageDisplay.start(port)
    }
    await refreshStageStatus()
    setStageLoading(false)
  }

  const handleCopyURL = (url: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(url).then(() => {
      setter(true)
      setTimeout(() => setter(false), 2000)
    })
  }

  // ── Nav ────────────────────────────────────────────────────────────────────

  const NAV: { value: Tab; icon: React.ElementType; label: string }[] = [
    { value: "general",  icon: Church,       label: "General"    },
    { value: "schedule", icon: CalendarDays, label: "Schedule"   },
    { value: "display",  icon: Monitor,      label: "Display"    },
    { value: "network",  icon: Wifi,         label: "Network"    },
    { value: "data",     icon: Database,     label: "Data"       },
  ]

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex overflow-hidden bg-background text-foreground">

      {/* Side nav */}
      <nav className="w-48 shrink-0 border-r border-border bg-card flex flex-col p-3 pt-6 gap-0.5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-3 mb-3">
          Settings
        </p>
        {NAV.map(({ value, icon: Icon, label }) => (
          <button
            key={value}
            onClick={() => setActiveTab(value)}
            className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === value
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </button>
        ))}
      </nav>

      {/* Content area */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Content header */}
        <div className="h-12 shrink-0 border-b border-border flex items-center justify-between px-6">
          <h1 className="text-sm font-semibold">
            {NAV.find(n => n.value === activeTab)?.label}
          </h1>
          <div className={`flex items-center gap-1.5 text-xs text-green-500 transition-all duration-300 ${
            savedPulse ? "opacity-100" : "opacity-0"
          }`}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            Saved
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">

          {/* ── General ── */}
          {activeTab === "general" && (
            <div className="flex flex-col gap-5 max-w-2xl">

              <SectionCard>
                <SectionHeader icon={Church} title="Church identity" />
                <SettingRow
                  label="Church name"
                  description="Shown at the bottom of the projection countdown screen."
                  last
                >
                  <Input
                    type="text"
                    placeholder="e.g. Grace Community Church"
                    value={churchName}
                    onChange={(e) => {
                      setChurchName(e.target.value)
                      queueSave({ churchName: e.target.value })
                    }}
                    className="w-64 text-sm"
                  />
                </SettingRow>
              </SectionCard>

              <SectionCard>
                <SectionHeader
                  icon={BookOpen}
                  title="Bible API key"
                  description="Unlocks NIV, NLT, NKJV, ESV, and 50+ modern translations. Free key at scripture.api.bible — without it, only WEB, KJV, ASV, and a few others are available."
                />
                <div className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={bibleApiKeyVisible ? "text" : "password"}
                        placeholder="Paste your API.Bible key here"
                        value={bibleApiKey}
                        onChange={(e) => setBibleApiKey(e.target.value)}
                        className="pr-9 font-mono text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setBibleApiKeyVisible(v => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {bibleApiKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <Button size="sm" onClick={handleSaveBibleApiKey}>Save</Button>
                    {bibleApiKeySaved && (
                      <span className="text-xs text-green-500 flex items-center gap-1 whitespace-nowrap">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Saved
                      </span>
                    )}
                  </div>
                  {bibleApiKey.trim() && (
                    <p className="text-[11px] text-green-500/80 mt-2">
                      Key set — modern translations are available in scripture search.
                    </p>
                  )}
                </div>
              </SectionCard>

            </div>
          )}

          {/* ── Schedule ── */}
          {activeTab === "schedule" && (
            <div className="flex flex-col gap-5 max-w-2xl">

              <SectionCard>
                <SectionHeader
                  icon={CalendarDays}
                  title="Recurring services"
                  description="Define your weekly service times. The app uses these to auto-launch the right service plan and countdown timer."
                />
                <div className="px-5 py-4 flex flex-col gap-3">
                  {sortedSchedules.length > 0 && (
                    <div className="flex flex-col rounded-xl border border-border overflow-hidden">
                      {sortedSchedules.map((s, i) => (
                        <div
                          key={s.id}
                          className={`flex items-center gap-3 px-3 py-2.5 bg-secondary/30 hover:bg-secondary/60 transition-colors ${
                            i < sortedSchedules.length - 1 ? "border-b border-border" : ""
                          }`}
                        >
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/15 text-primary rounded-md px-2 py-0.5 shrink-0 w-10 text-center">
                            {DAYS_SHORT[s.dayOfWeek]}
                          </span>
                          <span className="text-xs font-mono text-foreground shrink-0">
                            {fmt12(s.startTime)} – {fmt12(s.endTime)}
                          </span>
                          <span className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5 shrink-0">
                            {getTzAbbr(s.timezone ?? serviceTimezone)}
                          </span>
                          {s.label
                            ? <span className="text-xs text-muted-foreground truncate flex-1">{s.label}</span>
                            : <span className="flex-1" />}
                          <button
                            onClick={() => handleDeleteSchedule(s.id)}
                            className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {adding ? (
                    <div className="rounded-xl border border-border bg-secondary/20 p-4 flex flex-col gap-3">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-medium text-muted-foreground">Day</label>
                          <Select value={newDay.toString()} onChange={(e) => setNewDay(Number(e.target.value))}>
                            {DAYS_FULL.map((d, i) => <option key={i} value={i}>{d}</option>)}
                          </Select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-medium text-muted-foreground">Start</label>
                          <Input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-medium text-muted-foreground">End</label>
                          <Input type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-medium text-muted-foreground">Timezone</label>
                          <Select value={newTimezone} onChange={(e) => setNewTimezone(e.target.value)}>
                            {TIMEZONES.map((tz) => (
                              <option key={tz.value} value={tz.value}>{tz.label}</option>
                            ))}
                          </Select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-medium text-muted-foreground">Label (optional)</label>
                          <Input
                            type="text"
                            placeholder="e.g. Morning Service"
                            value={newLabel}
                            onChange={(e) => setNewLabel(e.target.value)}
                          />
                        </div>
                      </div>
                      {scheduleError && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {scheduleError}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleAddSchedule}>Add</Button>
                        <Button size="sm" variant="outline" onClick={() => { setAdding(false); setScheduleError("") }}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setAdding(true); setScheduleError("") }}
                      className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg border border-dashed border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border/80 hover:bg-accent/20 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add schedule
                    </button>
                  )}
                </div>
              </SectionCard>

              <SectionCard>
                <SectionHeader
                  icon={Clock}
                  title="Countdown fallback"
                  description="Used when no recurring schedule matches today. Set the time and timezone so the countdown stays accurate."
                />
                <SettingRow label="Default start time">
                  <Input
                    type="time"
                    value={serviceTime}
                    onChange={(e) => {
                      setServiceTime(e.target.value)
                      queueSave({ serviceTime: e.target.value })
                    }}
                    className="w-36"
                  />
                </SettingRow>
                <SettingRow label="Timezone" last>
                  <Select
                    value={serviceTimezone}
                    onChange={(e) => {
                      setServiceTimezone(e.target.value)
                      queueSave({ serviceTimezone: e.target.value })
                    }}
                    className="w-56"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>{tz.label}</option>
                    ))}
                  </Select>
                </SettingRow>
              </SectionCard>

            </div>
          )}

          {/* ── Display ── */}
          {activeTab === "display" && (
            <div className="flex flex-col gap-5 max-w-2xl">

              {/* Output routing */}
              <SectionCard>
                <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-border">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Monitor className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-semibold">Output routing</h2>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      Choose which physical screens receive the projection and confidence monitor. Saved automatically and restored every session.
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      window.worshipsync.window.getDisplays().then((d) => {
                        setDisplays(d)
                        // Refresh only clears the selection if no preference was ever saved;
                        // it does not overwrite the saved preference just because the display
                        // isn't currently connected.
                        const fallback = d.find((x) => !x.isPrimary)?.id ?? d[0]?.id
                        if (outputDisplayId === undefined) setOutputDisplayId(fallback)
                        if (confidenceDisplayId === undefined) setConfidenceDisplayId(fallback)
                      })
                    }
                    className="shrink-0 text-[11px] font-medium text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-md border border-border hover:bg-accent/30 transition-colors mt-0.5"
                  >
                    Refresh
                  </button>
                </div>
                <SettingRow
                  label="Main projection"
                  description={
                    outputDisplayId !== undefined && !displays.find(d => d.id === outputDisplayId)
                      ? "⚠ Previously selected display is disconnected — choose another."
                      : "The audience-facing screen where slides appear."
                  }
                >
                  <select
                    className={`w-64 bg-input border rounded-md px-3 py-1.5 text-sm text-foreground cursor-pointer outline-none focus:border-primary/50 ${
                      outputDisplayId !== undefined && !displays.find(d => d.id === outputDisplayId)
                        ? "border-red-500/50"
                        : "border-border"
                    }`}
                    value={outputDisplayId ?? ""}
                    onChange={(e) => {
                      const id = Number(e.target.value)
                      setOutputDisplayId(id)
                      queueSave({ outputDisplayId: id })
                    }}
                  >
                    {outputDisplayId !== undefined && !displays.find(d => d.id === outputDisplayId) && (
                      <option value={outputDisplayId} disabled>
                        Saved display (not connected)
                      </option>
                    )}
                    {displays.length === 0 && outputDisplayId === undefined && (
                      <option value="">No displays detected</option>
                    )}
                    {displays.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}{d.isPrimary ? " (Primary)" : ""} — {d.width}×{d.height}
                      </option>
                    ))}
                  </select>
                </SettingRow>
                <SettingRow
                  label="Confidence monitor"
                  description={
                    confidenceDisplayId !== undefined && !displays.find(d => d.id === confidenceDisplayId)
                      ? "⚠ Previously selected display is disconnected — choose another."
                      : "Opens automatically at startup when enabled. The presenter-facing screen showing upcoming lyrics."
                  }
                  last
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        const next = !confidenceEnabled
                        setConfidenceEnabled(next)
                        queueSave({ confidenceEnabled: next })
                        if (next) window.worshipsync.confidence.open(confidenceDisplayId)
                        else window.worshipsync.confidence.close()
                      }}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors focus:outline-none ${
                        confidenceEnabled ? "bg-amber-500 border-amber-600" : "bg-muted border-border"
                      }`}
                      role="switch"
                      aria-checked={confidenceEnabled}
                      title={confidenceEnabled ? "Disable auto-open" : "Enable auto-open"}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${confidenceEnabled ? "translate-x-5" : "translate-x-1"}`} />
                    </button>
                    <select
                      disabled={!confidenceEnabled}
                      className={`w-64 bg-input border rounded-md px-3 py-1.5 text-sm text-foreground outline-none transition-opacity ${
                        !confidenceEnabled
                          ? "opacity-40 cursor-not-allowed"
                          : confidenceDisplayId !== undefined && !displays.find(d => d.id === confidenceDisplayId)
                            ? "border-red-500/50 cursor-pointer focus:border-primary/50"
                            : "border-border cursor-pointer focus:border-primary/50"
                      }`}
                      value={confidenceDisplayId ?? ""}
                      onChange={(e) => {
                        const id = Number(e.target.value)
                        setConfidenceDisplayId(id)
                        queueSave({ confidenceDisplayId: id })
                      }}
                    >
                      {confidenceDisplayId !== undefined && !displays.find(d => d.id === confidenceDisplayId) && (
                        <option value={confidenceDisplayId} disabled>
                          Saved display (not connected)
                        </option>
                      )}
                      {displays.length === 0 && confidenceDisplayId === undefined && (
                        <option value="">No displays detected</option>
                      )}
                      {displays.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.label}{d.isPrimary ? " (Primary)" : ""} — {d.width}×{d.height}
                        </option>
                      ))}
                    </select>
                  </div>
                </SettingRow>
              </SectionCard>

              <SectionCard>
                <SectionHeader
                  icon={Monitor}
                  title="Projection display"
                  description="Controls how slides appear on the audience screen. Changes apply to new slides immediately."
                />

                {/* Font size */}
                <div className="px-5 py-4 border-b border-border">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <p className="text-sm font-medium">Lyrics font size</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Text auto-scales down for longer lines but never exceeds this size.
                      </p>
                    </div>
                    <span className="text-xs font-mono font-semibold text-muted-foreground shrink-0 mt-0.5">
                      {projectionFontSize}px
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mb-3">
                    <SegmentedControl
                      options={[
                        { label: "S", value: 32 },
                        { label: "M", value: 48 },
                        { label: "L", value: 64 },
                        { label: "XL", value: 80 },
                      ]}
                      value={[32, 48, 64, 80].includes(projectionFontSize) ? projectionFontSize : -1}
                      onChange={(v) => {
                        setProjectionFontSize(v as number)
                        queueSave({ projectionFontSize: v })
                      }}
                    />
                  </div>
                  <input
                    type="range" min={24} max={96} step={2}
                    value={projectionFontSize}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      setProjectionFontSize(v)
                      queueSave({ projectionFontSize: v })
                    }}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>24px</span><span>96px</span>
                  </div>
                  {/* Live preview */}
                  <div className="mt-4 rounded-xl bg-black/60 border border-border/50 overflow-hidden flex items-center justify-center" style={{ height: "80px" }}>
                    <p
                      className="font-bold text-white text-center leading-none"
                      style={{ fontSize: `${Math.min(projectionFontSize * 0.5, 48)}px` }}
                    >
                      Amazing Grace
                    </p>
                  </div>
                </div>

                {/* Slide transitions */}
                <SettingRow
                  label="Slide transitions"
                  description="Crossfade duration when switching slides. Off = instant cut."
                  last
                >
                  <SegmentedControl
                    options={[
                      { label: "Off", value: 0 },
                      { label: "Fast", value: 150 },
                      { label: "Normal", value: 300 },
                      { label: "Slow", value: 500 },
                    ]}
                    value={slideTransitionMs}
                    onChange={(v) => {
                      setSlideTransitionMs(v as number)
                      queueSave({ slideTransitionMs: v })
                    }}
                  />
                </SettingRow>
              </SectionCard>

            </div>
          )}

          {/* ── Network ── */}
          {activeTab === "network" && (
            <div className="flex flex-col gap-5 max-w-2xl">

              {/* Server toggle */}
              <SectionCard>
                <div className="px-5 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        stageRunning ? "bg-green-500/15" : "bg-muted"
                      }`}>
                        <Signal className={`h-4.5 w-4.5 transition-colors ${stageRunning ? "text-green-500" : "text-muted-foreground"}`} style={{ width: 18, height: 18 }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">Local network server</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {stageRunning
                            ? "Running — stage display and PWA controller are live"
                            : "Off — starts automatically when you go live"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleStageToggle}
                      disabled={stageLoading}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 shrink-0 ${
                        stageRunning ? "bg-green-500" : "bg-muted-foreground/30"
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                        stageRunning ? "translate-x-6" : "translate-x-1"
                      }`} />
                    </button>
                  </div>

                  {/* Port (only when off) */}
                  {!stageRunning && (
                    <div className="mt-4 flex items-center gap-2">
                      <label className="text-xs text-muted-foreground whitespace-nowrap">Port</label>
                      <input
                        type="number"
                        min={1024}
                        max={65535}
                        value={stagePortInput}
                        onChange={e => setStagePortInput(e.target.value)}
                        className="h-8 rounded-md border border-border bg-background px-3 text-sm font-mono w-28 focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <span className="text-xs text-muted-foreground">default 4040</span>
                    </div>
                  )}
                </div>

                {/* Connection URLs (only when running) */}
                {stageRunning && (
                  <div className="border-t border-border">

                    {/* PWA Controller */}
                    <div className="px-5 py-4 border-b border-border">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-xs font-semibold">PWA Controller</p>
                          <p className="text-[11px] text-muted-foreground">Remote control from any phone or tablet</p>
                        </div>
                        <button
                          onClick={() => setShowQR(v => v === 'controller' ? null : 'controller')}
                          className={`text-xs font-medium transition-colors px-2.5 py-1 rounded-md ${
                            showQR === 'controller'
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
                          }`}
                        >
                          {showQR === 'controller' ? "Hide QR" : "Show QR"}
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs font-mono bg-secondary/40 border border-border rounded-lg px-3 py-2 truncate">
                          {stageMdnsURL ? `${stageMdnsURL}/controller` : `${stageURL}/controller`}
                        </code>
                        <button
                          onClick={() => {
                            const url = stageMdnsURL ? `${stageMdnsURL}/controller` : `${stageURL}/controller`
                            handleCopyURL(url, setStageMdnsCopied)
                          }}
                          className="h-8 px-2.5 flex items-center gap-1 rounded-md border border-border text-xs font-medium hover:bg-accent transition-colors shrink-0"
                        >
                          {stageMdnsCopied
                            ? <><Check className="h-3.5 w-3.5 text-green-500" /> Copied</>
                            : <><Copy className="h-3.5 w-3.5" /> Copy</>}
                        </button>
                      </div>
                      {showQR === 'controller' && (() => {
                        const base = stageMdnsURL || stageURL
                        const controllerUrl = controllerPin.trim()
                          ? `${base}/controller?p=${encodeURIComponent(controllerPin.trim())}`
                          : `${base}/controller`
                        return (
                          <div className="mt-3 flex flex-col items-center gap-2">
                            <div className="bg-white p-3 rounded-xl inline-block">
                              <QRCodeSVG value={controllerUrl} size={160} level="M" />
                            </div>
                            <p className="text-[11px] text-muted-foreground text-center">
                              Scan to open the PWA controller
                              {controllerPin.trim() ? " — PIN embedded" : ""}
                            </p>
                          </div>
                        )
                      })()}
                    </div>

                    {/* Stage Display */}
                    <div className="px-5 py-4 border-b border-border">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-xs font-semibold">Stage Display</p>
                          <p className="text-[11px] text-muted-foreground">Current lyrics + countdown for worship leader</p>
                        </div>
                        <button
                          onClick={() => setShowQR(v => v === 'stage' ? null : 'stage')}
                          className={`text-xs font-medium transition-colors px-2.5 py-1 rounded-md ${
                            showQR === 'stage'
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
                          }`}
                        >
                          {showQR === 'stage' ? "Hide QR" : "Show QR"}
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs font-mono bg-secondary/40 border border-border rounded-lg px-3 py-2 truncate text-muted-foreground">
                          {stageMdnsURL || stageURL}
                        </code>
                        <button
                          onClick={() => handleCopyURL(stageMdnsURL || stageURL, setStageCopied)}
                          className="h-8 px-2.5 flex items-center gap-1 rounded-md border border-border text-xs font-medium hover:bg-accent transition-colors shrink-0"
                        >
                          {stageCopied
                            ? <><Check className="h-3.5 w-3.5 text-green-500" /> Copied</>
                            : <><Copy className="h-3.5 w-3.5" /> Copy</>}
                        </button>
                      </div>
                      {showQR === 'stage' && (
                        <div className="mt-3 flex flex-col items-center gap-2">
                          <div className="bg-white p-3 rounded-xl inline-block">
                            <QRCodeSVG value={stageMdnsURL || stageURL} size={160} level="M" />
                          </div>
                          <p className="text-[11px] text-muted-foreground text-center">Scan to open the stage display</p>
                        </div>
                      )}
                    </div>

                    {/* Connected devices */}
                    <div className="px-5 py-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {stageClients === 0
                            ? "No devices connected"
                            : `${stageClients} device${stageClients > 1 ? "s" : ""} connected`}
                        </span>
                        <button
                          onClick={refreshStageStatus}
                          className="ml-auto text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                        >
                          Refresh
                        </button>
                      </div>
                      {stageClientList.length > 0 && (
                        <div className="flex flex-col gap-1">
                          {stageClientList.map((c, i) => (
                            <div key={i} className="flex items-center gap-2 rounded-lg bg-secondary/30 border border-border px-3 py-2">
                              <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                              <span className="text-xs font-medium flex-1 truncate">{c.device}</span>
                              {c.type && (
                                <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                  c.type === 'pwa'
                                    ? 'bg-primary/10 text-primary'
                                    : 'bg-muted text-muted-foreground'
                                }`}>
                                  {c.type === 'pwa' ? 'Controller' : 'Stage'}
                                </span>
                              )}
                              <span className="text-[11px] text-muted-foreground font-mono">{c.ip}</span>
                              <span className="text-[11px] text-muted-foreground">
                                {c.connectedForSeconds < 60
                                  ? `${c.connectedForSeconds}s`
                                  : `${Math.floor(c.connectedForSeconds / 60)}m`}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </SectionCard>

              {/* Controller PIN */}
              <SectionCard>
                <SectionHeader
                  icon={Lock}
                  title="Controller PIN"
                  description="Optional PIN to prevent unauthorized access to the PWA controller. Leave blank to allow anyone on the same Wi-Fi."
                />
                <div className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <Input
                      type="password"
                      placeholder="Leave blank for no PIN"
                      value={controllerPin}
                      maxLength={8}
                      onChange={(e) => setControllerPin(e.target.value.replace(/[^0-9a-zA-Z]/g, ''))}
                      className="font-mono tracking-widest w-48"
                    />
                    <Button size="sm" onClick={handleSavePin}>Save</Button>
                    {pinSaved && (
                      <span className="text-xs text-green-500 flex items-center gap-1 whitespace-nowrap">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Saved
                      </span>
                    )}
                  </div>
                  {controllerPin.trim() && (
                    <p className="text-[11px] text-muted-foreground mt-2">
                      The controller QR code embeds this PIN so scanning auto-unlocks. Share it separately with anyone typing the URL.
                    </p>
                  )}
                </div>
              </SectionCard>

            </div>
          )}

          {/* ── Data ── */}
          {activeTab === "data" && (
            <div className="flex flex-col gap-5 max-w-2xl">
              <SectionCard>
                <SectionHeader
                  icon={Database}
                  title="Backup & restore"
                  description="Export all songs, service plans, themes, and background images into a single archive file. Import to restore or transfer to another computer."
                />
                <div className="px-5 py-4 flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleExport}
                      className="flex items-center justify-center gap-2 py-3 rounded-xl border border-border bg-secondary/30 hover:bg-secondary/60 transition-colors text-sm font-medium"
                    >
                      <Download className="h-4 w-4" />
                      Export backup…
                    </button>
                    <button
                      onClick={handleImport}
                      className="flex items-center justify-center gap-2 py-3 rounded-xl border border-border bg-secondary/30 hover:bg-secondary/60 transition-colors text-sm font-medium"
                    >
                      <Upload className="h-4 w-4" />
                      Import backup…
                    </button>
                  </div>
                  {dataStatus && (
                    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs ${
                      dataStatus.type === "success"
                        ? "border-green-500/30 bg-green-500/10 text-green-500"
                        : "border-destructive/30 bg-destructive/10 text-destructive"
                    }`}>
                      {dataStatus.type === "success"
                        ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        : <AlertCircle  className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                      <span>{dataStatus.msg}</span>
                    </div>
                  )}
                </div>
              </SectionCard>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
