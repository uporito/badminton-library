import { NextRequest, NextResponse } from "next/server";
import { analyzeMatch } from "@/lib/analyze_match";

// Allow up to 10 minutes for upload + Gemini processing + generation (long videos).
export const maxDuration = 600;

const ERROR_STATUS: Record<string, number> = {
  NOT_FOUND: 404,
  VIDEO_NOT_FOUND: 404,
  API_KEY_MISSING: 500,
  UPLOAD_FAILED: 502,
  PROCESSING_FAILED: 502,
  GENERATION_FAILED: 502,
  PARSE_FAILED: 502,
  DB_WRITE_FAILED: 500,
};

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const matchId = parseInt(id, 10);
  if (Number.isNaN(matchId) || matchId < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const result = await analyzeMatch(matchId);

  if (!result.ok) {
    const status = ERROR_STATUS[result.error] ?? 500;
    return NextResponse.json(
      { error: result.error, detail: result.detail },
      { status }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      rallyCount: result.data.rallyCount,
      shotCount: result.data.shotCount,
    },
    { status: 200 }
  );
}
