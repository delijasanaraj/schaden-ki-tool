#!/usr/bin/env node
// Taegliche Gesundheitspruefung fuer das KI-Schadenrechner-Tool (siehe README, Abschnitt "Taegliche Pruefung").
// Aufruf: node scripts/healthcheck.mjs [--ai]
//   ohne --ai : Live-Seite, Zertifikat, Weiterleitung, Vercel-Status, Laufzeit-Logs, Env-Variablen, npm audit, Git
//   mit  --ai : zusaetzlich lokaler End-to-End-Test der Analyse (ein echter KI-Aufruf, ohne E-Mail-Versand)
// Voraussetzung: node, npm und vercel im PATH. Exitcode 1, wenn mindestens ein FAIL vorliegt.
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import tls from "node:tls";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOMAIN = "fahrzeug-schadenrechner.stefan-witmaier.de";
const BASE = `https://${DOMAIN}`;
const OLD_URL = "https://schaden-ki-tool.vercel.app";
const WITH_AI = process.argv.includes("--ai");

const results = [];
function add(level, name, detail = "") {
  results.push({ level, name, detail });
  const tag = { ok: "OK  ", warn: "WARN", fail: "FAIL" }[level];
  console.log(`${tag} ${name}${detail ? ` - ${detail}` : ""}`);
}
const sh = async (cmd, args, opts = {}) => {
  try {
    const { stdout, stderr } = await run(cmd, args, { cwd: ROOT, maxBuffer: 50 * 1024 * 1024, timeout: 180000, ...opts });
    return { ok: true, out: `${stdout}${stderr}`, stdout };
  } catch (e) {
    return { ok: false, out: `${e.stdout || ""}${e.stderr || ""}${e.message || ""}`, stdout: e.stdout || "" };
  }
};
const get = (url, init = {}) => fetch(url, { signal: AbortSignal.timeout(20000), ...init });

