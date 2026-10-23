"use client";

// Drawing the chart: <canvas> for the editor, SVG strings for export and thumbnails.
import type { GridMode, GridPage, View } from "@/lib/types";
import { type Block, type FloatRun, type GridDoc, type Numbering, type Rect, clamp, filetInk, finishedSize, numberingOf, rowNoOf, rowSides, stNoOf, stitchCounts } from "./model";

export const CELL = 16; // world units per stitch width (100% zoom = 16px cells)

const INK_MUTED = "#757575";
const BRAND = "#5f9915";
const FONT = '"Pretendard Variable", Pretendard, -apple-system, sans-serif';

export type ChartLayout = { cw: number; ch: number; width: number; height: number };
export const layoutOf = (p: GridPage, aspect: number): ChartLayout => ({
  cw: CELL,
  ch: CELL * aspect,
  width: p.cols * CELL,
  height: p.rows * CELL * aspect,
});

export type DrawArgs = {
  width: number; // css px
  height: number;
  dpr: number;
  view: View;
  page: GridPage;
  yarns: string[];
  mode: GridMode;
  aspect: number;
  safe: { sts: number; rows: number };
  numbering: Numbering;
  floats: FloatRun[] | null;
  hover: { c: number; r: number } | null;
  sel: Rect | null;
  overlay: { block: Block; c: number; r: number } | null;
};

let hatchCache: { key: string; pat: CanvasPattern | null } | null = null;
function hatch(ctx: CanvasRenderingContext2D, dpr: number) {
  const key = String(dpr);
  if (hatchCache?.key === key) return hatchCache.pat;
  const s = Math.round(8 * dpr);
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const x = c.getContext("2d")!;
  x.strokeStyle = "rgba(95,153,21,0.35)";
  x.lineWidth = Math.max(1, dpr);
  x.beginPath();
  x.moveTo(-1, s + 1);
  x.lineTo(s + 1, -1);
  x.stroke();
  const pat = ctx.createPattern(c, "repeat");
  hatchCache = { key, pat };
  return pat;
}

