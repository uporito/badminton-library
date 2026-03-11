import { eq, and, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { players, matchPlayers, matches } from "@/db/schema";

export function recomputePlayerStats(playerIds: number[]) {
  const db = getDb();
  const unique = [...new Set(playerIds)];

  for (const pid of unique) {
    const winsAgainst = db
      .select({ count: sql<number>`count(*)` })
      .from(matchPlayers)
      .innerJoin(matches, eq(matchPlayers.matchId, matches.id))
      .where(
        and(
          eq(matchPlayers.playerId, pid),
          eq(matchPlayers.role, "opponent"),
          eq(matches.wonByMe, true),
        ),
      )
      .get();

    const lossesAgainst = db
      .select({ count: sql<number>`count(*)` })
      .from(matchPlayers)
      .innerJoin(matches, eq(matchPlayers.matchId, matches.id))
      .where(
        and(
          eq(matchPlayers.playerId, pid),
          eq(matchPlayers.role, "opponent"),
          eq(matches.wonByMe, false),
        ),
      )
      .get();

    const winsWith = db
      .select({ count: sql<number>`count(*)` })
      .from(matchPlayers)
      .innerJoin(matches, eq(matchPlayers.matchId, matches.id))
      .where(
        and(
          eq(matchPlayers.playerId, pid),
          eq(matchPlayers.role, "partner"),
          eq(matches.wonByMe, true),
        ),
      )
      .get();

    const lossesWith = db
      .select({ count: sql<number>`count(*)` })
      .from(matchPlayers)
      .innerJoin(matches, eq(matchPlayers.matchId, matches.id))
      .where(
        and(
          eq(matchPlayers.playerId, pid),
          eq(matchPlayers.role, "partner"),
          eq(matches.wonByMe, false),
        ),
      )
      .get();

    db.update(players)
      .set({
        winsAgainst: winsAgainst?.count ?? 0,
        lossesAgainst: lossesAgainst?.count ?? 0,
        winsWith: winsWith?.count ?? 0,
        lossesWith: lossesWith?.count ?? 0,
        updatedAt: new Date(),
      })
      .where(eq(players.id, pid))
      .run();
  }
}
