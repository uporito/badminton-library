import { NextRequest } from "next/server";
import fs from "fs";
import { getMatchById } from "@/lib/get_match_by_id";
import {
  thumbnailExists,
  getThumbnailPath,
  fetchAndCacheGDriveThumbnail,
} from "@/lib/gdrive";
import { fetchAndCacheYouTubeThumbnail } from "@/lib/youtube";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const idParam = searchParams.get("id");
  const matchId = Number(idParam);

  if (!idParam || Number.isNaN(matchId) || matchId < 1) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  if (thumbnailExists(matchId)) {
    const filePath = getThumbnailPath(matchId);
    const data = fs.readFileSync(filePath);
    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  const matchResult = getMatchById(matchId);
  if (!matchResult.ok) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const match = matchResult.data;

  let result: { ok: true; filePath: string } | { ok: false; error: string };

  if (match.videoSource === "gdrive") {
    result = await fetchAndCacheGDriveThumbnail(match.videoPath, matchId);
  } else if (match.videoSource === "youtube") {
    result = await fetchAndCacheYouTubeThumbnail(match.videoPath, matchId);
  } else {
    return Response.json({ error: "No thumbnail available" }, { status: 404 });
  }

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 404 });
  }

  const data = fs.readFileSync(result.filePath);
  return new Response(data, {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
