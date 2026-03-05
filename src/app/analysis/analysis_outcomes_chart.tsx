"use client";

import {
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  BarStack,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  OutcomeBarTooltip,
  useIsDark,
  OUTCOME_HEX,
  BAR_CURSOR_FILL,
  type BarDataItem,
} from "@/components/shot_chart_shared";
import {
  aggregateOutcomesByShotType,
  type ShotForStats,
} from "@/lib/shot_chart_utils";

const barCategories = ["Winner", "Error", "Neither"];

interface AnalysisOutcomesChartProps {
  shots: ShotForStats[];
  /** Optional class for the root wrapper */
  className?: string;
}

/**
 * Dashboard-only outcomes-by-shot-type bar chart. Renders a compact stacked bar
 * for the analysis dashboard. Evolve this component independently of the match page.
 */
export function AnalysisOutcomesChart({
  shots,
  className,
}: AnalysisOutcomesChartProps) {
  const isDark = useIsDark();
  const outcomesByType = aggregateOutcomesByShotType(shots);

  const barData: BarDataItem[] = outcomesByType
    .map((row) => ({
      label: row.label,
      Winner: row.winner,
      Error: row.error,
      Neither: row.neither,
      _total: row.winner + row.error + row.neither,
    }))
    .sort((a, b) => b._total - a._total);

  return (
    <div className={`h-32 w-full ${className ?? ""}`}>
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
              fill: isDark ? BAR_CURSOR_FILL.dark : BAR_CURSOR_FILL.light,
            }}
            content={(props) => (
              <OutcomeBarTooltip {...props} data={barData} />
            )}
          />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            formatter={(value) => value}
          />
          <BarStack radius={[4, 4, 0, 0]}>
            {barCategories.map((key) => (
              <Bar
                key={key}
                dataKey={key}
                stackId="a"
                fill={OUTCOME_HEX[key]}
                barSize={5}
              />
            ))}
          </BarStack>
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
