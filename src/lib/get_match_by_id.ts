import { eq } from "drizzle-orm";
import { db, matches, matchPlayers, players } from "@/db";

export type MatchRowBase = typeof matches.$inferSelect;

export interface PlayerRef {
  id: number;
  name: string;
}

export interface MatchRow extends MatchRowBase {
  opponents: PlayerRef[];
  partner: PlayerRef | null;
}

export type GetMatchByIdResult =
  | { ok: true; data: MatchRow }
  | { ok: false; error: "NOT_FOUND" };

export function getMatchById(id: number): GetMatchByIdResult {
  const row = db.select().from(matches).where(eq(matches.id, id)).get();
  if (!row) return { ok: false, error: "NOT_FOUND" };
  return { ok: true, data: enrichMatch(row) };
}

export function enrichMatch(row: MatchRowBase): MatchRow {
  const mpRows = db
    .select({
      playerId: matchPlayers.playerId,
      role: matchPlayers.role,
      playerName: players.name,
    })
    .from(matchPlayers)
    .innerJoin(players, eq(matchPlayers.playerId, players.id))
    .where(eq(matchPlayers.matchId, row.id))
    .all();

  const opponents: PlayerRef[] = [];
  let partner: PlayerRef | null = null;

  for (const mp of mpRows) {
    const ref: PlayerRef = { id: mp.playerId, name: mp.playerName };
    if (mp.role === "opponent") opponents.push(ref);
    else if (mp.role === "partner") partner = ref;
  }

  return { ...row, opponents, partner };
}
