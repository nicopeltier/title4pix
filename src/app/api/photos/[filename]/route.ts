import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  const photo = await prisma.photo.findUnique({
    where: { filename },
  });

  return NextResponse.json({
    filename,
    title: photo?.title ?? "",
    description: photo?.description ?? "",
    transcription: photo?.transcription ?? "",
    theme: photo?.theme ?? "",
    inputTokens: photo?.inputTokens ?? 0,
    outputTokens: photo?.outputTokens ?? 0,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  const body = await request.json();

  const data: Record<string, string> = {};
  if ("title" in body) data.title = body.title;
  if ("description" in body) data.description = body.description;
  if ("transcription" in body) data.transcription = body.transcription;
  if ("theme" in body) data.theme = body.theme;

  const photo = await prisma.photo.upsert({
    where: { filename },
    update: data,
    create: { filename, ...data },
  });

  return NextResponse.json({
    filename: photo.filename,
    title: photo.title ?? "",
    description: photo.description ?? "",
    transcription: photo.transcription ?? "",
    theme: photo.theme ?? "",
    inputTokens: photo.inputTokens,
    outputTokens: photo.outputTokens,
  });
}