async function liveChecks() {
  try {
    const r = await get(BASE);
    const html = await r.text();
    if (r.status !== 200) add("fail", "Startseite erreichbar", `HTTP ${r.status}`);
    else if (!html.includes("KI-Schadenrechner")) add("fail", "Startseite Inhalt", "Titel/H1 'KI-Schadenrechner' fehlt");
    else if (!/<meta name="robots" content="index, follow"/.test(html)) add("fail", "Google-Freigabe", "robots-Meta nicht 'index, follow'");
    else add("ok", "Startseite", "200, Inhalt und index/follow stimmen");
  } catch (e) {
    add("fail", "Startseite erreichbar", e.message);
  }

  for (const p of ["/robots.txt", "/sitemap.xml"]) {
    try {
      const r = await get(BASE + p);
      add(r.status === 200 ? "ok" : "fail", p, `HTTP ${r.status}`);
    } catch (e) {
      add("fail", p, e.message);
    }
  }

  try {
    const r = await get(OLD_URL + "/", { redirect: "manual" });
    const loc = r.headers.get("location") || "";
    add(r.status === 308 && loc.includes(DOMAIN) ? "ok" : "warn", "Weiterleitung alte Adresse", `HTTP ${r.status} -> ${loc}`);
  } catch (e) {
    add("warn", "Weiterleitung alte Adresse", e.message);
  }

  try {
    const fd = new FormData();
    fd.append("vehicleData", "{}");
    const r = await get(`${BASE}/api/analyze`, { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    add(r.status === 400 && j.error === "invalid_lead" ? "ok" : "fail", "Analyse-Schnittstelle (Kontaktdaten-Pflicht)", `HTTP ${r.status} ${j.error || ""}`);
  } catch (e) {
    add("fail", "Analyse-Schnittstelle", e.message);
  }

  try {
    const r = await get(`${BASE}/api/extract-vehicle`, { method: "POST", body: new FormData() });
    add(r.status === 400 || r.status === 429 ? "ok" : "fail", "Fahrzeugschein-Schnittstelle", `HTTP ${r.status}`);
  } catch (e) {
    add("fail", "Fahrzeugschein-Schnittstelle", e.message);
  }

  try {
    const days = await new Promise((resolve, reject) => {
      const s = tls.connect(443, DOMAIN, { servername: DOMAIN }, () => {
        const c = s.getPeerCertificate();
        s.end();
        resolve(Math.floor((new Date(c.valid_to).getTime() - Date.now()) / 86400000));
      });
      s.on("error", reject);
      s.setTimeout(10000, () => {
        s.destroy();
        reject(new Error("Timeout"));
      });
    });
    add(days > 14 ? "ok" : days > 3 ? "warn" : "fail", "SSL-Zertifikat", `noch ${days} Tage gueltig`);
  } catch (e) {
    add("fail", "SSL-Zertifikat", e.message);
  }
}

async function vercelChecks() {
  const ls = await sh("vercel", ["ls", "--prod"]);
  const row = ls.out.split("\n").find((l) => /(Ready|Error|Building|Canceled)/.test(l));
  if (!ls.ok || !row) add("warn", "Vercel: letztes Production-Deployment", "nicht lesbar (vercel CLI/Anmeldung pruefen)");
  else if (/Error/.test(row)) add("fail", "Vercel: letztes Production-Deployment", "Status Error");
  else if (/Building/.test(row)) add("warn", "Vercel: letztes Production-Deployment", "laeuft noch");
  else add("ok", "Vercel: letztes Production-Deployment", "Ready");

  const env = await sh("vercel", ["env", "ls", "production"]);
  const needed = ["ANTHROPIC_API_KEY", "ANTHROPIC_MODEL", "SMTP_USER", "SMTP_PASSWORD", "LEAD_NOTIFY_EMAIL"];
  const missing = needed.filter((n) => !new RegExp(`\\b${n}\\b`).test(env.out));
  if (!env.ok) add("warn", "Vercel: Env-Variablen", "nicht lesbar");
  else add(missing.length ? "fail" : "ok", "Vercel: Env-Variablen", missing.length ? `fehlen: ${missing.join(", ")}` : "alle Pflichtvariablen vorhanden");

  const logs = await sh("vercel", ["logs", DOMAIN, "--since", "24h"]);
  const logFile = path.join(os.tmpdir(), "healthcheck-vercel.log");
  fs.writeFileSync(logFile, logs.out);
  const count = (re) => (logs.out.match(re) || []).length;
  const timeouts = count(/Task timed out|FUNCTION_INVOCATION_TIMEOUT/g);
  const mailFail = count(/\[notify\][^\n]*fehlgeschlagen|\[notify\][^\n]*Fehler/g);
  const undelivered = count(/\[LEAD-NICHT-ZUGESTELLT\]/g);
  const apiErrors = count(/\[\/api\/(analyze|extract-vehicle)\] Fehler/g);
  const imgErrors = count(/Bildverarbeitung fehlgeschlagen/g);
  const analyses = count(/POST \/api\/analyze/g);
  console.log(`INFO Logs der letzten 24h: ${analyses} Analyse-Aufrufe, Rohlog: ${logFile}`);
  add(timeouts ? "fail" : "ok", "Logs: Zeitueberschreitungen (60s)", `${timeouts}`);
  add(mailFail ? "fail" : "ok", "Logs: E-Mail-Versand fehlgeschlagen", `${mailFail}`);
  add(undelivered ? "fail" : "ok", "Logs: nicht zugestellte Leads (Kontaktdaten stehen im Rohlog!)", `${undelivered}`);
  add(apiErrors ? "warn" : "ok", "Logs: Fehler in /api/analyze bzw. /api/extract-vehicle", `${apiErrors}`);
  if (imgErrors) add("warn", "Logs: Bildverarbeitung fehlgeschlagen", `${imgErrors} (oft defekte Nutzer-Dateien)`);
}

async function codeChecks() {
  const audit = await sh("npm", ["audit", "--json"]);
  try {
    const v = JSON.parse(audit.stdout).metadata.vulnerabilities;
    const bad = (v.high || 0) + (v.critical || 0);
    add(bad ? "warn" : "ok", "npm audit", bad ? `${v.critical || 0} kritisch, ${v.high || 0} hoch` : "keine hohen/kritischen Luecken");
  } catch {
    add("warn", "npm audit", "nicht auswertbar");
  }
  await sh("git", ["fetch", "origin"]);
  const st = await sh("git", ["status", "-sb", "--porcelain"]);
  const first = st.out.split("\n")[0] || "";
  const dirty = st.out.split("\n").slice(1).filter(Boolean).length;
  add(/behind|ahead/.test(first) || dirty ? "warn" : "ok", "Git", `${first.trim()}${dirty ? `, ${dirty} uncommittete Dateien` : ""}`);
}

async function aiEndToEnd() {
  const build = await sh("npm", ["run", "build"], { timeout: 300000 });
  if (!build.ok) return add("fail", "E2E: Build", build.out.slice(-300));
  add("ok", "E2E: Build");
  const port = 3100;
  const env = { ...process.env, PORT: String(port), SMTP_USER: "", SMTP_PASSWORD: "", RESEND_API_KEY: "", LEAD_NOTIFY_EMAIL: "", NTFY_TOPIC: "" };
  const srv = spawn("npx", ["next", "start", "-p", String(port)], { cwd: ROOT, env, stdio: "ignore" });
  try {
    let up = false;
    for (let i = 0; i < 30 && !up; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      up = await fetch(`http://localhost:${port}/`).then((r) => r.ok, () => false);
    }
    if (!up) return add("fail", "E2E: lokaler Server", "startet nicht");
    const attempt = async () => {
      const fd = new FormData();
      fd.append("photos", new Blob([fs.readFileSync(path.join(ROOT, "scripts/fixtures/damage-test.jpg"))], { type: "image/jpeg" }), "damage-test.jpg");
      fd.append("vehicleData", JSON.stringify({ make: "Chrysler", model: "Cirrus" }));
      fd.append("lead", JSON.stringify({ firstName: "Health", lastName: "Check", phone: "0000 000000", email: "healthcheck@example.com", consent: true }));
      const t0 = Date.now();
      try {
        const r = await fetch(`http://localhost:${port}/api/analyze`, { method: "POST", body: fd, signal: AbortSignal.timeout(90000) });
        const j = await r.json().catch(() => ({}));
        return { secs: Math.round((Date.now() - t0) / 1000), http: r.status, status: j.result?.analysis_status, err: `${j.error || ""} ${j.message || ""}`.trim() };
      } catch (e) {
        return { secs: Math.round((Date.now() - t0) / 1000), http: 0, err: e.message };
      }
    };
    let res = await attempt();
    if (res.http !== 200 || !res.status) {
      add("warn", "E2E: KI-Analyse, 1. Versuch fehlgeschlagen", `HTTP ${res.http} nach ${res.secs}s ${res.err} - wiederhole einmal`);
      res = await attempt();
    }
    if (res.http !== 200 || !res.status) add("fail", "E2E: KI-Analyse", `HTTP ${res.http} nach ${res.secs}s ${res.err}`);
    else add(res.secs > 50 ? "warn" : "ok", "E2E: KI-Analyse", `HTTP 200, Status ${res.status}, ${res.secs}s (Limit 60s)`);
  } catch (e) {
    add("fail", "E2E: KI-Analyse", e.message);
  } finally {
    srv.kill();
  }
}

console.log(`Healthcheck ${new Date().toISOString()} (${BASE})`);
await liveChecks();
await vercelChecks();
await codeChecks();
if (WITH_AI) await aiEndToEnd();

const fails = results.filter((r) => r.level === "fail").length;
const warns = results.filter((r) => r.level === "warn").length;
console.log(`\nERGEBNIS: ${fails} FAIL, ${warns} WARN, ${results.length - fails - warns} OK`);
process.exit(fails ? 1 : 0);
