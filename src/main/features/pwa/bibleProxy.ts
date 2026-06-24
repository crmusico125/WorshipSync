// Bible API proxy utilities for the PWA controller HTTP server.
// Mirrors the logic in src/renderer/src/lib/bibleApi.ts but runs in the main process.

const API_BIBLE_BASE = 'https://api.scripture.api.bible/v1'

export const FREE_TRANSLATION_IDS = new Set(['web', 'kjv', 'asv', 'bbe', 'ylt', 'darby'])

export const FREE_TRANSLATIONS = [
  { id: 'web', label: 'WEB' },
  { id: 'kjv', label: 'KJV' },
  { id: 'asv', label: 'ASV' },
  { id: 'bbe', label: 'BBE' },
  { id: 'ylt', label: 'YLT' },
  { id: 'darby', label: 'DARBY' },
]

export const COMMON_ABBREVS = ['NIV', 'NIV11', 'NLT', 'NKJV', 'ESV', 'ESVSB', 'CSB', 'NASB', 'NASB2020', 'KJV', 'WEB', 'MSG', 'AMP', 'NCV', 'CEV']

export interface ProxyTranslation { id: string; label: string; keyed: boolean }
export interface ProxyVerse { book_name: string; chapter: number; verse: number; text: string }

// ── In-memory caches ──────────────────────────────────────────────────────────

const _translationCache = new Map<string, ProxyTranslation[]>()
const _labelCache = new Map<string, string>()

// ── Translation list ──────────────────────────────────────────────────────────

export async function fetchBibleTranslations(apiKey: string | null): Promise<ProxyTranslation[]> {
  if (!apiKey) {
    return FREE_TRANSLATIONS.map(t => ({ ...t, keyed: false }))
  }
  if (_translationCache.has(apiKey)) return _translationCache.get(apiKey)!

  const res = await fetch(`${API_BIBLE_BASE}/bibles?language=eng`, {
    headers: { 'api-key': apiKey },
  })
  if (!res.ok) throw new Error(`API.Bible translations error ${res.status}`)

  const json = await res.json() as { data?: { id: string; abbreviation: string }[] }
  const items = json.data ?? []

  const seen = new Set<string>()
  const keyed: ProxyTranslation[] = []
  for (const item of items) {
    const abbrev = (item.abbreviation ?? '').toUpperCase().replace(/\s/g, '')
    if (!abbrev || seen.has(abbrev)) continue
    seen.add(abbrev)
    keyed.push({ id: item.id, label: abbrev, keyed: true })
    _labelCache.set(item.id, abbrev)
  }

  const keyedLabels = new Set(keyed.map(t => t.label))
  const free = FREE_TRANSLATIONS
    .filter(t => !keyedLabels.has(t.label))
    .map(t => ({ ...t, keyed: false }))

  const all = [...keyed, ...free]
  all.sort((a, b) => {
    const ai = COMMON_ABBREVS.indexOf(a.label)
    const bi = COMMON_ABBREVS.indexOf(b.label)
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1
    if (bi !== -1) return 1
    return a.label.localeCompare(b.label)
  })

  _translationCache.set(apiKey, all)
  return all
}

// ── Reference parsing ─────────────────────────────────────────────────────────

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
  'song of solomon': 'SNG', 'song of songs': 'SNG', song: 'SNG', sng: 'SNG', sos: 'SNG', ss: 'SNG',
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

interface ParsedRef { osisPassageId: string; bookName: string; chapter: number }