export function drawChart(ctx: CanvasRenderingContext2D, a: DrawArgs) {
  const { dpr, view, page, yarns, mode, aspect } = a;
  const { cols, rows, cells } = page;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, a.width * dpr, a.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const cw = CELL * view.zoom;
  const ch = CELL * aspect * view.zoom;
  // cell edges sit on exact (unsnapped) positions; fills are snapped to device pixels
  const X = (c: number) => view.x + c * cw;
  const Y = (r: number) => view.y + r * ch;
  const px = (v: number) => Math.round(v * dpr) / dpr;

  const c0 = clamp(Math.floor(-view.x / cw), 0, cols);
  const c1 = clamp(Math.ceil((a.width - view.x) / cw), 0, cols);
  const r0 = clamp(Math.floor(-view.y / ch), 0, rows);
  const r1 = clamp(Math.ceil((a.height - view.y) / ch), 0, rows);

  const filet = mode === "filet";
  const ink = filetInk(yarns);

  // chart surface + soft shadow
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.11)";
  ctx.shadowBlur = 12;
  ctx.fillStyle = filet ? "#ffffff" : yarns[0] ?? "#ffffff";
  ctx.fillRect(X(0), Y(0), cols * cw, rows * ch);
  ctx.restore();

  // cells
  if (filet) {
    const inset = Math.max(1 / dpr, Math.min(cw, ch) * 0.07);
    const open = Math.min(cw, ch) >= 6;
    for (let r = r0; r < r1; r++)
      for (let c = c0; c < c1; c++) {
        const v = cells[r * cols + c];
        const x = X(c);
        const y = Y(r);
        if (v > 0) {
          ctx.fillStyle = ink;
          ctx.fillRect(x + inset, y + inset, cw - inset * 2, ch - inset * 2);
        } else if (open) {
          ctx.strokeStyle = ink;
          ctx.globalAlpha = 0.28;
          ctx.lineWidth = Math.max(1 / dpr, Math.min(cw, ch) * 0.06);
          const m = Math.min(cw, ch) * 0.24;
          ctx.strokeRect(x + m, y + m, cw - m * 2, ch - m * 2);
          ctx.globalAlpha = 1;
        }
      }
  } else {
    for (let r = r0; r < r1; r++) {
      let c = c0;
      while (c < c1) {
        const v = cells[r * cols + c];
        let e = c + 1;
        while (e < c1 && cells[r * cols + e] === v) e++;
        if (v > 0) {
          ctx.fillStyle = yarns[v] ?? yarns[0];
          ctx.fillRect(px(X(c)), px(Y(r)), px(X(e)) - px(X(c)), px(Y(r + 1)) - px(Y(r)));
        }
        c = e;
      }
    }
  }

  // overlay (rectangle preview / moving block)
  if (a.overlay) {
    const { block, c: oc, r: or } = a.overlay;
    ctx.globalAlpha = 0.85;
    for (let r = 0; r < block.rows; r++)
      for (let c = 0; c < block.cols; c++) {
        const cc = oc + c;
        const rr = or + r;
        if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) continue;
        const v = block.cells[r * block.cols + c];
        ctx.fillStyle = filet ? (v > 0 ? ink : "#ffffff") : v > 0 ? yarns[v] ?? yarns[0] : yarns[0];
        ctx.fillRect(px(X(cc)), px(Y(rr)), px(X(cc + 1)) - px(X(cc)), px(Y(rr + 1)) - px(Y(rr)));
      }
    ctx.globalAlpha = 1;
  }

  // safe zone band
  const { sts: ss, rows: sr } = a.safe;
  if (ss > 0 || sr > 0) {
    const pat = hatch(ctx, dpr);
    if (pat) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = pat;
      const band = (x0: number, y0: number, x1: number, y1: number) => {
        if (x1 > x0 && y1 > y0) ctx.fillRect(x0 * dpr, y0 * dpr, (x1 - x0) * dpr, (y1 - y0) * dpr);
      };
      band(X(0), Y(0), X(cols), Y(sr));
      band(X(0), Y(rows - sr), X(cols), Y(rows));
      band(X(0), Y(sr), X(ss), Y(rows - sr));
      band(X(cols - ss), Y(sr), X(cols), Y(rows - sr));
      ctx.restore();
    }
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = BRAND;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(X(ss), Y(sr), X(cols - ss) - X(ss), Y(rows - sr) - Y(sr));
    ctx.restore();
  }

  // grid lines: hairlines every cell, heavier every 10 (counted from stitch / row 1)
  const n = a.numbering;
  const lineRGB = filet ? "40,48,64" : "0,0,0";
  const top = Y(r0);
  const bottom = Y(r1);
  const left = X(c0);
  const right = X(c1);
  const showThinV = cw >= 4;
  const showThinH = ch >= 4;
  const bold = (k: number) => k % 10 === 0;
  ctx.fillStyle = `rgba(${lineRGB},0.16)`;
  for (let c = Math.max(1, c0); c <= Math.min(cols - 1, c1); c++) {
    const k = n.flipSts ? cols - c : c;
    if (!bold(k) && showThinV) ctx.fillRect(X(c) - 0.5, top, 1, bottom - top);
  }
  for (let r = Math.max(1, r0); r <= Math.min(rows - 1, r1); r++) {
    const k = n.flipRows ? rows - r : r;
    if (!bold(k) && showThinH) ctx.fillRect(left, Y(r) - 0.5, right - left, 1);
  }
  ctx.fillStyle = `rgba(${lineRGB},0.7)`;
  for (let c = Math.max(1, c0); c <= Math.min(cols - 1, c1); c++) {
    const k = n.flipSts ? cols - c : c;
    if (bold(k)) ctx.fillRect(X(c) - 0.75, top, 1.5, bottom - top);
  }
  for (let r = Math.max(1, r0); r <= Math.min(rows - 1, r1); r++) {
    const k = n.flipRows ? rows - r : r;
    if (bold(k)) ctx.fillRect(left, Y(r) - 0.75, right - left, 1.5);
  }
  ctx.strokeStyle = `rgba(${lineRGB},0.83)`;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(X(0), Y(0), cols * cw, rows * ch);

  // long floats
  if (a.floats?.length) {
    for (const f of a.floats) {
      if (f.r < r0 || f.r >= r1) continue;
      const x = X(f.c0);
      const w = X(f.c1) - x;
      const y = Y(f.r);
      const h = ch;
      // a red strand across the run, with end ticks, reads as "yarn carried behind"
      const t = clamp(h * 0.14, 1.5, 3);
      const my = y + h / 2 - t / 2;
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillRect(x + 1, my - 1, w - 2, t + 2);
      ctx.fillStyle = "#d32f2f";
      ctx.fillRect(x + 1, my, w - 2, t);
      ctx.fillRect(x + 1, y + h * 0.25, t, h * 0.5);
      ctx.fillRect(x + w - 1 - t, y + h * 0.25, t, h * 0.5);
    }
  }

  // hover row + cell
  if (a.hover && a.hover.r >= 0 && a.hover.r < rows) {
    const { c, r } = a.hover;
    ctx.fillStyle = "rgba(129,192,66,0.16)";
    ctx.fillRect(X(0), Y(r), cols * cw, ch);
    if (c >= 0 && c < cols) {
      ctx.strokeStyle = BRAND;
      ctx.lineWidth = 2;
      ctx.strokeRect(X(c) + 1, Y(r) + 1, cw - 2, ch - 2);
    }
  }

  // selection
  if (a.sel && a.sel.w > 0 && a.sel.h > 0) {
    const { c, r, w, h } = a.sel;
    const x = X(c);
    const y = Y(r);
    ctx.fillStyle = "rgba(95,153,21,0.10)";
    ctx.fillRect(x, y, w * cw, h * ch);
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.strokeStyle = "#ffffff";
    ctx.strokeRect(x, y, w * cw, h * ch);
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = "#1a1c20";
    ctx.strokeRect(x, y, w * cw, h * ch);
    ctx.setLineDash([]);
  }

  // numbers
  const gap = 6 + Math.max(0, n.offset);
  const fs = 12;
  ctx.textBaseline = "middle";
  const rowStep = ch >= 11 ? 1 : ch * 5 >= 11 ? 5 : 10;
  for (let r = r0; r < r1; r++) {
    const no = rowNoOf(r, rows, n);
    const hovered = a.hover?.r === r;
    if (no % rowStep !== 0 && no !== 1 && !hovered) continue;
    const sides = rowSides(no, n);
    if (hovered && !sides.length) sides.push(n.flipSts ? "right" : "left");
    const yy = Math.round(Y(r) + ch / 2);
    ctx.font = `${hovered ? 700 : 500} ${fs}px ${FONT}`;
    const tx = String(no);
    const tw = ctx.measureText(tx).width;
    for (const side of sides) {
      const xx = side === "right" ? X(cols) + gap : X(0) - gap - tw;
      if (hovered) {
        ctx.fillStyle = BRAND;
        roundRect(ctx, xx - 4, yy - fs * 0.75, tw + 8, fs * 1.5, 4);
        ctx.fillStyle = "#fff";
      } else ctx.fillStyle = INK_MUTED;
      ctx.fillText(tx, xx, yy);
    }
  }
  const stStep = cw >= 16 ? 1 : cw * 5 >= 16 ? 5 : 10;
  ctx.textAlign = "center";
  for (let c = c0; c < c1; c++) {
    const no = stNoOf(c, cols, n);
    const hovered = a.hover?.c === c && a.hover.r >= 0 && a.hover.r < rows;
    const xx = X(c) + cw / 2;
    for (const [every, y] of [
      [n.bottom, Math.round(Y(rows) + gap + fs / 2)],
      [n.top, Math.round(Y(0) - gap - fs / 2)],
    ] as const) {
      if (every <= 0 && !(hovered && y > Y(0))) continue;
      const step = Math.max(stStep, every);
      if (no % step !== 0 && no !== 1 && !hovered) continue;
      ctx.fillStyle = hovered ? BRAND : INK_MUTED;
      ctx.font = `${hovered ? 700 : 500} ${fs}px ${FONT}`;
      ctx.fillText(String(no), xx, y);
    }
  }
  ctx.textAlign = "start";
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

