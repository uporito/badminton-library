import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMatchById } from "@/lib/get_match_by_id";
import { getDb } from "@/db/client";
import { matches } from "@/db/schema";
import { matchCategoryEnum } from "@/db/schema";
import { eq } from "drizzle-orm";

const UpdateMatchBodySchema = z.object({
  title: z.string().min(1).optional(),
  videoPath: z.string().min(1).optional(),
  durationSeconds: z.number().int().nonnegative().optional().nullable(),
  date: z.string().optional().nullable(),
  opponent: z.string().optional().nullable(),
  result: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  category: z.enum(matchCategoryEnum).optional(),
});

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const matchId = parseInt(id, 10);
  if (Number.isNaN(matchId) || matchId < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = UpdateMatchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const result = getMatchById(matchId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  const db = getDb();
  const data = parsed.data;
  const setValues: Partial<typeof matches.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (data.title !== undefined) setValues.title = data.title;
  if (data.videoPath !== undefined) setValues.videoPath = data.videoPath;
  if (data.durationSeconds !== undefined)
    setValues.durationSeconds = data.durationSeconds;
  if (data.date !== undefined) setValues.date = data.date;
  if (data.opponent !== undefined) setValues.opponent = data.opponent;
  if (data.result !== undefined) setValues.result = data.result;
  if (data.notes !== undefined) setValues.notes = data.notes;
  if (data.category !== undefined) setValues.category = data.category;

  const [updated] = await db
    .update(matches)
    .set(setValues)
    .where(eq(matches.id, matchId))
    .returning();
  if (!updated) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
  return NextResponse.json(updated, { status: 200 });
}
