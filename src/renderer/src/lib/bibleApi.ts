// ── Types ─────────────────────────────────────────────────────────────────────

export interface BibleApiVerse {
  book_name: string
  chapter: number
  verse: number
  text: string
}

export interface BibleApiResult {
  reference: string
  verses: BibleApiVerse[]
  translation_id: string
  translation_name: string
}

export interface BibleTranslation {
  id: string
  label: string
  /** true = requires API.Bible key */
  keyed?: boolean
}

// ── Free translations (bible-api.com, no key) ─────────────────────────────────

export const FREE_TRANSLATIONS: BibleTranslation[] = [
  { id: 'web',   label: 'WEB' },
  { id: 'kjv',   label: 'KJV' },
  { id: 'asv',   label: 'ASV' },
  { id: 'bbe',   label: 'BBE' },
  { id: 'ylt',   label: 'YLT' },
  { id: 'darby', label: 'DARBY' },
]

// Legacy export used in existing code
export const BIBLE_TRANSLATIONS = FREE_TRANSLATIONS

// ── API.Bible config ──────────────────────────────────────────────────────────

const API_BIBLE_BASE = 'https://api.scripture.api.bible/v1'

// Priority order for the "quick access" row when API.Bible is available
const PREFERRED_ABBREVS = ['NIV', 'NLT', 'NKJV', 'ESV', 'CSB', 'NASB', 'KJV', 'WEB', 'MSG', 'AMP', 'NCV', 'CEV']

// Simple in-memory cache so we don't refetch on every component mount
const _translationCache = new Map<string, BibleTranslation[]>()
// Maps bibleId → short abbreviation label (e.g. "de4e12af..." → "NIV")
const _labelCache = new Map<string, string>()

export async function fetchApiBibleTranslations(apiKey: string): Promise<BibleTranslation[]> {
  if (_translationCache.has(apiKey)) return _translationCache.get(apiKey)!

  const res = await fetch(`${API_BIBLE_BASE}/bibles?language=eng`, {
    headers: { 'api-key': apiKey },
  })
  if (!res.ok) throw new Error(`API.Bible translations fetch failed: ${res.status}`)

  const json = await res.json()
  const items: { id: string; abbreviation: string; name: string }[] = json.data ?? []

  // Deduplicate by abbreviation (API.Bible has multiple versions/editions per translation)
  const seen = new Set<string>()
  const deduped: BibleTranslation[] = []
  for (const item of items) {
    const abbrev = (item.abbreviation ?? '').toUpperCase().replace(/\s/g, '')
    if (!abbrev || seen.has(abbrev)) continue
    seen.add(abbrev)
    deduped.push({ id: item.id, label: abbrev, keyed: true })
    _labelCache.set(item.id, abbrev)
  }

  // Sort by preferred order, then alphabetically
  deduped.sort((a, b) => {
    const ai = PREFERRED_ABBREVS.indexOf(a.label)
    const bi = PREFERRED_ABBREVS.indexOf(b.label)
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1
    if (bi !== -1) return 1
    return a.label.localeCompare(b.label)
  })

  _translationCache.set(apiKey, deduped)
  return deduped
}

// ── Book name → OSIS ID ───────────────────────────────────────────────────────