/** Small preview used inside the start dialog. */
export function drawPreview(cv: HTMLCanvasElement, cells: number[], cols: number, rows: number, yarns: string[], mode: GridMode, aspect: number) {
  const dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth || 400;
  const H = cv.clientHeight || 300;
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  const ctx = cv.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const s = Math.min((W - 16) / cols, (H - 16) / (rows * aspect));
  const cw = s;
  const ch = s * aspect;
  const ox = (W - cw * cols) / 2;
  const oy = (H - ch * rows) / 2;
  const filet = mode === "filet";
  const ink = filetInk(yarns);
  ctx.fillStyle = filet ? "#fff" : yarns[0] ?? "#fff";
  ctx.fillRect(ox, oy, cw * cols, ch * rows);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const v = cells[r * cols + c];
      if (v <= 0) continue;
      ctx.fillStyle = filet ? ink : yarns[v] ?? ink;
      ctx.fillRect(Math.floor(ox + c * cw), Math.floor(oy + r * ch), Math.ceil(cw), Math.ceil(ch));
    }
  if (cw >= 4) {
    ctx.fillStyle = "rgba(30,32,36,0.12)";
    for (let c = 0; c <= cols; c++) ctx.fillRect(ox + c * cw, oy, 1, ch * rows);
    for (let r = 0; r <= rows; r++) ctx.fillRect(ox, oy + r * ch, cw * cols, 1);
  }
  ctx.strokeStyle = "rgba(30,32,36,0.45)";
  ctx.strokeRect(ox, oy, cw * cols, ch * rows);
}

