"use client";

import { useState, useEffect, useCallback } from "react";
import { upload } from "@vercel/blob/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppHeader } from "@/components/app-header";

interface Settings {
  titleMinChars: number;
  titleMaxChars: number;
  descMinChars: number;
  descMaxChars: number;
  instructions: string;
  photographerUrl: string;
}

interface PdfFile {
  id: number;
  originalFilename: string;
  createdAt: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [pdfs, setPdfs] = useState<PdfFile[]>([]);
  const [totalInputTokens, setTotalInputTokens] = useState(0);
  const [totalOutputTokens, setTotalOutputTokens] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then(setSettings);
    fetch("/api/pdfs").then((r) => r.json()).then((d) => setPdfs(d.pdfs));
    fetch("/api/photos").then((r) => r.json()).then((d) => {
      setTotalInputTokens(d.totalInputTokens ?? 0);
      setTotalOutputTokens(d.totalOutputTokens ?? 0);
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error();
      toast.success("Paramètres enregistrés");
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  }, [settings]);

  const handleUploadPdf = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    try {
      const storedFilename = `${crypto.randomUUID()}.pdf`;

      // Upload directly to Vercel Blob (bypasses 4.5 MB serverless limit)
      await upload(`pdfs/${storedFilename}`, file, {
        access: "private",
        handleUploadUrl: "/api/pdfs/upload",
        clientPayload: file.name,
      });

      // Register the PDF in the database
      const res = await fetch("/api/pdfs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalFilename: file.name,
          storedFilename,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Erreur lors de l'enregistrement");
      } else {
        const data = await fetch("/api/pdfs").then((r) => r.json());
        setPdfs(data.pdfs);
        toast.success("PDF ajouté");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'upload");
    }

    setUploading(false);
    e.target.value = "";
  }, []);

  const handleDeletePdf = useCallback(async (id: number, name: string) => {
    try {
      await fetch("/api/pdfs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setPdfs((prev) => prev.filter((p) => p.id !== id));
      toast.success(`${name} supprimé`);
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  }, []);

  if (!settings) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground animate-pulse">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />

      <div className="flex-1 p-6 max-w-2xl mx-auto w-full space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Limites de caractères</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="titleMin">Titre - minimum</Label>
                <Input
                  id="titleMin"
                  type="number"
                  min={1}
                  value={settings.titleMinChars}
                  onChange={(e) =>
                    setSettings({ ...settings, titleMinChars: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="titleMax">Titre - maximum</Label>
                <Input
                  id="titleMax"
                  type="number"
                  min={1}
                  value={settings.titleMaxChars}
                  onChange={(e) =>
                    setSettings({ ...settings, titleMaxChars: Number(e.target.value) })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="descMin">Descriptif - minimum</Label>
                <Input
                  id="descMin"
                  type="number"
                  min={1}
                  value={settings.descMinChars}
                  onChange={(e) =>
                    setSettings({ ...settings, descMinChars: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="descMax">Descriptif - maximum</Label>
                <Input
                  id="descMax"
                  type="number"
                  min={1}
                  value={settings.descMaxChars}
                  onChange={(e) =>
                    setSettings({ ...settings, descMaxChars: Number(e.target.value) })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Consignes pour l&apos;IA</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="instructions">
                Consignes utilisées pour guider la génération des titres et descriptifs
              </Label>
              <Textarea
                id="instructions"
                value={settings.instructions}
                onChange={(e) =>
                  setSettings({ ...settings, instructions: e.target.value })
                }
                placeholder="Ex: Utilise un ton poétique et évocateur. Fais référence aux émotions plutôt qu'à la technique photographique..."
                rows={6}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="url">URL du site du photographe</Label>
              <Input
                id="url"
                type="url"
                value={settings.photographerUrl}
                onChange={(e) =>
                  setSettings({ ...settings, photographerUrl: e.target.value })
                }
                placeholder="https://www.monsite-photo.com"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Documents PDF ({pdfs.length}/5)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Fichiers PDF décrivant le travail du photographe. Ils sont transmis à l&apos;IA comme contexte pour la génération.
            </p>

            {pdfs.length > 0 && (
              <ul className="space-y-2">
                {pdfs.map((pdf) => (
                  <li key={pdf.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <span className="text-sm truncate mr-2">{pdf.originalFilename}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive shrink-0"
                      onClick={() => handleDeletePdf(pdf.id, pdf.originalFilename)}
                    >
                      Supprimer
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {pdfs.length < 5 && (
              <div>
                <Input
                  id="pdf-upload"
                  type="file"
                  accept=".pdf"
                  onChange={handleUploadPdf}
                  disabled={uploading}
                  className="cursor-pointer"
                />
              </div>
            )}

            {uploading && <p className="text-sm text-muted-foreground animate-pulse">Upload en cours...</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Utilisation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Tokens input :{" "}
              <span className="font-medium text-foreground">{totalInputTokens.toLocaleString("fr-FR")}</span>
              {" "}&mdash; Tokens output :{" "}
              <span className="font-medium text-foreground">{totalOutputTokens.toLocaleString("fr-FR")}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Co&ucirc;t estim&eacute; :{" "}
              <span className="font-medium text-foreground">
                {((totalInputTokens * 3 + totalOutputTokens * 15) / 1_000_000 * 0.92).toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 4 })}
              </span>
              <span className="text-xs ml-1">(Sonnet 4.6 : 3$/MTok input, 15$/MTok output, taux 0,92)</span>
            </p>
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
          {saving ? "Sauvegarde..." : "Enregistrer les paramètres"}
        </Button>
      </div>
    </div>
  );
}
