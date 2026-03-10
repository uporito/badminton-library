import { NextRequest } from "next/server";
import path from "path";
import { z } from "zod";
import { listMatches } from "@/lib/list_matches";
import { getDb } from "@/db/client";
import {
  matches,
  matchCategoryEnum,
  videoSourceEnum,
  matchPlayers,
  partnerStatusEnum,
} from "@/db/schema";
import { NextResponse } from "next/server";
import { recomputePlayerStats } from "@/lib/recompute_player_stats";

const SortSchema = z.enum(["date", "opponent"]).optional();
const CategorySchema = z
  .enum(["All", "Singles", "Doubles", "Mixed"])
  .optional();

const CreateMatchBodySchema = z.object({
  title: z.string().min(1).optional(),
  videoPath: z.string().min(1),
  videoSource: z.enum(videoSourceEnum).optional(),
  durationSeconds: z.number().int().nonnegative().optional(),
  date: z.string().optional(),
  opponentIds: z.array(z.number().int().positive()).max(2).optional(),
  partnerId: z.number().int().positive().nullable().optional(),
  partnerStatus: z.enum(partnerStatusEnum).optional(),
  wonByMe: z.boolean().nullable().optional(),
  result: z.string().optional(),
  notes: z.string().optional(),
  myDescription: z.string().optional(),
  opponentDescription: z.string().optional(),
  category: z.enum(matchCategoryEnum).optional(),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sortParam = searchParams.get("sort");
  const categoryParam = searchParams.get("category");
  const sortParsed = SortSchema.safeParse(sortParam ?? undefined);
  const categoryParsed = CategorySchema.safeParse(categoryParam ?? undefined);
  const sort = sortParsed.success ? sortParsed.data ?? "date" : "date";
  const category =
    categoryParsed.success && categoryParsed.data !== "All"
      ? categoryParsed.data
      : undefined;
  const matchList = listMatches({ sort, category });
  return Response.json(matchList, { status: 200 });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = CreateMatchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const {
    title,
    videoPath,
    videoSource,
    durationSeconds,
    date,
    opponentIds,
    partnerId,
    partnerStatus,
    wonByMe,
    result,
    notes,
    myDescription,
    opponentDescription,
    category,
  } = parsed.data;
  const titleToUse =
    title?.trim() ||
    (videoSource === "gdrive" ? videoPath : path.basename(videoPath)) ||
    "Untitled";
  const db = getDb();
  const [created] = await db
    .insert(matches)
    .values({
      title: titleToUse,
      videoPath,
      videoSource: videoSource ?? "local",
      durationSeconds: durationSeconds ?? null,
      date: date ?? null,
      result: result ?? null,
      notes: notes ?? null,
      myDescription: myDescription ?? null,
      opponentDescription: opponentDescription ?? null,
      category: category ?? "Uncategorized",
      wonByMe: wonByMe ?? null,
      partnerStatus: partnerStatus ?? "none",
    })
    .returning();
  if (!created) {
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  }

  const affectedPlayerIds: number[] = [];

  if (opponentIds && opponentIds.length > 0) {
    for (const pid of opponentIds) {
      await db
        .insert(matchPlayers)
        .values({ matchId: created.id, playerId: pid, role: "opponent" });
      affectedPlayerIds.push(pid);
    }
  }

  if (partnerStatus === "player" && partnerId) {
    await db
      .insert(matchPlayers)
      .values({ matchId: created.id, playerId: partnerId, role: "partner" });
    affectedPlayerIds.push(partnerId);
  }

  if (affectedPlayerIds.length > 0 && wonByMe != null) {
    recomputePlayerStats(affectedPlayerIds);
  }

  return NextResponse.json(created, { status: 201 });
}
