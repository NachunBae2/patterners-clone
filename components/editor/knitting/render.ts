// SVG markup for knitting grids — shared by the live canvas, export and thumbnails.
import { knitSymbol, symbolDefs, symbolSvg } from "@/lib/symbols/knitting";
import { DEFAULT_NUMBERING, lightness, rowOwners, type Geo, type KDoc, type KGrid } from "./model";

const f = (n: number) => Math.round(n * 100) / 100;
export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export const LINE = "#cfcfcf";
export const LINE_BOLD = "#9a9a9a";
export const NUM = "#707070";
export const numFont = (geo: Geo) => Math.max(5, Math.min(geo.ch * 0.6, geo.cw * 0.46, 11));

/** colour rects (merged per row run) */
function colorMarkup(g: KGrid, geo: Geo) {
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

function symbolMarkup(g: KGrid, geo: Geo, prefix: string) {
  let s = "";
  for (let r = 0; r < g.rows; r++) {
    const owners = rowOwners(g, r);
    for (let c = 0; c < g.cols; c++) {
      if (owners[c] !== c) continue;
      const cell = g.cells[r * g.cols + c]!;
      const dark = cell.color && lightness(cell.color) < 0.45;
      const w = knitSymbol(cell.symbol)?.width ?? 1;
      // wide symbols (cables) read as one merged cell: cover the inner grid lines
      if (w > 1)
        for (let k = 0; k < w && c + k < g.cols; k++) {
          const x0 = (c + k) * geo.cw + (k === 0 ? 0.45 : -0.4);
          const x1 = (c + k + 1) * geo.cw - (k === w - 1 ? 0.45 : -0.4);
          const fill = g.cells[r * g.cols + c + k]?.color ?? "#fff";
          s += `<rect x="${f(x0)}" y="${f(r * geo.ch + 0.45)}" width="${f(x1 - x0)}" height="${f(geo.ch - 0.9)}" fill="${fill}"/>`;
        }
      s += `<use href="#${prefix}-${cell.symbol}" x="${f(c * geo.cw)}" y="${f(r * geo.ch)}"${dark ? ' color="#fff"' : ""}/>`;
    }
  }
  return s;
}

function lineMarkup(g: KGrid, geo: Geo) {
  const W = g.cols * geo.cw;
  const H = g.rows * geo.ch;
  let thin = "";
  let bold = "";
  for (let c = 1; c < g.cols; c++) {
    const d = `M${f(c * geo.cw)} 0V${f(H)}`;
    // every 10th stitch counted from the right edge
    if ((g.cols - c) % 10 === 0) bold += d;
    else thin += d;
  }
  for (let r = 1; r < g.rows; r++) {
    const d = `M0 ${f(r * geo.ch)}H${f(W)}`;
    if ((g.rows - r) % 10 === 0) bold += d;
    else thin += d;
  }
  return (
    `<path d="${thin}" stroke="${LINE}" stroke-width="0.6" fill="none"/>` + (bold ? `<path d="${bold}" stroke="${LINE_BOLD}" stroke-width="0.9" fill="none"/>` : "")
  );
}

/** row numbers (right/left/alternating) and stitch numbers along the bottom, counted from the right */
export function numberMarkup(g: KGrid, geo: Geo) {
  const n = g.numbering ?? DEFAULT_NUMBERING;
  const fs = numFont(geo);
  const W = g.cols * geo.cw;
  const H = g.rows * geo.ch;
  const interval = n.alternate ? 1 : Math.max(1, n.interval);
  let s = `<g font-family="Pretendard, Arial, sans-serif" font-size="${f(fs)}" fill="${NUM}">`;
  for (let r = 0; r < g.rows; r++) {
    const num = g.rows - r;
    if (num !== 1 && num % interval) continue;
    const side = n.alternate ? (num % 2 ? "right" : "left") : n.side;
    const x = side === "right" ? W + fs * 0.45 : -fs * 0.45;
    s += `<text x="${f(x)}" y="${f(r * geo.ch + geo.ch / 2)}" dominant-baseline="central" text-anchor="${side === "right" ? "start" : "end"}">${num}</text>`;
  }
  const colInterval = Math.max(1, n.interval);
  for (let c = 0; c < g.cols; c++) {
    const num = g.cols - c;
    if (num !== 1 && num % colInterval) continue;
    s += `<text x="${f(c * geo.cw + geo.cw / 2)}" y="${f(H + fs * 0.35)}" dominant-baseline="hanging" text-anchor="middle">${num}</text>`;
  }
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
  }
  if (opts.lines !== false) s += lineMarkup(g, geo);
  if (opts.cells !== false) s += `<svg x="0" y="0" width="${f(W)}" height="${f(H)}" overflow="hidden"><g color="#222">${symbolMarkup(g, geo, prefix)}</g></svg>`;
  if (opts.lines !== false) s += `<rect x="0" y="0" width="${f(W)}" height="${f(H)}" fill="none" stroke="#6b6b6b" stroke-width="1"/>`;
  return s;
}

