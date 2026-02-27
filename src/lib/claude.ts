import Anthropic from "@anthropic-ai/sdk";
import type { TextBlockParam } from "@anthropic-ai/sdk/resources/messages";

const client = new Anthropic();

// --- Theme assignment ---

interface AssignThemesInput {
  photos: { filename: string; title: string; description: string }[];
  numThemes: number;
}

interface ThemeAssignment {
  filename: string;
  theme: string;
}

interface AssignThemesOutput {
  themes: string[];
  assignments: Record<string, string>; // filename → theme
  inputTokens: number;
  outputTokens: number;
}

export async function assignThemes(
  input: AssignThemesInput
): Promise<AssignThemesOutput> {
  const { photos, numThemes } = input;

  const photoList = photos
    .map((p) => {
      const parts = [`- [${p.filename}]`];
      if (p.title) parts.push(`  Titre : ${p.title}`);
      if (p.description) parts.push(`  Descriptif : ${p.description}`);
      if (!p.title && !p.description) parts.push(`  (pas de métadonnées)`);
      return parts.join("\n");
    })
    .join("\n");

  const systemText = [
    "Tu es un assistant spécialisé dans la classification thématique de photographies d'art.",
    `Tu dois analyser la liste de photos ci-dessous et déterminer exactement ${numThemes} thèmes pertinents.`,
    "Les thèmes doivent être courts (1 à 3 mots), en français.",
    "Chaque photo doit être attribuée à exactement un thème.",
    "La répartition doit être à peu près équilibrée entre les thèmes, tout en restant pertinente.",
    "Base-toi UNIQUEMENT sur les titres et descriptifs pour déterminer les thèmes. Ignore les noms de fichiers, ils ne sont pas pertinents.",
    "Si une photo n'a ni titre ni descriptif, attribue-la au thème le plus générique ou le moins représenté.",
  ].join("\n\n");

  const userText = [
    `Voici la liste des ${photos.length} photos :\n`,
    photoList,
    `\nDétermine ${numThemes} thèmes et attribue chaque photo à un thème.`,
  ].join("\n");

  // Build the JSON schema for assignments: each filename maps to a theme
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 16384,
    system: [
      {
        type: "text",
        text: systemText,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userText }],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            themes: {
              type: "array",
              items: { type: "string" },
              description: `Liste des ${numThemes} thèmes déterminés`,
            },
            assignments: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  filename: { type: "string", description: "Nom du fichier" },
                  theme: { type: "string", description: "Thème attribué" },
                },
                required: ["filename", "theme"],
                additionalProperties: false,
              },
              description: "Liste des attributions filename → thème",
            },
          },
          required: ["themes", "assignments"],
          additionalProperties: false,
        },
      },
    },
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  const parsed = JSON.parse(textBlock.text) as {
    themes: string[];
    assignments: ThemeAssignment[];
  };

  // Convert array to Record<filename, theme>
  const assignments: Record<string, string> = {};
  for (const a of parsed.assignments) {
    assignments[a.filename] = a.theme;
  }

  return {
    themes: parsed.themes,
    assignments,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

// --- Title & description generation ---

interface GenerateInput {
  imageBase64: string;
  imageMimeType: string;
  transcription: string;
  settings: {
    titleMinChars: number;
    titleMaxChars: number;
    descMinChars: number;
    descMaxChars: number;
    instructions: string;
    photographerUrl: string;
  };
  pdfContents: { filename: string; base64: string }[];
}

interface GenerateOutput {
  title: string;
  description: string;
  inputTokens: number;
  outputTokens: number;
}

export async function generateTitleAndDescription(
  input: GenerateInput
): Promise<GenerateOutput> {
  const { imageBase64, imageMimeType, transcription, settings, pdfContents } = input;

  // Build system prompt as TextBlockParam[] with cache_control on the main block
  const systemParts: string[] = [
    "Tu es un assistant spécialisé dans la rédaction de titres et descriptifs pour des photographies d'art.",
    "Tu analyses l'image fournie et la transcription vocale du photographe pour proposer un titre et un descriptif.",
  ];

  if (settings.photographerUrl) {
    systemParts.push(`Site web du photographe : ${settings.photographerUrl}`);
  }

  if (settings.instructions) {
    systemParts.push(`Consignes spécifiques du photographe :\n${settings.instructions}`);
  }

  systemParts.push(
    `Contraintes strictes :`,
    `- Le titre DOIT contenir entre ${settings.titleMinChars} et ${settings.titleMaxChars} caractères (espaces compris).`,
    `- Le descriptif DOIT contenir entre ${settings.descMinChars} et ${settings.descMaxChars} caractères (espaces compris).`,
    `- Réponds uniquement avec le JSON demandé, sans autre texte.`
  );

  const systemBlocks: TextBlockParam[] = [
    {
      type: "text",
      text: systemParts.join("\n\n"),
      cache_control: { type: "ephemeral" },
    },
  ];

  // Build user message content: PDFs (context) + image + transcription
  const userContent: Anthropic.Messages.ContentBlockParam[] = [];

  // Add PDFs as document blocks in user message
  for (const pdf of pdfContents) {
    userContent.push({
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: pdf.base64,
      },
      title: pdf.filename,
      cache_control: { type: "ephemeral" },
    });
  }

  // Add image
  userContent.push({
    type: "image",
    source: {
      type: "base64",
      media_type: imageMimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
      data: imageBase64,
    },
  });

  // Add transcription prompt
  userContent.push({
    type: "text",
    text: `Transcription du photographe :\n"${transcription}"\n\nGénère un titre et un descriptif pour cette photo.`,
  });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemBlocks,
    messages: [{ role: "user", content: userContent }],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            title: { type: "string", description: "Titre de la photo" },
            description: { type: "string", description: "Descriptif de la photo" },
          },
          required: ["title", "description"],
          additionalProperties: false,
        },
      },
    },
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  const parsed = JSON.parse(textBlock.text) as { title: string; description: string };

  return {
    ...parsed,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
