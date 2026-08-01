import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import sharp from "sharp";
import {
  ACCEPTED_MIME_TYPES,
  MAX_IMAGES,
  MAX_IMAGE_BYTES,
  MIN_IMAGES,
  analysisResultSchema,
  vehicleDataSchema,
  type AnalysisResult,
  type VehicleData,
} from "@/lib/schema";
import { SYSTEM_PROMPT, buildUserContext } from "@/lib/prompt";

export const runtime = "nodejs";
export const maxDuration = 60;

const client = new Anthropic();
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

// Sehr einfache, best-effort In-Memory-Ratenbegrenzung pro IP.
// Ueberlebt keinen Serverless-Kaltstart und funktioniert nicht ueber mehrere
// Instanzen hinweg zuverlaessig - siehe README fuer eine produktionsreife Alternative.
const requestLog = new Map<string, number[]>();
const RATE_LIMIT_PER_HOUR = Number(process.env.RATE_LIMIT_PER_HOUR || 20);

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;
  const timestamps = (requestLog.get(ip) || []).filter((t) => t > hourAgo);
  timestamps.push(now);
  requestLog.set(ip, timestamps);
  return timestamps.length > RATE_LIMIT_PER_HOUR;
}

async function stripExifAndReencode(buffer: Buffer): Promise<Buffer> {
  // sharp() liest die EXIF-Orientierung, .rotate() ohne Parameter wendet sie
  // physisch an. Der Aufruf von .jpeg() ohne withMetadata() verwirft danach
  // alle Metadaten (inkl. GPS) - das Ergebnis enthaelt keine EXIF-Daten mehr.
  return sharp(buffer)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "rate_limited", message: "Zu viele Anfragen. Bitte versuchen Sie es später erneut." },
        { status: 429 }
      );
    }

    const form = await req.formData();
    const files = form.getAll("photos").filter((f): f is File => f instanceof File);
    const vehicleDataRaw = form.get("vehicleData");

    if (files.length < MIN_IMAGES) {
      return NextResponse.json(
        { error: "invalid_input", message: "Bitte laden Sie mindestens ein Foto hoch." },
        { status: 400 }
      );
    }
    if (files.length > MAX_IMAGES) {
      return NextResponse.json(
        { error: "invalid_input", message: `Maximal ${MAX_IMAGES} Fotos sind möglich.` },
        { status: 400 }
      );
    }

    for (const file of files) {
      if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
        return NextResponse.json(
          {
            error: "invalid_file_type",
            message: `Dateityp nicht unterstützt: ${file.type || "unbekannt"}. Erlaubt sind JPEG, PNG und WebP.`,
          },
          { status: 400 }
        );
      }
      if (file.size > MAX_IMAGE_BYTES) {
        return NextResponse.json(
          { error: "file_too_large", message: `Datei "${file.name}" ist zu groß (max. 8 MB pro Foto).` },
          { status: 400 }
        );
      }
    }

    let vehicleData: VehicleData = {};
    if (typeof vehicleDataRaw === "string" && vehicleDataRaw.length > 0) {
      const parsed = vehicleDataSchema.safeParse(JSON.parse(vehicleDataRaw));
      if (!parsed.success) {
        return NextResponse.json(
          { error: "invalid_input", message: "Fahrzeugdaten konnten nicht gelesen werden." },
          { status: 400 }
        );
      }
      vehicleData = parsed.data;
    }

    const processedImages = await Promise.all(
      files.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const cleaned = await stripExifAndReencode(Buffer.from(arrayBuffer));
        return cleaned.toString("base64");
      })
    );

    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      output_config: {
        format: betaZodOutputFormat(analysisResultSchema),
      },
      messages: [
        {
          role: "user",
          content: [
            ...processedImages.map((data) => ({
              type: "image" as const,
              source: { type: "base64" as const, media_type: "image/jpeg" as const, data },
            })),
            {
              type: "text" as const,
              text: buildUserContext(vehicleData, processedImages.length),
            },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        {
          error: "analysis_failed",
          message:
            "Die Analyse konnte gerade nicht abgeschlossen werden. Bitte versuchen Sie es erneut oder senden Sie Ihre Fotos direkt über die Kontaktanfrage an den Gutachter.",
        },
        { status: 502 }
      );
    }

    const parsed = response.parsed_output as AnalysisResult | null;
    if (!parsed) {
      return NextResponse.json(
        {
          error: "analysis_failed",
          message:
            "Die Analyse konnte gerade nicht abgeschlossen werden. Bitte versuchen Sie es erneut oder senden Sie Ihre Fotos direkt über die Kontaktanfrage an den Gutachter.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ result: parsed, analysisId: randomUUID() });
  } catch (err) {
    console.error("[/api/analyze] Fehler:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      {
        error: "analysis_failed",
        message:
          "Die Analyse konnte gerade nicht abgeschlossen werden. Bitte versuchen Sie es erneut oder senden Sie Ihre Fotos direkt über die Kontaktanfrage an den Gutachter.",
      },
      { status: 500 }
    );
  }
}
