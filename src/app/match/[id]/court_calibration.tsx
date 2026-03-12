"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  CrosshairIcon,
  ArrowsClockwiseIcon,
  CheckIcon,
  X,
  Play,
  Pause,
} from "@phosphor-icons/react";

interface Point2D {
  x: number;
  y: number;
}

export interface CalibrationData {
  top_left: Point2D;
  top_right: Point2D;
  bottom_right: Point2D;
  bottom_left: Point2D;
  near_side: "me" | "opponent";
}

interface CourtCalibrationProps {
  videoUrl: string;
  matchId: number;
  initialCalibration?: CalibrationData | null;
  onCalibrationChange?: (cal: CalibrationData | null) => void;
}

const CORNER_LABELS = [
  "Far-left (top-left)",
  "Far-right (top-right)",
  "Near-right (bottom-right)",
  "Near-left (bottom-left)",
] as const;

const CORNER_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308"];

const DOT_CLASSES = [
  "bg-red-500",
  "bg-blue-500",
  "bg-green-500",
  "bg-yellow-500",
];

const BORDER_CLASSES = [
  "border-red-500",
  "border-blue-500",
  "border-green-500",
  "border-yellow-500",
];

function formatTime(s: number): string {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/**
 * Computes the rectangle where the video is actually rendered within its
 * element when using object-fit: contain. Returns coordinates relative to
 * the element's bounding client rect.
 */
function getVideoDisplayRect(video: HTMLVideoElement) {
  const elem = video.getBoundingClientRect();
  if (!video.videoWidth || !video.videoHeight)
    return { left: 0, top: 0, width: elem.width, height: elem.height };

  const videoAR = video.videoWidth / video.videoHeight;
  const elemAR = elem.width / elem.height;

  let w: number, h: number, offsetX: number, offsetY: number;
  if (videoAR > elemAR) {
    w = elem.width;
    h = w / videoAR;
    offsetX = 0;
    offsetY = (elem.height - h) / 2;
  } else {
    h = elem.height;
    w = h * videoAR;
    offsetX = (elem.width - w) / 2;
    offsetY = 0;
  }

  return { left: offsetX, top: offsetY, width: w, height: h };
}

export function CourtCalibration({
  videoUrl,
  matchId,
  initialCalibration,
  onCalibrationChange,
}: CourtCalibrationProps) {
  const [corners, setCorners] = useState<(Point2D | null)[]>(
    initialCalibration
      ? [
          initialCalibration.top_left,
          initialCalibration.top_right,
          initialCalibration.bottom_right,
          initialCalibration.bottom_left,
        ]
      : [null, null, null, null]
  );
  const [activeCorner, setActiveCorner] = useState(0);
  const [nearSide, setNearSide] = useState<"me" | "opponent">(
    initialCalibration?.near_side ?? "me"
  );
  const [isOpen, setIsOpen] = useState(false);
  const [paused, setPaused] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const allSet = corners.every((c) => c !== null);

  const syncCanvas = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!video || !canvas || !container) return;

    const display = getVideoDisplayRect(video);
    canvas.style.left = `${display.left}px`;
    canvas.style.top = `${display.top}px`;
    canvas.style.width = `${display.width}px`;
    canvas.style.height = `${display.height}px`;
    canvas.width = video.videoWidth || 1920;
    canvas.height = video.videoHeight || 1080;
  }, []);

  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const validCorners = corners.filter((c): c is Point2D => c !== null);

    if (validCorners.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(validCorners[0].x, validCorners[0].y);
      for (let i = 1; i < validCorners.length; i++) {
        ctx.lineTo(validCorners[i].x, validCorners[i].y);
      }
      if (validCorners.length === 4) ctx.closePath();
      ctx.strokeStyle = "rgba(67, 209, 167, 0.8)";
      ctx.lineWidth = 2;
      ctx.stroke();

      if (validCorners.length === 4) {
        ctx.fillStyle = "rgba(67, 209, 167, 0.15)";
        ctx.fill();
      }
    }

    corners.forEach((corner, i) => {
      if (!corner) return;
      ctx.beginPath();
      ctx.arc(corner.x, corner.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = CORNER_COLORS[i];
      ctx.fill();
      ctx.strokeStyle = "white";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "white";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText(`${i + 1}`, corner.x + 12, corner.y - 8);
    });
  }, [corners]);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const video = videoRef.current;
      if (video && !video.paused) {
        video.pause();
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      const newCorners = [...corners];
      newCorners[activeCorner] = { x, y };
      setCorners(newCorners);

      if (activeCorner < 3) {
        setActiveCorner(activeCorner + 1);
      }
    },
    [corners, activeCorner]
  );

  useEffect(() => {
    if (isOpen) {
      syncCanvas();
      drawOverlay();
    }
  }, [corners, isOpen, syncCanvas, drawOverlay]);

  useEffect(() => {
    if (!isOpen) return;
    const onResize = () => {
      syncCanvas();
      drawOverlay();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isOpen, syncCanvas, drawOverlay]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isOpen]);

  const handleVideoLoaded = () => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    setPaused(true);
    setDuration(video.duration);
    requestAnimationFrame(() => {
      syncCanvas();
      drawOverlay();
    });
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Number(e.target.value);
    setCurrentTime(video.currentTime);
  };

  const handleReset = () => {
    setCorners([null, null, null, null]);
    setActiveCorner(0);
  };

  const handleConfirm = () => {
    if (!allSet) return;
    const cal: CalibrationData = {
      top_left: corners[0]!,
      top_right: corners[1]!,
      bottom_right: corners[2]!,
      bottom_left: corners[3]!,
      near_side: nearSide,
    };
    onCalibrationChange?.(cal);
    setIsOpen(false);
  };

  const firstEmpty = corners.findIndex((c) => c === null);
  const handleOpen = () => {
    setIsOpen(true);
    setActiveCorner(firstEmpty >= 0 ? firstEmpty : 0);
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleOpen}
          className="inline-flex items-center gap-2 rounded-lg bg-ui-elevated px-3 py-2 text-sm font-medium text-text-main transition-colors hover:bg-ui-elevated/80"
        >
          <CrosshairIcon size={16} weight="bold" />
          {allSet ? "Recalibrate court" : "Calibrate court"}
        </button>

        {allSet && (
          <button
            type="button"
            onClick={handleOpen}
            className="inline-flex items-center gap-2 rounded-lg bg-ui-elevated px-3 py-2 text-sm font-medium text-text-main transition-colors hover:bg-ui-elevated/80"
          >
            Show court calibration
          </button>
        )}
      </div>

      {isOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 flex flex-col bg-black">
            {/* ── Top bar: instructions + corner indicators ── */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-black/80 px-4 py-2.5 backdrop-blur sm:px-6">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-sm font-semibold text-white">
                  Court Calibration
                </h3>
                <p className="text-xs text-white/70">
                  {paused ? (
                    allSet ? (
                      "All corners placed. Confirm or click to adjust."
                    ) : (
                      <>
                        Click to place:{" "}
                        <span className="font-semibold text-white">
                          {CORNER_LABELS[activeCorner]}
                        </span>
                      </>
                    )
                  ) : (
                    "Pause the video, then click to place corners"
                  )}
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                {CORNER_LABELS.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveCorner(i)}
                    className={`flex items-center gap-1.5 rounded-md border-2 px-2 py-1 text-xs transition-colors ${
                      i === activeCorner
                        ? `${BORDER_CLASSES[i]} text-white`
                        : "border-transparent text-white/50 hover:text-white"
                    }`}
                  >
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${DOT_CLASSES[i]}`}
                    />
                    {corners[i] ? `${i + 1} set` : `${i + 1}`}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="ml-2 rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
                  aria-label="Close calibration"
                >
                  <X size={20} weight="bold" />
                </button>
              </div>
            </div>

            {/* ── Center: video with click-overlay canvas ── */}
            <div
              ref={containerRef}
              className="relative flex-1 overflow-hidden"
            >
              <video
                ref={videoRef}
                src={videoUrl}
                className="h-full w-full object-contain"
                preload="auto"
                onLoadedData={handleVideoLoaded}
                onSeeked={() => {
                  syncCanvas();
                  drawOverlay();
                }}
                onTimeUpdate={() => {
                  const v = videoRef.current;
                  if (v) setCurrentTime(v.currentTime);
                }}
                onPlay={() => setPaused(false)}
                onPause={() => setPaused(true)}
              />
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                className={`absolute ${paused ? "cursor-crosshair" : "cursor-pointer"}`}
              />
            </div>

            {/* ── Bottom bar: playback controls + actions ── */}
            <div className="flex flex-wrap items-center gap-3 border-t border-white/10 bg-black/80 px-4 py-2.5 backdrop-blur sm:px-6">
              <button
                type="button"
                onClick={togglePlay}
                className="rounded-md p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
                aria-label={paused ? "Play" : "Pause"}
              >
                {paused ? (
                  <Play size={20} weight="fill" />
                ) : (
                  <Pause size={20} weight="fill" />
                )}
              </button>

              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.01}
                value={currentTime}
                onChange={handleSeek}
                className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-white/20 accent-white [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
              />

              <span className="min-w-[5rem] text-right text-xs tabular-nums text-white/60">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>

              <div className="hidden h-5 w-px bg-white/20 sm:block" />

              <div className="flex items-center gap-1.5">
                <label className="text-xs text-white/60">Near side:</label>
                <select
                  value={nearSide}
                  onChange={(e) =>
                    setNearSide(e.target.value as "me" | "opponent")
                  }
                  className="rounded-md bg-white/10 px-2 py-1 text-xs text-white"
                >
                  <option value="me">Me</option>
                  <option value="opponent">Opponent</option>
                </select>
              </div>

              <div className="hidden h-5 w-px bg-white/20 sm:block" />

              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-white/60 hover:bg-white/10 hover:text-white"
              >
                <ArrowsClockwiseIcon size={14} />
                Reset
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                disabled={!allSet}
                className="inline-flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
              >
                <CheckIcon size={14} weight="bold" />
                Confirm
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
