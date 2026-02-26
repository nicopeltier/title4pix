import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  let settings = await prisma.settings.findUnique({ where: { id: 1 } });

  if (!settings) {
    settings = await prisma.settings.create({ data: { id: 1 } });
  }

  return NextResponse.json(settings);
}

export async function PUT(request: NextRequest) {
  const body = await request.json();

  const data: Record<string, unknown> = {};
  if ("titleMinChars" in body) data.titleMinChars = Number(body.titleMinChars);
  if ("titleMaxChars" in body) data.titleMaxChars = Number(body.titleMaxChars);
  if ("descMinChars" in body) data.descMinChars = Number(body.descMinChars);
  if ("descMaxChars" in body) data.descMaxChars = Number(body.descMaxChars);
  if ("instructions" in body) data.instructions = String(body.instructions);
  if ("photographerUrl" in body) data.photographerUrl = String(body.photographerUrl);
  if ("themes" in body) data.themes = String(body.themes);

  const settings = await prisma.settings.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data },
  });

  return NextResponse.json(settings);
}
