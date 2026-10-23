// Extra lucide-style icons (ISC license) used by the crochet editor.
import type { ReactNode } from "react";

const I = (children: ReactNode) =>
  function Icon({ className }: { className?: string }) {
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

export const ChevronUp = I(<path d="m18 15-6-6-6 6" />);
export const Dots = I(<><circle cx="5" cy="5" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="19" cy="5" r="1" /><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="19" r="1" /><circle cx="12" cy="19" r="1" /><circle cx="19" cy="19" r="1" /></>);
export const Bookmark = I(<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />);
export const Ungroup = I(<><rect width="8" height="6" x="5" y="4" rx="1" /><rect width="8" height="6" x="11" y="14" rx="1" /></>);
export const Scissors = I(<><circle cx="6" cy="6" r="3" /><path d="M8.12 8.12 12 12" /><path d="M20 4 8.12 15.88" /><circle cx="6" cy="18" r="3" /><path d="M14.8 14.8 20 20" /></>);
export const ClipboardPaste = I(<><path d="M15 2H9a1 1 0 0 0-1 1v2c0 .6.4 1 1 1h6c.6 0 1-.4 1-1V3c0-.6-.4-1-1-1Z" /><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2M16 4h2a2 2 0 0 1 2 2v2M11 14h10" /><path d="m17 10 4 4-4 4" /></>);
export const PanelLeft = I(<><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 3v18" /></>);
export const PanelRight = I(<><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M15 3v18" /></>);
export const Merge = I(<><path d="m8 6 4-4 4 4" /><path d="M12 2v10.3a4 4 0 0 1-1.172 2.872L4 22" /><path d="m20 22-5-5" /></>);
export const Grip = I(<><circle cx="9" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="18" r="1" /></>);
