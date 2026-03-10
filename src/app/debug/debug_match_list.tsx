"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { MatchForm } from "@/app/match_form";
import type { MatchRow } from "@/lib/get_match_by_id";
import type { MatchCategory } from "@/db/schema";

type MatchShot = {
  id: number;
  matchId: number;
  rallyId: number;
  shotType: string;
  zoneFromSide: string;
  zoneFrom: string;
  zoneToSide: string;
  zoneTo: string;
  outcome: string;
  isLastShotOfRally: boolean;
  player: string;
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

type MatchWithShots = Match & { shots: MatchShot[] };

interface DebugMatchListProps {
  matches: MatchWithShots[];
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
      {editingId !== null && (
        <section className="relative z-20">
          <h2 className="mb-4 text-xl font-semibold text-text-main">
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

      <section className="frame rounded-xl p-4">
        <h2 className="mb-4 text-xl font-semibold text-text-main">
          Database: matches ({matches.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-ui-elevated-more bg-ui-elevated">
              <tr>
                <th className="px-3 py-2 font-medium">ID</th>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Video path</th>
                <th className="px-3 py-2 font-medium">Duration</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Opponent</th>
                <th className="px-3 py-2 font-medium">Result</th>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 font-medium">Shots</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ui-elevated-more">
              {matches.map((m) => (
                <tr key={m.id}>
                  <td className="px-3 py-2">{m.id}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/debug/${m.id}`}
                      className="font-medium text-accent underline hover:no-underline"
                    >
                      {m.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{m.videoPath}</td>
                  <td className="px-3 py-2">{m.durationSeconds ?? "—"}</td>
                  <td className="px-3 py-2">{m.date ?? "—"}</td>
                  <td className="px-3 py-2">{m.opponent ?? "—"}</td>
                  <td className="px-3 py-2">{m.result ?? "—"}</td>
                  <td className="px-3 py-2">{m.category ?? "—"}</td>
                  <td className="px-3 py-2">
                    {m.shots.length} shot(s):{" "}
                    {m.shots
                      .slice(0, 3)
                      .map((s) => `${s.shotType}/${s.outcome}`)
                      .join(", ")}
                    {m.shots.length > 3 ? " …" : ""}
                  </td>
                  <td className="px-3 py-2 flex flex-wrap gap-1">
                    <Link
                      href={`/debug/${m.id}`}
                      className="rounded bg-accent px-2 py-1 text-xs text-white hover:opacity-90"
                    >
                      View details
                    </Link>
                    <button
                      type="button"
                      onClick={() => setEditingId(m.id)}
                      disabled={isPending}
                      className="rounded bg-ui-elevated-more px-2 py-1 text-xs text-foreground hover:opacity-90 disabled:opacity-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(m.id)}
                      disabled={isPending}
                      className="rounded bg-ui-error px-2 py-1 text-xs text-white hover:opacity-90 disabled:opacity-50"
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

      <section className="frame rounded-xl p-4">
        <h2 className="mb-4 text-xl font-semibold text-text-main">
          VIDEO_ROOT: video files ({videoFiles.length})
        </h2>
        <ul className="max-h-48 list-inside list-disc overflow-y-auto font-mono text-sm text-text-main">
          {videoFiles.length === 0 ? (
            <li className="text-text-soft">No video files found</li>
          ) : (
            <>
              {videoFiles.map((p) => (
                <li key={p} className="text-text-main">
                  {p}
                </li>
              ))}
            </>
          )}
        </ul>
      </section>

      {(inDbButMissing.length > 0 || onDiskButNotInDb.length > 0) && (
        <section className="frame rounded-xl p-4">
          <h2 className="mb-4 text-xl font-semibold text-text-main">
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
