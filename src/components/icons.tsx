// Small stroke icons, 1.75px, currentColor. Kept inline to avoid an icon dependency.
type P = { className?: string };
const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const CalendarIcon = ({ className = "h-4 w-4" }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </svg>
);
export const ChartIcon = ({ className = "h-4 w-4" }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
    <path d="M5 20V11M12 20V4M19 20v-6" />
  </svg>
);
export const ChevronLeft = ({ className = "h-5 w-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);
export const ChevronRight = ({ className = "h-4 w-4" }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
    <path d="M9 5l7 7-7 7" />
  </svg>
);
export const RefreshIcon = ({ className = "h-3.5 w-3.5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
    <path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v4.5h-4.5" />
  </svg>
);
export const PinIcon = ({ className = "h-4 w-4" }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
    <circle cx="12" cy="10" r="2.3" />
  </svg>
);
export const MailIcon = ({ className = "h-4 w-4" }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
    <path d="M4 7l8 6 8-6" />
  </svg>
);
export const PlaneIcon = ({ className = "h-4 w-4" }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
    <path d="M10.5 13.5L4 11l1.5-1.5 7 1 4-4.5c1-1 2.6-1.3 3-.9.4.4.1 2-.9 3l-4.5 4 1 7L13.5 20 11 13.5" />
  </svg>
);
export const BedIcon = ({ className = "h-4 w-4" }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
    <path d="M3.5 18.5V6M3.5 14h17v4.5M20.5 14v-2.5a3 3 0 0 0-3-3H11V14" />
    <circle cx="7.25" cy="10.75" r="1.75" />
  </svg>
);
export const CarIcon = ({ className = "h-4 w-4" }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
    <path d="M5 16.5V12l2-5h10l2 5v4.5M3.5 12h17M7 16.5v2M17 16.5v2" />
    <circle cx="8" cy="14.25" r=".6" fill="currentColor" />
    <circle cx="16" cy="14.25" r=".6" fill="currentColor" />
  </svg>
);
export const BellIcon = ({ className = "h-4 w-4" }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
    <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15zM10 20.5a2 2 0 0 0 4 0" />
  </svg>
);
export const ReceiptIcon = ({ className = "h-4 w-4" }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
    <path d="M6 3.5h12v17l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5zM9 8h6M9 11.5h6M9 15h3.5" />
  </svg>
);
