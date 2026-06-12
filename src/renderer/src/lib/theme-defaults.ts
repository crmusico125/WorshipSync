// Shared slide-theme types and defaults used by Library, Builder, Presenter, and Themes screens.

export interface ThemeStyle {
  fontFamily: string
  fontSize: number
  fontWeight: string
  textColor: string
  textAlign: "left" | "center" | "right"
  textPosition: "top" | "middle" | "bottom"
  overlayOpacity: number
  textShadowOpacity: number
  maxLinesPerSlide: number
}

export const DEFAULT_THEME: ThemeStyle = {
  fontFamily: "Montserrat, sans-serif",
  fontSize: 48,
  fontWeight: "600",
  textColor: "#ffffff",
  textAlign: "center",
  textPosition: "middle",
  overlayOpacity: 45,
  textShadowOpacity: 40,
  maxLinesPerSlide: 2,
}

export interface ThemeSettings extends ThemeStyle {
  backgroundPath: string | null
}

export const DEFAULT_SETTINGS: ThemeSettings = {
  ...DEFAULT_THEME,
  backgroundPath: null,
}

export const FONT_OPTIONS = [
  "Montserrat, sans-serif",
  "Inter, sans-serif",
  "Georgia, serif",
  "Arial, sans-serif",
  "Times New Roman, serif",
  "Trebuchet MS, sans-serif",
  "Palatino, serif",
]

export const TEXT_COLORS = [
  { hex: "#ffffff", label: "White" },
  { hex: "#f5f0e0", label: "Cream" },
  { hex: "#f5c842", label: "Gold" },
  { hex: "#60a5fa", label: "Blue" },
  { hex: "#f472b6", label: "Pink" },
  { hex: "#4ade80", label: "Green" },
]
