# Schaden-KI-Tool (extern, Ergänzung zu stefan-witmaier.de)

Kleine, eigenständige Next.js-Anwendung für die echte KI-gestützte Fahrzeugschaden-Ersteinschätzung.
Läuft bewusst **außerhalb** von Onepage, weil der API-Schlüssel serverseitig sicher gespeichert werden
muss – dafür bietet Onepage MCP kein Werkzeug.

## Was hier bereits funktioniert

- Foto-Upload (1–8 Bilder, JPEG/PNG/WebP, Vorschau, Entfernen, clientseitige Verkleinerung)
- Optionale Fahrzeugdaten + Unfallbeschreibung (max. 1500 Zeichen)
- Nicht vorausgewählte Einwilligung vor Analysestart
- Serverseitige EXIF-Entfernung (inkl. GPS) vor Weiterverarbeitung, per `sharp`
- Echte KI-Analyse über die Anthropic Claude API mit striktem, validiertem JSON-Ergebnis
- Konservative, vorsichtige System-Prompt-Regeln (keine erfundenen Kosten, Sicherheitswarnung bei
  Verdacht auf sicherheitsrelevante Schäden, ehrliches "keine seriöse Kostenspanne möglich")
- Lade-, Erfolgs- und Fehlerzustand
- Kontaktübergabe per vorausgefülltem Anruf-/WhatsApp-/E-Mail-Link (kein automatischer Versand,
  der Nutzer entscheidet in seiner eigenen App)

## Was hier bewusst NICHT implementiert ist

- **Keine dauerhafte Speicherung** von Fotos oder Ergebnissen (kein Datenbank-Anschluss). Fotos werden
  nur im Arbeitsspeicher der Anfrage verarbeitet und danach verworfen.
- **Kein CRM/Lead-Backend.** Die Kontaktübergabe passiert rein clientseitig über `mailto:` / `tel:` /
  `wa.me`-Links. Es gibt keine Weiterleitung an ein Onepage-CRM.
- **Keine belastbare Ratenbegrenzung.** Die eingebaute IP-Zählung ist nur ein Notbehelf (siehe unten).
- **Keine automatischen Löschfristen**, weil nichts gespeichert wird, gibt es nichts zu löschen – das
  ist zugleich die einfachste Umsetzung von Datenminimierung.

## Voraussetzungen zum Starten

1. Node.js 20 LTS installieren (falls noch nicht vorhanden): https://nodejs.org
2. In diesem Ordner:
   ```bash
   npm install
   cp .env.example .env.local
   ```
3. `.env.local` öffnen und `ANTHROPIC_API_KEY` eintragen (siehe unten, wie man einen bekommt).
4. Lokal testen:
   ```bash
   npm run dev
   ```
   Dann `http://localhost:3000` öffnen.

## Manuelle Schritte, die nur du ausführen kannst

Ich darf keine Konten anlegen oder Zahlungsdaten hinterlegen – das musst du selbst tun.

### 1. Anthropic-API-Schlüssel besorgen
- Auf https://console.anthropic.com registrieren
- Unter "API Keys" einen neuen Schlüssel erzeugen
- Abrechnung ist nutzungsabhängig (Pay-per-Use), kein Abo. Grobe Kostenschätzung pro Analyse (3–5 Fotos,
  Modell `claude-sonnet-5`): ca. 0,01–0,03 € pro Analyse – die exakte Zahl hängt von Bildgröße und Textlänge
  ab und sollte nach den ersten echten Analysen aus dem Anthropic-Dashboard abgelesen werden.
- Schlüssel **nur** in `.env.local` bzw. später in den Umgebungsvariablen des Hosting-Anbieters eintragen,
  niemals in Code oder Chat teilen.

### 2. Hosting einrichten (empfohlen: Vercel)
- Auf https://vercel.com mit GitHub/E-Mail registrieren (Free-Tier reicht anfangs)
- Dieses Projekt in ein eigenes GitHub-Repository pushen
- In Vercel "Add New Project" → Repository auswählen → Umgebungsvariable `ANTHROPIC_API_KEY` (und optional
  `ANTHROPIC_MODEL`, `RATE_LIMIT_PER_HOUR`) im Vercel-Projekt unter "Settings → Environment Variables"
  eintragen
- Deploy starten

