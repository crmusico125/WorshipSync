import React, { useState, useEffect, useRef, useCallback } from "react";
import type { SlidePayload } from "../../../../../shared/types";
import AnnouncementCardsView from "../../components/AnnouncementCardsView";
import { toFileUrl } from "../../lib/utils";

type DisplayState = "slide" | "blank" | "logo" | "countdown";

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
  backgroundScaleMode: "cover" as const,
  accentColor: undefined as string | undefined,
  scriptureRefPosition: undefined as 'top' | 'bottom-right' | 'bottom-center' | 'hidden' | undefined,
};

// ── Background layer ──────────────────────────────────────────────────────────
// Background image/video/color + dark overlay, as one self-positioned,
// independently animatable layer — separated from ContentLayer below so a
// same-background slide change (see "sameBgTransition" in the main component)
// can render the background once, statically, and crossfade only the text.
// For a full crossfade between two different backgrounds, BackgroundLayer and
// ContentLayer are simply rendered as a pair with matching zIndex/animation,
// achieving the same "whole frame fades together" look as before without
// needing one shared wrapper element.

interface BackgroundLayerProps {
  slide: SlidePayload;
  zIndex: number;
  animationName?: string;
  transitionMs?: number;
  videoRef?: React.RefObject<HTMLVideoElement>;
  onVideoProgress?: (force?: boolean, isEndedEvent?: boolean) => void;
}

function BackgroundLayer({ slide, zIndex, animationName, transitionMs = 0, videoRef, onVideoProgress }: BackgroundLayerProps) {
  const theme = slide.theme ?? DEFAULT_THEME;
  const overlayAlpha = (theme.overlayOpacity / 100).toFixed(2);
  const scaleMode = theme.backgroundScaleMode ?? "cover";
  const imgBgSize = scaleMode === "stretch" ? "100% 100%" : scaleMode;
  const videoObjectFit = scaleMode === "stretch" ? "fill" : (scaleMode as "cover" | "contain");

  const bp = slide.backgroundPath;
  const isVideo = !!bp && /\.(mp4|webm|mov)$/i.test(bp);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex,
        animation: animationName && transitionMs > 0
          ? `${animationName} ${transitionMs}ms ease forwards`
          : "none",
      }}
    >
      {/* ── Background ── */}
      {bp && (
        bp.startsWith("color:") ? (
          <div style={{ position: "absolute", inset: 0, zIndex: 1, background: bp.replace("color:", "") }} />
        ) : isVideo ? (
          <video
            ref={videoRef}
            key={bp}
            playsInline
            preload="auto"
            style={{
              position: "absolute", inset: 0, zIndex: 1,
              width: "100%", height: "100%",
              objectFit: videoObjectFit,
              background: "#000",
            }}
            src={`${toFileUrl(bp)}`}
            onTimeUpdate={() => onVideoProgress?.()}
            onPlay={() => onVideoProgress?.(true)}
            onPause={() => onVideoProgress?.(true)}
            onSeeked={() => onVideoProgress?.(true)}
            onEnded={() => onVideoProgress?.(true, true)}
          />
        ) : (
          <div
            style={{
              position: "absolute", inset: 0, zIndex: 1,
              backgroundColor: "#000",
              backgroundImage: `url("${toFileUrl(bp)}")`,
              backgroundSize: imgBgSize,
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
          />
        )
      )}

      {/* ── Dark overlay (images only — video has its own blend) ── */}
      {!isVideo && (
        <div
          style={{
            position: "absolute", inset: 0, zIndex: 2,
            background: `rgba(0,0,0,${overlayAlpha})`,
          }}
        />
      )}
    </div>
  );
}

// ── Content layer ──────────────────────────────────────────────────────────────
// Text/scripture/announcement content only, no background — its own
// self-positioned, independently animatable layer (see BackgroundLayer above).

