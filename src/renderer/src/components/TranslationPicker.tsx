import { useState, useEffect, useLayoutEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { ChevronDown, Search, Check } from "lucide-react"
import { COMMON_TRANSLATION_LABELS, translationDisplayName, type BibleTranslation } from "../lib/bibleApi"

const COMMON_SET = new Set(COMMON_TRANSLATION_LABELS)

interface Props {
  translations: BibleTranslation[]
  value: string
  onChange: (id: string) => void
  loading?: boolean
  className?: string
  /** Shown in the trigger when `value` doesn't match any translation — e.g. an "add" picker with no persistent selection. */
  placeholder?: string
  /**
   * Which edge of the trigger the panel's own edge lines up with — "right" opens leftward
   * (panel's right edge = trigger's right edge), "left" opens rightward (panel's left edge =
   * trigger's left edge). Caller's call, since it depends on what sits next to the trigger in
   * that specific layout (e.g. a sidebar to the right vs. open space) — not something this
   * component can infer correctly on its own. Defaults to "right". Always clamped to the actual
   * window edges regardless, as a fallback for a trigger sitting too close to one edge.
   */
  align?: "left" | "right"
}

const PANEL_WIDTH = 320 // w-80
const VIEWPORT_MARGIN = 8

export default function TranslationPicker({ translations, value, onChange, loading, className = "", placeholder, align = "right" }: Props) {
  const [open, setOpen]         = useState(false)
  const [search, setSearch]     = useState("")
  // Real screen coordinates for the portaled panel (see below) — null until measured, so nothing
  // renders at a wrong position for a frame. Computed from the trigger's actual bounding rect,
  // clamped to the window's real edges, so the panel is never clipped or miscalculated — a fixed
  // CSS anchor (left-0/right-0) kept breaking one of this component's two use sites, because it
  // sits inside a container narrower than the full window and any hardcoded direction is wrong
  // for one position or the other.
  const [coords, setCoords]     = useState<{ top: number; left: number } | null>(null)
  const containerRef            = useRef<HTMLDivElement>(null)
  const panelRef                = useRef<HTMLDivElement>(null)
  const searchRef               = useRef<HTMLInputElement>(null)

  // Close on outside click — panelRef included since the panel is portaled outside containerRef's
  // DOM subtree, so a click on an option would otherwise register as "outside" and close it.
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (containerRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
      setSearch("")
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  // Measure the trigger and compute the panel's fixed position before paint (useLayoutEffect, so
  // there's no visible flash at the wrong spot), then focus search. Measured fresh on every open
  // (not just once on mount) since the trigger's position can change between opens — e.g. more
  // comparison chips pushing the "+ Add translation" trigger further right each time one is added.
  useLayoutEffect(() => {
    if (!open) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) {
      const preferred = align === "right" ? rect.right - PANEL_WIDTH : rect.left
      // Clamped to the window as a fallback only for a trigger sitting close enough to an edge
      // that the preferred alignment would push the panel off-screen.
      const left = Math.min(
        Math.max(preferred, VIEWPORT_MARGIN),
        window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN,
      )
      setCoords({ top: rect.bottom + 6, left })
    }
    // preventScroll stops the browser from scrolling the nearest scrollable ancestor to bring the
    // input into view — without it, opening the picker visibly shifts content sideways even
    // though the input was already fully on-screen.
    setTimeout(() => searchRef.current?.focus({ preventScroll: true }), 50)
  }, [open, align])

  const selected = translations.find(t => t.id === value)
  const q = search.trim().toLowerCase()
  const filtered = q
    ? translations.filter(t => t.label.toLowerCase().includes(q) || t.fullName?.toLowerCase().includes(q))
    : translations

  const common = filtered.filter(t => COMMON_SET.has(t.label))
  const others  = filtered.filter(t => !COMMON_SET.has(t.label))

  function pick(id: string) {
    onChange(id)
    setOpen(false)
    setSearch("")
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={loading}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors ${
          open
            ? "border-primary/60 bg-primary/8 text-foreground"
            : "border-border bg-secondary text-muted-foreground hover:text-foreground hover:border-border/80"
        } disabled:opacity-50`}
      >
        <span className="min-w-[2.5rem] text-center">
          {loading ? "…" : (selected?.label ?? placeholder ?? "—")}
        </span>
        <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown panel — portaled to <body> and positioned with real fixed-pixel coordinates
          (see coords above), not CSS-relative to this trigger. That's what makes it immune to
          clipping by a scrollable/overflow-hidden ancestor and to width miscalculations from a
          container narrower than the full window — both of which broke simpler CSS-anchor
          approaches here. Option text inside stays left-aligned (see Option below). */}
      {open && coords && createPortal(
        <div
          ref={panelRef}
          style={{ position: "fixed", top: coords.top, left: coords.left, width: PANEL_WIDTH }}
          className="z-50 rounded-xl border border-border bg-popover shadow-lg flex flex-col overflow-hidden"
        >
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search translations…"
              className="flex-1 bg-transparent text-xs placeholder:text-muted-foreground/50 outline-none"
            />
          </div>

          {/* Options */}
          <div className="overflow-y-auto max-h-60">
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-xs text-muted-foreground text-center">No results</p>
            )}

            {common.length > 0 && (
              <Group label="Common">
                {common.map(t => (
                  <Option key={t.id} t={t} active={t.id === value} onPick={pick} />
                ))}
              </Group>
            )}

            {others.length > 0 && (
              <Group label={common.length > 0 ? "All translations" : "Translations"}>
                {others.map(t => (
                  <Option key={t.id} t={t} active={t.id === value} onPick={pick} />
                ))}
              </Group>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="pt-1 pb-0.5">
      <p className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
        {label}
      </p>
      {children}
    </div>
  )
}

function Option({ t, active, onPick }: { t: BibleTranslation; active: boolean; onPick: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPick(t.id)}
      title={translationDisplayName(t, t.id)}
      className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs transition-colors ${
        active
          ? "bg-primary/10 text-primary font-semibold"
          : "text-foreground hover:bg-accent/50"
      }`}
    >
      {/* Full name truncates on its own — the abbreviation is a separate, never-truncated
          badge, so it stays visible (e.g. "NIV") even when the full name can't fully fit. */}
      <span className="min-w-0 flex-1 truncate text-left">{t.fullName ?? t.label}</span>
      <span className="shrink-0 flex items-center gap-1.5">
        {t.fullName && <span className="text-[10px] font-semibold opacity-60">{t.label}</span>}
        {active && <Check className="h-3 w-3" />}
      </span>
    </button>
  )
}
