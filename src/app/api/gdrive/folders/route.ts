import { NextRequest } from "next/server";
import { listGDriveFolders } from "@/lib/gdrive";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parentId = searchParams.get("parentId") ?? undefined;

  const result = await listGDriveFolders(parentId);
  if (!result.ok) {
    const status = result.error === "GDRIVE_NOT_CONFIGURED" ? 503 : 500;
    return Response.json({ error: result.error }, { status });
  }

  return Response.json({ folders: result.folders }, { status: 200 });
}
