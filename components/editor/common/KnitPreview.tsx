"use client";

// "Knitted look" preview shared by the knitting editor (실체화 β) and the colour-chart editor (뜬 모습 미리보기).
// Each chart cell becomes a drawn stitch: knit V loops, purl bumps, yarn-over holes, bobbles,
// leaning decreases and simple one-row cable crossings, shaded so the fabric reads a little 3D.
// Pure canvas 2D, no network: stitch sprites are painted once per colour and size, then stamped.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cx } from "@/components/app/ui";

/* layout-audit-ignore: tiny-text — preview window chrome uses the editors' 11–12px control type */

export type PStitch =
  | { k: "knit" | "purl" | "yo" | "bobble" | "slip" | "twist"; color: string }
  | { k: "lean"; dir: -1 | 0 | 1; color: string }
  /** a cable sits on its left-most cell; `a` stitches start on the left and travel right, `b` start on the right, `c` stay in the middle */
  | { k: "cable"; a: number; b: number; c: number; leftOver: boolean; purlBg: boolean; colors: string[] }
  | { k: "none" }
  /** cell covered by a wide stitch to its left */
  | { k: "covered" };

/** row-major, row 0 is the TOP row */
export type PChart = { cols: number; rows: number; cells: PStitch[] };

// ---------------- colour helpers ----------------

function rgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [200, 196, 188];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** mixes towards white (amt > 0) or black (amt < 0) */
function shade(hex: string, amt: number) {
  const [r, g, b] = rgb(hex);
  const t = amt < 0 ? 0 : 255;
  const k = Math.abs(amt);
  const f = (v: number) => Math.round(v + (t - v) * k);
  return `rgb(${f(r)}, ${f(g)}, ${f(b)})`;
}

// ---------------- the side seen from the back ----------------

/** The wrong side: columns mirror, knit ↔ purl, cables and twisted stitches read as purl bumps. */
export function wrongSide(ch: PChart): PChart {
  const cells: PStitch[] = Array(ch.cols * ch.rows).fill({ k: "none" });
  for (let r = 0; r < ch.rows; r++)
    for (let c = 0; c < ch.cols; c++) {
      const s = ch.cells[r * ch.cols + c];
      const at = r * ch.cols + (ch.cols - 1 - c);
      if (s.k === "cable") {
        const w = s.a + s.b + s.c;
        for (let k = 0; k < w && c + k < ch.cols; k++) cells[r * ch.cols + (ch.cols - 1 - c - k)] = { k: "purl", color: s.colors[k] ?? s.colors[0] };
        continue;
      }
      if (s.k === "covered") {
        // filled by the owner above when it is a cable; otherwise keep whatever the owner wrote
        continue;
      }
      if (s.k === "knit" || s.k === "twist" || s.k === "slip" || s.k === "bobble") cells[at] = { k: "purl", color: s.color };
      else if (s.k === "purl") cells[at] = { k: "knit", color: s.color };
      else if (s.k === "lean") cells[at] = { k: "purl", color: s.color };
      else cells[at] = s;
    }
  return { ...ch, cells };
}

function repeatChart(ch: PChart, rx: number, ry: number): PChart {
  if (rx === 1 && ry === 1) return ch;
  const cols = ch.cols * rx;
  const rows = ch.rows * ry;
  const cells: PStitch[] = Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells[r * cols + c] = ch.cells[(r % ch.rows) * ch.cols + (c % ch.cols)];
  return { cols, rows, cells };
}

// ---------------- sprites ----------------

type Sprite = { cv: HTMLCanvasElement; ox: number; oy: number };
type Kind = "knit" | "purl" | "yo" | "bobble" | "slip" | "twist" | "leanL" | "leanR" | "leanC";

