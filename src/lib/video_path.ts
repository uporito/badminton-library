import path from "path";
import fs from "fs";

export type ResolveVideoPathResult =
  | { ok: true; fullPath: string }
  | { ok: false; error: "ROOT_NOT_SET" | "PATH_INVALID" | "NOT_FOUND" };

/**
 * Resolves a relative video path against VIDEO_ROOT and validates it stays
 * under the root (no path traversal). Returns the absolute path or an error.
 */
export function resolveVideoPath(relativePath: string): ResolveVideoPathResult {
  const root = process.env.VIDEO_ROOT;
  if (!root || root.trim() === "") {
    return { ok: false, error: "ROOT_NOT_SET" };
  }
  const normalizedRoot = path.resolve(root);
  const fullPath = path.resolve(normalizedRoot, relativePath);
  const relative = path.relative(normalizedRoot, fullPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return { ok: false, error: "PATH_INVALID" };
  }
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
    return { ok: false, error: "NOT_FOUND" };
  }
  return { ok: true, fullPath };
}

const MIME_BY_EXT: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogg": "video/ogg",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
};

export function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}
