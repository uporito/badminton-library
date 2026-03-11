"use client";

import { useState, useMemo, Fragment } from "react";
import { createPortal } from "react-dom";
import { zoneEnum } from "@/db/schema";
import type { Side, Zone, ShotType } from "@/db/schema";
import type { CourtRow, ShotForStats } from "@/lib/shot_chart_utils";
import { SHOT_TYPE_LABELS } from "@/lib/shot_chart_utils";

/**
 * Zone at data coords: row 0 = front, col 0 = left.
 * zoneEnum is grouped by side (left_*, center_*, right_*), so index = col * 3 + row.
 */
function zoneAt(row: number, col: number): Zone {
  return zoneEnum[col * 3 + row];
}

/** Opponent court: display row 0 = top = back of court → data row 2; display col 0 = left → data col 0 (mirrored: data col 2) */
function zoneAtDisplay(side: Side, displayRow: number, displayCol: number): Zone {
  if (side === "opponent") {
    return zoneAt(2 - displayRow, 2 - displayCol);
  }
  return zoneAt(displayRow, displayCol);
}

/** Court row to data/display row index: front=0, mid=1, back=2 */
function courtRowToDisplayRow(courtRow: CourtRow): number {
  return { front: 0, mid: 1, back: 2 }[courtRow];
}

/** Human-readable zone label: "left_back" → "Back Left" */
function zoneDisplayName(zone: Zone): string {
  const [sideStr, depthStr] = zone.split("_");
  const depth = ({ front: "Front", mid: "Mid", back: "Back" } as Record<string, string>)[depthStr] ?? depthStr;
  const side = ({ left: "Left", center: "Center", right: "Right" } as Record<string, string>)[sideStr] ?? sideStr;
  return `${depth} ${side}`;
}

export type SelectedZone = { side: Side; zone: Zone } | null;

type TooltipState = { zone: Zone; side: Side; x: number; y: number } | null;

interface Court3DProps {
  /** When set, the matching zone is highlighted on the 3D court */
  selectedZone: SelectedZone;
  /** When set, the entire row on "my" court (zoneFrom) is highlighted (e.g. from court card filter) */
  highlightedCourtRow?: CourtRow | null;
  /** All shots — used to populate per-zone hover tooltips */
  shots?: ShotForStats[];
  /** Called when the user clicks a zone cell */
  onZoneClick?: (zone: Zone, side: Side) => void;
}

/**
 * 3D court with a back-left perspective: viewer is at the back left corner
 * looking toward the net and the right side of the court (rotateY + tilt).
 */