### 3. Domain verbinden (optional, später)
- In Vercel unter "Settings → Domains" z. B. `schaden-check.stefan-witmaier.de` hinzufügen
- Bei deinem Domain-Anbieter (dort, wo stefan-witmaier.de verwaltet wird) einen CNAME-Eintrag auf die von
  Vercel angezeigte Zieladresse setzen
- Bis dahin funktioniert die Seite unter der von Vercel automatisch vergebenen `*.vercel.app`-Adresse

### 4. Rechtliches prüfen (nicht von mir geprüft, echte rechtliche Prüfung nötig)
- Die Datenschutzerklärung von stefan-witmaier.de muss ergänzt werden: Fotos und Angaben werden zur
  Analyse an Anthropic (USA, mit Standard-Vertragsklauseln/EU-Datenschutzrahmen) übermittelt, dort
  verarbeitet und nicht dauerhaft von dieser Anwendung gespeichert (Speicherdauer bei Anthropic selbst:
  siehe deren aktuelle Data-Retention-Angaben, ggf. anwaltlich prüfen lassen)
- Klären, ob ein Auftragsverarbeitungsvertrag (AVV) mit Anthropic nötig/möglich ist
- Prüfen, ob ein Impressum auf dieser separaten Domain zusätzlich nötig ist (rechtlich empfehlenswert,
  auch wenn inhaltlich auf stefan-witmaier.de verwiesen wird)

### 5. Vor dem Live-Schalten
- Mit echten Testfotos in mehreren Szenarien testen (siehe Testfälle unten)
- `robots: { index: false, follow: false }` in `app/layout.tsx` bewusst so gelassen, bis alles final
  geprüft ist – danach ggf. auf `index: true` umstellen

## Bekannte technische Grenzen

- **Body-Größenlimit bei Serverless-Hosting:** Vercel begrenzt Anfragen im Free-/Pro-Tier auf wenige MB.
  Die App verkleinert Fotos deshalb bereits im Browser auf max. 1600px Kantenlänge vor dem Upload – bei
  sehr vielen sehr großen Originalfotos kann das dennoch knapp werden. Bei Bedarf: Upload-Limit auf z. B.
  6 Fotos senken oder auf einen Hosting-Plan mit größerem Limit wechseln.
- **Ratenbegrenzung ist nur ein Notbehelf:** Die eingebaute Zählung lebt nur im Arbeitsspeicher einer
  einzelnen Serverless-Instanz und wird bei jedem Kaltstart zurückgesetzt. Für echten Schutz vor Missbrauch
  später z. B. Vercel-eigenes Rate-Limiting oder einen Dienst wie Upstash Redis ergänzen.
- **Kein Monitoring/Alerting** bei Fehlern oder ungewöhnlich hohem Verbrauch – im Anthropic-Dashboard
  gelegentlich manuell prüfen oder ein Ausgaben-Limit im Anthropic-Konto setzen.

## Testfälle (manuell durchspielen)

1. Leichter, eindeutiger Schaden (z. B. Kratzer) → erwartet: `severity.level: "leicht"`
2. Mittlerer Schaden mit mehreren betroffenen Bauteilen
3. Möglicher sicherheitsrelevanter Schaden (z. B. sichtbar deformiertes Rad) → erwartet: Sicherheitshinweis
   wird hervorgehoben angezeigt
4. Sehr unscharfes/dunkles oder falsches Foto (kein Auto erkennbar) → erwartet:
   `analysis_status: "insufficient_images"` mit konkreten Foto-Wünschen
5. Kein `ANTHROPIC_API_KEY` gesetzt bzw. ungültiger Key → erwartet: Fehlerzustand mit der definierten
   Fehlermeldung, kein Absturz der Seite

## Ordnerstruktur

```
app/
  page.tsx              Hero + 3 Schritte + Wizard
  api/analyze/route.ts  Server-Route: Validierung, EXIF-Entfernung, KI-Aufruf
components/
  DamageWizard.tsx       Der eigentliche Ablauf (Upload → Daten → Einwilligung → Ergebnis)
lib/
  schema.ts              Zod-Schemas (Ergebnis-Struktur, Fahrzeugdaten)
  prompt.ts               System-Prompt mit den konservativen KI-Regeln
  compressImage.ts        Client-seitige Bildverkleinerung vor Upload
```

_Automatisch verbunden mit Vercel via GitHub._
