"use client";

import { useState } from "react";
import { DonutChart } from "@/components/donut_chart";
import {
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  OutcomeBarTooltip,
  DonutTooltip,
  useIsDark,
  LEGEND_BG,
  OUTCOME_HEX,
  BAR_CURSOR_FILL,
  type BarDataItem,
} from "@/components/shot_chart_shared";
import {
  aggregateShotDistribution,
  aggregateOutcomesByShotType,
  aggregateZoneToCountsBySide,
  aggregateZoneFromCountsBySide,
  SHOT_TYPE_LABELS,
  SHOT_TYPE_COLORS,
  SHOT_TYPE_ORDER,
  type ShotForStats,
} from "@/lib/shot_chart_utils";
import { ZoneHeatmaps, type SelectedZone } from "./zone_heatmap_grid";
import type { Side, Zone } from "@/db/schema";

export type PlayerFilter = "me" | "opponent" | "both";

const barCategories = ["Winner", "Error", "Neither"];

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
  playerFilter?: PlayerFilter;
  onPlayerFilterChange?: (value: PlayerFilter) => void;
  selectedZone?: SelectedZone;
  onZoneClick?: (side: Side, zone: Zone) => void;
  className?: string;
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
  selectedZone,
  onZoneClick,
  className,
}: MatchStatsChartsProps) {
  const isDark = useIsDark();
  const [internalFilter, setInternalFilter] = useState<PlayerFilter>("me");
  const playerFilter = controlledFilter ?? internalFilter;
  const setPlayerFilter = onPlayerFilterChange ?? setInternalFilter;

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

  const barData: BarDataItem[] = outcomesByType
    .map((row) => ({
      label: row.label,
      Winner: row.winner,
      Error: row.error,
      Neither: row.neither,
      _total: row.winner + row.error + row.neither,
    }))
    .sort((a, b) => b._total - a._total);

  const emptyMessage =
    shots.length === 0
      ? "No shots yet. Add shots in the panel to see charts."
      : "No shots by the selected player(s).";

  return (
    <div
      className={`space-y-6 p-4 frame-glass rounded-xl ${className ?? ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          Shot stats
        </h2>
        <PlayerFilterSelect value={playerFilter} onChange={setPlayerFilter} />
      </div>

      <ShotTypeLegend />

      {filteredShots.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {emptyMessage}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-stretch">
            <div className="flex min-h-0 flex-col sm:col-span-2">
              <h2 className="mb-3 shrink-0 text-xs font-semibold text-zinc-200">
                Shot distribution
              </h2>
              <div className="min-h-[16rem] flex-1">
                <DonutChart
                  data={donutData}
                  category="count"
                  index="label"
                  colors={donutColors}
                  valueFormatter={(v) => v.toString()}
                  showLabel
                  customTooltip={(props) => (
                    <DonutTooltip
                      {...props}
                      valueFormatter={(v) => v.toString()}
                    />
                  )}
                  className="h-full min-h-[12rem]"
                />
              </div>
            </div>
            <div className="flex min-h-0 flex-col sm:col-span-1">
              <h3 className="mb-3 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Distribution of shots From/To
              </h3>
              <div className="flex min-h-[16rem] flex-1 items-center justify-center">
                <ZoneHeatmaps
                  gridOpponentTo={gridOpponentTo}
                  gridMeFrom={gridMeFrom}
                  selectedZone={selectedZone}
                  onZoneClick={onZoneClick}
                />
              </div>
            </div>
          </div>

          <div className="mt-8">
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart
                  data={barData}
                  margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                  barCategoryGap="80%"
                  stackOffset="none"
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-zinc-200 dark:stroke-zinc-700"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fill: "currentColor" }}
                    className="text-zinc-600 dark:text-zinc-400"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "currentColor" }}
                    className="text-zinc-600 dark:text-zinc-400"
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    tickFormatter={(v) => String(v)}
                  />
                  <Tooltip
                    cursor={{
                      fill: isDark
                        ? BAR_CURSOR_FILL.dark
                        : BAR_CURSOR_FILL.light,
                    }}
                    content={(props) => (
                      <OutcomeBarTooltip {...props} data={barData} />
                    )}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12 }}
                    formatter={(value) => value}
                  />
                  {barCategories.map((key) => (
                    <Bar
                      key={key}
                      dataKey={key}
                      stackId="a"
                      fill={OUTCOME_HEX[key]}
                      maxBarSize={4}
                    />
                  ))}
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
