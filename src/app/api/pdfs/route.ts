import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { del, list } from "@vercel/blob";

const MAX_PDFS = 5;

export async function GET() {
  const pdfs = await prisma.pdfFile.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ pdfs });
}

export async function POST(request: NextRequest) {
  const { originalFilename, storedFilename } = await request.json();

  if (!originalFilename || !storedFilename) {
    return NextResponse.json(
      { error: "originalFilename et storedFilename requis" },
      { status: 400 }
    );
  }

  const count = await prisma.pdfFile.count();
  if (count >= MAX_PDFS) {
    return NextResponse.json(
      { error: `Maximum ${MAX_PDFS} fichiers PDF atteint. Supprimez un fichier avant d'en ajouter un nouveau.` },
      { status: 400 }
    );
  }

  try {
    const pdf = await prisma.pdfFile.create({
      data: { originalFilename, storedFilename },
    });

    return NextResponse.json(pdf, { status: 201 });
  } catch (error) {
    console.error("PDF register error:", error);
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { id } = await request.json();

  const pdf = await prisma.pdfFile.findUnique({ where: { id: Number(id) } });
  if (!pdf) {
    return NextResponse.json({ error: "PDF non trouvé" }, { status: 404 });
  }

  try {
    const result = await list({ prefix: `pdfs/${pdf.storedFilename}`, limit: 1 });
    if (result.blobs[0]) {
      await del(result.blobs[0].url);
    }
  } catch {
    // Blob may already be gone
  }

  await prisma.pdfFile.delete({ where: { id: pdf.id } });

  return NextResponse.json({ ok: true });
}