/** a yarn leg: a shaded leaf from (x1,y1) to (x2,y2) */
function leg(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, wid: number, color: string, depth: boolean) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ang = Math.atan2(y2 - y1, x2 - x1);
  ctx.save();
  ctx.translate((x1 + x2) / 2, (y1 + y2) / 2);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.ellipse(0, 0, len / 2, wid / 2, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  if (depth) {
    // round cross-section: dark rims, a soft highlight just above the centre line
    const g = ctx.createLinearGradient(0, -wid / 2, 0, wid / 2);
    g.addColorStop(0, "rgba(0,0,0,0.38)");
    g.addColorStop(0.3, "rgba(255,255,255,0.16)");
    g.addColorStop(0.55, "rgba(255,255,255,0.04)");
    g.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.fillStyle = g;
    ctx.fill();
    // plied twist
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = "rgba(0,0,0,0.13)";
    ctx.lineWidth = Math.max(0.5, wid * 0.08);
    const step = Math.max(2, wid * 0.55);
    ctx.beginPath();
    for (let x = -len / 2 - wid; x < len / 2 + wid; x += step) {
      ctx.moveTo(x, -wid / 2);
      ctx.lineTo(x + wid * 0.7, wid / 2);
    }
    ctx.stroke();
    ctx.restore();
  }
  ctx.strokeStyle = shade(color, -0.45);
  ctx.lineWidth = Math.max(0.5, wid * 0.05);
  ctx.beginPath();
  ctx.ellipse(0, 0, len / 2, wid / 2, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function bump(ctx: CanvasRenderingContext2D, cx0: number, cy0: number, rx: number, ry: number, color: string, depth: boolean) {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx0, cy0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  if (depth) {
    const g = ctx.createLinearGradient(0, cy0 - ry, 0, cy0 + ry);
    g.addColorStop(0, "rgba(255,255,255,0.22)");
    g.addColorStop(0.45, "rgba(255,255,255,0.05)");
    g.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.clip();
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.lineWidth = Math.max(0.5, ry * 0.12);
    ctx.beginPath();
    for (let x = cx0 - rx - ry; x < cx0 + rx + ry; x += Math.max(2, ry * 0.8)) {
      ctx.moveTo(x, cy0 - ry);
      ctx.lineTo(x + ry * 0.9, cy0 + ry);
    }
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = shade(color, -0.45);
  ctx.lineWidth = Math.max(0.5, ry * 0.08);
  ctx.beginPath();
  ctx.ellipse(cx0, cy0, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
}

/** the V of one knit stitch in cell coords (0..cw × 0..ch, legs reach past the cell top and bottom) */
function drawV(ctx: CanvasRenderingContext2D, cw: number, ch: number, color: string, depth: boolean, o: { tall?: number; cross?: boolean } = {}) {
  const top = -ch * (0.42 + (o.tall ?? 0));
  const bot = ch * 1.04;
  const wid = cw * 0.44;
  const xc = cw / 2;
  const tip = o.cross ? cw * 0.12 : 0;
  leg(ctx, cw * 0.9, top, xc - tip, bot, wid, color, depth);
  leg(ctx, cw * 0.1, top, xc + tip, bot, wid, color, depth);
}

function paintSprite(kind: Kind, color: string, cw: number, ch: number, depth: boolean): Sprite {
  const ox = Math.ceil(cw * 0.35);
  const oy = Math.ceil(ch * 1.1);
  const cv = document.createElement("canvas");
  cv.width = Math.ceil(cw + ox * 2);
  cv.height = Math.ceil(ch + oy + ch * 0.4);
  const ctx = cv.getContext("2d")!;
  ctx.translate(ox, oy);
  switch (kind) {
    case "knit":
      drawV(ctx, cw, ch, color, depth);
      break;
    case "slip":
      drawV(ctx, cw * 0.86, ch, color, depth, { tall: 0.55 });
      break;
    case "twist":
      drawV(ctx, cw, ch, color, depth, { cross: true });
      break;
    case "purl":
      bump(ctx, cw / 2, ch * 0.5, cw * 0.56, ch * 0.4, color, depth);
      break;
    case "yo": {
      ctx.fillStyle = "rgba(20,16,12,0.5)";
      ctx.beginPath();
      ctx.ellipse(cw / 2, ch / 2, cw * 0.3, ch * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, cw * 0.16);
      ctx.stroke();
      if (depth) {
        ctx.strokeStyle = "rgba(0,0,0,0.3)";
        ctx.lineWidth = Math.max(0.5, cw * 0.04);
        ctx.beginPath();
        ctx.ellipse(cw / 2, ch / 2, cw * 0.38, ch * 0.46, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }
    case "bobble": {
      drawV(ctx, cw, ch, color, depth);
      const r = Math.min(cw * 0.62, ch * 0.78);
      ctx.beginPath();
      ctx.arc(cw / 2, ch * 0.45, r, 0, Math.PI * 2);
      if (depth) {
        const g = ctx.createRadialGradient(cw / 2 - r * 0.35, ch * 0.45 - r * 0.4, r * 0.1, cw / 2, ch * 0.45, r);
        g.addColorStop(0, shade(color, 0.35));
        g.addColorStop(0.6, color);
        g.addColorStop(1, shade(color, -0.4));
        ctx.fillStyle = g;
      } else ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = shade(color, -0.5);
      ctx.lineWidth = Math.max(0.5, r * 0.06);
      ctx.stroke();
      break;
    }
    case "leanL":
    case "leanR":
    case "leanC": {
      // the stitch underneath peeks out on the far side, the top stitch leans over it
      const dir = kind === "leanL" ? -1 : kind === "leanR" ? 1 : 0;
      ctx.save();
      ctx.filter = "brightness(0.72)";
      ctx.translate(-dir * cw * 0.22, 0);
      drawV(ctx, cw, ch, color, depth);
      if (dir === 0) {
        ctx.translate(cw * 0.44, 0);
        drawV(ctx, cw, ch, color, depth);
      }
      ctx.restore();
      ctx.save();
      ctx.translate(cw / 2, ch);
      ctx.rotate((dir * Math.PI) / 11);
      ctx.translate(-cw / 2, -ch);
      drawV(ctx, cw, ch, color, depth, { tall: 0.1 });
      ctx.restore();
      break;
    }
  }
  return { cv, ox, oy };
}

// ---------------- the full fabric ----------------

const BACKDROP = "#e7e4de";

/**
 * Paints the fabric into `cv` with cells cw × ch (CSS px) at device ratio `dpr`.
 * Rows are painted bottom-up so each stitch's legs lie over the head of the stitch below.
 */
export function paintFabric(cv: HTMLCanvasElement, ch0: PChart, cw: number, chh: number, dpr: number, depth: boolean) {
  const pad = Math.round(Math.max(cw, chh) * 1.2);
  const W = ch0.cols * cw + pad * 2;
  const H = ch0.rows * chh + pad * 2;
  cv.width = Math.max(1, Math.round(W * dpr));
  cv.height = Math.max(1, Math.round(H * dpr));
  cv.style.width = `${W}px`;
  cv.style.height = `${H}px`;
  const ctx = cv.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = BACKDROP;
  ctx.fillRect(0, 0, W, H);
  // fabric shadow
  if (depth) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.22)";
    ctx.shadowBlur = pad * 0.5;
    ctx.shadowOffsetY = pad * 0.15;
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(pad + cw * 0.1, pad, ch0.cols * cw - cw * 0.2, ch0.rows * chh);
    ctx.restore();
    ctx.fillStyle = BACKDROP;
    ctx.fillRect(pad + cw * 0.1, pad, ch0.cols * cw - cw * 0.2, ch0.rows * chh);
  }
  const sprites = new Map<string, Sprite>();
  const sprite = (kind: Kind, color: string) => {
    const key = `${kind}|${color}`;
    let s = sprites.get(key);
    if (!s) {
      s = paintSprite(kind, color, cw * dpr, chh * dpr, depth);
      sprites.set(key, s);
    }
    return s;
  };
  const stamp = (kind: Kind, color: string, x: number, y: number) => {
    const s = sprite(kind, color);
    ctx.drawImage(s.cv, x - s.ox / dpr, y - s.oy / dpr, s.cv.width / dpr, s.cv.height / dpr);
  };
  /**
   * A travelling cable stitch: a V whose point sits over column x0 (cell left edge, px) at the bottom of the row
   * and whose arms reach column x1 above it. Under strands are darkened, over strands cast a soft shadow.
   */
  const strand = (color: string, x0: number, x1: number, y: number, over: boolean) => {
    const xb = x0 + cw / 2;
    const xt = x1 + cw / 2;
    const yb = y + chh * 1.05;
    const yt = y - chh * 0.75;
    ctx.save();
    if (over) {
      ctx.shadowColor = "rgba(0,0,0,0.4)";
      ctx.shadowBlur = cw * 0.35;
      ctx.shadowOffsetY = Math.max(1, chh * 0.06);
    } else ctx.filter = "brightness(0.68)";
    const wid = cw * 0.44;
    leg(ctx, xt + cw * 0.38, yt, xb + cw * 0.02, yb, wid, color, depth);
    leg(ctx, xt - cw * 0.38, yt, xb - cw * 0.02, yb, wid, color, depth);
    ctx.restore();
  };

  for (let r = ch0.rows - 1; r >= 0; r--) {
    const y = pad + r * chh;
    const cables: { c: number; s: Extract<PStitch, { k: "cable" }> }[] = [];
    for (let c = 0; c < ch0.cols; c++) {
      const s = ch0.cells[r * ch0.cols + c];
      const x = pad + c * cw;
      switch (s.k) {
        case "none":
        case "covered":
          break;
        case "cable": {
          cables.push({ c, s });
          // ground under the crossing: purl bumps on a purl background, centre stitches as they are worked
          const w = s.a + s.b + s.c;
          for (let k = 0; k < w && c + k < ch0.cols; k++) {
            const mid = k >= s.a && k < s.a + s.c;
            if (s.purlBg && !mid) stamp("purl", s.colors[k] ?? s.colors[0], x + k * cw, y);
            if (mid) stamp("knit", s.colors[k] ?? s.colors[0], x + k * cw, y);
          }
          break;
        }
        case "lean":
          stamp(s.dir < 0 ? "leanL" : s.dir > 0 ? "leanR" : "leanC", s.color, x, y);
          break;
        case "purl":
          // purl bumps sit staggered row to row
          stamp("purl", s.color, x + (r % 2 ? 0.16 : -0.16) * cw, y);
          break;
        default:
          stamp(s.k, s.color, x, y);
      }
    }
    // crossings go on top of their row
    for (const { c, s } of cables) {
      const xs = (i: number) => pad + (c + i) * cw;
      const left = Array.from({ length: s.a }, (_, i) => ({ from: i, to: s.b + s.c + i }));
      const right = Array.from({ length: s.b }, (_, j) => ({ from: s.a + s.c + j, to: j }));
      const under = s.leftOver ? right : left;
      const over = s.leftOver ? left : right;
      for (const m of under) strand(s.colors[m.from] ?? s.colors[0], xs(m.from), xs(m.to), y, false);
      for (const m of over) strand(s.colors[m.from] ?? s.colors[0], xs(m.from), xs(m.to), y, true);
    }
  }
  return { W, H };
}

// ---------------- window ----------------

type WinSize = "float" | "half" | "full";
const ZOOMS = [0.25, 0.35, 0.5, 0.7, 1, 1.4, 2, 2.8, 4];
/** "fit" treats charts shorter than this as this tall (the knitting editor's new-grid height) */
const FIT_MIN_ROWS = 20;

function Icon({ d, className }: { d: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cx("size-4 shrink-0", className)} aria-hidden="true">
      {d}
    </svg>
  );
}

function SmallSeg<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex items-center gap-x1_5">
      <span className="text-[11px] text-fg-neutral-muted">{label}</span>
      <div className="flex gap-0.5 rounded-r1_5 bg-bg-layer-fill p-0.5" role="radiogroup" aria-label={label}>
        {options.map(([v, l]) => (
          <button
            key={String(v)}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(v)}
            className={cx("h-6 min-w-8 rounded-r1 px-x1_5 text-[11px] font-medium", value === v ? "bg-bg-layer-default text-fg-neutral shadow-s1" : "text-fg-neutral-muted hover:text-fg-neutral")}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

export type KnitPreviewProps = {
  /** window title, e.g. "실체화" or "뜬 모습 미리보기" */
  title: string;
  beta?: boolean;
  chart: PChart | null;
  /** caption under the title (grid name, page name…) */
  subtitle?: string;
  emptyTitle: string;
  emptyHint: string;
  gauge?: { sts: number; rows: number };
  /** symbols drawn only approximately (listed as a note) */
  approx?: string[];
  /** default yarn for cells without a colour; when given, the window offers a yarn colour picker */
  yarn?: { value: string; onChange: (c: string) => void };
  fileName: string;
  onClose: () => void;
  closeLabel?: string;
};

/** Floating "knitted look" window; sits absolutely inside the editor's canvas area. */
export function KnitPreviewWindow(p: KnitPreviewProps) {
  const [size, setSize] = useState<WinSize>("float");
  const [face, setFace] = useState<"rs" | "ws">("rs");
  const [depth, setDepth] = useState<"2d" | "3d">("3d");
  const [rep, setRep] = useState({ x: 1, y: 1 });
  const [zoom, setZoom] = useState<number | null>(null); // null = fit
  const [box, setBox] = useState({ w: 0, h: 0 });
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const chart = useMemo(() => {
    if (!p.chart || !p.chart.cols || !p.chart.rows) return null;
    const c = face === "ws" ? wrongSide(p.chart) : p.chart;
    return repeatChart(c, rep.x, rep.y);
  }, [p.chart, face, rep]);

  // stitch aspect from the gauge: a stitch is (10/sts) wide and (10/rows) tall
  const aspect = p.gauge ? Math.min(1.6, Math.max(0.45, p.gauge.sts / p.gauge.rows)) : 0.75;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fitScale = useMemo(() => {
    if (!chart || !box.w) return 1;
    // base cell: 22px wide; fit leaves room for the fabric margin.
    // A short chart (1–2 rows) would otherwise blow up to fill the window and its purl bumps
    // clump into big blobs; fit it as if it were at least as tall as a new chart (20 rows),
    // so it keeps the same stitch size as taller charts in the same window.
    const rows = Math.max(chart.rows, FIT_MIN_ROWS);
    const cw = Math.min((box.w - 24) / (chart.cols + 2.4), (box.h - 24) / ((rows + 2.4) * aspect));
    return Math.max(0.1, cw / 22);
  }, [chart, box, aspect]);
  const scale = zoom ?? Math.min(fitScale, 4);

  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv || !chart) return;
    let cw = 22 * scale;
    // keep the bitmap within ~4096 device px a side
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const maxCw = 4096 / dpr / (chart.cols + 2.4);
    const maxCh = 4096 / dpr / (chart.rows + 2.4);
    cw = Math.max(2, Math.min(cw, maxCw, maxCh / aspect));
    paintFabric(cv, chart, cw, cw * aspect, dpr, depth === "3d");
  }, [chart, scale, aspect, depth]);

  useEffect(() => {
    const raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [draw]);

  // ctrl/⌘ + wheel zooms the fabric
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setZoom((z) => Math.max(0.1, Math.min(4, (z ?? Math.min(fitScale, 4)) * Math.exp(-e.deltaY * 0.004))));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [fitScale]);

  const step = (dir: 1 | -1) => {
    const cur = scale;
    const next = dir > 0 ? ZOOMS.find((z) => z > cur * 1.01) : [...ZOOMS].reverse().find((z) => z < cur * 0.99);
    setZoom(next ?? (dir > 0 ? 4 : 0.1));
  };

  const savePng = () => {
    const cv = canvasRef.current;
    if (!cv) return;
    cv.toBlob((b) => {
      if (!b) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = `${p.fileName}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, "image/png");
  };

  const src = p.chart;
  const cm = src && p.gauge ? { w: ((src.cols * 10) / p.gauge.sts).toFixed(1), h: ((src.rows * 10) / p.gauge.rows).toFixed(1) } : null;
  const winCls =
    size === "full"
      ? "inset-2"
      : size === "half"
        ? "top-2 right-2 bottom-2 w-[calc(50%-0.5rem)] min-w-[22rem]"
        : "top-14 right-3 h-[min(34rem,calc(100%-9rem))] w-[min(27rem,calc(100%-1.5rem))]";

  return (
    <section
      role="dialog"
      aria-label={p.title}
      data-knit-preview=""
      className={cx("pointer-events-auto absolute z-[85] flex flex-col overflow-hidden rounded-r3 border border-stroke-neutral-muted bg-bg-layer-floating shadow-s3", winCls)}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <header className="flex h-11 shrink-0 items-center gap-x1 border-b border-stroke-neutral-muted pr-x1_5 pl-x3">
        <span className="t3-bold min-w-0 truncate text-fg-neutral">{p.title}</span>
        {p.beta && <span className="t1-bold rounded-r1 bg-bg-brand-weak px-x1 text-fg-brand">β</span>}
        {p.subtitle && <span className="min-w-0 truncate text-[11px] text-fg-neutral-muted">· {p.subtitle}</span>}
        <div className="ml-auto flex items-center gap-0.5" role="group" aria-label="미리보기 크기">
          {(
            [
              ["float", "작은 창으로 보기", <rect key="a" x="12" y="12" width="9" height="8" rx="1.5" />],
              ["half", "반반으로 보기", <path key="b" d="M12 4v16" />],
              ["full", "전체로 보기", <path key="c" d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />],
            ] as [WinSize, string, ReactNode][]
          ).map(([v, label, d]) => (
            <button
              key={v}
              type="button"
              aria-label={label}
              title={label}
              aria-pressed={size === v}
              onClick={() => setSize(v)}
              className={cx("flex size-7 items-center justify-center rounded-r2", size === v ? "bg-bg-layer-default-pressed text-fg-neutral" : "text-fg-neutral-muted hover:bg-bg-layer-default-pressed")}
            >
              <Icon
                className="size-3.5"
                d={
                  v === "full" ? (
                    d
                  ) : (
                    <>
                      <rect x="3" y="4" width="18" height="16" rx="2" />
                      {d}
                    </>
                  )
                }
              />
            </button>
          ))}
          <button type="button" aria-label={p.closeLabel ?? "닫기"} title={p.closeLabel ?? "닫기"} onClick={p.onClose} className="ml-x1 flex size-7 items-center justify-center rounded-r2 text-fg-neutral-muted hover:bg-bg-layer-default-pressed">
            <Icon className="size-3.5" d={<path d="M18 6 6 18M6 6l12 12" />} />
          </button>
        </div>
      </header>

      {chart && (
        <div className="flex shrink-0 flex-wrap items-center gap-x-x3 gap-y-x1_5 border-b border-stroke-neutral-muted px-x3 py-x2">
          <SmallSeg
            label="보는 면"
            value={face}
            options={[
              ["rs", "겉면"],
              ["ws", "안면"],
            ]}
            onChange={setFace}
          />
          <SmallSeg
            label="보기"
            value={depth}
            options={[
              ["2d", "2D"],
              ["3d", "3D"],
            ]}
            onChange={setDepth}
          />
          <SmallSeg
            label="반복"
            value={`${rep.x}x${rep.y}`}
            options={[
              ["1x1", "1"],
              ["2x1", "가로 2"],
              ["2x2", "2×2"],
              ["3x3", "3×3"],
            ]}
            onChange={(v) => {
              const [x, y] = v.split("x").map(Number);
              setRep({ x, y });
              setZoom(null);
            }}
          />
          {p.yarn && (
            <label className="flex items-center gap-x1_5 text-[11px] text-fg-neutral-muted" title="색을 칠하지 않은 칸의 실 색">
              실
              <span className="relative size-5 overflow-hidden rounded-full border border-black/15" style={{ background: p.yarn.value }}>
                <input type="color" aria-label="실 색" value={p.yarn.value} onChange={(e) => p.yarn?.onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
              </span>
            </label>
          )}
        </div>
      )}

      <div className="relative min-h-0 flex-1">
      <div ref={scrollRef} className="absolute inset-0 overflow-auto bg-[#e7e4de] [scrollbar-width:thin]">
        {chart ? (
          <div className="flex min-h-full min-w-full items-center justify-center" style={{ width: "max-content", height: "max-content" }}>
            <canvas ref={canvasRef} role="img" aria-label={`${p.title}: ${src?.cols}코 × ${src?.rows}단 편물`} />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-x1 px-x6 text-center">
            <p className="t3-bold text-fg-neutral">{p.emptyTitle}</p>
            <p className="text-[12px] leading-[1.5] text-fg-neutral-muted">{p.emptyHint}</p>
          </div>
        )}
      </div>
        {chart && (
          <div className="absolute right-2 bottom-2 flex items-center gap-0.5 rounded-r2 border border-stroke-neutral-muted bg-bg-layer-floating/95 p-0.5 shadow-s2">
            <button type="button" aria-label="축소" title="축소" onClick={() => step(-1)} className="flex size-7 items-center justify-center rounded-r1_5 text-fg-neutral-muted hover:bg-bg-layer-default-pressed">
              <Icon className="size-3.5" d={<path d="M5 12h14" />} />
            </button>
            <button type="button" aria-label="화면에 맞추기" title="화면에 맞추기" onClick={() => setZoom(null)} className="h-7 min-w-11 rounded-r1_5 px-x1 text-[11px] font-medium text-fg-neutral tabular-nums hover:bg-bg-layer-default-pressed">
              {Math.round(scale * 100)}%
            </button>
            <button type="button" aria-label="확대" title="확대" onClick={() => step(1)} className="flex size-7 items-center justify-center rounded-r1_5 text-fg-neutral-muted hover:bg-bg-layer-default-pressed">
              <Icon className="size-3.5" d={<path d="M5 12h14M12 5v14" />} />
            </button>
          </div>
        )}
      </div>

      {src && (
        <footer className="flex shrink-0 flex-col gap-x1 border-t border-stroke-neutral-muted px-x3 py-x2">
          <div className="flex items-center gap-x2">
            <span className="min-w-0 flex-1 truncate text-[11px] text-fg-neutral tabular-nums">
              {src.cols}코 × {src.rows}단{cm && ` · 예상 완성 크기 약 ${cm.w} × ${cm.h}cm`}
            </span>
            <button type="button" onClick={savePng} className="flex h-7 shrink-0 items-center gap-x1 rounded-r2 border border-stroke-neutral-muted px-x2 text-[11px] font-medium text-fg-neutral hover:bg-bg-layer-default-pressed">
              <Icon className="size-3.5" d={<path d="M12 15V3M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5" />} />
              이미지 저장
            </button>
          </div>
          {!!p.approx?.length && <p className="line-clamp-2 text-[11px] leading-[1.45] text-fg-neutral-muted">미리보기에서는 근사치로 보여요: {p.approx.join(", ")}</p>}
          <p className="text-[11px] leading-[1.45] text-fg-neutral-subtle">실제 실 제품, 굵기, 텐션에 따라 달라질 수 있어요.</p>
        </footer>
      )}
    </section>
  );
}
