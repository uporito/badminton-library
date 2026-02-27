import { asc, eq } from "drizzle-orm";
import { db, matchRally, matchShots } from "@/db";

export type RallyRow = typeof matchRally.$inferSelect;
export type ShotRow = typeof matchShots.$inferSelect;

export type RallyWithShots = RallyRow & { shots: ShotRow[] };

export type GetRalliesByMatchIdResult =
  | { ok: true; data: RallyWithShots[] }
  | { ok: false; error: "NOT_FOUND" };

export function getRalliesByMatchId(
  matchId: number
): GetRalliesByMatchIdResult {
  const rallies = db
    .select()
    .from(matchRally)
    .where(eq(matchRally.matchId, matchId))
    .orderBy(asc(matchRally.id))
    .all();
  const allShots = db
    .select()
    .from(matchShots)
    .where(eq(matchShots.matchId, matchId))
    .orderBy(asc(matchShots.id))
    .all();
  const shotsByRallyId = new Map<number, ShotRow[]>();
  for (const s of allShots) {
    const list = shotsByRallyId.get(s.rallyId) ?? [];
    list.push(s);
    shotsByRallyId.set(s.rallyId, list);
  }
  const ralliesWithShots = rallies.map((r) => ({
    ...r,
    shots: shotsByRallyId.get(r.id) ?? [],
  }));
  return { ok: true, data: ralliesWithShots };
}
