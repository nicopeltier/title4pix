"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { VoiceRecorder } from "@/components/voice-recorder";

interface PhotoMetadataProps {
  filename: string;
}

interface Metadata {
  title: string;
  description: string;
  transcription: string;
  theme: string;
  hasAudio: boolean;
  inputTokens: number;
  outputTokens: number;
}

// Claude Sonnet 4.6 pricing: $3/MTok input, $15/MTok output, ~0.92 EUR/USD
function estimateCostEur(inputTokens: number, outputTokens: number): number {
  return (inputTokens * 3 + outputTokens * 15) / 1_000_000 * 0.92;
}

interface CharLimits {
  titleMin: number;
  titleMax: number;
  descMin: number;
  descMax: number;
}

export function PhotoMetadata({ filename }: PhotoMetadataProps) {
  const [meta, setMeta] = useState<Metadata>({ title: "", description: "", transcription: "", theme: "", hasAudio: false, inputTokens: 0, outputTokens: 0 });
  const [limits, setLimits] = useState<CharLimits | null>(null);
  const [availableThemes, setAvailableThemes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [audioKey, setAudioKey] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setLimits({
          titleMin: data.titleMinChars,
          titleMax: data.titleMaxChars,
          descMin: data.descMinChars,
          descMax: data.descMaxChars,
        });
        if (data.themes) {
          try {
            const parsed = JSON.parse(data.themes);
            if (Array.isArray(parsed)) setAvailableThemes(parsed);
          } catch { /* ignore invalid JSON */ }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`/api/photos/${encodeURIComponent(filename)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setMeta({
            title: data.title ?? "",
            description: data.description ?? "",
            transcription: data.transcription ?? "",
            theme: data.theme ?? "",
            hasAudio: data.hasAudio ?? false,
            inputTokens: data.inputTokens ?? 0,
            outputTokens: data.outputTokens ?? 0,
          });
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
          toast.error("Erreur lors du chargement des métadonnées");
        }
      });

    return () => { cancelled = true; };
  }, [filename]);

  const saveField = useCallback(
    (field: keyof Metadata, value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        try {
          await fetch(`/api/photos/${encodeURIComponent(filename)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [field]: value }),
          });
        } catch {
          toast.error("Erreur lors de la sauvegarde");
        }
      }, 500);
    },
    [filename]
  );

  const handleChange = useCallback(
    (field: keyof Metadata, value: string) => {
      setMeta((prev) => ({ ...prev, [field]: value }));
      saveField(field, value);
    },
    [saveField]
  );

  const handleTranscription = useCallback(
    async (transcription: string) => {
      setGenerating(true);
      setMeta((prev) => ({ ...prev, transcription }));

      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcription, filename }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Erreur lors de la génération");
        }

        const data = await res.json();
        setMeta((prev) => ({
          title: data.title,
          description: data.description,
          transcription: data.transcription,
          theme: prev.theme,
          hasAudio: prev.hasAudio,
          inputTokens: data.inputTokens ?? 0,
          outputTokens: data.outputTokens ?? 0,
        }));
        toast.success("Titre et descriptif générés");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erreur lors de la génération");
      } finally {
        setGenerating(false);
      }
    },
    [filename]
  );

  const handleAudioRecorded = useCallback(
    async (blob: Blob) => {
      const formData = new FormData();
      formData.append("audio", blob, `${filename}.webm`);

      try {
        const res = await fetch(`/api/photos/${encodeURIComponent(filename)}/audio`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) throw new Error();
        setMeta((prev) => ({ ...prev, hasAudio: true }));
        setAudioKey((k) => k + 1);
      } catch {
        toast.error("Erreur lors de la sauvegarde de l'audio");
      }
    },
    [filename]
  );

  if (loading) {
    return <div className="text-sm text-muted-foreground animate-pulse">Chargement...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs text-muted-foreground">Fichier</Label>
        <p className="text-sm font-medium break-all">{filename}</p>
        <p className="text-xs text-muted-foreground">
          {(meta.inputTokens + meta.outputTokens).toLocaleString("fr-FR")} tokens
          {" "}({estimateCostEur(meta.inputTokens, meta.outputTokens).toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 4 })})
        </p>
      </div>

      {availableThemes.length > 0 && (
        <div className="space-y-1.5">
          <Label>Thème</Label>
          <div className="flex flex-wrap gap-1.5">
            {availableThemes.map((theme) => (
              <Button
                key={theme}
                variant={meta.theme === theme ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => handleChange("theme", theme)}
              >
                {theme}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="title">Titre</Label>
        <Input
          id="title"
          value={meta.title}
          onChange={(e) => handleChange("title", e.target.value)}
          placeholder="Titre de la photo"
        />
        {meta.title && (
          <p className="text-xs text-muted-foreground">
            {meta.title.length} caractères{limits && ` (min : ${limits.titleMin}, max : ${limits.titleMax})`}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Descriptif</Label>
        <Textarea
          id="description"
          value={meta.description}
          onChange={(e) => handleChange("description", e.target.value)}
          placeholder="Descriptif de la photo"
          rows={5}
        />
        {meta.description && (
          <p className="text-xs text-muted-foreground">
            {meta.description.length} caractères{limits && ` (min : ${limits.descMin}, max : ${limits.descMax})`}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="transcription">Enregistrement</Label>
        <Textarea
          id="transcription"
          value={meta.transcription}
          placeholder="Transcription vocale"
          rows={4}
          className="bg-muted/50"
          readOnly
        />
      </div>

      {meta.hasAudio && (
        <div className="space-y-1.5">
          <Label>Audio</Label>
          <audio
            key={audioKey}
            controls
            className="w-full h-8"
            src={`/api/photos/${encodeURIComponent(filename)}/audio`}
          />
        </div>
      )}

      <VoiceRecorder
        onTranscription={handleTranscription}
        onAudioRecorded={handleAudioRecorded}
        disabled={generating}
      />

      {generating && (
        <p className="text-sm text-muted-foreground animate-pulse">
          Génération en cours...
        </p>
      )}
    </div>
  );
}
