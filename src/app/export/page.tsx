"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppHeader } from "@/components/app-header";

interface PhotoExport {
  filename: string;
  title: string;
  description: string;
}

export default function ExportPage() {
  const [photos, setPhotos] = useState<PhotoExport[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, complete: 0 });

  useEffect(() => {
    fetch("/api/photos")
      .then((r) => r.json())
      .then(async (data) => {
        const items: PhotoExport[] = [];
        let complete = 0;

        for (const p of data.photos) {
          const meta = await fetch(`/api/photos/${encodeURIComponent(p.filename)}`).then((r) => r.json());
          items.push({ filename: p.filename, title: meta.title, description: meta.description });
          if (meta.title && meta.description) complete++;
        }

        setPhotos(items);
        setStats({ total: data.total, complete });
        setLoading(false);
      });
  }, []);

  function handleDownloadTSV() {
    window.location.href = "/api/export";
  }

  function handleDownloadXLSX() {
    window.location.href = "/api/export?format=xlsx";
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />

      <div className="flex-1 p-6 max-w-4xl mx-auto w-full space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Apercu de l&apos;export</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {stats.complete} / {stats.total} photos complètes (titre + descriptif)
            </p>

            <div className="flex gap-3">
              <Button onClick={handleDownloadTSV}>
                Télécharger TSV
              </Button>
              <Button variant="outline" onClick={handleDownloadXLSX}>
                Télécharger XLSX
              </Button>
            </div>

            <div className="border rounded-md divide-y">
              {photos.map((p) => (
                <div key={p.filename} className="px-4 py-3 space-y-1">
                  <p className="font-bold text-sm">{p.filename}</p>
                  <p className="text-sm">
                    {p.title || <span className="text-muted-foreground italic">Pas de titre</span>}
                  </p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {p.description || <span className="italic">Pas de descriptif</span>}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
