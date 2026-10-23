"use client";

import { useEffect, useRef } from "react";
import { ArtKnitChart, ArtMotif, ArtSnowflakeChart } from "./art";

type PieceStyle = React.CSSProperties & Record<`--${string}`, string>;
const piece = (tilt: string, depth: string, float: string, delay: string): PieceStyle => ({
  "--tilt": tilt,
  "--depth": depth,
  "--float": float,
  "--delay": delay,
});
const card = "rounded-[10px] border border-stroke-neutral-weak bg-bg-layer-default p-[7%] shadow-s2";

export function Hero() {
  const ref = useRef<HTMLElement>(null);

  // Pointer parallax: pieces shift by --px/--py × their --depth.
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--px", ((e.clientX / window.innerWidth) * 2 - 1).toFixed(3));
        el.style.setProperty("--py", ((e.clientY / window.innerHeight) * 2 - 1).toFixed(3));
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <section
      ref={ref}
      className="relative flex min-h-[max(560px,calc(100svh-64px))] flex-col overflow-hidden [--lift:max(0px,calc((100svh-64px-410px)/2))] sm:min-h-[max(560px,calc(100svh-68px))] sm:[--lift:max(0px,calc((100svh-68px-520px)/2))] lg:min-h-[max(640px,calc(100svh-68px))] lg:[--lift:0px]"
    >
      <div className="lp-floor absolute inset-x-[-30%] bottom-0 h-[52%]" aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 bottom-[var(--lift)]">
        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-full max-w-[1360px] -translate-x-1/2" aria-hidden="true">
          <div
            className="lp-piece bottom-[100px] left-[34%] z-10 w-[28%] sm:left-[39%] sm:w-[20%] lg:top-[10%] lg:bottom-auto lg:left-[8%] lg:z-auto lg:w-[17%]"
            style={piece("-8deg", "-22", "7s", "0s")}
          >
            <div className={card}>
              <ArtMotif />
            </div>
          </div>
          <div
            className="lp-piece bottom-[40px] left-[2%] w-[37%] sm:left-[12%] sm:w-[26%] lg:bottom-[10%] lg:left-[14%] lg:w-[16%]"
            style={piece("7deg", "-30", "8.5s", "-1.3s")}
          >
            <div className={card}>
              <ArtSnowflakeChart />
            </div>
          </div>
          <div className="lp-piece hidden lg:block lg:top-[46%] lg:left-[0%] lg:w-[13%]" style={piece("-5deg", "-40", "10s", "-2.6s")}>
            <div className={card}>
              <ArtKnitChart />
            </div>
          </div>
          <div
            className="lp-piece right-[2%] bottom-[36px] w-[41%] sm:right-[10%] sm:w-[28%] lg:top-[11%] lg:right-[9%] lg:bottom-auto lg:w-[17%]"
            style={piece("8deg", "-14", "7s", "-3.9s")}
          >
            <img alt="" width={580} height={421} className="h-auto w-full" src="/landing/swatch-star.svg" />
          </div>
          <div className="lp-piece hidden lg:block lg:top-[44%] lg:right-[2%] lg:w-[12%]" style={piece("-7deg", "-34", "8.5s", "-5.2s")}>
            <img alt="" width={580} height={648} className="h-auto w-full" src="/landing/swatch-cable.svg" />
          </div>
          <div className="lp-piece hidden lg:block lg:right-[14%] lg:bottom-[9%] lg:w-[14.5%]" style={piece("12deg", "-18", "10s", "-6.5s")}>
            <img alt="" width={580} height={452} loading="lazy" className="h-auto w-full" src="/landing/swatch-checks.svg" />
          </div>
        </div>
      </div>
      <div className="page-shell relative flex flex-1 flex-col items-center justify-end pt-x10 pb-[calc(15rem+var(--lift))] text-center sm:pt-x16 sm:pb-[calc(20rem+var(--lift))] lg:justify-center lg:py-32">
        <h1 className="lp-display max-w-[14em]">{"뜨개 도안 제작은\n패터너스로 시작하세요"}</h1>
        <div className="mt-x8 flex flex-wrap justify-center gap-x2">
          <a className="lp-btn lp-btn-primary" href="/home">
            무료로 시작하기
          </a>
          <a href="#landing-features" className="lp-btn lp-btn-secondary bg-bg-layer-default">
            기능 둘러보기
          </a>
        </div>
      </div>
    </section>
  );
}
