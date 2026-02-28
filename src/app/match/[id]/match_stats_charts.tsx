"use client";

import {
  DonutChart,
  BarChart,
} from "@tremor/react";
import {
  aggregateShotDistribution,
  aggregateOutcomesByShotType,
  aggregateZoneCounts,
  SHOT_TYPE_LABELS,
  SHOT_TYPE_COLORS,
  SHOT_TYPE_ORDER,
  OUTCOME_ORDER,
  OUTCOME_COLORS,
  type ShotForStats,
} from "@/lib/shot_chart_utils";
import { ZoneHeatmaps } from "./zone_heatmap_grid";

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
}

export function MatchStatsCharts({ shots }: MatchStatsChartsProps) {
  const distribution = aggregateShotDistribution(shots);
  const outcomesByType = aggregateOutcomesByShotType(shots);
  const gridMe = aggregateZoneCounts(shots, "me");
  const gridOpponent = aggregateZoneCounts(shots, "opponent");

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
      <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
        Shot stats
      </h2>

      {/* Consistent shot-type color legend (bright on white) */}
      <ShotTypeLegend />

      {shots.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No shots yet. Add shots in the panel to see charts.
        </p>
      ) : (
        <>
          <div>
            <h3 className="mb-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Shot distribution
            </h3>
            <DonutChart
              data={donutData}
              category="count"
              index="label"
              colors={donutColors}
              valueFormatter={(v) => v.toString()}
              showLabel
              className="h-48"
            />
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

          <div>
            <h3 className="mb-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Zone heatmaps (from zone)
            </h3>
            <ZoneHeatmaps gridMe={gridMe} gridOpponent={gridOpponent} />
          </div>
        </>
      )}
    </div>
  );
}
