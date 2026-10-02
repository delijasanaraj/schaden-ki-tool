"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { track } from "@vercel/analytics";
import styles from "./DamageWizard.module.css";
import ContactButtons from "./ContactButtons";
import { ArrowIcon, CameraIcon, CheckIcon, DocumentIcon } from "./icons";
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
import { CONTACT_EMAIL, PHONE_TEL, SITE_URL, WHATSAPP_NUMBER_LINK } from "@/lib/site";

const GENERIC_ERROR_MESSAGE =
  "Die Analyse konnte gerade nicht abgeschlossen werden. Bitte versuchen Sie es erneut oder rufen Sie den Gutachter direkt an.";

type Step = "upload" | "details" | "loading" | "result" | "error";

type Photo = { id: string; file: File; previewUrl: string };

const LOADING_MESSAGES = [
  "Fotos werden sicher übertragen …",
  "Sichtbare Fahrzeugbereiche werden analysiert …",
  "Erkennbare Beschädigungen werden zusammengefasst …",
  "Ihre unverbindliche Ersteinschätzung wird erstellt …",
];

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
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

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

  // Beim Schrittwechsel zum Kartenanfang scrollen, damit man nicht mitten im Formular landet
  const goTo = (next: Step) => {
    setStep(next);
    requestAnimationFrame(() => {
      const el = cardRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY - 16;
      if (window.scrollY > top) window.scrollTo({ top, behavior: "smooth" });
    });
  };

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
          "Die Fotos sind zusammen zu groß. Es wurden nur die ersten Fotos übernommen. Bitte entfernen Sie ggf. einige oder verwenden Sie kleinere Dateien."
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

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const canSubmit = photos.length >= MIN_IMAGES && consentAnalysis && !submitting;

  const submitAnalysis = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    goTo("loading");
    setErrorMessage(null);
    track("Analyse gestartet", { fotoAnzahl: photos.length });

    // Schuetzt vor einer haengenden Anfrage. Die Vercel-Funktion selbst wird nach
    // 60s hart vom Server abgebrochen (Plattform-Limit, siehe route.ts) - dieser
    // Client-Timeout liegt knapp darueber und ist nur ein Rueckfallnetz.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 65_000);
    const TIMEOUT_MESSAGE =
      "Die Analyse hat zu lange gedauert und wurde abgebrochen. Das passiert eher bei vielen oder sehr großen Fotos. Bitte versuchen Sie es mit weniger Fotos (z. B. 3–6) erneut oder rufen Sie den Gutachter direkt an.";

    try {
      const formData = new FormData();
      photos.forEach((p) => formData.append("photos", p.file, p.file.name));
      formData.append("vehicleData", JSON.stringify(vehicleData));

      const res = await fetch("/api/analyze", { method: "POST", body: formData, signal: controller.signal });

      // Bei einem Plattform-Timeout kommt keine gueltige JSON-Antwort zurueck.
      let data: { result?: AnalysisResult; message?: string } | null = null;
      try {
        data = await res.json();
      } catch {
        track("Analyse fehlgeschlagen", { grund: res.status === 504 || res.status === 502 ? "timeout" : "fehler" });
        setErrorMessage(res.status === 504 || res.status === 502 ? TIMEOUT_MESSAGE : GENERIC_ERROR_MESSAGE);
        goTo("error");
        return;
      }

      if (!res.ok || !data?.result) {
        track("Analyse fehlgeschlagen", { grund: "fehler" });
        setErrorMessage(data?.message || GENERIC_ERROR_MESSAGE);
        goTo("error");
        return;
      }

      track("Analyse erfolgreich", { fotoAnzahl: photos.length });
      setResult(data.result);
      goTo("result");
    } catch (err) {
      const isTimeout = err instanceof DOMException && err.name === "AbortError";
      track("Analyse fehlgeschlagen", { grund: isTimeout ? "timeout" : "fehler" });
      setErrorMessage(isTimeout ? TIMEOUT_MESSAGE : GENERIC_ERROR_MESSAGE);
      goTo("error");
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
      // Hoehere Aufloesung/Qualitaet als bei Schadenfotos: ein Fahrzeugschein hat kleine,
      // dichte Textfelder - zu starke Kompression fuehrte zu Fehllesungen (z.B. Baujahr
      // oder Hersteller/Modell komplett falsch erkannt statt "nicht lesbar").
      const compressed = await compressImage(file, 2200, 0.92);
      const formData = new FormData();
      formData.append("document", compressed, compressed.name);
      const res = await fetch("/api/extract-vehicle", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok || !data.result?.found) {
        setRegistrationError(
          data.message || "Es konnten keine Fahrzeugdaten erkannt werden. Sie können die Angaben im nächsten Schritt eintragen."
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
      setRegistrationDetected(detectedLabel || null);
      if (!detectedLabel) setRegistrationError("Es konnten keine Angaben erkannt werden.");
    } catch {
      setRegistrationError("Der Fahrzeugschein konnte nicht ausgelesen werden. Sie können die Angaben im nächsten Schritt eintragen.");
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
  const whatsappHref = `${WHATSAPP_NUMBER_LINK}?text=${encodeURIComponent(contactSummary)}`;

  const photosMissing = Math.max(0, MIN_IMAGES - photos.length);

  return (
    <div className={styles.wizard} ref={cardRef}>
      {(step === "upload" || step === "details") && (
        <ol className={styles.progress} aria-label="Fortschritt">
          <li className={styles.progressActive}>
            <span>1</span> Hochladen
          </li>
          <li className={step === "details" ? styles.progressActive : ""}>
            <span>2</span> <b className={styles.progressLabel}>Prüfen<em className={styles.progressLong}> &amp; starten</em></b>
          </li>
          <li>
            <span>3</span> Ergebnis
          </li>
        </ol>
      )}

      {step === "upload" && (
        <section className={`${styles.card} ${styles.enter}`}>
          <div className={styles.uploadGrid}>
            {/* Fahrzeugschein */}
            <label
              className={`${styles.tile} ${styles.tileSmall} ${registrationDetected ? styles.tileDone : ""}`}
            >
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
              <span className={styles.tileIcon}>
                {registrationDetected ? <CheckIcon size={22} /> : <DocumentIcon />}
              </span>
              <span className={styles.tileText}>
                <strong>
                  {registrationExtracting
                    ? "Wird ausgelesen …"
                    : registrationDetected
                    ? registrationDetected
                    : "Fahrzeugschein"}
                </strong>
                <span>
                  {registrationDetected ? "Erkannt, tippen zum Ersetzen" : "Optional · füllt Fahrzeugdaten aus"}
                </span>
              </span>
              {!registrationDetected && !registrationExtracting && (
                <span className={`${styles.tileCta} ${styles.tileCtaLight}`}>Foto auswählen</span>
              )}
            </label>

            {/* Schadenfotos */}
            <div
              className={`${styles.tile} ${styles.dropzone} ${isDragging ? styles.dropzoneActive : ""}`}
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
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <span className={styles.tileIcon}>
                <CameraIcon />
              </span>
              <span className={styles.tileText}>
                <strong>Schadenfotos hochladen</strong>
                <span>
                  {photos.length > 0
                    ? `${photos.length} von max. ${MAX_IMAGES} Fotos · weitere hinzufügen`
                    : "Empfohlen 3–6 Fotos · auch per Drag & Drop"}
                </span>
              </span>
              <span className={styles.tileCta}>
                <CameraIcon size={18} /> {photos.length > 0 ? "Weitere Fotos" : "Fotos auswählen"}
              </span>
            </div>
          </div>

          {registrationError && <p className={styles.errorText}>{registrationError}</p>}
          {fileError && <p className={styles.errorText}>{fileError}</p>}

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

          {photos.length > 10 && (
            <p className={styles.warningText}>
              Bei sehr vielen Fotos dauert die Analyse länger. Meist reichen 3–6 aussagekräftige Fotos.
            </p>
          )}

          <p className={styles.tip}>
            <strong>Tipp:</strong> ganzes Fahrzeug, Schaden aus mehreren Winkeln und 1–2 Nahaufnahmen.
          </p>

          <button
            type="button"
            className={styles.goldBtn}
            disabled={photos.length < MIN_IMAGES || registrationExtracting}
            onClick={() => goTo("details")}
          >
            <span>
              {photosMissing > 0
                ? `Noch ${photosMissing} Foto${photosMissing > 1 ? "s" : ""} hochladen`
                : registrationExtracting
                ? "Fahrzeugschein wird ausgelesen …"
                : "Weiter zur Analyse"}
            </span>
            <ArrowIcon />
          </button>
        </section>
      )}

      {step === "details" && (
        <section className={`${styles.card} ${styles.enter}`}>
          <h2 className={styles.stepTitle}>Fahrzeug prüfen</h2>

          <div className={styles.formGrid3}>
            <label className={styles.field}>
              <span>Hersteller</span>
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
              <span>Modell</span>
              <select
                value={vehicleData.model || ""}
                disabled={!vehicleData.make}
                onChange={(e) => setVehicleData((v) => ({ ...v, model: e.target.value }))}
              >
                <option value="">{vehicleData.make ? "Bitte wählen" : "Erst Hersteller"}</option>
                {(CAR_MODELS[vehicleData.make || ""] || []).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Erstzulassung</span>
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
          </div>

          <details className={styles.more}>
            <summary>Weitere Angaben (optional, verbessert die Einschätzung)</summary>
            <div className={styles.moreBody}>
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>Beschädigter Bereich</span>
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
                  <span>Kilometerstand</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="85.000"
                    value={vehicleData.mileage || ""}
                    onChange={(e) => setVehicleData((v) => ({ ...v, mileage: e.target.value }))}
                  />
                </label>
                <label className={styles.field}>
                  <span>Noch fahrbereit?</span>
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
                  <span>Warnleuchten an?</span>
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
                <span>Wie ist der Schaden entstanden?</span>
                <textarea
                  maxLength={1500}
                  rows={3}
                  placeholder="z. B. Beim Ausparken seitlich gegen einen Poller gefahren."
                  value={vehicleData.description || ""}
                  onChange={(e) => setVehicleData((v) => ({ ...v, description: e.target.value }))}
                />
                <span className={styles.charCount}>{(vehicleData.description || "").length}/1500</span>
              </label>
            </div>
          </details>

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={consentAnalysis}
              onChange={(e) => setConsentAnalysis(e.target.checked)}
            />
            <span>
              Ich willige ein, dass meine Fotos und Angaben zur automatisierten Ersteinschätzung verarbeitet
              werden. Das Ergebnis ist unverbindlich und ersetzt kein Gutachten. Details in der{" "}
              <a href={`${SITE_URL}/datenschutz`} target="_blank" rel="noreferrer">
                Datenschutzerklärung
              </a>
              .
            </span>
          </label>

          <div className={styles.actionsRow}>
            <button type="button" className={styles.backBtn} onClick={() => goTo("upload")}>
              Zurück
            </button>
            <button type="button" className={styles.goldBtn} disabled={!canSubmit} onClick={submitAnalysis}>
              <span>{consentAnalysis ? "Ersteinschätzung starten" : "Bitte Einwilligung bestätigen"}</span>
              <ArrowIcon />
            </button>
          </div>
        </section>
      )}

      {step === "loading" && (
        <section className={`${styles.card} ${styles.enter}`}>
          <div className={styles.loadingBox}>
            <div className={styles.scanner} aria-hidden="true">
              <CameraIcon size={40} />
              <span className={styles.scanLine} />
            </div>
            <p className={styles.loadingText} aria-live="polite">
              {LOADING_MESSAGES[loadingMsgIndex]}
            </p>
            <p className={styles.helpText}>Das dauert meist unter einer Minute. Bitte Seite geöffnet lassen.</p>
          </div>
        </section>
      )}

      {step === "error" && (
        <section className={`${styles.card} ${styles.enter}`}>
          <h2 className={styles.stepTitle}>Es gab ein Problem</h2>
          <p className={styles.errorText}>{errorMessage}</p>
          <div className={styles.actionsRow}>
            <button type="button" className={styles.backBtn} onClick={() => goTo("details")}>
              Erneut versuchen
            </button>
            <a className={styles.goldBtn} href={PHONE_TEL}>
              <span>Stattdessen anrufen</span>
              <ArrowIcon />
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
            photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
            setPhotos([]);
            setResult(null);
            setConsentAnalysis(false);
            goTo("upload");
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
    c === "high" ? "deutlich erkennbar" : c === "medium" ? "wahrscheinlich" : "nicht sicher beurteilbar";

  useEffect(() => {
    track("Kontaktbereich angezeigt", { schadenschwere: result.severity.level });
  }, [result.severity.level]);

  return (
    <section className={`${styles.card} ${styles.enter}`}>
      <span className={styles.eyebrow}>Ihre unverbindliche Ersteinschätzung</span>

      {result.analysis_status === "insufficient_images" && (
        <div className={styles.warningBox}>
          Die Fotos reichen für eine Einschätzung leider nicht aus.
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

      <div className={styles.resultStats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Schadenschwere</span>
          <strong className={styles.statValue}>{result.severity.level}</strong>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Grobe Reparaturkosten</span>
          <strong className={styles.statValue}>
            {result.estimated_cost_range.possible
              ? `${result.estimated_cost_range.minimum_eur.toLocaleString("de-DE")} – ${result.estimated_cost_range.maximum_eur.toLocaleString("de-DE")} €`
              : "nicht seriös bestimmbar"}
          </strong>
        </div>
      </div>

      {result.drivability_warning.possible_safety_issue && (
        <div className={styles.dangerBox}>
          <strong>Sicherheitshinweis:</strong> {result.drivability_warning.message} Bewegen Sie das Fahrzeug im
          Zweifel nicht weiter und lassen Sie es professionell prüfen.
        </div>
      )}

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

      <details className={styles.more}>
        <summary>Details zur Einschätzung</summary>
        <div className={styles.moreBody}>
          <p>
            <strong>Schadenschwere:</strong> {result.severity.explanation}
          </p>
          {result.estimated_cost_range.possible && (
            <p>
              <strong>Kostenspanne:</strong> {result.estimated_cost_range.explanation}
            </p>
          )}
          {result.possible_hidden_damage.length > 0 && (
            <>
              <p>
                <strong>Mögliche verdeckte Schäden:</strong>
              </p>
              <ul>
                {result.possible_hidden_damage.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </>
          )}
          {result.limitations.length > 0 && (
            <>
              <p>
                <strong>Grenzen dieser Analyse:</strong>
              </p>
              <ul>
                {result.limitations.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </details>

      <p className={styles.disclaimer}>
        Automatisierte Auswertung nur anhand der Fotos. Ersetzt kein Gutachten und keinen Kostenvoranschlag;
        verdeckte Schäden können unentdeckt bleiben.
      </p>

      <div className={styles.contactCta}>
        <h3>Jetzt vom Gutachter prüfen lassen</h3>
        <p>
          Stefan Witmaier prüft den Schaden persönlich und bespricht mit Ihnen die nächsten Schritte. Für
          Unfallgeschädigte in der Regel kostenlos.
        </p>
        <ContactButtons whatsappHref={whatsappHref} onContactClick={(kanal) => track("Kontakt angeklickt", { kanal })} />
        <p className={styles.smallNote}>
          WhatsApp öffnet sich mit Ihrer Zusammenfassung vorausgefüllt. Oder{" "}
          <a href={mailtoHref} onClick={() => track("Kontakt angeklickt", { kanal: "email" })}>
            per E-Mail anfragen
          </a>
          .
        </p>
      </div>

      <button type="button" className={styles.backBtn} onClick={onRestart}>
        Neue Analyse starten
      </button>
    </section>
  );
}
