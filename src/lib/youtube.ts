import { google, type youtube_v3 } from "googleapis";
import fs from "fs";

let youtubeClient: youtube_v3.Youtube | null = null;

function getApiKey(): string | null {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key || key.trim() === "") return null;
  return key.trim();
}

export function isYouTubeConfigured(): boolean {
  return getApiKey() !== null;
}

function getYouTubeClient(): youtube_v3.Youtube | null {
  if (youtubeClient) return youtubeClient;
  const key = getApiKey();
  if (!key) return null;
  youtubeClient = google.youtube({ version: "v3", auth: key });
  return youtubeClient;
}

const YOUTUBE_URL_PATTERNS = [
  /(?:youtube\.com\/watch\?.*v=|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  /youtu\.be\/([a-zA-Z0-9_-]{11})/,
];

const BARE_VIDEO_ID = /^[a-zA-Z0-9_-]{11}$/;

export function parseYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  for (const pattern of YOUTUBE_URL_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) return match[1];
  }
  if (BARE_VIDEO_ID.test(trimmed)) return trimmed;
  return null;
}

export function looksLikeYouTubeUrl(input: string): boolean {
  return /youtube\.com|youtu\.be/i.test(input);
}

export interface YouTubeVideoResult {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  publishedAt: string;
  durationSeconds: number | null;
}

function parseISO8601Duration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const h = parseInt(match[1] || "0", 10);
  const m = parseInt(match[2] || "0", 10);
  const s = parseInt(match[3] || "0", 10);
  return h * 3600 + m * 60 + s;
}

async function getVideosDetails(
  yt: youtube_v3.Youtube,
  videoIds: string[]
): Promise<Map<string, { durationSeconds: number }>> {
  const map = new Map<string, { durationSeconds: number }>();
  if (videoIds.length === 0) return map;

  const res = await yt.videos.list({
    part: ["contentDetails"],
    id: videoIds,
  });

  for (const item of res.data.items ?? []) {
    if (item.id && item.contentDetails?.duration) {
      map.set(item.id, {
        durationSeconds: parseISO8601Duration(item.contentDetails.duration),
      });
    }
  }
  return map;
}

export async function searchYouTubeVideos(
  query: string,
  maxResults = 10
): Promise<{ ok: true; videos: YouTubeVideoResult[] } | { ok: false; error: string }> {
  const yt = getYouTubeClient();
  if (!yt) return { ok: false, error: "YOUTUBE_NOT_CONFIGURED" };

  try {
    const searchRes = await yt.search.list({
      part: ["snippet"],
      q: query,
      type: ["video"],
      maxResults,
      order: "relevance",
    });

    const items = searchRes.data.items ?? [];
    const videoIds = items
      .map((item) => item.id?.videoId)
      .filter((id): id is string => !!id);

    const detailsMap = await getVideosDetails(yt, videoIds);

    const videos: YouTubeVideoResult[] = items
      .filter((item) => item.id?.videoId && item.snippet)
      .map((item) => {
        const videoId = item.id!.videoId!;
        const snippet = item.snippet!;
        const details = detailsMap.get(videoId);
        return {
          videoId,
          title: snippet.title ?? "Untitled",
          channelTitle: snippet.channelTitle ?? "",
          thumbnailUrl:
            snippet.thumbnails?.medium?.url ??
            snippet.thumbnails?.default?.url ??
            `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
          publishedAt: snippet.publishedAt ?? "",
          durationSeconds: details?.durationSeconds ?? null,
        };
      });

    return { ok: true, videos };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function getYouTubeVideoDetails(
  videoId: string
): Promise<{ ok: true; video: YouTubeVideoResult } | { ok: false; error: string }> {
  const yt = getYouTubeClient();
  if (!yt) return { ok: false, error: "YOUTUBE_NOT_CONFIGURED" };

  try {
    const res = await yt.videos.list({
      part: ["snippet", "contentDetails"],
      id: [videoId],
    });

    const item = res.data.items?.[0];
    if (!item || !item.snippet) {
      return { ok: false, error: "VIDEO_NOT_FOUND" };
    }

    const snippet = item.snippet;
    const durationSeconds = item.contentDetails?.duration
      ? parseISO8601Duration(item.contentDetails.duration)
      : null;

    return {
      ok: true,
      video: {
        videoId,
        title: snippet.title ?? "Untitled",
        channelTitle: snippet.channelTitle ?? "",
        thumbnailUrl:
          snippet.thumbnails?.medium?.url ??
          `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        publishedAt: snippet.publishedAt ?? "",
        durationSeconds,
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function fetchAndCacheYouTubeThumbnail(
  videoId: string
): Promise<{ ok: true; filePath: string } | { ok: false; error: string }> {
  const { getThumbnailPath, ensureThumbnailsDir } = await import("@/lib/thumbnails");
  const url = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

  try {
    const res = await fetch(url);
    if (!res.ok) return { ok: false, error: `Thumbnail fetch returned ${res.status}` };

    const buffer = Buffer.from(await res.arrayBuffer());
    ensureThumbnailsDir();
    const filePath = getThumbnailPath("youtube", videoId);
    fs.writeFileSync(filePath, buffer);
    return { ok: true, filePath };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
