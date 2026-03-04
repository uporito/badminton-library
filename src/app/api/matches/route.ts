import { NextRequest } from "next/server";
import path from "path";
import { z } from "zod";
import { listMatches } from "@/lib/list_matches";
import { getDb } from "@/db/client";
import { matches, matchCategoryEnum } from "@/db/schema";
import { NextResponse } from "next/server";

const SortSchema = z.enum(["date", "opponent"]).optional();
const CategorySchema = z
  .enum(["All", "Singles", "Doubles", "Mixed"])
  .optional();

const CreateMatchBodySchema = z.object({
  title: z.string().min(1).optional(),
  videoPath: z.string().min(1),
  durationSeconds: z.number().int().nonnegative().optional(),
  date: z.string().optional(),
  opponent: z.string().optional(),
  result: z.string().optional(),
  notes: z.string().optional(),
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
      { status: 400 }
    );
  }
  const {
    title,
    videoPath,
    durationSeconds,
    date,
    opponent,
    result,
    notes,
    category,
  } = parsed.data;
  const titleToUse =
    title?.trim() || path.basename(videoPath) || "Untitled";
  const db = getDb();
  const [created] = await db
    .insert(matches)
    .values({
      title: titleToUse,
      videoPath,
      durationSeconds: durationSeconds ?? null,
      date: date ?? null,
      opponent: opponent ?? null,
      result: result ?? null,
      notes: notes ?? null,
      category: category ?? "Uncategorized",
    })
    .returning();
  if (!created) {
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  }
  return NextResponse.json(created, { status: 201 });
}
