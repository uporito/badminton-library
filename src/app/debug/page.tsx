import fs from "fs/promises";
import { getDb } from "@/db/client";
import { matches, matchShots } from "@/db/schema";
import { enrichMatch } from "@/lib/get_match_by_id";
import { DebugMatchList } from "./debug_match_list";

const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov"];

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
}

async function listVideoFilesUnder(root: string): Promise<string[]> {
  const out: string[] = [];
  try {
    const entries = (await fs.readdir(root, {
      recursive: true,
    })) as string[];
    for (const rel of entries) {
      const lower = rel.toLowerCase();
      if (
        VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext)) &&
        !rel.includes("node_modules")
      ) {
        out.push(normalizePath(rel));
      }
    }
  } catch (_e) {
    // directory missing or not readable
  }
  return out;
}

export default async function DebugPage() {
  const db = getDb();
  const allMatches = await db.select().from(matches);
  const allShots = await db.select().from(matchShots);
  const shotsByMatchId = new Map<number, typeof allShots>();
  for (const s of allShots) {
    const list = shotsByMatchId.get(s.matchId) ?? [];
    list.push(s);
    shotsByMatchId.set(s.matchId, list);
  }
  const matchesWithShots = allMatches.map((m) => ({
    ...enrichMatch(m),
    shots: shotsByMatchId.get(m.id) ?? [],
  }));

  const videoRoot = process.env.VIDEO_ROOT;
  let videoFiles: string[] = [];
  if (videoRoot) {
    videoFiles = await listVideoFilesUnder(videoRoot);
  }

  const videoFilesSet = new Set(videoFiles);
  const dbPathsSet = new Set(
    matchesWithShots.map((m) => normalizePath(m.videoPath))
  );
  const inDbButMissing = matchesWithShots
    .filter((m) => !videoFilesSet.has(normalizePath(m.videoPath)))
    .map((m) => m.videoPath);
  const onDiskButNotInDb = videoFiles.filter((p) => !dbPathsSet.has(p));

  return (
    <div className="min-h-screen font-sans">
      <h1 className="mb-8 text-2xl font-bold text-text-main">
        Debug: DB &amp; videos
      </h1>
      {!videoRoot && (
        <p className="frame mb-4 rounded-xl p-3 text-sm text-amber-700 dark:text-amber-400">
          VIDEO_ROOT is not set. Video file list will be empty.
        </p>
      )}
      <DebugMatchList
        matches={matchesWithShots}
        videoFiles={videoFiles}
        inDbButMissing={inDbButMissing}
        onDiskButNotInDb={onDiskButNotInDb}
      />
    </div>
  );
}
