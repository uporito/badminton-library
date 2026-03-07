import {
  GoogleGenAI,
  createUserContent,
  createPartFromUri,
  FileState,
} from "@google/genai";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  matchRally,
  matchShots,
  shotTypeEnum,
  sideEnum,
  zoneEnum,
  outcomeEnum,
} from "@/db/schema";
import { getMatchById } from "./get_match_by_id";
import { resolveVideoPath, getMimeType } from "./video_path";
import { downloadGDriveFileToBuffer } from "./gdrive";
import { buildAnalyzeMatchPrompt } from "./prompts/analyze_match_prompt";

const AnalysisShotSchema = z.object({
  shotType: z.enum(shotTypeEnum),
  player: z.enum(sideEnum),
  zoneFromSide: z.enum(sideEnum),
  zoneFrom: z.enum(zoneEnum),
  zoneToSide: z.enum(sideEnum),
  zoneTo: z.enum(zoneEnum),
  outcome: z.enum(outcomeEnum),
});

const AnalysisRallySchema = z.object({
  wonByMe: z.boolean(),
  shots: z.array(AnalysisShotSchema).min(1),
});

const AnalysisResponseSchema = z.object({
  rallies: z.array(AnalysisRallySchema),
});

const RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    rallies: {
      type: "array",
      items: {
        type: "object",
        properties: {
          wonByMe: { type: "boolean" },
          shots: {
            type: "array",
            items: {
              type: "object",
              properties: {
                shotType: {
                  type: "string",
                  enum: [...shotTypeEnum],
                },
                player: {
                  type: "string",
                  enum: [...sideEnum],
                },
                zoneFromSide: {
                  type: "string",
                  enum: [...sideEnum],
                },
                zoneFrom: {
                  type: "string",
                  enum: [...zoneEnum],
                },
                zoneToSide: {
                  type: "string",
                  enum: [...sideEnum],
                },
                zoneTo: {
                  type: "string",
                  enum: [...zoneEnum],
                },
                outcome: {
                  type: "string",
                  enum: [...outcomeEnum],
                },
              },
              required: [
                "shotType",
                "player",
                "zoneFromSide",
                "zoneFrom",
                "zoneToSide",
                "zoneTo",
                "outcome",
              ],
            },
          },
        },
        required: ["wonByMe", "shots"],
      },
    },
  },
  required: ["rallies"],
};

type AnalyzeMatchError =
  | "NOT_FOUND"
  | "VIDEO_NOT_FOUND"
  | "API_KEY_MISSING"
  | "UPLOAD_FAILED"
  | "PROCESSING_FAILED"
  | "GENERATION_FAILED"
  | "PARSE_FAILED"
  | "DB_WRITE_FAILED";

export type AnalyzeMatchResult =
  | { ok: true; data: { rallyCount: number; shotCount: number } }
  | { ok: false; error: AnalyzeMatchError; detail?: string };

const POLL_INTERVAL_MS = 3_000;
const MAX_POLL_ATTEMPTS = 120; // 6 minutes max wait for file processing

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

async function waitForFileActive(
  ai: GoogleGenAI,
  fileName: string
): Promise<boolean> {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    const file = await ai.files.get({ name: fileName });
    if (file.state === FileState.ACTIVE) return true;
    if (file.state === FileState.FAILED) return false;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return false;
}

function computeWonByMe(
  outcome: (typeof outcomeEnum)[number],
  player: (typeof sideEnum)[number]
): boolean | null {
  if (outcome === "neither") return null;
  if (outcome === "winner") return player === "me";
  return player === "opponent";
}

export async function analyzeMatch(
  matchId: number
): Promise<AnalyzeMatchResult> {
  const matchResult = getMatchById(matchId);
  if (!matchResult.ok) return { ok: false, error: "NOT_FOUND" };

  const match = matchResult.data;
  const ai = getGeminiClient();
  if (!ai) return { ok: false, error: "API_KEY_MISSING" };

  let uploadedFile;
  try {
    if (match.videoSource === "gdrive") {
      const dlResult = await downloadGDriveFileToBuffer(match.videoPath);
      if (!dlResult.ok) return { ok: false, error: "VIDEO_NOT_FOUND", detail: dlResult.error };
      const uint8 = new Uint8Array(dlResult.buffer);
      uploadedFile = await ai.files.upload({
        file: new Blob([uint8], { type: dlResult.mimeType }),
        config: { mimeType: dlResult.mimeType },
      });
    } else {
      const videoResult = resolveVideoPath(match.videoPath);
      if (!videoResult.ok) return { ok: false, error: "VIDEO_NOT_FOUND" };
      uploadedFile = await ai.files.upload({
        file: videoResult.fullPath,
        config: { mimeType: getMimeType(videoResult.fullPath) },
      });
    }
  } catch (e) {
    return {
      ok: false,
      error: "UPLOAD_FAILED",
      detail: e instanceof Error ? e.message : String(e),
    };
  }

  if (!uploadedFile.name || !uploadedFile.uri || !uploadedFile.mimeType) {
    return { ok: false, error: "UPLOAD_FAILED", detail: "Missing file metadata after upload" };
  }

  if (uploadedFile.state === FileState.PROCESSING) {
    const ready = await waitForFileActive(ai, uploadedFile.name);
    if (!ready) {
      return { ok: false, error: "PROCESSING_FAILED", detail: "Video processing timed out or failed" };
    }
  } else if (uploadedFile.state === FileState.FAILED) {
    return { ok: false, error: "PROCESSING_FAILED", detail: "Video processing failed" };
  }

  let responseText: string;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: createUserContent([
        createPartFromUri(uploadedFile.uri, uploadedFile.mimeType),
        buildAnalyzeMatchPrompt(),
      ]),
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: RESPONSE_JSON_SCHEMA,
      },
    });
    responseText = response.text ?? "";
  } catch (e) {
    return {
      ok: false,
      error: "GENERATION_FAILED",
      detail: e instanceof Error ? e.message : String(e),
    };
  }

  let parsed;
  try {
    const raw = JSON.parse(responseText);
    parsed = AnalysisResponseSchema.parse(raw);
  } catch (e) {
    return {
      ok: false,
      error: "PARSE_FAILED",
      detail: e instanceof Error ? e.message : String(e),
    };
  }

  try {
    const db = getDb();

    let totalShots = 0;

    for (const rally of parsed.rallies) {
      const [newRally] = await db
        .insert(matchRally)
        .values({
          matchId,
          rallyLength: rally.shots.length,
          wonByMe: rally.wonByMe,
        })
        .returning();

      if (!newRally) continue;

      for (let i = 0; i < rally.shots.length; i++) {
        const shot = rally.shots[i];
        const isLast = i === rally.shots.length - 1;
        const wonByMeShot = isLast ? computeWonByMe(shot.outcome, shot.player) : null;

        await db.insert(matchShots).values({
          matchId,
          rallyId: newRally.id,
          shotType: shot.shotType,
          zoneFromSide: shot.zoneFromSide,
          zoneFrom: shot.zoneFrom,
          zoneToSide: shot.zoneToSide,
          zoneTo: shot.zoneTo,
          outcome: isLast ? shot.outcome : "neither",
          wonByMe: wonByMeShot,
          isLastShotOfRally: isLast && (shot.outcome === "winner" || shot.outcome === "error"),
          player: shot.player,
          source: "ai_suggested",
        });
        totalShots++;
      }
    }

    return {
      ok: true,
      data: { rallyCount: parsed.rallies.length, shotCount: totalShots },
    };
  } catch (e) {
    return {
      ok: false,
      error: "DB_WRITE_FAILED",
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}
