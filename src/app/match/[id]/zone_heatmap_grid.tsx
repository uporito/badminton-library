"use client";

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

/** Opponent court: display (row,col) shows data at (2-row, 2-col) — flipped and mirrored */
function courtBorderClass(displayRow: number, displayCol: number): string {
  const sides = [
    displayRow < 2 ? "border-b" : "",
    displayCol < 2 ? "border-r" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return `${sides} border-green-800`;
}

interface ZoneHeatmapsProps {
  /** 3x3 grid: shots TO each zone on opponent's court (data coords: row 0 = front, col 0 = left) */
  gridOpponentTo: number[][];
  /** 3x3 grid: shots FROM each zone on my court (data coords: row 0 = front, col 0 = left) */
  gridMeFrom: number[][];
}

export function ZoneHeatmaps({ gridOpponentTo, gridMeFrom }: ZoneHeatmapsProps) {
  const rangeTop = zoneCountRange(gridOpponentTo);
  const rangeBottom = zoneCountRange(gridMeFrom);
  const min = Math.min(rangeTop.min, rangeBottom.min);
  const max = Math.max(rangeTop.max, rangeBottom.max);

  return (
    <div className="inline-flex flex-col gap-0">
      {/* Opponent court (top): shots TO each zone; display flipped and mirrored like court_zone_grid */}
      <div>
        <p className="mb-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Opponent&apos;s court (shots to zone)
        </p>
        <div className="inline-grid h-[6.75rem] w-[6.75rem] grid-cols-3 grid-rows-3 gap-0 border border-green-800 sm:h-[7.5rem] sm:w-[7.5rem]">
          {[0, 1, 2].map((displayRow) =>
            [0, 1, 2].map((displayCol) => {
              const dataRow = 2 - displayRow;
              const dataCol = 2 - displayCol;
              const count = gridOpponentTo[dataRow]?.[dataCol] ?? 0;
              const dataZoneLabel = `${COL_LABELS[dataCol]} ${ROW_LABELS[dataRow].toLowerCase()}`;
              return (
                <div
                  key={`opp-${displayRow}-${displayCol}`}
                  className={`flex aspect-square min-w-0 items-center justify-center text-xs font-medium drop-shadow-sm ${courtBorderClass(displayRow, displayCol)}`}
                  style={{
                    backgroundColor: getHeatColor(count, min, max),
                    color: getHeatTextColor(count, min, max),
                  }}
                  title={`${dataZoneLabel}: ${count} shots`}
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
        <p className="mb-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          My court (shots from zone)
        </p>
        <div className="inline-grid h-[6.75rem] w-[6.75rem] grid-cols-3 grid-rows-3 gap-0 border border-green-800 sm:h-[7.5rem] sm:w-[7.5rem]">
          {[0, 1, 2].map((displayRow) =>
            [0, 1, 2].map((displayCol) => {
              const count = gridMeFrom[displayRow]?.[displayCol] ?? 0;
              const dataZoneLabel = `${COL_LABELS[displayCol]} ${ROW_LABELS[displayRow].toLowerCase()}`;
              return (
                <div
                  key={`me-${displayRow}-${displayCol}`}
                  className={`flex aspect-square min-w-0 items-center justify-center text-xs font-medium drop-shadow-sm ${courtBorderClass(displayRow, displayCol)}`}
                  style={{
                    backgroundColor: getHeatColor(count, min, max),
                    color: getHeatTextColor(count, min, max),
                  }}
                  title={`${dataZoneLabel}: ${count} shots`}
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
