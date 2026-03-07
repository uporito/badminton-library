import { NextRequest } from "next/server";
import fs from "fs";
import { Readable } from "stream";
import {
  resolveVideoPath,
  getMimeType,
} from "@/lib/video_path";
import { streamGDriveFile } from "@/lib/gdrive";

async function handleLocalVideo(pathParam: string, rangeHeader: string | null) {
  const result = resolveVideoPath(pathParam);
  if (!result.ok) {
    if (result.error === "ROOT_NOT_SET") {
      return Response.json({ error: "Video root not configured" }, { status: 503 });
    }
    if (result.error === "PATH_INVALID") {
      return Response.json({ error: "Invalid path" }, { status: 400 });
    }
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const { fullPath } = result;
  const stat = fs.statSync(fullPath);
  const contentType = getMimeType(fullPath);
  const totalSize = stat.size;

  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : totalSize - 1;
      const chunkSize = end - start + 1;
      const stream = fs.createReadStream(fullPath, { start, end });
      const webStream = Readable.toWeb(stream) as ReadableStream;
      return new Response(webStream, {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Range": `bytes ${start}-${end}/${totalSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunkSize),
        },
      });
    }
  }

  const nodeStream = fs.createReadStream(fullPath);
  const webStream = Readable.toWeb(nodeStream) as ReadableStream;
  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(totalSize),
      "Accept-Ranges": "bytes",
    },
  });
}

async function handleGDriveVideo(fileId: string, rangeHeader: string | null) {
  const result = await streamGDriveFile(fileId, rangeHeader);
  if (!result.ok) {
    if (result.error === "GDRIVE_NOT_CONFIGURED") {
      return Response.json({ error: "Google Drive not configured" }, { status: 503 });
    }
    return Response.json({ error: result.error }, { status: 500 });
  }

  const webStream = Readable.toWeb(result.stream) as ReadableStream;
  return new Response(webStream, {
    status: result.status,
    headers: result.headers,
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pathParam = searchParams.get("path");
  const source = searchParams.get("source") ?? "local";
  const rangeHeader = request.headers.get("range");

  if (!pathParam || pathParam.trim() === "") {
    return Response.json({ error: "Missing or invalid path" }, { status: 400 });
  }

  if (source === "gdrive") {
    return handleGDriveVideo(pathParam.trim(), rangeHeader);
  }

  return handleLocalVideo(pathParam.trim(), rangeHeader);
}