const BOOK_OSIS: Record<string, string> = {
  genesis: 'GEN', gen: 'GEN',
  exodus: 'EXO', exo: 'EXO', ex: 'EXO',
  leviticus: 'LEV', lev: 'LEV',
  numbers: 'NUM', num: 'NUM',
  deuteronomy: 'DEU', deu: 'DEU', deut: 'DEU', dt: 'DEU',
  joshua: 'JOS', jos: 'JOS', josh: 'JOS',
  judges: 'JDG', jdg: 'JDG', judg: 'JDG',
  ruth: 'RUT', rut: 'RUT',
  '1 samuel': '1SA', '1sa': '1SA', '1 sam': '1SA', '1sam': '1SA', '1samuel': '1SA',
  '2 samuel': '2SA', '2sa': '2SA', '2 sam': '2SA', '2sam': '2SA', '2samuel': '2SA',
  '1 kings': '1KI', '1ki': '1KI', '1 kgs': '1KI', '1kgs': '1KI', '1kings': '1KI',
  '2 kings': '2KI', '2ki': '2KI', '2 kgs': '2KI', '2kgs': '2KI', '2kings': '2KI',
  '1 chronicles': '1CH', '1ch': '1CH', '1 chr': '1CH', '1chr': '1CH', '1chronicles': '1CH',
  '2 chronicles': '2CH', '2ch': '2CH', '2 chr': '2CH', '2chr': '2CH', '2chronicles': '2CH',
  ezra: 'EZR', ezr: 'EZR',
  nehemiah: 'NEH', neh: 'NEH',
  esther: 'EST', est: 'EST',
  job: 'JOB',
  psalms: 'PSA', psalm: 'PSA', psa: 'PSA', ps: 'PSA',
  proverbs: 'PRO', pro: 'PRO', prov: 'PRO',
  ecclesiastes: 'ECC', ecc: 'ECC', eccl: 'ECC', qoh: 'ECC',
  'song of solomon': 'SNG', 'song of songs': 'SNG', 'song': 'SNG', sng: 'SNG', sos: 'SNG', ss: 'SNG',
  isaiah: 'ISA', isa: 'ISA',
  jeremiah: 'JER', jer: 'JER',
  lamentations: 'LAM', lam: 'LAM',
  ezekiel: 'EZK', ezk: 'EZK', ezek: 'EZK',
  daniel: 'DAN', dan: 'DAN',
  hosea: 'HOS', hos: 'HOS',
  joel: 'JOL', jol: 'JOL',
  amos: 'AMO', amo: 'AMO',
  obadiah: 'OBA', oba: 'OBA', obad: 'OBA',
  jonah: 'JON', jon: 'JON',
  micah: 'MIC', mic: 'MIC',
  nahum: 'NAM', nam: 'NAM', nah: 'NAM',
  habakkuk: 'HAB', hab: 'HAB',
  zephaniah: 'ZEP', zep: 'ZEP', zeph: 'ZEP',
  haggai: 'HAG', hag: 'HAG',
  zechariah: 'ZEC', zec: 'ZEC', zech: 'ZEC',
  malachi: 'MAL', mal: 'MAL',
  matthew: 'MAT', mat: 'MAT', matt: 'MAT',
  mark: 'MRK', mrk: 'MRK', mk: 'MRK',
  luke: 'LUK', luk: 'LUK', lk: 'LUK',
  john: 'JHN', jhn: 'JHN', jn: 'JHN',
  acts: 'ACT', act: 'ACT',
  romans: 'ROM', rom: 'ROM',
  '1 corinthians': '1CO', '1co': '1CO', '1 cor': '1CO', '1cor': '1CO', '1corinthians': '1CO',
  '2 corinthians': '2CO', '2co': '2CO', '2 cor': '2CO', '2cor': '2CO', '2corinthians': '2CO',
  galatians: 'GAL', gal: 'GAL',
  ephesians: 'EPH', eph: 'EPH',
  philippians: 'PHP', php: 'PHP', phil: 'PHP',
  colossians: 'COL', col: 'COL',
  '1 thessalonians': '1TH', '1th': '1TH', '1 thess': '1TH', '1thess': '1TH', '1thessalonians': '1TH',
  '2 thessalonians': '2TH', '2th': '2TH', '2 thess': '2TH', '2thess': '2TH', '2thessalonians': '2TH',
  '1 timothy': '1TI', '1ti': '1TI', '1 tim': '1TI', '1tim': '1TI', '1timothy': '1TI',
  '2 timothy': '2TI', '2ti': '2TI', '2 tim': '2TI', '2tim': '2TI', '2timothy': '2TI',
  titus: 'TIT', tit: 'TIT',
  philemon: 'PHM', phm: 'PHM', phlm: 'PHM',
  hebrews: 'HEB', heb: 'HEB',
  james: 'JAS', jas: 'JAS',
  '1 peter': '1PE', '1pe': '1PE', '1 pet': '1PE', '1pet': '1PE', '1peter': '1PE',
  '2 peter': '2PE', '2pe': '2PE', '2 pet': '2PE', '2pet': '2PE', '2peter': '2PE',
  '1 john': '1JN', '1jn': '1JN', '1john': '1JN',
  '2 john': '2JN', '2jn': '2JN', '2john': '2JN',
  '3 john': '3JN', '3jn': '3JN', '3john': '3JN',
  jude: 'JUD', jud: 'JUD',
  revelation: 'REV', rev: 'REV', revelations: 'REV',
}

interface ParsedRef {
  osisPassageId: string
  bookName: string
  chapter: number
  startVerse: number
  endVerse: number
}

function parseReference(ref: string): ParsedRef | null {
  const trimmed = ref.trim()

  // chapter:verse or chapter:verse-endverse — e.g. "John 3:16", "Psalm 77:1-20"
  const withVerse = trimmed.match(/^((?:\d\s*)?[A-Za-z][A-Za-z ]*?)\s+(\d+):(\d+)(?:\s*[-–]\s*(\d+))?$/)
  if (withVerse) {
    const [, bookRaw, chStr, startStr, endStr] = withVerse
    const osisBook = BOOK_OSIS[bookRaw.trim().toLowerCase().replace(/\s+/g, ' ')]
    if (!osisBook) return null
    const chapter = parseInt(chStr, 10)
    const startVerse = parseInt(startStr, 10)
    const endVerse = endStr ? parseInt(endStr, 10) : startVerse
    const osisStart = `${osisBook}.${chapter}.${startVerse}`
    const osisEnd = `${osisBook}.${chapter}.${endVerse}`
    return {
      osisPassageId: startVerse === endVerse ? osisStart : `${osisStart}-${osisEnd}`,
      bookName: bookRaw.trim(), chapter, startVerse, endVerse,
    }
  }

  // chapter only — e.g. "Psalm 77", "John 3"
  const chapterOnly = trimmed.match(/^((?:\d\s*)?[A-Za-z][A-Za-z ]*?)\s+(\d+)$/)
  if (chapterOnly) {
    const [, bookRaw, chStr] = chapterOnly
    const osisBook = BOOK_OSIS[bookRaw.trim().toLowerCase().replace(/\s+/g, ' ')]
    if (!osisBook) return null
    const chapter = parseInt(chStr, 10)
    return {
      osisPassageId: `${osisBook}.${chapter}`,
      bookName: bookRaw.trim(), chapter, startVerse: 1, endVerse: 0, // 0 = full chapter
    }
  }

  return null
}

