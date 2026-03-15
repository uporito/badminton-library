import { notFound } from "next/navigation";
import Link from "next/link";
import { getMatchById } from "@/lib/get_match_by_id";
import { getRalliesByMatchId } from "@/lib/get_rallies_by_match_id";
import { InputShotsPanel } from "./input_shots_panel";
import { RallyShotGrid } from "./rally_shot_grid";
import { MatchStatsCharts } from "./match_stats_charts";
import { CvAnalyzeButton } from "./cv_analyze_button";
import { AcceptAiShotsButton } from "./accept_ai_shots_button";
import { CollapsibleSection } from "./collapsible_section";
import { VideoPlayerWithOverlay } from "./video_player_with_overlay";
import { PencilSimple } from "@phosphor-icons/react/ssr";
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
  const aiSuggestedCount = rallies.reduce(
    (sum, r) => sum + r.shots.filter((s) => s.source === "ai_suggested").length,
    0
  );
  const isYouTube = match.videoSource === "youtube";
  const videoUrl = isYouTube
    ? `https://www.youtube.com/embed/${encodeURIComponent(match.videoPath)}`
    : `/api/video?path=${encodeURIComponent(match.videoPath)}&source=${match.videoSource ?? "local"}`;
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
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 min-h-screen font-sans">
      <h1 className="mb-4 text-xl font-semibold text-text-main">
        {match.title}
      </h1>

      <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-[2fr_1fr]">
        <div className="min-w-0">
          {isYouTube ? (
            <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black shadow-lg">
              <iframe
                src={videoUrl}
                title={match.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
            </div>
          ) : (
            <VideoPlayerWithOverlay videoUrl={videoUrl} shots={overlayShots} />
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <CollapsibleSection title="Manual shot input" overlay>
            <InputShotsPanel matchId={match.id} initialRallies={rallies} />
          </CollapsibleSection>

          <section className="frame relative rounded-xl p-4">
            <Link
              href={`/match/${match.id}/edit`}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md text-text-soft transition-colors hover:bg-ui-elevated hover:text-text-main"
              aria-label="Edit match"
            >
              <PencilSimple className="h-4 w-4" weight="bold" />
            </Link>
            <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-text-soft">Date</dt>
                <dd className="font-medium text-text-main">
                  {match.date ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-text-soft">
                  {match.opponents.length > 1 ? "Opponents" : "Opponent"}
                </dt>
                <dd className="font-medium text-text-main">
                  {match.opponents.length > 0
                    ? match.opponents.map((o) => o.name).join(", ")
                    : "—"}
                </dd>
              </div>
              {match.partner && (
                <div>
                  <dt className="text-text-soft">Partner</dt>
                  <dd className="font-medium text-text-main">
                    {match.partner.name}
                  </dd>
                </div>
              )}
              {match.partnerStatus === "unknown" && (
                <div>
                  <dt className="text-text-soft">Partner</dt>
                  <dd className="font-medium text-text-soft">Unknown</dd>
                </div>
              )}
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
          </section>

          {!isYouTube && (
            <div className="flex flex-col items-end gap-2">
              <CvAnalyzeButton matchId={match.id} videoUrl={videoUrl} />
              <div className="flex w-full flex-wrap items-center gap-2">
                <AcceptAiShotsButton
                  matchId={match.id}
                  aiSuggestedCount={aiSuggestedCount}
                />
              </div>
            </div>
          )}
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
