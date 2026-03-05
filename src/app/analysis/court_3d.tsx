"use client";

import { zoneEnum } from "@/db/schema";
import type { Side, Zone } from "@/db/schema";
import type { CourtRow } from "@/lib/shot_chart_utils";

/** Zone at data coords: row 0 = front, col 0 = left (matches zoneEnum order) */
function zoneAt(row: number, col: number): Zone {
  return zoneEnum[row * 3 + col];
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

export type SelectedZone = { side: Side; zone: Zone } | null;

interface Court3DProps {
  /** When set, the matching zone is highlighted on the 3D court */
  selectedZone: SelectedZone;
  /** When set, the entire row on "my" court (zoneFrom) is highlighted (e.g. from court card filter) */
  highlightedCourtRow?: CourtRow | null;
}

/**
 * 3D court with a back-left perspective: viewer is at the back left corner
 * looking toward the net and the right side of the court (rotateY + tilt).
 */
export function Court3D({
  selectedZone,
  highlightedCourtRow = null,
}: Court3DProps) {
  const highlightedRowIndex =
    highlightedCourtRow != null
      ? courtRowToDisplayRow(highlightedCourtRow)
      : null;
  return (
    <div
      className="flex justify-center py-6"
      style={{ perspective: "1000px" }}
      aria-label="3D court zones (back-left view)"
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
          className="inline-grid grid-cols-3 grid-rows-3 gap-1 bg-white p-1 dark:bg-zinc-100"
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
                      ? "bg-amber-400 ring-2 ring-amber-600 dark:bg-amber-500 dark:ring-amber-400"
                      : "bg-emerald-100 dark:bg-emerald-900/50 hover:bg-accent/40 dark:hover:bg-accent/50"
                  }`}
                  style={{ transformStyle: "preserve-3d" }}
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
          className="inline-grid grid-cols-3 grid-rows-3 gap-1 bg-white p-1 dark:bg-zinc-100"
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
                      ? "bg-amber-400 ring-2 ring-amber-600 dark:bg-amber-500 dark:ring-amber-400"
                      : isRowHighlighted
                        ? "bg-accent/60 ring-2 ring-accent dark:bg-accent/50 dark:ring-accent"
                        : "bg-emerald-100 dark:bg-emerald-900/50 hover:bg-accent/40 dark:hover:bg-accent/50"
                  }`}
                  style={{ transformStyle: "preserve-3d" }}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
