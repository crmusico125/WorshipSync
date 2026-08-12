import { useEffect, useRef, useState } from "react"
import { Check } from "lucide-react"
import { useUiPrefsStore } from "../store/useUiPrefsStore"

const ZOOM_LEVELS = [75, 90, 100, 110, 125, 150] as const

/**
 * Small "100%" label in the title bar — click to jump straight to any
 * supported zoom level. Purely a view over useUiPrefsStore; the same store
 * (and the same main-process state) also drives the View menu and
 * Cmd/Ctrl+Plus/Minus/0, so all three always agree.
 */
export default function ZoomIndicator() {
  const zoomPercent = useUiPrefsStore(s => s.zoomPercent)
  const setZoom = useUiPrefsStore(s => s.setZoom)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener("mousedown", onClickOutside)
    return () => window.removeEventListener("mousedown", onClickOutside)
  }, [open])

  return (
    <div ref={rootRef} className="relative" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
      <button
        onClick={() => setOpen(v => !v)}
        title="UI zoom level"
        className="text-[11px] font-medium text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted/50 transition-colors tabular-nums"
      >
        {zoomPercent}%
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-24 rounded-lg border border-border bg-card shadow-xl py-1 z-50">
          {ZOOM_LEVELS.map(level => (
            <button
              key={level}
              onClick={() => { setZoom(level); setOpen(false) }}
              className="w-full flex items-center justify-between gap-2 px-2.5 py-1 text-[11px] hover:bg-accent/40 transition-colors"
            >
              <span className="tabular-nums">{level}%</span>
              {level === zoomPercent && <Check className="h-3 w-3 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
