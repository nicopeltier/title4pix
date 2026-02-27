import { NextResponse } from "next/server";
import { getPhotoList } from "@/lib/photos";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const files = await getPhotoList();

  // Fetch existing metadata for all photos
  const photos = await prisma.photo.findMany({
    where: { filename: { in: files } },
    select: { filename: true, title: true, description: true, theme: true, fixedTheme: true, inputTokens: true, outputTokens: true },
  });

  const metaMap = new Map(photos.map((p) => [p.filename, p]));

  const result = files.map((filename, index) => {
    const meta = metaMap.get(filename);
    return {
      index,
      filename,
      hasTitle: !!meta?.title,
      hasDescription: !!meta?.description,
      hasTheme: !!meta?.theme,
      theme: meta?.theme ?? "",
      fixedTheme: meta?.fixedTheme ?? "",
    };
  });

  // Aggregate tokens across all photos
  const totalInputTokens = photos.reduce((sum, p) => sum + p.inputTokens, 0);
  const totalOutputTokens = photos.reduce((sum, p) => sum + p.outputTokens, 0);

  return NextResponse.json({ photos: result, total: files.length, totalInputTokens, totalOutputTokens });
}
