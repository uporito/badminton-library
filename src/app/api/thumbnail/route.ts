import { NextRequest } from "next/server";
import fs from "fs";
import {
  thumbnailExists,
  getThumbnailPath,
} from "@/lib/thumbnails";
import { fetchAndCacheGDriveThumbnail } from "@/lib/gdrive";
import { fetchAndCacheYouTubeThumbnail } from "@/lib/youtube";

const VALID_SOURCES = new Set(["gdrive", "youtube"]);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source");
  const video = searchParams.get("video");

  if (!source || !VALID_SOURCES.has(source) || !video) {
    return Response.json(
      { error: "Required params: source (gdrive|youtube), video" },
      { status: 400 },
    );
  }

  if (thumbnailExists(source, video)) {
    const data = fs.readFileSync(getThumbnailPath(source, video));
    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  let result: { ok: true; filePath: string } | { ok: false; error: string };

  if (source === "gdrive") {
    result = await fetchAndCacheGDriveThumbnail(video);
  } else {
    result = await fetchAndCacheYouTubeThumbnail(video);
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
