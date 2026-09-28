import styles from "./ContactButtons.module.css";
import { PhoneIcon, WhatsAppIcon } from "./icons";
import { PHONE_TEL, WHATSAPP_LINK } from "@/lib/site";

type Props = {
  whatsappHref?: string;
  compact?: boolean;
};

// Anruf- und WhatsApp-Button im Stil der Hauptseite
export default function ContactButtons({ whatsappHref = WHATSAPP_LINK, compact = false }: Props) {
  return (
    <div className={`${styles.row} ${compact ? styles.compact : ""}`}>
      <a className={`${styles.btn} ${styles.call}`} href={PHONE_TEL}>
        <PhoneIcon size={compact ? 18 : 22} />
        <span className={styles.text}>
          <span className={styles.label}>Jetzt direkt anrufen</span>
          {!compact && <span className={styles.sub}>(100% unabhängig &amp; professionell)</span>}
        </span>
      </a>
      <a className={`${styles.btn} ${styles.whatsapp}`} href={whatsappHref} target="_blank" rel="noreferrer">
        <WhatsAppIcon size={compact ? 18 : 22} />
        <span className={styles.text}>
          <span className={styles.label}>WhatsApp Nachricht</span>
          {!compact && <span className={styles.sub}>(Schnelle Antwortzeit)</span>}
        </span>
      </a>
    </div>
  );
}
