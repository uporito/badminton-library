"use client";

import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { CalendarBlankIcon } from "@phosphor-icons/react";

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

export interface MatchTimelineMatch {
  id: number;
  title: string;
  date: string | null;
  opponents: { id: number; name: string }[];
  result: string | null;
}

export interface MatchTimelineProps {
  matches: MatchTimelineMatch[];
}

type GridTooltipState = { dateKey: string; x: number; y: number } | null;

export function MatchTimeline({ matches }: MatchTimelineProps) {
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
    const map: Record<string, MatchTimelineMatch[]> = {};
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
        <div className="flex flex-col justify-between text-xs text-text-soft">
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
          {hoveredCell != null &&
            typeof document !== "undefined" &&
            createPortal(
              (() => {
                const dayMatches = matchesByDate[hoveredCell!.dateKey] ?? [];
                const date = new Date(hoveredCell!.dateKey);
                return (
                  <div
                    className="frame-glass pointer-events-none fixed z-[100] max-w-sm rounded-xl px-4 py-3 text-xs shadow-lg"
                    style={{
                      left: hoveredCell!.x + 12,
                      top: hoveredCell!.y + 12,
                    }}
                  >
                    <p className="font-medium text-text-main">
                      {formatLongDate(date)}
                    </p>
                    <ul className="mt-2 space-y-1 border-t border-zinc-600 pt-2">
                      {dayMatches.length === 0 ? (
                        <li className="text-text-main">No matches played</li>
                      ) : (
                        dayMatches.map((m) => (
                          <li key={m.id} className="text-text-main">
                            <a
                              href={`/match/${m.id}`}
                              className="hover:underline"
                            >
                              {m.title}
                              {m.opponents.length > 0 ? ` vs ${m.opponents.map((o) => o.name).join(", ")}` : ""}
                              {m.result ? ` ${m.result}` : ""}
                            </a>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                );
              })(),
              document.body
            )}
          <div
            className="grid w-full min-w-[320px] gap-x-1 text-xs text-text-soft"
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
                  className={`min-h-0 min-w-0 rounded-[1px] ${count === 0 ? "bg-ui-elevated" : ""} ${isHovered ? "ring-2 ring-accent" : ""}`}
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
      <div className="flex items-center gap-2 text-xs text-text-soft">
        <span>Less</span>
        <div className="flex gap-0.5">
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <div
              key={t}
              className={`h-[8px] w-[8px] rounded-[1px] ${t === 0 ? "bg-ui-elevated" : ""}`}
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

export function MatchTimelinePanel({ matches }: MatchTimelineProps) {
  return (
    <div className="pointer-events-auto frame relative rounded-xl p-5">
      <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold text-text-main">
        <CalendarBlankIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Match Timeline
      </h2>
      <MatchTimeline matches={matches} />
    </div>
  );
}
