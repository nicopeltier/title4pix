"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface FixedThemeSelectorProps {
  filename: string;
  fixedTheme: string;
  availableFixedThemes: string[];
  onFixedThemeChange: (fixedTheme: string) => void;
}

export function FixedThemeSelector({
  filename,
  fixedTheme,
  availableFixedThemes,
  onFixedThemeChange,
}: FixedThemeSelectorProps) {
  const [saving, setSaving] = useState(false);

  const handleSelect = useCallback(
    async (theme: string) => {
      const newValue = fixedTheme === theme ? "" : theme;
      setSaving(true);
      try {
        const res = await fetch(
          `/api/photos/${encodeURIComponent(filename)}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fixedTheme: newValue }),
          }
        );
        if (!res.ok) throw new Error();
        onFixedThemeChange(newValue);
      } catch {
        toast.error("Erreur lors de la sauvegarde du thème fixe");
      } finally {
        setSaving(false);
      }
    },
    [filename, fixedTheme, onFixedThemeChange]
  );

  if (availableFixedThemes.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-lg font-bold">
        {fixedTheme || <span className="text-muted-foreground">Non défini</span>}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {availableFixedThemes.map((theme) => (
          <Button
            key={theme}
            variant={fixedTheme === theme ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => handleSelect(theme)}
            disabled={saving}
          >
            {theme}
          </Button>
        ))}
      </div>
    </div>
  );
}
