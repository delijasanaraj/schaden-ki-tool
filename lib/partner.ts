import { createHash, timingSafeEqual } from "crypto";

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
  "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Authorization",
  "Access-Control-Max-Age": "86400",
};
