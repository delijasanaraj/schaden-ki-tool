import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import sharp from "sharp";
import {
  ACCEPTED_MIME_TYPES,
  MAX_IMAGES,
  MAX_IMAGE_BYTES,
  MAX_TOTAL_UPLOAD_BYTES,
  MIN_IMAGES,
  analysisResultSchema,
  vehicleDataSchema,
  type AnalysisResult,
  type VehicleData,
} from "@/lib/schema";
import { SYSTEM_PROMPT, buildUserContext } from "@/lib/prompt";
import { cleanLead, leadErrors, type LeadData } from "@/lib/lead";
import { sendNotification, sendPush } from "@/lib/notify";
import { clientIp, createRateLimiter } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

const GENERIC_ERROR_MESSAGE =
  "Die Analyse konnte gerade nicht abgeschlossen werden. Bitte versuchen Sie es erneut oder senden Sie Ihre Fotos direkt über die Kontaktanfrage an den Gutachter.";

const client = new Anthropic();
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";
// "high"/"xhigh" erhoehen bei vielen Fotos das Risiko, die harte 60s-Zeitgrenze
// der Vercel-Funktion zu reissen (siehe Vorfall vom 10.09.2026: echter Nutzer,
// mehrere Fotos, "Task timed out after 60 seconds" laut Vercel-Logs). "medium"
// ist laut Anthropic haeufig der beste Kompromiss aus Qualitaet und Tempo.
type Effort = "low" | "medium" | "high" | "xhigh" | "max";
const ANALYSIS_EFFORT = (process.env.ANTHROPIC_EFFORT || "medium") as Effort;

// Reale Produktionstests (02.10.2026, echtes Testfoto 18x/20x ueber die Live-URL)
// zeigten 30-46s Serverzeit bei 18-20 Fotos - das schwankt mit der Anthropic-
// Auslastung und liegt gefaehrlich nah am harten 60s-Limit der Vercel-Funktion
// (siehe Vorfall 10.09.2026). Ab vielen Fotos wird der Aufwand automatisch auf
// "low" reduziert, um Luft zum Limit zu behalten - lieber eine etwas einfachere
// Analyse als ein erneuter Absturz fuer echte Interessenten.
const HIGH_VOLUME_PHOTO_THRESHOLD = Number(process.env.HIGH_VOLUME_PHOTO_THRESHOLD || 10);

// Business-Kalibrierung auf Wunsch des Gutachters: die rohe KI-Schaetzung liegt
// laut seiner Erfahrung systematisch zu niedrig. Der Multiplikator wird NACH der
// KI-Analyse angewendet - die KI selbst schaetzt weiterhin ehrlich und unabhaengig,
// dies ist eine bewusste, dokumentierte und leicht nachjustierbare Kalibrierung.
const COST_ESTIMATE_MULTIPLIER = Number(process.env.COST_ESTIMATE_MULTIPLIER || 1);

function applyCostCalibration(result: AnalysisResult): AnalysisResult {
  if (!result.estimated_cost_range.possible || COST_ESTIMATE_MULTIPLIER === 1) return result;
  return {
    ...result,
    estimated_cost_range: {
      ...result.estimated_cost_range,
      minimum_eur: Math.round((result.estimated_cost_range.minimum_eur * COST_ESTIMATE_MULTIPLIER) / 10) * 10,
      maximum_eur: Math.round((result.estimated_cost_range.maximum_eur * COST_ESTIMATE_MULTIPLIER) / 10) * 10,
    },
  };
}

const isRateLimited = createRateLimiter(Number(process.env.RATE_LIMIT_PER_HOUR || 20));

function formatVehicle(v: VehicleData): string {
  const lines = [
    `Fahrzeug: ${[v.make, v.model].filter(Boolean).join(" ") || "nicht angegeben"}`,
    `Erstzulassung: ${v.firstRegistration || "nicht angegeben"}`,
  ];
  if (v.mileage) lines.push(`Kilometerstand: ${v.mileage}`);
  if (v.damageArea) lines.push(`Beschädigter Bereich: ${v.damageArea}`);
  if (v.drivable) lines.push(`Fahrbereit: ${v.drivable}`);
  if (v.airbagsDeployed) lines.push(`Airbags ausgelöst: ${v.airbagsDeployed}`);
  if (v.warningLights) lines.push(`Warnleuchten: ${v.warningLights}`);
  if (v.description) lines.push(`Unfallhergang laut Kunde: ${v.description}`);
  return lines.join("\n");
}

