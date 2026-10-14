/* eslint-disable @next/next/no-img-element */
import DamageWizard from "@/components/DamageWizard";
import ContactButtons from "@/components/ContactButtons";
import { CheckIcon, StarIcon } from "@/components/icons";
import styles from "./page.module.css";
import {
  SITE_URL,
  CONTACT_EMAIL,
  ADDRESS_LINES,
  GOOGLE_RATING_TEXT,
  LOGO_URL,
  GOOGLE_LOGO_URL,
  PORTRAIT_URL,
  HERO_PHOTO_URL,
} from "@/lib/site";

export default function Home() {
  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <div className={styles.heroPhoto} style={{ backgroundImage: `url(${HERO_PHOTO_URL})` }} aria-hidden="true" />
        <div className={styles.heroInner}>
          <div className={styles.heroText}>
          <h1 className={styles.heroTitle}>
            17 Jahre Erfahrung. Jetzt <span className={styles.accent}>mit KI</span> für Sie verfügbar.
          </h1>
          <p className={styles.heroAbout}>
            Unser Fachwissen aus 17 Jahren Kfz-Schadenbegutachtung steckt in unserem eigenen KI-Tool – für
            Ihre erste Einschätzung auf Knopfdruck.
          </p>
          <p className={styles.heroLead}>
            Fahrzeugschein und Schadenfotos hochladen – in wenigen Minuten erhalten Sie Ihre
            unverbindliche Schadenkalkulation.
          </p>

          <ul className={styles.chips}>
            <li><CheckIcon /> Kostenlos</li>
            <li><CheckIcon /> In wenigen Minuten</li>
            <li><CheckIcon /> Unverbindlich</li>
            <li><CheckIcon /> Ohne Registrierung</li>
          </ul>

          <a
            className={styles.rating}
            href={SITE_URL}
            target="_blank"
            rel="noreferrer"
          >
            <img src={GOOGLE_LOGO_URL} alt="Google" className={styles.googleLogo} />
            <span className={styles.ratingText}>
              <span className={styles.stars} aria-label="5 von 5 Sternen">
                {[0, 1, 2, 3, 4].map((i) => (
                  <StarIcon key={i} size={17} />
                ))}
              </span>
              <strong>{GOOGLE_RATING_TEXT}</strong>
            </span>
          </a>
          </div>
        </div>
      </section>

      <section className={styles.wizardSection} id="tool">
        <div className={styles.wizardWrap}>
          <DamageWizard />
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerCol}>
            <div className={styles.footerHead}>
              <a href={SITE_URL} className={styles.footerLogoLink} aria-label="Zur Website von Stefan Witmaier">
                <img src={LOGO_URL} alt="Witmaier Fahrzeug-Ingenieurbüro" className={styles.footerLogo} />
              </a>
              <h2 className={styles.footerTitle}>Sachverständigenbüro Witmaier</h2>
            </div>
            <nav className={styles.footerNav} aria-label="Website">
              <a href={SITE_URL}>Startseite</a>
              <a href={SITE_URL}>Leistungen</a>
              <a href={SITE_URL}>Bewertungen</a>
            </nav>
          </div>

          <div className={styles.footerCol}>
            <div className={styles.footerHead}>
              <h2 className={styles.footerTitle}>Kontakt</h2>
            </div>
            <div className={styles.person}>
              <img src={PORTRAIT_URL} alt="Stefan Witmaier" className={styles.portrait} />
              <div>
                <strong>Stefan Witmaier</strong>
                <span>Ihr Kfz-Sachverständiger</span>
              </div>
            </div>
            <p className={styles.footerMuted}>{ADDRESS_LINES[1]}</p>
            <p className={styles.footerMuted}>{CONTACT_EMAIL}</p>
          </div>

          <div className={styles.footerCol}>
            <div className={styles.footerHead}>
              <h2 className={styles.footerTitle}>Infos</h2>
            </div>
            <nav className={styles.footerNav} aria-label="Rechtliches">
              <a href={`${SITE_URL}/impressum`}>Impressum</a>
              <a href={`${SITE_URL}/datenschutz`}>Datenschutz</a>
            </nav>
            <ContactButtons compact />
          </div>
        </div>
        <p className={styles.footerNote}>
          Die KI-Ersteinschätzung ist ein Zusatzangebot zu stefan-witmaier.de und ersetzt kein Gutachten.
          Kein offizielles Gutachten.
        </p>
      </footer>
    </main>
  );
}
