"use client";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  type TooltipContentProps,
} from "recharts";

/** Fallback hex when color is a name (legacy); prefer passing design-system hex from SHOT_TYPE_HEX */
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

function resolveFill(color: string): string {
  return color.startsWith("#") ? color : COLOR_HEX[color] ?? COLOR_HEX.slate;
}

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
        <p className="text-sm text-text-soft">No data</p>
      </div>
    );
  }

  return (
    <div className={className ?? ""} style={{ width: "100%", height: "100%", minHeight: "12rem" }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 8, left: 8, right: 8, bottom: 8 }}>
          {showLabel && total > 0 && (
            <text
              x="50%"
              y="50%"
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-zinc-700 dark:fill-zinc-200"
              style={{ fontSize: "0.875rem", fontWeight: 500 }}
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
            innerRadius="78%"
            outerRadius="85%"
            cornerRadius="50%"
            paddingAngle={5}      // gap between slices
            stroke=""
            startAngle={90}
            endAngle={-270}
          >
            {pieData.map((entry, i) => (
              <Cell
                key={`cell-${i}`}
                fill={resolveFill(entry.color)}
              />
            ))}
          </Pie>
          <Tooltip
            isAnimationActive={false}
            animationDuration={120}
            animationEasing="ease-out"
            wrapperStyle={{ outline: "none" }}
            content={
              CustomTooltip
                ? (props: TooltipContentProps<number, string>) => {
                    const payload = props.payload?.map((p) => ({
                      name: p.name ?? "",
                      value: p.value as number,
                      color: (p.payload as { color?: string } | undefined)?.color,
                    }));
                    return (
                      <CustomTooltip
                        active={props.active}
                        payload={payload}
                        label={props.label != null ? String(props.label) : undefined}
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
