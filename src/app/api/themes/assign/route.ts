import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPhotoList } from "@/lib/photos";
import { assignThemes } from "@/lib/claude";

export async function POST(request: NextRequest) {
  const { numThemes } = await request.json();

  if (!numThemes || numThemes < 1 || numThemes > 20) {
    return NextResponse.json(
      { error: "numThemes doit être entre 1 et 20" },
      { status: 400 }
    );
  }

  try {
    // Load all photo filenames from Blob
    const files = await getPhotoList();
    if (files.length === 0) {
      return NextResponse.json(
        { error: "Aucune photo trouvée" },
        { status: 400 }
      );
    }

    // Load existing metadata from DB
    const dbPhotos = await prisma.photo.findMany({
      where: { filename: { in: files } },
      select: { filename: true, title: true, description: true },
    });
    const metaMap = new Map(dbPhotos.map((p) => [p.filename, p]));

    // Build photo list for AI
    const photosForAI = files.map((filename) => {
      const meta = metaMap.get(filename);
      return {
        filename,
        title: meta?.title ?? "",
        description: meta?.description ?? "",
      };
    });

    // Call Claude to assign themes
    const result = await assignThemes({ photos: photosForAI, numThemes });

    // Update each photo's theme in DB
    const updates = files.map((filename) => {
      const theme = result.assignments[filename] ?? "";
      return prisma.photo.upsert({
        where: { filename },
        update: { theme },
        create: { filename, theme },
      });
    });
    await prisma.$transaction(updates);

    // Distribute tokens evenly across all photos
    const inputPerPhoto = Math.ceil(result.inputTokens / files.length);
    const outputPerPhoto = Math.ceil(result.outputTokens / files.length);
    await prisma.$transaction(
      files.map((filename) =>
        prisma.photo.update({
          where: { filename },
          data: {
            inputTokens: { increment: inputPerPhoto },
            outputTokens: { increment: outputPerPhoto },
          },
        })
      )
    );

    // Save themes list in Settings
    await prisma.settings.upsert({
      where: { id: 1 },
      update: { themes: JSON.stringify(result.themes) },
      create: { id: 1, themes: JSON.stringify(result.themes) },
    });

    return NextResponse.json({
      themes: result.themes,
      assignments: result.assignments,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    });
  } catch (error) {
    console.error("Theme assignment error:", error);
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