function parseReference(ref: string): ParsedRef | null {
  const trimmed = ref.trim()
  const withVerse = trimmed.match(/^((?:\d\s*)?[A-Za-z][A-Za-z ]*?)\s+(\d+):(\d+)(?:\s*[-–]\s*(\d+))?$/)
  if (withVerse) {
    const [, bookRaw, chStr, startStr, endStr] = withVerse
    const osisBook = BOOK_OSIS[bookRaw.trim().toLowerCase().replace(/\s+/g, ' ')]
    if (!osisBook) return null
    const chapter = parseInt(chStr, 10)
    const start = parseInt(startStr, 10)
    const end = endStr ? parseInt(endStr, 10) : start
    const osisStart = `${osisBook}.${chapter}.${start}`
    const osisEnd = `${osisBook}.${chapter}.${end}`
    return { osisPassageId: start === end ? osisStart : `${osisStart}-${osisEnd}`, bookName: bookRaw.trim(), chapter }
  }
  const chapterOnly = trimmed.match(/^((?:\d\s*)?[A-Za-z][A-Za-z ]*?)\s+(\d+)$/)
  if (chapterOnly) {
    const [, bookRaw, chStr] = chapterOnly
    const osisBook = BOOK_OSIS[bookRaw.trim().toLowerCase().replace(/\s+/g, ' ')]
    if (!osisBook) return null
    return { osisPassageId: `${osisBook}.${parseInt(chStr, 10)}`, bookName: bookRaw.trim(), chapter: parseInt(chStr, 10) }
  }
  return null
}

// ── API.Bible JSON verse extraction ───────────────────────────────────────────

interface ApiBibleItem {
  type: 'tag' | 'text'
  attrs?: Record<string, string>
  items?: ApiBibleItem[]
  text?: string
}

function extractVerses(content: ApiBibleItem[], bookName: string, chapter: number): ProxyVerse[] {
  const verseMap = new Map<number, string[]>()
  function walk(item: ApiBibleItem): void {
    if (item.type === 'text') {
      const verseId = item.attrs?.verseId
      if (verseId) {
        const parts = verseId.split('.')
        const vn = parseInt(parts[parts.length - 1], 10)
        if (!isNaN(vn) && vn > 0) {
          const t = (item.text ?? '').trim()
          if (t) { if (!verseMap.has(vn)) verseMap.set(vn, []); verseMap.get(vn)!.push(t) }
        }
      }
      return
    }
    if (item.items) for (const child of item.items) walk(child)
  }
  for (const item of content) walk(item)
  return [...verseMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([vn, texts]) => ({ book_name: bookName, chapter, verse: vn, text: texts.join(' ').replace(/\s+/g, ' ').trim() }))
    .filter(v => v.text.length > 0)
}

// ── Unified search ────────────────────────────────────────────────────────────

export async function searchPassage(
  ref: string,
  translationId: string,
  apiKey: string | null,
): Promise<{ verses: ProxyVerse[]; reference: string; translationLabel: string }> {
  if (FREE_TRANSLATION_IDS.has(translationId)) {
    const url = `https://bible-api.com/${encodeURIComponent(ref)}?translation=${encodeURIComponent(translationId)}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`bible-api.com error ${res.status}`)
    const data = await res.json() as { error?: string; verses?: ProxyVerse[]; reference?: string }
    if (data.error) throw new Error(data.error)
    if (!data.verses?.length) throw new Error('No verses found')
    return { verses: data.verses, reference: data.reference ?? ref, translationLabel: translationId.toUpperCase() }
  }

  if (!apiKey) throw new Error('API key required for this translation')

  const parsed = parseReference(ref)
  if (!parsed) throw new Error(`Could not parse reference: "${ref}"`)

  const url = `${API_BIBLE_BASE}/bibles/${encodeURIComponent(translationId)}/passages/${encodeURIComponent(parsed.osisPassageId)}?content-type=json&include-verse-numbers=false&include-titles=false&include-chapter-numbers=false`
  const res = await fetch(url, { headers: { 'api-key': apiKey } })
  if (res.status === 404) throw new Error(`Passage not found: ${ref}`)
  if (!res.ok) throw new Error(`API.Bible error ${res.status}`)

  const json = await res.json() as { data?: { reference?: string; content?: ApiBibleItem[] } }
  const data = json.data
  if (!data) throw new Error('No data in response')

  const content: ApiBibleItem[] = Array.isArray(data.content) ? data.content : []
  const verses = extractVerses(content, parsed.bookName, parsed.chapter)
  if (!verses.length) throw new Error('No verses found')

  const label = _labelCache.get(translationId) ?? translationId.slice(0, 8).toUpperCase()
  return { verses, reference: data.reference ?? ref, translationLabel: label }
}
