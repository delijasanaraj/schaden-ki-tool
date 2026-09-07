"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app/error.tsx] Unerwarteter Fehler:", error);
  }, [error]);

  return (
    <main
      style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        textAlign: "center",
        fontFamily: "'Instrument Sans', system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 480 }}>
        <h1 style={{ fontSize: 22, marginBottom: 12 }}>Es ist ein unerwarteter Fehler aufgetreten</h1>
        <p style={{ color: "#4a4a58", marginBottom: 24 }}>
          Das tut uns leid. Bitte versuchen Sie es erneut, oder kontaktieren Sie den Gutachter direkt, falls
          das Problem bestehen bleibt.
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
            Erneut versuchen
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
            Stattdessen anrufen
          </a>
        </div>
      </div>
    </main>
  );
}
