import Anthropic from "@anthropic-ai/sdk";
import type { TextBlockParam } from "@anthropic-ai/sdk/resources/messages";

const client = new Anthropic();

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