function formatLeadMail(lead: LeadData, vehicle: VehicleData, photoCount: number): string {
  return [
    "Jemand hat die KI-Schadenanalyse genutzt und seine Kontaktdaten hinterlassen.",
    "Der Kunde hat der Kontaktaufnahme zu dieser Anfrage ausdrücklich zugestimmt.",
    "",
    `Name: ${lead.firstName} ${lead.lastName}`,
    `Telefon: ${lead.phone}`,
    `E-Mail: ${lead.email}`,
    "",
    formatVehicle(vehicle),
    `Anzahl Fotos: ${photoCount}`,
    "",
    `Zeitpunkt: ${new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}`,
  ].join("\n");
}

async function stripExifAndReencode(buffer: Buffer, maxEdge: number): Promise<Buffer> {
  // sharp() liest die EXIF-Orientierung, .rotate() ohne Parameter wendet sie
  // physisch an. Der Aufruf von .jpeg() ohne withMetadata() verwirft danach
  // alle Metadaten (inkl. GPS) - das Ergebnis enthaelt keine EXIF-Daten mehr.
  return sharp(buffer)
    .rotate()
    .resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
}

export async function POST(req: NextRequest) {
  // Wird erst nach erfolgreicher Pruefung der Kontaktdaten belegt und muss auch auf
  // Fehlerpfaden abgewartet werden, sonst verwirft Vercel den laufenden Versand.
  let leadDelivery: Promise<void> = Promise.resolve();
  try {
    if (isRateLimited(clientIp(req))) {
      return NextResponse.json(
        { error: "rate_limited", message: "Zu viele Anfragen. Bitte versuchen Sie es später erneut." },
        { status: 429 }
      );
    }

    const form = await req.formData();
    const files = form.getAll("photos").filter((f): f is File => f instanceof File);
    const vehicleDataRaw = form.get("vehicleData");

    // Kontaktdaten sind Pflicht, bevor die Analyse (und damit die Schadenssumme) ausgefuehrt
    // wird - verbindlich hier auf dem Server, nicht nur im Browser.
    let leadInput: Partial<LeadData> & { consent?: boolean } = {};
    try {
      const leadRaw = form.get("lead");
      if (typeof leadRaw === "string") leadInput = JSON.parse(leadRaw) ?? {};
    } catch {
      leadInput = {};
    }
    if (Object.keys(leadErrors(leadInput)).length > 0 || leadInput.consent !== true) {
      return NextResponse.json(
        {
          error: "invalid_lead",
          message:
            "Bitte geben Sie Ihre Kontaktdaten vollständig an und stimmen Sie der Kontaktaufnahme zu, um Ihre Einschätzung zu sehen.",
        },
        { status: 400 }
      );
    }
    const lead = cleanLead(leadInput as LeadData);

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

    let totalBytes = 0;
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
      totalBytes += file.size;
    }
    // Zweite Absicherung neben der clientseitigen Pruefung - Vercel-Funktionen
    // lehnen zu grosse Bodies sonst mit einem unklaren Plattform-Fehler ab.
    if (totalBytes > MAX_TOTAL_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          error: "upload_too_large",
          message:
            "Die Fotos sind zusammen zu groß für eine Übertragung. Bitte entfernen Sie einige Fotos oder verwenden Sie kleinere Dateien.",
        },
        { status: 413 }
      );
    }

    let vehicleData: VehicleData = {};
    if (typeof vehicleDataRaw === "string" && vehicleDataRaw.length > 0) {
      let rawObject: Record<string, unknown> = {};
      try {
        const json = JSON.parse(vehicleDataRaw);
        // Leere Auswahlfelder ("Bitte waehlen" = "") gelten als nicht angegeben, statt die
        // ganze Anfrage an der Enum-Pruefung scheitern zu lassen.
        rawObject = Object.fromEntries(
          Object.entries(json && typeof json === "object" ? json : {}).filter(([, v]) => v !== "")
        );
      } catch {
        rawObject = {};
      }
      const parsed = vehicleDataSchema.safeParse(rawObject);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "invalid_input", message: "Fahrzeugdaten konnten nicht gelesen werden." },
          { status: 400 }
        );
      }
      vehicleData = parsed.data;
    }

    const effectiveEffort: Effort =
      files.length > HIGH_VOLUME_PHOTO_THRESHOLD ? "low" : ANALYSIS_EFFORT;
    const imageMaxEdge = files.length > HIGH_VOLUME_PHOTO_THRESHOLD ? 1100 : 1400;

    let processedImages: string[];
    try {
      processedImages = await Promise.all(
        files.map(async (file) => {
          const arrayBuffer = await file.arrayBuffer();
          const cleaned = await stripExifAndReencode(Buffer.from(arrayBuffer), imageMaxEdge);
          return cleaned.toString("base64");
        })
      );
    } catch (err) {
      console.error("[/api/analyze] Bildverarbeitung fehlgeschlagen:", err instanceof Error ? err.message : err);
      return NextResponse.json(
        {
          error: "invalid_file",
          message:
            "Mindestens eine Datei konnte nicht verarbeitet werden. Bitte prüfen Sie, ob alle Dateien echte, unbeschädigte Fotos sind, und versuchen Sie es erneut.",
        },
        { status: 400 }
      );
    }

    // Lead-Benachrichtigung startet VOR der Analyse, damit der Kontakt auch dann beim
    // Gutachter ankommt, wenn die Analyse spaeter in ein Timeout laeuft.
    leadDelivery = Promise.all([
      sendNotification(
        `Neuer KI-Lead: ${lead.firstName} ${lead.lastName}`,
        formatLeadMail(lead, vehicleData, files.length)
      ),
      // Push ohne Kontaktdaten (die stehen nur in der E-Mail)
      sendPush(
        "Neuer KI-Lead",
        `${[vehicleData.make, vehicleData.model].filter(Boolean).join(" ") || "Fahrzeug unbekannt"} · ${files.length} Foto${files.length === 1 ? "" : "s"}. Kontaktdaten stehen in der E-Mail.`
      ),
    ]).then(([ok]) => {
      if (!ok) {
        // Notnagel ohne konfigurierten E-Mail-Dienst: Lead im Laufzeit-Log festhalten
        // (kurze Aufbewahrung auf dem Hobby-Plan, siehe README).
        console.log("[LEAD-NICHT-ZUGESTELLT]", JSON.stringify({ lead, fahrzeug: vehicleData, fotos: files.length }));
      }
    });

    const response = await client.beta.messages.parse({
      model: MODEL,
      // Grosszuegig bemessen: Claude Opus 5 denkt standardmaessig (thinking ist an),
      // und max_tokens deckelt Denkprozess UND Antworttext gemeinsam ab. Bei knappem
      // Limit wird die strukturierte JSON-Antwort mitten im Fließtext abgeschnitten,
      // was den Parser zum Absturz bringt - daher bewusst hoch angesetzt.
      max_tokens: 12000,
      system: SYSTEM_PROMPT,
      output_config: {
        format: betaZodOutputFormat(analysisResultSchema),
        effort: effectiveEffort,
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
      await leadDelivery;
      return NextResponse.json({ error: "analysis_failed", message: GENERIC_ERROR_MESSAGE }, { status: 502 });
    }

    const parsed = response.parsed_output as AnalysisResult | null;
    if (!parsed) {
      await leadDelivery;
      return NextResponse.json({ error: "analysis_failed", message: GENERIC_ERROR_MESSAGE }, { status: 502 });
    }

    const calibrated = applyCostCalibration(parsed);
    const range = calibrated.estimated_cost_range;

    await leadDelivery;
    await sendNotification(
      `KI-Ergebnis für ${lead.firstName} ${lead.lastName}`,
      [
        `Ergebnis der KI-Analyse für ${lead.firstName} ${lead.lastName} (Tel. ${lead.phone}):`,
        "",
        `Schadenschwere: ${calibrated.severity.level}`,
        range.possible
          ? `Angezeigte Schadenssumme: ${range.minimum_eur.toLocaleString("de-DE")} € bis ${range.maximum_eur.toLocaleString("de-DE")} €`
          : "Keine Schadenssumme angezeigt (nicht seriös schätzbar).",
        "",
        `Zusammenfassung: ${calibrated.summary}`,
        "",
        formatVehicle(vehicleData),
      ].join("\n")
    );

    return NextResponse.json({ result: calibrated, analysisId: randomUUID() });
  } catch (err) {
    console.error("[/api/analyze] Fehler:", err instanceof Error ? err.message : err);
    await leadDelivery;
    return NextResponse.json({ error: "analysis_failed", message: GENERIC_ERROR_MESSAGE }, { status: 500 });
  }
}
