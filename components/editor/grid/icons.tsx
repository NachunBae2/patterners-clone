// Extra lucide-style icons for the 배색·방안 editor.
import type { ReactNode } from "react";

type P = { className?: string };
const I = (children: ReactNode) =>
  function Icon({ className }: P) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className ?? "size-[18px]"}
        aria-hidden="true"
      >
        {children}
      </svg>
    );
  };

export const SelectRect = I(<><path d="M5 3a2 2 0 0 0-2 2" /><path d="M19 3a2 2 0 0 1 2 2" /><path d="M21 19a2 2 0 0 1-2 2" /><path d="M5 21a2 2 0 0 1-2-2" /><path d="M9 3h1" /><path d="M9 21h1" /><path d="M14 3h1" /><path d="M14 21h1" /><path d="M3 9v1" /><path d="M21 9v1" /><path d="M3 14v1" /><path d="M21 14v1" /></>);
export const RectFill = I(<><rect width="16" height="16" x="4" y="4" rx="2" /><path d="M4 12h16M12 4v16" strokeOpacity="0.45" /></>);
export const Mirror = I(<><path d="M12 3v18" strokeDasharray="2 2.5" /><path d="M8 7 4 12l4 5" /><path d="m16 7 4 5-4 5" /></>);
export const ChevronUp = I(<path d="m18 15-6-6-6 6" />);
export const ArrowUp = I(<><path d="m5 12 7-7 7 7" /><path d="M12 19V5" /></>);
export const ArrowDown = I(<><path d="M12 5v14" /><path d="m19 12-7 7-7-7" /></>);
export const Bold = I(<path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" />);
export const Italic = I(<><path d="M19 4h-9" /><path d="M14 20H5" /><path d="M15 4 9 20" /></>);
export const Underline = I(<><path d="M6 4v6a6 6 0 0 0 12 0V4" /><path d="M4 20h16" /></>);
export const Upload = I(<><path d="M12 3v12" /><path d="m17 8-5-5-5 5" /><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /></>);
export const Wand = I(<><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72" /><path d="m14 7 3 3" /><path d="M5 6v4" /><path d="M19 14v4" /><path d="M10 2v2" /><path d="M7 8H3" /><path d="M21 16h-4" /><path d="M11 3H9" /></>);
export const PanelLeft = I(<><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 3v18" /></>);
export const PanelRight = I(<><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M15 3v18" /></>);
export const Alert = I(<><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" /></>);
