import { NextRequest, NextResponse } from "next/server";
import { parseYouTubeVideoId } from "@/lib/youtube";

export const dynamic = "force-dynamic";

/**
 * Parse ISO 8601 duration (e.g. PT1H2M10S) to seconds.
 */
function parseDurationISO8601(duration: string): number | null {
  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;
  const hours = parseInt(match[1] ?? "0", 10);
  const minutes = parseInt(match[2] ?? "0", 10);
  const seconds = parseInt(match[3] ?? "0", 10);
  return hours * 3600 + minutes * 60 + seconds;
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "YouTube API key not configured. Set YOUTUBE_API_KEY." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const idParam = searchParams.get("id")?.trim();
  const urlParam = searchParams.get("url")?.trim();

  let videoId: string | null = idParam || null;
  if (!videoId && urlParam) {
    videoId = parseYouTubeVideoId(urlParam);
  }
  if (!videoId) {
    return NextResponse.json(
      { error: "Missing or invalid id or url parameter" },
      { status: 400 }
    );
  }

  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("part", "snippet,contentDetails");
  url.searchParams.set("id", videoId);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: "YouTube API error", details: text },
      { status: 502 }
    );
  }

  const data = (await res.json()) as {
    items?: Array<{
      id?: string;
      snippet?: { title?: string; publishedAt?: string };
      contentDetails?: { duration?: string };
    }>;
  };

  const item = data.items?.[0];
  if (!item) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  const rawDuration = item.contentDetails?.duration;
  const durationSeconds = rawDuration
    ? parseDurationISO8601(rawDuration)
    : null;

  return NextResponse.json({
    id: item.id,
    title: item.snippet?.title ?? "Untitled",
    publishedAt: item.snippet?.publishedAt ?? null,
    durationSeconds,
  });
}
