import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fmtDur(sec: number): string | null {
  if (sec <= 0) return null
  const m = Math.floor(sec / 60); const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Convert a native filesystem path (macOS or Windows) to a valid file:// URL.
 * - Normalizes backslashes to forward slashes for Windows paths.
 * - Adds the extra leading slash needed for Windows drive letters (C:/ → /C:/).
 * - Percent-encodes characters that are illegal in URLs (spaces, #, etc.).
 */
export function toFileUrl(nativePath: string): string {
  const forward = nativePath.replace(/\\/g, '/')
  const withLeadingSlash = forward.startsWith('/') ? forward : '/' + forward
  return 'file://' + encodeURI(withLeadingSlash)
}
