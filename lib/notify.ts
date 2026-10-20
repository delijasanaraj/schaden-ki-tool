// Versendet Benachrichtigungen an den Gutachter ueber die Resend-API (reines fetch,
// keine zusaetzliche Abhaengigkeit). Ohne RESEND_API_KEY/LEAD_NOTIFY_EMAIL wird nichts
// versendet und false zurueckgegeben - der Aufrufer protokolliert dann den Lead als Notnagel.
const singleLine = (s: string) => s.replace(/[\r\n\t]+/g, " ").slice(0, 200);

export async function sendNotification(subject: string, text: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = (process.env.LEAD_NOTIFY_EMAIL || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const from = process.env.LEAD_FROM_EMAIL || "KI-Schadenanalyse <onboarding@resend.dev>";

  if (!apiKey || to.length === 0) return false;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject: singleLine(subject), text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error("[notify] Resend-Fehler:", res.status, (await res.text().catch(() => "")).slice(0, 300));
      return false;
    }
    return true;
  } catch (err) {
    console.error("[notify] Versand fehlgeschlagen:", err instanceof Error ? err.message : err);
    return false;
  }
}

// Optionale Push-Benachrichtigung aufs Handy ueber ntfy (https://ntfy.sh, kostenlos, kein Konto
// noetig - die ntfy-App abonniert ein Thema). Wird nur gesendet, wenn NTFY_TOPIC gesetzt ist.
// Enthaelt bewusst KEINE Kontaktdaten: Das Thema ist nur durch seinen Namen geschuetzt, die
// Kontaktdaten kommen ausschliesslich per E-Mail.
export async function sendPush(title: string, message: string): Promise<boolean> {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) return false;
  const server = (process.env.NTFY_SERVER || "https://ntfy.sh").replace(/\/+$/, "");

  try {
    const res = await fetch(server, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, title: singleLine(title), message: message.slice(0, 500), priority: 4, tags: ["car"] }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error("[notify] ntfy-Fehler:", res.status);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[notify] Push fehlgeschlagen:", err instanceof Error ? err.message : err);
    return false;
  }
}
