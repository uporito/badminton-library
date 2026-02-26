import { notFound } from "next/navigation";
import Link from "next/link";
import { getMatchById } from "@/lib/get_match_by_id";

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
  const videoUrl = `/api/video?path=${encodeURIComponent(match.videoPath)}`;

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-zinc-950">
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
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
        <div className="overflow-hidden rounded-lg bg-black shadow-lg">
          <video
            src={videoUrl}
            controls
            className="w-full"
            preload="metadata"
          >
            Your browser does not support the video tag.
          </video>
        </div>
      </main>
    </div>
  );
}
