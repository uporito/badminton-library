import { getDb } from "@/db/client";
import { matches } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const matchId = parseInt(id, 10);
    if (Number.isNaN(matchId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const db = getDb();
    const [existing] = await db
      .select()
      .from(matches)
      .where(eq(matches.id, matchId))
      .limit(1);
    if (!existing) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }
    await db.delete(matches).where(eq(matches.id, matchId));
    return NextResponse.json({ deleted: matchId }, { status: 200 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
