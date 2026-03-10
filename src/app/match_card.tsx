"use client";

import { useState } from "react";
import Link from "next/link";
import { PlayIcon, GoogleDriveLogo, YoutubeLogo } from "@phosphor-icons/react/ssr";
import { formatDuration } from "@/lib/format_duration";
import type { MatchRow } from "@/lib/get_match_by_id";
import type { MatchCategory } from "@/db/schema";
import { parseTags } from "@/lib/tags";
import { MatchCardMenu } from "./match_card_menu";
import { clsx } from "clsx";

function getCategoryAccentClass(category: MatchCategory | null | undefined): string {
  switch (category) {
    case "Singles":
      return "border-l-indigo-500 dark:border-l-indigo-400";
    case "Doubles":
      return "border-l-emerald-500 dark:border-l-emerald-400";
    case "Mixed":
      return "border-l-violet-500 dark:border-l-violet-400";
    default:
      return "border-l-ui-elevated-more";
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
          : "bg-ui-elevated";
  const iconClass =
    category === "Singles"
      ? "text-indigo-500 dark:text-indigo-400"
      : category === "Doubles"
        ? "text-emerald-500 dark:text-emerald-400"
        : category === "Mixed"
          ? "text-violet-500 dark:text-violet-400"
          : "text-foreground";
  return (
    <div
      className={`flex aspect-video w-full items-center justify-center rounded-lg ${bgClass}`}
      aria-hidden
    >
      <PlayIcon className={`h-8 w-8 ${iconClass}`} aria-hidden />
    </div>
  );
}

const MAX_VISIBLE_TAGS = 2;

function TagsDisplay({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  const overflow = tags.length - MAX_VISIBLE_TAGS;

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {/* Compact view: first N tags + overflow badge */}
      <div className="contents group-hover/card:hidden">
        {tags.slice(0, MAX_VISIBLE_TAGS).map((tag) => (
          <span
            key={tag}
            className="inline-block max-w-[80px] truncate rounded bg-ui-elevated px-1.5 py-0.5 text-[10px] text-text-soft"
          >
            {tag}
          </span>
        ))}
        {overflow > 0 && (
          <span className="inline-block rounded bg-ui-elevated px-1.5 py-0.5 text-[10px] text-text-soft">
            +{overflow}
          </span>
        )}
      </div>
      {/* Expanded view on hover: all tags */}
      <div className="hidden contents group-hover/card:contents">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-block rounded bg-ui-elevated px-1.5 py-0.5 text-[10px] text-text-soft"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

export interface MatchCardProps {
  match: MatchRow;
  /** Whether a cached thumbnail exists (computed on server to avoid pulling gdrive into client bundle). */
  hasThumbnail: boolean;
}

export function MatchCard({ match, hasThumbnail }: MatchCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const category = match.category ?? "Uncategorized";
  const accentClass = getCategoryAccentClass(category);
  const tags = parseTags(match.tags);

  return (
    <div className={`group/card frame relative rounded-xl border-l-4 p-0 ${accentClass}`}>
      {/* Stretched link for navigation */}
      <Link
        href={`/match/${match.id}`}
        className="absolute inset-0 z-0 rounded-xl"
        aria-label={match.title}
      />

      {/* Menu button: visible on card hover or when menu is open */}
      <div
        className={clsx(
          "absolute right-2 top-2 z-10 transition-opacity",
          menuOpen ? "opacity-100" : "opacity-0 group-hover/card:opacity-100"
        )}
      >
        <MatchCardMenu
          matchId={match.id}
          initialTags={tags}
          onOpenChange={setMenuOpen}
        />
      </div>

      {hasThumbnail ? (
        <div className="relative aspect-video w-full overflow-hidden rounded-lg">
          <img
            src={`/api/thumbnail?id=${match.id}`}
            alt={match.title}
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <VideoPlaceholder category={category} />
      )}
      <div className="relative z-[1] pointer-events-none p-2">
        <div className="flex items-center gap-2">
          <h2 className="min-w-0 flex-1 text-sm font-semibold text-text-main line-clamp-2">
            {match.title}
          </h2>
          {match.videoSource === "gdrive" && (
            <GoogleDriveLogo size={12} className="shrink-0 text-text-soft" />
          )}
          {match.videoSource === "youtube" && (
            <YoutubeLogo size={12} className="shrink-0 text-text-soft" />
          )}
          <span className="shrink-0 text-xs text-text-soft">
            {formatDuration(match.durationSeconds)}
          </span>
        </div>
        <TagsDisplay tags={tags} />
      </div>
    </div>
  );
}
