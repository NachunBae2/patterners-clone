// SVG markup for knitting grids — shared by the live canvas, export and thumbnails.
import { knitSymbol, registerCustomGlyphs, symbolDefs, symbolSvg } from "@/lib/symbols/knitting";
import { lightness, numberingOf, rowOwners, type Geo, type KDoc, type KGrid } from "./model";

const f = (n: number) => Math.round(n * 100) / 100;
export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** grid lines (tailwind neutral-400) and the selected grid's lines (amber-500) */
export const LINE = "#a1a1a1";
export const LINE_ACTIVE = "#fd9a00";
export const NUM = "#8b8b8b";
/** label box depth and font size, relative to the row height (28 → 15.4 / 10.64) */
export const numBox = (geo: Geo) => geo.ch * 0.55;
export const numFont = (geo: Geo) => geo.ch * 0.38;

/** colour rects (merged per row run) */
export function colorMarkup(g: KGrid, geo: Geo) {
  let s = "";
  for (let r = 0; r < g.rows; r++) {
    let c = 0;
    while (c < g.cols) {
      const col = g.cells[r * g.cols + c]?.color;
      if (!col) {
        c++;
        continue;
      }
      let e = c + 1;
      while (e < g.cols && g.cells[r * g.cols + e]?.color === col) e++;
      s += `<rect x="${f(c * geo.cw)}" y="${f(r * geo.ch)}" width="${f((e - c) * geo.cw + 0.3)}" height="${f(geo.ch + 0.3)}" fill="${col}"/>`;
      c = e;
    }
  }
  return s;
}

export function symbolMarkup(g: KGrid, geo: Geo, prefix = "ks") {
  let s = "";
  for (let r = 0; r < g.rows; r++) {
    const owners = rowOwners(g, r);
    for (let c = 0; c < g.cols; c++) {
      if (owners[c] !== c) continue;
      const cell = g.cells[r * g.cols + c]!;
      const sym = knitSymbol(cell.symbol);
      if (!sym) continue;
      const dark = cell.color && lightness(cell.color) < 0.45;
      const w = Math.min(sym.width, g.cols - c);
      // wide symbols (cables) read as one merged cell: cover the inner grid lines
      if (sym.width > 1)
        for (let k = 0; k < w; k++) {
          const x0 = (c + k) * geo.cw + (k === 0 ? 0.5 : -0.5);
          const x1 = (c + k + 1) * geo.cw - (k === w - 1 ? 0.5 : -0.5);
          const fill = g.cells[r * g.cols + c + k]?.color ?? "#fff";
          s += `<rect x="${f(x0)}" y="${f(r * geo.ch + 0.5)}" width="${f(x1 - x0)}" height="${f(geo.ch - 1)}" fill="${fill}"/>`;
        }
      s += `<use href="#${prefix}-${sym.id}" x="${f(c * geo.cw)}" y="${f(r * geo.ch)}" width="${f(sym.width * geo.cw)}" height="${f(geo.ch)}"${dark ? ' color="#fff"' : ""}/>`;
    }
  }
  return s;
}

/** which grid lines a wide symbol hides (so the line layer can skip them) */
function coveredVerticals(g: KGrid) {
  const hidden = new Set<string>();
  for (let r = 0; r < g.rows; r++) {
    const owners = rowOwners(g, r);
    for (let c = 1; c < g.cols; c++) if (owners[c] >= 0 && owners[c] === owners[c - 1]) hidden.add(`${c},${r}`);
  }
  return hidden;
}

/** grid lines as individual segments in grid-local coords; `bold` = outer border of the selected grid */
export function gridLines(g: KGrid, geo: Geo, active = false) {
  const W = g.cols * geo.cw;
  const H = g.rows * geo.ch;
  const out: { x1: number; y1: number; x2: number; y2: number; w: number }[] = [];
  for (let r = 0; r <= g.rows; r++) out.push({ x1: 0, y1: r * geo.ch, x2: W, y2: r * geo.ch, w: active && (r === 0 || r === g.rows) ? 2 : 1 });
  const hidden = coveredVerticals(g);
  for (let c = 0; c <= g.cols; c++) {
    const x = c * geo.cw;
    const edge = c === 0 || c === g.cols;
    if (edge || !hidden.size) {
      out.push({ x1: x, y1: 0, x2: x, y2: H, w: active && edge ? 2 : 1 });
      continue;
    }
    // split the line where wide symbols cover it
    let r0 = -1;
    for (let r = 0; r <= g.rows; r++) {
      const open = r < g.rows && !hidden.has(`${c},${r}`);
      if (open && r0 < 0) r0 = r;
      if (!open && r0 >= 0) {
        out.push({ x1: x, y1: r0 * geo.ch, x2: x, y2: r * geo.ch, w: 1 });
        r0 = -1;
      }
    }
  }
  return out;
}

