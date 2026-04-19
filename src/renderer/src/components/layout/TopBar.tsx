import React from "react"
import type { AppScreen } from "../../../../../shared/types"

const TITLES: Record<AppScreen, string> = {
  planner: "Planner",
  builder: "Service Builder",
  library: "Song Library",
  media: "Media Library",
  themes: "Themes",
  analytics: "Analytics",
  settings: "Settings",
  presenter: "Presenter",
}

interface Props {
  screen: AppScreen
  projectionOpen: boolean
}

export default function TopBar({ screen, projectionOpen }: Props) {
  return (
    <div
      className="h-12 border-b border-border flex items-center px-4 gap-2.5 shrink-0 bg-card"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <span className="text-sm font-semibold text-foreground">
        {TITLES[screen]}
      </span>

      <div className="flex-1" />

      {/* Projection status chip */}
      <div
        className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-medium ${
          projectionOpen
            ? "bg-green-500/10 text-green-400"
            : "bg-muted text-muted-foreground"
        }`}
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <div
          className={`h-1.5 w-1.5 rounded-full ${
            projectionOpen ? "bg-green-500 animate-pulse" : "bg-muted-foreground/40"
          }`}
        />
        {projectionOpen ? "Projector connected" : "Projector off"}
      </div>
    </div>
  )
}
