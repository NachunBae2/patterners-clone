// Lucide icons (ISC license), inlined.
type P = { className?: string };
const base = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const ChevronDown = ({ className }: P) => (
  <svg {...base} className={`lucide lucide-chevron-down ${className ?? ""}`}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);
export const ChevronUp = ({ className }: P) => (
  <svg {...base} className={`lucide lucide-chevron-up ${className ?? ""}`}>
    <path d="m18 15-6-6-6 6" />
  </svg>
);
export const Globe = ({ className }: P) => (
  <svg {...base} className={`lucide lucide-globe ${className ?? ""}`}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
    <path d="M2 12h20" />
  </svg>
);
export const Menu = ({ className }: P) => (
  <svg {...base} className={`lucide lucide-menu ${className ?? ""}`}>
    <path d="M4 5h16" />
    <path d="M4 12h16" />
    <path d="M4 19h16" />
  </svg>
);
export const X = ({ className }: P) => (
  <svg {...base} className={`lucide lucide-x ${className ?? ""}`}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);
export const Check = ({ className }: P) => (
  <svg {...base} strokeWidth={3} className={`lucide lucide-check ${className ?? ""}`}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
