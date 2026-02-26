import { NextRequest } from "next/server";
import fs from "fs";
import { Readable } from "stream";
import {
  resolveVideoPath,
  getMimeType,
} from "@/lib/video_path";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pathParam = searchParams.get("path");
  if (!pathParam || pathParam.trim() === "") {
    return Response.json(
      { error: "Missing or invalid path" },
      { status: 400 }
    );
  }
  const result = resolveVideoPath(pathParam.trim());
  if (!result.ok) {
    if (result.error === "ROOT_NOT_SET") {
      return Response.json(
        { error: "Video root not configured" },
        { status: 503 }
      );
    }
    if (result.error === "PATH_INVALID") {
      return Response.json(
        { error: "Invalid path" },
        { status: 400 }
      );
    }
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const { fullPath } = result;
  const stat = fs.statSync(fullPath);
  const contentType = getMimeType(fullPath);
  const nodeStream = fs.createReadStream(fullPath);
  const webStream = Readable.toWeb(nodeStream) as ReadableStream;
  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(stat.size),
    },
  });
}
