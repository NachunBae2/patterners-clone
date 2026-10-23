"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import "./tour.css";

/* layout-audit-ignore: tiny-text — the coach mark copies the reference's 11px progress chip */

export type TourSide = "top" | "bottom" | "left" | "right";
export type TourStep = {
  id: string;
  /** value of the `data-tour` attribute to spotlight; null = centred card, no spotlight */
  anchor: string | null;
  side?: TourSide;
  title: string;
  body: string;
};

type Rect = { left: number; top: number; width: number; height: number };
type Pos = { left: number; top: number; side: TourSide };

const GAP = 14;
const EDGE = 12;
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** Places the card next to the anchor: preferred side, then its opposite, then the two others. */
function place(anchor: Rect | null, prefer: TourSide, card: { width: number; height: number }, vw: number, vh: number): Pos {
  const maxL = Math.max(EDGE, vw - card.width - EDGE);
  const maxT = Math.max(EDGE, vh - card.height - EDGE);
  if (!anchor) return { left: clamp((vw - card.width) / 2, EDGE, maxL), top: clamp((vh - card.height) / 2, EDGE, maxT), side: "bottom" };
  const opposite: Record<TourSide, TourSide> = { top: "bottom", bottom: "top", left: "right", right: "left" };
  const cross: TourSide[] = prefer === "top" || prefer === "bottom" ? ["right", "left"] : ["bottom", "top"];
  const order = [...new Set<TourSide>([prefer, opposite[prefer], ...cross])];
  let best: Pos & { over: number } = { left: EDGE, top: EDGE, side: prefer, over: Infinity };
  for (const side of order) {
    let left: number;
    let top: number;
    if (side === "top" || side === "bottom") {
      left = anchor.left + anchor.width / 2 - card.width / 2;
      top = side === "bottom" ? anchor.top + anchor.height + GAP : anchor.top - GAP - card.height;
    } else {
      left = side === "right" ? anchor.left + anchor.width + GAP : anchor.left - GAP - card.width;
      top = anchor.top + anchor.height / 2 - card.height / 2;
    }
    const over =
      Math.max(0, EDGE - left) + Math.max(0, left + card.width + EDGE - vw) + Math.max(0, EDGE - top) + Math.max(0, top + card.height + EDGE - vh);
    if (over < best.over) best = { left: clamp(left, EDGE, maxL), top: clamp(top, EDGE, maxT), side, over };
    if (over === 0) break;
  }
  return { left: best.left, top: best.top, side: best.side };
}

function arrowStyle(side: TourSide, card: Rect, anchor: Rect): CSSProperties {
  const ax = anchor.left + anchor.width / 2;
  const ay = anchor.top + anchor.height / 2;
  const x = clamp(ax - card.left - 6, 18, Math.max(18, card.width - 18));
  const y = clamp(ay - card.top - 6, 18, Math.max(18, card.height - 18));
  if (side === "bottom") return { top: -6, left: x };
  if (side === "top") return { bottom: -6, left: x };
  if (side === "right") return { left: -6, top: y };
  return { right: -6, top: y };
}

const BTN =
  "seed-action-button seed-action-button--size_xsmall seed-action-button--layout_withText seed-action-button--size_xsmall-layout_withText seed-scale-feedback shrink-0 touch-manipulation select-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";
const size = (w: number, h: number) => ({ "--seed-element-width": String(w), "--seed-element-height": String(h) }) as CSSProperties;

/**
 * Coach-mark tour: dimmed page, one white card per step, spotlight ring around the step's anchor.
 * `onClose(true)` when the last step's 완료 is pressed, `onClose(false)` on 건너뛰기 / Escape.
 */
