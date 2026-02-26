import Link from "next/link";
import { formatDuration } from "@/lib/format_duration";
import type { MatchRow } from "@/lib/get_match_by_id";

function VideoPlaceholder() {
  return (
    <div
      className="flex aspect-video w-full items-center justify-center rounded-lg bg-zinc-200 dark:bg-zinc-800"
      aria-hidden
    >
      <svg
        className="h-12 w-12 text-zinc-500 dark:text-zinc-400"
        fill="currentColor"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path d="M8 5v14l11-7L8 5zM6 3v18h2V3H6zm14 0v18h2V3h-2z" />
      </svg>
    </div>
  );
}

export interface MatchCardProps {
  match: MatchRow;
}

export function MatchCard({ match }: MatchCardProps) {
  return (
    <Link
      href={`/match/${match.id}`}
      className="block rounded-xl border border-zinc-200 bg-white p-0 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
    >
      <VideoPlaceholder />
      <div className="p-3">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-2">
          {match.title}
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {formatDuration(match.durationSeconds)}
        </p>
      </div>
    </Link>
  );
}
