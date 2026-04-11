import { useState, useEffect, useRef } from "react";
import type { SlidePayload } from "../../../../shared/types";

type DisplayState = "slide" | "blank" | "logo";

const DEFAULT_THEME = {
  fontFamily: "Montserrat, sans-serif",
  fontSize: 48,
  fontWeight: "600",
  textColor: "#ffffff",
  textAlign: "center" as const,
  textPosition: "middle" as const,
  overlayOpacity: 45,
  textShadowOpacity: 40,
  maxLinesPerSlide: 2,
};

export default function ProjectionWindow() {
  const [slide, setSlide] = useState<SlidePayload | null>(null);
  const [displayState, setDisplayState] = useState<DisplayState>("blank");
  const cleanupRef = useRef<(() => void)[]>([]);

  useEffect(() => {
    window.worshipsync.projection.ready();

    const cleanSlide = window.worshipsync.slide.onShow((payload) => {
      setSlide(payload);
      setDisplayState("slide");
    });

    const cleanBlank = window.worshipsync.slide.onBlank((isBlank) => {
      setDisplayState(isBlank ? "blank" : "slide");
    });

    const cleanLogo = window.worshipsync.slide.onLogo((show) => {
      setDisplayState(show ? "logo" : "slide");
    });

    cleanupRef.current = [cleanSlide, cleanBlank, cleanLogo];

    return () => {
      cleanupRef.current.forEach((fn) => fn());
    };
  }, []);

  const theme = slide?.theme ?? DEFAULT_THEME;
  const overlayAlpha = (theme.overlayOpacity / 100).toFixed(2);
  const shadowOpacity = (theme.textShadowOpacity / 100).toFixed(2);

  const alignItems =
    theme.textPosition === "top"
      ? "flex-start"
      : theme.textPosition === "bottom"
        ? "flex-end"
        : "center";

  const backgroundPath = slide?.backgroundPath;

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#000",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background */}
      {displayState === "slide" && backgroundPath && (
        backgroundPath.startsWith("color:") ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 1,
              background: backgroundPath.replace("color:", ""),
            }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 1,
              backgroundImage: `url("file://${encodeURI(backgroundPath)}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        )
      )}

      {/* Dark overlay */}
      {displayState === "slide" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 2,
            background: `rgba(0,0,0,${overlayAlpha})`,
          }}
        />
      )}

      {/* Blank screen */}
      {displayState === "blank" && (
        <div style={{ position: "absolute", inset: 0, zIndex: 10, background: "#000" }} />
      )}

      {/* Logo screen */}
      {displayState === "logo" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 10,
            background: "#000",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontFamily: "Montserrat, sans-serif",
              fontSize: 64,
              fontWeight: 700,
              color: "rgba(255,255,255,0.15)",
              letterSpacing: "-0.03em",
            }}
          >
            WorshipSync
          </div>
        </div>
      )}

      {/* Lyrics */}
      {displayState === "slide" && slide && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 3,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: alignItems,
            padding: "8% 10%",
          }}
        >
          <div
            style={{
              fontFamily: theme.fontFamily,
              fontSize: theme.fontSize,
              fontWeight: theme.fontWeight,
              color: theme.textColor,
              textAlign: theme.textAlign,
              lineHeight: 1.4,
              textShadow: `0 2px 12px rgba(0,0,0,${shadowOpacity}), 0 1px 3px rgba(0,0,0,${shadowOpacity})`,
              width: "100%",
            }}
          >
            {slide.lines.map((line, i) => (
              <div key={i}>{line || "\u00A0"}</div>
            ))}
          </div>
        </div>
      )}

      {/* Slide counter */}
      {displayState === "slide" && slide && (
        <div
          style={{
            position: "absolute",
            bottom: 16,
            right: 20,
            zIndex: 3,
            fontSize: 11,
            color: "rgba(255,255,255,0.15)",
            fontFamily: "monospace",
          }}
        >
          {slide.slideIndex + 1}/{slide.totalSlides}
        </div>
      )}
    </div>
  );
}
