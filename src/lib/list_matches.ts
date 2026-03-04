import { asc, desc, eq } from "drizzle-orm";
import { db, matches } from "@/db";
import type { MatchCategory } from "@/db/schema";

export type MatchRow = typeof matches.$inferSelect;

export type ListMatchesSort = "date" | "opponent";
export type ListMatchesCategoryFilter =
  | "All"
  | "Singles"
  | "Doubles"
  | "Mixed";

export function listMatches(options?: {
  sort?: ListMatchesSort;
  category?: ListMatchesCategoryFilter | MatchCategory;
}): MatchRow[] {
  const sort = options?.sort ?? "date";
  const category = options?.category;
  const categoryFilter =
    category && category !== "All"
      ? eq(matches.category, category)
      : undefined;

  if (categoryFilter) {
    if (sort === "date") {
      return db
        .select()
        .from(matches)
        .where(categoryFilter)
        .orderBy(desc(matches.date))
        .all();
    }
    return db
      .select()
      .from(matches)
      .where(categoryFilter)
      .orderBy(asc(matches.opponent))
      .all();
  }

  if (sort === "date") {
    return db.select().from(matches).orderBy(desc(matches.date)).all();
  }
  return db.select().from(matches).orderBy(asc(matches.opponent)).all();
}
