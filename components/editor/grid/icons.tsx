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

export const PanelRight = I(<><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M15 3v18" /></>);
export const Alert = I(<><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" /></>);

// ---------- lucide icons used by the reference editor chrome (ISC) ----------

const L = (cls: string, children: ReactNode) =>
  function Lucide({ className }: P) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`lucide ${cls}${className ? ` ${className}` : ""}`}
        aria-hidden="true"
      >
        {children}
      </svg>
    );
  };

export const LCloudCheck = L("lucide-cloud-check", <><path d="m17 15-5.5 5.5L9 18" /><path d="M5.516 16.07A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 3.501 7.327" /></>);
export const LCloud = L("lucide-cloud", <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />);
export const LCloudAlert = L("lucide-cloud-alert", <><path d="M12 12v4" /><path d="M12 20h.01" /><path d="M17 18h.5a1 1 0 0 0 0-9h-1.79A7 7 0 1 0 7 17.708" /></>);
export const LPanelLeft = L("lucide-panel-left", <><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 3v18" /></>);
export const LChevronDown = L("lucide-chevron-down", <path d="m6 9 6 6 6-6" />);
export const LBold = L("lucide-bold", <path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" />);
export const LItalic = L("lucide-italic", <><line x1="19" x2="10" y1="4" y2="4" /><line x1="14" x2="5" y1="20" y2="20" /><line x1="15" x2="9" y1="4" y2="20" /></>);
export const LUnderline = L("lucide-underline", <><path d="M6 4v6a6 6 0 0 0 12 0V4" /><line x1="4" x2="20" y1="20" y2="20" /></>);
export const LWandSparkles = L("lucide-wand-sparkles", <><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72" /><path d="m14 7 3 3" /><path d="M5 6v4" /><path d="M19 14v4" /><path d="M10 2v2" /><path d="M7 8H3" /><path d="M21 16h-4" /><path d="M11 3H9" /></>);
export const LType = L("lucide-type", <><path d="M12 4v16" /><path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2" /><path d="M9 20h6" /></>);
export const LImagePlus = L("lucide-image-plus", <><path d="M16 5h6" /><path d="M19 2v6" /><path d="M21 11.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.5" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /><circle cx="9" cy="9" r="2" /></>);
export const LGrid3x3 = L("lucide-grid-3x3", <><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3 9h18" /><path d="M3 15h18" /><path d="M9 3v18" /><path d="M15 3v18" /></>);
export const LUndo2 = L("lucide-undo-2", <><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" /></>);
export const LRedo2 = L("lucide-redo-2", <><path d="m15 14 5-5-5-5" /><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13" /></>);
export const LPencil = L("lucide-pencil", <><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" /><path d="m15 5 4 4" /></>);
export const LSquare = L("lucide-square", <rect width="18" height="18" x="3" y="3" rx="2" />);
export const LPaintBucket = L("lucide-paint-bucket", <><path d="M11 7 6 2" /><path d="M18.992 12H2.041" /><path d="M21.145 18.38A3.34 3.34 0 0 1 20 16.5a3.3 3.3 0 0 1-1.145 1.88c-.575.46-.855 1.02-.855 1.595A2 2 0 0 0 20 22a2 2 0 0 0 2-2.025c0-.58-.285-1.13-.855-1.595" /><path d="m8.5 4.5 2.148-2.148a1.205 1.205 0 0 1 1.704 0l7.296 7.296a1.205 1.205 0 0 1 0 1.704l-7.592 7.592a3.615 3.615 0 0 1-5.112 0l-3.888-3.888a3.615 3.615 0 0 1 0-5.112L5.67 7.33" /></>);
export const LPipette = L("lucide-pipette", <><path d="m12 9-8.414 8.414A2 2 0 0 0 3 18.828v1.344a2 2 0 0 1-.586 1.414A2 2 0 0 1 3.828 21h1.344a2 2 0 0 0 1.414-.586L15 12" /><path d="m18 9 .4.4a1 1 0 1 1-3 3l-3.8-3.8a1 1 0 1 1 3-3l.4.4 3.4-3.4a1 1 0 1 1 3 3z" /><path d="m2 22 .414-.414" /></>);
export const LSquareDashed = L("lucide-square-dashed", <><path d="M5 3a2 2 0 0 0-2 2" /><path d="M19 3a2 2 0 0 1 2 2" /><path d="M21 19a2 2 0 0 1-2 2" /><path d="M5 21a2 2 0 0 1-2-2" /><path d="M9 3h1" /><path d="M9 21h1" /><path d="M14 3h1" /><path d="M14 21h1" /><path d="M3 9v1" /><path d="M21 9v1" /><path d="M3 14v1" /><path d="M21 14v1" /></>);
export const LHand = L("lucide-hand", <><path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2" /><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2" /><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8" /><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" /></>);
export const LSplitH = L("lucide-square-split-horizontal", <><path d="M8 19H5c-1 0-2-1-2-2V7c0-1 1-2 2-2h3" /><path d="M16 5h3c1 0 2 1 2 2v10c0 1-1 2-2 2h-3" /><line x1="12" x2="12" y1="4" y2="20" /></>);
export const LFlipH = L("lucide-flip-horizontal-2", <><path d="m3 7 5 5-5 5V7" /><path d="m21 7-5 5 5 5V7" /><path d="M12 20v2" /><path d="M12 14v2" /><path d="M12 8v2" /><path d="M12 2v2" /></>);
export const LFlipV = L("lucide-flip-vertical-2", <><path d="m17 3-5 5-5-5h10" /><path d="m17 21-5-5-5 5h10" /><path d="M4 12H2" /><path d="M10 12H8" /><path d="M16 12h-2" /><path d="M22 12h-2" /></>);
export const LRotateCcw = L("lucide-rotate-ccw", <><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></>);
export const LRotateCw = L("lucide-rotate-cw", <><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></>);
export const LPalette = L("lucide-palette", <><path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z" /><circle cx="13.5" cy="6.5" r=".5" fill="currentColor" /><circle cx="17.5" cy="10.5" r=".5" fill="currentColor" /><circle cx="6.5" cy="12.5" r=".5" fill="currentColor" /><circle cx="8.5" cy="7.5" r=".5" fill="currentColor" /></>);
export const LRotate3d = L("lucide-rotate-3d", <><path d="m15.194 13.707 3.814 1.86-1.86 3.814" /><path d="M16.47214 7.52786 A 5 10 0 1 0 13 21.79796" /><path d="M21.79796 11 A 10 5 0 1 0 19 15.57071" /></>);
export const LStore = L("lucide-store", <><path d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5" /><path d="M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244" /><path d="M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05" /></>);
export const LShare2 = L("lucide-share-2", <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" x2="15.42" y1="13.51" y2="17.49" /><line x1="15.41" x2="8.59" y1="6.51" y2="10.49" /></>);
export const LDownload = L("lucide-download", <><path d="M12 15V3" /><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /></>);
export const LScrollText = L("lucide-scroll-text", <><path d="M15 12h-5" /><path d="M15 8h-5" /><path d="M19 17V5a2 2 0 0 0-2-2H4" /><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3" /></>);
export const LPlus = L("lucide-plus", <><path d="M5 12h14" /><path d="M12 5v14" /></>);
export const LX = L("lucide-x", <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>);
export const LCopy = L("lucide-copy", <><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></>);

/** Rail icon for 글자·이미지로 만들기: a T next to a small picture frame. */
export function MakeIcon({ className }: P) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M3 5V3h10v2" />
      <path d="M8 3v9" />
      <path d="M6 12h4" />
      <rect x="11" y="11" width="10" height="10" rx="2" />
      <circle cx="14.5" cy="14.5" r="0.75" fill="currentColor" />
      <path d="m21 18-2.2-2.2a1.2 1.2 0 0 0-1.7 0L13 20" />
    </svg>
  );
}

/** Brand mark for the rail (stand-in drawn as a slanted P with a cross stroke). */
export function BrandMark({ className }: P) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" fill="#fff" />
      <path d="M6.2 6.25H21.5C25.5 6.25 27 8.6 26.2 12.3 25.4 16.4 22.4 19.4 17.8 19.4H14.9L13.7 25.6H9.1L12.1 9.7H5.6Z M15.5 15.9H18.9C20.6 15.9 21.6 14.7 21.9 13 22.2 11.2 21.4 9.7 19.6 9.7H16.7Z" fill="#333" fillRule="evenodd" />
    </svg>
  );
}