export function SpotlightTour({ open, steps, onClose }: { open: boolean; steps: TourStep[]; onClose: (completed: boolean) => void }) {
  const titleId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const [i, setI] = useState(0);
  const [anchor, setAnchor] = useState<Rect | null>(null);
  const [card, setCard] = useState({ width: 320, height: 180 });
  const [pos, setPos] = useState<Pos | null>(null);
  const step = open ? (steps[Math.min(i, steps.length - 1)] ?? null) : null;
  const last = i >= steps.length - 1;

  useEffect(() => {
    if (!open) setI(0);
  }, [open]);

  // follow the anchor (layout can move while panels open or the window resizes)
  useLayoutEffect(() => {
    if (!step?.anchor) return setAnchor(null);
    const sel = `[data-tour="${step.anchor}"]`;
    let raf = 0;
    const measure = () => {
      const el = document.querySelector(sel);
      const r = el?.getBoundingClientRect();
      const next = r && r.width + r.height > 0 ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
      setAnchor((prev) =>
        prev && next && Math.abs(prev.left - next.left) < 0.5 && Math.abs(prev.top - next.top) < 0.5 && Math.abs(prev.width - next.width) < 0.5 && Math.abs(prev.height - next.height) < 0.5
          ? prev
          : next,
      );
    };
    const loop = () => {
      measure();
      raf = requestAnimationFrame(loop);
    };
    measure();
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [step?.anchor]);

  // card size (visual box, like the reference: the first read happens while the card zooms in)
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const read = () => {
      const r = el.getBoundingClientRect();
      setCard((c) => (Math.abs(c.width - r.width) < 1 && Math.abs(c.height - r.height) < 1 ? c : { width: r.width, height: r.height }));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, step?.id]);

  useLayoutEffect(() => {
    if (!step) return setPos(null);
    const update = () => setPos(place(anchor, step.side ?? "bottom", card, window.innerWidth, window.innerHeight));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [step, anchor, card]);

  useEffect(() => {
    if (step) nextRef.current?.focus();
  }, [step]);

  const close = useCallback((done: boolean) => onClose(done), [onClose]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      close(false);
    };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [open, close]);

  if (!step) return null;
  const ring = anchor ? { top: anchor.top - 6, left: anchor.left - 6, width: anchor.width + 12, height: anchor.height + 12 } : null;

  return (
    <div className="tour-root fixed inset-0 isolate z-250 overflow-hidden">
      {ring ? (
        <>
          <div
            className="tour-ring-70 pointer-events-none absolute rounded-lg ring-2 transition-[top,left,width,height,box-shadow] duration-300 ease-out"
            style={{ ...ring, boxShadow: "0 0 0 9999px oklch(0 0 0 / 0.55)" }}
          />
          <div
            aria-hidden="true"
            className="tour-pulse tour-ring-50 pointer-events-none absolute rounded-xl ring-4 transition-[top,left,width,height] duration-300 ease-out"
            style={{ top: ring.top - 4, left: ring.left - 4, width: ring.width + 8, height: ring.height + 8 }}
          />
        </>
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-black/55" />
      )}
      <div
        ref={cardRef}
        data-spotlight-card="true"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="tour-enter pointer-events-auto absolute z-10 w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl bg-background p-6 text-foreground shadow-[0_12px_40px_oklch(0_0_0/0.22)]"
        style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, transition: "left 300ms ease-out, top 300ms ease-out" }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {anchor && pos && (
          <span aria-hidden="true" className="pointer-events-none absolute size-3 rotate-45 bg-background" style={arrowStyle(pos.side, { ...pos, ...card }, anchor)} />
        )}
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="tour-chip inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium text-foreground tabular-nums">
            {i + 1} / {steps.length}
          </span>
          <button className={`${BTN} seed-action-button--variant_ghost -mr-2 h-7 px-2 text-xs text-muted-foreground`} type="button" style={size(56.25, 28)} onClick={() => close(false)}>
            건너뛰기
          </button>
        </div>
        <h2 id={titleId} className="text-base leading-snug font-semibold tracking-tight">
          {step.title}
        </h2>
        <p className="mt-2 min-h-15 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
        <div className="mt-6 flex min-h-8 items-center justify-end gap-2">
          <button
            className={`${BTN} seed-action-button--variant_ghost`}
            type="button"
            disabled={i === 0}
            data-disabled={i === 0 ? "" : undefined}
            style={size(49.86, 32)}
            onClick={() => setI((n) => Math.max(0, n - 1))}
          >
            이전
          </button>
          <button
            ref={nextRef}
            className={`${BTN} seed-action-button--variant_brandSolid rounded-full px-4`}
            type="button"
            style={size(53.86, 32)}
            onClick={() => (last ? close(true) : setI((n) => n + 1))}
          >
            {last ? "완료" : "다음"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------- seen flags (per browser, versioned like the reference) ----------------

const read = (key: string, version: number) => {
  try {
    const v = Number(window.localStorage.getItem(key));
    return Number.isFinite(v) && v >= version;
  } catch {
    return false;
  }
};
const write = (key: string, version: number) => {
  try {
    window.localStorage.setItem(key, String(version));
  } catch {
    /* storage blocked: the tour simply shows again next time */
  }
};

const HOME_KEY = "patterners.tour.home";
const HOME_VERSION = 1;
const MAKER_VERSION = 3;
const makerKey = (craft: string) => `patterners.tour.maker.${craft}`;

export const tourSeen = {
  home: () => read(HOME_KEY, HOME_VERSION),
  markHome: () => write(HOME_KEY, HOME_VERSION),
  maker: (craft: string) => read(makerKey(craft), MAKER_VERSION),
  markMaker: (craft: string) => write(makerKey(craft), MAKER_VERSION),
};
