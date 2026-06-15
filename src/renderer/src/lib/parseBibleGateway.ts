export interface ParsedScripture {
  title: string
  book: string
  chapter: number
  version: string
  verses: { number: number; text: string }[]
}

const SCRIPTURE_VERSION_MAP: Record<string, string> = {
  'New International Version': 'NIV', 'English Standard Version': 'ESV',
  'King James Version': 'KJV', 'New King James Version': 'NKJV',
  'New Living Translation': 'NLT', 'Christian Standard Bible': 'CSB',
  'New American Standard Bible': 'NASB', 'New American Standard': 'NASB',
  'Revised Standard Version': 'RSV', 'New Revised Standard Version': 'NRSV',
  'American Standard Version': 'ASV', 'Amplified Bible': 'AMP',
  'The Message': 'MSG', 'Good News Translation': 'GNT',
  'Contemporary English Version': 'CEV', 'Berean Standard Bible': 'BSB',
  'World English Bible': 'WEB', 'Holman Christian Standard Bible': 'HCSB',
}

const SCRIPTURE_COPYRIGHT_PATTERNS = [
  /^New [\w\s]+ Version/, /^Holy Bible/, /©/, /^Used by permission/i,
  /^All rights reserved/i, /^Scripture (quotations|taken)/i,
  /^Crossway/i, /^Biblica/i, /^Footnotes/i, /^Zondervan/i,
  /^Thomas Nelson/i, /^Tyndale/i,
]

export function parseBibleGatewayText(raw: string): ParsedScripture | null {
  const text = raw
    .replace(/\[[a-zA-Z]\]/g, '').replace(/\[\d+\]/g, '')
    .replace(/ /g, ' ').replace(/['']/g, "'").replace(/[""]/g, '"')

  const allLines = text.split('\n').map(l => l.trim())
  // Verse part is optional so whole-chapter references like "Luke 11" (no ":verse") also match.
  const refRegex = /^(.+?)\s+(\d+)(?::(\d+)(?:[–\-](\d+))?)?$/

  let refLineIdx = -1; let refMatch: RegExpMatchArray | null = null
  for (let i = 0; i < Math.min(allLines.length, 5); i++) {
    const line = allLines[i]; if (!line) continue
    const m = line.match(refRegex)
    if (m && m[1].trim().length <= 25 && parseInt(m[2]) >= 1 && parseInt(m[2]) <= 150) {
      refMatch = m; refLineIdx = i; break
    }
  }
  if (!refMatch) return null

  const book = refMatch[1].trim()
  const chapter = parseInt(refMatch[2])
  const isWholeChapter = !refMatch[3]
  const verseStart = isWholeChapter ? 1 : parseInt(refMatch[3])

  let version = ''
  for (let i = refLineIdx + 1; i < Math.min(refLineIdx + 4, allLines.length); i++) {
    const line = allLines[i]; if (!line) continue
    if (/^\d/.test(line)) break
    const cleaned = line.replace(/[()]/g, '').trim()
    const lc = cleaned.toLowerCase()
    for (const [name, abbr] of Object.entries(SCRIPTURE_VERSION_MAP).sort((a, b) => b[0].length - a[0].length)) {
      if (lc.includes(name.toLowerCase())) { version = abbr; break }
    }
    if (version) break
    if (/^[A-Z]{2,10}$/.test(cleaned)) { version = cleaned; break }
  }
  if (!version) version = 'NIV'

  const bodyLines: string[] = []
  let skippedVersion = false
  for (let i = refLineIdx + 1; i < allLines.length; i++) {
    const line = allLines[i]
    if (!skippedVersion && line && !/^\d/.test(line)) { skippedVersion = true; continue }
    if (SCRIPTURE_COPYRIGHT_PATTERNS.some(p => p.test(line))) break
    // Skip section heading lines BibleGateway inserts between passages (e.g. "Jesus'
    // Teaching on Prayer") — identified by starting with a capital letter, not ending
    // mid-sentence, and being directly followed by the next verse marker.
    if (line && /^[A-Z]/.test(line) && !/[.,;:!?'"’”]$/.test(line)) {
      const next = allLines.slice(i + 1).find(l => l)
      if (next && /^\d/.test(next)) continue
    }
    bodyLines.push(line)
  }

  const bodyText = bodyLines.join(' ').replace(/\s{2,}/g, ' ').trim()
  if (!bodyText) return null

  // A whole-chapter paste has no verse-1 marker — BibleGateway shows the chapter
  // number as a drop cap in its place, so strip that prefix instead of "1 ".
  const leadingMarker = isWholeChapter ? chapter : verseStart
  let remaining = bodyText.replace(new RegExp(`^${leadingMarker}\\s+`), '').trim()
  const verses: { number: number; text: string }[] = []

  // Walk forward through the expected next verse number (verseStart+1, +2, ...),
  // splitting off each verse's text as its marker is found. Stops at the first
  // missing marker, so the detected last verse reflects the actual sequential
  // numbering in the pasted text rather than any range stated in the reference
  // line — a stray number elsewhere in the text (e.g. "40 days") can't extend
  // the range since it won't match the specific number being searched for.
  let currentNum = verseStart
  for (let v = verseStart + 1; ; v++) {
    const target = ` ${v} `
    let searchFrom = 0; let found = -1
    while (searchFrom < remaining.length) {
      const idx = remaining.indexOf(target, searchFrom)
      if (idx === -1) break
      const before = remaining[idx - 1]; const after = remaining[idx + target.length]
      if ((before && /\d/.test(before)) || (after && /\d/.test(after))) { searchFrom = idx + 1; continue }
      found = idx; break
    }
    if (found === -1) break
    verses.push({ number: currentNum, text: remaining.slice(0, found).trim() })
    remaining = remaining.slice(found + target.length).trim()
    currentNum = v
  }
  verses.push({ number: currentNum, text: remaining.trim() })

  const valid = verses.filter(v => v.text.length > 0)
  if (valid.length === 0) return null
  const range = verseStart === currentNum ? `${verseStart}` : `${verseStart}-${currentNum}`
  return { title: `${book} ${chapter}:${range} (${version})`, book, chapter, version, verses: valid }
}
