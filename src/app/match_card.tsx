import Link from "next/link";
import { formatDuration } from "@/lib/format_duration";
import type { MatchRow } from "@/lib/get_match_by_id";
import type { MatchCategory } from "@/db/schema";

function getCategoryCardClasses(category: MatchCategory | null | undefined): string {
  switch (category) {
    case "Singles":
      return "border-indigo-200 bg-white dark:border-indigo-800 dark:bg-indigo-950/30";
    case "Doubles":
      return "border-emerald-200 bg-white dark:border-emerald-800 dark:bg-emerald-950/30";
    case "Mixed":
      return "border-violet-200 bg-white dark:border-violet-800 dark:bg-violet-950/30";
    default:
      return "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900";
  }
}

function VideoPlaceholder({ category }: { category: MatchCategory | null | undefined }) {
  const bgClass =
    category === "Singles"
      ? "bg-indigo-200 dark:bg-indigo-800/50"
      : category === "Doubles"
        ? "bg-emerald-200 dark:bg-emerald-800/50"
        : category === "Mixed"
          ? "bg-violet-200 dark:bg-violet-800/50"
          : "bg-zinc-200 dark:bg-zinc-800";
  const iconClass =
    category === "Singles"
      ? "text-indigo-500 dark:text-indigo-400"
      : category === "Doubles"
        ? "text-emerald-500 dark:text-emerald-400"
        : category === "Mixed"
          ? "text-violet-500 dark:text-violet-400"
          : "text-zinc-500 dark:text-zinc-400";
  return (
    <div
      className={`flex aspect-video w-full items-center justify-center rounded-lg ${bgClass}`}
      aria-hidden
    >
      <svg
        className={`h-12 w-12 ${iconClass}`}
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
  const category = match.category ?? "Uncategorized";
  const cardClasses = getCategoryCardClasses(category);
  return (
    <Link
      href={`/match/${match.id}`}
      className={`block rounded-xl border p-0 shadow-sm transition-shadow hover:shadow-md ${cardClasses}`}
    >
      <VideoPlaceholder category={category} />
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
