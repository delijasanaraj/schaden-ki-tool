"use client";

import { useEffect } from "react";

// Faengt Fehler ab, die sogar im Root-Layout selbst auftreten (app/error.tsx
// deckt das NICHT ab). Muss eigene <html>/<body> Tags rendern.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app/global-error.tsx] Kritischer Fehler:", error);
  }, [error]);

  return (
    <html lang="de">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "40px 20px",
            textAlign: "center",
          }}
        >
          <div style={{ maxWidth: 480 }}>
            <h1 style={{ fontSize: 22, marginBottom: 12 }}>Es ist ein unerwarteter Fehler aufgetreten</h1>
            <p style={{ color: "#4a4a58", marginBottom: 24 }}>
              Bitte laden Sie die Seite neu, oder kontaktieren Sie den Gutachter direkt telefonisch.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={reset}
                style={{
                  background: "#1c93da",
                  color: "#fff",
                  border: "none",
                  borderRadius: 999,
                  padding: "12px 24px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Seite neu laden
              </button>
              <a
                href="tel:+4917699808695"
                style={{
                  border: "1px solid #d4d4de",
                  borderRadius: 999,
                  padding: "12px 24px",
                  fontWeight: 600,
                  textDecoration: "none",
                  color: "#07071a",
                }}
              >
                Jetzt anrufen
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
