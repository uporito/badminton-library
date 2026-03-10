"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  YoutubeLogo,
  MagnifyingGlass,
  Link as LinkIcon,
  Plus,
  CircleNotch,
  Check,
} from "@phosphor-icons/react";
import { parseYouTubeVideoId } from "@/lib/youtube";

interface YouTubeSearchItem {
  id: string;
  title: string;
  publishedAt: string | null;
  channelTitle: string | null;
  thumbnailUrl: string | null;
}

interface YouTubeVideoInfo {
  id: string;
  title: string;
  publishedAt: string | null;
  durationSeconds: number | null;
}

interface ExistingMatch {
  id: number;
  videoPath: string;
  videoSource: string;
}

export function YouTubeImportSource({
  existingMatches,
}: {
  existingMatches: ExistingMatch[];
}) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"search" | "url">("search");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchResults, setSearchResults] = useState<YouTubeSearchItem[]>([]);
  const [singleVideo, setSingleVideo] = useState<YouTubeVideoInfo | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);

  const existingYoutubeIds = new Set(
    existingMatches
      .filter((m) => m.videoSource === "youtube")
      .map((m) => m.videoPath)
  );

  async function handleSearch() {
    const q = input.trim();
    if (!q) return;
    setError("");
    setSingleVideo(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/youtube/search?q=${encodeURIComponent(q)}&maxResults=12`
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Search failed");
        setSearchResults([]);
        return;
      }
      setSearchResults(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleFetchByUrl() {
    const raw = input.trim();
    if (!raw) return;
    const videoId = parseYouTubeVideoId(raw);
    if (!videoId) {
      setError("Invalid YouTube URL or video ID");
      return;
    }
    setError("");
    setSearchResults([]);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/youtube/video?url=${encodeURIComponent(raw)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to fetch video");
        setSingleVideo(null);
        return;
      }
      setSingleVideo({
        id: data.id,
        title: data.title,
        publishedAt: data.publishedAt ?? null,
        durationSeconds: data.durationSeconds ?? null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch video");
      setSingleVideo(null);
    } finally {
      setLoading(false);
    }
  }

  async function addToLibrary(item: {
    id: string;
    title: string;
    durationSeconds?: number | null;
  }) {
    if (existingYoutubeIds.has(item.id)) return;
    setAddingId(item.id);
    try {
      let title = item.title;
      let durationSeconds: number | undefined = item.durationSeconds ?? undefined;
      if (durationSeconds == null) {
        const vidRes = await fetch(`/api/youtube/video?id=${encodeURIComponent(item.id)}`);
        if (vidRes.ok) {
          const vid = await vidRes.json();
          title = vid.title ?? title;
          durationSeconds = vid.durationSeconds ?? undefined;
        }
      }
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          videoPath: item.id,
          videoSource: "youtube",
          durationSeconds,
        }),
      });
      if (res.ok) {
        existingYoutubeIds.add(item.id);
        router.refresh();
      }
    } finally {
      setAddingId(null);
    }
  }

  const displayList: Array<{
    id: string;
    title: string;
    durationSeconds?: number | null;
    thumbnailUrl?: string | null;
  }> = singleVideo
    ? [singleVideo]
    : searchResults.map((r) => ({
        id: r.id,
        title: r.title,
        thumbnailUrl: r.thumbnailUrl,
      }));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-ui-elevated-more bg-ui-elevated overflow-hidden">
          <button
            type="button"
            onClick={() => setMode("search")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === "search"
                ? "bg-ui-elevated-more text-foreground"
                : "text-text-soft hover:bg-ui-elevated-more"
            }`}
          >
            <MagnifyingGlass size={14} />
            Search by name
          </button>
          <button
            type="button"
            onClick={() => setMode("url")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === "url"
                ? "bg-ui-elevated-more text-foreground"
                : "text-text-soft hover:bg-ui-elevated-more"
            }`}
          >
            <LinkIcon size={14} />
            Paste URL
          </button>
        </div>
        <div className="flex flex-1 min-w-[200px] gap-2">
          <input
            type="text"
            placeholder={
              mode === "search"
                ? "Search YouTube…"
                : "YouTube URL or video ID…"
            }
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (mode === "search") handleSearch();
                else handleFetchByUrl();
              }
            }}
            className="flex-1 rounded-md border border-ui-elevated-more bg-ui-elevated px-3 py-1.5 text-xs text-foreground placeholder:text-text-soft focus:outline-none focus:ring-2 focus:ring-ui-elevated-more"
          />
          <button
            type="button"
            onClick={mode === "search" ? handleSearch : handleFetchByUrl}
            disabled={!input.trim() || loading}
            className="shrink-0 flex items-center gap-1.5 rounded-lg bg-ui-elevated-more px-3 py-1.5 text-xs font-medium text-foreground hover:opacity-90 disabled:opacity-50"
          >
            {loading ? (
              <CircleNotch size={14} className="animate-spin" />
            ) : mode === "search" ? (
              "Search"
            ) : (
              "Fetch"
            )}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-xs text-ui-error">{error}</p>
      )}

      <div className="max-h-[280px] overflow-y-auto rounded-lg border border-ui-elevated-more">
        {displayList.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-text-soft">
            <YoutubeLogo size={28} />
            <span className="text-xs">
              {mode === "search"
                ? "Search by video name or paste a YouTube URL above."
                : "Paste a YouTube URL or video ID and click Fetch."}
            </span>
          </div>
        )}
        {displayList.length > 0 && (
          <ul className="p-1.5 space-y-px">
            {displayList.map((item) => {
              const inLibrary = existingYoutubeIds.has(item.id);
              const adding = addingId === item.id;
              return (
                <li key={item.id}>
                  <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs">
                    {"thumbnailUrl" in item && item.thumbnailUrl && (
                      <img
                        src={item.thumbnailUrl}
                        alt=""
                        className="h-9 w-16 shrink-0 rounded object-cover"
                      />
                    )}
                    <span className="min-w-0 flex-1 truncate text-text-main">
                      {item.title}
                    </span>
                    {"durationSeconds" in item &&
                      item.durationSeconds != null && (
                        <span className="shrink-0 text-text-soft">
                          {Math.floor(item.durationSeconds / 60)}:
                          {String(item.durationSeconds % 60).padStart(2, "0")}
                        </span>
                      )}
                    {inLibrary ? (
                      <span className="flex shrink-0 items-center gap-1 text-ui-success">
                        <Check size={12} weight="bold" />
                        In library
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          addToLibrary({
                            id: item.id,
                            title: item.title,
                            durationSeconds:
                              "durationSeconds" in item
                                ? item.durationSeconds
                                : undefined,
                          })
                        }
                        disabled={adding}
                        className="shrink-0 flex items-center gap-1 rounded bg-accent px-2 py-1 text-ui-bg text-xs font-medium hover:opacity-90 disabled:opacity-50"
                      >
                        {adding ? (
                          <CircleNotch size={12} className="animate-spin" />
                        ) : (
                          <Plus size={12} weight="bold" />
                        )}
                        Add
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