export function usedSymbols(grids: KGrid[]) {
  const set = new Set<string>();
  for (const g of grids) for (const c of g.cells) if (c?.symbol) set.add(c.symbol);
  return set;
}

/** Extra space a grid needs around it for numbers and its name label. */
export function gridPad(geo: Geo) {
  const fs = numFont(geo);
  return { left: fs * 2.6, right: fs * 2.6, top: fs * 2.2, bottom: fs * 1.8 };
}

/** Standalone SVG of the visible grids, tight bounds + 24px margin. */
export function buildSvg(doc: KDoc, geo: Geo, opts: { numbers?: boolean; labels?: boolean; legend?: boolean; background?: string } = {}) {
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
    if (opts.labels) body += `<text x="0" y="${f(-fs * 0.8)}" font-family="Pretendard, Arial, sans-serif" font-size="${f(fs * 1.1)}" font-weight="600" fill="#333">${esc(g.name)}</text>`;
    body += gridBody(g, geo);
    if (numbers) body += numberMarkup(g, geo);
    body += "</g>";
  }
  if (opts.legend) {
    let y = y1 - y0 + M + fs * 1.6;
    body += `<text x="${M}" y="${f(y)}" font-family="Pretendard, Arial, sans-serif" font-size="${f(fs)}" fill="#555">게이지: 10cm = ${doc.gauge.sts}코 × ${doc.gauge.rows}단</text>`;
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
export async function drawGridCanvas(canvas: HTMLCanvasElement, g: KGrid, geo: Geo, current: () => boolean = () => true) {
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
      jobs.push({ id: cell.symbol, c, r, color: cell.color && lightness(cell.color) < 0.45 ? "#fff" : "#222", w: sym.width });
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
  const stroke = (color: string, width: number, every: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let c = 1; c < g.cols; c++)
      if (every === 1 ? (g.cols - c) % 10 !== 0 : (g.cols - c) % 10 === 0) {
        ctx.moveTo(c * geo.cw, 0);
        ctx.lineTo(c * geo.cw, H);
      }
    for (let r = 1; r < g.rows; r++)
      if (every === 1 ? (g.rows - r) % 10 !== 0 : (g.rows - r) % 10 === 0) {
        ctx.moveTo(0, r * geo.ch);
        ctx.lineTo(W, r * geo.ch);
      }
    ctx.stroke();
  };
  stroke(LINE, 0.6, 1);
  stroke(LINE_BOLD, 0.9, 10);
  for (const j of jobs) {
    const x = j.c * geo.cw;
    const y = j.r * geo.ch;
    if (j.w > 1)
      for (let k = 0; k < j.w && j.c + k < g.cols; k++) {
        const x0 = (j.c + k) * geo.cw + (k === 0 ? 0.45 : -0.4);
        const x1 = (j.c + k + 1) * geo.cw - (k === j.w - 1 ? 0.45 : -0.4);
        ctx.fillStyle = g.cells[j.r * g.cols + j.c + k]?.color ?? "#fff";
        ctx.fillRect(x0, y + 0.45, x1 - x0, geo.ch - 0.9);
      }
    const img = imgs.get(`${j.id}|${j.color}`);
    if (img) ctx.drawImage(img, x, y, img.width / scale, img.height / scale);
  }
  ctx.strokeStyle = "#6b6b6b";
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, W, H);
}
