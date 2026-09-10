# Schaden-KI-Tool (extern, Ergänzung zu stefan-witmaier.de)

Kleine, eigenständige Next.js-Anwendung für die echte KI-gestützte Fahrzeugschaden-Ersteinschätzung.
Läuft bewusst **außerhalb** von Onepage, weil der API-Schlüssel serverseitig sicher gespeichert werden
muss – dafür bietet Onepage MCP kein Werkzeug.

## Was hier bereits funktioniert

- Foto-Upload (1–20 Bilder, JPEG/PNG/WebP, Vorschau, Entfernen, clientseitige Verkleinerung,
  Gesamtgrößen-Prüfung vor dem Absenden)
- Fahrzeugschein-Upload (optional): liest Hersteller, Modell und Baujahr automatisch aus und füllt
  das Formular aus - extrahiert bewusst **keine** Halterdaten, Anschrift, Kennzeichen oder VIN
- Fahrzeughersteller/-modell als kaskadierende Auswahllisten, Baujahr ab 1950
- Optionale Unfallbeschreibung (max. 1500 Zeichen)
- Nicht vorausgewählte Einwilligung vor Analysestart
- Serverseitige EXIF-Entfernung (inkl. GPS) vor Weiterverarbeitung, per `sharp` - gilt für Schadenfotos
  UND den Fahrzeugschein
- Echte KI-Analyse über die Anthropic Claude API (Standard: `claude-opus-5`) mit striktem, validiertem
  JSON-Ergebnis und Anweisung zu gründlicher, vollständiger Schadenserfassung. Analyse-Aufwand
  standardmäßig `medium` (Regler: `ANTHROPIC_EFFORT`) - `high` führte bei mehreren Fotos zu echten
  Server-Timeouts, siehe "Bekannte technische Grenzen"
- Business-Kalibrierung der Kostenspanne: serverseitiger Aufschlag von standardmäßig +200 % auf die
  von der KI geschätzte Reparaturkostenspanne (Regler: `COST_ESTIMATE_MULTIPLIER`, siehe unten) sowie
  ein geschärfter Prompt, der die Spanne bewusst am oberen realistischen Rand ansetzt (Erfahrungswert:
  Fotobasierte Schätzungen unterschätzen echte Reparaturkosten systematisch) und enger fasst (Ziel:
  Spannbreite ca. 30-50 % des Mittelwerts statt beliebig breit)
- Konservative, vorsichtige System-Prompt-Regeln (Sicherheitswarnung bei Verdacht auf sicherheitsrelevante
  Schäden, ehrliches "keine seriöse Kostenspanne möglich")
- Lade-, Erfolgs- und Fehlerzustand inkl. Zeitüberschreitungsschutz (bricht nach 70s selbst ab, statt
  unbegrenzt zu hängen) und React-Error-Boundaries (`app/error.tsx`, `app/global-error.tsx`), damit ein
  unerwarteter Fehler eine verständliche Meldung statt einer weißen/abgestürzten Seite zeigt
- Kontaktübergabe per vorausgefülltem Anruf-/WhatsApp-/E-Mail-Link (kein automatischer Versand,
  der Nutzer entscheidet in seiner eigenen App)

## Was hier bewusst NICHT implementiert ist

- **Keine dauerhafte Speicherung** von Fotos, Fahrzeugschein-Bildern oder Ergebnissen (kein
  Datenbank-Anschluss). Alles wird nur im Arbeitsspeicher der Anfrage verarbeitet und danach verworfen.
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
- Abrechnung ist nutzungsabhängig (Pay-per-Use), kein Abo. **Kostenschätzung wurde nach oben angepasst:**
  Mit `claude-opus-5`, `effort: high` und bis zu 20 Fotos pro Analyse liegt eine realistische Spanne bei
  ca. 0,05–0,25 € pro Analyse, je nach Fotoanzahl - deutlich mehr als die ursprüngliche Schätzung mit
  `claude-sonnet-5` und 8 Fotos (ca. 0,01–0,03 €). Das Fahrzeugschein-Auslesen (separates, günstiges
  Modell `claude-haiku-4-5`) kostet nur Bruchteile eines Cents pro Vorgang. Nach den ersten echten
  Analysen im Anthropic-Dashboard die tatsächlichen Kosten prüfen und ggf. ein Ausgabenlimit setzen.
