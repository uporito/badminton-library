import { eq } from "drizzle-orm";
import { db, matches } from "@/db";

export type MatchRow = typeof matches.$inferSelect;

export type GetMatchByIdResult =
  | { ok: true; data: MatchRow }
  | { ok: false; error: "NOT_FOUND" };

export function getMatchById(id: number): GetMatchByIdResult {
  const row = db.select().from(matches).where(eq(matches.id, id)).get();
  if (!row) return { ok: false, error: "NOT_FOUND" };
  return { ok: true, data: row };
}
