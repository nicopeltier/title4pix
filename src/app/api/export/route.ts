import { NextRequest, NextResponse } from "next/server";
import { getPhotoList } from "@/lib/photos";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get("format");

  const files = await getPhotoList();

  const photos = await prisma.photo.findMany({
    where: { filename: { in: files } },
    select: { filename: true, title: true, description: true, theme: true },
  });

  const metaMap = new Map(photos.map((p) => [p.filename, p]));

  const rows = files.map((filename) => {
    const meta = metaMap.get(filename);
    return {
      "Nom du fichier": filename,
      Titre: meta?.title ?? "",
      Descriptif: meta?.description ?? "",
      "Thème": meta?.theme ?? "",
    };
  });

  if (format === "xlsx") {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Photos");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="title4pix-export.xlsx"`,
      },
    });
  }

  // Default: TSV
  const header = "Nom du fichier\tTitre\tDescriptif\tThème";
  const tsvRows = rows.map((r) => {
    const title = r.Titre.replace(/\t/g, " ").replace(/\n/g, " ");
    const desc = r.Descriptif.replace(/\t/g, " ").replace(/\n/g, " ");
    const theme = r["Thème"].replace(/\t/g, " ").replace(/\n/g, " ");
    return `${r["Nom du fichier"]}\t${title}\t${desc}\t${theme}`;
  });

  const content = [header, ...tsvRows].join("\n");

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/tab-separated-values; charset=utf-8",
      "Content-Disposition": `attachment; filename="title4pix-export.tsv"`,
    },
  });
}
