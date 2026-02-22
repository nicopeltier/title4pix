import { NextRequest, NextResponse } from "next/server";
import { getPhotoBlobUrl } from "@/lib/photos";
import { getDownloadUrl } from "@vercel/blob";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  try {
    const url = await getPhotoBlobUrl(filename);
    if (!url) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    const downloadUrl = await getDownloadUrl(url);
    return NextResponse.redirect(downloadUrl);
  } catch {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }
}
