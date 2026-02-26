import { z } from "zod";
import { getDb } from "@/db/client";
import { matches } from "@/db/schema";
import { NextResponse } from "next/server";

const CreateMatchSchema = z.object({
  title: z.string().min(1),
  videoPath: z.string().min(1),
  durationSeconds: z.number().int().nonnegative().optional(),
  date: z.string().optional(),
  opponent: z.string().optional(),
  result: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = CreateMatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const db = getDb();
    const [match] = await db
      .insert(matches)
      .values({
        title: parsed.data.title,
        videoPath: parsed.data.videoPath,
        durationSeconds: parsed.data.durationSeconds ?? null,
        date: parsed.data.date ?? null,
        opponent: parsed.data.opponent ?? null,
        result: parsed.data.result ?? null,
        notes: parsed.data.notes ?? null,
      })
      .returning();
    if (!match) {
      return NextResponse.json({ error: "Insert failed" }, { status: 500 });
    }
    return NextResponse.json(match, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