- Schlüssel **nur** in `.env.local` bzw. später in den Umgebungsvariablen des Hosting-Anbieters eintragen,
  niemals in Code oder Chat teilen.

### 2. Hosting einrichten (empfohlen: Vercel)
- Auf https://vercel.com mit GitHub/E-Mail registrieren (Free-Tier reicht anfangs)
- Dieses Projekt in ein eigenes GitHub-Repository pushen
- In Vercel "Add New Project" → Repository auswählen → Umgebungsvariablen `ANTHROPIC_API_KEY`,
  `ANTHROPIC_MODEL`, `ANTHROPIC_EXTRACTION_MODEL`, `ANTHROPIC_EFFORT`, `COST_ESTIMATE_MULTIPLIER`,
  `RATE_LIMIT_PER_HOUR` im Vercel-Projekt unter "Settings → Environment Variables" eintragen
- Deploy starten
- **Bestätigtes Limit (10.09.2026):** Dieses Projekt läuft auf dem kostenlosen Vercel-Hobby-Plan, der
  Funktionen nach **hart 60 Sekunden** abbricht ("Vercel Runtime Timeout Error" in den Logs) - das ist
  kein Bug, sondern die reale Plattformgrenze. Ein echter Absturz am 10.09. wurde darauf zurückgeführt
  (mehrere Fotos + `effort: high` brauchten >60s). Behoben durch `effort: medium` als neuen Standard
  (siehe "Bekannte technische Grenzen"). Sollte es trotzdem wieder zu Zeitüberschreitungen kommen, ist der
  nächste Schritt ein Wechsel auf den kostenpflichtigen Vercel-Pro-Plan (erlaubt längere Funktionslaufzeiten)
  - das würde ich vorher mit dir besprechen, bevor ich es umsetze, da es Kosten verursacht.

### 3. Domain verbinden (optional, später)
- In Vercel unter "Settings → Domains" z. B. `schaden-check.stefan-witmaier.de` hinzufügen
- Bei deinem Domain-Anbieter (dort, wo stefan-witmaier.de verwaltet wird) einen CNAME-Eintrag auf die von
  Vercel angezeigte Zieladresse setzen
- Bis dahin funktioniert die Seite unter der von Vercel automatisch vergebenen `*.vercel.app`-Adresse

### 4. Rechtliches prüfen (nicht von mir geprüft, echte rechtliche Prüfung nötig)
- Die Datenschutzerklärung von stefan-witmaier.de muss ergänzt werden: Fotos, Fahrzeugschein-Bilder und
  Angaben werden zur Analyse an Anthropic (USA, mit Standard-Vertragsklauseln/EU-Datenschutzrahmen)
  übermittelt, dort verarbeitet und nicht dauerhaft von dieser Anwendung gespeichert (Speicherdauer bei
  Anthropic selbst: siehe deren aktuelle Data-Retention-Angaben, ggf. anwaltlich prüfen lassen)
- Der Fahrzeugschein ist ein amtliches Dokument mit besonders schutzwürdigen Daten (auch wenn diese App
  bewusst nur Hersteller/Modell/Baujahr ausliest und alles andere ignoriert) - das sollte in der
  Datenschutzerklärung explizit erwähnt werden
- Klären, ob ein Auftragsverarbeitungsvertrag (AVV) mit Anthropic nötig/möglich ist
- Prüfen, ob ein Impressum auf dieser separaten Domain zusätzlich nötig ist (rechtlich empfehlenswert,
  auch wenn inhaltlich auf stefan-witmaier.de verwiesen wird)