export type NumLabel = { x: number; y: number; w: number; h: number; text: string };

/** row / stitch numbers around a grid (grid-local coords): 1, every `interval`, and the last number */
export function numberLabels(g: KGrid, geo: Geo): NumLabel[] {
  const n = numberingOf(g.numbering);
  const W = g.cols * geo.cw;
  const H = g.rows * geo.ch;
  const box = numBox(geo);
  const off = n.offset;
  const out: NumLabel[] = [];
  const shown = (num: number, last: number, iv: number) => num === 1 || num === last || num % iv === 0;
  const rowNum = (r: number) => (n.reverseRows ? g.rows - r : r + 1);
  const colNum = (c: number) => (n.reverseCols ? g.cols - c : c + 1);
  for (const side of ["bottom", "top"] as const) {
    const iv = n[side];
    if (iv <= 0) continue;
    for (let c = 0; c < g.cols; c++) {
      const num = colNum(c);
      if (!shown(num, g.cols, iv)) continue;
      out.push({ x: c * geo.cw, y: side === "bottom" ? H + off : -box - off, w: geo.cw, h: box, text: String(num) });
    }
  }
  for (const side of ["right", "left"] as const) {
    const iv = n[side];
    if (iv <= 0) continue;
    for (let r = 0; r < g.rows; r++) {
      const num = rowNum(r);
      if (!shown(num, g.rows, iv)) continue;
      out.push({ x: side === "right" ? W + off : -box - off, y: r * geo.ch, w: box, h: geo.ch, text: String(num) });
    }
  }
  return out;
}

export function numberMarkup(g: KGrid, geo: Geo) {
  const fs = numFont(geo);
  let s = `<g font-family="Pretendard, Arial, sans-serif" font-size="${f(fs)}" fill="${NUM}">`;
  for (const l of numberLabels(g, geo))
    s += `<text x="${f(l.x + l.w / 2)}" y="${f(l.y + l.h / 2)}" text-anchor="middle" dominant-baseline="central">${l.text}</text>`;
  return s + "</g>";
}

/** full markup of a grid in its own local coordinates (0,0 = top-left cell) */
export function gridBody(g: KGrid, geo: Geo, prefix = "ks", opts: { cells?: boolean; lines?: boolean } = {}) {
  const W = g.cols * geo.cw;
  const H = g.rows * geo.ch;
  let s = "";
  if (opts.cells !== false) {
    s += `<rect x="0" y="0" width="${f(W)}" height="${f(H)}" fill="#fff"/>`;
    s += colorMarkup(g, geo);
    s += `<svg x="0" y="0" width="${f(W)}" height="${f(H)}" overflow="hidden"><g color="#222">${symbolMarkup(g, geo, prefix)}</g></svg>`;
  }
  if (opts.lines !== false) {
    let d = "";
    for (const l of gridLines(g, geo)) d += `M${f(l.x1)} ${f(l.y1)}${l.x1 === l.x2 ? `V${f(l.y2)}` : `H${f(l.x2)}`}`;
    s += `<path d="${d}" stroke="${LINE}" stroke-width="1" fill="none" shape-rendering="crispEdges"/>`;
  }
  return s;
}

export function usedSymbols(grids: KGrid[]) {
  const set = new Set<string>();
  for (const g of grids) for (const c of g.cells) if (c?.symbol) set.add(c.symbol);
  return set;
}

/** Extra space a grid needs around it for numbers and its name label. */
export function gridPad(geo: Geo) {
  const b = numBox(geo) + 6;
  return { left: b, right: b, top: numFont(geo) * 2.4, bottom: b };
}

