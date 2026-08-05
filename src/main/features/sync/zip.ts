import AdmZip from 'adm-zip'

export interface ZipFileEntry {
  /** Path inside the zip, e.g. "manifest.json" or "assets/images/foo.jpg". */
  entryName: string
  /** Either raw content or an absolute path to copy from disk. */
  content?: Buffer | string
  sourcePath?: string
}

/** Builds a zip from a flat list of entries and writes it to `outputPath`. */
export function buildZip(entries: ZipFileEntry[], outputPath: string): void {
  const zip = new AdmZip()
  for (const entry of entries) {
    if (entry.sourcePath) {
      const dir = entry.entryName.includes('/') ? entry.entryName.slice(0, entry.entryName.lastIndexOf('/')) : ''
      const name = entry.entryName.includes('/') ? entry.entryName.slice(entry.entryName.lastIndexOf('/') + 1) : entry.entryName
      zip.addLocalFile(entry.sourcePath, dir, name)
    } else if (entry.content != null) {
      zip.addFile(entry.entryName, typeof entry.content === 'string' ? Buffer.from(entry.content, 'utf-8') : entry.content)
    }
  }
  zip.writeZip(outputPath)
}

export function readZipEntryText(zipPath: string, entryName: string): string | null {
  const zip = new AdmZip(zipPath)
  const entry = zip.getEntries().find(e => e.entryName === entryName)
  if (!entry) return null
  return zip.readAsText(entry)
}

export function readZipEntryBuffer(zipPath: string, entryName: string): Buffer | null {
  const zip = new AdmZip(zipPath)
  const entry = zip.getEntries().find(e => e.entryName === entryName)
  if (!entry) return null
  return zip.readFile(entry)
}

export function listZipEntries(zipPath: string): string[] {
  return new AdmZip(zipPath).getEntries().map(e => e.entryName)
}

export function extractZip(zipPath: string, destDir: string): void {
  new AdmZip(zipPath).extractAllTo(destDir, true)
}
