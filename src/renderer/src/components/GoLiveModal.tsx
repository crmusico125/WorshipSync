import { useState, useEffect, useMemo } from "react"
import { CheckCircle2, Circle, AlertCircle, Play, X } from "lucide-react"
import { useServiceStore } from "../store/useServiceStore"

type Display = { id: number; label: string; width: number; height: number; isPrimary: boolean }

export interface GoLiveConfirmOpts {
  displayId: number | undefined
  confidenceOn: boolean
  confidenceDisplayId: number | undefined
}

interface GoLiveModalProps {
  serviceId: number
  onCancel: () => void
  onConfirm: (opts: GoLiveConfirmOpts) => void
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  })
}

export default function GoLiveModal({ serviceId, onCancel, onConfirm }: GoLiveModalProps) {
  const service = useServiceStore(s => s.services.find(svc => svc.id === serviceId))

  const [lineup, setLineup] = useState<any[]>([])
  const [displays, setDisplays] = useState<Display[]>([])
  const [selectedDisplayId, setSelectedDisplayId] = useState<number | undefined>(undefined)
  const [confidenceDisplayId, setConfidenceDisplayId] = useState<number | undefined>(undefined)
  const [confidenceOn, setConfidenceOn] = useState(false)
  const [firstSongData, setFirstSongData] = useState<any | null>(null)

  const nonPrimaryDisplays = useMemo(() => displays.filter(d => !d.isPrimary), [displays])

  useEffect(() => {
    window.worshipsync.lineup.getForService(serviceId).then((items: any[]) => {
      setLineup(items)
      const firstSong = items.find((i: any) => i.itemType === "song" && i.song)
      if (firstSong?.song?.id) {
        window.worshipsync.songs.getById(firstSong.song.id).then((s: any) => {
          if (s) setFirstSongData(s)
        }).catch(() => {})
      }
    }).catch(() => {})

    Promise.all([
      window.worshipsync.window.getDisplays(),
      window.worshipsync.appState.get().catch(() => ({} as Record<string, any>)),
    ]).then(([d, state]) => {
      setDisplays(d)
      const outFallback = d.find((x: Display) => !x.isPrimary)?.id ?? d[0]?.id
      setSelectedDisplayId(typeof state.outputDisplayId === "number" ? state.outputDisplayId : outFallback)
      // Confidence display must be non-primary to avoid trapping the operator
      const nonPrimary = d.find((x: Display) => !x.isPrimary)
      const savedConf = typeof state.confidenceDisplayId === "number"
        ? d.find((x: Display) => x.id === state.confidenceDisplayId && !x.isPrimary)?.id
        : undefined
      setConfidenceDisplayId(savedConf ?? nonPrimary?.id)
      if (state.confidenceEnabled === true && nonPrimary) setConfidenceOn(true)
    }).catch(() => {})
  }, [serviceId])

  const itemCount = useMemo(() => lineup.filter((i: any) => i.itemType !== "section").length, [lineup])
  const canGoLive = itemCount > 0

  const firstSlideLines = useMemo(() => {
    if (!firstSongData?.sections?.length) return []
    const lines = (firstSongData.sections[0].lyrics || "").split("\n").filter(Boolean)
    return lines.slice(0, 2)
  }, [firstSongData])

  const firstItemTitle = useMemo(() => {
    const first = lineup.find((i: any) => i.itemType !== "section")
    return first?.song?.title ?? first?.title ?? "—"
  }, [lineup])

  const mainDisplayConnected = selectedDisplayId === undefined || !!displays.find(d => d.id === selectedDisplayId)

  const checks = [
    { label: `${itemCount} item${itemCount !== 1 ? "s" : ""} in lineup`, done: itemCount > 0, warn: false },
    {
      label: mainDisplayConnected ? "Output display ready" : "Output display not connected",
      done: mainDisplayConnected,
      warn: !mainDisplayConnected,
    },
    { label: "Confidence monitor", done: confidenceOn, optional: true, warn: false },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl w-[780px] max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold">Ready to go live?</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {service ? `${service.label} · ${formatDate(service.date)}` : "Loading…"}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left: checklist + controls */}
          <div className="w-[300px] shrink-0 border-r border-border flex flex-col gap-5 p-5 overflow-y-auto">
            {/* Checklist */}
            <div className="flex flex-col gap-2.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                Pre-Flight Checks
              </span>
              {checks.map(c => (
                <div key={c.label} className="flex items-center gap-2.5">
                  {c.done ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  ) : c.optional ? (
                    <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                  ) : (
                    <AlertCircle className={`h-4 w-4 shrink-0 ${c.warn ? "text-red-400" : "text-amber-400"}`} />
                  )}
                  <span className={`text-sm ${
                    c.done ? "text-foreground"
                    : c.optional ? "text-muted-foreground"
                    : c.warn ? "text-red-400" : "text-amber-400"
                  }`}>
                    {c.label}
                    {c.optional && <span className="text-xs text-muted-foreground ml-1">(optional)</span>}
                  </span>
                </div>
              ))}
            </div>

            <div className="h-px bg-border" />

            {/* Monitor diagram */}
            {displays.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  Display Layout
                </span>
                <div className="flex gap-3 items-end flex-wrap">
                  {displays.map((d, i) => {
                    const isOut = d.id === selectedDisplayId
                    const isConf = confidenceOn && d.id === confidenceDisplayId
                    const both = isOut && isConf
                    const w = 48
                    const h = Math.round(w * 9 / 16)
                    return (
                      <button
                        key={d.id}
                        onClick={() => setSelectedDisplayId(d.id)}
                        title={`Use ${d.label} for projection`}
                        className="flex flex-col items-center gap-1 group"
                      >
                        <div
                          className="relative rounded border-2 transition-all"
                          style={{
                            width: w,
                            height: h,
                            borderColor: isOut ? '#3b82f6' : isConf ? '#f59e0b' : 'rgba(255,255,255,0.12)',
                            background: isOut ? 'rgba(59,130,246,0.12)' : isConf ? 'rgba(245,158,11,0.10)' : 'rgba(255,255,255,0.03)',
                          }}
                        >
                          {both ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center leading-none gap-px">
                              <span style={{ fontSize: 7, fontWeight: 900, color: '#60a5fa', letterSpacing: '0.05em' }}>OUT</span>
                              <span style={{ fontSize: 7, fontWeight: 900, color: '#fbbf24', letterSpacing: '0.05em' }}>MON</span>
                            </div>
                          ) : isOut ? (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span style={{ fontSize: 8, fontWeight: 900, color: '#60a5fa', letterSpacing: '0.05em' }}>OUT</span>
                            </div>
                          ) : isConf ? (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span style={{ fontSize: 8, fontWeight: 900, color: '#fbbf24', letterSpacing: '0.05em' }}>MON</span>
                            </div>
                          ) : null}
                        </div>
                        <div style={{ width: 14, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
                        <span className="text-[9px] text-muted-foreground">
                          {d.isPrimary ? 'Primary' : `Display ${i + 1}`}
                        </span>
                      </button>
                    )
                  })}
                </div>
                {displays.length > 1 && (
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm border-2 border-blue-400" /><span className="text-[10px] text-muted-foreground">Projection</span></span>
                    {confidenceOn && <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm border-2 border-amber-400" /><span className="text-[10px] text-muted-foreground">Confidence</span></span>}
                  </div>
                )}
              </div>
            )}

            {/* Output display */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                Projection Display
              </label>
              {displays.length > 0 ? (
                <select
                  value={selectedDisplayId ?? ""}
                  onChange={e => setSelectedDisplayId(Number(e.target.value))}
                  className={`w-full bg-input border rounded-md px-2.5 py-1.5 text-[13px] text-foreground cursor-pointer outline-none focus:border-primary/50 ${
                    !mainDisplayConnected ? "border-red-500/50" : "border-border"
                  }`}
                >
                  {selectedDisplayId !== undefined && !displays.find(d => d.id === selectedDisplayId) && (
                    <option value={selectedDisplayId} disabled>Saved display (not connected)</option>
                  )}
                  {displays.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.label}{d.isPrimary ? " (Primary)" : ""} — {d.width}×{d.height}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-muted-foreground">No displays detected.</p>
              )}
            </div>

            {/* Confidence monitor */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                Confidence Monitor
              </label>
              <button
                onClick={() => nonPrimaryDisplays.length > 0 && setConfidenceOn(v => !v)}
                disabled={nonPrimaryDisplays.length === 0}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-all text-left ${
                  nonPrimaryDisplays.length === 0
                    ? "opacity-40 cursor-not-allowed bg-muted/20 border-border"
                    : confidenceOn
                    ? "bg-amber-500/10 border-amber-500/40 text-amber-300"
                    : "bg-muted/30 border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span className={`h-2 w-2 rounded-full shrink-0 ${confidenceOn && nonPrimaryDisplays.length > 0 ? "bg-amber-400" : "bg-muted-foreground/30"}`} />
                <span className="text-[13px] font-medium flex-1">
                  {nonPrimaryDisplays.length === 0
                    ? "Requires external display"
                    : confidenceOn ? "Will open on start" : "Off — click to enable"}
                </span>
                {nonPrimaryDisplays.length > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    confidenceOn ? "bg-amber-500/20 text-amber-400" : "bg-muted text-muted-foreground"
                  }`}>
                    {confidenceOn ? "ON" : "OFF"}
                  </span>
                )}
              </button>
              {confidenceOn && nonPrimaryDisplays.length > 0 && (
                <select
                  value={confidenceDisplayId ?? ""}
                  onChange={e => setConfidenceDisplayId(Number(e.target.value))}
                  className="w-full bg-input border border-amber-500/30 rounded-md px-2.5 py-1.5 text-[13px] text-foreground cursor-pointer outline-none focus:border-amber-500/50"
                >
                  {nonPrimaryDisplays.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.label} — {d.width}×{d.height}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Right: first slide preview */}
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 bg-background/40">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              First Slide
            </span>
            <div className="w-full max-w-md flex flex-col gap-2">
              <div
                className="relative overflow-hidden rounded-xl border border-border bg-black shadow-[0_0_40px_rgba(0,0,0,0.5)]"
                style={{ aspectRatio: "16/9", containerType: "inline-size" }}
              >
                {firstSlideLines.length > 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center px-6">
                    <p
                      className="text-center font-bold leading-snug text-white whitespace-pre-wrap"
                      style={{ fontSize: "5cqw" }}
                    >
                      {firstSlideLines.join("\n")}
                    </p>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-[12px] text-muted-foreground/50 italic">{firstItemTitle}</p>
                  </div>
                )}
              </div>
              <p className="text-center text-[11px] text-muted-foreground">{firstItemTitle}</p>
            </div>
            <p className="text-[11px] text-muted-foreground/50 text-center max-w-xs">
              This is what the congregation will see the moment you go live.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border shrink-0 flex items-center gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <div className="flex-1" />
          {!canGoLive && (
            <span className="text-xs text-amber-400 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" /> Add items in the Builder first
            </span>
          )}
          <button
            onClick={() => onConfirm({ displayId: selectedDisplayId, confidenceOn, confidenceDisplayId })}
            disabled={!canGoLive}
            className="flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-green-600 hover:bg-green-500 text-white shadow-[0_0_16px_rgba(34,197,94,0.25)] hover:shadow-[0_0_24px_rgba(34,197,94,0.35)] active:scale-[0.98]"
          >
            <Play className="h-4 w-4 fill-white" />
            Start Live
          </button>
        </div>
      </div>
    </div>
  )
}
