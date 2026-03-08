import { google, type drive_v3 } from "googleapis";
import { Readable } from "stream";

let driveClient: drive_v3.Drive | null = null;

function getServiceAccountCredentials(): Record<string, unknown> | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw || raw.trim() === "") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getGDriveClient(): drive_v3.Drive | null {
  if (driveClient) return driveClient;
  const creds = getServiceAccountCredentials();
  if (!creds) return null;
  const auth = new google.auth.GoogleAuth({
    credentials: creds as Record<string, string>,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  driveClient = google.drive({ version: "v3", auth });
  return driveClient;
}

export function isGDriveConfigured(): boolean {
  return getServiceAccountCredentials() !== null;
}

export function getServiceAccountEmail(): string | null {
  const creds = getServiceAccountCredentials();
  if (!creds) return null;
  return (creds.client_email as string) ?? null;
}

export interface GDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  modifiedTime: string;
  createdTime: string;
  durationMs: number | null;
  thumbnailLink?: string;
}

const VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/ogg",
  "video/x-m4v",
];

export async function listGDriveVideos(
  folderId?: string
): Promise<{ ok: true; files: GDriveFile[] } | { ok: false; error: string }> {
  const drive = getGDriveClient();
  if (!drive) return { ok: false, error: "GDRIVE_NOT_CONFIGURED" };

  const mimeQuery = VIDEO_MIME_TYPES.map((m) => `mimeType='${m}'`).join(" or ");
  let query = `(${mimeQuery}) and trashed=false`;
  if (folderId) {
    query = `'${folderId}' in parents and (${mimeQuery}) and trashed=false`;
  }

  try {
    const files: GDriveFile[] = [];
    let pageToken: string | undefined;

    do {
      const res = await drive.files.list({
        q: query,
        fields: "nextPageToken, files(id, name, mimeType, size, modifiedTime, createdTime, videoMediaMetadata/durationMillis, thumbnailLink)",
        pageSize: 100,
        orderBy: "modifiedTime desc",
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      for (const f of res.data.files ?? []) {
        if (f.id && f.name && f.mimeType) {
          const rawDuration = f.videoMediaMetadata?.durationMillis;
          files.push({
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
            size: f.size ?? "0",
            modifiedTime: f.modifiedTime ?? "",
            createdTime: f.createdTime ?? "",
            durationMs: rawDuration ? Number(rawDuration) : null,
            thumbnailLink: f.thumbnailLink ?? undefined,
          });
        }
      }
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);

    return { ok: true, files };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export interface GDriveFolder {
  id: string;
  name: string;
}

export async function listGDriveFolders(
  parentId?: string
): Promise<{ ok: true; folders: GDriveFolder[] } | { ok: false; error: string }> {
  const drive = getGDriveClient();
  if (!drive) return { ok: false, error: "GDRIVE_NOT_CONFIGURED" };

  let query = "mimeType='application/vnd.google-apps.folder' and trashed=false";
  if (parentId) {
    query = `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  }

  try {
    const res = await drive.files.list({
      q: query,
      fields: "files(id, name)",
      pageSize: 100,
      orderBy: "name",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const folders: GDriveFolder[] = (res.data.files ?? [])
      .filter((f): f is { id: string; name: string } => !!f.id && !!f.name)
      .map((f) => ({ id: f.id!, name: f.name! }));

    return { ok: true, folders };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function getGDriveFileMetadata(
  fileId: string
): Promise<{ ok: true; name: string; mimeType: string; size: number } | { ok: false; error: string }> {
  const drive = getGDriveClient();
  if (!drive) return { ok: false, error: "GDRIVE_NOT_CONFIGURED" };

  try {
    const res = await drive.files.get({
      fileId,
      fields: "name, mimeType, size",
      supportsAllDrives: true,
    });
    return {
      ok: true,
      name: res.data.name ?? "unknown",
      mimeType: res.data.mimeType ?? "video/mp4",
      size: Number(res.data.size ?? 0),
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function streamGDriveFile(
  fileId: string,
  rangeHeader?: string | null
): Promise<
  | { ok: true; stream: Readable; contentType: string; contentLength: number; status: number; headers: Record<string, string> }
  | { ok: false; error: string }
> {
  const drive = getGDriveClient();
  if (!drive) return { ok: false, error: "GDRIVE_NOT_CONFIGURED" };

  const meta = await getGDriveFileMetadata(fileId);
  if (!meta.ok) return meta;

  const totalSize = meta.size;
  const contentType = meta.mimeType;

  try {
    const options: { fileId: string; alt: string; supportsAllDrives: boolean; headers?: Record<string, string> } = {
      fileId,
      alt: "media",
      supportsAllDrives: true,
    };

    if (rangeHeader) {
      options.headers = { Range: rangeHeader };
    }

    const res = await drive.files.get(options, {
      responseType: "stream",
      headers: rangeHeader ? { Range: rangeHeader } : undefined,
    });

    const stream = res.data as unknown as Readable;
    const resHeaders: Record<string, string> = {
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
    };

    if (rangeHeader && res.status === 206) {
      const contentRange = (res.headers?.["content-range"] as string) ?? "";
      const contentLength = (res.headers?.["content-length"] as string) ?? String(totalSize);
      resHeaders["Content-Range"] = contentRange;
      resHeaders["Content-Length"] = contentLength;
      return { ok: true, stream, contentType, contentLength: Number(contentLength), status: 206, headers: resHeaders };
    }

    resHeaders["Content-Length"] = String(totalSize);
    return { ok: true, stream, contentType, contentLength: totalSize, status: 200, headers: resHeaders };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function downloadGDriveFileToBuffer(
  fileId: string
): Promise<{ ok: true; buffer: Buffer; mimeType: string; name: string } | { ok: false; error: string }> {
  const drive = getGDriveClient();
  if (!drive) return { ok: false, error: "GDRIVE_NOT_CONFIGURED" };

  const meta = await getGDriveFileMetadata(fileId);
  if (!meta.ok) return meta;

  try {
    const res = await drive.files.get(
      { fileId, alt: "media", supportsAllDrives: true },
      { responseType: "arraybuffer" }
    );
    return {
      ok: true,
      buffer: Buffer.from(res.data as ArrayBuffer),
      mimeType: meta.mimeType,
      name: meta.name,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
