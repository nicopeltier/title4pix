"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { PhotoViewer } from "@/components/photo-viewer";
import { PhotoMetadata } from "@/components/photo-metadata";
import { FixedThemeSelector } from "@/components/fixed-theme-selector";
import { AppHeader } from "@/components/app-header";
import { Progress } from "@/components/ui/progress";

interface PhotoItem {
  index: number;
  filename: string;
  hasTitle: boolean;
  hasDescription: boolean;
  fixedTheme: string;
}

export default function PhotosPage() {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [availableFixedThemes, setAvailableFixedThemes] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/photos")
      .then((r) => r.json())
      .then((data) => {
        setPhotos(data.photos);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.fixedThemes) {
          try {
            const parsed = JSON.parse(data.fixedThemes);
            if (Array.isArray(parsed)) setAvailableFixedThemes(parsed);
          } catch { /* ignore */ }
        }
      });
  }, []);

  const handleFixedThemeChange = useCallback(
    (newTheme: string) => {
      setPhotos((prev) =>
        prev.map((p, i) =>
          i === currentIndex ? { ...p, fixedTheme: newTheme } : p
        )
      );
    },
    [currentIndex]
  );

  const completedCount = useMemo(
    () => photos.filter((p) => p.hasTitle && p.hasDescription).length,
    [photos]
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Chargement des photos...</p>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">
          Aucune photo trouvée. Placez des images dans le dossier <code>/photos</code>.
        </p>
      </div>
    );
  }

  const current = photos[currentIndex];
  const progress = (completedCount / photos.length) * 100;

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />

      <div className="px-6 pt-4 pb-0 flex items-center gap-3">
        <Progress value={progress} className="flex-1 h-2" />
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {completedCount}/{photos.length} complètes
        </span>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 p-6">
        <div className="flex-1 min-w-0 space-y-3">
          <FixedThemeSelector
            key={current.filename}
            filename={current.filename}
            fixedTheme={current.fixedTheme}
            availableFixedThemes={availableFixedThemes}
            onFixedThemeChange={handleFixedThemeChange}
          />
          <PhotoViewer
            photos={photos}
            currentIndex={currentIndex}
            onNavigate={setCurrentIndex}
          />
        </div>

        <aside className="w-full lg:w-80 shrink-0">
          <PhotoMetadata key={current.filename} filename={current.filename} />
        </aside>
      </div>
    </div>
  );
}
