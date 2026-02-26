import fs from "fs/promises";
import { getDb } from "@/db/client";
import { matches, matchStats } from "@/db/schema";
import { eq } from "drizzle-orm";
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
  const allStats = await db.select().from(matchStats);
  const statsByMatchId = new Map<number, typeof allStats>();
  for (const s of allStats) {
    const list = statsByMatchId.get(s.matchId) ?? [];
    list.push(s);
    statsByMatchId.set(s.matchId, list);
  }
  const matchesWithStats = allMatches.map((m) => ({
    ...m,
    stats: statsByMatchId.get(m.id) ?? [],
  }));

  const videoRoot = process.env.VIDEO_ROOT;
  let videoFiles: string[] = [];
  if (videoRoot) {
    videoFiles = await listVideoFilesUnder(videoRoot);
  }

  const videoFilesSet = new Set(videoFiles);
  const dbPathsSet = new Set(
    matchesWithStats.map((m) => normalizePath(m.videoPath))
  );
  const inDbButMissing = matchesWithStats
    .filter((m) => !videoFilesSet.has(normalizePath(m.videoPath)))
    .map((m) => m.videoPath);
  const onDiskButNotInDb = videoFiles.filter((p) => !dbPathsSet.has(p));

  return (
    <div className="min-h-screen bg-zinc-50 p-6 font-sans dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-8 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Debug: DB &amp; videos
        </h1>
        {!videoRoot && (
          <p className="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            VIDEO_ROOT is not set. Video file list will be empty.
          </p>
        )}
        <DebugMatchList
          matches={matchesWithStats}
          videoFiles={videoFiles}
          inDbButMissing={inDbButMissing}
          onDiskButNotInDb={onDiskButNotInDb}
        />
      </div>
    </div>
  );
}
