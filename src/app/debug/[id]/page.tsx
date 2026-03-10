import Link from "next/link";
import { notFound } from "next/navigation";
import { getMatchById } from "@/lib/get_match_by_id";
import { getRalliesByMatchId } from "@/lib/get_rallies_by_match_id";
import type { RallyWithShots } from "@/lib/get_rallies_by_match_id";
import { DeleteRallyButton } from "../debug_delete_rally_button";
import { DeleteShotButton } from "../debug_delete_shot_button";

interface DebugMatchPageProps {
  params: Promise<{ id: string }>;
}

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toISOString();
}

export default async function DebugMatchPage({ params }: DebugMatchPageProps) {
  const { id } = await params;
  const numId = Number(id);
  if (Number.isNaN(numId) || numId < 1) {
    notFound();
  }
  const matchResult = getMatchById(numId);
  if (!matchResult.ok) {
    notFound();
  }
  const match = matchResult.data;
  const ralliesResult = getRalliesByMatchId(numId);
  const rallies: RallyWithShots[] = ralliesResult.ok ? ralliesResult.data : [];

  return (
    <div className="min-h-screen font-sans">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/debug"
          className="text-sm text-text-soft underline hover:text-text-main"
        >
          ← Back to Debug
        </Link>
      </div>

      <h1 className="mb-8 text-2xl font-bold text-text-main">
        Debug: {match.title} (ID {match.id})
      </h1>

      {/* Match metadata — all fields */}
      <section className="frame mb-8 rounded-xl p-4">
        <h2 className="mb-4 text-xl font-semibold text-text-main">
          Match
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200/50 dark:border-zinc-600/50 bg-white/5 dark:bg-black/10">
              <tr>
                <th className="px-3 py-2 font-medium">Field</th>
                <th className="px-3 py-2 font-medium">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/50 dark:divide-zinc-600/50">
              <tr>
                <td className="px-3 py-2 font-medium">id</td>
                <td className="px-3 py-2 font-mono">{match.id}</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium">title</td>
                <td className="px-3 py-2">{match.title}</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium">videoPath</td>
                <td className="px-3 py-2 font-mono text-xs break-all">{match.videoPath}</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium">durationSeconds</td>
                <td className="px-3 py-2 font-mono">{match.durationSeconds ?? "null"}</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium">date</td>
                <td className="px-3 py-2 font-mono">{match.date ?? "null"}</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium">opponents</td>
                <td className="px-3 py-2 font-mono">{match.opponents.map((o) => o.name).join(", ") || "null"}</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium">partner</td>
                <td className="px-3 py-2 font-mono">{match.partner?.name ?? match.partnerStatus}</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium">result</td>
                <td className="px-3 py-2 font-mono">{match.result ?? "null"}</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium">notes</td>
                <td className="px-3 py-2 font-mono text-xs break-all">{match.notes ?? "null"}</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium">category</td>
                <td className="px-3 py-2 font-mono">{match.category ?? "null"}</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium">createdAt</td>
                <td className="px-3 py-2 font-mono text-xs">{formatDate(match.createdAt)}</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium">updatedAt</td>
                <td className="px-3 py-2 font-mono text-xs">{formatDate(match.updatedAt)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Rallies with full shot details */}
      <section className="space-y-8">
        <h2 className="text-xl font-semibold text-text-main">
          Rallies ({rallies.length})
        </h2>

        {rallies.length === 0 ? (
          <p className="text-text-soft">No rallies for this match.</p>
        ) : (
          rallies.map((rally) => (
            <div key={rally.id} className="frame rounded-xl p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-medium text-text-main">
                  Rally #{rally.id}
                </h3>
                <DeleteRallyButton matchId={numId} rallyId={rally.id} />
              </div>
              <table className="mb-4 min-w-full text-left text-sm">
                <thead className="border-b border-zinc-200/50 dark:border-zinc-600/50 bg-white/5 dark:bg-black/10">
                  <tr>
                    <th className="px-3 py-2 font-medium">Field</th>
                    <th className="px-3 py-2 font-medium">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200/50 dark:divide-zinc-600/50">
                  <tr>
                    <td className="px-3 py-2 font-medium">id</td>
                    <td className="px-3 py-2 font-mono">{rally.id}</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">matchId</td>
                    <td className="px-3 py-2 font-mono">{rally.matchId}</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">rallyLength</td>
                    <td className="px-3 py-2 font-mono">{rally.rallyLength}</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">wonByMe</td>
                    <td className="px-3 py-2 font-mono">{String(rally.wonByMe)}</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">createdAt</td>
                    <td className="px-3 py-2 font-mono text-xs">{formatDate(rally.createdAt)}</td>
                  </tr>
                </tbody>
              </table>

              <h4 className="mb-2 text-sm font-medium text-text-main">
                Shots ({rally.shots.length})
              </h4>
              {rally.shots.length === 0 ? (
                <p className="text-xs text-text-soft">No shots in this rally.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-xs">
                    <thead className="border-b border-zinc-200/50 dark:border-zinc-600/50 bg-white/5 dark:bg-black/10">
                      <tr>
                        <th className="px-2 py-1.5 font-medium">id</th>
                        <th className="px-2 py-1.5 font-medium">matchId</th>
                        <th className="px-2 py-1.5 font-medium">rallyId</th>
                        <th className="px-2 py-1.5 font-medium">shotType</th>
                        <th className="px-2 py-1.5 font-medium">zoneFromSide</th>
                        <th className="px-2 py-1.5 font-medium">zoneFrom</th>
                        <th className="px-2 py-1.5 font-medium">zoneToSide</th>
                        <th className="px-2 py-1.5 font-medium">zoneTo</th>
                        <th className="px-2 py-1.5 font-medium">outcome</th>
                        <th className="px-2 py-1.5 font-medium">wonByMe</th>
                        <th className="px-2 py-1.5 font-medium">isLastShotOfRally</th>
                        <th className="px-2 py-1.5 font-medium">player</th>
                        <th className="px-2 py-1.5 font-medium">createdAt</th>
                        <th className="px-2 py-1.5 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200/50 dark:divide-zinc-600/50">
                      {rally.shots.map((shot) => (
                        <tr key={shot.id}>
                          <td className="px-2 py-1.5 font-mono">{shot.id}</td>
                          <td className="px-2 py-1.5 font-mono">{shot.matchId}</td>
                          <td className="px-2 py-1.5 font-mono">{shot.rallyId}</td>
                          <td className="px-2 py-1.5 font-mono">{shot.shotType}</td>
                          <td className="px-2 py-1.5 font-mono">{shot.zoneFromSide}</td>
                          <td className="px-2 py-1.5 font-mono">{shot.zoneFrom}</td>
                          <td className="px-2 py-1.5 font-mono">{shot.zoneToSide}</td>
                          <td className="px-2 py-1.5 font-mono">{shot.zoneTo}</td>
                          <td className="px-2 py-1.5 font-mono">{shot.outcome}</td>
                          <td className="px-2 py-1.5 font-mono">{String(shot.wonByMe)}</td>
                          <td className="px-2 py-1.5 font-mono">{String(shot.isLastShotOfRally)}</td>
                          <td className="px-2 py-1.5 font-mono">{shot.player}</td>
                          <td className="px-2 py-1.5 font-mono whitespace-nowrap">{formatDate(shot.createdAt)}</td>
                          <td className="px-2 py-1.5">
                            <DeleteShotButton matchId={numId} shotId={shot.id} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))
        )}
      </section>
    </div>
  );
}
