"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PhotoViewerProps {
  photos: { index: number; filename: string }[];
  currentIndex: number;
  onNavigate: (index: number) => void;
}

export function PhotoViewer({ photos, currentIndex, onNavigate }: PhotoViewerProps) {
  const [inputValue, setInputValue] = useState(String(currentIndex + 1));
  const total = photos.length;
  const current = photos[currentIndex];

  useEffect(() => {
    setInputValue(String(currentIndex + 1));
  }, [currentIndex]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) onNavigate(currentIndex - 1);
  }, [currentIndex, onNavigate]);

  const handleNext = useCallback(() => {
    if (currentIndex < total - 1) onNavigate(currentIndex + 1);
  }, [currentIndex, total, onNavigate]);

  const handleInputSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const num = parseInt(inputValue, 10);
      if (num >= 1 && num <= total) {
        onNavigate(num - 1);
      } else {
        setInputValue(String(currentIndex + 1));
      }
    },
    [inputValue, total, currentIndex, onNavigate]
  );

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePrev, handleNext]);

  if (!current) return null;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-full max-h-[70vh] flex items-center justify-center bg-muted rounded-lg overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/photos/${encodeURIComponent(current.filename)}/image`}
          alt={current.filename}
          className="max-w-full max-h-[70vh] object-contain"
        />
      </div>
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={handlePrev} disabled={currentIndex === 0}>
          Précédent
        </Button>
        <form onSubmit={handleInputSubmit} className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            max={total}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="w-20 text-center"
          />
          <span className="text-sm text-muted-foreground">/ {total}</span>
        </form>
        <Button variant="outline" onClick={handleNext} disabled={currentIndex === total - 1}>
          Suivant
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Raccourcis : ← Précédent · → Suivant
      </p>
    </div>
  );
}
