// Standalone SVG of the drafted pieces (canvas, export, print and the home thumbnail share it).
import type { ApparelData } from "@/lib/types";
import { cm1, type Draft, type Piece } from "./model";

export const PX = 8; // svg units per cm
const GAP = 16; // cm between pieces
const MARGIN = 14; // cm around the sheet (room for dimension lines)

const FILL: Record<string, string> = { back: "#eef3e4", front: "#e7eef8", sleeve: "#f8ece3" };
const INK = "#26282c";
const DIM = "#6b6f76";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const f = (n: number) => (Math.round(n * 100) / 100).toString();

export type Placed = { piece: Piece; x: number; y: number; w: number; h: number; poly: [number, number][] };

/** Piece outline in cm with (0,0) at the bottom-left of its box, y up. */
function piecePoly(p: Piece, gs: number, gr: number) {
  const half = p.outline.map(([x, y]) => [x / gs, y / gr] as [number, number]);
  if (!p.symmetric) return { poly: half, w: Math.max(...half.map((q) => q[0])), x0: 0 };
  const hw = Math.max(...half.map((q) => q[0]));
  const right = half.map(([x, y]) => [hw + x, y] as [number, number]);
  const left = half
    .slice()
    .reverse()
    .map(([x, y]) => [hw - x, y] as [number, number]);
  return { poly: [...right, ...left], w: hw * 2, x0: hw };
}

export function layout(dr: Draft) {
  const placed: Placed[] = [];
  let x = MARGIN;
  const H = Math.max(...dr.pieces.map((p) => p.rows / dr.gr));
  for (const p of dr.pieces) {
    const { poly, w } = piecePoly(p, dr.gs, dr.gr);
    const h = p.rows / dr.gr;
    placed.push({ piece: p, x, y: MARGIN + (H - h), w, h, poly });
    x += w + GAP;
  }
  return { placed, width: x - GAP + MARGIN, height: H + MARGIN * 2 };
}

const toSvg = (pl: Placed, [x, y]: [number, number]): [number, number] => [(pl.x + x) * PX, (pl.y + pl.h - y) * PX];

function hDim(x1: number, x2: number, y: number, label: string, above = false) {
  const t = 1.2 * PX;
  const ty = above ? y - 0.8 * PX : y + 2.7 * PX;
  return `<g class="ap-dim"><line x1="${f(x1)}" y1="${f(y)}" x2="${f(x2)}" y2="${f(y)}"/><line x1="${f(x1)}" y1="${f(y - t / 2)}" x2="${f(x1)}" y2="${f(y + t / 2)}"/><line x1="${f(x2)}" y1="${f(y - t / 2)}" x2="${f(x2)}" y2="${f(y + t / 2)}"/><text x="${f((x1 + x2) / 2)}" y="${f(ty)}" text-anchor="middle">${esc(label)}</text></g>`;
}
function vDim(x: number, y1: number, y2: number, label: string, left = true) {
  const t = 1.2 * PX;
  const tx = left ? x - 0.8 * PX : x + 0.8 * PX;
  const my = (y1 + y2) / 2;
  return `<g class="ap-dim"><line x1="${f(x)}" y1="${f(y1)}" x2="${f(x)}" y2="${f(y2)}"/><line x1="${f(x - t / 2)}" y1="${f(y1)}" x2="${f(x + t / 2)}" y2="${f(y1)}"/><line x1="${f(x - t / 2)}" y1="${f(y2)}" x2="${f(x + t / 2)}" y2="${f(y2)}"/><text x="${f(tx)}" y="${f(my)}" text-anchor="middle" transform="rotate(-90 ${f(tx)} ${f(my)})">${esc(label)}</text></g>`;
}

export type SheetOpts = { dims?: boolean; overlayHref?: string | null; title?: string; thumb?: boolean; idPrefix?: string };

