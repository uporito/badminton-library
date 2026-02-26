"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { MatchForm } from "@/app/match_form";
import type { MatchRow } from "@/lib/get_match_by_id";
import type { MatchCategory } from "@/db/schema";

type MatchStat = {
  id: number;
  matchId: number;
  pointIndex: number | null;
  winner: "you" | "opponent" | null;
  isError: boolean | null;
  isWinner: boolean | null;
  shotType: string | null;
  createdAt: Date | null;
};

type Match = {
  id: number;
  title: string;
  videoPath: string;
  durationSeconds: number | null;
  date: string | null;
  opponent: string | null;
  result: string | null;
  notes: string | null;
  category: MatchCategory | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

type MatchWithStats = Match & { stats: MatchStat[] };

interface DebugMatchListProps {
  matches: MatchWithStats[];
  videoFiles: string[];
  inDbButMissing: string[];
  onDiskButNotInDb: string[];
}

export function DebugMatchList({
  matches,
  videoFiles,
  inDbButMissing,
  onDiskButNotInDb,
}: DebugMatchListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<number | null>(null);

  async function handleDelete(id: number) {
    const res = await fetch(`/api/matches/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Delete failed");
      return;
    }
    startTransition(() => router.refresh());
  }

  function handleEditSuccess() {
    setEditingId(null);
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Add match
        </h2>
        <MatchForm mode="create" onSuccess={() => startTransition(() => router.refresh())} />
      </section>

      {editingId !== null && (
        <section>
          <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Edit match
          </h2>
          <MatchForm
            mode="edit"
            initialMatch={matches.find((m) => m.id === editingId) as MatchRow | undefined}
            onSuccess={() => {
              handleEditSuccess();
              startTransition(() => router.refresh());
            }}
          />
        </section>
      )}

      <section>
        <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Database: matches ({matches.length})
        </h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
              <tr>
                <th className="px-3 py-2 font-medium">ID</th>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Video path</th>
                <th className="px-3 py-2 font-medium">Duration</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Opponent</th>
                <th className="px-3 py-2 font-medium">Result</th>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 font-medium">Stats</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
              {matches.map((m) => (
                <tr key={m.id} className="bg-white dark:bg-zinc-900">
                  <td className="px-3 py-2">{m.id}</td>
                  <td className="px-3 py-2">{m.title}</td>
                  <td className="px-3 py-2 font-mono text-xs">{m.videoPath}</td>
                  <td className="px-3 py-2">{m.durationSeconds ?? "—"}</td>
                  <td className="px-3 py-2">{m.date ?? "—"}</td>
                  <td className="px-3 py-2">{m.opponent ?? "—"}</td>
                  <td className="px-3 py-2">{m.result ?? "—"}</td>
                  <td className="px-3 py-2">{m.category ?? "—"}</td>
                  <td className="px-3 py-2">
                    {m.stats.length} point(s):{" "}
                    {m.stats
                      .slice(0, 3)
                      .map((s) => `${s.winner}/${s.shotType ?? "?"}`)
                      .join(", ")}
                    {m.stats.length > 3 ? " …" : ""}
                  </td>
                  <td className="px-3 py-2 flex gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingId(m.id)}
                      disabled={isPending}
                      className="rounded bg-zinc-600 px-2 py-1 text-xs text-white hover:bg-zinc-500 disabled:opacity-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(m.id)}
                      disabled={isPending}
                      className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-500 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          VIDEO_ROOT: video files ({videoFiles.length})
        </h2>
        <ul className="max-h-48 list-inside list-disc overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-4 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900">
          {videoFiles.length === 0 ? (
            <li className="text-zinc-500">No video files found</li>
          ) : (
            <>
              {videoFiles.map((p) => (
                <li key={p} className="text-zinc-700 dark:text-zinc-300">
                  {p}
                </li>
              ))}
            </>
          )}
        </ul>
      </section>

      {(inDbButMissing.length > 0 || onDiskButNotInDb.length > 0) && (
        <section>
          <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Mismatches (informational)
          </h2>
          {inDbButMissing.length > 0 && (
            <p className="mb-2 text-sm text-amber-700 dark:text-amber-400">
              In DB but file missing:{" "}
              <span className="font-mono">{inDbButMissing.join(", ")}</span>
            </p>
          )}
          {onDiskButNotInDb.length > 0 && (
            <p className="text-sm text-blue-700 dark:text-blue-400">
              On disk but not in DB:{" "}
              <span className="font-mono">
                {onDiskButNotInDb.slice(0, 10).join(", ")}
                {onDiskButNotInDb.length > 10
                  ? ` … and ${onDiskButNotInDb.length - 10} more`
                  : ""}
              </span>
            </p>
          )}
        </section>
      )}
    </div>
  );
}
