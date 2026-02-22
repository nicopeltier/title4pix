import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MAX_PDFS = 5;

export async function POST(request: NextRequest) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, _clientPayload) => {
        // Verify session manually (webhook calls bypass middleware)
        const session = request.cookies.get("t4p_session");
        const expected = process.env.SESSION_TOKEN;
        if (!expected || session?.value !== expected) {
          throw new Error("Non autorisé");
        }

        const count = await prisma.pdfFile.count();
        if (count >= MAX_PDFS) {
          throw new Error(
            `Maximum ${MAX_PDFS} fichiers PDF atteint. Supprimez un fichier avant d'en ajouter un nouveau.`
          );
        }

        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: 20 * 1024 * 1024,
        };
      },
      onUploadCompleted: async () => {
        // DB registration is handled by the client via /api/pdfs POST
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