interface ContentLayerProps {
  slide: SlidePayload;
  zIndex: number;
  animationName?: string;
  transitionMs?: number;
  // Only the active (incoming) frame gets the measurement refs
  containerRef?: React.RefObject<HTMLDivElement>;
  textRef?: React.RefObject<HTMLDivElement>;
  scaledFontSize: number;
  showCounter?: boolean;
}

function ContentLayer({
  slide,
  zIndex,
  animationName,
  transitionMs = 0,
  containerRef,
  textRef,
  scaledFontSize,
  showCounter,
}: ContentLayerProps) {
  const theme = slide.theme ?? DEFAULT_THEME;
  const shadowOpacity = (theme.textShadowOpacity / 100).toFixed(2);
  const alignItems =
    theme.textPosition === "top" ? "flex-start" :
    theme.textPosition === "bottom" ? "flex-end" : "center";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex,
        animation: animationName && transitionMs > 0
          ? `${animationName} ${transitionMs}ms ease forwards`
          : "none",
      }}
    >
      {/* ── Content ── */}
      {slide.itemType === "scripture" ? (
        // Scripture: verse text centred + reference badge bottom-right
        <div
          style={{
            position: "absolute", inset: 0, zIndex: 3,
            display: "flex", flexDirection: "column",
            padding: "6% 10%",
          }}
        >
          <div
            ref={containerRef}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              minHeight: 0,
            }}
          >
            <div
              ref={textRef}
              style={{
                fontFamily: theme.fontFamily,
                fontSize: scaledFontSize,
                fontWeight: theme.fontWeight,
                color: theme.textColor,
                textAlign: theme.textAlign ?? "center",
                lineHeight: 1.4,
                textShadow: `0 2px 12px rgba(0,0,0,${shadowOpacity}), 0 1px 3px rgba(0,0,0,${shadowOpacity})`,
                width: "100%",
              }}
            >
              {slide.lines.map((line, i) => (
                <div key={i}>{line || " "}</div>
              ))}
            </div>
          </div>

          {/* Reference badge — position controlled by theme.scriptureRefPosition */}
          {(() => {
            const refPos = theme.scriptureRefPosition ?? "bottom-right";
            if (slide.sectionType === "blank" || refPos === "hidden") return null;
            const label = slide.sectionLabel ?? "";
            const lastSpace = label.lastIndexOf(" ");
            const hasTranslation = lastSpace > 0 && /^[A-Z0-9]{2,10}$/.test(label.slice(lastSpace + 1));
            const refText = (hasTranslation ? label.slice(0, lastSpace) : label)
              .toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
            const translation = hasTranslation ? label.slice(lastSpace + 1) : null;
            const badgeFontSize = Math.max(32, Math.round(scaledFontSize * 0.58));
            const badgeGap = Math.max(8, Math.round(scaledFontSize * 0.12));
            const inner = (
              <>
                <span style={{
                  fontFamily: theme.fontFamily, fontSize: badgeFontSize,
                  fontWeight: "600", color: "rgba(255,255,255,0.9)",
                  letterSpacing: "0.03em", textShadow: "0 1px 6px rgba(0,0,0,0.6)",
                }}>
                  {refText}
                </span>
                {translation && (
                  <>
                    <span style={{ fontSize: badgeFontSize * 0.8, color: "rgba(255,255,255,0.35)", fontWeight: "300" }}>{"·"}</span>
                    <span style={{
                      fontFamily: theme.fontFamily, fontSize: badgeFontSize * 0.82,
                      fontWeight: "700", letterSpacing: "0.08em",
                      color: "rgba(255,255,255,0.55)", textShadow: "0 1px 4px rgba(0,0,0,0.5)",
                    }}>
                      {translation}
                    </span>
                  </>
                )}
              </>
            );
            const topStyle: React.CSSProperties = { position: "absolute", top: "6%", left: "10%", zIndex: 4, display: "flex", alignItems: "center", gap: badgeGap };
            const bottomStyle: React.CSSProperties = {
              position: "absolute", bottom: "4%", zIndex: 4,
              display: "flex", alignItems: "center", gap: badgeGap,
              ...(refPos === "bottom-center" ? { left: "50%", transform: "translateX(-50%)" } : { right: "6%" }),
            };
            return <div style={refPos === "top" ? topStyle : bottomStyle}>{inner}</div>;
          })()}
        </div>

      ) : slide.itemType === "announcement" && slide.announcementCards?.length ? (
        // Announcement event cards
        <div
          style={{
            position: "absolute", inset: 0, zIndex: 3,
            display: "flex", flexDirection: "column",
            justifyContent: "center",
            padding: "5% 8%",
          }}
        >
          <AnnouncementCardsView
            title={slide.songTitle}
            cards={slide.announcementCards}
            textColor={theme.textColor}
            accentColor={theme.accentColor ?? "#fbbf24"}
            fontSize={theme.fontSize}
          />
        </div>

      ) : (
        // Standard lyrics
        <div
          ref={containerRef}
          style={{
            position: "absolute", inset: 0, zIndex: 3,
            display: "flex", flexDirection: "column",
            alignItems: "center",
            justifyContent: alignItems,
            padding: "8% 10%",
          }}
        >
          <div
            ref={textRef}
            style={{
              fontFamily: theme.fontFamily,
              fontSize: scaledFontSize,
              fontWeight: theme.fontWeight,
              color: theme.textColor,
              textAlign: theme.textAlign,
              lineHeight: 1.4,
              textShadow: `0 2px 12px rgba(0,0,0,${shadowOpacity}), 0 1px 3px rgba(0,0,0,${shadowOpacity})`,
              width: "100%",
            }}
          >
            {slide.lines.map((line, i) => (
              <div key={i}>{line || " "}</div>
            ))}
          </div>
        </div>
      )}

      {/* Slide counter (active frame only) */}
      {showCounter && (
        <div
          style={{
            position: "absolute", bottom: 16, right: 20, zIndex: 4,
            fontSize: 11,
            color: "rgba(255,255,255,0.15)",
            fontFamily: "monospace",
          }}
        >
          {(slide.slideIndex ?? 0) + 1}/{slide.totalSlides ?? 0}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProjectionWindow() {
  // Double-buffer: currentFrame is the incoming slide, prevFrame is the outgoing one.
  // prevFrame stays rendered (fading out) while currentFrame fades in; then prevFrame
  // is cleared once the transition completes.
  const [currentFrame, setCurrentFrame] = useState<SlidePayload | null>(null);
  const [prevFrame,    setPrevFrame]    = useState<SlidePayload | null>(null);
  // True when prevFrame and currentFrame share the exact same backgroundPath — the
  // background is rendered once, statically, and only the text content crossfades,
  // instead of the whole frame (background included) fading as one unit. Avoids a
  // double-dark-overlay flicker that's otherwise visible even though the background
  // never actually changes (e.g. moving between slides of the same song).
  const [sameBgTransition, setSameBgTransition] = useState(false);
  const [displayState, setDisplayState] = useState<DisplayState>("blank");
  const [slideTransitionMs, setSlideTransitionMs] = useState(300);
  const [frameKey, setFrameKey] = useState(0);

  const [countdownTarget, setCountdownTarget] = useState<string>("");
  const [countdownParts, setCountdownParts] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [churchName, setChurchName] = useState("");
  const [scaledFontSize, setScaledFontSize] = useState<number>(48);

  // Refs used inside IPC callbacks — always hold the latest values without stale closures
  const currentFrameRef   = useRef<SlidePayload | null>(null);
  const transitionMsRef   = useRef(300);
  const prevClearTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanupRef        = useRef<(() => void)[]>([]);
  const countdownRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const lyricsTextRef     = useRef<HTMLDivElement>(null);
  const videoRef          = useRef<HTMLVideoElement>(null);
  const pendingVideoAction = useRef<"play" | "pause" | "stop" | null>(null);
  const pendingSeekTime   = useRef<number | null>(null);
  const lastVideoReportRef = useRef(0);

  // Expose play function globally so the main process can invoke it via
  // executeJavaScript(userGesture=true), creating a trusted activation that
  // bypasses Chromium's autoplay audio restriction.
  useEffect(() => {
    ;(window as any).__projVideoPlay = () => videoRef.current?.play().catch(() => {})
    return () => { ;(window as any).__projVideoPlay = null }
  }, [])

  // Keep refs in sync with state so IPC handlers always read the latest values
  useEffect(() => { transitionMsRef.current = slideTransitionMs; }, [slideTransitionMs]);

  useEffect(() => {
    window.worshipsync.projection.ready();
    window.worshipsync.appState.get().then((s) => {
      if (s.churchName) setChurchName(s.churchName);
      if (s.slideTransitionMs !== undefined) setSlideTransitionMs(s.slideTransitionMs);
    }).catch(() => {});

    // Inject keyframes for crossfade
    const styleEl = document.createElement("style");
    styleEl.textContent = [
      `@keyframes wsSlideIn  { from { opacity: 0 } to { opacity: 1 } }`,
      `@keyframes wsSlideOut { from { opacity: 1 } to { opacity: 0 } }`,
    ].join("\n");
    document.head.appendChild(styleEl);

    const cleanSlide = window.worshipsync.slide.onShow((payload) => {
      const outgoing = currentFrameRef.current;
      currentFrameRef.current = payload;

      const ms = transitionMsRef.current;
      // Skip crossfade when video is involved — two <video> elements on screen simultaneously
      // causes audio glitches and seek desync.
      const outgoingIsVideo = !!outgoing?.backgroundPath && /\.(mp4|webm|mov)$/i.test(outgoing.backgroundPath);
      const incomingIsVideo = !!payload.backgroundPath  && /\.(mp4|webm|mov)$/i.test(payload.backgroundPath ?? "");

      if (outgoing && ms > 0 && !outgoingIsVideo && !incomingIsVideo) {
        setPrevFrame(outgoing);
        setSameBgTransition(outgoing.backgroundPath === payload.backgroundPath);
        if (prevClearTimer.current) clearTimeout(prevClearTimer.current);
        prevClearTimer.current = setTimeout(() => setPrevFrame(null), ms + 50);
      } else {
        // No crossfade — clear any lingering prevFrame immediately
        if (prevClearTimer.current) { clearTimeout(prevClearTimer.current); prevClearTimer.current = null; }
        setPrevFrame(null);
        setSameBgTransition(false);
      }

      setCurrentFrame(payload);
      setDisplayState("slide");
      setFrameKey((k) => k + 1);
    });

    const cleanBlank = window.worshipsync.slide.onBlank((isBlank) => {
      setDisplayState((prev) =>
        isBlank ? "blank" : prev === "countdown" ? "countdown" : "slide",
      );
    });

    const cleanLogo = window.worshipsync.slide.onLogo((show) => {
      setDisplayState((prev) =>
        show ? "logo" : prev === "countdown" ? "countdown" : "slide",
      );
    });

    const cleanCountdown = window.worshipsync.slide.onCountdown((data) => {
      if (data.running && data.targetTime) {
        setCountdownTarget(data.targetTime);
        setDisplayState("countdown");
      } else {
        setDisplayState("blank");
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
      }
    });

    const cleanVideoSeek = window.worshipsync.slide.onVideoSeek((time) => {
      const vid = videoRef.current;
      if (!vid) { pendingSeekTime.current = time; return; }
      const wasPlaying = !vid.paused;
      vid.currentTime = time;
      if (wasPlaying) vid.play().catch(() => {});
    });

    const cleanVideoLoop = window.worshipsync.slide.onVideoLoop((loop) => {
      if (videoRef.current) videoRef.current.loop = loop;
    });

    const cleanVideo = window.worshipsync.slide.onVideoControl((action) => {
      const vid = videoRef.current;
      if (!vid) { pendingVideoAction.current = action; return; }
      pendingVideoAction.current = null;
      if (action === "play") vid.play().catch(() => {});
      else if (action === "pause") vid.pause();
      else if (action === "stop") { vid.pause(); vid.currentTime = 0; setDisplayState("blank"); }
    });

    cleanupRef.current = [cleanSlide, cleanBlank, cleanLogo, cleanCountdown, cleanVideo, cleanVideoSeek, cleanVideoLoop];

    return () => {
      cleanupRef.current.forEach((fn) => fn());
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (prevClearTimer.current) clearTimeout(prevClearTimer.current);
      styleEl.remove();
    };
  }, []);

  // Countdown timer tick
  useEffect(() => {
    if (displayState !== "countdown" || !countdownTarget) return;

    const tick = () => {
      const target = new Date(countdownTarget).getTime();
      const now = Date.now();
      const diff = target - now;
      if (diff <= 0) { setCountdownParts({ days: 0, hours: 0, minutes: 0, seconds: 0 }); return; }
      setCountdownParts({
        days:    Math.floor(diff / 86400000),
        hours:   Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };

    tick();
    countdownRef.current = setInterval(tick, 1000);
    return () => { if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; } };
  }, [displayState, countdownTarget]);

  // Recover audio pipeline when system audio device changes
  useEffect(() => {
    const handleDeviceChange = () => {
      const vid = videoRef.current;
      if (!vid) return;
      const wasPlaying = !vid.paused;
      const currentTime = vid.currentTime;
      vid.load();
      vid.addEventListener("loadedmetadata", () => {
        vid.currentTime = currentTime;
        if (wasPlaying) vid.play().catch(() => {});
      }, { once: true });
    };
    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    return () => navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
  }, []);

  // Apply pending video action / seek once the video element mounts
  useEffect(() => {
    if (
      displayState === "slide" &&
      currentFrame?.backgroundPath &&
      (pendingVideoAction.current !== null || pendingSeekTime.current !== null)
    ) {
      if (/\.(mp4|webm|mov)$/i.test(currentFrame.backgroundPath)) {
        requestAnimationFrame(() => {
          const vid = videoRef.current;
          if (vid && pendingSeekTime.current !== null) {
            const seekTo = pendingSeekTime.current;
            pendingSeekTime.current = null;
            const wasPlaying = !vid.paused;
            vid.currentTime = seekTo;
            if (wasPlaying) vid.play().catch(() => {});
          }
          if (vid && pendingVideoAction.current) {
            const action = pendingVideoAction.current;
            pendingVideoAction.current = null;
            if (action === "play") {
              // If the video isn't ready yet, wait for canplay rather than
              // silently swallowing a rejected play() promise. That first play()
              // must go through the main process so it carries a trusted user
              // gesture — otherwise Chromium starts playback muted instead of
              // rejecting it outright, which is why slow-loading videos on
              // Windows can end up silent even though the picture plays fine.
              if (vid.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
                window.worshipsync.slide.requestVideoPlayGesture();
              } else {
                vid.addEventListener("canplay", () => window.worshipsync.slide.requestVideoPlayGesture(), { once: true });
              }
            } else if (action === "pause") vid.pause();
            else if (action === "stop") { vid.pause(); vid.currentTime = 0; setDisplayState("blank"); }
          }
        });
      }
    }
  }, [displayState, currentFrame]);

  const reportVideoProgress = useCallback((force = false, isEndedEvent = false) => {
    const vid = videoRef.current;
    if (!vid) return;
    const now = Date.now();
    if (!force && now - lastVideoReportRef.current < 900) return;
    lastVideoReportRef.current = now;
    window.worshipsync.slide.reportVideoProgress?.({
      currentTime: vid.currentTime,
      duration: Number.isFinite(vid.duration) ? vid.duration : 0,
      isPlaying: !vid.paused,
      // Only the actual "ended" DOM event reports this — by the time "pause" fires
      // for a naturally-finished video, vid.ended is already true too, and reporting
      // it from both events double-fires the presenter's ended handling (which was
      // skipping the next item in a collection: end of item 1 advanced twice before
      // item 2 was ever shown).
      ended: isEndedEvent,
      lineupItemId: currentFrame?.lineupItemId,
    });
    // When the video finishes naturally (not looping), go blank immediately
    // rather than waiting for the presenter's videoControl("stop") IPC which can race.
    if (vid.ended) setDisplayState("blank");
  }, [currentFrame?.lineupItemId]);

  const theme = currentFrame?.theme ?? DEFAULT_THEME;

  // Auto-scale font size to fit the container (runs on the active/incoming frame's refs)
  const fitText = useCallback(() => {
    const container = lyricsContainerRef.current;
    const text = lyricsTextRef.current;
    if (!container || !text) return;
    const maxW = container.clientWidth;
    const maxH = container.clientHeight;
    let size = theme.fontSize;
    const minSize = Math.max(20, theme.fontSize * 0.45);
    text.style.fontSize = `${size}px`;
    while (size > minSize && (text.scrollHeight > maxH || text.scrollWidth > maxW)) {
      size -= 2;
      text.style.fontSize = `${size}px`;
    }
    setScaledFontSize(size);
  }, [theme.fontSize]);

  useEffect(() => {
    if (displayState === "slide" && currentFrame) requestAnimationFrame(fitText);
  }, [currentFrame, displayState, fitText]);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#000", position: "relative", overflow: "hidden" }}>

      {/* ── Slide frames (double-buffer crossfade) ── */}
      {displayState === "slide" && currentFrame && (
        sameBgTransition && prevFrame ? (
          <>
            {/* Same background as the outgoing slide — render it once, statically (no
                fade), and crossfade only the text. Never a video here: video always
                skips crossfading entirely (see onShow above), so sameBgTransition is
                only ever set for static image/color backgrounds. */}
            <BackgroundLayer
              key={currentFrame.backgroundPath ?? "none"}
              slide={currentFrame}
              zIndex={1}
            />
            <ContentLayer
              key={`prev-content-${frameKey}`}
              slide={prevFrame}
              zIndex={2}
              animationName="wsSlideOut"
              transitionMs={slideTransitionMs}
              scaledFontSize={scaledFontSize}
            />
            <ContentLayer
              key={`curr-content-${frameKey}`}
              slide={currentFrame}
              zIndex={3}
              animationName="wsSlideIn"
              transitionMs={slideTransitionMs}
              containerRef={lyricsContainerRef}
              textRef={lyricsTextRef}
              scaledFontSize={scaledFontSize}
              showCounter
            />
          </>
        ) : (
          <>
            {/* Outgoing frame — stays visible and fades out while incoming fades in.
                Background + content fade together (same animation/timing) to reproduce
                a whole-frame crossfade without a shared wrapper element. */}
            {prevFrame && (
              <>
                <BackgroundLayer
                  key={`prev-bg-${frameKey}`}
                  slide={prevFrame}
                  zIndex={1}
                  animationName="wsSlideOut"
                  transitionMs={slideTransitionMs}
                />
                <ContentLayer
                  key={`prev-content-${frameKey}`}
                  slide={prevFrame}
                  zIndex={2}
                  animationName="wsSlideOut"
                  transitionMs={slideTransitionMs}
                  scaledFontSize={scaledFontSize}
                />
              </>
            )}

            {/* Incoming frame — fades in over the outgoing frame.
                 For video backgrounds, key on the file path instead of frameKey so the
                 <video> element is not remounted on every lyric slide change — that was
                 restarting the video from the beginning each time. */}
            <BackgroundLayer
              key={currentFrame.backgroundPath && /\.(mp4|webm|mov)$/i.test(currentFrame.backgroundPath)
                ? `curr-video-${currentFrame.backgroundPath}`
                : `curr-bg-${frameKey}`}
              slide={currentFrame}
              zIndex={3}
              animationName={prevFrame ? "wsSlideIn" : undefined}
              transitionMs={slideTransitionMs}
              videoRef={videoRef}
              onVideoProgress={reportVideoProgress}
            />
            <ContentLayer
              key={`curr-content-${frameKey}`}
              slide={currentFrame}
              zIndex={4}
              animationName={prevFrame ? "wsSlideIn" : undefined}
              transitionMs={slideTransitionMs}
              containerRef={lyricsContainerRef}
              textRef={lyricsTextRef}
              scaledFontSize={scaledFontSize}
              showCounter
            />
          </>
        )
      )}

      {/* ── Blank screen ── */}
      {displayState === "blank" && (
        <div style={{ position: "absolute", inset: 0, zIndex: 10, background: "#000" }} />
      )}

      {/* ── Logo screen ── */}
      {displayState === "logo" && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 10,
          background: "#000",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            fontFamily: "Montserrat, sans-serif",
            fontSize: 64, fontWeight: 700,
            color: "rgba(255,255,255,0.15)",
            letterSpacing: "-0.03em",
          }}>
            WorshipSync
          </div>
        </div>
      )}

      {/* ── Countdown ── */}
      {displayState === "countdown" && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 10,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.52) 0%, rgba(0,0,0,0.62) 100%), linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            fontFamily: "Montserrat, sans-serif",
            fontSize: "7vh", fontWeight: 800, color: "#ffffff",
            letterSpacing: "0.38em", textTransform: "uppercase", marginBottom: "2vh",
          }}>
            Welcome
          </div>

          <div style={{
            fontFamily: "Montserrat, sans-serif",
            fontSize: "3vh", fontWeight: 400, color: "rgba(255,255,255,0.82)",
            letterSpacing: "0.01em", marginBottom: "4vh",
          }}>
            Our Sunday Service will begin in
          </div>

          {(() => {
            const { days, hours, minutes, seconds } = countdownParts;
            const showHours = days > 0 || hours > 0;
            const pad = (n: number) => String(n).padStart(2, "0");

            const Segment = ({ value, label }: { value: number; label: string }) => (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{
                  fontFamily: "Montserrat, sans-serif",
                  fontSize: "22vh", fontWeight: 800, color: "#ffffff",
                  letterSpacing: "0.03em", lineHeight: 1,
                  textShadow: "0 4px 40px rgba(0,0,0,0.5)",
                }}>
                  {pad(value)}
                </div>
                <div style={{
                  fontFamily: "Montserrat, sans-serif",
                  fontSize: "2vh", fontWeight: 600,
                  color: "rgba(255,255,255,0.5)",
                  letterSpacing: "0.25em", textTransform: "uppercase", marginTop: "1vh",
                }}>
                  {label}
                </div>
              </div>
            );

            const Colon = () => (
              <div style={{
                fontFamily: "Montserrat, sans-serif",
                fontSize: "16vh", fontWeight: 800,
                color: "rgba(255,255,255,0.4)",
                lineHeight: 1, paddingBottom: "4.5vh",
                alignSelf: "flex-end", margin: "0 1vh",
              }}>:</div>
            );

            return (
              <div style={{ display: "flex", alignItems: "flex-end", marginBottom: "4vh" }}>
                {days > 0 && <><Segment value={days} label="Days" /><Colon /></>}
                {showHours && <><Segment value={hours} label="Hours" /><Colon /></>}
                <Segment value={minutes} label="Minutes" />
                <Colon />
                <Segment value={seconds} label="Seconds" />
              </div>
            );
          })()}

          <div style={{
            fontFamily: "Montserrat, sans-serif",
            fontSize: "2.5vh", fontWeight: 400,
            color: "rgba(255,255,255,0.65)", letterSpacing: "0.02em",
          }}>
            Please find your seats and silence your devices
          </div>

          {churchName && (
            <div style={{ position: "absolute", bottom: "4vh", display: "flex", alignItems: "center", gap: "0.9vh" }}>
              <svg width="1.65vh" height="1.65vh" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <div style={{
                fontFamily: "Montserrat, sans-serif",
                fontSize: "1.6vh", fontWeight: 600,
                color: "rgba(255,255,255,0.35)",
                letterSpacing: "0.2em", textTransform: "uppercase",
              }}>
                {churchName}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
