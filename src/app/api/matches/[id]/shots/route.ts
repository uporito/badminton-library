import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMatchById } from "@/lib/get_match_by_id";
import { getDb } from "@/db/client";
import {
  matchRally,
  matchShots,
  shotTypeEnum,
  sideEnum,
  zoneEnum,
  outcomeEnum,
} from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";

const CreateShotBodySchema = z.object({
  rallyId: z.number().int().positive().optional(),
  shotType: z.enum(shotTypeEnum),
  zoneFromSide: z.enum(sideEnum),
  zoneFrom: z.enum(zoneEnum),
  zoneToSide: z.enum(sideEnum),
  zoneTo: z.enum(zoneEnum),
  outcome: z.enum(outcomeEnum),
  player: z.enum(sideEnum),
});

export async function GET(
  request: NextRequest,
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
  const rallyIdParam = request.nextUrl.searchParams.get("rallyId");
  const rallyIdNum =
    rallyIdParam !== null ? Number(rallyIdParam) : undefined;
  const where =
    rallyIdNum !== undefined && !Number.isNaN(rallyIdNum)
      ? and(eq(matchShots.matchId, numId), eq(matchShots.rallyId, rallyIdNum))
      : eq(matchShots.matchId, numId);
  const shotsList = await db
    .select()
    .from(matchShots)
    .where(where)
    .orderBy(asc(matchShots.id));
  return NextResponse.json(shotsList, { status: 200 });
}

export async function POST(
  request: NextRequest,
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
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = CreateShotBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;
  const isLastShotOfRally =
    data.outcome === "winner" || data.outcome === "error";
  const db = getDb();
  let rallyId = data.rallyId;
  let rallyCreated = false;
  if (rallyId === undefined) {
    const [newRally] = await db
      .insert(matchRally)
      .values({ matchId: numId, rallyLength: 0 })
      .returning();
    if (!newRally) {
      return NextResponse.json({ error: "Create rally failed" }, { status: 500 });
    }
    rallyId = newRally.id;
    rallyCreated = true;
  } else {
    const [existing] = await db
      .select()
      .from(matchRally)
      .where(eq(matchRally.id, rallyId))
      .limit(1);
    if (!existing || existing.matchId !== numId) {
      return NextResponse.json({ error: "Rally not found" }, { status: 404 });
    }
  }
  const [shot] = await db
    .insert(matchShots)
    .values({
      matchId: numId,
      rallyId,
      shotType: data.shotType,
      zoneFromSide: data.zoneFromSide,
      zoneFrom: data.zoneFrom,
      zoneToSide: data.zoneToSide,
      zoneTo: data.zoneTo,
      outcome: data.outcome,
      isLastShotOfRally,
      player: data.player,
    })
    .returning();
  if (!shot) {
    return NextResponse.json({ error: "Create shot failed" }, { status: 500 });
  }
  const [updatedRally] = await db
    .select()
    .from(matchRally)
    .where(eq(matchRally.id, rallyId))
    .limit(1);
  const currentLength = updatedRally?.rallyLength ?? 0;
  await db
    .update(matchRally)
    .set({ rallyLength: currentLength + 1 })
    .where(eq(matchRally.id, rallyId));
  return NextResponse.json(
    { shot, rallyCreated: rallyCreated ? { id: rallyId } : undefined },
    { status: 201 }
  );
}
