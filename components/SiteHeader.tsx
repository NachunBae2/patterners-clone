"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, X } from "./icons";
import { LangButton } from "./LangButton";
import { Wordmark } from "./Wordmark";

const navLink =
  "inline-flex h-9 items-center rounded-[8px] px-x3 text-[0.875rem] transition-colors duration-color-transition hover:text-fg-neutral font-medium text-fg-neutral-muted";

const services = [
  { href: "/features/crochet", label: "코바늘", desc: "기호를 놓아 원형·평면 도안을 그려요" },
  { href: "/features/knitting", label: "대바늘", desc: "칸을 채워 대바늘 차트를 만들어요" },
  { href: "/features/grid", label: "배색·방안", desc: "글자·이미지를 배색 도안으로 바꿔요" },
  { href: "/features/apparel", label: "의류 (beta)", desc: "치수를 넣으면 뜨개옷 패턴이 나와요" },
  { href: "/features/paper", label: "페이퍼", desc: "차트를 넣어 도안 문서를 꾸며요" },
];

const links = [
  { href: "/features/atelier", label: "아뜰리에 (beta)" },
  { href: "/blog", label: "블로그" },
  { href: "/plans", label: "이용요금" },
  { href: "/contact/sales", label: "문의하기" },
];

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const servicesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!servicesOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!servicesRef.current?.contains(e.target as Node)) setServicesOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setServicesOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [servicesOpen]);

  return (
    <header
      className="sticky top-0 z-40 landing lp-header px-x3 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)] sm:pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] md:px-x5"
      data-scrolled={scrolled}
    >
      <div className="flex items-center gap-x3 lp-header-bar relative mx-auto h-14 max-w-[1160px] pr-x2 pl-[11px] md:gap-x6 md:pl-[19px]">
        <a className="flex min-w-0 shrink-0 items-center transition-opacity hover:opacity-80" aria-label="PATTERNERS" href="/">
          <Wordmark className="max-w-32 sm:max-w-none h-6 sm:h-7" />
        </a>

        <nav className="hidden min-w-0 flex-1 items-center md:flex gap-x1">
          <div className="relative" ref={servicesRef}>
            <button
              type="button"
              aria-expanded={servicesOpen}
              aria-controls="services-menu"
              onClick={() => setServicesOpen((v) => !v)}
              className={`${navLink} gap-x1`}
            >
              서비스
              <ChevronDown className={`size-3.5 transition-transform ${servicesOpen ? "rotate-180" : ""}`} />
            </button>
            {servicesOpen && (
              <div id="services-menu" className="lp-menu-panel absolute top-full left-0 mt-x2 w-[320px] p-x2">
                <ul className="flex flex-col">
                  {services.map((s) => (
                    <li key={s.href}>
                      <a
                        href={s.href}
                        className="flex flex-col gap-0.5 rounded-[10px] px-x3 py-x2_5 transition-colors hover:bg-bg-layer-fill"
                      >
                        <span className="text-[0.9375rem] font-semibold text-fg-neutral">{s.label}</span>
                        <span className="text-[0.8125rem] text-fg-neutral-muted">{s.desc}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {links.map((l) => (
            <a key={l.href} className={navLink} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-x1_5 sm:gap-x3">
          <LangButton className="hidden md:inline-flex" />
          <a className={`${navLink.replace("inline-flex ", "")} hidden md:inline-flex`} href="/home">
            회원가입
          </a>
          <a className="lp-btn lp-btn-sm lp-btn-primary" href="/home">
            시작하기
          </a>
          <button
            className="seed-action-button seed-action-button--variant_ghost seed-action-button--size_small seed-action-button--layout_withText seed-action-button--size_small-layout_withText seed-scale-feedback shrink-0 touch-manipulation select-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 px-0 md:hidden size-11"
            data-variant="ghost"
            data-size="icon"
            type="button"
            aria-label="메뉴"
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X /> : <Menu />}
          </button>
        </div>

        {mobileOpen && (
          <div id="mobile-menu" className="lp-menu-panel absolute top-[calc(100%+8px)] inset-x-0 p-x3 md:hidden">
            <p className="px-x3 pt-x1 pb-x2 text-[0.75rem] font-semibold text-fg-neutral-subtle">서비스</p>
            <ul className="flex flex-col">
              {services.map((s) => (
                <li key={s.href}>
                  <a href={s.href} className="flex h-11 items-center rounded-[10px] px-x3 text-[0.9375rem] font-medium text-fg-neutral hover:bg-bg-layer-fill">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="my-x2 border-t border-stroke-neutral-muted" />
            <ul className="flex flex-col">
              {[...links, { href: "/home", label: "회원가입" }].map((l) => (
                <li key={l.href}>
                  <a href={l.href} className="flex h-11 items-center rounded-[10px] px-x3 text-[0.9375rem] font-medium text-fg-neutral hover:bg-bg-layer-fill">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </header>
  );
}