// ---------- SVG ----------

const esc = (s: string) => s.replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[m]!);
const f1 = (n: number) => Math.round(n * 100) / 100;

function cellRects(page: GridPage, yarns: string[], filet: boolean, cs: number, csh: number, ox: number, oy: number) {
  const out: string[] = [];
  const ink = filetInk(yarns);
  const { cols, rows, cells } = page;
  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      const v = cells[r * cols + c];
      let e = c + 1;
      while (e < cols && cells[r * cols + e] === v) e++;
      if (v > 0) {
        if (filet) {
          const ins = Math.max(0.5, Math.min(cs, csh) * 0.07);
          for (let k = c; k < e; k++)
            out.push(`<rect x="${f1(ox + k * cs + ins)}" y="${f1(oy + r * csh + ins)}" width="${f1(cs - ins * 2)}" height="${f1(csh - ins * 2)}" fill="${ink}"/>`);
        } else
          out.push(`<rect x="${f1(ox + c * cs)}" y="${f1(oy + r * csh)}" width="${f1((e - c) * cs)}" height="${f1(csh)}" fill="${yarns[v] ?? yarns[0]}"/>`);
      } else if (filet && cs >= 5) {
        const m = Math.min(cs, csh) * 0.24;
        for (let k = c; k < e; k++)
          out.push(
            `<rect x="${f1(ox + k * cs + m)}" y="${f1(oy + r * csh + m)}" width="${f1(cs - m * 2)}" height="${f1(csh - m * 2)}" fill="none" stroke="${ink}" stroke-opacity="0.3" stroke-width="${f1(Math.max(0.5, cs * 0.06))}"/>`,
          );
      }
      c = e;
    }
  }
  return out.join("");
}

