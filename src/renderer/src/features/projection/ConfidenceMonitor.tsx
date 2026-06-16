import { useState, useEffect, useLayoutEffect, useRef } from "react";
import type { SlidePayload } from "../../../../../shared/types";
import AnnouncementCardsView from "../../components/AnnouncementCardsView";

export default function ConfidenceMonitor() {
  const [slide, setSlide] = useState<SlidePayload | null>(null);
  const [isBlank, setIsBlank] = useState(false);
  const [time, setTime] = useState("");
  const [countdownDisplay, setCountdownDisplay] = useState("");
  const [showCountdown, setShowCountdown] = useState(false);
  const [firstUp, setFirstUp] = useState<{ title: string; artist?: string; sectionLabel: string } | null>(null);

  // nextLines tracked separately so they stay correct even when blank fires
  const [nextLines, setNextLines] = useState<string[]>([]);
  const [nextSectionLabel, setNextSectionLabel] = useState("");
  const [nextItemType, setNextItemType] = useState<string | undefined>(undefined);

  type MediaState = { isPlaying: boolean; currentTime: number; duration: number; lineupItemId: number };
  const [audioState, setAudioState] = useState<MediaState | null>(null);
  const [videoState, setVideoState] = useState<MediaState | null>(null);
  // Local interpolated time so progress bar moves smoothly between 1-second IPC ticks
  const [localMediaTime, setLocalMediaTime] = useState(0);
  const mediaBaseRef = useRef<{ wallMs: number; mediaTime: number } | null>(null);
  const mediaTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const contentAreaRef = useRef<HTMLDivElement>(null);
  const scriptureTextRef = useRef<HTMLDivElement>(null);
  const lyricsTextRef = useRef<HTMLDivElement>(null);
  const nextPreviewRef = useRef<HTMLDivElement>(null);

  const hasNext = nextLines.length > 0;

  // Clock
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      let h = now.getHours();
      const m = now.getMinutes();
      const ampm = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      setTime(`${h}:${m < 10 ? "0" : ""}${m} ${ampm}`);
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, []);

  // For scripture: binary-search the largest font (px) where all text fits in the content area.
  // Runs after DOM paint so measurements are exact — no aspect-ratio guessing needed.
  useLayoutEffect(() => {
    const wrapper = contentAreaRef.current;
    const text = scriptureTextRef.current;
    if (!wrapper || !text || slide?.itemType !== "scripture") return;

    const availableH = wrapper.clientHeight - 60; // 32px top + 28px bottom padding
    let lo = 18, hi = 100, best = 18;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      text.style.fontSize = `${mid}px`;
      if (text.scrollHeight <= availableH) { best = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    text.style.fontSize = `${best}px`;
  }, [slide]);

  // For song lyrics: same binary-search approach so text always fits regardless of monitor size/resolution.
  useLayoutEffect(() => {
    const wrapper = contentAreaRef.current;
    const text = lyricsTextRef.current;
    if (!wrapper || !text || !slide || slide.itemType === "scripture" || slide.itemType === "media") return;

    const availableH = wrapper.clientHeight - 60; // 32px top + 28px bottom padding
    let lo = 20, hi = 160, best = 20;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      text.style.fontSize = `${mid}px`;
      if (text.scrollHeight <= availableH) { best = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    text.style.fontSize = `${best}px`;
  }, [slide, hasNext]);

  useEffect(() => {
    window.worshipsync.confidence.ready();
  }, []);

  useEffect(() => {
    const cleanSlide = window.worshipsync.slide.onShow((payload) => {
      setSlide(payload);
      setIsBlank(false);
      setShowCountdown(false);
      setFirstUp(null);
      setNextLines(payload.nextLines ?? []);
      setNextSectionLabel(payload.nextSectionLabel ?? "");
      setNextItemType(payload.nextItemType);
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    });

    // Also update next lines from stageNext events (main process sends these alongside slide:show)
    const cleanStageNext =
      window.worshipsync.slide.onStageNext?.((data) => {
        setNextLines(data.nextLines ?? []);
        setNextSectionLabel(data.nextSectionLabel ?? "");
        setNextItemType(data.nextItemType);
      }) ?? (() => {});

    const cleanBlank = window.worshipsync.slide.onBlank((b) => {
      setIsBlank(b);
      // nextLines intentionally not cleared — stays from last slide so "Next" remains accurate
    });

    const cleanAudioState = window.worshipsync.slide.onAudioState?.((state) => {
      setAudioState(state);
    }) ?? (() => {});

    const cleanVideoState = window.worshipsync.slide.onVideoState?.((state) => {
      setVideoState(state);
    }) ?? (() => {});

    const cleanCountdown = window.worshipsync.slide.onCountdown((data) => {
      if (!data.running) {
        setShowCountdown(false);
        setFirstUp(null);
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
        return;
      }
      setShowCountdown(true);
      setIsBlank(false);
      if (data.firstUp) setFirstUp(data.firstUp);
      const target = new Date(data.targetTime).getTime();
      const pad = (n: number) => String(n).padStart(2, "0");
      const tick = () => {
        const diff = target - Date.now();
        if (diff <= 0) {
          setCountdownDisplay("Starting!");
          return;
        }
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setCountdownDisplay(
          d > 0
            ? `${pad(d)}d ${pad(h)}:${pad(m)}:${pad(s)}`
            : `${pad(h)}:${pad(m)}:${pad(s)}`,
        );
      };
      tick();
      if (countdownRef.current) clearInterval(countdownRef.current);
      countdownRef.current = setInterval(tick, 500);
    });

    return () => {
      cleanSlide();
      cleanStageNext();
      cleanBlank();
      cleanCountdown();
      cleanAudioState();
      cleanVideoState();
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const activeMediaState =
    (videoState?.lineupItemId === slide?.lineupItemId ? videoState : null) ??
    (audioState?.lineupItemId === slide?.lineupItemId ? audioState : null);

  // Smooth local time interpolation.
  // On each IPC heartbeat (every ~1s) we only snap if the received time differs from our
  // locally-interpolated time by more than 1.5s (a real seek). Otherwise we keep the
  // existing base so the display never jumps backward.
  useEffect(() => {
    if (mediaTickRef.current) { clearInterval(mediaTickRef.current); mediaTickRef.current = null; }
    if (!activeMediaState) { mediaBaseRef.current = null; return; }

    const received = activeMediaState.currentTime;

    if (activeMediaState.isPlaying) {
      if (mediaBaseRef.current !== null) {
        const interpolated = mediaBaseRef.current.mediaTime + (Date.now() - mediaBaseRef.current.wallMs) / 1000;
        // Only snap on big discrepancy (seek); ignore normal heartbeat drift
        if (Math.abs(received - interpolated) > 1.5) {
          mediaBaseRef.current = { wallMs: Date.now(), mediaTime: received };
          setLocalMediaTime(received);
        }
        // else: keep existing base — timer below continues smoothly
      } else {
        mediaBaseRef.current = { wallMs: Date.now(), mediaTime: received };
        setLocalMediaTime(received);
      }
      mediaTickRef.current = setInterval(() => {
        if (!mediaBaseRef.current) return;
        setLocalMediaTime(mediaBaseRef.current.mediaTime + (Date.now() - mediaBaseRef.current.wallMs) / 1000);
      }, 250);
      return () => { if (mediaTickRef.current) { clearInterval(mediaTickRef.current); mediaTickRef.current = null; } };
    } else {
      // Paused / stopped — always show the exact received time
      mediaBaseRef.current = { wallMs: Date.now(), mediaTime: received };
      setLocalMediaTime(received);
    }
  }, [audioState, videoState, slide?.lineupItemId]);

  const hasLyrics = slide && slide.lines.filter(Boolean).length > 0;

  // "Song Title — Section" means next is a new song
  const isNextNewSong   = nextSectionLabel.includes("—");
  const nextSongTitle   = isNextNewSong ? (nextSectionLabel.split("—")[0] ?? "").trim() : "";
  const nextSongSection = isNextNewSong ? (nextSectionLabel.split("—")[1] ?? "").trim() : nextSectionLabel;

  // On the blank slide, if the next item is a different song, use the otherwise-empty
  // center area for an enlarged "Next" preview instead of the small bottom strip.
  const showEnlargedNext = isBlank && hasNext && isNextNewSong && slide?.itemType !== "scripture" && nextItemType === "song";

  // Binary-search the largest font size for the enlarged "Next Song" preview where it
  // still fits the content area — keeps it readable from across the room on small
  // monitors and lets it fill large ones, without ever clipping. Re-runs on resize so
  // it adapts if the confidence monitor window is moved or resized.
  useLayoutEffect(() => {
    const wrapper = contentAreaRef.current;
    const text = nextPreviewRef.current;
    if (!wrapper || !text || !showEnlargedNext) return;

    const fit = () => {
      const availableH = wrapper.clientHeight - 80;
      const availableW = wrapper.clientWidth - 120;
      let lo = 16, hi = 300, best = 16;
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        text.style.fontSize = `${mid}px`;
        if (text.scrollHeight <= availableH && text.scrollWidth <= availableW) { best = mid; lo = mid + 1; }
        else hi = mid - 1;
      }
      text.style.fontSize = `${best}px`;
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [showEnlargedNext, nextSongTitle, nextSongSection, nextLines]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#080810",
        color: "#fff",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      {/* Top bar — always visible */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "14px 32px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.03)",
          flexShrink: 0,
          position: "relative",
          zIndex: 30,
        }}
      >
        <div
          style={{
            flex: 1,
            fontSize: "clamp(18px,2vw,28px)",
            fontWeight: 600,
            color: "#c4c4cc",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {slide
            ? `${slide.songTitle}${slide.artist ? `  —  ${slide.artist}` : ""}`
            : "WorshipSync — Confidence Monitor"}
        </div>
        {slide && slide.sectionLabel && slide.itemType !== "scripture" && !showCountdown && !isBlank && (
          <div
            style={{
              fontSize: "clamp(13px,1.4vw,18px)",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              background: "rgba(139,92,246,0.18)",
              color: "#a78bfa",
              border: "1px solid rgba(139,92,246,0.3)",
              borderRadius: 6,
              padding: "5px 14px",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {slide.sectionLabel}
          </div>
        )}
        <div
          style={{
            fontSize: "clamp(26px,3vw,40px)",
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            color: "#fff",
            letterSpacing: "-0.01em",
            flexShrink: 0,
            minWidth: 100,
            textAlign: "right",
          }}
        >
          {time}
        </div>
      </div>

      {/* Main content area */}
      <div
        ref={contentAreaRef}
        style={{
          flex: 1,
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 48px 28px",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {/* Blank overlay */}
        {isBlank && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "#000",
              zIndex: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {showEnlargedNext ? (
              <div ref={nextPreviewRef} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3em", textAlign: "center", maxWidth: "100%", padding: "0 48px", overflowWrap: "break-word", wordBreak: "break-word" }}>
                <span style={{ fontSize: "0.3em", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(251,191,36,0.6)" }}>
                  Next Song
                </span>
                <span style={{ fontSize: "1em", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.15, color: "#fbbf24" }}>
                  {nextSongTitle}
                </span>
                {nextSongSection && (
                  <span style={{ fontSize: "0.225em", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(251,191,36,0.5)", border: "1px solid rgba(251,191,36,0.3)", background: "rgba(251,191,36,0.08)", borderRadius: "0.3em", padding: "0.3em 0.8em" }}>
                    {nextSongSection}
                  </span>
                )}
                <div style={{ fontSize: "0.5em", fontWeight: 500, lineHeight: 1.4, color: "rgba(255,255,255,0.45)" }}>
                  {nextLines.slice(0, 2).map((line, i) => <div key={i}>{line || " "}</div>)}
                </div>
              </div>
            ) : (
              <div
                style={{
                  fontSize: "clamp(20px,2.5vw,32px)",
                  fontWeight: 800,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.15)",
                }}
              >
                Screen Blank
              </div>
            )}
          </div>
        )}

        {showCountdown ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", maxWidth: 900, gap: 36 }}>
            {/* Segmented timer */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
              {(() => {
                const hasDays = countdownDisplay.includes("d");
                const timePart = hasDays ? (countdownDisplay.split(" ")[1] ?? "00:00:00") : countdownDisplay;
                const dayVal = hasDays ? (countdownDisplay.split(" ")[0] ?? "").replace("d", "") : null;
                const segs = timePart.split(":");
                const showHours = hasDays || Number(segs[0]) > 0;
                const segments: { v: string; label: string }[] = [];
                if (dayVal && Number(dayVal) > 0) segments.push({ v: dayVal, label: "Days" });
                if (showHours) segments.push({ v: segs[0] ?? "00", label: "Hours" });
                segments.push({ v: segs[segs.length - 2] ?? "00", label: "Minutes" });
                segments.push({ v: segs[segs.length - 1] ?? "00", label: "Seconds" });
                return (
                  <div style={{ display: "flex", alignItems: "flex-start" }}>
                    {segments.map((seg, i) => (
                      <div key={seg.label} style={{ display: "flex", alignItems: "flex-start" }}>
                        {i > 0 && (
                          <span style={{ fontSize: "clamp(60px,11vw,140px)", fontWeight: 700, color: "rgba(255,255,255,0.25)", lineHeight: 1, padding: "0 6px", marginTop: 4 }}>:</span>
                        )}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                          <span style={{ fontSize: "clamp(80px,15vw,180px)", fontWeight: 700, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", fontFamily: "'SF Mono','Fira Code',monospace", color: "#ffffff", lineHeight: 1 }}>
                            {seg.v}
                          </span>
                          <span style={{ fontSize: "clamp(14px,1.8vw,22px)", fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginTop: 10 }}>
                            {seg.label}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
              <div style={{ fontSize: "clamp(16px,1.8vw,24px)", fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)" }}>
                Until Service Starts
              </div>
            </div>

            {/* First Up card */}
            {firstUp && (
              <div style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "24px 40px" }}>
                <div style={{ fontSize: "clamp(13px,1.4vw,18px)", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 12 }}>
                  Up First
                </div>
                <div style={{ fontSize: "clamp(28px,4vw,56px)", fontWeight: 700, color: "#ffffff", letterSpacing: "-0.01em", lineHeight: 1.2 }}>
                  {firstUp.title}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 12, flexWrap: "wrap" }}>
                  {firstUp.artist && (
                    <span style={{ fontSize: "clamp(18px,2vw,26px)", color: "rgba(255,255,255,0.4)" }}>{firstUp.artist}</span>
                  )}
                  {firstUp.sectionLabel && (
                    <>
                      {firstUp.artist && <span style={{ fontSize: "clamp(14px,1.5vw,20px)", color: "rgba(255,255,255,0.18)" }}>·</span>}
                      <span style={{ fontSize: "clamp(13px,1.4vw,18px)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", background: "rgba(139,92,246,0.18)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 6, padding: "5px 14px" }}>
                        {firstUp.sectionLabel}
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : slide?.itemType === "media" ? (
          (() => {
            const matchedAudio = audioState?.lineupItemId === slide.lineupItemId ? audioState : null;
            const matchedVideo = videoState?.lineupItemId === slide.lineupItemId ? videoState : null;
            const mediaState = matchedAudio ?? matchedVideo;
            const isAudio = !!matchedAudio;
            const isVideo = !!matchedVideo;
            const icon = isAudio ? "♪" : isVideo ? "▶" : "🖼";
            const isPlaying = mediaState?.isPlaying ?? false;
            const currentTime = localMediaTime;
            const duration = Math.floor(mediaState?.duration ?? 0);
            const pct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
            const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
            const remaining = duration > 0 ? duration - currentTime : 0;
            return (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "clamp(16px,3vh,40px)", width: "100%", maxWidth: 960 }}>
                {/* Icon */}
                <div style={{ fontSize: "clamp(56px,10vw,100px)", opacity: 0.5, lineHeight: 1 }}>{icon}</div>
                {/* Title */}
                <div style={{ fontSize: "clamp(28px,4.5vw,64px)", fontWeight: 700, textAlign: "center", letterSpacing: "-0.02em", lineHeight: 1.2, color: "#ffffff" }}>
                  {slide.songTitle}
                </div>
                {/* Progress — audio and video only */}
                {(isAudio || isVideo) && (
                  <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "clamp(20px,2.8vw,40px)", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>
                      <span>{fmt(currentTime)}</span>
                      <span style={{ color: remaining < 30 ? "#f87171" : "rgba(255,255,255,0.5)" }}>
                        -{fmt(remaining)}
                      </span>
                    </div>
                    <div style={{ width: "100%", height: 14, background: "rgba(255,255,255,0.1)", borderRadius: 7, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: isPlaying ? "#7c3aed" : "rgba(255,255,255,0.25)", borderRadius: 7, transition: "width 0.8s linear" }} />
                    </div>
                    {duration > 0 && (
                      <div style={{ textAlign: "right", fontSize: "clamp(14px,1.6vw,22px)", color: "rgba(255,255,255,0.25)", fontVariantNumeric: "tabular-nums" }}>
                        {fmt(duration)}
                      </div>
                    )}
                  </div>
                )}
                {/* Status */}
                <div style={{ fontSize: "clamp(18px,2.2vw,30px)", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: isPlaying ? "#a78bfa" : "rgba(255,255,255,0.22)" }}>
                  {isAudio || isVideo ? (isPlaying ? "▶  Playing" : "⏸  Paused") : "On Screen"}
                </div>
              </div>
            );
          })()
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", maxWidth: 1200 }}>
            {/* Current slide lines — visible when not blank */}
            {hasLyrics ? (
              (() => {
                const lines = slide!.lines.filter(Boolean);
                const isScripture = slide!.itemType === "scripture";

                if (slide!.itemType === "announcement" && slide!.announcementCards?.length) {
                  return (
                    <div style={{ width: "100%", padding: "0 8px" }}>
                      <AnnouncementCardsView
                        title={slide!.songTitle}
                        cards={slide!.announcementCards}
                        textColor="#ffffff"
                        accentColor={slide!.theme?.accentColor ?? '#fbbf24'}
                        fontSize={slide!.theme?.fontSize ?? 48}
                        compact
                      />
                    </div>
                  );
                }

                if (isScripture) {
                  // Font size is set by the useLayoutEffect binary search above.
                  // We render at 40px initially; the layout effect corrects it before paint.
                  return (
                    <div
                      ref={scriptureTextRef}
                      style={{
                        fontSize: 40,
                        fontWeight: 600,
                        lineHeight: 1.5,
                        textAlign: "left",
                        color: "#ffffff",
                        letterSpacing: "-0.01em",
                        wordBreak: "break-word",
                        overflowWrap: "break-word",
                        width: "100%",
                      }}
                    >
                      {lines.map((line, i) => <div key={i}>{line}</div>)}
                    </div>
                  );
                }

                // Song lyrics: font size is set by the useLayoutEffect binary search above.
                // We render at 40px initially; the layout effect corrects it before paint.
                return (
                  <div ref={lyricsTextRef} style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.3, textAlign: "center", color: "#ffffff", letterSpacing: "-0.015em", wordBreak: "break-word", overflowWrap: "break-word", width: "100%" }}>
                    {slide!.lines.map((line, i) => <div key={i}>{line || " "}</div>)}
                  </div>
                );
              })()
            ) : !isBlank ? (
              <div style={{ textAlign: "center", color: "rgba(255,255,255,0.18)" }}>
                <div style={{ fontSize: "clamp(22px,2.5vw,34px)", fontWeight: 600, marginBottom: 12 }}>Waiting for slides…</div>
                <div style={{ fontSize: "clamp(16px,1.8vw,24px)", lineHeight: 1.6 }}>The confidence monitor will update<br />when the operator advances slides.</div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Next lines — hidden for scripture (single continuous content) and whenever the next
          item is a different song, since the enlarged center preview covers that case once
          the blank slide is reached */}
      {hasNext && !showCountdown && !isNextNewSong && slide?.itemType !== "scripture" && (
        <div style={{
          flexShrink: 0, position: "relative", zIndex: 30,
          borderTop: "2px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.025)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 28px 4px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "clamp(13px,1.4vw,18px)", fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)" }}>
              Next
            </span>
            {nextSongSection && (
              <span style={{ fontSize: "clamp(13px,1.4vw,18px)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(139,92,246,0.7)" }}>
                {nextSongSection}
              </span>
            )}
          </div>
          <div style={{ padding: "0 28px 18px", fontSize: "clamp(22px,3.5vw,48px)", fontWeight: 500, lineHeight: 1.4, textAlign: "center", color: "rgba(255,255,255,0.45)" }}>
            {nextLines.slice(0, 2).map((line, i) => <div key={i}>{line || " "}</div>)}
          </div>
        </div>
      )}

      {/* Bottom bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 28px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
          position: "relative",
          zIndex: 30,
        }}
      >
        <div
          style={{
            fontSize: "clamp(16px,1.8vw,22px)",
            color: "rgba(255,255,255,0.25)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {slide && slide.slideIndex != null && slide.totalSlides != null
            ? `${slide.slideIndex + 1} / ${slide.totalSlides}`
            : ""}
        </div>
        <div
          style={{
            fontSize: "clamp(13px,1.4vw,18px)",
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.15)",
          }}
        >
          Confidence Monitor
        </div>
      </div>
    </div>
  );
}
