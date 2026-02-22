import { put, list } from "@vercel/blob";
import { readFile, readdir } from "fs/promises";
import path from "path";

const PHOTOS_DIR = path.join(process.cwd(), "photos");
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".tiff", ".tif"]);

async function getExistingBlobs(): Promise<Set<string>> {
  const existing = new Set<string>();
  let cursor: string | undefined;

  do {
    const result = await list({ prefix: "photos/", cursor, limit: 1000 });
    for (const blob of result.blobs) {
      existing.add(blob.pathname);
    }
    cursor = result.hasMore ? result.cursor : undefined;
  } while (cursor);

  return existing;
}

async function main() {
  console.log("Scanning local photos...");
  const entries = await readdir(PHOTOS_DIR);
  const photos = entries.filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return IMAGE_EXTENSIONS.has(ext);
  });
  console.log(`Found ${photos.length} local photos.`);

  console.log("Checking existing blobs...");
  const existing = await getExistingBlobs();
  console.log(`Found ${existing.size} already uploaded.`);

  const toUpload = photos.filter((f) => !existing.has(`photos/${f}`));
  console.log(`${toUpload.length} photos to upload.\n`);

  let uploaded = 0;
  for (const filename of toUpload) {
    const filePath = path.join(PHOTOS_DIR, filename);
    const buffer = await readFile(filePath);

    await put(`photos/${filename}`, buffer, {
      access: "public",
      addRandomSuffix: false,
    });

    uploaded++;
    if (uploaded % 10 === 0 || uploaded === toUpload.length) {
      console.log(`  ${uploaded}/${toUpload.length} uploaded`);
    }
  }

  console.log(`\nDone! ${uploaded} photos uploaded to Vercel Blob.`);
}

main().catch(console.error);
