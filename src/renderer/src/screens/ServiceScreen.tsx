import { useCallback } from "react"
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
  projectionOpen,
  onProjectionChange,
}: Props) {
  const handleGoLive = useCallback(() => {
    window.worshipsync.window.openProjection()
    onProjectionChange(true)
  }, [onProjectionChange])

  const handleExitLive = useCallback(() => {
    // PresenterDashboard.endShow() already calls closeProjection() and
    // onProjectionChange(false) before this is invoked.
  }, [])

  if (projectionOpen) {
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
