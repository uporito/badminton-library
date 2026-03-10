import { desc, eq } from "drizzle-orm";
import { db, matches } from "@/db";
import type { MatchCategory } from "@/db/schema";
import { enrichMatch, type MatchRow } from "./get_match_by_id";

export type { MatchRow };

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

  let baseRows;
  if (categoryFilter) {
    baseRows = db
      .select()
      .from(matches)
      .where(categoryFilter)
      .orderBy(desc(matches.date))
      .all();
  } else {
    baseRows = db
      .select()
      .from(matches)
      .orderBy(desc(matches.date))
      .all();
  }

  const enriched = baseRows.map(enrichMatch);

  if (sort === "opponent") {
    enriched.sort((a, b) => {
      const nameA = a.opponents[0]?.name ?? "";
      const nameB = b.opponents[0]?.name ?? "";
      return nameA.localeCompare(nameB);
    });
  }

  return enriched;
}
