"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { VoiceRecorder } from "@/components/voice-recorder";

interface PhotoMetadataProps {
  filename: string;
}

interface Metadata {
  title: string;
  description: string;
  transcription: string;
}

interface CharLimits {
  titleMin: number;
  titleMax: number;
  descMin: number;
  descMax: number;
}

export function PhotoMetadata({ filename }: PhotoMetadataProps) {
  const [meta, setMeta] = useState<Metadata>({ title: "", description: "", transcription: "" });
  const [limits, setLimits] = useState<CharLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
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
        setMeta({
          title: data.title,
          description: data.description,
          transcription: data.transcription,
        });
        toast.success("Titre et descriptif générés");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erreur lors de la génération");
      } finally {
        setGenerating(false);
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
      </div>

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

      <VoiceRecorder
        onTranscription={handleTranscription}
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
