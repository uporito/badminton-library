import { NextRequest, NextResponse } from "next/server";
import { getMatchById } from "@/lib/get_match_by_id";
import { getDb } from "@/db/client";
import { matchRally } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; rallyId: string }> }
) {
  const { id, rallyId } = await params;
  const matchId = Number(id);
  const rallyIdNum = Number(rallyId);
  if (Number.isNaN(matchId) || matchId < 1) {
    return Response.json({ error: "Invalid match id" }, { status: 400 });
  }
  if (Number.isNaN(rallyIdNum) || rallyIdNum < 1) {
    return Response.json({ error: "Invalid rally id" }, { status: 400 });
  }
  const result = getMatchById(matchId);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 404 });
  }
  const db = getDb();
  const [existing] = await db
    .select()
    .from(matchRally)
    .where(and(eq(matchRally.id, rallyIdNum), eq(matchRally.matchId, matchId)))
    .limit(1);
  if (!existing) {
    return Response.json({ error: "Rally not found" }, { status: 404 });
  }
  await db.delete(matchRally).where(eq(matchRally.id, rallyIdNum));
  return NextResponse.json({ deleted: rallyIdNum }, { status: 200 });
}