export function Court3D({
  selectedZone,
  highlightedCourtRow = null,
  shots = [],
  onZoneClick,
}: Court3DProps) {
  const highlightedRowIndex =
    highlightedCourtRow != null
      ? courtRowToDisplayRow(highlightedCourtRow)
      : null;

  const [tooltip, setTooltip] = useState<TooltipState>(null);

  /** Precompute shot breakdown per zone per side, sorted by count desc */
  const shotsByZoneKey = useMemo(() => {
    const map = new Map<string, { shotType: ShotType; count: number; percentage: number }[]>();
    if (shots.length === 0) return map;

    const raw = new Map<string, Map<ShotType, number>>();
    for (const s of shots) {
      const key = `${s.zoneFromSide}:${s.zoneFrom}`;
      if (!raw.has(key)) raw.set(key, new Map());
      const typeMap = raw.get(key)!;
      typeMap.set(s.shotType, (typeMap.get(s.shotType) ?? 0) + 1);
    }

    for (const [key, typeMap] of raw) {
      const total = Array.from(typeMap.values()).reduce((a, b) => a + b, 0);
      const breakdown = Array.from(typeMap.entries())
        .map(([shotType, count]) => ({
          shotType,
          count,
          percentage: Math.round((count / total) * 100),
        }))
        .sort((a, b) => b.count - a.count);
      map.set(key, breakdown);
    }
    return map;
  }, [shots]);

  function handleCellEnter(e: React.MouseEvent, zone: Zone, side: Side) {
    setTooltip({ zone, side, x: e.clientX, y: e.clientY });
  }

  const tooltipBreakdown = tooltip
    ? (shotsByZoneKey.get(`${tooltip.side}:${tooltip.zone}`) ?? [])
    : [];

  return (
    <div
      className="flex justify-center py-6"
      style={{ perspective: "1000px" }}
      aria-label="3D court zones (back-left view)"
      onMouseLeave={() => setTooltip(null)}
    >
      <div
        className="flex flex-col gap-3"
        style={{
          transformStyle: "preserve-3d",
          transform: "rotateX(60deg) rotateY(0deg) rotateZ(38deg)",
        }}
      >
        {/* Opponent court (top) */}
        <div
          className="inline-grid grid-cols-3 grid-rows-3 gap-1 bg-white p-1 dark:bg-zinc-100 cursor-pointer"
          style={{ transformStyle: "preserve-3d" }}
        >
          {[0, 1, 2].map((displayRow) =>
            [0, 1, 2].map((displayCol) => {
              const zone = zoneAtDisplay("opponent", displayRow, displayCol);
              const isSelected =
                selectedZone?.side === "opponent" && selectedZone?.zone === zone;
              return (
                <div
                  key={`opponent-${zone}`}
                  className={`h-14 w-14 cursor-pointer transition-colors sm:h-16 sm:w-16 md:h-20 md:w-20 ${
                    isSelected
                      ? "bg-accent ring-2 ring-accent ring-inset"
                      : "bg-emerald-100 dark:bg-emerald-900/50 hover:bg-accent/40 dark:hover:bg-accent/50"
                  }`}
                  style={{ transformStyle: "preserve-3d" }}
                  onMouseEnter={(e) => handleCellEnter(e, zone, "opponent")}
                  onClick={() => onZoneClick?.(zone, "opponent")}
                />
              );
            })
          )}
        </div>
        {/* Net (visual separator) */}
        <div
          className="h-1.5 w-full bg-zinc-500 dark:bg-zinc-400"
          style={{ transformStyle: "preserve-3d" }}
        />
        {/* My court (bottom) */}
        <div
          className="inline-grid grid-cols-3 grid-rows-3 gap-1 bg-white p-1 dark:bg-zinc-100 cursor-pointer"
          style={{ transformStyle: "preserve-3d" }}
        >
          {[0, 1, 2].map((displayRow) =>
            [0, 1, 2].map((displayCol) => {
              const zone = zoneAtDisplay("me", displayRow, displayCol);
              const isSelected =
                selectedZone?.side === "me" && selectedZone?.zone === zone;
              const isRowHighlighted =
                highlightedRowIndex !== null && displayRow === highlightedRowIndex;
              return (
                <div
                  key={`me-${zone}`}
                  className={`h-14 w-14 cursor-pointer transition-colors sm:h-16 sm:w-16 md:h-20 md:w-20 ${
                    isSelected
                      ? "bg-accent ring-2 ring-accent ring-inset"
                      : isRowHighlighted
                        ? "bg-accent"
                        : "bg-emerald-100 dark:bg-emerald-900/50 hover:bg-accent/40 dark:hover:bg-accent/50"
                  }`}
                  style={{ transformStyle: "preserve-3d" }}
                  onMouseEnter={(e) => handleCellEnter(e, zone, "me")}
                  onClick={() => onZoneClick?.(zone, "me")}
                />
              );
            })
          )}
        </div>
      </div>

      {/* Zone tooltip */}
      {tooltip != null &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="frame-glass pointer-events-none fixed z-[200] min-w-[160px] rounded-xl px-4 py-3 text-xs shadow-lg"
            style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
          >
            <p className="font-semibold text-text-main">
              {zoneDisplayName(tooltip.zone)}
            </p>
            {tooltipBreakdown.length === 0 ? (
              <p className="mt-1.5 text-text-main">No shots recorded</p>
            ) : (
              <div className="mt-2 grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1 border-t border-zinc-600 pt-2">
                {tooltipBreakdown.map(({ shotType, count, percentage }) => (
                  <Fragment key={shotType}>
                    <span className="text-text-main">
                      {SHOT_TYPE_LABELS[shotType]}
                    </span>
                    <span className="tabular-nums text-right text-text-main">
                      {count}
                    </span>
                    <span className="tabular-nums text-right text-text-main">
                      {percentage}&thinsp;%
                    </span>
                  </Fragment>
                ))}
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
