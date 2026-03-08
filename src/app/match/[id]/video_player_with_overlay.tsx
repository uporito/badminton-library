"use client";

import { useRef, useState, useEffect, useCallback } from "react";

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

export function VideoPlayerWithOverlay({
  videoUrl,
  shots,
}: VideoPlayerWithOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeShot, setActiveShot] = useState<OverlayShot | null>(null);
  const [visible, setVisible] = useState(false);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sortedShots = useRef(
    [...shots].sort((a, b) => a.timestamp - b.timestamp)
  );

  useEffect(() => {
    sortedShots.current = [...shots].sort((a, b) => a.timestamp - b.timestamp);
  }, [shots]);

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

  const label = activeShot
    ? `${SHOT_LABELS[activeShot.shotType] ?? activeShot.shotType} (${activeShot.player})`
    : "";

  return (
    <div className="relative flex max-h-[60vh] items-center justify-center overflow-hidden rounded-lg bg-black shadow-lg">
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        className="max-h-[60vh] w-full object-contain"
        preload="metadata"
      >
        Your browser does not support the video tag.
      </video>

      {activeShot && (
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
