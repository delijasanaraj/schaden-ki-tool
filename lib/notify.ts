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
