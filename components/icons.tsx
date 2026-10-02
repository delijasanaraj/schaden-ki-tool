// Kleine Inline-Icons, damit keine externe Icon-Bibliothek noetig ist.

type IconProps = { size?: number; className?: string };

export function PhoneIcon({ size = 20, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
      <path d="M9.5 1.75C9.5 1.34 9.84 1 10.25 1C13.98 1 17 4.02 17 7.75C17 8.16 16.66 8.5 16.25 8.5C15.84 8.5 15.5 8.16 15.5 7.75C15.5 4.85 13.15 2.5 10.25 2.5C9.84 2.5 9.5 2.16 9.5 1.75Z" />
      <path d="M9.5 4.75C9.5 4.34 9.84 4 10.25 4C12.32 4 14 5.68 14 7.75C14 8.16 13.66 8.5 13.25 8.5C12.84 8.5 12.5 8.16 12.5 7.75C12.5 6.51 11.49 5.5 10.25 5.5C9.84 5.5 9.5 5.16 9.5 4.75Z" />
      <path d="M15.35 11.75L12.42 10.46C11.71 10.14 10.87 10.34 10.38 10.95L9.15 12.14C7.84 11.28 6.72 10.17 5.87 8.86L7.07 7.63C7.68 7.14 7.89 6.3 7.57 5.59L6.27 2.66C5.93 1.89 5.08 1.48 4.27 1.69L2.29 2.21C1.44 2.43 0.9 3.25 1.02 4.12C1.95 10.76 7.25 16.06 13.9 16.99C13.98 17.01 14.06 17.01 14.13 17.01C14.91 17.01 15.6 16.49 15.8 15.72L16.31 13.76C16.52 12.94 16.12 12.1 15.35 11.75Z" />
    </svg>
  );
}

export function WhatsAppIcon({ size = 20, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
      <path d="M0.07 32l2.25-8.22C0.93 21.38 0.2 18.65 0.2 15.86 0.21 7.11 7.32 0 16.07 0c4.24 0 8.23 1.65 11.22 4.65 3 3 4.64 6.98 4.64 11.22-0.01 8.74-7.12 15.86-15.86 15.86h-0.01c-2.65 0-5.26-0.67-7.58-1.93L0.07 32z M8.87 26.92l0.48 0.29c2.02 1.2 4.34 1.84 6.71 1.84h0.01c7.27 0 13.18-5.91 13.18-13.18 0-3.52-1.37-6.83-3.86-9.32-2.49-2.49-5.8-3.86-9.32-3.87-7.27 0-13.19 5.91-13.19 13.18 0 2.49 0.7 4.92 2.02 7.01l0.31 0.5-1.33 4.86 4.99-1.31z" />
      <path d="M12.1 9.23c-0.32-0.77-0.65-0.67-0.89-0.68-0.23-0.01-0.5-0.01-0.76-0.01s-0.69 0.1-1.06 0.5c-0.36 0.4-1.39 1.36-1.39 3.31s1.42 3.83 1.62 4.1c0.2 0.26 2.79 4.27 6.77 5.98 0.95 0.41 1.68 0.65 2.26 0.83 0.95 0.3 1.81 0.26 2.5 0.16 0.76-0.11 2.34-0.96 2.68-1.88 0.33-0.93 0.33-1.72 0.23-1.88-0.1-0.17-0.36-0.26-0.76-0.46-0.4-0.2-2.34-1.16-2.71-1.29-0.36-0.13-0.63-0.2-0.89 0.2-0.26 0.4-1.02 1.29-1.25 1.55-0.23 0.26-0.46 0.3-0.86 0.1-0.4-0.2-1.67-0.62-3.19-1.97-1.18-1.05-1.97-2.35-2.2-2.74-0.23-0.4-0.02-0.61 0.17-0.81 0.18-0.18 0.4-0.46 0.59-0.69 0.2-0.23 0.26-0.4 0.4-0.66 0.13-0.26 0.07-0.5-0.03-0.69-0.1-0.2-0.89-2.15-1.22-2.94z" />
    </svg>
  );
}

export function CameraIcon({ size = 26, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect x="3" y="7" width="22" height="15" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="14" cy="14.5" r="4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 7l1.5-2.5h5L18 7" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function DocumentIcon({ size = 26, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect x="4" y="6" width="20" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 11h7M8 14.5h12M8 18h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="20" cy="10.5" r="1.6" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function CheckIcon({ size = 16, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8.5l3.2 3L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowIcon({ size = 18, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M3 9h11M10 5l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function StarIcon({ size = 20, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.75 1.46l3.11 6.3 6.95 1.02a.83.83 0 0 1 .46 1.42l-5.03 4.9 1.19 6.93a.83.83 0 0 1-1.21.88L12 19.63l-6.22 3.27a.83.83 0 0 1-1.21-.88l1.19-6.92-5.03-4.9a.83.83 0 0 1 .46-1.42l6.95-1.02 3.11-6.3a.83.83 0 0 1 1.5 0z" />
    </svg>
  );
}
