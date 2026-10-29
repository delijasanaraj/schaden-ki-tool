# KI-Schadenrechner – Schnittstelle für Partner-Apps (z. B. Crash Assist)

Mit dieser Schnittstelle schickt eine App die bereits aufgenommenen Schadenfotos an den KI-Schadenrechner
von WITMAIER und bekommt die Einschätzung als JSON zurück. Der Nutzer muss die Fotos nicht erneut hochladen
und die App nicht verlassen; die Anzeige übernimmt die App.

## Aufruf

```
POST https://fahrzeug-schadenrechner.stefan-witmaier.de/api/analyze
Content-Type: multipart/form-data
X-API-Key: <Schlüssel>        (alternativ: Authorization: Bearer <Schlüssel>)
```

Der Schlüssel ist geheim und gehört nur in die App bzw. deren Server, nie in öffentlichen Code.

### Felder (multipart/form-data)

| Feld | Pflicht | Inhalt |
|---|---|---|
| `photos` | ja | 1 bis 15 Bilddateien, das Feld mehrfach senden. JPEG, PNG oder WebP (**kein HEIC**). |
| `lead` | ja | JSON-Text: `{"firstName":"Max","lastName":"Mustermann","phone":"+49 171 1234567","email":"max@example.de","consent":true}` |
| `vehicleData` | nein | JSON-Text, alle Felder optional, siehe unten. |

**`lead` und Einwilligung:** Name, Telefon und E-Mail sind Pflicht, `consent` muss `true` sein. Das setzt
voraus, dass der Nutzer **in der App aktiv zugestimmt hat**, dass der Gutachter seine Daten und Fotos
erhält und ihn zu dieser Anfrage kontaktieren darf. Ohne diese Zustimmung darf `consent: true` nicht gesendet werden.
Die Kontaktdaten und alle Fotos gehen als E-Mail an den Gutachter, in der Betreffzeile steht der App-Name.

**`vehicleData`** (je Feld optional, leere Werte werden ignoriert):

| Feld | Werte |
|---|---|
| `make`, `model` | Text, max. 60 Zeichen |
| `firstRegistration` | Text, z. B. `"2019"` |
| `mileage` | Text, z. B. `"85000"` |
| `damageArea` | Text, z. B. `"Fahrzeugfront"` |
| `drivable`, `airbagsDeployed`, `warningLights` | `"ja"`, `"nein"` oder `"nicht sicher"` |
| `description` | Unfallhergang, max. 1500 Zeichen |

Je mehr davon die App aus ihren Unfalldaten mitgibt, desto besser wird die Einschätzung.

### Fotos vorbereiten

- **Gesamtgröße aller Fotos maximal 4 MB** (Plattformgrenze). Die App muss die Fotos vor dem Senden
  verkleinern: längste Kante ca. 1400 px, JPEG, Qualität 80 %. Das reicht für die Analyse völlig.
- **Empfehlung: höchstens 10 Fotos.** Die Analyse dauert ca. 15 bis 45 Sekunden und ist bei sehr vielen
  Fotos nahe am Zeitlimit von 60 Sekunden. HEIC (iPhone) vorher nach JPEG umwandeln.
- Die Anfrage ist synchron: Die App wartet auf die Antwort. Einen Ladehinweis anzeigen und das
  Timeout der HTTP-Anfrage auf mindestens **70 Sekunden** setzen. Bei einem Fehler nicht automatisch
  mehrfach wiederholen (jeder Versuch kostet Geld und löst eine weitere Lead-Mail aus).

## Antwort

HTTP 200:

```json
{
  "result": {
    "analysis_status": "completed",
    "summary": "Kurze Zusammenfassung in Alltagssprache …",
    "visible_damage": [
      { "area": "Fahrzeugfront", "component": "Stoßfänger", "damage_type": "Verformung", "confidence": "high" }
    ],
    "severity": { "level": "mittel", "explanation": "…" },
    "drivability_warning": { "possible_safety_issue": false, "message": "" },
    "estimated_cost_range": { "possible": true, "minimum_eur": 2500, "maximum_eur": 4000, "confidence": "medium", "explanation": "…" },
    "possible_hidden_damage": ["…"],
    "recommended_next_steps": ["…"],
    "additional_photos_requested": ["…"],
    "limitations": ["…"]
  },
  "analysisId": "b0d1…"
}
```

Wichtige Werte:

