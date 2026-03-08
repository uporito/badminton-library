import { NextRequest } from "next/server";
import { analyzeMatch } from "@/lib/analyze_match";

export const maxDuration = 600;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const matchId = parseInt(id, 10);
  if (Number.isNaN(matchId) || matchId < 1) {
    return new Response(
      JSON.stringify({ type: "error", error: "Invalid id" }) + "\n",
      { status: 400, headers: { "Content-Type": "application/x-ndjson" } }
    );
  }

  const encoder = new TextEncoder();
  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const writer = stream.writable.getWriter();

  const write = (obj: Record<string, unknown>) =>
    writer.write(encoder.encode(JSON.stringify(obj) + "\n"));

  (async () => {
    try {
      const result = await analyzeMatch(matchId, (message) => {
        write({ type: "progress", message }).catch(() => {});
      });

      if (!result.ok) {
        await write({
          type: "error",
          error: result.error,
          detail: result.detail,
        });
      } else {
        await write({
          type: "result",
          ok: true,
          rallyCount: result.data.rallyCount,
          shotCount: result.data.shotCount,
        });
      }
    } catch (e) {
      await write({
        type: "error",
        error: "UNEXPECTED",
        detail: e instanceof Error ? e.message : String(e),
      }).catch(() => {});
    } finally {
      await writer.close().catch(() => {});
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      "Transfer-Encoding": "chunked",
    },
  });
}
