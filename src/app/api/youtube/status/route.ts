import { NextResponse } from "next/server";
import { isYouTubeConfigured } from "@/lib/youtube";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    configured: isYouTubeConfigured(),
  });
}
