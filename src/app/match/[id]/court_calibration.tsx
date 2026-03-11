"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { CrosshairIcon, ArrowsClockwiseIcon, CheckIcon } from "@phosphor-icons/react";

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

const CORNER_COLORS = [
  "bg-red-500",
  "bg-blue-500",
  "bg-green-500",
  "bg-yellow-500",
];

const CORNER_BORDER_COLORS = [
  "border-red-500",
  "border-blue-500",
  "border-green-500",
  "border-yellow-500",
];

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
  const [isCalibrating, setIsCalibrating] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const allSet = corners.every((c) => c !== null);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
  }, []);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
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
    const canvas = canvasRef.current;
    if (!canvas || !isCalibrating) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const video = videoRef.current;
    if (video) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }

    const validCorners = corners.filter((c): c is Point2D => c !== null);

    if (validCorners.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(validCorners[0].x, validCorners[0].y);
      for (let i = 1; i < validCorners.length; i++) {
        ctx.lineTo(validCorners[i].x, validCorners[i].y);
      }
      if (validCorners.length === 4) {
        ctx.closePath();
      }
      ctx.strokeStyle = "rgba(67, 209, 167, 0.8)";
      ctx.lineWidth = 2;
      ctx.stroke();

      if (validCorners.length === 4) {
        ctx.fillStyle = "rgba(67, 209, 167, 0.1)";
        ctx.fill();
      }
    }

    corners.forEach((corner, i) => {
      if (!corner) return;
      ctx.beginPath();
      ctx.arc(corner.x, corner.y, 8, 0, Math.PI * 2);
      const colors = ["#ef4444", "#3b82f6", "#22c55e", "#eab308"];
      ctx.fillStyle = colors[i];
      ctx.fill();
      ctx.strokeStyle = "white";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "white";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText(`${i + 1}`, corner.x + 12, corner.y - 8);
    });
  }, [corners, isCalibrating]);

  const handleStartCalibration = () => {
    setIsCalibrating(true);
    setActiveCorner(0);
    setTimeout(captureFrame, 100);
  };

  const handleReset = () => {
    setCorners([null, null, null, null]);
    setActiveCorner(0);
    captureFrame();
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
    setIsCalibrating(false);
  };

  if (!isCalibrating) {
    return (
      <button
        type="button"
        onClick={handleStartCalibration}
        className="inline-flex items-center gap-2 rounded-lg bg-ui-elevated px-3 py-2 text-sm font-medium text-text-main transition-colors hover:bg-ui-elevated/80"
      >
        <CrosshairIcon size={16} weight="bold" />
        {allSet ? "Recalibrate court" : "Calibrate court"}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-main">
          Court Calibration
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1 rounded-md bg-ui-elevated px-2 py-1 text-xs text-text-soft hover:text-text-main"
          >
            <ArrowsClockwiseIcon size={14} />
            Reset
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!allSet}
            className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
          >
            <CheckIcon size={14} weight="bold" />
            Confirm
          </button>
        </div>
      </div>

      <p className="text-xs text-text-soft">
        Click the 4 court corners in order. Currently placing:{" "}
        <span className="font-semibold text-text-main">
          {CORNER_LABELS[activeCorner]}
        </span>
      </p>

      <div className="flex gap-2">
        {CORNER_LABELS.map((label, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActiveCorner(i)}
            className={`flex items-center gap-1.5 rounded-md border-2 px-2 py-1 text-xs transition-colors ${
              i === activeCorner
                ? `${CORNER_BORDER_COLORS[i]} bg-ui-elevated text-text-main`
                : "border-transparent text-text-soft hover:text-text-main"
            }`}
          >
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${CORNER_COLORS[i]}`}
            />
            {corners[i] ? `${i + 1} set` : `${i + 1}`}
          </button>
        ))}
      </div>

      <div ref={containerRef} className="relative">
        <video
          ref={videoRef}
          src={videoUrl}
          className="hidden"
          preload="metadata"
          onLoadedMetadata={captureFrame}
        />
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className="w-full cursor-crosshair rounded-lg"
        />
      </div>

      <div className="flex items-center gap-3">
        <label className="text-xs text-text-soft">Near side is:</label>
        <select
          value={nearSide}
          onChange={(e) => setNearSide(e.target.value as "me" | "opponent")}
          className="rounded-md bg-ui-elevated px-2 py-1 text-xs text-text-main"
        >
          <option value="me">Me (my side)</option>
          <option value="opponent">Opponent</option>
        </select>
      </div>
    </div>
  );
}
