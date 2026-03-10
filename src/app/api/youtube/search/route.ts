import { NextRequest } from "next/server";
import { z } from "zod";
import {
  searchYouTubeVideos,
  getYouTubeVideoDetails,
  parseYouTubeVideoId,
  looksLikeYouTubeUrl,
} from "@/lib/youtube";

const SearchParamsSchema = z.object({
  q: z.string().min(1),
  maxResults: z.coerce.number().int().min(1).max(25).optional(),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsed = SearchParamsSchema.safeParse({
    q: searchParams.get("q") ?? "",
    maxResults: searchParams.get("maxResults") ?? undefined,
  });

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid query params", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { q, maxResults } = parsed.data;

  // If input looks like a YouTube URL, resolve the single video directly
  if (looksLikeYouTubeUrl(q)) {
    const videoId = parseYouTubeVideoId(q);
    if (videoId) {
      const result = await getYouTubeVideoDetails(videoId);
      if (!result.ok) {
        return Response.json({ error: result.error }, { status: 502 });
      }
      return Response.json({ videos: [result.video] });
    }
  }

  const result = await searchYouTubeVideos(q, maxResults ?? 10);
  if (!result.ok) {
    if (result.error === "YOUTUBE_NOT_CONFIGURED") {
      return Response.json({ error: "YouTube API not configured" }, { status: 503 });
    }
    return Response.json({ error: result.error }, { status: 502 });
  }

  return Response.json({ videos: result.videos });
}
