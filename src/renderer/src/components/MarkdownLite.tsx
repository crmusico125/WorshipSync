import type { ReactNode } from "react"

/**
 * Minimal, dependency-free renderer for the small Markdown subset this app's
 * own release notes use (##/### headings, - bullet lists, **bold** inline).
 * Builds real React elements instead of raw HTML — release notes are fetched
 * over the network from GitHub, so this deliberately avoids
 * dangerouslySetInnerHTML rather than trusting/sanitizing that content.
 */

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4
      ? <strong key={`${keyPrefix}-${i}`} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
      : <span key={`${keyPrefix}-${i}`}>{part}</span>
  )
}

export default function MarkdownLite({ text, className = "" }: { text: string; className?: string }) {
  const lines = text.split("\n")
  const blocks: ReactNode[] = []
  let listItems: string[] = []

  const flushList = (key: string) => {
    if (listItems.length === 0) return
    blocks.push(
      <ul key={key} className="list-disc pl-4 space-y-0.5 my-1.5">
        {listItems.map((item, i) => <li key={i}>{renderInline(item, `${key}-li-${i}`)}</li>)}
      </ul>
    )
    listItems = []
  }

  lines.forEach((raw, i) => {
    const line = raw.trimEnd()
    const heading3 = line.match(/^###\s+(.*)/)
    const heading2 = line.match(/^##\s+(.*)/)
    const bullet = line.match(/^[-*]\s+(.*)/)

    if (bullet) {
      listItems.push(bullet[1])
      return
    }
    flushList(`list-${i}`)

    if (heading2) {
      blocks.push(<p key={i} className="font-bold text-foreground text-sm mt-2 first:mt-0">{renderInline(heading2[1], `h2-${i}`)}</p>)
    } else if (heading3) {
      blocks.push(<p key={i} className="font-bold text-foreground mt-2 first:mt-0">{renderInline(heading3[1], `h3-${i}`)}</p>)
    } else if (line.trim() !== "") {
      blocks.push(<p key={i} className="mt-1 first:mt-0">{renderInline(line, `p-${i}`)}</p>)
    }
    // Blank lines are just spacing between blocks — no node needed for them.
  })
  flushList("list-end")

  return <div className={className}>{blocks}</div>
}
