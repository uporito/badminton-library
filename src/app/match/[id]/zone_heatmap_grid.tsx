"use client";

import { useState } from "react";
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

/** Interpolation start (0 shots) and end (most) for heat — empty cell uses Tailwind for light/dark */
const HEAT_EMPTY = "#f4f4f5"; /* zinc-100 */
const HEAT_FULL = "#15803d"; /* green-700 */

function getHeatColor(count: number, min: number, max: number): string | undefined {
  if (count === 0 || max <= 0) return undefined;
  const t = Math.min(1, count / max);
  return interpolateHex(HEAT_EMPTY, HEAT_FULL, t);
}

function getHeatTextColor(count: number, min: number, max: number): string | undefined {
  if (count === 0 || max <= 0) return undefined;
  const t = Math.min(1, count / max);
  return t >= 0.5 ? "#ffffff" : "#166534"; /* green-800 on light green */
}

interface ZoneHeatmapsProps {
  /** 3x3 grid: shots TO each zone on opponent's court (data coords: row 0 = front, col 0 = left) */
  gridOpponentTo: number[][];
  /** 3x3 grid: shots FROM each zone on my court (data coords: row 0 = front, col 0 = left) */
  gridMeFrom: number[][];
}

const TOOLTIP_OFFSET = 12;

type TooltipState = {
  label: string;
  count: number;
  x: number;
  y: number;
} | null;

export function ZoneHeatmaps({ gridOpponentTo, gridMeFrom }: ZoneHeatmapsProps) {
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const rangeTop = zoneCountRange(gridOpponentTo);
  const rangeBottom = zoneCountRange(gridMeFrom);
  const min = Math.min(rangeTop.min, rangeBottom.min);
  const max = Math.max(rangeTop.max, rangeBottom.max);

  const handleMouseLeave = () => setTooltip(null);

  const handleCellEnter = (
    e: React.MouseEvent,
    label: string,
    count: number
  ) => {
    setTooltip({ label, count, x: e.clientX, y: e.clientY });
  };

  return (
    <div
      className="relative inline-flex flex-col gap-4"
      onMouseLeave={handleMouseLeave}
    >
      {tooltip != null && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-xs shadow-md transition-[left_0.15s_ease-out,top_0.15s_ease-out] dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-md"
          style={{
            left: tooltip.x + TOOLTIP_OFFSET,
            top: tooltip.y + TOOLTIP_OFFSET,
          }}
        >
          <div className="flex w-40 items-center justify-between gap-4">
            <span className="text-zinc-600 dark:text-zinc-400">Zone</span>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {tooltip.label}
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-4 border-t border-zinc-200 dark:border-zinc-700 pt-1.5">
            <span className="text-zinc-600 dark:text-zinc-400">Shots</span>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {tooltip.count}
            </span>
          </div>
        </div>
      )}
      {/* Opponent court (top): shots TO each zone; display flipped and mirrored like court_zone_grid */}
      <div>
        <div className="inline-grid h-[6.75rem] w-[6.75rem] grid-cols-3 grid-rows-3 gap-1 sm:h-[7.5rem] sm:w-[7.5rem]">
          {[0, 1, 2].map((displayRow) =>
            [0, 1, 2].map((displayCol) => {
              const dataRow = 2 - displayRow;
              const dataCol = 2 - displayCol;
              const count = gridOpponentTo[dataRow]?.[dataCol] ?? 0;
              const dataZoneLabel = `${COL_LABELS[dataCol]} ${ROW_LABELS[dataRow].toLowerCase()}`;
              const bg = getHeatColor(count, min, max);
              const fg = getHeatTextColor(count, min, max);
              return (
                <div
                  key={`opp-${displayRow}-${displayCol}`}
                  className={`flex aspect-square min-w-0 cursor-default items-center justify-center rounded-[2px] text-xs font-medium drop-shadow-sm hover:ring-2 hover:ring-zinc-400 dark:hover:ring-zinc-500 ${count === 0 ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" : ""}`}
                  style={{
                    ...(bg != null && { backgroundColor: bg }),
                    ...(fg != null && { color: fg }),
                  }}
                  onMouseEnter={(e) =>
                    handleCellEnter(e, dataZoneLabel, count)}
                >
                  {count > 0 ? count : ""}
                </div>
              );
            })
          )}
        </div>
      </div>
      {/* My court (bottom): shots FROM each zone; display matches data coords */}
      <div>
        <div className="inline-grid h-[6.75rem] w-[6.75rem] grid-cols-3 grid-rows-3 gap-1 sm:h-[7.5rem] sm:w-[7.5rem]">
          {[0, 1, 2].map((displayRow) =>
            [0, 1, 2].map((displayCol) => {
              const count = gridMeFrom[displayRow]?.[displayCol] ?? 0;
              const dataZoneLabel = `${COL_LABELS[displayCol]} ${ROW_LABELS[displayRow].toLowerCase()}`;
              const bg = getHeatColor(count, min, max);
              const fg = getHeatTextColor(count, min, max);
              return (
                <div
                  key={`me-${displayRow}-${displayCol}`}
                  className={`flex aspect-square min-w-0 cursor-default items-center justify-center rounded-[2px] text-xs font-medium drop-shadow-sm hover:ring-2 hover:ring-zinc-400 dark:hover:ring-zinc-500 ${count === 0 ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" : ""}`}
                  style={{
                    ...(bg != null && { backgroundColor: bg }),
                    ...(fg != null && { color: fg }),
                  }}
                  onMouseEnter={(e) =>
                    handleCellEnter(e, dataZoneLabel, count)}
                >
                  {count > 0 ? count : ""}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}