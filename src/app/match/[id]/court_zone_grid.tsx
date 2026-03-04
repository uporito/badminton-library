"use client";

import { zoneEnum } from "@/db/schema";
import type { Zone, Side } from "@/db/schema";

const ROW_LABELS = ["Front", "Mid", "Back"];
const COL_LABELS = ["Left", "Center", "Right"];

function zoneAt(row: number, col: number): Zone {
  return zoneEnum[row * 3 + col];
}

/** Opponent court is "facing" us: back line at top, front at bottom; left/right mirrored */
function zoneAtDisplay(side: Side, displayRow: number, displayCol: number): Zone {
  if (side === "opponent") {
    return zoneAt(2 - displayRow, 2 - displayCol);
  }
  return zoneAt(displayRow, displayCol);
}

interface CourtZoneGridProps {
  zoneFrom: { side: Side; zone: Zone } | null;
  zoneTo: { side: Side; zone: Zone } | null;
  onZoneClick: (side: Side, zone: Zone) => void;
}

const COURT_GREEN = "bg-green-700";
const COURT_GREEN_HOVER = "hover:bg-green-600";
function courtBorderClass(displayRow: number, displayCol: number): string {
  const sides = [
    displayRow < 2 ? "border-b" : "",
    displayCol < 2 ? "border-r" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return `${sides} border-green-800`;
}

function ZoneGrid({
  side,
  label,
  zoneFrom,
  zoneTo,
  onZoneClick,
}: {
  side: Side;
  label: string;
  zoneFrom: { side: Side; zone: Zone } | null;
  zoneTo: { side: Side; zone: Zone } | null;
  onZoneClick: (side: Side, zone: Zone) => void;
}) {
  return (
    <div className="inline-block">
      <p className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <div className="inline-grid h-[6.75rem] w-[6.75rem] grid-cols-3 grid-rows-3 gap-0 border border-green-800 sm:h-[7.5rem] sm:w-[7.5rem]">
        {[0, 1, 2].map((displayRow) =>
          [0, 1, 2].map((displayCol) => {
            const zone = zoneAtDisplay(side, displayRow, displayCol);
            const isFrom =
              zoneFrom?.side === side && zoneFrom?.zone === zone;
            const isTo = zoneTo?.side === side && zoneTo?.zone === zone;
            const dataRow = side === "opponent" ? 2 - displayRow : displayRow;
            const dataCol = side === "opponent" ? 2 - displayCol : displayCol;
            return (
              <button
                key={zone}
                type="button"
                onClick={() => onZoneClick(side, zone)}
                className={`flex aspect-square min-w-0 items-center justify-center text-xs text-white ${courtBorderClass(displayRow, displayCol)} ${
                  isFrom
                    ? "bg-green-600 ring-2 ring-inset ring-white hover:bg-green-500"
                    : isTo
                      ? "bg-green-500 ring-2 ring-inset ring-blue-300 hover:bg-green-400"
                      : `${COURT_GREEN} ${COURT_GREEN_HOVER}`
                }`}
                title={`${COL_LABELS[dataCol]} ${ROW_LABELS[dataRow].toLowerCase()}`}
              >
                {isFrom ? "F" : isTo ? "T" : ""}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export function CourtZoneGrid({
  zoneFrom,
  zoneTo,
  onZoneClick,
}: CourtZoneGridProps) {
  return (
    <div className="flex flex-col gap-0">
      <ZoneGrid
        side="opponent"
        label="Opponent side"
        zoneFrom={zoneFrom}
        zoneTo={zoneTo}
        onZoneClick={onZoneClick}
      />
      <ZoneGrid
        side="me"
        label="My side"
        zoneFrom={zoneFrom}
        zoneTo={zoneTo}
        onZoneClick={onZoneClick}
      />
    </div>
  );
}
