"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  MagnifyingGlass,
  Check,
  CircleNotch,
  CloudArrowDown,
  ArrowsClockwise,
} from "@phosphor-icons/react";
import { formatDuration } from "@/lib/format_duration";

interface YouTubeVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  publishedAt: string;
  durationSeconds: number | null;
}

interface ExistingMatch {
  id: number;
  videoPath: string;
  videoSource: string;
}

export function YouTubeImportPanel({
  existingMatches,
}: {
  existingMatches: ExistingMatch[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");

  const existingYouTubeIds = useMemo(() => {
    const set = new Set<string>();
    for (const m of existingMatches) {
      if (m.videoSource === "youtube") set.add(m.videoPath);
    }
    return set;
  }, [existingMatches]);

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError("");
    setSearched(true);
    setSelectedIds(new Set());
    try {
      const res = await fetch(
        `/api/youtube/search?q=${encodeURIComponent(q)}`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Search failed");
        setVideos([]);
        return;
      }
      const data = await res.json();
      setVideos(data.videos ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  function toggleVideo(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const importableVideos = useMemo(
    () => videos.filter((v) => selectedIds.has(v.videoId) && !existingYouTubeIds.has(v.videoId)),
    [videos, selectedIds, existingYouTubeIds]
  );

  async function handleImport() {
    if (importableVideos.length === 0) return;
    setImporting(true);
    setImportMessage("");
    let added = 0;
    let failed = 0;

    for (const video of importableVideos) {
      try {
        const res = await fetch("/api/matches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: video.title,
            videoPath: video.videoId,
            videoSource: "youtube",
            durationSeconds: video.durationSeconds ?? undefined,
            date: video.publishedAt ? video.publishedAt.slice(0, 10) : undefined,
          }),
        });
        if (res.ok) {
          added++;
          const data = await res.json();
          if (data.id) fetch(`/api/thumbnail?id=${data.id}`).catch(() => {});
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    setImporting(false);
    const parts: string[] = [];
    if (added > 0) parts.push(`${added} imported`);
    if (failed > 0) parts.push(`${failed} failed`);
    setImportMessage(parts.join(", ") + ".");
    setSelectedIds(new Set());
    router.refresh();
  }

  const hasSelections = importableVideos.length > 0;

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSearch();
        }}
        className="relative mb-3"
      >
        <MagnifyingGlass
          size={14}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-soft"
        />
        <input
          type="text"
          placeholder="Search YouTube or paste a video URL…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-md border border-ui-elevated-more bg-ui-elevated pl-8 pr-20 py-1.5 text-xs text-foreground placeholder:text-text-soft focus:outline-none focus:ring-2 focus:ring-ui-elevated-more"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md bg-ui-elevated-more px-3 py-1 text-xs font-medium text-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading ? (
            <CircleNotch size={12} className="animate-spin" />
          ) : (
            "Search"
          )}
        </button>
      </form>

      {error && <p className="mb-2 text-xs text-red-500">{error}</p>}

      <div className="max-h-[320px] overflow-y-auto rounded-lg border border-ui-elevated-more">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-xs text-text-soft gap-2">
            <CircleNotch size={14} className="animate-spin" />
            Searching…
          </div>
        ) : videos.length > 0 ? (
          <ul className="p-1.5 space-y-px">
            {videos.map((video) => {
              const selected = selectedIds.has(video.videoId);
              const alreadyImported = existingYouTubeIds.has(video.videoId);
              return (
                <li key={video.videoId}>
                  <button
                    type="button"
                    onClick={() => !alreadyImported && toggleVideo(video.videoId)}
                    disabled={alreadyImported}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs text-left transition-colors ${
                      alreadyImported
                        ? "opacity-50 cursor-not-allowed"
                        : selected
                          ? "text-text-main"
                          : "text-text-soft hover:bg-ui-elevated-more"
                    }`}
                  >
                    <span
                      className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] transition-colors ${
                        selected || alreadyImported ? "bg-accent" : "bg-ui-elevated"
                      }`}
                    >
                      {(selected || alreadyImported) && (
                        <Check size={10} className="text-ui-bg" weight="bold" />
                      )}
                    </span>
                    <img
                      src={video.thumbnailUrl}
                      alt=""
                      className="h-9 w-16 shrink-0 rounded object-cover bg-ui-elevated"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-text-main">
                        {video.title}
                      </p>
                      <p className="truncate text-[10px] text-text-soft">
                        {video.channelTitle}
                      </p>
                    </div>
                    {alreadyImported && (
                      <span className="shrink-0 text-[10px] text-text-soft">
                        imported
                      </span>
                    )}
                    <span className="shrink-0 text-[10px] text-text-soft">
                      {formatDuration(video.durationSeconds)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : searched ? (
          <div className="flex flex-col items-center justify-center gap-1 py-8 text-text-soft">
            <CloudArrowDown size={24} />
            <span className="text-xs">No results found</span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-1 py-8 text-text-soft">
            <MagnifyingGlass size={24} />
            <span className="text-xs">Search for YouTube videos to import</span>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          disabled={!hasSelections || importing}
          onClick={handleImport}
          className="flex items-center gap-1.5 rounded-lg bg-ui-elevated-more px-4 py-2 text-xs font-medium text-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {importing ? (
            <CircleNotch size={12} className="animate-spin" />
          ) : (
            <ArrowsClockwise size={12} weight="bold" />
          )}
          {importing
            ? "Importing…"
            : hasSelections
              ? `Import ${importableVideos.length} video${importableVideos.length > 1 ? "s" : ""}`
              : "Select videos to import"}
        </button>
        {importMessage && (
          <p className="text-xs text-text-soft">{importMessage}</p>
        )}
      </div>
    </div>
  );
}
