import React from "react";
import type { AppScreen } from "../../../../../shared/types";
import {
  Calendar,
  Palette,
  BarChart3,
  Settings,
  Church,
  Music,
  Image,
  LayoutDashboard,
  Radio,
  BookOpen,
} from "lucide-react";

interface Props {
  current: AppScreen;
  onChange: (screen: AppScreen) => void;
  projectionOpen: boolean;
  isLive?: boolean;
  onReturnToLive?: () => void;
}

interface NavItem {
  id: AppScreen;
  icon: typeof Calendar;
  label: string;
}

const NAV_TOP: NavItem[] = [
  { id: "overview", icon: LayoutDashboard, label: "Overview"  },
  { id: "planner",  icon: Calendar,        label: "Planner"   },
  { id: "bible",    icon: BookOpen,        label: "Bible"     },
  { id: "library",  icon: Music,           label: "Library"   },
  { id: "media",    icon: Image,           label: "Media"     },
  { id: "themes",   icon: Palette,         label: "Themes"    },
  { id: "analytics",icon: BarChart3,       label: "Analytics" },
];

// Nav items that are non-essential during a live show
const LIVE_DIMMED: AppScreen[] = ["library", "media", "themes", "analytics"]

export default function Sidebar({ current, onChange, projectionOpen: _projectionOpen, isLive, onReturnToLive }: Props) {
  return (
    <nav className="w-[88px] shrink-0 bg-sidebar border-r border-border flex flex-col items-center">
      {/* Draggable logo area */}
      <div
        className="w-full flex items-center justify-center pt-12 pb-5 text-sidebar-foreground"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <Church className={`h-7 w-7 transition-opacity ${isLive ? "opacity-30" : ""}`} />
      </div>

      {/* Nav icons */}
      <div
        className="flex flex-col gap-1 items-center px-2 w-full"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        {NAV_TOP.map((item) => {
          const isActive = current === item.id;
          const isDimmed = isLive && LIVE_DIMMED.includes(item.id);
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              title={item.label}
              className={`w-full flex flex-col items-center justify-center gap-1.5 py-2.5 px-1 rounded-xl transition-all ${
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : isDimmed
                    ? "text-muted-foreground/30 hover:text-muted-foreground hover:bg-sidebar-primary/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-sidebar-primary/50"
              }`}
            >
              <Icon className="h-6 w-6" />
              <span className="text-[11px] font-semibold leading-none">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Bottom: Live indicator + Settings */}
      <div className="mt-auto pb-4 flex flex-col items-center gap-1 w-full px-2" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        {isLive && (
          <button
            onClick={onReturnToLive}
            title="Return to Stage"
            className="w-full flex flex-col items-center justify-center gap-1.5 py-2.5 px-1 rounded-xl bg-red-600 hover:bg-red-500 text-white transition-all relative"
          >
            <Radio className="h-6 w-6" />
            <span className="text-[11px] font-semibold leading-none">Live</span>
            <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-white animate-pulse" />
          </button>
        )}
        <button
          onClick={() => onChange("settings")}
          title="Settings"
          className={`w-full flex flex-col items-center justify-center gap-1.5 py-2.5 px-1 rounded-xl transition-all ${
            current === "settings"
              ? "bg-sidebar-primary text-sidebar-primary-foreground"
              : isLive
                ? "text-muted-foreground/30 hover:text-muted-foreground hover:bg-sidebar-primary/30"
                : "text-muted-foreground hover:text-foreground hover:bg-sidebar-primary/50"
          }`}
        >
          <Settings className="h-6 w-6" />
          <span className="text-[11px] font-semibold leading-none">Settings</span>
        </button>
      </div>
    </nav>
  );
}
