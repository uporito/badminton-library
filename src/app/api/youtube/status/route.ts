import { isYouTubeConfigured } from "@/lib/youtube";

export async function GET() {
  return Response.json({ configured: isYouTubeConfigured() });
}
