"use client";

import { useState } from "react";
import type { RallyWithShots } from "@/lib/get_rallies_by_match_id";
import type { ShotRow } from "@/lib/get_rallies_by_match_id";
import { shotTypeEnum, outcomeEnum, sideEnum } from "@/db/schema";

const SHOT_TYPE_LABELS: Record<(typeof shotTypeEnum)[number], string> = {
  serve: "Serve",
  clear: "Clear",
  smash: "Smash",
  drop: "Drop",
  drive: "Drive",
  lift: "Lift",
  net: "Net",
  block: "Block",
};

const OUTCOME_LABELS: Record<(typeof outcomeEnum)[number], string> = {
  winner: "Winner",
  error: "Error",
  neither: "Neither",
};

const SIDE_LABELS: Record<(typeof sideEnum)[number], string> = {
  me: "Me",
  opponent: "Opponent",
};

interface RallyShotGridProps {
  rallies: RallyWithShots[];
}

type HoverState = { index: number; x: number; y: number };

type CellColor = "winner" | "error" | "neutral";

function getLastDecidingShot(rally: RallyWithShots): ShotRow | null {
  const last = rally.shots.find((s) => s.isLastShotOfRally);
  if (!last || last.outcome === "neither") return null;
  return last;
}

export function RallyShotGrid({ rallies }: RallyShotGridProps) {
  const [hoveredCell, setHoveredCell] = useState<HoverState | null>(null);

  const completedRallies = rallies
    .map((r) => ({ rally: r, shot: getLastDecidingShot(r) }))
    .filter(({ shot }) => shot != null) as { rally: RallyWithShots; shot: ShotRow }[];

  if (completedRallies.length === 0) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          Rally score
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No completed rallies yet. Add shots with Winner or Error to see the grid.
        </p>
      </section>
    );
  }

  const getCellColor = (player: "me" | "opponent", shot: ShotRow): CellColor => {
    if (shot.player !== player) return "neutral";
    return shot.outcome === "winner" ? "winner" : "error";
  };

  const cellClass = (color: CellColor) => {
    switch (color) {
      case "winner":
        return "bg-green-500 dark:bg-green-600";
      case "error":
        return "bg-red-500 dark:bg-red-600";
      default:
        return "bg-zinc-100 dark:bg-zinc-800";
    }
  };

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
        Rally score
      </h2>
      <div
        className="min-w-0 overflow-x-auto p-1"
        onMouseLeave={() => setHoveredCell(null)}
      >
        {hoveredCell != null && (() => {
          const { rally, shot } = completedRallies[hoveredCell.index];
          const shotTypeLabel = SHOT_TYPE_LABELS[shot.shotType];
          const outcomeLabel = OUTCOME_LABELS[shot.outcome];
          const playerLabel = SIDE_LABELS[shot.player];
          return (
            <div
              className="pointer-events-none fixed z-50 max-w-sm rounded-lg border border-zinc-200 bg-white px-4 py-3 text-xs shadow-md transition-[left_0.15s_ease-out,top_0.15s_ease-out] dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-md"
              style={{
                left: hoveredCell.x + 12,
                top: hoveredCell.y + 12,
              }}
            >
              <p className="font-medium text-zinc-900 dark:text-zinc-100">
                Rally {hoveredCell.index + 1}
              </p>
              <p className="mt-0.5 text-zinc-600 dark:text-zinc-400">
                {rally.shots.length} shots
              </p>
              <p className="mt-2 border-t border-zinc-200 pt-2 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                {shotTypeLabel} {outcomeLabel} ({playerLabel})
              </p>
            </div>
          );
        })()}
        <div
          className="inline-grid gap-1 text-xs text-zinc-600 dark:text-zinc-400"
          style={{
            gridTemplateColumns: `auto repeat(${completedRallies.length}, minmax(1.25rem, 1.25rem))`,
            gridTemplateRows: "auto auto",
          }}
        >
          <div className="flex items-center pr-2 font-medium">Me</div>
          {completedRallies.map(({ shot }, i) => {
            const isHovered = hoveredCell?.index === i;
            return (
              <div
                key={`me-${i}`}
                className={`h-5 w-5 min-w-5 rounded-sm ${cellClass(getCellColor("me", shot))} ${isHovered ? "ring-2 ring-zinc-400 dark:ring-zinc-500" : ""}`}
                aria-label={`Rally ${i + 1}, me: ${getCellColor("me", shot)}`}
                onMouseEnter={(e) =>
                  setHoveredCell({ index: i, x: e.clientX, y: e.clientY })
                }
              />
            );
          })}
          <div className="flex items-center pr-2 font-medium">Opponent</div>
          {completedRallies.map(({ shot }, i) => {
            const isHovered = hoveredCell?.index === i;
            return (
              <div
                key={`opp-${i}`}
                className={`h-5 w-5 min-w-5 rounded-sm ${cellClass(getCellColor("opponent", shot))} ${isHovered ? "ring-2 ring-zinc-400 dark:ring-zinc-500" : ""}`}
                aria-label={`Rally ${i + 1}, opponent: ${getCellColor("opponent", shot)}`}
                onMouseEnter={(e) =>
                  setHoveredCell({ index: i, x: e.clientX, y: e.clientY })
                }
              />
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-green-500 dark:bg-green-600" aria-hidden />
          Winner
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-red-500 dark:bg-red-600" aria-hidden />
          Error
        </span>
      </div>
    </section>
  );
}