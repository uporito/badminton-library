import { google, type drive_v3 } from "googleapis";
import { Readable } from "stream";
import fs from "fs";
import path from "path";

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

async function getAccessToken(): Promise<string | null> {
  const creds = getServiceAccountCredentials();
  if (!creds) return null;
  const auth = new google.auth.GoogleAuth({
    credentials: creds as Record<string, string>,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  const client = await auth.getClient();
  const tokenRes = await client.getAccessToken();
  return tokenRes?.token ?? null;
}

export async function streamGDriveFile(
  fileId: string,
  rangeHeader?: string | null
): Promise<
  | { ok: true; stream: ReadableStream; contentType: string; status: number; headers: Record<string, string> }
  | { ok: false; error: string }
> {
  const meta = await getGDriveFileMetadata(fileId);
  if (!meta.ok) return meta;

  const token = await getAccessToken();
  if (!token) return { ok: false, error: "GDRIVE_NOT_CONFIGURED" };

  const totalSize = meta.size;
  const contentType = meta.mimeType;
  const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;

  const fetchHeaders: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (match) {
      const start = parseInt(match[1], 10);
      const reqEnd = match[2] ? parseInt(match[2], 10) : undefined;
      const end = reqEnd !== undefined ? Math.min(reqEnd, totalSize - 1) : totalSize - 1;
      const chunkSize = end - start + 1;

      fetchHeaders["Range"] = `bytes=${start}-${end}`;
      const res = await fetch(driveUrl, { headers: fetchHeaders });

      if (!res.ok && res.status !== 206) {
        return { ok: false, error: `Drive returned ${res.status}` };
      }

      const resHeaders: Record<string, string> = {
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
        "Content-Range": `bytes ${start}-${end}/${totalSize}`,
        "Content-Length": String(chunkSize),
      };

      return {
        ok: true,
        stream: res.body!,
        contentType,
        status: 206,
        headers: resHeaders,
      };
    }
  }

  // No range header: stream the full file, but advertise range support
  // so the browser can seek later
  const res = await fetch(driveUrl, { headers: fetchHeaders });

  if (!res.ok) {
    return { ok: false, error: `Drive returned ${res.status}` };
  }

  const resHeaders: Record<string, string> = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Content-Length": String(totalSize),
  };

  return {
    ok: true,
    stream: res.body!,
    contentType,
    status: 200,
    headers: resHeaders,
  };
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

const THUMBNAILS_DIR = path.resolve("data", "thumbnails");

export function getThumbnailPath(matchId: number): string {
  return path.join(THUMBNAILS_DIR, `${matchId}.jpg`);
}

export function thumbnailExists(matchId: number): boolean {
  return fs.existsSync(getThumbnailPath(matchId));
}

export async function fetchAndCacheGDriveThumbnail(
  fileId: string,
  matchId: number
): Promise<{ ok: true; filePath: string } | { ok: false; error: string }> {
  const drive = getGDriveClient();
  if (!drive) return { ok: false, error: "GDRIVE_NOT_CONFIGURED" };

  try {
    const res = await drive.files.get({
      fileId,
      fields: "thumbnailLink",
      supportsAllDrives: true,
    });

    const thumbnailLink = res.data.thumbnailLink;
    if (!thumbnailLink) return { ok: false, error: "NO_THUMBNAIL" };

    // thumbnailLink requires auth; fetch via the authenticated client's token
    const auth = drive.context._options.auth;
    const client = await (auth as { getClient(): Promise<{ request(opts: { url: string; responseType: string }): Promise<{ data: ArrayBuffer }> }> }).getClient();
    const imgRes = await client.request({
      url: thumbnailLink.replace(/=s\d+$/, "=s400"),
      responseType: "arraybuffer",
    });

    fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
    const filePath = getThumbnailPath(matchId);
    fs.writeFileSync(filePath, Buffer.from(imgRes.data as ArrayBuffer));
    return { ok: true, filePath };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
