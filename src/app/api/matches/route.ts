import { NextRequest } from "next/server";
import path from "path";
import { z } from "zod";
import { listMatches } from "@/lib/list_matches";
import { db, matches } from "@/db";

const SortSchema = z.enum(["date", "title", "createdAt"]).optional();

const CreateMatchBodySchema = z.object({
  title: z.string().min(1).optional(),
  videoPath: z.string().min(1),
  durationSeconds: z.number().int().nonnegative().optional(),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sortParam = searchParams.get("sort");
  const parsed = SortSchema.safeParse(sortParam ?? undefined);
  const sort = parsed.success ? parsed.data ?? "createdAt" : "createdAt";
  const matchList = listMatches({ sort });
  return Response.json(matchList, { status: 200 });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = CreateMatchBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { title, videoPath, durationSeconds } = parsed.data;
  const titleToUse = title?.trim() || path.basename(videoPath) || "Untitled";
  const [created] = db
    .insert(matches)
    .values({ title: titleToUse, videoPath, durationSeconds: durationSeconds ?? null })
    .returning()
    .all();
  if (!created) {
    return Response.json({ error: "Insert failed" }, { status: 500 });
  }
  return Response.json(created, { status: 201 });
}
