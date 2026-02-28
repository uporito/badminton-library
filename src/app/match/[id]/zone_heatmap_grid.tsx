"use client";

import type { Side } from "@/db/schema";
import { zoneCountRange } from "@/lib/shot_chart_utils";

const ROW_LABELS = ["Front", "Mid", "Back"];
const COL_LABELS = ["Left", "Center", "Right"];

/** Interpolate between two hex colors by factor in [0,1] */
function interpolateHex(hexFrom: string, hexTo: string, t: number): string {
  const parse = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff] as const;
  };
  const [r1, g1, b1] = parse(hexFrom);
  const [r2, g2, b2] = parse(hexTo);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
}

/** Light blue (least) -> bright blue (most) for a clean heat scale on white */
const HEAT_LOW = "#e0f2fe";
const HEAT_HIGH = "#0369a1";

function getHeatColor(count: number, min: number, max: number): string {
  if (max <= min) return HEAT_LOW;
  const t = (count - min) / (max - min);
  return interpolateHex(HEAT_LOW, HEAT_HIGH, t);
}

function getHeatTextColor(count: number, min: number, max: number): string {
  if (count === 0 || max <= min) return "#94a3b8";
  const t = (count - min) / (max - min);
  return t >= 0.5 ? "#ffffff" : "#0c4a6e";
}

interface ZoneHeatmapGridProps {
  /** 3x3 grid of shot counts (zoneFrom) */
  grid: number[][];
  title: string;
}

export function ZoneHeatmapGrid({ grid, title }: ZoneHeatmapGridProps) {
  const { min, max } = zoneCountRange(grid);

  return (
    <div className="inline-block">
      <p className="mb-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {title}
      </p>
      <div className="inline-grid h-[6.75rem] w-[6.75rem] grid-cols-3 grid-rows-3 gap-0.5 rounded border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 sm:h-[7.5rem] sm:w-[7.5rem]">
        {grid.map((row, displayRow) =>
          row.map((count, displayCol) => (
            <div
              key={`${displayRow}-${displayCol}`}
              className="flex aspect-square min-w-0 items-center justify-center rounded text-xs font-medium text-white drop-shadow-sm"
              style={{
                backgroundColor: getHeatColor(count, min, max),
                color: getHeatTextColor(count, min, max),
              }}
              title={`${COL_LABELS[displayCol]} ${ROW_LABELS[displayRow].toLowerCase()}: ${count} shots`}
            >
              {count > 0 ? count : ""}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

interface ZoneHeatmapsProps {
  gridMe: number[][];
  gridOpponent: number[][];
}

export function ZoneHeatmaps({ gridMe, gridOpponent }: ZoneHeatmapsProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
      <ZoneHeatmapGrid grid={gridOpponent} title="Opponent shots (from zone)" />
      <ZoneHeatmapGrid grid={gridMe} title="My shots (from zone)" />
    </div>
  );
}
