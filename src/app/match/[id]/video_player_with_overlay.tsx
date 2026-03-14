"use client";

import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { CornersOut, CornersIn, CaretRight, CaretLeft } from "@phosphor-icons/react";

export interface OverlayShot {
  shotType: string;
  player: string;
  timestamp: number;
}

interface VideoPlayerWithOverlayProps {
  videoUrl: string;
  shots: OverlayShot[];
}

const DISPLAY_DURATION_S = 3;
const ASSUMED_FPS = 30;
const SPEEDS = [0.25, 0.5, 1, 1.5, 2] as const;
const SCRUB_OPTIONS = [
  { label: "Frame", value: 1 / ASSUMED_FPS },
  { label: "1s", value: 1 },
  { label: "5s", value: 5 },
  { label: "10s", value: 10 },
  { label: "30s", value: 30 },
] as const;

const SHOT_LABELS: Record<string, string> = {
  serve: "Serve",
  clear: "Clear",
  smash: "Smash",
  drop: "Drop",
  drive: "Drive",
  lift: "Lift",
  net: "Net",
  block: "Block",
};

function formatVTTTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

function formatTimestamp(seconds: number): string {
  if (!isFinite(seconds)) return "0.0";
  return seconds.toFixed(1);
}

function shotLabel(shot: OverlayShot): string {
  return `${SHOT_LABELS[shot.shotType] ?? shot.shotType} (${shot.player})`;
}

function generateVTT(shots: OverlayShot[]): string {
  const sorted = [...shots].sort((a, b) => a.timestamp - b.timestamp);
  let vtt = "WEBVTT\n\n";
  for (let i = 0; i < sorted.length; i++) {
    const shot = sorted[i];
    const start = formatVTTTime(shot.timestamp);
    const endTs =
      i < sorted.length - 1
        ? Math.min(shot.timestamp + DISPLAY_DURATION_S, sorted[i + 1].timestamp)
        : shot.timestamp + DISPLAY_DURATION_S;
    const end = formatVTTTime(endTs);
    vtt += `${start} --> ${end}\n${shotLabel(shot)}\n\n`;
  }
  return vtt;
}

