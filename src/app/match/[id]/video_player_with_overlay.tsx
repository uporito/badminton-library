"use client";

import { useRef, useState, useEffect, useCallback, useMemo } from "react";

export interface OverlayShot {
  shotType: string;
  player: string;
  timestamp: number;
}

interface VideoPlayerWithOverlayProps {
  videoUrl: string;
  videoSource?: string;
  shots: OverlayShot[];
}

const DISPLAY_DURATION_S = 3;

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
  videoSource = "local",
  shots,
}: VideoPlayerWithOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLTrackElement>(null);
  const [activeShot, setActiveShot] = useState<OverlayShot | null>(null);
  const [visible, setVisible] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isYoutube = videoSource === "youtube";

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

  // Toggle text track mode based on fullscreen state
  useEffect(() => {
    const track = trackRef.current?.track;
    if (!track) return;
    track.mode = isFullscreen ? "showing" : "hidden";
  }, [isFullscreen]);

  // Detect fullscreen changes
  useEffect(() => {
    function handleFsChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", handleFsChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFsChange);
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
    };
  }, []);

  const label = activeShot ? shotLabel(activeShot) : "";

  return (
    <div className="relative flex max-h-[60vh] items-center justify-center overflow-hidden rounded-lg bg-black shadow-lg">
      {isYoutube ? (
        <iframe
          src={videoUrl}
          title="YouTube video"
          className="aspect-video max-h-[60vh] w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      ) : (
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          className="max-h-[60vh] w-full object-contain"
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
      )}

      {!isYoutube && !isFullscreen && activeShot && (
        <div
          className={`pointer-events-none absolute top-3 right-3 rounded-md bg-black/70 px-3 py-1.5 text-sm font-semibold text-white transition-opacity duration-500 ${
            visible ? "opacity-100" : "opacity-0"
          }`}
        >
          {label}
        </div>
      )}
    </div>
  );
}
