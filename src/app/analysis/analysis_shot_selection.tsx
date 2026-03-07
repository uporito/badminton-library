"use client";

import { DonutChart } from "@/components/donut_chart";
import { DonutTooltip } from "@/components/shot_chart_shared";
import {
  aggregateShotDistribution,
  SHOT_TYPE_HEX,
  SHOT_TYPE_LABELS,
  SHOT_TYPE_ORDER,
  type ShotForStats,
} from "@/lib/shot_chart_utils";

interface AnalysisShotSelectionProps {
  shots: ShotForStats[];
  /** Optional class for the root wrapper */
  className?: string;
}

/**
 * Dashboard-only shot selection donut chart. Renders a compact donut + legend
 * for the analysis dashboard. Evolve this component independently of the match page.
 */
export function AnalysisShotSelection({ shots, className }: AnalysisShotSelectionProps) {
  const distribution = aggregateShotDistribution(shots);
  const donutData = distribution.map((d) => ({
    shotType: d.shotType,
    count: d.count,
    label: d.label,
  }));
  const donutColors = distribution.map(
    (d) => SHOT_TYPE_HEX[d.shotType as keyof typeof SHOT_TYPE_HEX]
  );

  return (
    <div
      className={`flex min-h-0 flex-1 flex-row items-stretch gap-4 ${className ?? ""}`}
    >
      <div className="min-h-0 min-w-0 flex-1 flex flex-col">
        <div className="min-h-[8rem] flex-1">
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
            className="h-full min-h-[8rem]"
          />
        </div>
      </div>
      <div className="flex shrink-0 flex-col justify-center gap-1.5 text-xs text-text-soft">
        {SHOT_TYPE_ORDER.map((t) => (
          <span key={t} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: SHOT_TYPE_HEX[t] }}
              aria-hidden
            />
            <span className="text-text-main">
              {SHOT_TYPE_LABELS[t]}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
