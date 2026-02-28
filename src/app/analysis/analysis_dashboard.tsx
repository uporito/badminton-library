"use client";

import { useState, useEffect } from "react";
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

export function AnalysisDashboard({ matches }: AnalysisDashboardProps) {
  const [selectedMatchIds, setSelectedMatchIds] = useState<Set<number>>(
    () => new Set(matches.map((m) => m.id))
  );
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
      .then((raw: { shotType: string; outcome: string; player: string; zoneFrom: string; zoneTo: string }[]) => {
        setShots(
          raw.map((s) => ({
            shotType: s.shotType,
            outcome: s.outcome,
            player: s.player,
            zoneFrom: s.zoneFrom,
            zoneTo: s.zoneTo,
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
      <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          Matches to include
        </h2>
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
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
      </section>

      {loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading shots…</p>
      ) : (
        <MatchStatsCharts shots={shots} />
      )}

      <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          Match timeline
        </h2>
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          Played matches (newest first).
        </p>
        <ul className="space-y-2">
          {sortedMatches.length === 0 ? (
            <li className="text-sm text-zinc-500 dark:text-zinc-400">
              No matches yet.
            </li>
          ) : (
            sortedMatches.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-zinc-100 pb-2 last:border-0 last:pb-0 dark:border-zinc-800"
              >
                <span className="text-xs font-medium tabular-nums text-zinc-500 dark:text-zinc-400">
                  {m.date ?? "—"}
                </span>
                <a
                  href={`/match/${m.id}`}
                  className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                >
                  {m.title}
                </a>
                {m.opponent && (
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    vs {m.opponent}
                  </span>
                )}
                {m.result && (
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {m.result}
                  </span>
                )}
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
