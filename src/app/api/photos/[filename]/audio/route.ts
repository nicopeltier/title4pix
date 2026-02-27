import { NextRequest, NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return NextResponse.json({ error: "Fichier audio manquant" }, { status: 400 });
    }

    // Delete old audio blob if exists
    const existing = await prisma.photo.findUnique({
      where: { filename },
      select: { audioUrl: true },
    });

    if (existing?.audioUrl) {
      try {
        await del(existing.audioUrl);
      } catch {
        // Ignore deletion errors (blob may already be gone)
      }
    }

    // Upload new audio to Vercel Blob
    const blob = await put(`audio/${filename}.webm`, audioFile, {
      access: "private",
      contentType: audioFile.type || "audio/webm",
    });

    // Save audioUrl in DB
    await prisma.photo.upsert({
      where: { filename },
      update: { audioUrl: blob.url },
      create: { filename, audioUrl: blob.url },
    });

    return NextResponse.json({ audioUrl: blob.url });
  } catch (error) {
    console.error("Audio upload error:", error);
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  const photo = await prisma.photo.findUnique({
    where: { filename },
    select: { audioUrl: true },
  });

  if (!photo?.audioUrl) {
    return NextResponse.json({ error: "Pas d'audio" }, { status: 404 });
  }

  try {
    const response = await fetch(photo.audioUrl, {
      headers: {
        Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
      },
    });

    if (!response.ok) throw new Error("Failed to fetch audio");

    const buffer = await response.arrayBuffer();

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "audio/webm",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Audio introuvable" }, { status: 404 });
  }
}
