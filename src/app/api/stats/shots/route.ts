import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db/client";
import { matchShots } from "@/db/schema";
import { asc, inArray } from "drizzle-orm";

type ShotRow = (typeof matchShots)["$inferSelect"];

const QuerySchema = z.object({
  matchIds: z
    .string()
    .optional()
    .transform((s) => {
      if (!s) return undefined;
      return s
        .split(",")
        .map((id) => Number(id.trim()))
        .filter((n) => Number.isInteger(n) && n >= 1);
    }),
});

/** GET /api/stats/shots?matchIds=1,2,3 — returns shots for the given match IDs. Omit matchIds for all matches. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    matchIds: searchParams.get("matchIds") ?? undefined,
  });
  const matchIds = parsed.success ? parsed.data.matchIds : undefined;

  const db = getDb();
  let shots: ShotRow[];
  if (matchIds === undefined) {
    shots = await db
      .select()
      .from(matchShots)
      .orderBy(asc(matchShots.matchId), asc(matchShots.id));
  } else {
    if (matchIds.length === 0) {
      shots = [];
    } else {
      shots = await db
        .select()
        .from(matchShots)
        .where(inArray(matchShots.matchId, matchIds))
        .orderBy(asc(matchShots.matchId), asc(matchShots.id));
    }
  }
  return NextResponse.json(shots, { status: 200 });
}
