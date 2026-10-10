export type LeadData = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
};

export type LeadErrors = Partial<Record<keyof LeadData, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\u0000-\u001f\u007f]/;

// Wird identisch im Browser (Inline-Fehlermeldungen) und auf dem Server (verbindliche
// Pruefung) verwendet - der Server verlaesst sich nie auf die Browser-Pruefung.
export function leadErrors(lead: Partial<LeadData>): LeadErrors {
  const errors: LeadErrors = {};
  const firstName = (lead.firstName ?? "").trim();
  const lastName = (lead.lastName ?? "").trim();
  const phone = (lead.phone ?? "").trim();
  const email = (lead.email ?? "").trim();

  if (firstName.length < 2 || firstName.length > 60 || CONTROL_CHARS_RE.test(firstName)) {
    errors.firstName = "Bitte Vornamen eingeben.";
  }
  if (lastName.length < 2 || lastName.length > 60 || CONTROL_CHARS_RE.test(lastName)) {
    errors.lastName = "Bitte Nachnamen eingeben.";
  }
  const phoneDigits = phone.replace(/\D/g, "").length;
  if (!/^[+\d][\d\s/().-]*$/.test(phone) || phoneDigits < 6 || phoneDigits > 15) {
    errors.phone = "Bitte gültige Telefonnummer eingeben.";
  }
  if (!EMAIL_RE.test(email) || email.length > 120 || CONTROL_CHARS_RE.test(email)) {
    errors.email = "Bitte gültige E-Mail-Adresse eingeben.";
  }
  return errors;
}

export function cleanLead(lead: LeadData): LeadData {
  return {
    firstName: lead.firstName.trim(),
    lastName: lead.lastName.trim(),
    phone: lead.phone.trim(),
    email: lead.email.trim(),
  };
}
