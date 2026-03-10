import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "YouTube API key not configured. Set YOUTUBE_API_KEY." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const maxResults = Math.min(
    Math.max(1, Number(searchParams.get("maxResults")) || 10),
    25
  );

  if (!q) {
    return NextResponse.json(
      { error: "Missing query parameter: q" },
      { status: 400 }
    );
  }

  try {
    const youtube = google.youtube({ version: "v3", auth: apiKey });
    const res = await youtube.search.list({
      part: ["snippet"],
      type: ["video"],
      q,
      maxResults,
    });

    const items = (res.data.items ?? [])
      .filter((i): i is typeof i & { id: { videoId: string } } => !!i.id?.videoId)
      .map((i) => ({
        id: i.id.videoId,
        title: i.snippet?.title ?? "",
        publishedAt: i.snippet?.publishedAt ?? null,
        channelTitle: i.snippet?.channelTitle ?? null,
        thumbnailUrl:
          i.snippet?.thumbnails?.medium?.url ??
          i.snippet?.thumbnails?.default?.url ??
          null,
      }));

    return NextResponse.json({ items });
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
