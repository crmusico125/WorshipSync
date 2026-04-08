import { useState, useEffect } from "react";
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
  const [prevSlide, setPrevSlide] = useState<SlidePayload | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    // Signal to main process that projection is ready
    window.WorshipSync.projection.ready();

    // Listen for slide updates from control window
    const cleanSlide = window.WorshipSync.slide.onShow((payload) => {
      setPrevSlide(slide);
      setTransitioning(true);
      setTimeout(() => {
        setSlide(payload);
        setDisplayState("slide");
        setTransitioning(false);
      }, 120);
    });

    const cleanBlank = window.WorshipSync.slide.onBlank((isBlank) => {
      setDisplayState(isBlank ? "blank" : "slide");
    });

    const cleanLogo = window.WorshipSync.slide.onLogo((show) => {
      setDisplayState(show ? "logo" : "slide");
    });

    return () => {
      cleanSlide();
      cleanBlank();
      cleanLogo();
    };
  }, [slide]);

  const theme = slide?.theme ?? DEFAULT_THEME;
  const overlayAlpha = (theme.overlayOpacity / 100).toFixed(2);
  const shadowOpacity = (theme.textShadowOpacity / 100).toFixed(2);

  const textPositionStyle: React.CSSProperties =
    theme.textPosition === "top"
      ? { justifyContent: "flex-start", paddingTop: "10%" }
      : theme.textPosition === "bottom"
        ? { justifyContent: "flex-end", paddingBottom: "10%" }
        : { justifyContent: "center" };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#000",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "stretch",
      }}
    >
      {/* Background image */}
      {slide?.backgroundPath && displayState === "slide" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${slide.backgroundPath})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            transition: "opacity 0.3s ease",
            opacity: transitioning ? 0 : 1,
          }}
        />
      )}

      {/* Dark overlay */}
      {displayState === "slide" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `rgba(0,0,0,${overlayAlpha})`,
          }}
        />
      )}

      {/* Blank screen */}
      {displayState === "blank" && (
        <div style={{ position: "absolute", inset: 0, background: "#000" }} />
      )}

      {/* Logo screen */}
      {displayState === "logo" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
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

      {/* Lyric content */}
      {displayState === "slide" && slide && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            padding: "8% 10%",
            ...textPositionStyle,
            opacity: transitioning ? 0 : 1,
            transition: "opacity 0.12s ease",
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
              maxWidth: "100%",
            }}
          >
            {slide.lines.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>
      )}

      {/* Slide counter — subtle bottom right, visible to operator from a distance */}
      {displayState === "slide" && slide && (
        <div
          style={{
            position: "absolute",
            bottom: 16,
            right: 20,
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
