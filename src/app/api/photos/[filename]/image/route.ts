import { NextRequest, NextResponse } from "next/server";
import { getPhotoBuffer, getMimeType } from "@/lib/photos";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  try {
    const { buffer, mimeType } = await getPhotoBuffer(filename);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }
}
