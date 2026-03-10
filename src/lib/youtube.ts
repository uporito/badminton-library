/**
 * Extract YouTube video ID from common URL formats.
 * Returns null if not a valid YouTube URL.
 */
export function parseYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Already a video ID (11 chars, alphanumeric + _ -)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = trimmed.startsWith("http") ? new URL(trimmed) : new URL(`https://${trimmed}`);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "youtu.be") {
      if (host === "youtu.be") {
        const id = url.pathname.slice(1).split("/")[0];
        return id && id.length <= 11 ? id : null;
      }
      if (url.pathname === "/watch" && url.searchParams.has("v")) {
        return url.searchParams.get("v");
      }
      const embedMatch = url.pathname.match(/^\/embed\/([a-zA-Z0-9_-]{11})/);
      if (embedMatch) return embedMatch[1];
    }
  } catch {
    // ignore
  }
  return null;
}

export function isYouTubeConfigured(): boolean {
  return !!(
    process.env.YOUTUBE_API_KEY &&
    process.env.YOUTUBE_API_KEY.trim() !== ""
  );
}
