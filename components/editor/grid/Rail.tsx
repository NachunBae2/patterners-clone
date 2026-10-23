"use client";

// Far-left icon rail: logo, panel tabs, and atelier / share / export.
import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/components/app/ui";
import { ab, el } from "./fields";
import { BrandMark, LDownload, LPalette, LRotate3d, LShare2, LStore, MakeIcon } from "./icons";

export type RailTab = "yarns" | "make";

function RailButton(p: { label: string; active?: boolean; onClick: () => void; children: ReactNode; pressed?: boolean }) {
  return (
    <button
      type="button"
      aria-label={p.label}
      title={p.label}
      aria-pressed={p.pressed}
      onClick={p.onClick}
      className={cx(ab(p.active ? "brandSolid" : "ghost", "small", "iconOnly"), !p.active && "text-fg-neutral-muted")}
      style={el(36, 36)}
    >
      {p.children}
    </button>
  );
}

export function Rail(p: {
  tab: RailTab | null;
  onTab: (t: RailTab) => void;
  onPreview: () => void;
  onAtelier: () => void;
  onShare: () => void;
  onExport: () => void;
}) {
  return (
    <nav aria-label="도안 메뉴" className="relative z-[90] flex h-full w-14 shrink-0 flex-col items-center border-r border-stroke-neutral-muted bg-bg-layer-default px-x1 py-x2">
      <Link
        href="/home"
        aria-label="PATTERNERS"
        className="mb-x3 flex size-x9 items-center justify-center rounded-r2 text-fg-neutral hover:bg-bg-layer-default-pressed focus-visible:outline-2 focus-visible:outline-stroke-focus-ring"
      >
        <BrandMark className="size-8 overflow-hidden rounded-md" />
      </Link>
      <div className="flex flex-col items-center gap-x1">
        <RailButton label="실" active={p.tab === "yarns"} pressed={p.tab === "yarns"} onClick={() => p.onTab("yarns")}>
          <LPalette className="seed-icon" />
        </RailButton>
        <RailButton label="글자·이미지로 만들기" active={p.tab === "make"} pressed={p.tab === "make"} onClick={() => p.onTab("make")}>
          <MakeIcon className="seed-icon" />
        </RailButton>
        <span className="inline-flex">
          <span className="relative">
            <RailButton label="뜬 모습 미리보기" pressed={false} onClick={p.onPreview}>
              <LRotate3d className="seed-icon" />
            </RailButton>
            <span className="t1-bold pointer-events-none absolute -right-1 -top-1 rounded-r1 bg-bg-brand-weak px-x1 text-fg-brand">β</span>
          </span>
        </span>
      </div>
      <div className="mt-auto flex flex-col items-center gap-x1 pb-x2">
        <div className="mb-x1 h-px w-7 bg-stroke-neutral-muted" />
        <RailButton label="아뜰리에에 올리기" onClick={p.onAtelier}>
          <LStore className="seed-icon" />
        </RailButton>
        <RailButton label="공유하기" onClick={p.onShare}>
          <LShare2 className="seed-icon" />
        </RailButton>
        <RailButton label="내보내기" onClick={p.onExport}>
          <LDownload className="seed-icon" />
        </RailButton>
      </div>
    </nav>
  );
}
