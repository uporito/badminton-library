"use client";

import { zoneEnum } from "@/db/schema";
import type { Zone, Side } from "@/db/schema";

const ROW_LABELS = ["Front", "Mid", "Back"];
const COL_LABELS = ["Left", "Center", "Right"];

function zoneAt(row: number, col: number): Zone {
  return zoneEnum[row * 3 + col];
}

interface CourtZoneGridProps {
  zoneFrom: { side: Side; zone: Zone } | null;
  zoneTo: { side: Side; zone: Zone } | null;
  onZoneClick: (side: Side, zone: Zone) => void;
}

const COURT_GREEN = "bg-green-700";
const COURT_GREEN_HOVER = "hover:bg-green-600";
const COURT_LINE = "border border-green-800";

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
      <div className="grid grid-cols-3 gap-0">
        {[0, 1, 2].map((row) =>
          [0, 1, 2].map((col) => {
            const zone = zoneAt(row, col);
            const isFrom =
              zoneFrom?.side === side && zoneFrom?.zone === zone;
            const isTo = zoneTo?.side === side && zoneTo?.zone === zone;
            return (
              <button
                key={zone}
                type="button"
                onClick={() => onZoneClick(side, zone)}
                className={`flex h-9 w-9 items-center justify-center text-xs text-white sm:h-10 sm:w-10 ${COURT_LINE} ${
                  isFrom
                    ? "bg-green-600 ring-2 ring-inset ring-white hover:bg-green-500"
                    : isTo
                      ? "bg-green-500 ring-2 ring-inset ring-blue-300 hover:bg-green-400"
                      : `${COURT_GREEN} ${COURT_GREEN_HOVER}`
                }`}
                title={`${COL_LABELS[col]} ${ROW_LABELS[row].toLowerCase()}`}
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
    <div className="flex flex-wrap gap-6">
      <ZoneGrid
        side="me"
        label="My side"
        zoneFrom={zoneFrom}
        zoneTo={zoneTo}
        onZoneClick={onZoneClick}
      />
      <ZoneGrid
        side="opponent"
        label="Opponent side"
        zoneFrom={zoneFrom}
        zoneTo={zoneTo}
        onZoneClick={onZoneClick}
      />
    </div>
  );
}
