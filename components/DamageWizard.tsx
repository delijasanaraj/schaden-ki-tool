"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { track } from "@vercel/analytics";
import styles from "./DamageWizard.module.css";
import { compressImage } from "@/lib/compressImage";
import {
  MAX_IMAGES,
  MIN_IMAGES,
  MAX_TOTAL_UPLOAD_BYTES,
  ACCEPTED_MIME_TYPES,
  type AnalysisResult,
  type VehicleData,
  type VehicleExtractionResult,
} from "@/lib/schema";
import { CAR_MAKES, CAR_MODELS, getYearOptions } from "@/lib/vehicleData";

const GENERIC_ERROR_MESSAGE =
  "Die Analyse konnte gerade nicht abgeschlossen werden. Bitte versuchen Sie es erneut oder senden Sie Ihre Fotos direkt über die Kontaktanfrage an den Gutachter.";

type Step = "upload" | "details" | "consent" | "loading" | "result" | "error";

type Photo = { id: string; file: File; previewUrl: string };

const LOADING_MESSAGES = [
  "Fotos werden sicher übertragen …",
  "Sichtbare Fahrzeugbereiche werden analysiert …",
  "Erkennbare Beschädigungen werden zusammengefasst …",
  "Ihre unverbindliche Ersteinschätzung wird erstellt …",
];

const PHONE_DISPLAY = "+49 176 998 086 95";
const PHONE_TEL = "tel:+4917699808695";
const WHATSAPP_LINK = "https://wa.me/4917699808695";
const CONTACT_EMAIL = "keo.kontakt@gmail.com";

const DAMAGE_AREAS = [
  "Fahrzeugfront",
  "Fahrzeugheck",
  "linke Fahrzeugseite",
  "rechte Fahrzeugseite",
  "Dach",
  "Unterboden",
  "Scheiben",
  "Räder oder Fahrwerk",
  "Innenraum",
  "mehrere Bereiche",
  "nicht sicher",
];

const YEAR_OPTIONS = getYearOptions();

