import { NextRequest } from "next/server";
import { getYouTubeVideoDetails, parseYouTubeVideoId } from "@/lib/youtube";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const idParam = searchParams.get("id") ?? "";

  const videoId = parseYouTubeVideoId(idParam);
  if (!videoId) {
    return Response.json({ error: "Invalid or missing video ID" }, { status: 400 });
  }

  const result = await getYouTubeVideoDetails(videoId);
  if (!result.ok) {
    if (result.error === "YOUTUBE_NOT_CONFIGURED") {
      return Response.json({ error: "YouTube API not configured" }, { status: 503 });
    }
    if (result.error === "VIDEO_NOT_FOUND") {
      return Response.json({ error: "Video not found" }, { status: 404 });
    }
    return Response.json({ error: result.error }, { status: 502 });
  }

  return Response.json(result.video);
}
