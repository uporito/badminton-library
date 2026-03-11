import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMatchById } from "@/lib/get_match_by_id";
import { getDb } from "@/db/client";
import {
  matches,
  matchCategoryEnum,
  videoSourceEnum,
  matchPlayers,
  partnerStatusEnum,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { serializeTags } from "@/lib/tags";
import { deleteThumbnail } from "@/lib/thumbnails";
import { recomputePlayerStats } from "@/lib/recompute_player_stats";

const UpdateMatchBodySchema = z.object({
  title: z.string().min(1).optional(),
  videoPath: z.string().min(1).optional(),
  videoSource: z.enum(videoSourceEnum).optional(),
  durationSeconds: z.number().int().nonnegative().optional().nullable(),
  date: z.string().optional().nullable(),
  result: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  myDescription: z.string().optional().nullable(),
  opponentDescription: z.string().optional().nullable(),
  category: z.enum(matchCategoryEnum).optional(),
  tags: z.array(z.string()).optional(),
  opponentIds: z.array(z.number().int().positive()).max(2).optional(),
  partnerId: z.number().int().positive().nullable().optional(),
  partnerStatus: z.enum(partnerStatusEnum).optional(),
  wonByMe: z.boolean().nullable().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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
  { params }: { params: Promise<{ id: string }> },
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
      return NextResponse.json(
        { error: "Match not found" },
        { status: 404 },
      );
    }

    const oldPlayers = await db
      .select({ playerId: matchPlayers.playerId })
      .from(matchPlayers)
      .where(eq(matchPlayers.matchId, matchId));
    const oldPlayerIds = oldPlayers.map((r) => r.playerId);

    await db.delete(matches).where(eq(matches.id, matchId));
    deleteThumbnail(existing.videoSource, existing.videoPath);

    if (oldPlayerIds.length > 0) {
      recomputePlayerStats(oldPlayerIds);
    }

    return NextResponse.json({ deleted: matchId }, { status: 200 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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
      { status: 400 },
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
  if (data.videoSource !== undefined) setValues.videoSource = data.videoSource;
  if (data.durationSeconds !== undefined)
    setValues.durationSeconds = data.durationSeconds;
  if (data.date !== undefined) setValues.date = data.date;
  if (data.result !== undefined) setValues.result = data.result;
  if (data.notes !== undefined) setValues.notes = data.notes;
  if (data.myDescription !== undefined)
    setValues.myDescription = data.myDescription;
  if (data.opponentDescription !== undefined)
    setValues.opponentDescription = data.opponentDescription;
  if (data.category !== undefined) setValues.category = data.category;
  if (data.tags !== undefined) setValues.tags = serializeTags(data.tags);
  if (data.wonByMe !== undefined) setValues.wonByMe = data.wonByMe;
  if (data.partnerStatus !== undefined)
    setValues.partnerStatus = data.partnerStatus;

  const affectedPlayerIds: number[] = [];

  const oldMatchData = result.data;
  const oldOpponentIds = oldMatchData.opponents.map((o) => o.id);
  const oldPartnerId = oldMatchData.partner?.id ?? null;
  for (const id of oldOpponentIds) affectedPlayerIds.push(id);
  if (oldPartnerId) affectedPlayerIds.push(oldPartnerId);

  if (data.opponentIds !== undefined || data.partnerId !== undefined || data.partnerStatus !== undefined) {
    await db
      .delete(matchPlayers)
      .where(eq(matchPlayers.matchId, matchId));

    const newOpponentIds = data.opponentIds ?? oldOpponentIds;
    for (const pid of newOpponentIds) {
      await db
        .insert(matchPlayers)
        .values({ matchId, playerId: pid, role: "opponent" });
      affectedPlayerIds.push(pid);
    }

    const pStatus = data.partnerStatus ?? oldMatchData.partnerStatus;
    const newPartnerId = data.partnerId !== undefined ? data.partnerId : oldPartnerId;
    if (pStatus === "player" && newPartnerId) {
      await db
        .insert(matchPlayers)
        .values({ matchId, playerId: newPartnerId, role: "partner" });
      affectedPlayerIds.push(newPartnerId);
    }
  }

  const [updated] = await db
    .update(matches)
    .set(setValues)
    .where(eq(matches.id, matchId))
    .returning();
  if (!updated) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  const uniquePlayerIds = [...new Set(affectedPlayerIds)];
  if (uniquePlayerIds.length > 0) {
    recomputePlayerStats(uniquePlayerIds);
  }

  const freshResult = getMatchById(matchId);
  if (!freshResult.ok) {
    return NextResponse.json(updated, { status: 200 });
  }
  return NextResponse.json(freshResult.data, { status: 200 });
}
