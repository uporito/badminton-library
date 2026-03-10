import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db/client";
import { players } from "@/db/schema";
import { asc, eq } from "drizzle-orm";

const CreatePlayerSchema = z.object({
  name: z.string().min(1).trim(),
});

export async function GET() {
  const db = getDb();
  const rows = await db
    .select()
    .from(players)
    .orderBy(asc(players.name));
  return Response.json(rows, { status: 200 });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = CreatePlayerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const db = getDb();
  try {
    const [created] = await db
      .insert(players)
      .values({ name: parsed.data.name })
      .returning();
    return NextResponse.json(created, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("UNIQUE constraint")) {
      const existing = await db
        .select()
        .from(players)
        .where(eq(players.name, parsed.data.name));
      if (existing[0]) {
        return NextResponse.json(existing[0], { status: 200 });
      }
    }
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  }
}