- `analysis_status`: `completed`, `insufficient_images`, `uncertain` oder `failed`. Bei allem außer `completed`
  die Hinweise (`additional_photos_requested`, `limitations`) anzeigen und keine Zahlen hervorheben.
- `severity.level`: `leicht`, `mittel`, `schwer` oder `nicht sicher beurteilbar`.
- `estimated_cost_range.possible`: ist es `false`, **keine Kostenspanne anzeigen**.
- `drivability_warning.possible_safety_issue`: ist es `true`, `message` deutlich sichtbar anzeigen.
- `confidence`-Werte: `low`, `medium`, `high`.

### Pflichthinweise für die Anzeige in der App

Das Ergebnis ist eine **unverbindliche KI-Ersteinschätzung, kein Gutachten** und ersetzt keine Besichtigung
durch einen Kfz-Sachverständigen. Die Kostenspanne ist nur eine grobe Orientierung. Dieser Hinweis muss in der App
direkt beim Ergebnis stehen, ebenso `limitations` und `possible_hidden_damage`.

## Testmodus (ohne Kosten, ohne Mail)

Mit dem zusätzlichen Header `X-Test-Mode: true` (nur zusammen mit gültigem Schlüssel) läuft die Anfrage durch alle
echten Prüfungen (Kontaktdaten, Fotos, Fahrzeugdaten, Fehlercodes), liefert dann aber eine **feste Beispielantwort**
im gleichen Format zurück, mit `"test": true`. Es gibt keinen KI-Aufruf, keine Mail an den Gutachter und keine Kosten.
Die Zahlen sind erfunden. Zum Entwickeln und für automatische Tests immer diesen Modus nutzen. Der Header
darf in der Produktiv-App nicht mitgesendet werden.

## Fehler

Fehlerantworten haben die Form `{ "error": "<code>", "message": "<Text für den Nutzer>" }`.

| HTTP | `error` | Bedeutung |
|---|---|---|
| 400 | `invalid_lead` | Kontaktdaten unvollständig/ungültig oder `consent` nicht `true` |
| 400 | `invalid_input` | Kein Foto, mehr als 15 Fotos oder `vehicleData` ungültig |
| 400 | `invalid_file_type` | Dateityp nicht JPEG/PNG/WebP |
| 400 | `invalid_file` | Datei beschädigt |
| 400 | `file_too_large` | Einzelnes Foto über 8 MB |
| 401 | `unauthorized` | API-Schlüssel fehlt oder ist falsch |
| 413 | `upload_too_large` | Fotos zusammen über 4 MB |
| 429 | `rate_limited` | Zu viele Anfragen (Standard: 300 pro Stunde je Schlüssel) |
| 500/502 | `analysis_failed` | Analyse fehlgeschlagen oder Zeitüberschreitung. Dem Nutzer `message` zeigen, später erneut versuchen |

`message` ist immer für Endnutzer formuliert und kann direkt angezeigt werden.

## Beispiel (hier im Testmodus; für echte Analysen die Zeile mit X-Test-Mode entfernen)

```bash
curl -X POST https://fahrzeug-schadenrechner.stefan-witmaier.de/api/analyze \
  -H "X-API-Key: $SCHLUESSEL" \
  -H "X-Test-Mode: true" \
  -F "photos=@front.jpg" -F "photos=@seite.jpg" \
  -F 'lead={"firstName":"Max","lastName":"Mustermann","phone":"+49 171 1234567","email":"max@example.de","consent":true}' \
  -F 'vehicleData={"make":"VW","model":"Golf","firstRegistration":"2019","drivable":"ja"}'
```

## Hinweise zu Web-basierten Apps

Eine native App (Swift, Kotlin, Flutter, React Native) braucht nichts weiter. Apps auf Web-Basis
(Capacitor, Ionic, Cordova) werden unterstützt: Die Schnittstelle beantwortet die CORS-Vorabanfrage.
Der Schlüssel liegt dann allerdings in der App und ist auslesbar. Besser ist ein eigener Server der App,
der den Aufruf weiterreicht und den Schlüssel geheim hält.

## Datenschutz

Fotos und Kontaktdaten werden zur Analyse an die KI (Anthropic) übertragen, die Kontaktdaten und Fotos
anschließend per E-Mail (Google) an den Gutachter gesendet. Die Fotos werden vor der Analyse von
Metadaten (EXIF, GPS) bereinigt und nicht dauerhaft auf dem Server gespeichert. Die Datenschutzerklärung der App
muss diese Verarbeitung nennen und die Einwilligung abdecken.
