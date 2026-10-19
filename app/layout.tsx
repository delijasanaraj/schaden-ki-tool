import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { TOOL_URL } from "@/lib/site";

const TITLE = "Fahrzeugschaden online berechnen – KI-Schadenrechner | WITMAIER";
const DESCRIPTION =
  "Laden Sie Fotos Ihres Fahrzeugschadens hoch und erhalten Sie eine unverbindliche KI-gestützte Ersteinschätzung. Für eine professionelle Schadenbewertung steht Ihnen Kfz-Gutachter Stefan Witmaier persönlich zur Verfügung.";

export const metadata: Metadata = {
  metadataBase: new URL(TOOL_URL),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "de_DE",
    url: "/",
    siteName: "WITMAIER",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
