"use client";

import { useState, useEffect } from "react";

/** Tailwind class names for legend dots by color key (blue, cyan, rose, …) */
export const LEGEND_BG: Record<string, string> = {
  blue: "bg-blue-500",
  cyan: "bg-cyan-500",
  rose: "bg-rose-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
  pink: "bg-pink-500",
  slate: "bg-slate-500",
};

/** Hex colors for outcome bars: winner=green, error=red, neither=zinc-300 */
export const OUTCOME_HEX: Record<string, string> = {
  Winner: "#22c55e",
  Error: "#ef4444",
  Neither: "#d4d4d8",
};

export const OUTCOME_ORDER_TOOLTIP = ["Winner", "Error", "Neither"] as const;

/** Dark mode-aware fill for bar chart tooltip cursor */
export const BAR_CURSOR_FILL = {
  light: "rgba(0, 0, 0, 0.06)",
  dark: "rgba(39, 39, 42, 0.75)",
} as const;

export function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const check = () => setIsDark(el.classList.contains("dark"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

export type BarDataItem = {
  label: string;
  Winner: number;
  Error: number;
  Neither: number;
  _total: number;
};

interface OutcomeBarTooltipProps {
  active?: boolean;
  payload?: readonly unknown[] | unknown[];
  label?: string | number;
  data: BarDataItem[];
}

export function OutcomeBarTooltip({
  active,
  payload,
  label,
  data,
}: OutcomeBarTooltipProps) {
  if (!active || !payload) return null;
  const labelStr = label != null ? String(label) : undefined;
  const selectedItem = data.find((item) => item.label === labelStr);
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
    <div className="frame-glass w-60 -translate-y-5 rounded-xl px-4 py-3 text-xs shadow-lg">
      <p className="flex items-center justify-between">
        <span className="font-medium text-zinc-900 dark:text-zinc-100">
          Shot type
        </span>
        <span className="text-zinc-600 dark:text-zinc-400">{labelStr}</span>
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

interface DonutTooltipProps {
  active?: boolean;
  payload?: { name: string; value: number; color?: string }[];
  label?: string;
  valueFormatter?: (value: number) => string;
}

export function DonutTooltip({
  active,
  payload,
  label,
  valueFormatter = (v) => String(v),
}: DonutTooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const colorKey = item.color ?? "slate";

  return (
    <div className="frame-glass flex w-52 items-center justify-between space-x-4 rounded-xl px-2.5 py-2 text-xs shadow-lg">
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