export default function DamageWizard() {
  const [step, setStep] = useState<Step>("upload");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [vehicleData, setVehicleData] = useState<VehicleData>({});
  const [consentAnalysis, setConsentAnalysis] = useState(false);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Datenschutzfreundliche Nutzungsstatistik (Vercel Analytics) - zaehlt nur
  // anonyme Ereignisse, keine Fotos/Namen/Kontaktdaten. Gibt dem Gutachter eine
  // grobe Sicht auf die Nutzung des Tools, ohne eine eigene Datenbank zu brauchen.
  useEffect(() => {
    track("Tool geoeffnet");
  }, []);

  useEffect(() => {
    if (step !== "loading") return;
    const interval = setInterval(() => {
      setLoadingMsgIndex((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [step]);

  const addFiles = useCallback(
    async (fileList: FileList | File[]) => {
      setFileError(null);
      if (photos.length === 0) track("Upload gestartet");
      const incoming = Array.from(fileList);
      const room = MAX_IMAGES - photos.length;
      if (room <= 0) {
        setFileError(`Sie können maximal ${MAX_IMAGES} Fotos hochladen.`);
        return;
      }
      let runningTotalBytes = photos.reduce((sum, p) => sum + p.file.size, 0);
      const accepted: Photo[] = [];
      let sizeBlocked = false;
      for (const file of incoming.slice(0, room)) {
        if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
          setFileError("Nur JPEG, PNG und WebP werden unterstützt.");
          continue;
        }
        if (file.size > 20 * 1024 * 1024) {
          setFileError(`Datei "${file.name}" ist zu groß.`);
          continue;
        }
        const compressed = await compressImage(file);
        if (runningTotalBytes + compressed.size > MAX_TOTAL_UPLOAD_BYTES) {
          sizeBlocked = true;
          break;
        }
        runningTotalBytes += compressed.size;
        accepted.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file: compressed,
          previewUrl: URL.createObjectURL(compressed),
        });
      }
      if (accepted.length > 0) {
        setPhotos((prev) => [...prev, ...accepted]);
      }
      if (sizeBlocked) {
        setFileError(
          "Die Fotos sind zusammen zu groß für eine Übertragung. Es wurden nur die ersten Fotos übernommen - bitte entfernen Sie ggf. einige oder verwenden Sie kleinere Dateien."
        );
      } else if (incoming.length > room) {
        setFileError(`Es wurden nur ${room} weitere Fotos übernommen (maximal ${MAX_IMAGES} insgesamt).`);
      }
    },
    [photos]
  );

  const removePhoto = (id: string) => {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  };

  const [isDragging, setIsDragging] = useState(false);

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const canSubmit = photos.length >= MIN_IMAGES && consentAnalysis && !submitting;

  const submitAnalysis = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setStep("loading");
    setErrorMessage(null);
    track("Analyse gestartet", { fotoAnzahl: photos.length });

    // Schuetzt vor einer haengenden Anfrage. Die Vercel-Funktion selbst wird nach
    // 60s hart vom Server abgebrochen (Plattform-Limit, siehe route.ts) - dieser
    // Client-Timeout liegt knapp darueber und ist nur ein Rueckfallnetz, falls
    // die Verbindung aus anderen Gruenden haengen bleibt.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 65_000);
    const TIMEOUT_MESSAGE =
      "Die Analyse hat zu lange gedauert und wurde vom Server abgebrochen. Das passiert eher bei vielen oder sehr großen Fotos. Bitte versuchen Sie es mit weniger Fotos (z. B. 3–6) erneut, oder senden Sie Ihre Fotos direkt über die Kontaktanfrage an den Gutachter.";

    try {
      const formData = new FormData();
      photos.forEach((p) => formData.append("photos", p.file, p.file.name));
      formData.append("vehicleData", JSON.stringify(vehicleData));

      const res = await fetch("/api/analyze", { method: "POST", body: formData, signal: controller.signal });

      // Bei einem Plattform-seitigen Timeout (z.B. Vercel bricht die Funktion nach
      // 60s hart ab) liefert der Server keine gueltige JSON-Antwort mehr, sondern
      // z.B. eine Fehler-HTML-Seite - res.json() wuerde dann werfen. Das getrennt
      // abfangen, statt es in der generischen Fehlermeldung verschwinden zu lassen.
      let data: { result?: AnalysisResult; message?: string } | null = null;
      try {
        data = await res.json();
      } catch {
        track("Analyse fehlgeschlagen", { grund: res.status === 504 || res.status === 502 ? "timeout" : "fehler" });
        setErrorMessage(res.status === 504 || res.status === 502 ? TIMEOUT_MESSAGE : GENERIC_ERROR_MESSAGE);
        setStep("error");
        return;
      }

      if (!res.ok || !data?.result) {
        track("Analyse fehlgeschlagen", { grund: "fehler" });
        setErrorMessage(data?.message || GENERIC_ERROR_MESSAGE);
        setStep("error");
        return;
      }

      track("Analyse erfolgreich", { fotoAnzahl: photos.length });
      setResult(data.result);
      setStep("result");
    } catch (err) {
      const isTimeout = err instanceof DOMException && err.name === "AbortError";
      track("Analyse fehlgeschlagen", { grund: isTimeout ? "timeout" : "fehler" });
      setErrorMessage(isTimeout ? TIMEOUT_MESSAGE : GENERIC_ERROR_MESSAGE);
      setStep("error");
    } finally {
      clearTimeout(timeoutId);
      setSubmitting(false);
    }
  };

  const [registrationExtracting, setRegistrationExtracting] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [registrationDetected, setRegistrationDetected] = useState<string | null>(null);

  const handleRegistrationUpload = async (file: File) => {
    setRegistrationError(null);
    setRegistrationDetected(null);
    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      setRegistrationError("Nur JPEG, PNG und WebP werden unterstützt.");
      return;
    }
    setRegistrationExtracting(true);
    try {
      const compressed = await compressImage(file);
      const formData = new FormData();
      formData.append("document", compressed, compressed.name);
      const res = await fetch("/api/extract-vehicle", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok || !data.result?.found) {
        setRegistrationError(
          data.message || "Es konnten keine Fahrzeugdaten erkannt werden. Bitte tragen Sie die Angaben manuell ein."
        );
        return;
      }

      const extracted: VehicleExtractionResult = data.result;
      const matchedMake = CAR_MAKES.find((m) => m.toLowerCase() === extracted.make.trim().toLowerCase());
      const effectiveMake = matchedMake ?? (extracted.make.trim() ? "Sonstiger Hersteller" : undefined);
      const modelsForMake = effectiveMake ? CAR_MODELS[effectiveMake] || [] : [];
      const matchedModel = modelsForMake.find((m) => m.toLowerCase() === extracted.model.trim().toLowerCase());
      const effectiveModel = matchedModel ?? (extracted.model.trim() ? "Sonstiges Modell" : undefined);
      const year = /^\d{4}$/.test(extracted.firstRegistrationYear) ? extracted.firstRegistrationYear : undefined;

      setVehicleData((v) => ({
        ...v,
        make: effectiveMake || v.make,
        model: effectiveModel || v.model,
        firstRegistration: year || v.firstRegistration,
      }));

      track("Fahrzeugschein hochgeladen", { erkannt: extracted.found });

      const detectedLabel = [extracted.make, extracted.model, extracted.firstRegistrationYear]
        .filter(Boolean)
        .join(" · ");
      setRegistrationDetected(
        detectedLabel ? `Erkannt: ${detectedLabel} - bitte unten prüfen.` : "Es konnten keine Angaben erkannt werden."
      );
    } catch {
      setRegistrationError(
        "Der Fahrzeugschein konnte nicht ausgelesen werden. Bitte tragen Sie die Angaben manuell ein."
      );
    } finally {
      setRegistrationExtracting(false);
    }
  };

  const contactSummary = useMemo(() => {
    if (!result) return "";
    const lines = [
      "Anfrage über die KI-Ersteinschätzung auf der Webseite:",
      "",
      `Zusammenfassung: ${result.summary}`,
      `Schadenschwere (KI-Einschätzung): ${result.severity.level}`,
    ];
    if (vehicleData.make || vehicleData.model) {
      lines.push(`Fahrzeug: ${[vehicleData.make, vehicleData.model].filter(Boolean).join(" ")}`);
    }
    if (vehicleData.damageArea) lines.push(`Beschädigter Bereich: ${vehicleData.damageArea}`);
    if (vehicleData.description) lines.push(`Unfallhergang laut Nutzer: ${vehicleData.description}`);
    lines.push("", "Hinweis: Dies ist eine unverbindliche automatisierte Ersteinschätzung, kein Gutachten.");
    return lines.join("\n");
  }, [result, vehicleData]);

  const mailtoHref = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
    "Anfrage über KI-Schadeneinschätzung"
  )}&body=${encodeURIComponent(contactSummary)}`;
  const whatsappHref = `${WHATSAPP_LINK}?text=${encodeURIComponent(contactSummary)}`;

  return (
    <div className={styles.wizard}>
      {step === "upload" && (
        <section className={styles.card}>
          <h2 className={styles.stepTitle}>1. Fotos hochladen</h2>
          <p className={styles.helpText}>
            Für eine bessere Einschätzung fotografieren Sie bitte das gesamte Fahrzeug, den Schaden aus
            mehreren Blickwinkeln und nach Möglichkeit ein bis zwei Detailaufnahmen. Achten Sie auf gute
            Beleuchtung. Bitte fotografieren Sie nach Möglichkeit keine Personen und keine unnötigen
            persönlichen Daten.
          </p>

          <div
            className={`${styles.dropzone} ${isDragging ? styles.dropzoneActive : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              hidden
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />
            <p>
              <strong>Fotos hierher ziehen</strong> oder klicken zum Auswählen
            </p>
            <p className={styles.dropzoneHint}>
              JPEG, PNG oder WebP · {photos.length}/{MAX_IMAGES} Fotos · empfohlen 3–6, bis zu {MAX_IMAGES} möglich
            </p>
          </div>

          {fileError && <p className={styles.errorText}>{fileError}</p>}

          {photos.length > 10 && (
            <p className={styles.warningText}>
              Bei sehr vielen Fotos kann die Analyse deutlich länger dauern und im Einzelfall abbrechen.
              Für die meisten Schäden reichen 3–6 aussagekräftige Fotos aus.
            </p>
          )}

          {photos.length > 0 && (
            <div className={styles.previewGrid}>
              {photos.map((p) => (
                <div key={p.id} className={styles.previewItem}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.previewUrl} alt="Vorschau des hochgeladenen Fotos" />
                  <button
                    type="button"
                    className={styles.removeBtn}
                    aria-label="Foto entfernen"
                    onClick={() => removePhoto(p.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <ul className={styles.trustList}>
            <li>Keine Registrierung erforderlich</li>
            <li>Einfache Fotoanalyse</li>
            <li>Unverbindliche Ersteinschätzung</li>
            <li>Persönliche Prüfung durch einen Kfz-Gutachter möglich</li>
          </ul>

          <div className={styles.disclaimerBox}>
            Die Online-Analyse ersetzt weder ein Gutachten noch einen Kostenvoranschlag. Verdeckte oder
            sicherheitsrelevante Schäden können auf Fotos möglicherweise nicht erkannt werden.
          </div>

          <div className={styles.actionsRow}>
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={photos.length < MIN_IMAGES}
              onClick={() => setStep("details")}
            >
              Weiter
            </button>
          </div>
        </section>
      )}

      {step === "details" && (
        <section className={styles.card}>
          <h2 className={styles.stepTitle}>2. Angaben zum Fahrzeug (optional)</h2>
          <p className={styles.helpText}>
            Diese Angaben sind freiwillig, helfen der KI aber bei der Einschätzung. Bitte geben Sie keine
            unnötigen personenbezogenen Daten ein.
          </p>

          <div className={styles.registrationBox}>
            <label className={styles.registrationLabel}>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleRegistrationUpload(file);
                  e.target.value = "";
                }}
              />
              <span className={styles.secondaryBtn}>
                {registrationExtracting ? "Wird ausgelesen …" : "Fahrzeugschein hochladen (optional)"}
              </span>
            </label>
            <p className={styles.smallNote}>
              Füllt Hersteller, Modell und Baujahr automatisch aus. Wird ausschließlich dafür verwendet und
              nicht gespeichert - Name, Anschrift und Kennzeichen werden nicht ausgelesen.
            </p>
            {registrationDetected && <p className={styles.registrationSuccess}>{registrationDetected}</p>}
            {registrationError && <p className={styles.errorText}>{registrationError}</p>}
          </div>

          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Fahrzeughersteller</span>
              <select
                value={vehicleData.make || ""}
                onChange={(e) => setVehicleData((v) => ({ ...v, make: e.target.value, model: "" }))}
              >
                <option value="">Bitte wählen</option>
                {CAR_MAKES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Fahrzeugmodell</span>
              <select
                value={vehicleData.model || ""}
                disabled={!vehicleData.make}
                onChange={(e) => setVehicleData((v) => ({ ...v, model: e.target.value }))}
              >
                <option value="">{vehicleData.make ? "Bitte wählen" : "Zuerst Hersteller wählen"}</option>
                {(CAR_MODELS[vehicleData.make || ""] || []).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Baujahr / Erstzulassung</span>
              <select
                value={vehicleData.firstRegistration || ""}
                onChange={(e) => setVehicleData((v) => ({ ...v, firstRegistration: e.target.value }))}
              >
                <option value="">Bitte wählen</option>
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Kilometerstand</span>
              <input
                type="text"
                value={vehicleData.mileage || ""}
                onChange={(e) => setVehicleData((v) => ({ ...v, mileage: e.target.value }))}
              />
            </label>
            <label className={styles.field}>
              <span>Beschädigter Fahrzeugbereich</span>
              <select
                value={vehicleData.damageArea || ""}
                onChange={(e) => setVehicleData((v) => ({ ...v, damageArea: e.target.value }))}
              >
                <option value="">Bitte wählen</option>
                {DAMAGE_AREAS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Fahrzeug noch fahrbereit?</span>
              <select
                value={vehicleData.drivable || ""}
                onChange={(e) =>
                  setVehicleData((v) => ({ ...v, drivable: e.target.value as VehicleData["drivable"] }))
                }
              >
                <option value="">Bitte wählen</option>
                <option value="ja">Ja</option>
                <option value="nein">Nein</option>
                <option value="nicht sicher">Nicht sicher</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>Airbags ausgelöst?</span>
              <select
                value={vehicleData.airbagsDeployed || ""}
                onChange={(e) =>
                  setVehicleData((v) => ({
                    ...v,
                    airbagsDeployed: e.target.value as VehicleData["airbagsDeployed"],
                  }))
                }
              >
                <option value="">Bitte wählen</option>
                <option value="ja">Ja</option>
                <option value="nein">Nein</option>
                <option value="nicht sicher">Nicht sicher</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>Leuchten Warn-/Kontrollanzeigen?</span>
              <select
                value={vehicleData.warningLights || ""}
                onChange={(e) =>
                  setVehicleData((v) => ({
                    ...v,
                    warningLights: e.target.value as VehicleData["warningLights"],
                  }))
                }
              >
                <option value="">Bitte wählen</option>
                <option value="ja">Ja</option>
                <option value="nein">Nein</option>
                <option value="nicht sicher">Nicht sicher</option>
              </select>
            </label>
          </div>

          <label className={styles.field}>
            <span>Kurze Beschreibung des Unfallhergangs</span>
            <textarea
              maxLength={1500}
              rows={4}
              placeholder="Bitte beschreiben Sie kurz, wie der Schaden entstanden ist und welche Auffälligkeiten Sie festgestellt haben. Geben Sie hier keine unnötigen personenbezogenen Daten ein."
              value={vehicleData.description || ""}
              onChange={(e) => setVehicleData((v) => ({ ...v, description: e.target.value }))}
            />
            <span className={styles.charCount}>{(vehicleData.description || "").length}/1500</span>
          </label>

          <div className={styles.actionsRow}>
            <button type="button" className={styles.secondaryBtn} onClick={() => setStep("upload")}>
              Zurück
            </button>
            <button type="button" className={styles.primaryBtn} onClick={() => setStep("consent")}>
              Weiter
            </button>
          </div>
        </section>
      )}

      {step === "consent" && (
        <section className={styles.card}>
          <h2 className={styles.stepTitle}>3. Einwilligung &amp; Start der Analyse</h2>

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={consentAnalysis}
              onChange={(e) => setConsentAnalysis(e.target.checked)}
            />
            <span>
              Ich willige ein, dass meine hochgeladenen Fotos und Angaben zum Zweck der automatisierten
              Schaden-Ersteinschätzung verarbeitet werden. Mir ist bekannt, dass das Ergebnis unverbindlich
              ist und kein Gutachten oder Kostenvoranschlag ersetzt. Weitere Informationen finde ich in der
              Datenschutzerklärung.
            </span>
          </label>

          <div className={styles.disclaimerBox}>
            Die Online-Analyse ersetzt weder ein Gutachten noch einen Kostenvoranschlag. Verdeckte oder
            sicherheitsrelevante Schäden können auf Fotos möglicherweise nicht erkannt werden.
          </div>

          <div className={styles.actionsRow}>
            <button type="button" className={styles.secondaryBtn} onClick={() => setStep("details")}>
              Zurück
            </button>
            <button type="button" className={styles.primaryBtn} disabled={!canSubmit} onClick={submitAnalysis}>
              Unverbindliche Ersteinschätzung starten
            </button>
          </div>
        </section>
      )}

      {step === "loading" && (
        <section className={styles.card}>
          <div className={styles.loadingBox}>
            <div className={styles.spinner} aria-hidden="true" />
            <p className={styles.loadingText}>{LOADING_MESSAGES[loadingMsgIndex]}</p>
            <p className={styles.helpText}>
              Die Auswertung kann einen Moment dauern. Bitte schließen Sie diese Seite nicht.
            </p>
          </div>
        </section>
      )}

      {step === "error" && (
        <section className={styles.card}>
          <h2 className={styles.stepTitle}>Es gab ein Problem</h2>
          <p className={styles.errorText}>{errorMessage}</p>
          <div className={styles.actionsRow}>
            <button type="button" className={styles.secondaryBtn} onClick={() => setStep("consent")}>
              Erneut versuchen
            </button>
            <a className={styles.primaryBtnLink} href={PHONE_TEL}>
              Stattdessen anrufen
            </a>
          </div>
        </section>
      )}

      {step === "result" && result && (
        <ResultView
          result={result}
          mailtoHref={mailtoHref}
          whatsappHref={whatsappHref}
          onRestart={() => {
            setStep("upload");
            setPhotos([]);
            setResult(null);
            setConsentAnalysis(false);
          }}
        />
      )}
    </div>
  );
}

function ResultView({
  result,
  mailtoHref,
  whatsappHref,
  onRestart,
}: {
  result: AnalysisResult;
  mailtoHref: string;
  whatsappHref: string;
  onRestart: () => void;
}) {
  const confidenceLabel = (c: "low" | "medium" | "high") =>
    c === "high" ? "auf dem Foto deutlich erkennbar" : c === "medium" ? "wahrscheinlich erkennbar" : "nicht sicher beurteilbar";

  useEffect(() => {
    track("Kontaktbereich angezeigt", { schadenschwere: result.severity.level });
  }, [result.severity.level]);

  return (
    <section className={styles.card}>
      <h2 className={styles.stepTitle}>Ihre unverbindliche Ersteinschätzung</h2>

      {result.analysis_status === "insufficient_images" && (
        <div className={styles.warningBox}>
          Die übermittelten Fotos reichen für eine Einschätzung leider nicht aus.
          {result.additional_photos_requested.length > 0 && (
            <ul>
              {result.additional_photos_requested.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className={styles.resultSummary}>{result.summary}</p>

      {result.visible_damage.length > 0 && (
        <div className={styles.resultSection}>
          <h3>Erkennbare Beschädigungen</h3>
          <ul className={styles.damageList}>
            {result.visible_damage.map((d, i) => (
              <li key={i}>
                <strong>
                  {d.area} – {d.component}
                </strong>
                <span>
                  {d.damage_type} ({confidenceLabel(d.confidence)})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.resultSection}>
        <h3>Grobe Schadenschwere</h3>
        <p>
          <strong>{result.severity.level}</strong> – {result.severity.explanation}
        </p>
      </div>

      {result.drivability_warning.possible_safety_issue && (
        <div className={styles.dangerBox}>
          <strong>Sicherheitshinweis:</strong> {result.drivability_warning.message}
          <br />
          Anhand der Angaben oder Fotos kann ein sicherheitsrelevanter Schaden nicht ausgeschlossen werden.
          Bewegen Sie das Fahrzeug im Zweifel nicht weiter und lassen Sie es professionell prüfen.
        </div>
      )}

      <div className={styles.resultSection}>
        <h3>Grobe Reparaturkostenspanne</h3>
        {result.estimated_cost_range.possible ? (
          <p>
            Auf Grundlage der sichtbaren Beschädigungen erscheint eine grobe Spanne von etwa{" "}
            <strong>
              {result.estimated_cost_range.minimum_eur.toLocaleString("de-DE")} € bis{" "}
              {result.estimated_cost_range.maximum_eur.toLocaleString("de-DE")} €
            </strong>{" "}
            denkbar. {result.estimated_cost_range.explanation}
          </p>
        ) : (
          <p>Eine belastbare Kostenspanne lässt sich anhand der vorhandenen Fotos nicht seriös angeben.</p>
        )}
      </div>

      {result.possible_hidden_damage.length > 0 && (
        <div className={styles.resultSection}>
          <h3>Mögliche verdeckte Schäden</h3>
          <ul>
            {result.possible_hidden_damage.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </div>
      )}

      {result.limitations.length > 0 && (
        <div className={styles.resultSection}>
          <h3>Grenzen dieser Analyse</h3>
          <ul>
            {result.limitations.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.disclaimerBox}>
        Diese automatisierte Auswertung basiert ausschließlich auf den übermittelten Fotos und Angaben. Sie
        ersetzt weder ein Gutachten noch einen Kostenvoranschlag oder eine technische Untersuchung.
        Verdeckte, strukturelle und sicherheitsrelevante Schäden können unentdeckt bleiben.
      </div>

      <div className={styles.contactCta}>
        <h3>Lassen Sie den Schaden professionell prüfen</h3>
        <p>
          Eine zuverlässige Beurteilung ist erst durch eine persönliche Prüfung des Fahrzeugs möglich.
          Kfz-Gutachter Stefan Witmaier prüft den Schaden fachgerecht und bespricht mit Ihnen die nächsten
          Schritte.
        </p>
        <p className={styles.smallNote}>
          Beim Klick auf eine der folgenden Optionen wird eine Nachricht mit den Eckdaten Ihrer Anfrage in
          Ihrer eigenen E-Mail- oder WhatsApp-App vorausgefüllt. Es wird nichts automatisch übermittelt –
          Sie entscheiden, ob Sie sie absenden.
        </p>
        <div className={styles.contactButtons}>
          <a
            className={styles.primaryBtnLink}
            href="tel:+4917699808695"
            onClick={() => track("Kontakt angeklickt", { kanal: "telefon" })}
          >
            Jetzt direkt anrufen
          </a>
          <a
            className={`${styles.secondaryBtnLink} ${styles.whatsappBtn}`}
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            onClick={() => track("Kontakt angeklickt", { kanal: "whatsapp" })}
          >
            WhatsApp schreiben
          </a>
          <a
            className={styles.secondaryBtnLink}
            href={mailtoHref}
            onClick={() => track("Kontakt angeklickt", { kanal: "email" })}
          >
            Per E-Mail anfragen
          </a>
        </div>
      </div>

      <div className={styles.actionsRow}>
        <button type="button" className={styles.secondaryBtn} onClick={onRestart}>
          Neue Analyse starten
        </button>
      </div>
    </section>
  );
}