/** Standalone SVG of the visible grids, tight bounds + 24px margin. */
export function buildSvg(doc: KDoc, geo: Geo, opts: { numbers?: boolean; labels?: boolean; legend?: boolean; background?: string } = {}) {
  registerCustomGlyphs(doc.glyphs);
  const grids = doc.grids.filter((g) => g.visible);
  if (!grids.length) return null;
  const numbers = opts.numbers !== false;
  const pad = numbers || opts.labels ? gridPad(geo) : { left: 0, right: 0, top: 0, bottom: 0 };
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const g of grids) {
    x0 = Math.min(x0, g.x - pad.left);
    y0 = Math.min(y0, g.y - (opts.labels ? pad.top : 0));
    x1 = Math.max(x1, g.x + g.cols * geo.cw + pad.right);
    y1 = Math.max(y1, g.y + g.rows * geo.ch + pad.bottom);
  }
  const fs = numFont(geo);
  const legendColors = new Map<string, number>();
  if (opts.legend) for (const g of grids) for (const c of g.cells) if (c?.color) legendColors.set(c.color, (legendColors.get(c.color) ?? 0) + 1);
  const footerH = opts.legend ? fs * 2.2 + (legendColors.size ? fs * 2 : 0) : 0;
  const M = 24;
  const W = x1 - x0 + M * 2;
  const H = y1 - y0 + footerH + M * 2;
  let body = "";
  for (const g of grids) {
    body += `<g transform="translate(${f(g.x - x0 + M)} ${f(g.y - y0 + M)})">`;
    if (opts.labels) body += `<text x="0" y="${f(-fs * 0.9)}" font-family="Pretendard, Arial, sans-serif" font-size="${f(fs * 1.15)}" font-weight="600" fill="#333">${esc(g.name)}</text>`;
    body += gridBody(g, geo);
    if (numbers) body += numberMarkup(g, geo);
    body += "</g>";
  }
  if (opts.legend) {
    let y = y1 - y0 + M + fs * 1.6;
    if (doc.gaugeOn) body += `<text x="${M}" y="${f(y)}" font-family="Pretendard, Arial, sans-serif" font-size="${f(fs)}" fill="#555">게이지: 10cm = ${doc.gauge.sts}코 × ${doc.gauge.rows}단</text>`;
    let x = M;
    y += fs * 1.9;
    let i = 1;
    for (const [color] of legendColors) {
      body += `<rect x="${f(x)}" y="${f(y - fs * 0.9)}" width="${f(fs * 1.2)}" height="${f(fs * 1.2)}" fill="${color}" stroke="#999" stroke-width="0.5"/>`;
      const label = `색 ${i} · ${color}`;
      body += `<text x="${f(x + fs * 1.6)}" y="${f(y)}" font-family="Pretendard, Arial, sans-serif" font-size="${f(fs)}" fill="#555">${label}</text>`;
      x += fs * 1.6 + label.length * fs * 0.62 + fs * 1.5;
      i++;
    }
  }
  const defs = symbolDefs(geo.cw, geo.ch, "ks", usedSymbols(grids));
  const bg = opts.background ? `<rect width="100%" height="100%" fill="${opts.background}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${f(W)}" height="${f(H)}" viewBox="0 0 ${f(W)} ${f(H)}"><defs>${defs}</defs>${bg}${body}</svg>`;
}

/** Small thumbnail SVG fitted into 320×240 (colours only for very large charts). */
export function buildThumb(doc: KDoc, geo: Geo) {
  registerCustomGlyphs(doc.glyphs);
  const grids = doc.grids.filter((g) => g.visible);
  if (!grids.length) return undefined;
  const total = grids.reduce((n, g) => n + g.cols * g.rows, 0);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const g of grids) {
    x0 = Math.min(x0, g.x);
    y0 = Math.min(y0, g.y);
    x1 = Math.max(x1, g.x + g.cols * geo.cw);
    y1 = Math.max(y1, g.y + g.rows * geo.ch);
  }
  const M = 12;
  const w = x1 - x0 + M * 2;
  const h = y1 - y0 + M * 2;
  const s = Math.min(320 / w, 240 / h);
  let body = "";
  for (const g of grids) {
    body += `<g transform="translate(${f(g.x - x0 + M)} ${f(g.y - y0 + M)})">`;
    if (total > 6000) {
      body += `<rect width="${f(g.cols * geo.cw)}" height="${f(g.rows * geo.ch)}" fill="#fff" stroke="#888"/>` + colorMarkup(g, geo);
    } else body += gridBody(g, geo);
    body += "</g>";
  }
  const defs = total > 6000 ? "" : symbolDefs(geo.cw, geo.ch, "ks", usedSymbols(grids));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${f(w * s)}" height="${f(h * s)}" viewBox="0 0 ${f(w)} ${f(h)}"><defs>${defs}</defs><rect width="100%" height="100%" fill="#fff"/>${body}</svg>`;
}

