import { useState } from "react";
import type { AppScreen } from "../../../../shared/types";
import Sidebar from "./components/layout/Sidebar";
import TopBar from "./components/layout/TopBar";
import PlannerScreen from "./screens/PlannerScreen";
import BuilderScreen from "./screens/BuilderScreen";
import LibraryScreen from "./screens/LibraryScreen";
import ThemesScreen from "./screens/ThemesScreen";
import AnalyticsScreen from "./screens/AnalyticsScreen";
import LiveScreen from "./screens/LiveScreen";

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>("planner");
  const [projectionOpen, setProjectionOpen] = useState(false);
  const [activeServiceId, setActiveServiceId] = useState<number | null>(null);

  const handleGoLive = () => {
    if (!projectionOpen) {
      window.worshipsync.window.openProjection();
      setProjectionOpen(true);
    }
    setCurrentScreen("live");
  };

  const handleCloseProjection = () => {
    window.worshipsync.window.closeProjection();
    setProjectionOpen(false);
    setCurrentScreen("builder");
  };

  const handleOpenBuilder = (serviceId: number) => {
    setActiveServiceId(serviceId);
    setCurrentScreen("builder");
  };

  return (
    <div className="app-shell">
      <Sidebar
        current={currentScreen}
        onChange={setCurrentScreen}
        projectionOpen={projectionOpen}
        onGoLive={handleGoLive}
      />
      <div className="main-content">
        <TopBar screen={currentScreen} projectionOpen={projectionOpen} />
        <div style={{ flex: 1, overflow: "hidden" }}>
          {currentScreen === "planner" && (
            <PlannerScreen onOpenBuilder={handleOpenBuilder} />
          )}
          {currentScreen === "builder" && (
            <BuilderScreen
              serviceId={activeServiceId}
              onGoLive={handleGoLive}
            />
          )}
          {currentScreen === "library" && <LibraryScreen />}
          {currentScreen === "themes" && <ThemesScreen />}
          {currentScreen === "analytics" && <AnalyticsScreen />}
          {currentScreen === "live" && (
            <LiveScreen
              onClose={handleCloseProjection}
              projectionOpen={projectionOpen}
            />
          )}
        </div>
      </div>
    </div>
  );
}
