import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import sharp from "sharp";
import { ACCEPTED_MIME_TYPES, MAX_IMAGE_BYTES, vehicleExtractionSchema } from "@/lib/schema";
import { EXTRACTION_SYSTEM_PROMPT } from "@/lib/prompt";

export const runtime = "nodejs";
export const maxDuration = 30;

const GENERIC_ERROR_MESSAGE =
  "Der Fahrzeugschein konnte nicht ausgelesen werden. Bitte tragen Sie die Fahrzeugdaten stattdessen manuell ein.";

const client = new Anthropic();
// Bewusst ein schnelles, guenstiges Modell - reines Ablesen von Formularfeldern
// braucht keine hohe Modellstaerke wie die eigentliche Schadenanalyse.
const EXTRACTION_MODEL = process.env.ANTHROPIC_EXTRACTION_MODEL || "claude-haiku-4-5";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("document");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "invalid_input", message: "Bitte laden Sie ein Foto des Fahrzeugscheins hoch." },
        { status: 400 }
      );
    }
    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "invalid_file_type", message: "Erlaubt sind JPEG, PNG und WebP." },
        { status: 400 }
      );
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "file_too_large", message: "Die Datei ist zu groß (max. 8 MB)." },
        { status: 400 }
      );
    }

    let imageBase64: string;
    try {
      const arrayBuffer = await file.arrayBuffer();
      // Gleiche Behandlung wie Schadenfotos: EXIF/GPS wird entfernt, das Dokument
      // selbst wird nach der Auswertung nirgends gespeichert.
      const cleaned = await sharp(Buffer.from(arrayBuffer))
        .rotate()
        .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      imageBase64 = cleaned.toString("base64");
    } catch (err) {
      console.error("[/api/extract-vehicle] Bildverarbeitung fehlgeschlagen:", err instanceof Error ? err.message : err);
      return NextResponse.json(
        { error: "invalid_file", message: "Die Datei konnte nicht verarbeitet werden. Bitte prüfen Sie das Foto." },
        { status: 400 }
      );
    }

    const response = await client.beta.messages.parse({
      model: EXTRACTION_MODEL,
      max_tokens: 1024,
      system: EXTRACTION_SYSTEM_PROMPT,
      output_config: {
        format: betaZodOutputFormat(vehicleExtractionSchema),
      },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image" as const,
              source: { type: "base64" as const, media_type: "image/jpeg" as const, data: imageBase64 },
            },
            { type: "text" as const, text: "Lies die Fahrzeugdaten aus diesem Foto aus." },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return NextResponse.json({ error: "extraction_failed", message: GENERIC_ERROR_MESSAGE }, { status: 502 });
    }

    return NextResponse.json({ result: response.parsed_output });
  } catch (err) {
    console.error("[/api/extract-vehicle] Fehler:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "extraction_failed", message: GENERIC_ERROR_MESSAGE }, { status: 500 });
  }
}