// ── API.Bible JSON content parsing ────────────────────────────────────────────

interface ApiBibleItem {
  type: 'tag' | 'text'
  name?: string
  attrs?: Record<string, string>
  items?: ApiBibleItem[]
  text?: string
}

function extractVersesFromJson(content: ApiBibleItem[], bookName: string, chapter: number): BibleApiVerse[] {
  // Each text node has attrs.verseId = "BOOK.CHAPTER.VERSE" (e.g. "PSA.77.1").
  // Text nodes without verseId are headings/titles — skip them.
  const verseMap = new Map<number, string[]>()

  function processNode(item: ApiBibleItem): void {
    if (item.type === 'text') {
      const verseId = item.attrs?.verseId  // e.g. "PSA.77.1"
      if (verseId) {
        const parts = verseId.split('.')
        const verseNum = parseInt(parts[parts.length - 1], 10)
        if (!isNaN(verseNum) && verseNum > 0) {
          const t = (item.text ?? '').trim()
          if (t) {
            if (!verseMap.has(verseNum)) verseMap.set(verseNum, [])
            verseMap.get(verseNum)!.push(t)
          }
        }
      }
      return
    }

    if (item.items) {
      for (const child of item.items) processNode(child)
    }
  }

  for (const item of content) processNode(item)

  return [...verseMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([verseNum, texts]) => ({
      book_name: bookName,
      chapter,
      verse: verseNum,
      text: texts.join(' ').replace(/\s+/g, ' ').trim(),
    }))
    .filter(v => v.text.length > 0)
}

async function fetchApiBiblePassage(reference: string, bibleId: string, apiKey: string): Promise<BibleApiResult> {
  const parsed = parseReference(reference)
  if (!parsed) throw new Error(`Could not parse reference: "${reference}"`)

  const url = `${API_BIBLE_BASE}/bibles/${encodeURIComponent(bibleId)}/passages/${encodeURIComponent(parsed.osisPassageId)}?content-type=json&include-verse-numbers=false&include-titles=false&include-chapter-numbers=false`
  const res = await fetch(url, { headers: { 'api-key': apiKey } })

  if (res.status === 404) throw new Error(`Passage not found: ${reference}`)
  if (!res.ok) throw new Error(`API.Bible error ${res.status}`)

  const json = await res.json()
  const data = json.data
  if (!data) throw new Error('No data in response')

  const rawRef = data.reference ?? reference
  const abbrev = _labelCache.get(bibleId) ?? bibleId.slice(0, 8).toUpperCase()

  const content: ApiBibleItem[] = Array.isArray(data.content) ? data.content : []
  const verses = extractVersesFromJson(content, parsed.bookName, parsed.chapter)

  if (verses.length === 0) {
    verses.push({ book_name: parsed.bookName, chapter: parsed.chapter, verse: parsed.startVerse, text: '' })
  }

  return { reference: rawRef, verses, translation_id: bibleId, translation_name: abbrev }
}

// ── Unified entry point ────────────────────────────────────────────────────────

const FREE_TRANSLATION_IDS = new Set(FREE_TRANSLATIONS.map(t => t.id))

/**
 * Fetch a Bible passage from either bible-api.com (no key needed for free translations)
 * or API.Bible (requires apiKey for keyed translations like NIV, NLT, NKJV).
 */
export async function fetchBiblePassage(
  reference: string,
  translationId: string,
  apiKey?: string | null,
): Promise<BibleApiResult> {
  if (FREE_TRANSLATION_IDS.has(translationId)) {
    const url = `https://bible-api.com/${encodeURIComponent(reference)}?translation=${translationId}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Server error ${res.status}`)
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    if (!Array.isArray(data.verses) || data.verses.length === 0) throw new Error('No verses found')
    return data as BibleApiResult
  }

  if (!apiKey) throw new Error('An API key is required for this translation. Add BIBLE_API_KEY to your .env file.')
  return fetchApiBiblePassage(reference, translationId, apiKey)
}

export function bibleResultToScriptureRef(result: BibleApiResult): string {
  // Use the abbreviation from translation_name when it's a short string, else translation_id
  const abbrev = result.translation_name.length <= 10
    ? result.translation_name.toUpperCase()
    : result.translation_id.toUpperCase()

  return JSON.stringify({
    verses: result.verses.map(v => ({
      label: `${v.book_name} ${v.chapter}:${v.verse} ${abbrev}`,
      text: v.text.trim().replace(/\s+/g, ' '),
    })),
  })
}
