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

function BackgroundLayer({
  backgroundPath,
  opacity,
}: {
  backgroundPath: string | null | undefined;
  opacity: number;
}) {
  if (!backgroundPath) return null;

  if (backgroundPath.startsWith("color:")) {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: backgroundPath.replace("color:", ""),
          opacity,
          transition: "opacity 0.15s ease",
        }}
      />
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage: `url("file://${encodeURI(backgroundPath)}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        opacity,
        transition: "opacity 0.15s ease",
      }}
    />
  );
}

export default function ProjectionWindow() {
  const [slide, setSlide] = useState<SlidePayload | null>(null);
  const [prevSlide, setPrevSlide] = useState<SlidePayload | null>(null);
  const [displayState, setDisplayState] = useState<DisplayState>("blank");
  const [textVisible, setTextVisible] = useState(true);
  const [bgTransition, setBgTransition] = useState(false);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    window.worshipsync.projection.ready();

    const cleanSlide = window.worshipsync.slide.onShow((payload) => {
      const bgChanged = payload.backgroundPath !== slide?.backgroundPath;

      if (bgChanged) {
        // Keep prev background visible, fade in new one
        setPrevSlide(slide);
        setBgTransition(true);
      }

      // Fade text out briefly
      setTextVisible(false);

      if (transitionTimer.current) clearTimeout(transitionTimer.current);
      transitionTimer.current = setTimeout(() => {
        setSlide(payload);
        setDisplayState("slide");
        setTextVisible(true);
        if (bgChanged) {
          setTimeout(() => {
            setPrevSlide(null);
            setBgTransition(false);
          }, 300);
        }
      }, 80);
    });

    const cleanBlank = window.worshipsync.slide.onBlank((isBlank) => {
      setDisplayState(isBlank ? "blank" : "slide");
    });

    const cleanLogo = window.worshipsync.slide.onLogo((show) => {
      setDisplayState(show ? "logo" : "slide");
    });

    return () => {
      cleanSlide();
      cleanBlank();
      cleanLogo();
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
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
      {/* Previous background — fades out during song change */}
      {bgTransition && prevSlide?.backgroundPath && (
        <BackgroundLayer
          backgroundPath={prevSlide.backgroundPath}
          opacity={bgTransition ? 0 : 1}
        />
      )}

      {/* Current background — always mounted, no flicker */}
      {displayState === "slide" && (
        <BackgroundLayer backgroundPath={slide?.backgroundPath} opacity={1} />
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
            opacity: textVisible ? 1 : 0,
            transition: "opacity 0.08s ease",
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

      {/* Slide counter */}
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
