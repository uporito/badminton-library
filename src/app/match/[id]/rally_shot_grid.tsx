"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
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

function hasAiShots(rally: RallyWithShots): boolean {
  return rally.shots.some((s) => s.source === "ai_suggested");
}

export function RallyShotGrid({ rallies }: RallyShotGridProps) {
  const [hoveredCell, setHoveredCell] = useState<HoverState | null>(null);

  const completedRallies = rallies
    .map((r) => ({ rally: r, shot: getLastDecidingShot(r) }))
    .filter(({ shot }) => shot != null) as { rally: RallyWithShots; shot: ShotRow }[];

  if (completedRallies.length === 0) {
    return (
      <section className="frame rounded-xl p-4">
        <h2 className="mb-3 text-sm font-semibold text-text-main">
          Rally score
        </h2>
        <p className="text-sm text-text-soft">
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
        return "bg-ui-success";
      case "error":
        return "bg-ui-error";
      default:
        return "bg-ui-elevated";
    }
  };

  return (
    <section className="frame rounded-xl p-4">
      <h2 className="mb-3 text-sm font-semibold text-text-main">
        Rally score
      </h2>
      <div
        className="min-w-0 overflow-x-auto p-1"
        onMouseLeave={() => setHoveredCell(null)}
      >
        {hoveredCell != null &&
          typeof document !== "undefined" &&
          createPortal(
            (() => {
              const { rally, shot } = completedRallies[hoveredCell.index];
              const shotTypeLabel = SHOT_TYPE_LABELS[shot.shotType];
              const outcomeLabel = OUTCOME_LABELS[shot.outcome];
              const playerLabel = SIDE_LABELS[shot.player];
              const isAi = hasAiShots(rally);
              return (
                <div
                  className="frame-glass pointer-events-none fixed z-[100] max-w-sm rounded-xl px-4 py-3 text-xs shadow-lg transition-[left_0.15s_ease-out,top_0.15s_ease-out]"
                  style={{
                    left: hoveredCell.x + 12,
                    top: hoveredCell.y + 12,
                  }}
                >
                  <p className="font-medium text-text-main">
                    Rally {hoveredCell.index + 1}
                    {isAi && (
                      <span className="ml-2 rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                        AI
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-text-soft">
                    {rally.shots.length} shots
                  </p>
                  <p className="mt-2 border-t border-ui-elevated-more pt-2 text-text-main">
                    {shotTypeLabel} {outcomeLabel} ({playerLabel})
                  </p>
                </div>
              );
            })(),
            document.body
          )}
        <div
          className="inline-grid gap-1 text-xs text-text-soft"
          style={{
            gridTemplateColumns: `auto repeat(${completedRallies.length}, minmax(1.25rem, 1.25rem))`,
            gridTemplateRows: "auto auto",
          }}
          onMouseMove={(e) => {
            if (hoveredCell != null) {
              setHoveredCell((prev) =>
                prev ? { ...prev, x: e.clientX, y: e.clientY } : null
              );
            }
          }}
        >
          <div className="flex items-center pr-2 font-medium">Me</div>
          {completedRallies.map(({ rally, shot }, i) => {
            const isHovered = hoveredCell?.index === i;
            const isAi = hasAiShots(rally);
            return (
              <div
                key={`me-${i}`}
                className={`h-5 w-5 min-w-5 rounded-sm ${cellClass(getCellColor("me", shot))} ${isAi ? "border border-dashed border-accent/60" : ""} ${isHovered ? "ring-2 ring-zinc-400 dark:ring-zinc-500" : ""}`}
                aria-label={`Rally ${i + 1}, me: ${getCellColor("me", shot)}${isAi ? " (AI)" : ""}`}
                onMouseEnter={(e) =>
                  setHoveredCell({ index: i, x: e.clientX, y: e.clientY })
                }
              />
            );
          })}
          <div className="flex items-center pr-2 font-medium">Opponent</div>
          {completedRallies.map(({ rally, shot }, i) => {
            const isHovered = hoveredCell?.index === i;
            const isAi = hasAiShots(rally);
            return (
              <div
                key={`opp-${i}`}
                className={`h-5 w-5 min-w-5 rounded-sm ${cellClass(getCellColor("opponent", shot))} ${isAi ? "border border-dashed border-accent/60" : ""} ${isHovered ? "ring-2 ring-zinc-400 dark:ring-zinc-500" : ""}`}
                aria-label={`Rally ${i + 1}, opponent: ${getCellColor("opponent", shot)}${isAi ? " (AI)" : ""}`}
                onMouseEnter={(e) =>
                  setHoveredCell({ index: i, x: e.clientX, y: e.clientY })
                }
              />
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-text-soft">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-ui-success" aria-hidden />
          Winner
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-ui-error" aria-hidden />
          Error
        </span>
        {completedRallies.some(({ rally }) => hasAiShots(rally)) && (
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-dashed border-accent/60 bg-ui-elevated" aria-hidden />
            AI suggested
          </span>
        )}
      </div>
    </section>
  );
}