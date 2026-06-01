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
  const refRegex = /^(.+?)\s+(\d+):(\d+)(?:[–\-](\d+))?$/

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
  const verseStart = parseInt(refMatch[3])
  const verseEnd = refMatch[4] ? parseInt(refMatch[4]) : verseStart

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
    bodyLines.push(line)
  }

  const bodyText = bodyLines.join(' ').replace(/\s{2,}/g, ' ').trim()
  if (!bodyText) return null

  let remaining = bodyText.replace(new RegExp(`^${verseStart}\\s+`), '').trim()
  const verses: { number: number; text: string }[] = []

  if (verseStart === verseEnd) {
    verses.push({ number: verseStart, text: remaining.trim() })
  } else {
    let currentNum = verseStart
    for (let v = verseStart + 1; v <= verseEnd; v++) {
      let searchFrom = 0; let found = -1
      while (searchFrom < remaining.length) {
        const target = ` ${v} `
        const idx = remaining.indexOf(target, searchFrom)
        if (idx === -1) break
        const before = remaining[idx - 1]; const after = remaining[idx + target.length]
        if ((before && /\d/.test(before)) || (after && /\d/.test(after))) { searchFrom = idx + 1; continue }
        found = idx; break
      }
      if (found !== -1) {
        verses.push({ number: currentNum, text: remaining.slice(0, found).trim() })
        remaining = remaining.slice(found + ` ${v} `.length).trim()
        currentNum = v
      }
    }
    verses.push({ number: currentNum, text: remaining.trim() })
  }

  const valid = verses.filter(v => v.text.length > 0)
  if (valid.length === 0) return null
  const range = verseStart === verseEnd ? `${verseStart}` : `${verseStart}-${verseEnd}`
  return { title: `${book} ${chapter}:${range} (${version})`, book, chapter, version, verses: valid }
}
