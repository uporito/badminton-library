export async function GET() {
  const videoRoot = process.env.VIDEO_ROOT ?? "";
  const configured = videoRoot.trim() !== "";
  return Response.json(
    { videoRoot: configured ? videoRoot : "", configured },
    { status: 200 }
  );
}
