import { NextRequest, NextResponse } from "next/server";
import { getMatchById } from "@/lib/get_match_by_id";
import { getDb } from "@/db/client";
import { matchRally, matchShots } from "@/db/schema";
import { asc, eq } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const numId = Number(id);
  if (Number.isNaN(numId) || numId < 1) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }
  const result = getMatchById(numId);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 404 });
  }
  const db = getDb();
  const rallies = await db
    .select()
    .from(matchRally)
    .where(eq(matchRally.matchId, numId))
    .orderBy(asc(matchRally.id));
  const allShots = await db
    .select()
    .from(matchShots)
    .where(eq(matchShots.matchId, numId))
    .orderBy(asc(matchShots.id));
  const shotsByRallyId = new Map<number, typeof allShots>();
  for (const s of allShots) {
    const list = shotsByRallyId.get(s.rallyId) ?? [];
    list.push(s);
    shotsByRallyId.set(s.rallyId, list);
  }
  const ralliesWithShots = rallies.map((r) => ({
    ...r,
    shots: shotsByRallyId.get(r.id) ?? [],
  }));
  return NextResponse.json(ralliesWithShots, { status: 200 });
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const numId = Number(id);
  if (Number.isNaN(numId) || numId < 1) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }
  const result = getMatchById(numId);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 404 });
  }
  const db = getDb();
  const [rally] = await db
    .insert(matchRally)
    .values({ matchId: numId, rallyLength: 0 })
    .returning();
  if (!rally) {
    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }
  return NextResponse.json(rally, { status: 201 });
}
