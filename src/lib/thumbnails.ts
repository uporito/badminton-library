import fs from "fs";
import path from "path";

const THUMBNAILS_DIR = path.resolve("data", "thumbnails");

/**
 * Thumbnail files are keyed by video identity (source + path) rather than
 * match ID so that re-imports, ID reuse, and deletions never mis-attribute
 * a cached image to the wrong video.
 *
 * Naming: `{videoSource}_{sanitized videoPath}.jpg`
 */
function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function getThumbnailPath(videoSource: string, videoPath: string): string {
  return path.join(THUMBNAILS_DIR, `${videoSource}_${sanitize(videoPath)}.jpg`);
}

export function thumbnailExists(videoSource: string, videoPath: string): boolean {
  return fs.existsSync(getThumbnailPath(videoSource, videoPath));
}

export function deleteThumbnail(videoSource: string, videoPath: string): void {
  const p = getThumbnailPath(videoSource, videoPath);
  if (fs.existsSync(p)) {
    try { fs.unlinkSync(p); } catch { /* ignore */ }
  }
}

export function ensureThumbnailsDir(): void {
  fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
}
