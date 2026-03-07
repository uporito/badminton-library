import { isGDriveConfigured, getServiceAccountEmail } from "@/lib/gdrive";

export async function GET() {
  const configured = isGDriveConfigured();
  const email = getServiceAccountEmail();
  return Response.json({ configured, serviceAccountEmail: email }, { status: 200 });
}
