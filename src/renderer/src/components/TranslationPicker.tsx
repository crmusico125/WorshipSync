import { useState, useEffect, useRef } from "react"
import { ChevronDown, Search, Check } from "lucide-react"
import { COMMON_TRANSLATION_LABELS, type BibleTranslation } from "../lib/bibleApi"

const COMMON_SET = new Set(COMMON_TRANSLATION_LABELS)

interface Props {
  translations: BibleTranslation[]
  value: string
  onChange: (id: string) => void
  loading?: boolean
  className?: string
}

export default function TranslationPicker({ translations, value, onChange, loading, className = "" }: Props) {
  const [open, setOpen]     = useState(false)
  const [search, setSearch] = useState("")
  const containerRef        = useRef<HTMLDivElement>(null)
  const searchRef           = useRef<HTMLInputElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch("")
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  // Focus search when dropdown opens
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50)
  }, [open])

  const selected = translations.find(t => t.id === value)
  const q = search.trim().toLowerCase()
  const filtered = q ? translations.filter(t => t.label.toLowerCase().includes(q)) : translations

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
          {loading ? "…" : (selected?.label ?? "—")}
        </span>
        <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1.5 w-56 rounded-xl border border-border bg-popover shadow-lg flex flex-col overflow-hidden">
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
        </div>
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
      className={`w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors ${
        active
          ? "bg-primary/10 text-primary font-semibold"
          : "text-foreground hover:bg-accent/50"
      }`}
    >
      <span>{t.label}</span>
      {active && <Check className="h-3 w-3 shrink-0" />}
    </button>
  )
}
