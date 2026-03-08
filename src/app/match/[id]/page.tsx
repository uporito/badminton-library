import { notFound } from "next/navigation";
import { getMatchById } from "@/lib/get_match_by_id";
import { getRalliesByMatchId } from "@/lib/get_rallies_by_match_id";
import { InputShotsPanel } from "./input_shots_panel";
import { RallyShotGrid } from "./rally_shot_grid";
import { MatchStatsCharts } from "./match_stats_charts";
import { AnalyzeButton } from "./analyze_button";
import { PlayerDescriptions } from "./player_descriptions";
import { VideoPlayerWithOverlay } from "./video_player_with_overlay";
import type { OverlayShot } from "./video_player_with_overlay";
import type { ShotForStats } from "@/lib/shot_chart_utils";

interface MatchPageProps {
  params: Promise<{ id: string }>;
}

export default async function MatchPage({ params }: MatchPageProps) {
  const { id } = await params;
  const numId = Number(id);
  if (Number.isNaN(numId) || numId < 1) {
    notFound();
  }
  const result = getMatchById(numId);
  if (!result.ok) {
    notFound();
  }
  const match = result.data;
  const ralliesResult = getRalliesByMatchId(numId);
  const rallies = ralliesResult.ok ? ralliesResult.data : [];
  const videoUrl = `/api/video?path=${encodeURIComponent(match.videoPath)}&source=${match.videoSource ?? "local"}`;
  const shotsForCharts: ShotForStats[] = rallies.flatMap((r) =>
    r.shots.map((s) => ({
      shotType: s.shotType,
      outcome: s.outcome,
      player: s.player,
      zoneFrom: s.zoneFrom,
      zoneTo: s.zoneTo,
      zoneFromSide: s.zoneFromSide,
      zoneToSide: s.zoneToSide,
    }))
  );
  const overlayShots: OverlayShot[] = rallies
    .flatMap((r) => r.shots)
    .filter((s): s is typeof s & { timestamp: number } => s.timestamp != null)
    .map((s) => ({ shotType: s.shotType, player: s.player, timestamp: s.timestamp }));

  return (
    <div className="min-h-screen font-sans">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-text-main">
          {match.title}
        </h1>
        <AnalyzeButton matchId={match.id} />
      </div>

      {/* Top row: video (left 2/3) + analysis (right 1/3) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr]">
        <div className="min-w-0 space-y-4">
          <VideoPlayerWithOverlay videoUrl={videoUrl} shots={overlayShots} />
          <section className="frame rounded-xl p-4">
            <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-text-soft">Date</dt>
                <dd className="font-medium text-text-main">
                  {match.date ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-text-soft">Opponent</dt>
                <dd className="font-medium text-text-main">
                  {match.opponent ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-text-soft">Result</dt>
                <dd className="font-medium text-text-main">
                  {match.result ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-text-soft">Category</dt>
                <dd className="font-medium text-text-main">
                  {match.category ?? "—"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-text-soft">Notes</dt>
                <dd className="font-medium text-text-main">
                  {match.notes ?? "—"}
                </dd>
              </div>
            </dl>
            <div className="mt-3 border-t border-ui-elevated pt-3">
              <PlayerDescriptions
                matchId={match.id}
                initialMyDescription={match.myDescription ?? ""}
                initialOpponentDescription={match.opponentDescription ?? ""}
              />
            </div>
          </section>
        </div>
        <div className="min-w-0">
          <InputShotsPanel matchId={match.id} initialRallies={rallies} />
        </div>
      </div>

      <div className="mt-6 w-full">
        <RallyShotGrid rallies={rallies} />
      </div>

      <div className="mt-6 w-full">
        <MatchStatsCharts shots={shotsForCharts} />
      </div>
    </div>
  );
}
