"use client";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  type TooltipProps,
} from "recharts";

/** Hex fills for Recharts (Tailwind 500 equivalents) */
const COLOR_HEX: Record<string, string> = {
  blue: "#3b82f0",
  cyan: "#06b6d4",
  rose: "#f43f5e",
  violet: "#8b5cf6",
  amber: "#f59e0b",
  emerald: "#10b981",
  pink: "#ec4899",
  slate: "#64748b",
};

export interface DonutChartDataItem {
  label: string;
  count: number;
}

export interface DonutTooltipProps {
  active?: boolean;
  payload?: { name: string; value: number; color?: string }[];
  label?: string;
  valueFormatter?: (value: number) => string;
}

interface DonutChartProps {
  data: DonutChartDataItem[];
  category?: string;
  index?: string;
  colors: string[];
  valueFormatter?: (value: number) => string;
  showLabel?: boolean;
  customTooltip?: React.ComponentType<DonutTooltipProps>;
  className?: string;
}

export function DonutChart({
  data,
  category = "count",
  index = "label",
  colors,
  valueFormatter = (v) => String(v),
  showLabel = true,
  customTooltip: CustomTooltip,
  className,
}: DonutChartProps) {
  const valueKey = category;
  const nameKey = index;

  const pieData = data.map((item, i) => {
    const record = item as unknown as Record<string, unknown>;
    return {
      name: record[nameKey] as string,
      value: record[valueKey] as number,
      color: colors[i] ?? "slate",
    };
  });

  const total = pieData.reduce((sum, d) => sum + d.value, 0);

  if (data.length === 0) {
    return (
      <div
        className={`flex min-h-[12rem] items-center justify-center rounded-lg border border-dashed border-zinc-200 dark:border-zinc-700 ${className ?? ""}`}
      >
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No data</p>
      </div>
    );
  }

  return (
    <div className={className ?? ""} style={{ width: "100%", height: "100%", minHeight: "12rem" }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 0, left: 0, right: 0, bottom: 0 }}>
          {showLabel && total > 0 && (
            <text
              x="50%"
              y="50%"
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-zinc-700 dark:fill-zinc-200"
              style={{ fontSize: "1rem", fontWeight: 500 }}
            >
              {total}
            </text>
          )}
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius="75%"
            outerRadius="100%"
            paddingAngle={0}
            stroke=""
            startAngle={90}
            endAngle={-270}
          >
            {pieData.map((entry, i) => (
              <Cell
                key={`cell-${i}`}
                fill={COLOR_HEX[entry.color] ?? COLOR_HEX.slate}
              />
            ))}
          </Pie>
          <Tooltip
            wrapperStyle={{ outline: "none" }}
            content={
              CustomTooltip
                ? (props: TooltipProps<number, string>) => {
                    const payload = props.payload?.map((p) => ({
                      name: p.name ?? "",
                      value: p.value as number,
                      color: (p.payload as { color?: string } | undefined)?.color,
                    }));
                    return (
                      <CustomTooltip
                        active={props.active}
                        payload={payload}
                        label={props.label}
                        valueFormatter={valueFormatter}
                      />
                    );
                  }
                : undefined
            }
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
