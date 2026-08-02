"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import styles from "./DamageWizard.module.css";
import { compressImage } from "@/lib/compressImage";
import { MAX_IMAGES, MIN_IMAGES, ACCEPTED_MIME_TYPES, type AnalysisResult, type VehicleData } from "@/lib/schema";
import { CAR_MAKES, CAR_MODELS, getYearOptions } from "@/lib/vehicleData";

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
      const incoming = Array.from(fileList);
      const room = MAX_IMAGES - photos.length;
      if (room <= 0) {
        setFileError(`Sie können maximal ${MAX_IMAGES} Fotos hochladen.`);
        return;
      }
      const accepted: Photo[] = [];
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
        accepted.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file: compressed,
          previewUrl: URL.createObjectURL(compressed),
        });
      }
      if (accepted.length > 0) {
        setPhotos((prev) => [...prev, ...accepted]);
      }
      if (incoming.length > room) {
        setFileError(`Es wurden nur ${room} weitere Fotos übernommen (maximal ${MAX_IMAGES} insgesamt).`);
      }
    },
    [photos.length]
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
    try {
      const formData = new FormData();
      photos.forEach((p) => formData.append("photos", p.file, p.file.name));
      formData.append("vehicleData", JSON.stringify(vehicleData));

      const res = await fetch("/api/analyze", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(
          data.message ||
            "Die Analyse konnte gerade nicht abgeschlossen werden. Bitte versuchen Sie es erneut oder senden Sie Ihre Fotos direkt über die Kontaktanfrage an den Gutachter."
        );
        setStep("error");
        return;
      }

      setResult(data.result);
      setStep("result");
    } catch {
      setErrorMessage(
        "Die Analyse konnte gerade nicht abgeschlossen werden. Bitte versuchen Sie es erneut oder senden Sie Ihre Fotos direkt über die Kontaktanfrage an den Gutachter."
      );
      setStep("error");
    } finally {
      setSubmitting(false);
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
              JPEG, PNG oder WebP · {photos.length}/{MAX_IMAGES} Fotos · empfohlen 3–6 Fotos
            </p>
          </div>

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
          <a className={styles.primaryBtnLink} href="tel:+4917699808695">
            Jetzt direkt anrufen
          </a>
          <a
            className={`${styles.secondaryBtnLink} ${styles.whatsappBtn}`}
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp schreiben
          </a>
          <a className={styles.secondaryBtnLink} href={mailtoHref}>
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
