import { notFound } from "next/navigation";
import Link from "next/link";
import { getMatchById } from "@/lib/get_match_by_id";
import { getRalliesByMatchId } from "@/lib/get_rallies_by_match_id";
import { InputShotsPanel } from "./input_shots_panel";

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
  const videoUrl = `/api/video?path=${encodeURIComponent(match.videoPath)}`;

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-zinc-950">
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <nav className="mb-4">
          <Link
            href="/"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            ← Back to library
          </Link>
        </nav>
        <h1 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          {match.title}
        </h1>

        {/* Top row: video (left 2/3) + analysis (right 1/3) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr]">
          <div className="min-w-0 space-y-4">
            <div className="flex max-h-[60vh] items-center justify-center overflow-hidden rounded-lg bg-black shadow-lg">
              <video
                src={videoUrl}
                controls
                className="max-h-[60vh] w-full object-contain"
                preload="metadata"
              >
                Your browser does not support the video tag.
              </video>
            </div>
            <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Match metadata
              </h2>
              <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">Date</dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                    {match.date ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">Opponent</dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                    {match.opponent ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">Result</dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                    {match.result ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">Category</dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                    {match.category ?? "—"}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-zinc-500 dark:text-zinc-400">Notes</dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                    {match.notes ?? "—"}
                  </dd>
                </div>
              </dl>
            </section>
          </div>
          <div className="min-w-0">
            <InputShotsPanel matchId={match.id} initialRallies={rallies} />
          </div>
        </div>
      </main>
    </div>
  );
}
