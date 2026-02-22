import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { put, del, list } from "@vercel/blob";

export const config = {
  maxDuration: 30,
};

const MAX_PDFS = 5;

export async function GET() {
  const pdfs = await prisma.pdfFile.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ pdfs });
}

export async function POST(request: NextRequest) {
  const count = await prisma.pdfFile.count();
  if (count >= MAX_PDFS) {
    return NextResponse.json(
      { error: `Maximum ${MAX_PDFS} fichiers PDF atteint. Supprimez un fichier avant d'en ajouter un nouveau.` },
      { status: 400 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json(
      { error: "Un fichier PDF est requis" },
      { status: 400 }
    );
  }

  try {
    const storedFilename = `${randomUUID()}.pdf`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await put(`pdfs/${storedFilename}`, buffer, {
      access: "private",
      addRandomSuffix: false,
    });

    const pdf = await prisma.pdfFile.create({
      data: {
        originalFilename: file.name,
        storedFilename,
      },
    });

    return NextResponse.json(pdf, { status: 201 });
  } catch (error) {
    console.error("PDF upload error:", error);
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

  // Delete from Blob storage
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
