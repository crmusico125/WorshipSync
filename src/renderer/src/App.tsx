import React, { useEffect, useState, useCallback, useRef } from "react"
import type { AppScreen } from "../../../shared/types"
import type { ServiceMode } from "./screens/ServiceScreen"
import Sidebar from "./components/layout/Sidebar"
import PlannerScreen from "./screens/PlannerScreen"
import ServiceScreen from "./screens/ServiceScreen"
import LibraryScreen from "./screens/LibraryScreen"
import MediaLibraryScreen from "./screens/MediaLibraryScreen"
import ThemesScreen from "./screens/ThemesScreen"
import AnalyticsScreen from "./screens/AnalyticsScreen"
import SettingsScreen from "./screens/SettingsScreen"
import OverviewScreen from "./screens/OverviewScreen"
import { useServiceStore } from "./store/useServiceStore"

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>("overview")
  const [projectionOpen, setProjectionOpen] = useState(false)
  const [activeServiceId, setActiveServiceId] = useState<number | null>(null)
  const [serviceLaunchMode, setServiceLaunchMode] = useState<ServiceMode>("prepare")
  const [liveRuntime, setLiveRuntime] = useState("00:00:00")
  const liveStartRef = useRef<number>(0)
  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Reset projectionOpen when the user closes the projection window from the OS
  useEffect(() => {
    const cleanup = window.worshipsync.window.onProjectionClosed(() => {
      setProjectionOpen(false)
    })
    return cleanup
  }, [])

  // Track live runtime globally so any screen can show the live bar
  useEffect(() => {
    if (projectionOpen) {
      liveStartRef.current = Date.now()
      setLiveRuntime("00:00:00")
      liveIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - liveStartRef.current) / 1000)
        const h = Math.floor(elapsed / 3600)
        const m = Math.floor((elapsed % 3600) / 60)
        const s = elapsed % 60
        const pad = (n: number) => String(n).padStart(2, "0")
        setLiveRuntime(`${pad(h)}:${pad(m)}:${pad(s)}`)
      }, 1000)
    } else {
      if (liveIntervalRef.current) clearInterval(liveIntervalRef.current)
      setLiveRuntime("00:00:00")
    }
    return () => { if (liveIntervalRef.current) clearInterval(liveIntervalRef.current) }
  }, [projectionOpen])

  // On startup, restore last active service
  useEffect(() => {
    window.worshipsync.appState.get()
      .then(async (state: Record<string, any>) => {
        if (state.lastServiceId) {
          const { loadServices, selectService } = useServiceStore.getState()
          await loadServices()
          const lastService = useServiceStore.getState().services.find(
            (s) => s.id === state.lastServiceId,
          )
          if (lastService) {
            await selectService(lastService)
            setActiveServiceId(lastService.id)
          }
        }
      })
      .catch(() => {})
  }, [])

  // Open a service in prepare (builder) mode
  const handleOpenService = useCallback(async (serviceId: number) => {
    setServiceLaunchMode("prepare")
    // Select the service in the store BEFORE updating activeServiceId so
    // BuilderScreen always renders with the correct selectedService already set.
    const { loadServices, selectService, services } = useServiceStore.getState()
    let list = services
    if (list.length === 0) {
      await loadServices()
      list = useServiceStore.getState().services
    }
    const svc = list.find((s) => s.id === serviceId)
    if (svc) await selectService(svc)
    setActiveServiceId(serviceId)
    setCurrentScreen("service")
    window.worshipsync.appState.set({ lastServiceId: serviceId })
  }, [])

  // Open a service directly in live (presenter) mode
  const handleOpenServiceLive = useCallback(async (serviceId: number) => {
    setActiveServiceId(serviceId)
    // Pre-select the service so PresenterDashboard never sees a null selectedService
    const { loadServices, selectService, services } = useServiceStore.getState()
    let list = services
    if (list.length === 0) {
      await loadServices()
      list = useServiceStore.getState().services
    }
    const svc = list.find((s) => s.id === serviceId)
    if (svc) await selectService(svc)
    window.worshipsync.window.openProjection()
    setProjectionOpen(true)
    setServiceLaunchMode("live")
    setCurrentScreen("service")
    window.worshipsync.appState.set({ lastServiceId: serviceId })
  }, [])

  return (
    <div className="h-screen flex bg-background text-foreground">
      <Sidebar
        current={currentScreen}
        onChange={setCurrentScreen}
        projectionOpen={projectionOpen}
        isLive={projectionOpen && activeServiceId !== null}
        onReturnToLive={() => setCurrentScreen("service")}
      />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Title bar / persistent live indicator */}
        {projectionOpen && currentScreen !== "service" ? (
          <div
            className="h-8 shrink-0 border-b border-red-900/50 bg-red-950/40 flex items-center px-4 gap-3"
            style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
          >
            <span className="flex items-center gap-1.5 shrink-0" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[11px] font-bold text-red-400 tracking-widest">LIVE</span>
              <span className="text-[11px] text-red-300/60 tabular-nums ml-1">{liveRuntime}</span>
            </span>
            <div className="flex-1" />
            <button
              onClick={() => setCurrentScreen("service")}
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
              className="text-[11px] font-semibold text-red-300 hover:text-white bg-red-600/30 hover:bg-red-600/60 px-2.5 py-0.5 rounded transition-colors"
            >
              Return to Stage →
            </button>
          </div>
        ) : (
          <div
            className="h-8 shrink-0 bg-card border-b border-border flex items-center px-4"
            style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
          >
            <span className="text-[11px] font-medium text-muted-foreground">
              {currentScreen === "service" ? "" : currentScreen.charAt(0).toUpperCase() + currentScreen.slice(1)}
            </span>
          </div>
        )}
        <div className="flex-1 overflow-hidden">
          {currentScreen === "overview" && (
            <OverviewScreen
              onGoLive={handleOpenServiceLive}
              onOpenBuilder={handleOpenService}
              onNavigate={setCurrentScreen}
              projectionOpen={projectionOpen}
              activeServiceId={activeServiceId}
            />
          )}
          {currentScreen === "planner" && (
            <PlannerScreen
              onOpenService={handleOpenService}
              onGoLive={handleOpenServiceLive}
            />
          )}
          {/* ServiceScreen stays mounted once a service is active so mode/state survive navigation */}
          {activeServiceId !== null && (
            <div className={currentScreen === "service" ? "h-full" : "hidden"}>
              <ServiceScreen
                serviceId={activeServiceId}
                initialMode={serviceLaunchMode}
                projectionOpen={projectionOpen}
                onProjectionChange={setProjectionOpen}
              />
            </div>
          )}
          {currentScreen === "library"   && <LibraryScreen />}
          {currentScreen === "media"     && <MediaLibraryScreen />}
          {currentScreen === "themes"    && <ThemesScreen />}
          {currentScreen === "analytics" && <AnalyticsScreen />}
          {currentScreen === "settings"  && <SettingsScreen />}
        </div>
      </div>
    </div>
  )
}
