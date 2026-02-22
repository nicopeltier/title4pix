import { list, getDownloadUrl } from "@vercel/blob";
import path from "path";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".tiff", ".tif"]);

export async function getPhotoList(): Promise<string[]> {
  const filenames: string[] = [];
  let cursor: string | undefined;

  do {
    const result = await list({ prefix: "photos/", cursor, limit: 1000 });
    for (const blob of result.blobs) {
      const filename = blob.pathname.replace(/^photos\//, "");
      const ext = path.extname(filename).toLowerCase();
      if (filename && IMAGE_EXTENSIONS.has(ext)) {
        filenames.push(filename);
      }
    }
    cursor = result.hasMore ? result.cursor : undefined;
  } while (cursor);

  return filenames.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export async function getPhotoBlobUrl(filename: string): Promise<string | null> {
  const safe = path.basename(filename);
  const result = await list({ prefix: `photos/${safe}`, limit: 1 });
  return result.blobs[0]?.url ?? null;
}

export async function getPhotoBuffer(filename: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const blobUrl = await getPhotoBlobUrl(filename);
  if (!blobUrl) throw new Error("Photo not found");

  const downloadUrl = await getDownloadUrl(blobUrl);
  const response = await fetch(downloadUrl);
  if (!response.ok) throw new Error("Failed to fetch photo");

  const buffer = Buffer.from(await response.arrayBuffer());
  const mimeType = getMimeType(filename);
  return { buffer, mimeType };
}

export function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".tiff": "image/tiff",
    ".tif": "image/tiff",
  };
  return mimes[ext] ?? "application/octet-stream";
}
