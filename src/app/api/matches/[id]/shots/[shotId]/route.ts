import { NextRequest, NextResponse } from "next/server";
import { getMatchById } from "@/lib/get_match_by_id";
import { getDb } from "@/db/client";
import { matchRally, matchShots } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; shotId: string }> }
) {
  const { id, shotId } = await params;
  const matchId = Number(id);
  const shotIdNum = Number(shotId);
  if (Number.isNaN(matchId) || matchId < 1) {
    return Response.json({ error: "Invalid match id" }, { status: 400 });
  }
  if (Number.isNaN(shotIdNum) || shotIdNum < 1) {
    return Response.json({ error: "Invalid shot id" }, { status: 400 });
  }
  const result = getMatchById(matchId);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 404 });
  }
  const db = getDb();
  const [existing] = await db
    .select()
    .from(matchShots)
    .where(
      and(eq(matchShots.id, shotIdNum), eq(matchShots.matchId, matchId))
    )
    .limit(1);
  if (!existing) {
    return Response.json({ error: "Shot not found" }, { status: 404 });
  }
  const rallyId = existing.rallyId;
  await db.delete(matchShots).where(eq(matchShots.id, shotIdNum));
  const [rally] = await db
    .select()
    .from(matchRally)
    .where(eq(matchRally.id, rallyId))
    .limit(1);
  if (rally && rally.rallyLength > 0) {
    const newLength = rally.rallyLength - 1;
    const rallyUpdate: { rallyLength: number; wonByMe: boolean | null } = {
      rallyLength: newLength,
      wonByMe: null,
    };
    if (newLength > 0) {
      const [newLastShot] = await db
        .select({ wonByMe: matchShots.wonByMe })
        .from(matchShots)
        .where(eq(matchShots.rallyId, rallyId))
        .orderBy(desc(matchShots.id))
        .limit(1);
      if (newLastShot) {
        rallyUpdate.wonByMe = newLastShot.wonByMe;
      }
    }
    await db
      .update(matchRally)
      .set(rallyUpdate)
      .where(eq(matchRally.id, rallyId));
  }
  return NextResponse.json({ deleted: shotIdNum }, { status: 200 });
}