export function chartSvg(doc: GridDoc, page: GridPage, aspect: number) {
  const { cols, rows } = page;
  const cs = clamp(2400 / cols, 6, 18);
  const csh = cs * aspect;
  const M = 24;
  const gut = 30;
  const chartW = cols * cs;
  const chartH = rows * csh;
  const ox = M + gut;
  const oy = M;
  const filet = doc.mode === "filet";
  const nb = numberingOf(doc);
  const parts: string[] = [];

  parts.push(`<rect x="${ox}" y="${oy}" width="${f1(chartW)}" height="${f1(chartH)}" fill="${filet ? "#ffffff" : doc.yarns[0]}"/>`);
  parts.push(cellRects(page, doc.yarns, filet, cs, csh, ox, oy));

  // grid
  const thin: string[] = [];
  const mid: string[] = [];
  const bold: string[] = [];
  for (let c = 0; c <= cols; c++) {
    const k = nb.flipSts ? cols - c : c;
    const d = `M${f1(ox + c * cs)} ${oy}V${f1(oy + chartH)}`;
    (k % 10 === 0 ? bold : k % 5 === 0 ? mid : thin).push(d);
  }
  for (let r = 0; r <= rows; r++) {
    const k = nb.flipRows ? rows - r : r;
    const d = `M${ox} ${f1(oy + r * csh)}H${f1(ox + chartW)}`;
    (k % 10 === 0 ? bold : k % 5 === 0 ? mid : thin).push(d);
  }
  if (cs >= 5) parts.push(`<path d="${thin.join("")}" stroke="#1e2024" stroke-opacity="0.16" stroke-width="0.5" fill="none"/>`);
  parts.push(`<path d="${mid.join("")}" stroke="#1e2024" stroke-opacity="0.32" stroke-width="0.8" fill="none"/>`);
  parts.push(`<path d="${bold.join("")}" stroke="#1e2024" stroke-opacity="0.6" stroke-width="1.4" fill="none"/>`);
  parts.push(`<rect x="${ox}" y="${oy}" width="${f1(chartW)}" height="${f1(chartH)}" fill="none" stroke="#1e2024" stroke-opacity="0.7" stroke-width="1.4"/>`);

  // numbers
  const fsR = clamp(csh * 0.62, 6, 11);
  const rowStep = csh >= 9 ? 1 : 5;
  const nums: string[] = [];
  for (let r = 0; r < rows; r++) {
    const no = rowNoOf(r, rows, nb);
    if (no % rowStep !== 0 && no !== 1) continue;
    const y = oy + (r + 0.5) * csh;
    for (const side of rowSides(no, nb))
      nums.push(
      side === "right"
        ? `<text x="${f1(ox + chartW + 5)}" y="${f1(y)}" dominant-baseline="central" font-size="${f1(fsR)}">${no}</text>`
        : `<text x="${f1(ox - 5)}" y="${f1(y)}" dominant-baseline="central" text-anchor="end" font-size="${f1(fsR)}">${no}</text>`,
    );
  }
  const stStep = cs >= 16 ? 1 : 5;
  const fsS = clamp(cs * 0.55, 6, 10);
  for (let c = 0; c < cols; c++) {
    const no = stNoOf(c, cols, nb);
    if (nb.bottom <= 0 || (no % Math.max(stStep, nb.bottom) !== 0 && no !== 1)) continue;
    nums.push(`<text x="${f1(ox + (c + 0.5) * cs)}" y="${f1(oy + chartH + 5 + fsS * 0.8)}" text-anchor="middle" font-size="${f1(fsS)}">${no}</text>`);
  }
  parts.push(`<g fill="${INK_MUTED}" font-family='${FONT}' font-weight="500">${nums.join("")}</g>`);

  // legend + gauge
  let y = oy + chartH + 36;
  const legend: string[] = [];
  const counts = stitchCounts(page, doc.yarns.length);
  let lx = ox;
  const unit = filet ? "칸" : "코";
  if (filet) {
    const ink = filetInk(doc.yarns);
    const items: [string, number, boolean][] = [
      ["채운칸", page.cells.filter((v) => v > 0).length, true],
      ["빈칸", page.cells.filter((v) => v <= 0).length, false],
    ];
    for (const [label, n, filled] of items) {
      legend.push(`<rect x="${lx}" y="${y}" width="14" height="14" rx="2" fill="${filled ? ink : "#fff"}" stroke="#1e2024" stroke-opacity="0.35"/>`);
      legend.push(`<text x="${lx + 20}" y="${y + 7}" dominant-baseline="central" font-size="11">${label} ${n}${unit}</text>`);
      lx += 120;
    }
  } else
    doc.yarns.forEach((c, i) => {
      if (!counts[i]) return;
      if (lx > ox + Math.max(chartW, 360) - 100) {
        lx = ox;
        y += 22;
      }
      legend.push(`<rect x="${lx}" y="${y}" width="14" height="14" rx="3" fill="${c}" stroke="#1e2024" stroke-opacity="0.25"/>`);
      legend.push(`<text x="${lx + 20}" y="${y + 7}" dominant-baseline="central" font-size="11">${counts[i]}${unit}</text>`);
      lx += 92;
    });
  y += 22;
  if (doc.exportGauge) {
    const size = finishedSize(cols, rows, doc.gauge);
    legend.push(
      `<text x="${ox}" y="${y + 8}" dominant-baseline="central" font-size="11">${esc(
        `게이지 ${doc.gauge.sts}${filet ? "칸" : "코"} × ${doc.gauge.rows}단/10cm(예상) · ${cols}${unit} × ${rows}단 · 예상 완성 크기 약 ${size.w} × ${size.h} cm`,
      )}</text>`,
    );
    y += 22;
  }
  parts.push(`<g fill="#1e2024" font-family='${FONT}'>${legend.join("")}</g>`);

  const width = Math.ceil(ox + Math.max(chartW, doc.exportGauge ? 420 : 200) + gut + M);
  const height = Math.ceil(y + M - 4);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#ffffff"/>${parts.join("")}</svg>`;
}

/** Downsampled SVG of the cells fitted into 320×240. */
export function thumbSvg(doc: GridDoc, page: GridPage, aspect: number) {
  const step = Math.max(1, Math.ceil(Math.max(page.cols, page.rows) / 100));
  const cols = Math.ceil(page.cols / step);
  const rows = Math.ceil(page.rows / step);
  const cells: number[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push(page.cells[r * step * page.cols + c * step]);
  const s = Math.min(296 / cols, 216 / (rows * aspect));
  const w = cols * s;
  const h = rows * s * aspect;
  const ox = (320 - w) / 2;
  const oy = (240 - h) / 2;
  const filet = doc.mode === "filet";
  const sub: GridPage = { id: "", name: "", cols, rows, cells };
  const body = cellRects(sub, doc.yarns, filet, s, s * aspect, ox, oy);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240" shape-rendering="crispEdges"><rect x="${f1(ox)}" y="${f1(oy)}" width="${f1(w)}" height="${f1(h)}" fill="${filet ? "#fff" : doc.yarns[0]}" stroke="#1e2024" stroke-opacity="0.2"/>${body}</svg>`;
}
