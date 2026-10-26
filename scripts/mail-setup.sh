#!/bin/bash
# Prueft Gmail-Zugangsdaten (Adresse + App-Passwort) direkt bei Google und traegt sie NUR bei Erfolg in Vercel ein
# (SMTP_USER, SMTP_PASSWORD, Production) und deployt neu. Enthaelt selbst keine Zugangsdaten.
# Aufruf im Terminal:  bash scripts/mail-setup.sh
export PATH="$HOME/.nvm/versions/node/v24.18.1/bin:$HOME/.local/bin:$PATH"
cd "$(dirname "$0")/.." || { echo "Projektordner nicht gefunden"; exit 1; }

read -p "Absender-Gmail-Adresse (komplett, mit @gmail.com): " U
read -s -p "App-Passwort (16 Zeichen, Leerzeichen egal): " P
echo
U="$(printf '%s' "$U" | tr -d '[:space:]')"
P="$(printf '%s' "$P" | tr -d '[:space:]')"
echo "Eingegeben: Adresse '$U', Passwort mit ${#P} Zeichen (erwartet: 16)"
export U P

if [ "${#P}" -ne 16 ]; then
  echo
  echo "STOPP: Ein App-Passwort hat genau 16 Buchstaben (4 Bloecke zu je 4, nur Kleinbuchstaben)."
  echo "Das eingefuegte hat ${#P} Zeichen - das ist vermutlich NICHT das App-Passwort."
  echo "Nichts wurde geaendert. Erzeuge ein neues App-Passwort (myaccount.google.com/apppasswords) und kopiere genau das gelbe Feld."
  exit 1
fi

if node -e '
const n = require("nodemailer");
n.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: process.env.U, pass: process.env.P } })
  .verify()
  .then(() => { console.log("OK: Google akzeptiert die Anmeldung."); process.exit(0); },
        (e) => { console.log("FEHLER von Google:", e.message); process.exit(1); });
'; then
  echo "Trage die Werte in Vercel ein ..."
  vercel env rm SMTP_USER production --yes >/dev/null 2>&1
  vercel env rm SMTP_PASSWORD production --yes >/dev/null 2>&1
  printf '%s' "$U" | vercel env add SMTP_USER production
  printf '%s' "$P" | vercel env add SMTP_PASSWORD production
  echo "Deploye neu ..."
  vercel --prod --yes 2>&1 | tail -4
  echo "FERTIG. Du kannst jetzt den Test im Tool wiederholen."
else
  echo
  echo "Nichts wurde in Vercel geaendert. Bitte pruefen:"
  echo " 1. Ist die Adresse genau das Konto, in dem du das App-Passwort erzeugt hast?"
  echo " 2. Neues App-Passwort erzeugen (myaccount.google.com/apppasswords) und noch mal versuchen."
  echo " 3. Ist die Bestaetigung in zwei Schritten fuer DIESES Konto an?"
fi