export function sheetSvg(d: ApparelData, dr: Draft, opts: SheetOpts = {}) {
  const { placed, width, height } = layout(dr);
  const titleH = opts.title ? 8 : 0;
  const W = width * PX;
  const H = (height + titleH) * PX;
  const out: string[] = [];
  const dims = opts.dims ?? d.showDims;
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${f(W)}" height="${f(H)}" viewBox="0 0 ${f(W)} ${f(H)}" font-family="Pretendard, -apple-system, 'Apple SD Gothic Neo', sans-serif">`,
  );
  out.push(
    `<style>.ap-dim line{stroke:${DIM};stroke-width:1}.ap-dim text{fill:${DIM};font-size:${f(2 * PX)}px}.ap-lbl{fill:${INK};font-weight:700;font-size:${f(3 * PX)}px}.ap-sub{fill:${DIM};font-size:${f(2 * PX)}px}.ap-split{stroke:${DIM};stroke-width:1;stroke-dasharray:6 4}.ap-centre{stroke:${DIM};stroke-width:1;stroke-dasharray:14 4 2 4}</style>`,
  );
  out.push(`<rect width="100%" height="100%" fill="#ffffff"/>`);
  if (opts.title) out.push(`<text x="${f(MARGIN * PX)}" y="${f(7 * PX)}" class="ap-lbl" font-size="${f(3 * PX)}">${esc(opts.title)}</text>`);
  out.push(`<g transform="translate(0 ${f(titleH * PX)})">`);

  for (const pl of placed) {
    const p = pl.piece;
    const pts = pl.poly.map((q) => toSvg(pl, q));
    const path = `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join("L")}Z`;
    const clipId = `${opts.idPrefix ?? "ap"}-clip-${p.id}`;
    out.push(`<path d="${path}" fill="${FILL[p.id]}" stroke="none"/>`);
    // pattern overlay clipped to the piece
    if (opts.overlayHref && d.overlay && d.overlay.piece === p.id) {
      const o = d.overlay;
      const iw = Math.max(1, pl.w * o.scale);
      const cx = pl.x + pl.w / 2 + o.x;
      const cy = pl.y + pl.h / 2 - o.y;
      out.push(`<clipPath id="${clipId}"><path d="${path}"/></clipPath>`);
      out.push(
        `<image href="${esc(opts.overlayHref)}" xlink:href="${esc(opts.overlayHref)}" x="${f((cx - iw / 2) * PX)}" y="${f((cy - iw / 2) * PX)}" width="${f(iw * PX)}" height="${f(iw * PX)}" preserveAspectRatio="xMidYMid meet" opacity="${f(o.opacity)}" clip-path="url(#${clipId})"/>`,
      );
    }
    // rib split line
    if (p.marks.rib > 0) {
      const y = (pl.y + pl.h - p.marks.rib / dr.gr) * PX;
      const half = p.widths.hem / dr.gs;
      const x0 = p.symmetric ? pl.x + pl.w / 2 - half : pl.x;
      const x1 = p.symmetric ? pl.x + pl.w / 2 + half : pl.x + half;
      out.push(`<line class="ap-split" x1="${f(x0 * PX)}" y1="${f(y)}" x2="${f(x1 * PX)}" y2="${f(y)}"/>`);
    }
    if (p.symmetric && !opts.thumb) {
      const cx = (pl.x + pl.w / 2) * PX;
      out.push(`<line class="ap-centre" x1="${f(cx)}" y1="${f((pl.y + pl.h + 1) * PX)}" x2="${f(cx)}" y2="${f((pl.y - 1) * PX)}"/>`);
    }
    out.push(`<path d="${path}" fill="none" stroke="${INK}" stroke-width="${opts.thumb ? 3 : 2}" stroke-linejoin="round"/>`);

    if (!opts.thumb) {
      const cx = (pl.x + pl.w / 2) * PX;
      const cy = (pl.y + pl.h * 0.45) * PX;
      out.push(`<text x="${f(cx)}" y="${f(cy)}" text-anchor="middle" class="ap-lbl">${esc(p.name)}${p.count > 1 ? ` ×${p.count}` : ""}</text>`);
      out.push(`<text x="${f(cx)}" y="${f(cy + 3.2 * PX)}" text-anchor="middle" class="ap-sub">시작 ${p.castOn}코 · ${p.rows}단</text>`);
    }

    if (dims && !opts.thumb) {
      const bottom = (pl.y + pl.h) * PX;
      const top = pl.y * PX;
      const lab = (sts: number) => `${cm1(sts / dr.gs)}cm · ${sts}코`;
      const labR = (rows: number) => `${cm1(rows / dr.gr)}cm · ${rows}단`;
      const xs = (half: number) => (p.symmetric ? [pl.x + pl.w / 2 - half / dr.gs, pl.x + pl.w / 2 + half / dr.gs] : [pl.x, pl.x + half / dr.gs]).map((v) => v * PX);
      const full = (half: number) => (p.symmetric ? half * 2 : half);
      // bottom width
      const [h0, h1] = xs(p.widths.hem);
      out.push(hDim(h0, h1, bottom + 3 * PX, lab(full(p.widths.hem))));
      // width at the underarm (only when it differs from the hem)
      if (p.widths.bust !== p.widths.hem) {
        const [b0, b1] = xs(p.widths.bust);
        const y = (pl.y + pl.h - p.marks.underarm / dr.gr) * PX;
        out.push(hDim(b0, b1, y, lab(full(p.widths.bust)), true));
      }
      // top: shoulder span and neck
      if (p.id !== "sleeve") {
        const sRow = p.marks.shoulder;
        const sy = (pl.y + pl.h - sRow / dr.gr) * PX;
        if (d.style !== "raglan" && p.widths.shoulder > 0 && p.widths.shoulder !== p.widths.bust) {
          const [s0, s1] = xs(p.widths.shoulder);
          out.push(hDim(s0, s1, Math.min(sy, top) - 3 * PX, lab(full(p.widths.shoulder)), true));
        }
        if (p.widths.neck > 0 && p.symmetric) {
          const [n0, n1] = xs(p.widths.neck);
          out.push(hDim(n0, n1, top + 3 * PX, `목 ${lab(full(p.widths.neck))}`));
        }
      }
      // heights
      const lx = Math.min(...pts.map((q) => q[0])) - 3 * PX;
      const rx = Math.max(...pts.map((q) => q[0])) + 3 * PX;
      out.push(vDim(lx, bottom, top, labR(p.rows)));
      const uy = (pl.y + pl.h - p.marks.underarm / dr.gr) * PX;
      if (p.marks.underarm < p.rows) out.push(vDim(rx, uy, top, `${p.id === "sleeve" ? "소매산 " : "진동 "}${labR(p.rows - p.marks.underarm)}`, false));
      if (p.id === "front" && p.marks.neck < p.rows) {
        const ny = (pl.y + pl.h - p.marks.neck / dr.gr) * PX;
        const nx = p.symmetric ? (pl.x + pl.w / 2) * PX + 1.6 * PX : pl.x * PX - 1.6 * PX;
        out.push(vDim(nx, ny, top, `앞목 ${labR(p.rows - p.marks.neck)}`, !p.symmetric));
      }
    }
  }
  out.push(`</g></svg>`);
  return { svg: out.join(""), width: W, height: H };
}