export function VideoPlayerWithOverlay({
  videoUrl,
  shots,
}: VideoPlayerWithOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLTrackElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  const [activeShot, setActiveShot] = useState<OverlayShot | null>(null);
  const [visible, setVisible] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(2);
  const [scrubIdx, setScrubIdx] = useState(2);
  const [controlsExpanded, setControlsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrubIdxRef = useRef(scrubIdx);
  scrubIdxRef.current = scrubIdx;

  const sortedShots = useRef(
    [...shots].sort((a, b) => a.timestamp - b.timestamp)
  );

  useEffect(() => {
    sortedShots.current = [...shots].sort((a, b) => a.timestamp - b.timestamp);
  }, [shots]);

  const vttUrl = useMemo(() => {
    if (shots.length === 0) return null;
    const blob = new Blob([generateVTT(shots)], { type: "text/vtt" });
    return URL.createObjectURL(blob);
  }, [shots]);

  useEffect(() => {
    return () => {
      if (vttUrl) URL.revokeObjectURL(vttUrl);
    };
  }, [vttUrl]);

  useEffect(() => {
    const track = trackRef.current?.track;
    if (!track) return;
    track.mode = isFullscreen ? "showing" : "hidden";
  }, [isFullscreen]);

  useEffect(() => {
    function handleFsChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", handleFsChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current?.requestFullscreen();
    }
  }, []);

  // Continuous time update via rAF for smooth timestamp display
  const updateTime = useCallback(() => {
    const video = videoRef.current;
    if (video) setCurrentTime(video.currentTime);
    rafRef.current = requestAnimationFrame(updateTime);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(updateTime);
    return () => cancelAnimationFrame(rafRef.current);
  }, [updateTime]);

  // Apply playback rate when speedIdx changes
  useEffect(() => {
    const video = videoRef.current;
    if (video) video.playbackRate = SPEEDS[speedIdx];
  }, [speedIdx]);

  // Keyboard shortcuts: -/+ for speed, left/right for scrub
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          containerRef.current?.requestFullscreen();
        }
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setSpeedIdx((prev) => Math.min(prev + 1, SPEEDS.length - 1));
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        setSpeedIdx((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const video = videoRef.current;
        if (video) {
          video.currentTime = Math.max(
            0,
            video.currentTime - SCRUB_OPTIONS[scrubIdxRef.current].value
          );
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const video = videoRef.current;
        if (video) {
          video.currentTime = Math.min(
            video.duration,
            video.currentTime + SCRUB_OPTIONS[scrubIdxRef.current].value
          );
        }
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const showShot = useCallback((shot: OverlayShot) => {
    setActiveShot(shot);
    setVisible(true);

    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = setTimeout(() => {
      setVisible(false);
    }, DISPLAY_DURATION_S * 1000);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const t = video.currentTime;
    const list = sortedShots.current;

    let best: OverlayShot | null = null;
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      if (s.timestamp <= t && t - s.timestamp <= DISPLAY_DURATION_S) {
        best = s;
        break;
      }
      if (s.timestamp < t - DISPLAY_DURATION_S) break;
    }

    if (best && best !== activeShot) {
      showShot(best);
    }
  }, [activeShot, showShot]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, [handleTimeUpdate]);

  useEffect(() => {
    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const frameNumber = Math.floor(currentTime * ASSUMED_FPS);
  const label = activeShot ? shotLabel(activeShot) : "";

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center justify-center overflow-hidden bg-black shadow-lg ${
        isFullscreen ? "h-screen w-screen" : "max-h-[60vh] rounded-lg"
      }`}
    >
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        controlsList="nofullscreen"
        className={`w-full object-contain ${isFullscreen ? "h-full" : "max-h-[60vh]"}`}
        preload="metadata"
      >
        {vttUrl && (
          <track
            ref={trackRef}
            kind="subtitles"
            src={vttUrl}
            label="Shots"
            default
          />
        )}
        Your browser does not support the video tag.
      </video>

      {/* Timestamp & frame indicator – top right, click to copy */}
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(formatTimestamp(currentTime));
          setCopied(true);
          if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
          copyTimerRef.current = setTimeout(() => setCopied(false), 1500);
        }}
        className="absolute top-3 right-3 z-[2147483647] rounded-md bg-black/70 px-2.5 py-1 font-mono text-xs tabular-nums text-white transition-colors hover:bg-white/20"
        title="Click to copy timestamp"
      >
        {copied ? (
          <span className="text-green-400">copied!</span>
        ) : (
          <>
            {formatTimestamp(currentTime)}
            <span className="ml-2 text-white/60">F{frameNumber}</span>
          </>
        )}
      </button>

      {/* Shot overlay – top left */}
      {activeShot && (
        <div
          className={`pointer-events-none absolute top-3 left-3 z-[2147483647] rounded-md bg-black/70 px-3 py-1.5 text-sm font-semibold text-white transition-opacity duration-500 ${
            visible ? "opacity-100" : "opacity-0"
          }`}
        >
          {label}
        </div>
      )}

      {/* Speed, scrub & fullscreen controls – right side, vertically centered */}
      <div className="absolute right-3 top-1/2 z-[2147483647] w-14 flex -translate-y-1/2 flex-col items-stretch gap-1.5 rounded-lg bg-black/70 px-2 py-2 backdrop-blur">
        {/* Collapse / expand toggle */}
        <button
          type="button"
          onClick={() => setControlsExpanded((v) => !v)}
          className="mx-auto rounded p-0.5 text-white/50 transition-colors hover:text-white"
          aria-label={controlsExpanded ? "Collapse controls" : "Expand controls"}
        >
          {controlsExpanded ? <CaretRight size={12} weight="bold" /> : <CaretLeft size={12} weight="bold" />}
        </button>

        {controlsExpanded ? (
          <>
            <div className="h-px w-full bg-white/20" />

            <div className="flex flex-col items-center gap-1">
              <span className="text-[9px] font-medium uppercase tracking-wider text-white/50">
                Speed <span className="normal-case tracking-normal">(-/+)</span>
              </span>
              <div className="flex flex-wrap justify-center gap-1">
                {SPEEDS.map((s, i) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSpeedIdx(i)}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                      i === speedIdx
                        ? "bg-white/20 text-white"
                        : "text-white/50 hover:text-white"
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>

            <div className="h-px w-full bg-white/20" />

            <div className="flex flex-col items-center gap-1">
              <span className="text-[9px] font-medium uppercase tracking-wider text-white/50">
                Scrub <span className="normal-case tracking-normal">(←/→)</span>
              </span>
              <div className="flex flex-wrap justify-center gap-1">
                {SCRUB_OPTIONS.map((opt, i) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setScrubIdx(i)}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                      i === scrubIdx
                        ? "bg-white/20 text-white"
                        : "text-white/50 hover:text-white"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-px w-full bg-white/20" />

            <button
              type="button"
              onClick={toggleFullscreen}
              className="mx-auto rounded p-1 text-white/50 transition-colors hover:text-white"
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? <CornersIn size={14} weight="bold" /> : <CornersOut size={14} weight="bold" />}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setSpeedIdx((prev) => (prev + 1) % SPEEDS.length)}
              onContextMenu={(e) => {
                e.preventDefault();
                setSpeedIdx((prev) => (prev - 1 + SPEEDS.length) % SPEEDS.length);
              }}
              className="rounded px-1 py-0.5 text-[10px] font-medium text-white/70 transition-colors hover:bg-white/20 hover:text-white"
              title={`Speed: ${SPEEDS[speedIdx]}x (click to cycle)`}
            >
              {SPEEDS[speedIdx]}
            </button>

            <button
              type="button"
              onClick={() => setScrubIdx((prev) => (prev + 1) % SCRUB_OPTIONS.length)}
              onContextMenu={(e) => {
                e.preventDefault();
                setScrubIdx(
                  (prev) => (prev - 1 + SCRUB_OPTIONS.length) % SCRUB_OPTIONS.length
                );
              }}
              className="rounded px-1 py-0.5 text-[10px] font-medium text-white/70 transition-colors hover:bg-white/20 hover:text-white"
              title={`Scrub: ${SCRUB_OPTIONS[scrubIdx].label} (click to cycle)`}
            >
              {SCRUB_OPTIONS[scrubIdx].label === "Frame" ? "F" : SCRUB_OPTIONS[scrubIdx].label}
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              className="mx-auto rounded p-1 text-white/50 transition-colors hover:text-white"
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? <CornersIn size={14} weight="bold" /> : <CornersOut size={14} weight="bold" />}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
