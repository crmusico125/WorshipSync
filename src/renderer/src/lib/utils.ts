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