- Die "+200 % Kalibrierung" auf die Kostenspanne (siehe unten) ist eine bewusste Geschäftsentscheidung des
  Gutachters, keine unabhängige KI-Aussage mehr - das sollte intern dokumentiert bleiben, auch wenn es dem
  Nutzer gegenüber nicht als "roher KI-Wert + Aufschlag" kommuniziert wird. **Bewusst nicht umgesetzt:**
  eine Formulierung/Framing, die die Schadenssumme gezielt hochtreiben soll, damit sich Nutzer mehr Geld
  aus einer gegnerischen Haftpflichtversicherung erhoffen - das wäre Verbrauchertäuschung und ein
  Haftungsrisiko für den Gutachter selbst. Die Kalibrierung basiert stattdessen auf seiner fachlichen
  Praxiserfahrung, dass fotobasierte Schätzungen echte Reparaturkosten strukturell unterschätzen.
  **Wichtig, unbedingt zeitnah nachholen:** Faktor 3.0 wurde ohne echte Vergleichsdaten (Schätzung vs.
  tatsächliche Reparaturrechnung) festgelegt, allein auf Basis der fachlichen Einschätzung des Gutachters.
  Bei einem Testfall führte das zu 5.100-7.800 € für einen von der KI selbst als "mittel" eingestuften
  Schaden - das ist deutlich, sollte aber sobald wie möglich an 2-3 echten Fällen gegengeprüft werden,
  damit die Zahl belastbar bleibt und nicht bei echten Kunden als unglaubwürdig auffällt.

### 5. Vor dem Live-Schalten
- Mit echten Testfotos in mehreren Szenarien testen (siehe Testfälle unten)
- `robots: { index: false, follow: false }` in `app/layout.tsx` bewusst so gelassen, bis alles final
  geprüft ist – danach ggf. auf `index: true` umstellen

## Kostenkalibrierung der Reparaturkostenspanne

Der Gutachter hat zurückgemeldet, dass die reine KI-Schätzung tendenziell zu niedrig lag. Statt die KI
anzuweisen, sich selbst zu "belügen", wurde das zweigleisig gelöst:

1. **Der Prompt** (`lib/prompt.ts`) wurde geschärft: Die KI soll jetzt explizit reale Kostenfaktoren
   einbeziehen, die auf Fotos nicht sichtbar sind (Ersatzteile, Lackierung angrenzender Teile,
   Sensor-Kalibrierung, Arbeitszeit, Mehrwertsteuer), die Spanne bewusst am oberen realistischen Rand
   ansetzen (statt niedrig zu "ankern") und dabei enger fassen (Zielbreite ca. 30-50 % des Mittelwerts
   statt einer beliebig breiten Spanne wie z.B. 2.000-8.000 EUR).
2. **Ein serverseitiger Kalibrierungsfaktor** (`COST_ESTIMATE_MULTIPLIER`, Standard `3.0` = +200 %) wird
   danach auf die von der KI gelieferte Spanne angewendet - dokumentiert, nachvollziehbar im Code und
   jederzeit über die Umgebungsvariable nachjustierbar, sobald echte Vergleichsdaten vorliegen. Die KI
   selbst schätzt weiterhin unabhängig und ehrlich; die Kalibrierung ist eine separate, bewusste
   Geschäftsentscheidung des Gutachters, begründet mit dessen fachlicher Praxiserfahrung, dass
   fotobasierte Schätzungen echte Reparaturkosten strukturell unterschätzen.

**Verifiziert (09.09.2026):**
- Bei Faktor 2.0: Testfoto (Frontschaden, mittlere Schwere) roh 1.800-2.700 EUR → kalibriert 3.600-5.400 EUR
- Bei Faktor 3.0 (aktueller Stand): dasselbe Testfoto roh ca. 1.700-2.600 EUR → kalibriert **5.100-7.800 EUR**,
  obwohl die KI den Schaden weiterhin selbst als "mittel" (nicht "schwer") einstuft

**Empfehlung, möglichst bald umsetzen:** Faktor 3.0 wurde auf Zuruf ohne echte Vergleichsdaten festgelegt.
Sobald 2-3 reale Fälle mit tatsächlicher Reparaturrechnung vorliegen, den Faktor entsprechend nachjustieren
(hoch oder runter) statt ihn dauerhaft auf 3.0 zu belassen - eine Zahl, die bei echten Kunden im Vergleich
zu späteren Werkstatt-Rechnungen absurd hoch wirkt, schadet dem Vertrauen genauso wie eine zu niedrige.

## Bekannte technische Grenzen

- **Body-Größenlimit bei Serverless-Hosting:** Vercel-Funktionen lehnen Anfragen über ca. 4,5 MB pauschal
  ab. Die App verkleinert Fotos deshalb im Browser und prüft die Gesamtgröße vor dem Absenden (siehe
  `MAX_TOTAL_UPLOAD_BYTES` in `lib/schema.ts`) - bei 20 sehr detailreichen Fotos kann es dennoch knapp
  werden, dann bitte einzelne Fotos entfernen.
