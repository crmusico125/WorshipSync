import { useState, useCallback } from "react"
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

  const handleGoLive = useCallback(() => {
    window.worshipsync.window.openProjection()
    onProjectionChange(true)
    setMode("live")
  }, [onProjectionChange])

  const handleExitLive = useCallback(() => {
    // PresenterDashboard.endShow() already calls closeProjection() and
    // onProjectionChange(false) before this is invoked.
    setMode("prepare")
  }, [])

  if (mode === "live") {
    return (
      <PresenterDashboard
        projectionOpen={projectionOpen}
        onProjectionChange={onProjectionChange}
        onExitLive={handleExitLive}
      />
    )
  }

  return (
    <BuilderScreen
      serviceId={serviceId}
      onGoLive={handleGoLive}
    />
  )
}
