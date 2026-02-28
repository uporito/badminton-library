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

/** Hex colors for outcome bars: winner=green, error=red, neither=zinc-300 (match UI) */
const OUTCOME_HEX: Record<string, string> = {
  Winner: "#22c55e",
  Error: "#ef4444",
  Neither: "#d4d4d8", /* zinc-300 */
};

const OUTCOME_ORDER_TOOLTIP = ["Winner", "Error", "Neither"] as const;

type BarDataItem = {
  label: string;
  Winner: number;
  Error: number;
  Neither: number;
  _total: number;
};

interface OutcomeBarTooltipProps {
  active?: boolean;
  payload?: unknown[];
  label?: string;
  data: BarDataItem[];
}

function OutcomeBarTooltip({
  active,
  payload,
  label,
  data,
}: OutcomeBarTooltipProps) {
  if (!active || !payload) return null;
  const selectedItem = data.find((item) => item.label === label);
  if (!selectedItem || selectedItem._total === 0) return null;

  const items = OUTCOME_ORDER_TOOLTIP.map((outcome) => ({
    outcome,
    value: selectedItem[outcome],
    percentage:
      selectedItem._total > 0
        ? Math.round((selectedItem[outcome] / selectedItem._total) * 100)
        : 0,
  }));

  return (
    <div className="w-60 -translate-y-5 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-md">
      <p className="flex items-center justify-between">
        <span className="font-medium text-zinc-900 dark:text-zinc-100">
          Shot type
        </span>
        <span className="text-zinc-600 dark:text-zinc-400">
          {label}
        </span>
      </p>
      <div className="my-3 border-b border-zinc-200 dark:border-zinc-700" />
      <div className="space-y-1.5">
        {items.map(({ outcome, value, percentage }) => (
          <div key={outcome} className="flex items-center space-x-2.5">
            <span
              className="size-2.5 shrink-0 rounded-sm border-0"
              style={{ backgroundColor: OUTCOME_HEX[outcome] }}
              aria-hidden
            />
            <div className="flex w-full justify-between">
              <span className="text-zinc-700 dark:text-zinc-300">
                {outcome}
              </span>
              <div className="flex items-center space-x-1">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {value}
                </span>
                <span className="text-zinc-600 dark:text-zinc-400">
                  ({percentage}%)
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export type PlayerFilter = "me" | "opponent" | "both";

interface DonutTooltipProps {
  active?: boolean;
  payload?: { name: string; value: number; color?: string }[];
  label?: string;
  valueFormatter?: (value: number) => string;
}

function DonutTooltip({
  active,
  payload,
  label,
  valueFormatter = (v) => String(v),
}: DonutTooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const colorKey = item.color ?? "slate";

  return (
    <div className="flex w-52 items-center justify-between space-x-4 rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-sm shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-md">
      <div className="flex items-center space-x-2 truncate">
        <span
          className={`size-2.5 shrink-0 rounded-sm border-0 ${LEGEND_BG[colorKey] ?? "bg-slate-500"}`}
          aria-hidden
        />
        <p className="truncate text-zinc-600 dark:text-zinc-400">
          {item.name ?? label}
        </p>
      </div>
      <p className="font-medium text-zinc-900 dark:text-zinc-100">
        {valueFormatter(item.value)}
      </p>
    </div>
  );
}

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

  const barData = outcomesByType
    .map((row) => ({
      label: row.label,
      Winner: row.winner,
      Error: row.error,
      Neither: row.neither,
      _total: row.winner + row.error + row.neither,
    }))
    .sort((a, b) => b._total - a._total);
  const barCategories = ["Winner", "Error", "Neither"];

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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-stretch">
            <div className="flex min-h-0 flex-col sm:col-span-2">
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
              <h3 className="mb-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Distribution of shots From/To
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
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart
                  data={barData}
                  margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                  barCategoryGap="70%"
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
                      maxBarSize={8}
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