// ---------- canvas layer for very large grids ----------

const imgCache = new Map<string, Promise<HTMLImageElement>>();
function symbolImage(id: string, cw: number, ch: number, color: string) {
  const key = `${id}|${f(cw)}|${f(ch)}|${color}`;
  let p = imgCache.get(key);
  if (!p) {
    p = new Promise<HTMLImageElement>((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(symbolSvg(id, cw, ch, color))}`;
    });
    imgCache.set(key, p);
  }
  return p;
}

/**
 * Draws cells + lines of a large grid into `canvas` (up to 2px per world unit, max 4096px a side).
 * `current()` lets a newer draw cancel an older one that is still waiting for symbol bitmaps.
 */
export async function drawGridCanvas(canvas: HTMLCanvasElement, g: KGrid, geo: Geo, current: () => boolean = () => true, lineColor = LINE) {
  const W = g.cols * geo.cw;
  const H = g.rows * geo.ch;
  const scale = Math.min(2, 4096 / W, 4096 / H);
  type Job = { id: string; c: number; r: number; color: string; w: number };
  const jobs: Job[] = [];
  for (let r = 0; r < g.rows; r++) {
    const owners = rowOwners(g, r);
    for (let c = 0; c < g.cols; c++) {
      if (owners[c] !== c) continue;
      const cell = g.cells[r * g.cols + c];
      const sym = knitSymbol(cell?.symbol);
      if (!cell?.symbol || !sym) continue;
      jobs.push({ id: sym.id, c, r, color: cell.color && lightness(cell.color) < 0.45 ? "#fff" : "#222", w: sym.width });
    }
  }
  // symbol bitmaps at device scale; collected before touching the canvas so the old frame stays meanwhile
  const imgs = new Map<string, HTMLImageElement>();
  await Promise.all(
    [...new Set(jobs.map((j) => `${j.id}|${j.color}`))].map(async (k) => {
      const [id, color] = k.split("|");
      try {
        imgs.set(k, await symbolImage(id, geo.cw * scale, geo.ch * scale, color));
      } catch {
        /* skip a broken symbol */
      }
    }),
  );
  if (!current()) return;

  const pw = Math.max(1, Math.round(W * scale));
  const ph = Math.max(1, Math.round(H * scale));
  if (canvas.width !== pw) canvas.width = pw;
  if (canvas.height !== ph) canvas.height = ph;
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);
  for (let r = 0; r < g.rows; r++)
    for (let c = 0; c < g.cols; c++) {
      const col = g.cells[r * g.cols + c]?.color;
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(c * geo.cw, r * geo.ch, geo.cw + 0.3, geo.ch + 0.3);
    }
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 1 / scale;
  ctx.beginPath();
  for (let c = 0; c <= g.cols; c++) {
    ctx.moveTo(c * geo.cw, 0);
    ctx.lineTo(c * geo.cw, H);
  }
  for (let r = 0; r <= g.rows; r++) {
    ctx.moveTo(0, r * geo.ch);
    ctx.lineTo(W, r * geo.ch);
  }
  ctx.stroke();
  for (const j of jobs) {
    const x = j.c * geo.cw;
    const y = j.r * geo.ch;
    if (j.w > 1)
      for (let k = 0; k < j.w && j.c + k < g.cols; k++) {
        const x0 = (j.c + k) * geo.cw + (k === 0 ? 0.5 : -0.5);
        const x1 = (j.c + k + 1) * geo.cw - (k === j.w - 1 ? 0.5 : -0.5);
        ctx.fillStyle = g.cells[j.r * g.cols + j.c + k]?.color ?? "#fff";
        ctx.fillRect(x0, y + 0.5, x1 - x0, geo.ch - 1);
      }
    const img = imgs.get(`${j.id}|${j.color}`);
    if (img) ctx.drawImage(img, x, y, img.width / scale, img.height / scale);
  }
}
