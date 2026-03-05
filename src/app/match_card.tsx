import Link from "next/link";
import { PlayIcon } from "@phosphor-icons/react/ssr";
import { formatDuration } from "@/lib/format_duration";
import type { MatchRow } from "@/lib/get_match_by_id";
import type { MatchCategory } from "@/db/schema";

function getCategoryAccentClass(category: MatchCategory | null | undefined): string {
  switch (category) {
    case "Singles":
      return "border-l-indigo-500 dark:border-l-indigo-400";
    case "Doubles":
      return "border-l-emerald-500 dark:border-l-emerald-400";
    case "Mixed":
      return "border-l-violet-500 dark:border-l-violet-400";
    default:
      return "border-l-zinc-400 dark:border-l-zinc-500";
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
      <PlayIcon className={`h-8 w-8 ${iconClass}`} aria-hidden />
    </div>
  );
}

export interface MatchCardProps {
  match: MatchRow;
}

export function MatchCard({ match }: MatchCardProps) {
  const category = match.category ?? "Uncategorized";
  const accentClass = getCategoryAccentClass(category);
  return (
    <Link
      href={`/match/${match.id}`}
      className={`frame-glass block rounded-xl border-l-4 p-0 shadow-sm transition-shadow hover:shadow-md ${accentClass}`}
    >
      <VideoPlaceholder category={category} />
      <div className="p-2">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-2">
          {match.title}
        </h2>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          {formatDuration(match.durationSeconds)}
        </p>
      </div>
    </Link>
  );
}
