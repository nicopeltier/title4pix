import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPhotoBuffer } from "@/lib/photos";
import { generateTitleAndDescription } from "@/lib/claude";
import { list } from "@vercel/blob";
import { fetchBlobBuffer } from "@/lib/photos";

export async function POST(request: NextRequest) {
  const { transcription, filename } = await request.json();

  if (!transcription || !filename) {
    return NextResponse.json(
      { error: "transcription et filename requis" },
      { status: 400 }
    );
  }

  try {
    // Load settings
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    if (!settings) {
      return NextResponse.json({ error: "Settings non configurés" }, { status: 500 });
    }

    // Load image as base64 from Blob
    const { buffer: imageBuffer, mimeType: imageMimeType } = await getPhotoBuffer(filename);
    const imageBase64 = imageBuffer.toString("base64");

    // Load PDFs as base64 from Blob
    const pdfFiles = await prisma.pdfFile.findMany();
    const pdfContents: { filename: string; base64: string }[] = [];

    for (const pdf of pdfFiles) {
      try {
        const result = await list({ prefix: `pdfs/${pdf.storedFilename}`, limit: 1 });
        const blobUrl = result.blobs[0]?.url;
        if (blobUrl) {
          const pdfBuffer = await fetchBlobBuffer(blobUrl);
          pdfContents.push({
            filename: pdf.originalFilename,
            base64: pdfBuffer.toString("base64"),
          });
        }
      } catch {
        // Skip missing PDF files
      }
    }

    // Call Claude
    const result = await generateTitleAndDescription({
      imageBase64,
      imageMimeType,
      transcription,
      settings: {
        titleMinChars: settings.titleMinChars,
        titleMaxChars: settings.titleMaxChars,
        descMinChars: settings.descMinChars,
        descMaxChars: settings.descMaxChars,
        instructions: settings.instructions,
        photographerUrl: settings.photographerUrl,
      },
      pdfContents,
    });

    // Save to database (increment tokens cumulatively)
    const photo = await prisma.photo.upsert({
      where: { filename },
      update: {
        title: result.title,
        description: result.description,
        transcription,
        inputTokens: { increment: result.inputTokens },
        outputTokens: { increment: result.outputTokens },
      },
      create: {
        filename,
        title: result.title,
        description: result.description,
        transcription,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      },
    });

    return NextResponse.json({
      title: result.title,
      description: result.description,
      transcription,
      inputTokens: photo.inputTokens,
      outputTokens: photo.outputTokens,
    });
  } catch (error) {
    console.error("Generate error:", error);
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
