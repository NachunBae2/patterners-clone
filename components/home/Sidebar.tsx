"use client";

import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { Wordmark } from "@/components/Wordmark";
import {
  ApparelGlyph,
  CardIcon,
  ChatIcon,
  CrochetGlyph,
  FilesIcon,
  GridGlyph,
  HelpIcon,
  KnittingGlyph,
  LogOutIcon,
  MegaphoneIcon,
  MessageSquareIcon,
  PaperGlyph,
  SettingsIcon,
  StoreIcon,
  TrashIcon,
} from "./icons";

export type HomeView = "all" | "crochet" | "knitting" | "grid" | "apparel" | "papers" | "trash";

const PREFIX = "seed-side-navigation-menu-item__prefixIcon";

type IconC = ComponentType<{ className?: string; "data-current"?: string; "data-side-navigation-state"?: string }>;

export const NAV: { id: HomeView; label: string; Icon: IconC; cls: string; ready: boolean }[] = [
  { id: "all", label: "모든 파일", Icon: FilesIcon, cls: PREFIX, ready: true },
  { id: "crochet", label: "코바늘 도안", Icon: CrochetGlyph, cls: `size-4 ${PREFIX}`, ready: true },
  { id: "knitting", label: "대바늘 도안", Icon: KnittingGlyph, cls: `size-4 ${PREFIX}`, ready: true },
  { id: "grid", label: "배색·방안 도안", Icon: GridGlyph, cls: `size-4 ${PREFIX}`, ready: true },
  { id: "apparel", label: "의류 도안 (beta)", Icon: ApparelGlyph, cls: `size-4 ${PREFIX}`, ready: false },
  { id: "papers", label: "페이퍼", Icon: PaperGlyph, cls: `size-4 ${PREFIX}`, ready: false },
  { id: "trash", label: "휴지통", Icon: TrashIcon, cls: PREFIX, ready: true },
];

const FOOTER: { label: string; icon: ReactNode; dot?: boolean }[] = [
  { label: "아뜰리에 (beta)", icon: <StoreIcon className={PREFIX} /> },
  { label: "사용방법 보기", icon: <HelpIcon className={PREFIX} /> },
  { label: "기능 물어보기", icon: <ChatIcon className={PREFIX} /> },
  { label: "공지사항", icon: <MegaphoneIcon />, dot: true },
  { label: "문의하기", icon: <MessageSquareIcon className={PREFIX} /> },
  { label: "플랜 구매", icon: <CardIcon className={PREFIX} /> },
  { label: "계정 설정", icon: <SettingsIcon className={PREFIX} /> },
  { label: "로그아웃", icon: <LogOutIcon className={PREFIX} /> },
];

/** Left navigation of the works home (SEED side-navigation markup, 240px). */
export function HomeSidebar({
  view,
  onView,
  onSoon,
  onTour,
  className,
}: {
  view: HomeView;
  onView: (v: HomeView) => void;
  onSoon: () => void;
  /** "사용방법 보기" reopens the home tour */
  onTour?: () => void;
  className?: string;
}) {
  return (
    <nav data-side-navigation-state="expanded" className={`seed-side-navigation__root seed-side-navigation__root--tone_neutral ${className ?? ""}`}>
      <div data-side-navigation-state="expanded" className="seed-side-navigation__header seed-side-navigation__header--tone_neutral flex flex-col px-x4 pt-x5 pb-x2">
        <Link
          href="/"
          aria-label="PATTERNERS"
          className="flex w-fit items-center rounded-r1 text-fg-neutral outline-none focus-visible:ring-2 focus-visible:ring-stroke-neutral-contrast"
        >
          <Wordmark className="h-7" />
        </Link>
        <div className="mt-x3 flex flex-wrap items-center gap-x2">
          <span className="seed-badge__root seed-badge__root--size_medium seed-badge__root--variant_weak seed-badge__root--tone_brand seed-badge__root--tone_brand-variant_weak">
            <span className="seed-badge__label seed-badge__label--size_medium seed-badge__label--variant_weak seed-badge__label--tone_brand seed-badge__label--tone_brand-variant_weak">
              Pro
            </span>
          </span>
          <p className="t1-regular break-keep text-fg-neutral-muted">Pro 체험 중 · D-31</p>
        </div>
      </div>
      <div className="seed-side-navigation__content seed-side-navigation__content--tone_neutral" data-side-navigation-state="expanded">
        <div data-side-navigation-state="expanded" className="seed-side-navigation__group seed-side-navigation__group--tone_neutral">
          <div data-side-navigation-state="expanded" className="seed-side-navigation__groupLabel seed-side-navigation__groupLabel--tone_neutral">
            도안
          </div>
          {NAV.map((n) => {
            const current = view === n.id;
            return (
              <a
                key={n.id}
                href={`/home?tab=${n.id}`}
                className="seed-side-navigation-menu-item__root"
                data-tour={n.id === "trash" ? "home-trash" : undefined}
                data-side-navigation-state="expanded"
                data-current={current ? "" : undefined}
                aria-current={current ? "page" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  if (n.ready) onView(n.id);
                  else onSoon();
                }}
              >
                <n.Icon className={n.cls} data-side-navigation-state="expanded" data-current={current ? "" : undefined} />
                <span data-side-navigation-state="expanded" data-current={current ? "" : undefined} className="seed-side-navigation-menu-item__label">
                  {n.label}
                </span>
              </a>
            );
          })}
        </div>
      </div>
      <div data-side-navigation-state="expanded" data-home-nav-compact="" className="seed-side-navigation__footer seed-side-navigation__footer--tone_neutral">
        {FOOTER.map((f) => (
          <button
            key={f.label}
            type="button"
            className="seed-side-navigation-menu-item__root"
            data-side-navigation-state="expanded"
            aria-label={f.dot ? `${f.label} · 새 공지` : undefined}
            onClick={f.label === "사용방법 보기" && onTour ? onTour : onSoon}
          >
            {f.dot ? (
              <span aria-hidden="true" data-side-navigation-state="expanded" className={`[&>svg]:size-full ${PREFIX}`}>
                {f.icon}
                <span className="absolute -top-px -left-px size-x1_5 rounded-full bg-bg-critical-solid" aria-hidden="true" />
              </span>
            ) : (
              f.icon
            )}
            <span data-side-navigation-state="expanded" className="seed-side-navigation-menu-item__label">
              {f.label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
}
