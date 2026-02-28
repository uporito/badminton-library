"use client";

import { useState } from "react";
import {
  DonutChart,
  BarChart,
} from "@tremor/react";
import {
  aggregateShotDistribution,
  aggregateOutcomesByShotType,
  aggregateZoneToCountsBySide,
  aggregateZoneFromCountsBySide,
  SHOT_TYPE_LABELS,
  SHOT_TYPE_COLORS,
  SHOT_TYPE_ORDER,
  OUTCOME_ORDER,
  OUTCOME_COLORS,
  type ShotForStats,
} from "@/lib/shot_chart_utils";
import { ZoneHeatmaps } from "./zone_heatmap_grid";

export type PlayerFilter = "me" | "opponent" | "both";

const LEGEND_BG: Record<string, string> = {
  blue: "bg-blue-500",
  cyan: "bg-cyan-500",
  rose: "bg-rose-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
  pink: "bg-pink-500",
  slate: "bg-slate-500",
};

function ShotTypeLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
      {SHOT_TYPE_ORDER.map((t) => (
        <span key={t} className="flex items-center gap-1.5">
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${LEGEND_BG[SHOT_TYPE_COLORS[t]] ?? "bg-slate-500"}`}
          />
          <span className="text-zinc-700 dark:text-zinc-300">
            {SHOT_TYPE_LABELS[t]}
          </span>
        </span>
      ))}
    </div>
  );
}

interface MatchStatsChartsProps {
  shots: ShotForStats[];
  /** When provided, the selector is controlled by the parent (e.g. for placing it elsewhere). */
  playerFilter?: PlayerFilter;
  onPlayerFilterChange?: (value: PlayerFilter) => void;
  /** When true and controlled, do not render the selector inside this component (parent renders it). */
  hidePlayerFilter?: boolean;
}

function PlayerFilterSelect({
  value,
  onChange,
  className,
}: {
  value: PlayerFilter;
  onChange: (value: PlayerFilter) => void;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as PlayerFilter)}
      className={`rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-700 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:focus:border-zinc-500 dark:focus:ring-zinc-500 ${className ?? ""}`}
      aria-label="Filter by player"
    >
      <option value="both">Both</option>
      <option value="me">Shots by me</option>
      <option value="opponent">Shots by opponent</option>
    </select>
  );
}

export function MatchStatsCharts({
  shots,
  playerFilter: controlledFilter,
  onPlayerFilterChange,
  hidePlayerFilter = false,
}: MatchStatsChartsProps) {
  const [internalFilter, setInternalFilter] = useState<PlayerFilter>("me");
  const playerFilter = controlledFilter ?? internalFilter;
  const setPlayerFilter =
    onPlayerFilterChange ?? setInternalFilter;
  const showSelector = !hidePlayerFilter;
  const filteredShots =
    playerFilter === "both"
      ? shots
      : shots.filter((s) => s.player === playerFilter);

  const distribution = aggregateShotDistribution(filteredShots);
  const outcomesByType = aggregateOutcomesByShotType(filteredShots);
  const gridOpponentTo = aggregateZoneToCountsBySide(filteredShots, "opponent");
  const gridMeFrom = aggregateZoneFromCountsBySide(filteredShots, "me");

  const donutData = distribution.map((d) => ({
    shotType: d.shotType,
    count: d.count,
    label: d.label,
  }));
  const donutColors = distribution.map(
    (d) => SHOT_TYPE_COLORS[d.shotType as keyof typeof SHOT_TYPE_COLORS]
  );

  const barData = outcomesByType.map((row) => ({
    label: row.label,
    Winner: row.winner,
    Error: row.error,
    Neither: row.neither,
  }));
  const barCategories = ["Winner", "Error", "Neither"];
  const barColors = OUTCOME_ORDER.map((o) => OUTCOME_COLORS[o]);

  return (
    <div className="space-y-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          Shot stats
        </h2>
        {showSelector && (
          <PlayerFilterSelect value={playerFilter} onChange={setPlayerFilter} />
        )}
      </div>

      {/* Consistent shot-type color legend (bright on white) */}
      <ShotTypeLegend />

      {filteredShots.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {shots.length === 0
            ? "No shots yet. Add shots in the panel to see charts."
            : "No shots by the selected player(s)."}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-stretch">
            <div className="flex min-h-0 flex-col">
              <h3 className="mb-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Shot distribution
              </h3>
              <div className="min-h-[16rem] flex-1">
                <DonutChart
                  data={donutData}
                  category="count"
                  index="label"
                  colors={donutColors}
                  valueFormatter={(v) => v.toString()}
                  showLabel
                  className="h-full min-h-[12rem]"
                />
              </div>
            </div>
            <div className="flex min-h-0 flex-col">
              <h3 className="mb-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Court zone heatmaps
              </h3>
              <div className="min-h-[16rem] flex-1 flex items-center">
                <ZoneHeatmaps
                  gridOpponentTo={gridOpponentTo}
                  gridMeFrom={gridMeFrom}
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Outcomes by shot type (winner / error / neither)
            </h3>
            <BarChart
              data={barData}
              index="label"
              categories={barCategories}
              colors={barColors}
              stack
              valueFormatter={(v) => v.toString()}
              showLegend
              className="h-48"
            />
          </div>
        </>
      )}
    </div>
  );
}
