import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
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

  try {
    const youtube = google.youtube({ version: "v3", auth: apiKey });
    const res = await youtube.videos.list({
      part: ["snippet", "contentDetails"],
      id: [videoId],
    });

    const item = res.data.items?.[0];
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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const details =
      err && typeof err === "object" && "response" in err
        ? String((err as { response?: { data?: unknown } }).response?.data)
        : message;
    return NextResponse.json(
      { error: "YouTube API error", details },
      { status: 502 }
    );
  }
}
