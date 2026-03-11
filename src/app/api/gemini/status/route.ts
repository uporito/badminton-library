export async function GET() {
  const configured = !!(
    process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0
  );
  return Response.json({ configured }, { status: 200 });
}
