import { NextRequest } from "next/server";
import { getMatchById } from "@/lib/get_match_by_id";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const numId = Number(id);
  if (Number.isNaN(numId) || numId < 1) {
    return Response.json({ error: "Invalid id" }, { status: 404 });
  }
  const result = getMatchById(numId);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 404 });
  }
  return Response.json(result.data, { status: 200 });
}