- **Funktionslaufzeit (bestätigter Vorfall 10.09.2026):** Der Vercel-Hobby-Plan bricht Funktionen nach
  **60 Sekunden hart ab** (`maxDuration = 60`, vom Server erzwungen, nicht nur ein Richtwert). Ein echter
  Nutzer erlebte dadurch die Fehlerseite, weil mehrere Fotos bei `effort: high` >60s brauchten. Behoben:
  Analyse-Aufwand auf `medium` reduziert (Regler: `ANTHROPIC_EFFORT`) und Fotos werden serverseitig auf
  1400px statt 1600px verkleinert - im Test danach 5 Fotos in ~38s, 10 Fotos in ~37s, also mit deutlichem
  Puffer unter 60s. Bei >10 Fotos zeigt die Oberfläche zusätzlich einen Warnhinweis. Der clientseitige
  65-Sekunden-Timeout ist nur noch ein Rückfallnetz; bei einem echten Server-Timeout (Status 502/504 oder
  keine gültige JSON-Antwort) zeigt die App jetzt eine spezifische Meldung ("hat zu lange gedauert") statt
  der generischen Fehlermeldung. Sollte es trotzdem wieder zu Timeouts kommen: `ANTHROPIC_EFFORT` ist
  bereits auf dem niedrigsten sinnvollen Wert für gute Qualität - nächster Schritt wäre dann tatsächlich
  der Vercel-Pro-Plan (siehe oben), nicht eine weitere Prompt-Anpassung.
- **Ratenbegrenzung ist nur ein Notbehelf:** Die eingebaute Zählung lebt nur im Arbeitsspeicher einer
  einzelnen Serverless-Instanz und wird bei jedem Kaltstart zurückgesetzt. Für echten Schutz vor Missbrauch
  später z. B. Vercel-eigenes Rate-Limiting oder einen Dienst wie Upstash Redis ergänzen.
- **Fahrzeugschein-Erkennung ist kein amtlicher Abgleich:** Erkanntes Hersteller/Modell wird nur gegen eine
  kuratierte Liste (`lib/vehicleData.ts`, ca. 32 Marken) abgeglichen; bei Nichttreffer wird automatisch
  "Sonstiger Hersteller"/"Sonstiges Modell" gewählt und der roh erkannte Text separat angezeigt - der
  Nutzer sollte die Felder immer kurz prüfen.
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
6. Echtes Fahrzeugschein-Foto hochladen → erwartet: Hersteller/Modell/Baujahr werden übernommen, Halter-
   und Kennzeichendaten tauchen nirgends im Ergebnis oder in Logs auf
7. 15-20 Fotos gleichzeitig hochladen → erwartet: Analyse läuft durch oder zeigt bei Zeit-/Größenlimit eine
   verständliche Fehlermeldung, nie eine weiße/abgestürzte Seite
8. Reparaturkostenspanne mit `COST_ESTIMATE_MULTIPLIER=1` in `.env.local` vs. Standard `3.0` vergleichen,
   um die Kalibrierung sichtbar zu machen

## Ordnerstruktur

```
app/
  page.tsx                      Hero + 3 Schritte + Wizard
  error.tsx / global-error.tsx  Fehlerseiten statt Absturz bei unerwarteten Fehlern
  api/analyze/route.ts          Server-Route: Validierung, EXIF-Entfernung, KI-Aufruf, Kostenkalibrierung
  api/extract-vehicle/route.ts  Server-Route: Fahrzeugschein auslesen (nur Hersteller/Modell/Baujahr)
components/
  DamageWizard.tsx       Der eigentliche Ablauf (Upload → Daten → Einwilligung → Ergebnis)
lib/
  schema.ts              Zod-Schemas (Ergebnis-Struktur, Fahrzeugdaten, Limits)
  prompt.ts              System-Prompts (Schadenanalyse + Fahrzeugschein-Extraktion)
  vehicleData.ts         Kuratierte Hersteller/Modell-Liste, Baujahr-Optionen
  compressImage.ts       Client-seitige Bildverkleinerung vor Upload
```

_Automatisch verbunden mit Vercel via GitHub._
