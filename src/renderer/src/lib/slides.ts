// Shared slide-building and lyrics-section helpers used by Library, Builder,
// Presenter, and the lyrics editor.

export interface Slide {
  lines: string[]
  sectionLabel: string
  sectionType: string
  sectionId: number
  globalIndex: number
}

export const SECTION_ABBREV: Record<string, string> = {
  verse: "V",
  chorus: "C",
  bridge: "B",
  "pre-chorus": "PC",
  intro: "I",
  outro: "O",
  tag: "T",
  interlude: "IL",
  blank: "B",
}

export const SECTION_BADGE_COLORS: Record<string, string> = {
  verse: "bg-green-600",
  chorus: "bg-blue-600",
  bridge: "bg-amber-600",
  "pre-chorus": "bg-violet-600",
  intro: "bg-slate-600",
  outro: "bg-slate-600",
  tag: "bg-red-600",
  interlude: "bg-slate-600",
}

// ── Serialize/parse bracket-tag lyrics ──────────────────────────────────────

export function sectionsToText(sections: { label: string; lyrics: string }[]): string {
  return sections.map((s) => `[${s.label}]\n${s.lyrics}`).join("\n\n")
}

export function textToSections(text: string): { type: string; label: string; lyrics: string; orderIndex: number }[] {
  const result: { type: string; label: string; lyrics: string; orderIndex: number }[] = []
  const tagPattern = /^\[(.+?)\]$/
  const lines = text.split("\n")
  let current: { type: string; label: string; lyrics: string[] } | null = null

  for (const line of lines) {
    const match = line.match(tagPattern)
    if (match) {
      if (current) {
        result.push({
          type: current.type,
          label: current.label,
          lyrics: current.lyrics.join("\n").trim(),
          orderIndex: result.length,
        })
      }
      const label = match[1]
      const lower = label.toLowerCase()
      let type = "verse"
      if (lower.startsWith("chorus")) type = "chorus"
      else if (lower.startsWith("bridge")) type = "bridge"
      else if (lower.startsWith("pre-chorus") || lower.startsWith("pre chorus")) type = "pre-chorus"
      else if (lower.startsWith("intro")) type = "intro"
      else if (lower.startsWith("outro") || lower.startsWith("ending")) type = "outro"
      else if (lower.startsWith("tag")) type = "tag"
      else if (lower.startsWith("interlude")) type = "interlude"
      current = { type, label, lyrics: [] }
    } else if (current) {
      current.lyrics.push(line)
    }
  }
  if (current) {
    result.push({
      type: current.type,
      label: current.label,
      lyrics: current.lyrics.join("\n").trim(),
      orderIndex: result.length,
    })
  }
  return result
}

// ── Build presentable slides from a song's sections ─────────────────────────

export function buildSlides(
  sections: { id: number; type: string; label: string; lyrics: string }[],
  maxLines = 2,
): Slide[] {
  const slides: Slide[] = []
  let globalIndex = 0
  for (const sec of sections) {
    // Split into paragraphs on blank lines — each paragraph boundary forces a new slide
    const paragraphs: string[][] = []
    let current: string[] = []
    for (const line of sec.lyrics.split("\n")) {
      if (line.trim() === "") {
        if (current.length > 0) { paragraphs.push(current); current = [] }
      } else {
        current.push(line)
      }
    }
    if (current.length > 0) paragraphs.push(current)

    if (paragraphs.length === 0) {
      // Media/blank slides: create one slide with empty line so background shows
      slides.push({
        lines: [""],
        sectionLabel: sec.label,
        sectionType: sec.type,
        sectionId: sec.id,
        globalIndex: globalIndex++,
      })
      continue
    }
    for (const para of paragraphs) {
      for (let i = 0; i < para.length; i += maxLines) {
        slides.push({
          lines: para.slice(i, i + maxLines),
          sectionLabel: sec.label,
          sectionType: sec.type,
          sectionId: sec.id,
          globalIndex: globalIndex++,
        })
      }
    }
  }
  return slides
}
