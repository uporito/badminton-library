"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

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

  async function handleDelete(id: number) {
    const res = await fetch(`/api/matches/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Delete failed");
      return;
    }
    startTransition(() => router.refresh());
  }

  async function handleAddMatch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const body = {
      title: formData.get("title") as string,
      videoPath: formData.get("videoPath") as string,
      durationSeconds: formData.get("durationSeconds")
        ? parseInt(formData.get("durationSeconds") as string, 10)
        : undefined,
      date: (formData.get("date") as string) || undefined,
      opponent: (formData.get("opponent") as string) || undefined,
      result: (formData.get("result") as string) || undefined,
      notes: (formData.get("notes") as string) || undefined,
    };
    const res = await fetch("/api/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Create failed");
      return;
    }
    form.reset();
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Add match
        </h2>
        <form
          onSubmit={handleAddMatch}
          className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              Title (required)
              <input
                name="title"
                required
                className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-800"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Video path (required)
              <input
                name="videoPath"
                required
                placeholder="e.g. videos/match.mp4"
                className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-800"
              />
            </label>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1 text-sm">
              Duration (s)
              <input
                name="durationSeconds"
                type="number"
                min={0}
                className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-800"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Date
              <input
                name="date"
                type="date"
                className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-800"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Opponent
              <input
                name="opponent"
                className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-800"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Result
              <input
                name="result"
                placeholder="e.g. 21-19 21-17"
                className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-800"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            Notes
            <input
              name="notes"
              className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-800"
            />
          </label>
          <button
            type="submit"
            disabled={isPending}
            className="w-fit rounded bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {isPending ? "Adding…" : "Add match"}
          </button>
        </form>
      </section>

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
                  <td className="px-3 py-2">
                    {m.stats.length} point(s):{" "}
                    {m.stats
                      .slice(0, 3)
                      .map((s) => `${s.winner}/${s.shotType ?? "?"}`)
                      .join(", ")}
                    {m.stats.length > 3 ? " …" : ""}
                  </td>
                  <td className="px-3 py-2">
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
