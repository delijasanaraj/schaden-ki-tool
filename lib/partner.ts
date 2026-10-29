import { createHash, timingSafeEqual } from "crypto";
import type { AnalysisResult } from "@/lib/schema";

// Zugang fuer Partner-Apps (z. B. Crash Assist) zur Analyse-Schnittstelle.
// PARTNER_API_KEYS="crash-assist:SCHLUESSEL,weiterer-partner:SCHLUESSEL2" (kommagetrennt).
// Der Schluessel wird als "X-API-Key: ..." oder "Authorization: Bearer ..." gesendet.
// Ohne Schluessel laeuft die Anfrage wie bisher als normale Web-Anfrage (Ratenbegrenzung pro IP).
export type PartnerAuth =
  | { state: "none" }
  | { state: "invalid" }
  | { state: "ok"; name: string; label: string };

const digest = (s: string) => createHash("sha256").update(s).digest();

function configuredPartners(): { name: string; key: string }[] {
  return (process.env.PARTNER_API_KEYS || "")
    .split(",")
    .map((entry) => {
      const i = entry.indexOf(":");
      return i > 0 ? { name: entry.slice(0, i).trim(), key: entry.slice(i + 1).trim() } : null;
    })
    .filter((p): p is { name: string; key: string } => !!p && p.name.length > 0 && p.key.length >= 16);
}

export function authenticatePartner(req: Request): PartnerAuth {
  const bearer = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const provided = (req.headers.get("x-api-key") || bearer || "").trim();
  if (!provided) return { state: "none" };

  const providedHash = digest(provided);
  for (const p of configuredPartners()) {
    if (timingSafeEqual(providedHash, digest(p.key))) {
      const label = p.name.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      return { state: "ok", name: p.name, label };
    }
  }
  return { state: "invalid" };
}

// Native Apps brauchen kein CORS. Apps auf Web-Basis (Capacitor, Ionic, Cordova, WebView)
// senden aber eine Origin und loesen eine Vorabanfrage (OPTIONS) aus. Der Schluessel liegt im
// Header (keine Cookies), daher ist "*" hier unbedenklich.
export const PARTNER_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Authorization, X-Test-Mode",
  "Access-Control-Max-Age": "86400",
};

// Testmodus fuer Entwickler: Mit gueltigem Schluessel und Header "X-Test-Mode: true" laufen alle
// Pruefungen (Kontaktdaten, Fotos, Fahrzeugdaten) wie echt, danach kommt diese feste Beispielantwort -
// ohne KI-Aufruf, ohne E-Mail und ohne Kosten. Die Zahlen sind erfunden.
export const SAMPLE_RESULT: AnalysisResult = {
  analysis_status: "completed",
  summary:
    "BEISPIELANTWORT (Testmodus, keine echte Analyse): An der Fahrzeugfront ist der Stoßfänger verformt und der rechte Scheinwerfer beschädigt. Die Motorhaube zeigt Lackschäden.",
  visible_damage: [
    { area: "Fahrzeugfront", component: "Stoßfänger", damage_type: "Verformung", confidence: "high" },
    { area: "Fahrzeugfront rechts", component: "Scheinwerfer", damage_type: "Riss", confidence: "medium" },
  ],
  severity: { level: "mittel", explanation: "Beispieltext: mehrere Bauteile der Front sind betroffen." },
  drivability_warning: { possible_safety_issue: true, message: "Beispieltext: Bitte nicht weiterfahren, bevor ein Fachmann das Fahrzeug geprüft hat." },
  estimated_cost_range: {
    possible: true,
    minimum_eur: 3000,
    maximum_eur: 6000,
    confidence: "low",
    explanation: "Beispieltext: Erfundene Zahlen, nur zum Testen der Anzeige.",
  },
  possible_hidden_damage: ["Beispieltext: Mögliche Schäden an Kühler oder Halterungen hinter dem Stoßfänger."],
  recommended_next_steps: ["Beispieltext: Fahrzeug durch einen Kfz-Sachverständigen begutachten lassen."],
  additional_photos_requested: ["Beispieltext: Aufnahme der Fahrzeugfront aus etwas größerem Abstand."],
  limitations: ["Beispieltext: Dies ist keine echte KI-Analyse."],
};
