"use client";

import { useState, useEffect, useMemo } from "react";
import { CircleNotchIcon, CalendarBlankIcon } from "@phosphor-icons/react";
import { Court3D } from "@/app/analysis/court_3d";
import { AnalysisShotSelection } from "@/app/analysis/analysis_shot_selection";
import { AnalysisOutcomesChart } from "@/app/analysis/analysis_outcomes_chart";
import {
  type ShotForStats,
  getMostPlayedShotByCourt,
  filterShotsByCourtRow,
  type CourtRow,
} from "@/lib/shot_chart_utils";

type MatchRow = {
  id: number;
  title: string;
  date: string | null;
  opponent: string | null;
  result: string | null;
};

interface AnalysisDashboardProps {
  matches: MatchRow[];
}

const WEEKS_IN_YEAR = 52;
const DAYS_PER_WEEK = 7;
const TOTAL_DAYS = WEEKS_IN_YEAR * DAYS_PER_WEEK;

const GRID_COLOR_EMPTY = "#f4f4f5";
const GRID_COLOR_FULL = "#15803d";

function interpolateHex(hexFrom: string, hexTo: string, t: number): string {
  const parse = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff] as const;
  };
  const [r1, g1, b1] = parse(hexFrom);
  const [r2, g2, b2] = parse(hexTo);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
}

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function ordinal(n: number): string {
  const s = n % 100;
  if (s >= 11 && s <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

function formatLongDate(date: Date): string {
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  const month = date.toLocaleDateString("en-US", { month: "long" });
  return `${weekday}, ${month} ${ordinal(date.getDate())}, ${date.getFullYear()}`;
}

type AnalysisTab = "global" | "shot-patterns" | "shot-analysis";

const TABS: { id: AnalysisTab; label: string }[] = [
  { id: "global", label: "Global Analysis" },
  { id: "shot-patterns", label: "Shot Patterns" },
  { id: "shot-analysis", label: "Shot Analysis" },
];

interface MatchTimelineGridProps {
  matches: MatchRow[];
}

type GridTooltipState = { dateKey: string; x: number; y: number } | null;

function MatchTimelineGrid({ matches }: MatchTimelineGridProps) {
  const countByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of matches) {
      if (!m.date) continue;
      const key = m.date.slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
        map[key] = (map[key] ?? 0) + 1;
      }
    }
    return map;
  }, [matches]);

  const matchesByDate = useMemo(() => {
    const map: Record<string, MatchRow[]> = {};
    for (const m of matches) {
      if (!m.date) continue;
      const key = m.date.slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
        if (!map[key]) map[key] = [];
        map[key].push(m);
      }
    }
    return map;
  }, [matches]);

  const [hoveredCell, setHoveredCell] = useState<GridTooltipState>(null);
  const maxCount = Math.max(1, ...Object.values(countByDate));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = (() => {
    const first = addDays(today, -TOTAL_DAYS + 1);
    const d = first.getDay();
    return addDays(first, -(d === 0 ? 6 : d - 1));
  })();

  const monthLabels = Array.from({ length: WEEKS_IN_YEAR }, (_, c) => {
    const date = addDays(startDate, c * DAYS_PER_WEEK);
    const month = date.getMonth();
    const prevDate = c > 0 ? addDays(startDate, (c - 1) * DAYS_PER_WEEK) : null;
    const isFirstOfMonth = prevDate === null || prevDate.getMonth() !== month;
    return isFirstOfMonth
      ? date.toLocaleString("en-US", { month: "short" }).toUpperCase()
      : null;
  });

  const dayLabelSlots = [null, "Mon", null, "Wed", null, "Fri", null, "Sun"] as const;

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[auto_1fr] gap-2 items-stretch">
        <div className="flex flex-col justify-between text-xs text-zinc-400">
          {dayLabelSlots.map((label, i) => (
            <span key={i} className="leading-none" aria-hidden>
              {label ?? "\u00A0"}
            </span>
          ))}
        </div>
        <div
          className="min-w-0 overflow-x-auto p-0.5"
          onMouseLeave={() => setHoveredCell(null)}
        >
          {hoveredCell != null && (() => {
            const dayMatches = matchesByDate[hoveredCell.dateKey] ?? [];
            const date = new Date(hoveredCell.dateKey);
            return (
              <div
                className="frame-glass pointer-events-none fixed z-50 max-w-sm rounded-xl px-4 py-3 text-xs shadow-lg"
                style={{ left: hoveredCell.x + 12, top: hoveredCell.y + 12 }}
              >
                <p className="font-medium text-zinc-100">
                  {formatLongDate(date)}
                </p>
                <ul className="mt-2 space-y-1 border-t border-zinc-600 pt-2">
                  {dayMatches.length === 0 ? (
                    <li className="text-zinc-400">No matches played</li>
                  ) : (
                    dayMatches.map((m) => (
                      <li key={m.id} className="text-zinc-300">
                        <a href={`/match/${m.id}`} className="hover:underline">
                          {m.title}
                          {m.opponent ? ` vs ${m.opponent}` : ""}
                          {m.result ? ` ${m.result}` : ""}
                        </a>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            );
          })()}
          <div
            className="grid w-full min-w-[320px] gap-x-1 text-xs text-zinc-400"
            style={{
              gridTemplateColumns: `repeat(${WEEKS_IN_YEAR}, minmax(0, 1fr))`,
            }}
          >
            {monthLabels.map((label, c) => (
              <div key={c} className="pb-0.5 leading-none">
                {label}
              </div>
            ))}
          </div>
          <div
            className="grid w-full min-w-[320px] gap-0.5 rounded-[1px] mt-0.5"
            style={{
              gridTemplateColumns: `repeat(${WEEKS_IN_YEAR}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${DAYS_PER_WEEK}, minmax(0, 1fr))`,
              aspectRatio: `${WEEKS_IN_YEAR} / ${DAYS_PER_WEEK}`,
            }}
          >
            {Array.from({ length: DAYS_PER_WEEK * WEEKS_IN_YEAR }, (_, i) => {
              const row = Math.floor(i / WEEKS_IN_YEAR);
              const col = i % WEEKS_IN_YEAR;
              const dayIndex = col * DAYS_PER_WEEK + row;
              const date = addDays(startDate, dayIndex);
              const dateKey = toDateString(date);
              const count = countByDate[dateKey] ?? 0;
              const t = maxCount > 0 ? Math.min(1, count / maxCount) : 0;
              const bg =
                count === 0
                  ? undefined
                  : interpolateHex(GRID_COLOR_EMPTY, GRID_COLOR_FULL, t);
              const isHovered = hoveredCell?.dateKey === dateKey;
              return (
                <div
                  key={`${col}-${row}`}
                  className={`min-h-0 min-w-0 rounded-[1px] ${count === 0 ? "bg-zinc-800" : ""} ${isHovered ? "ring-2 ring-accent" : ""}`}
                  style={bg != null ? { backgroundColor: bg } : undefined}
                  onMouseEnter={(e) =>
                    setHoveredCell({
                      dateKey,
                      x: e.clientX,
                      y: e.clientY,
                    })
                  }
                />
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <span>Less</span>
        <div className="flex gap-0.5">
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <div
              key={t}
              className={`h-[8px] w-[8px] rounded-[1px] ${t === 0 ? "bg-zinc-800" : ""}`}
              style={
                t > 0
                  ? {
                      backgroundColor: interpolateHex(
                        GRID_COLOR_EMPTY,
                        GRID_COLOR_FULL,
                        t
                      ),
                    }
                  : undefined
              }
            />
          ))}
        </div>
        <span>More</span>
      </div>
    </div>
  );
}

const COURT_ROW_LABELS: Record<CourtRow, string> = {
  front: "Front Court",
  mid: "Mid Court",
  back: "Back Court",
};

function MostPlayedShotCard({
  courtRow,
  metric,
  selected,
  onSelect,
  className,
}: {
  courtRow: CourtRow;
  metric: { label: string; percentage: number } | null;
  selected: boolean;
  onSelect: () => void;
  className?: string;
}) {
  const courtLabel = COURT_ROW_LABELS[courtRow];
  const isSelected = selected;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`cursor-pointer rounded-lg px-4 py-3 flex flex-row items-center justify-between gap-4 shadow-lg min-h-0 text-left transition-colors outline-none hover:ring-2 hover:ring-accent focus-visible:ring-2 focus-visible:ring-accent ${className ?? ""} ${
        isSelected
          ? "bg-accent text-zinc-900"
          : "frame-glass text-zinc-400 hover:bg-zinc-700/30"
      }`}
    >
      <div className="flex flex-col justify-center gap-0.5 min-w-0 shrink">
        <span
          className={`text-xs font-normal ${isSelected ? "text-zinc-700" : "text-zinc-500"}`}
        >
          {courtLabel}
        </span>
        <span
          className={`font-normal text-sm ${isSelected ? "text-zinc-900" : "text-zinc-100"}`}
        >
          {metric?.label ?? "—"}
        </span>
      </div>
      <span
        className={`text-4xl font-normal tabular-nums shrink-0 ${isSelected ? "text-zinc-900" : "text-zinc-100"}`}
      >
        {metric != null ? `${metric.percentage} %` : "—"}
      </span>
    </button>
  );
}

export function AnalysisDashboard({ matches }: AnalysisDashboardProps) {
  const [activeTab, setActiveTab] = useState<AnalysisTab>("global");
  const [shots, setShots] = useState<ShotForStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourtRow, setSelectedCourtRow] = useState<CourtRow | null>(
    null
  );

  const filteredShots = useMemo(
    () => filterShotsByCourtRow(shots, selectedCourtRow),
    [shots, selectedCourtRow]
  );

  const mostPlayedByCourt = useMemo(
    () => getMostPlayedShotByCourt(filteredShots),
    [filteredShots]
  );

  function handleCourtCardClick(courtRow: CourtRow) {
    setSelectedCourtRow((prev) => (prev === courtRow ? null : courtRow));
  }

  useEffect(() => {
    setLoading(true);
    fetch("/api/stats/shots")
      .then((res) => (res.ok ? res.json() : []))
      .then((raw: { shotType: string; outcome: string; player: string; zoneFrom: string; zoneTo: string; zoneFromSide: string; zoneToSide: string }[]) => {
        setShots(
          raw.map((s) => ({
            shotType: s.shotType,
            outcome: s.outcome,
            player: s.player,
            zoneFrom: s.zoneFrom,
            zoneTo: s.zoneTo,
            zoneFromSide: s.zoneFromSide,
            zoneToSide: s.zoneToSide,
          })) as ShotForStats[]
        );
      })
      .catch(() => setShots([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="w-full flex flex-col">
      <nav
        className="flex gap-6 border-b border-zinc-700/50 pb-3 mb-5"
        aria-label="Analysis sections"
      >
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`text-sm font-medium transition-colors ${
              activeTab === id
                ? "text-accent border-b-2 border-accent -mb-[11px] pb-3"
                : "text-zinc-400 hover:text-zinc-300"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-0">
        {/* Left: visuals with frame-glass, overlapping court slightly */}
        <div className="relative z-10 flex flex-col gap-6 lg:mr-[-2rem]">
          {/* Top row: 2 cols — left: donut + legend (wider), right: 3 cards */}
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)] gap-5">
            <div className="frame-glass rounded-xl p-5 shadow-lg min-h-0 flex flex-col h-[260px]">
              <h2 className="mb-3 text-xs font-semibold text-zinc-200 shrink-0">
                Shot Selection
              </h2>
              <div className="flex-1 min-h-0">
                {loading ? (
                  <p className="flex items-center gap-2 text-xs text-zinc-400">
                    <CircleNotchIcon
                      className="h-3.5 w-3.5 shrink-0 animate-spin"
                      aria-hidden
                    />
                    Loading…
                  </p>
                ) : (
                  <AnalysisShotSelection
                    shots={filteredShots}
                    className="h-full"
                  />
                )}
              </div>
            </div>
            <div className="flex flex-col gap-3 min-h-0 h-[260px]">
              <p className="text-xs font-semibold text-zinc-200 shrink-0">
                Most played shot from :
              </p>
              <div className="flex flex-col gap-3 flex-1 min-h-0">
                <MostPlayedShotCard
                  courtRow="front"
                  metric={
                    mostPlayedByCourt.front
                      ? {
                          label: mostPlayedByCourt.front.label,
                          percentage: mostPlayedByCourt.front.percentage,
                        }
                      : null
                  }
                  selected={selectedCourtRow === "front"}
                  onSelect={() => handleCourtCardClick("front")}
                  className="flex-1 min-h-0"
                />
                <MostPlayedShotCard
                  courtRow="mid"
                  metric={
                    mostPlayedByCourt.mid
                      ? {
                          label: mostPlayedByCourt.mid.label,
                          percentage: mostPlayedByCourt.mid.percentage,
                        }
                      : null
                  }
                  selected={selectedCourtRow === "mid"}
                  onSelect={() => handleCourtCardClick("mid")}
                  className="flex-1 min-h-0"
                />
                <MostPlayedShotCard
                  courtRow="back"
                  metric={
                    mostPlayedByCourt.back
                      ? {
                          label: mostPlayedByCourt.back.label,
                          percentage: mostPlayedByCourt.back.percentage,
                        }
                      : null
                  }
                  selected={selectedCourtRow === "back"}
                  onSelect={() => handleCourtCardClick("back")}
                  className="flex-1 min-h-0"
                />
              </div>
            </div>
          </div>

          {/* Middle row: outcomes per shot type bar chart */}
          <div className="frame-glass rounded-xl p-5 shadow-lg h-[280px] flex flex-col">
            <h2 className="mb-3 text-xs font-semibold text-zinc-200 shrink-0">
              Outcomes per shot type
            </h2>
            <div className="flex-1 min-h-0">
              {loading ? (
                <p className="flex items-center gap-2 text-xs text-zinc-400">
                  <CircleNotchIcon
                    className="h-3.5 w-3.5 shrink-0 animate-spin"
                    aria-hidden
                  />
                  Loading shots…
                </p>
              ) : (
                <AnalysisOutcomesChart shots={filteredShots} className="h-full" />
              )}
            </div>
          </div>

          {/* Bottom row: match timeline grid */}
          <div className="frame-glass rounded-xl p-5 shadow-lg">
            <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold text-zinc-200">
              <CalendarBlankIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Match timeline
            </h2>
            <MatchTimelineGrid matches={matches} />
          </div>
        </div>

        {/* Right (lg+): court visual, ~half space, no frame, drop shadow */}
        <div
          className="hidden lg:flex items-center justify-center py-6 pl-6"
          style={{ perspective: "800px" }}
        >
          <div
            className="w-full max-w-md flex justify-center"
            style={{
              filter: "drop-shadow(0 20px 25px rgba(0,0,0,0.25))",
            }}
            aria-hidden
          >
            <Court3D
              selectedZone={null}
              highlightedCourtRow={selectedCourtRow}
            />
          </div>
        </div>
      </div>

      {/* Mobile: court below content, no overlap */}
      <div
        className="lg:hidden flex justify-center py-8"
        style={{ perspective: "800px" }}
      >
        <div
          className="flex justify-center"
          style={{
            filter: "drop-shadow(0 20px 25px rgba(0,0,0,0.25))",
          }}
          aria-hidden
        >
          <Court3D
            selectedZone={null}
            highlightedCourtRow={selectedCourtRow}
          />
        </div>
      </div>
    </div>
  );
}
