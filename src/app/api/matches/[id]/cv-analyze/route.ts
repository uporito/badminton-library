import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db/client";
import { matchRally, matchShots } from "@/db/schema";
import { getMatchById } from "@/lib/get_match_by_id";
import { resolveVideoPath } from "@/lib/video_path";
import { getAccessToken, isGDriveConfigured } from "@/lib/gdrive";

const CV_SERVICE_URL = process.env.CV_SERVICE_URL ?? "http://127.0.0.1:8100";

const CalibrationSchema = z
  .object({
    top_left: z.object({ x: z.number(), y: z.number() }),
    top_right: z.object({ x: z.number(), y: z.number() }),
    bottom_right: z.object({ x: z.number(), y: z.number() }),
    bottom_left: z.object({ x: z.number(), y: z.number() }),
    near_side: z.enum(["me", "opponent"]).default("me"),
  })
  .nullable()
  .optional();

const FeaturesSchema = z
  .object({
    shot_type: z.boolean().default(true),
    placement: z.boolean().default(true),
    outcome: z.boolean().default(true),
  })
  .optional();

const BodySchema = z.object({
  calibration: CalibrationSchema,
  features: FeaturesSchema,
});

function computeWonByMe(
  outcome: string,
  player: string
): boolean | null {
  if (outcome === "neither") return null;
  const isMyTeam = player === "me" || player === "partner";
  if (outcome === "winner") return isMyTeam;
  return !isMyTeam;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const matchId = parseInt(id, 10);
  if (Number.isNaN(matchId) || matchId < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const matchResult = getMatchById(matchId);
  if (!matchResult.ok) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const match = matchResult.data;
  if (match.videoSource !== "local" && match.videoSource !== "gdrive") {
    return NextResponse.json(
      { error: "CV analysis only supports local and Google Drive videos" },
      { status: 400 }
    );
  }

  let body: z.infer<typeof BodySchema> = { calibration: null, features: undefined };
  try {
    const raw = await request.json();
    body = BodySchema.parse(raw);
  } catch {
    // ok to proceed without calibration or features
  }

  let cvPayload: Record<string, unknown>;

  if (match.videoSource === "gdrive") {
    if (!isGDriveConfigured()) {
      return NextResponse.json(
        { error: "Google Drive is not configured on this server" },
        { status: 503 }
      );
    }
    const token = await getAccessToken();
    if (!token) {
      return NextResponse.json(
        { error: "Could not obtain Google Drive access token" },
        { status: 503 }
      );
    }
    const fileId = match.videoPath;
    const videoUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`;
    cvPayload = {
      video_url: videoUrl,
      auth_header: `Bearer ${token}`,
      match_id: matchId,
      calibration: body.calibration ?? null,
      features: body.features ?? null,
    };
  } else {
    const videoResult = resolveVideoPath(match.videoPath);
    if (!videoResult.ok) {
      return NextResponse.json(
        { error: "Video file not found" },
        { status: 404 }
      );
    }
    cvPayload = {
      video_path: videoResult.fullPath,
      match_id: matchId,
      calibration: body.calibration ?? null,
      features: body.features ?? null,
    };
  }

  try {
    const cvRes = await fetch(`${CV_SERVICE_URL}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cvPayload),
    });

    if (!cvRes.ok) {
      const detail = await cvRes.text().catch(() => "Unknown error");
      return NextResponse.json(
        { error: "CV service error", detail },
        { status: 502 }
      );
    }

    const job = await cvRes.json();
    return NextResponse.json({ job_id: job.job_id, status: job.status });
  } catch (e) {
    return NextResponse.json(
      {
        error: "Cannot reach CV service. Make sure the Python service is running on " + CV_SERVICE_URL,
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 503 }
    );
  }
}

const writtenJobs = new Set<string>();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const matchId = parseInt(id, 10);
  const jobId = request.nextUrl.searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  try {
    const cvRes = await fetch(`${CV_SERVICE_URL}/jobs/${jobId}`);
    if (!cvRes.ok) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const job = await cvRes.json();

    if (job.status === "completed" && job.result && !writtenJobs.has(jobId)) {
      try {
        await writeResultsToDb(matchId, job.result);
        writtenJobs.add(jobId);
      } catch (e) {
        return NextResponse.json(
          {
            ...job,
            db_write_error: e instanceof Error ? e.message : String(e),
          },
          { status: 200 }
        );
      }
    }

    return NextResponse.json(job);
  } catch {
    return NextResponse.json(
      { error: "Cannot reach CV service" },
      { status: 503 }
    );
  }
}

async function writeResultsToDb(
  matchId: number,
  result: {
    rallies: Array<{
      won_by_me: boolean | null;
      shots: Array<{
        shot_type: string;
        player: string;
        zone_from_side: string;
        zone_from: string;
        zone_to_side: string;
        zone_to: string;
        outcome: string;
        timestamp: number;
      }>;
    }>;
  }
) {
  const db = getDb();

  for (const rally of result.rallies) {
    const [newRally] = await db
      .insert(matchRally)
      .values({
        matchId,
        rallyLength: rally.shots.length,
        wonByMe: rally.won_by_me,
      })
      .returning();

    if (!newRally) continue;

    for (let i = 0; i < rally.shots.length; i++) {
      const shot = rally.shots[i];
      const isLast = i === rally.shots.length - 1;
      const wonByMe = isLast
        ? computeWonByMe(shot.outcome, shot.player)
        : null;

      await db.insert(matchShots).values({
        matchId,
        rallyId: newRally.id,
        shotType: shot.shot_type as any,
        zoneFromSide: shot.zone_from_side as any,
        zoneFrom: shot.zone_from as any,
        zoneToSide: shot.zone_to_side as any,
        zoneTo: shot.zone_to as any,
        outcome: isLast ? (shot.outcome as any) : "neither",
        wonByMe,
        isLastShotOfRally:
          isLast && (shot.outcome === "winner" || shot.outcome === "error"),
        player: shot.player as any,
        source: "ai_suggested",
        timestamp: shot.timestamp,
      });
    }
  }
}
