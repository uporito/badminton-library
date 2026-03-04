"use client";

import { useState, useEffect, useMemo } from "react";
import {
  CaretDownIcon,
  CaretUpIcon,
  ChartLineUpIcon,
  CircleNotchIcon,
  ListChecksIcon,
  CalendarBlankIcon,
} from "@phosphor-icons/react";
import { MatchStatsCharts } from "@/app/match/[id]/match_stats_charts";
import type { ShotForStats } from "@/lib/shot_chart_utils";

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
const TOTAL_DAYS = WEEKS_IN_YEAR * DAYS_PER_WEEK; // 364

/** Light (no games) -> deep green (most games) */
const GRID_COLOR_EMPTY = "#f4f4f5"; /* zinc-100 */
const GRID_COLOR_FULL = "#15803d"; /* green-700 */

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

  const maxCount = Math.max(
    1,
    ...Object.values(countByDate)
  );

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

  const dayLabelSlots = [
    null,
    "Mon",
    null,
    "Wed",
    null,
    "Fri",
    null,
    "Sun",
  ] as const;

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[auto_1fr] gap-2 items-stretch">
        <div className="flex flex-col justify-between text-xs text-zinc-500 dark:text-zinc-400">
          {dayLabelSlots.map((label, i) => (
            <span
              key={i}
              className="leading-none"
              aria-hidden
            >
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
                className="pointer-events-none fixed z-50 max-w-sm rounded-lg border border-zinc-200 bg-white px-4 py-3 text-xs shadow-md transition-[left_0.15s_ease-out,top_0.15s_ease-out] dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-md"
                style={{
                  left: hoveredCell.x + 12,
                  top: hoveredCell.y + 12,
                }}
              >
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {formatLongDate(date)}
                </p>
                <ul className="mt-2 space-y-1 border-t border-zinc-200 pt-2 dark:border-zinc-700">
                  {dayMatches.length === 0 ? (
                    <li className="text-zinc-600 dark:text-zinc-400">
                      No matches played
                    </li>
                  ) : (
                    dayMatches.map((m) => (
                      <li
                        key={m.id}
                        className="text-zinc-700 dark:text-zinc-300"
                      >
                        <a
                          href={`/match/${m.id}`}
                          className="hover:underline"
                        >
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
            className="grid w-full min-w-[520px] gap-x-1 text-xs text-zinc-500 dark:text-zinc-400"
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
            className="grid w-full min-w-[520px] gap-1 rounded-[1px] mt-0.5"
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
                  className={`min-h-0 min-w-0 rounded-[1px] ${count === 0 ? "bg-zinc-100 dark:bg-zinc-800" : ""} ${isHovered ? "ring-2 ring-zinc-400 dark:ring-zinc-500" : ""}`}
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
      <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span>Less</span>
        <div className="flex gap-1">
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <div
              key={t}
              className={`h-[10px] w-[10px] rounded-[1px] ${t === 0 ? "bg-zinc-100 dark:bg-zinc-800" : ""}`}
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

export function AnalysisDashboard({ matches }: AnalysisDashboardProps) {
  const [selectedMatchIds, setSelectedMatchIds] = useState<Set<number>>(
    () => new Set(matches.map((m) => m.id))
  );
  const [matchesSectionCollapsed, setMatchesSectionCollapsed] = useState(true);
  const [shots, setShots] = useState<ShotForStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const ids = Array.from(selectedMatchIds);
    const query =
      ids.length === 0
        ? "?matchIds="
        : ids.length === matches.length
          ? ""
          : `?matchIds=${ids.join(",")}`;
    fetch(`/api/stats/shots${query}`)
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
  }, [selectedMatchIds, matches.length]);

  const toggleMatch = (id: number) => {
    setSelectedMatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => setSelectedMatchIds(new Set(matches.map((m) => m.id)));
  const selectNone = () => setSelectedMatchIds(new Set());

  const sortedMatches = [...matches].sort((a, b) => {
    const da = a.date ?? "";
    const db = b.date ?? "";
    return db.localeCompare(da);
  });

  return (
    <div className="space-y-8">
      <h1 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        <ChartLineUpIcon className="h-7 w-7 shrink-0" aria-hidden />
        Analysis
      </h1>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            <ListChecksIcon className="h-4 w-4 shrink-0" aria-hidden />
            Matches to include
          </h2>
          <button
            type="button"
            onClick={() => setMatchesSectionCollapsed((c) => !c)}
            className="shrink-0 rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            aria-expanded={!matchesSectionCollapsed}
            aria-label={matchesSectionCollapsed ? "Expand matches section" : "Collapse matches section"}
          >
            {matchesSectionCollapsed ? (
              <CaretDownIcon className="h-4 w-4" aria-hidden />
            ) : (
              <CaretUpIcon className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
        {!matchesSectionCollapsed && (
          <>
            <p className="mb-3 mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              By default all matches are included. Toggle to limit analysis to selected matches.
            </p>
            <div className="mb-2 flex gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="rounded border border-zinc-300 bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                All
              </button>
              <button
                type="button"
                onClick={selectNone}
                className="rounded border border-zinc-300 bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                None
              </button>
            </div>
            <ul className="max-h-48 space-y-1 overflow-y-auto">
              {sortedMatches.map((m) => (
                <li key={m.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`match-${m.id}`}
                    checked={selectedMatchIds.has(m.id)}
                    onChange={() => toggleMatch(m.id)}
                    className="h-4 w-4 rounded border-zinc-300 text-zinc-600 focus:ring-zinc-500"
                  />
                  <label
                    htmlFor={`match-${m.id}`}
                    className="cursor-pointer text-sm text-zinc-700 dark:text-zinc-300"
                  >
                    {m.date ?? "—"} · {m.title}
                    {m.opponent ? ` vs ${m.opponent}` : ""}
                    {m.result ? ` (${m.result})` : ""}
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <CircleNotchIcon
            className="h-4 w-4 shrink-0 animate-spin"
            aria-hidden
          />
          Loading shots…
        </p>
      ) : (
        <MatchStatsCharts shots={shots} />
      )}

      <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          <CalendarBlankIcon className="h-4 w-4 shrink-0" aria-hidden />
          Match timeline
        </h2>
        <MatchTimelineGrid matches={matches} />
      </section>
    </div>
  );
}