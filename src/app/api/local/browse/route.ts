import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".mov", ".avi", ".mkv"]);

interface FolderEntry {
  name: string;
  path: string;
}

interface FileEntry {
  name: string;
  path: string;
  relativePath: string;
  size: number;
  modifiedTime: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dir = searchParams.get("dir") || "";
  const root = searchParams.get("root") || "";

  if (!dir) {
    return NextResponse.json(
      { error: "dir parameter is required" },
      { status: 400 },
    );
  }

  const resolved = path.resolve(dir);

  try {
    await fs.access(resolved);
  } catch {
    return NextResponse.json(
      { error: "Directory not found or not accessible" },
      { status: 404 },
    );
  }

  try {
    const entries = await fs.readdir(resolved, { withFileTypes: true });
    const folders: FolderEntry[] = [];
    const files: FileEntry[] = [];

    const effectiveRoot = root || resolved;

    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const fullPath = path.join(resolved, entry.name);
      if (entry.isDirectory()) {
        folders.push({ name: entry.name, path: fullPath });
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (VIDEO_EXTENSIONS.has(ext)) {
          try {
            const stat = await fs.stat(fullPath);
            const relativePath = path.relative(effectiveRoot, fullPath).replace(/\\/g, "/");
            files.push({
              name: entry.name,
              path: fullPath,
              relativePath,
              size: stat.size,
              modifiedTime: stat.mtime.toISOString(),
            });
          } catch {
            // skip unreadable files
          }
        }
      }
    }

    folders.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ folders, files, currentDir: resolved });
  } catch {
    return NextResponse.json(
      { error: "Failed to read directory" },
      { status: 500 },
    );
  }
}
