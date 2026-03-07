import { NextRequest } from "next/server";
import { listGDriveVideos } from "@/lib/gdrive";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const folderId = searchParams.get("folderId") ?? undefined;

  const result = await listGDriveVideos(folderId);
  if (!result.ok) {
    const status = result.error === "GDRIVE_NOT_CONFIGURED" ? 503 : 500;
    return Response.json({ error: result.error }, { status });
  }

  return Response.json({ files: result.files }, { status: 200 });
}
