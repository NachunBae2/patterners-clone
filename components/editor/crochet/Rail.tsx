"use client";

import Link from "next/link";
import { memo } from "react";
import { cx } from "@/components/app/ui";
import { el, sab } from "./seed";
import { Box, Download, FileUp, LibraryBig, Shapes, Sparkle } from "./uiIcons";

export type NavTab = "symbols" | "library" | "components" | "aiConvert" | "ai";

const TABS: { id: NavTab; label: string; icon: (p: { className?: string }) => React.ReactNode }[] = [
  { id: "symbols", label: "기호", icon: Shapes },
  { id: "library", label: "템플릿", icon: LibraryBig },
  { id: "components", label: "내 기호", icon: Box },
  { id: "aiConvert", label: "원문·파일로 만들기", icon: FileUp },
  { id: "ai", label: "AI 어시스턴트", icon: Sparkle },
];

/** The "P" mark standing in for the logo image (32 × 32): bold slanted P with a top bar. */
function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="1.2 0 32 32" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        fill="#2b2b2b"
        d="M7.4 6H21.6C25.6 6 27.5 8.4 26.8 11.8C26.1 15.4 23.1 17.6 18.7 17.6H14.6L12.9 26H8.3L11.4 10.4H6.5ZM15.9 10.4L15.4 13.5H18.4C20.2 13.5 21.7 12.8 22 11.8C22.3 10.8 21.5 10.4 20 10.4Z"
      />
    </svg>
  );
}

/** Far-left icon rail: logo → home, panel tabs, export at the bottom. */
export const Rail = memo(function Rail({ tab, open, onTab, onExport }: { tab: NavTab; open: boolean; onTab: (t: NavTab) => void; onExport: () => void }) {
  return (
    <nav aria-label="편집 메뉴" data-maker-rail="true" className="relative z-[90] flex h-full w-14 shrink-0 flex-col items-center overflow-hidden border-r border-stroke-neutral-muted bg-bg-layer-default px-x1 py-x2 transition-[width,opacity] duration-200">
      <Link
        href="/home"
        aria-label="PATTERNERS"
        title="내 도안으로"
        className="mb-x3 flex size-x9 items-center justify-center rounded-r2 text-fg-neutral hover:bg-bg-layer-default-pressed focus-visible:outline-2 focus-visible:outline-stroke-focus-ring"
      >
        <LogoMark className="size-8 rounded-md" />
      </Link>
      <div className="flex flex-col items-center gap-x1" data-tour="nav-tabs">
        {TABS.map((t) => {
          const active = open && tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              aria-label={t.label}
              title={t.label}
              aria-pressed={active}
              data-maker-nav={t.id}
              onClick={() => onTab(t.id)}
              className={cx(sab(active ? "brandSolid" : "ghost", "small", "iconOnly"), !active && "text-fg-neutral-muted")}
              style={el(36, 36)}
            >
              <t.icon className="seed-icon" />
            </button>
          );
        })}
      </div>
      <div className="mt-auto flex flex-col items-center gap-x1 pb-x2">
        <div className="mb-x1 h-px w-7 bg-stroke-neutral-muted" />
        <button
          type="button"
          data-tour="export"
          aria-label="내보내기"
          title="내보내기"
          aria-haspopup="dialog"
          onClick={onExport}
          className={cx(sab("ghost", "small", "iconOnly"), "text-fg-neutral-muted")}
          style={el(36, 36)}
        >
          <Download className="seed-icon" />
        </button>
      </div>
    </nav>
  );
});
