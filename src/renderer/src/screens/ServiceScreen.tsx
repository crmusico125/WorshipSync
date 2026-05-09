import { useCallback, useState, useEffect } from "react"
import BuilderScreen from "./BuilderScreen"
import PresenterDashboard from "./PresenterDashboard"

export type ServiceMode = "prepare" | "live"

interface Props {
  serviceId: number
  initialMode: ServiceMode
  projectionOpen: boolean
  onProjectionChange: (open: boolean) => void
}

export default function ServiceScreen({
  serviceId,
  initialMode,
  projectionOpen,
  onProjectionChange,
}: Props) {
  const [mode, setMode] = useState<ServiceMode>(initialMode)

  // When projection opens, switch to present view automatically
  useEffect(() => {
    if (projectionOpen) setMode("live")
  }, [projectionOpen])

  // Intentionally NOT reverting to "prepare" when projection closes —
  // the operator stays in whatever view they were in and can freely switch.

  const handleGoLive = useCallback(() => {
    window.worshipsync.window.openProjection()
    onProjectionChange(true)
    setMode("live")
  }, [onProjectionChange])

  const handleSwitchToBuilder = useCallback(() => {
    setMode("prepare")
  }, [])

  const handleReturnToPresenter = useCallback(() => {
    setMode("live")
  }, [])

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── Live mode switcher — only shown when projection is open AND in builder ── */}
      {projectionOpen && mode === "prepare" && (
        <div className="shrink-0 h-8 flex items-center gap-3 px-3 border-b border-red-900/40 bg-red-950/30">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] font-bold text-red-400 tracking-widest">SHOW IS LIVE</span>
          </span>
          <div className="flex-1" />
          <button
            onClick={handleReturnToPresenter}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-red-300 hover:text-white bg-red-600/30 hover:bg-red-600/60 px-2.5 py-0.5 rounded transition-colors"
          >
            Return to Stage →
          </button>
        </div>
      )}

      <div className="flex-1 overflow-hidden min-h-0">
        {mode === "live" ? (
          <PresenterDashboard
            projectionOpen={projectionOpen}
            onProjectionChange={onProjectionChange}
            onExitLive={() => setMode("prepare")}
            onSwitchToBuilder={handleSwitchToBuilder}
          />
        ) : (
          <BuilderScreen
            serviceId={serviceId}
            onGoLive={handleGoLive}
            projectionOpen={projectionOpen}
            onReturnToPresenter={projectionOpen ? handleReturnToPresenter : undefined}
          />
        )}
      </div>
    </div>
  )
}
