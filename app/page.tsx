import DamageWizard from "@/components/DamageWizard";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <span className={styles.logo}>Sachverständigenbüro Witmaier</span>
          <a className={styles.headerCall} href="tel:+4917699808695">
            +49 176 998 086 95
          </a>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <h1 className={styles.heroTitle}>Fahrzeugschaden in wenigen Schritten einschätzen lassen</h1>
          <p className={styles.heroLead}>
            Laden Sie einige aussagekräftige Fotos hoch und ergänzen Sie bei Bedarf Angaben zu Ihrem
            Fahrzeug und zum Unfall. Anschließend erhalten Sie eine unverbindliche KI-gestützte
            Ersteinschätzung der sichtbar erkennbaren Beschädigungen.
          </p>

          <ul className={styles.trustList}>
            <li>Keine Registrierung erforderlich</li>
            <li>Einfache Fotoanalyse</li>
            <li>Unverbindliche Ersteinschätzung</li>
            <li>Persönliche Prüfung durch einen Kfz-Gutachter möglich</li>
          </ul>

          <div className={styles.disclaimerBanner}>
            Die Online-Analyse ersetzt weder ein Gutachten noch einen Kostenvoranschlag. Verdeckte oder
            sicherheitsrelevante Schäden können auf Fotos möglicherweise nicht erkannt werden.
          </div>
        </div>
      </section>

      <section className={styles.steps}>
        <div className={styles.stepsInner}>
          <div className={styles.stepCard}>
            <span className={styles.stepNumber}>1</span>
            <h3>Schaden fotografieren</h3>
            <p>Fahrzeug, Schaden aus mehreren Blickwinkeln und Detailaufnahmen.</p>
          </div>
          <div className={styles.stepCard}>
            <span className={styles.stepNumber}>2</span>
            <h3>Angaben ergänzen</h3>
            <p>Optionale Fahrzeugdaten und eine kurze Unfallbeschreibung.</p>
          </div>
          <div className={styles.stepCard}>
            <span className={styles.stepNumber}>3</span>
            <h3>Ersteinschätzung erhalten</h3>
            <p>Verständliche Auswertung mit klaren Grenzen und nächsten Schritten.</p>
          </div>
        </div>
      </section>

      <section className={styles.wizardSection} id="tool">
        <DamageWizard />
      </section>

      <footer className={styles.footer}>
        <p>
          Sachverständigenbüro Witmaier · Sophie-Scholl-Str. 5, 71691 Freiberg am Neckar ·{" "}
          <a href="mailto:keo.kontakt@gmail.com">keo.kontakt@gmail.com</a>
        </p>
        <p className={styles.footerSmall}>
          Diese Seite ist ein ergänzendes Analyse-Tool zu{" "}
          <a href="https://stefan-witmaier.de" target="_blank" rel="noreferrer">
            stefan-witmaier.de
          </a>
          . Es gelten die dort veröffentlichte Datenschutzerklärung und das Impressum entsprechend.
        </p>
      </footer>
    </main>
  );
}
