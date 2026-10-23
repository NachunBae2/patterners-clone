// Icons for the works home. Lucide icons (ISC license) + simple craft glyphs.
import type { ReactNode } from "react";

type P = { className?: string } & Record<`data-${string}`, string | undefined>;

const L = (name: string, children: ReactNode) =>
  function LucideIcon({ className, ...data }: P) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`lucide lucide-${name}${className ? ` ${className}` : ""}`}
        aria-hidden="true"
        {...data}
      >
        {children}
      </svg>
    );
  };

const G = (children: ReactNode) =>
  function CraftIcon({ className, ...data }: P) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" {...data}>
        {children}
      </svg>
    );
  };

export const FilesIcon = L("files", <><path d="M15 2h-4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8" /><path d="M16.706 2.706A2.4 2.4 0 0 0 15 2v5a1 1 0 0 0 1 1h5a2.4 2.4 0 0 0-.706-1.706z" /><path d="M5 7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 1.732-1" /></>);
export const TrashIcon = L("trash-2", <><path d="M10 11v6" /><path d="M14 11v6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>);
export const StoreIcon = L("store", <><path d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5" /><path d="M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244" /><path d="M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05" /></>);
export const HelpIcon = L("circle-question-mark", <><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></>);
export const ChatIcon = L("message-circle", <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />);
export const MegaphoneIcon = L("megaphone", <><path d="M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" /><path d="M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14" /><path d="M8 6v8" /></>);
export const MessageSquareIcon = L("message-square", <path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />);
export const CardIcon = L("credit-card", <><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" /></>);
export const SettingsIcon = L("settings", <><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" /><circle cx="12" cy="12" r="3" /></>);
export const LogOutIcon = L("log-out", <><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /></>);
export const BellIcon = L("bell", <><path d="M10.268 21a2 2 0 0 0 3.464 0" /><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" /></>);
export const SortIcon = L("arrow-up-down", <><path d="m21 16-4 4-4-4" /><path d="M17 20V4" /><path d="m3 8 4-4 4 4" /><path d="M7 4v16" /></>);
export const SearchIcon = L("search", <><path d="m21 21-4.34-4.34" /><circle cx="11" cy="11" r="8" /></>);
export const PlusIcon = L("plus", <><path d="M5 12h14" /><path d="M12 5v14" /></>);
export const XIcon = L("x", <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>);
export const MenuIcon = L("menu", <><path d="M4 5h16" /><path d="M4 12h16" /><path d="M4 19h16" /></>);
export const MoreIcon = L("ellipsis", <><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></>);
export const PinIcon = L("pin", <><path d="M12 17v5" /><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" /></>);

export const CrochetGlyph = G(<><path d="M6.8 20.6c-1.1.3-2-.7-1.5-1.7L14.2 5.8c.5-1 1.9-1.4 2.9-.7.8.5 1 1.6.4 2.3-.6.8-1.8.9-2.5.2l-.9-.8" /><path d="M9.2 16.2h2.4" /></>);
export const KnittingGlyph = G(<><path d="M5.2 18.8 16.6 6.6" /><circle cx="18" cy="5.1" r="1.55" /><path d="M18.8 18.8 7.4 6.6" /><circle cx="6" cy="5.1" r="1.55" /></>);
export const GridGlyph = G(<><rect x="4" y="4" width="16" height="16" rx="1.5" /><path d="M4 9.3h16M4 14.7h16M9.3 4v16M14.7 4v16" /></>);
export const ApparelGlyph = G(<path d="M8 4.5 12 6.2 16 4.5l3.2 3.4-3.2 1.3V20H8V9.2L4.8 7.9 8 4.5Z" />);
export const PaperGlyph = G(<><path d="M7 3.5h7.2L18.5 8v12.5H7z" /><path d="M14.2 3.5V8H18.5" /><path d="M10 12h6M10 15.5h4.5" /></>);
