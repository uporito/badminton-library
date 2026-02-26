import { asc, desc } from "drizzle-orm";
import { db, matches } from "@/db";

export type MatchRow = typeof matches.$inferSelect;

export type ListMatchesSort = "date" | "title" | "createdAt";

export function listMatches(options?: {
  sort?: ListMatchesSort;
}): MatchRow[] {
  const sort = options?.sort ?? "createdAt";
  const orderColumn =
    sort === "date"
      ? matches.date
      : sort === "title"
        ? matches.title
        : matches.createdAt;
  const orderDir = sort === "title" ? asc : desc;
  return db.select().from(matches).orderBy(orderDir(orderColumn)).all();
}
