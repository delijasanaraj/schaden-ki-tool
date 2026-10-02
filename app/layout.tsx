import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fahrzeugschaden online einschätzen lassen | KI-Ersteinschätzung",
  description:
    "Laden Sie Fotos Ihres Fahrzeugschadens hoch und erhalten Sie eine unverbindliche KI-gestützte Ersteinschätzung. Für eine professionelle Schadenbewertung steht Ihnen Kfz-Gutachter Stefan Witmaier persönlich zur Verfügung.",
  robots: { index: false, follow: false },
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
