// Pure helpers for the 배색·방안 chart: page transforms, fills, checks, size math.
import { uid } from "@/lib/id";
import type { GridData, GridMode, GridPage } from "@/lib/types";

/** Editor-only settings kept next to GridData (extra JSON fields are saved as-is). */
export type GridExtra = {
  safe?: { sts: number; rows: number };
  working?: "flat" | "round";
  hand?: "right" | "left";
  floatLimit?: number;
  showFloats?: boolean;
  exportGauge?: boolean;
  /** 단수 표시: number interval per side (0 = hidden) and ordering. */
  numbering?: Numbering;
  /** 게이지 estimator inputs (yarn / needle thickness in mm, tension). */
  gaugeTool?: { yarn: number; needle: number; tension: Tension };
  /** 안전구역 switch; `safe` keeps the margin sizes. */
  safeOn?: boolean;
};
export type GridDoc = GridData & GridExtra;

export type Tension = "loose" | "normal" | "tight";
export type Numbering = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  /** 번갈아 표시: row numbers alternate sides (flat knitting). */
  alternate: boolean;
  /** 단 순서 뒤집기: row 1 is the bottom row. */
  flipRows: boolean;
  /** 코 순서 뒤집기: stitch 1 is the right-most stitch. */
  flipSts: boolean;
  /** 도안과 거리: extra gap between numbers and chart, in px. */
  offset: number;
};

export const DEFAULT_NUMBERING: Numbering = { left: 1, top: 0, right: 1, bottom: 1, alternate: true, flipRows: true, flipSts: true, offset: 0 };
export const DEFAULT_GAUGE_TOOL = { yarn: 4, needle: 4.75, tension: "normal" as Tension };

/** Numbering for a doc, derived from the legacy working/hand fields when unset. */
export function numberingOf(d: GridDoc): Numbering {
  if (d.numbering) return d.numbering;
  return { ...DEFAULT_NUMBERING, alternate: (d.working ?? "flat") === "flat", flipSts: (d.hand ?? "right") === "right" };
}

export const rowNoOf = (r: number, rows: number, n: Numbering) => (n.flipRows ? rows - r : r + 1);
export const stNoOf = (c: number, cols: number, n: Numbering) => (n.flipSts ? cols - c : c + 1);

/** Sides on which row number `no` is printed. */
export function rowSides(no: number, n: Numbering): ("left" | "right")[] {
  if (n.alternate) {
    const first = n.flipSts ? "right" : "left";
    return [no % 2 === 1 ? first : first === "right" ? "left" : "right"];
  }
  const out: ("left" | "right")[] = [];
  if (n.left > 0 && (no % n.left === 0 || no === 1)) out.push("left");
  if (n.right > 0 && (no % n.right === 0 || no === 1)) out.push("right");
  return out;
}

/** Rough gauge from yarn/needle thickness (mm) and hand tension. */
export function estimateGauge(t: { yarn: number; needle: number; tension: Tension }) {
  const k = t.tension === "loose" ? 1.08 : t.tension === "tight" ? 0.93 : 1;
  const size = (t.needle * 0.8 + t.yarn * 0.2) * k; // effective stitch size, mm
  const sts = clamp(Math.round(100 / (size * 1.087)), 4, 80);
  const rows = clamp(Math.round(100 / (size * 0.988)), 4, 120);
  return { sts, rows };
}

/** Nearest-neighbour rescale of a page's pattern to a new size. */
export function scalePage(p: GridPage, cols: number, rows: number): GridPage {
  cols = clamp(Math.round(cols), 1, MAX_DIM);
  rows = clamp(Math.round(rows), 1, MAX_DIM);
  const cells = new Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    const sr = Math.min(p.rows - 1, Math.floor(((r + 0.5) * p.rows) / rows));
    for (let c = 0; c < cols; c++) {
      const sc = Math.min(p.cols - 1, Math.floor(((c + 0.5) * p.cols) / cols));
      cells[r * cols + c] = p.cells[sr * p.cols + sc];
    }
  }
  return { ...p, cols, rows, cells };
}

/** Written (서술형) instructions: one line per row, colour runs in working order. */
export function writtenRows(p: GridPage, names: (v: number) => string, n: Numbering): string[] {
  const out: string[] = [];
  for (let k = 1; k <= p.rows; k++) {
    const r = n.flipRows ? p.rows - k : k - 1;
    const rightToLeft = n.alternate ? (k % 2 === 1) === n.flipSts : n.flipSts;
    const runs: string[] = [];
    let prev: number | null = null;
    let len = 0;
    for (let i = 0; i < p.cols; i++) {
      const c = rightToLeft ? p.cols - 1 - i : i;
      const v = eff(p.cells[r * p.cols + c]);
      if (v === prev) len++;
      else {
        if (prev !== null) runs.push(`${names(prev)} ${len}`);
        prev = v;
        len = 1;
      }
    }
    if (prev !== null) runs.push(`${names(prev)} ${len}`);
    out.push(`${k}단: ${runs.join(", ")}`);
  }
  return out;
}

export const MAX_DIM = 300;
export const MAX_COLORS = 12;
export const DEFAULT_FLOAT = 5;

export type Rect = { c: number; r: number; w: number; h: number };
export type Block = { cols: number; rows: number; cells: number[] };

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const eff = (v: number) => (v < 0 ? 0 : v);

export function activePage(d: GridData): GridPage {
  return d.pages.find((p) => p.id === d.activePageId) ?? d.pages[0];
}

export function blankPage(name: string, cols: number, rows: number): GridPage {
  return { id: uid(), name, cols, rows, cells: Array(cols * rows).fill(-1) };
}

export const isEmptyPage = (p: GridPage) => p.cells.every((v) => v <= 0);
export const isBrandNew = (d: GridData) => d.pages.length === 1 && isEmptyPage(d.pages[0]);

/** Cell height ÷ cell width, in screen terms. Knit stitches are wider than tall. */
export function cellAspect(mode: GridMode, gauge: { sts: number; rows: number }) {
  if (mode !== "knit") return 1;
  const a = gauge.sts / Math.max(1, gauge.rows);
  return clamp(a, 0.4, 1.6);
}

export function finishedSize(cols: number, rows: number, gauge: { sts: number; rows: number }) {
  const w = (cols * 10) / Math.max(1, gauge.sts);
  const h = (rows * 10) / Math.max(1, gauge.rows);
  return { w: Math.round(w * 10) / 10, h: Math.round(h * 10) / 10 };
}

// ---------- block ops ----------

export function getBlock(p: GridPage, s: Rect): Block {
  const cells: number[] = [];
  for (let r = s.r; r < s.r + s.h; r++)
    for (let c = s.c; c < s.c + s.w; c++) cells.push(c >= 0 && r >= 0 && c < p.cols && r < p.rows ? p.cells[r * p.cols + c] : -1);
  return { cols: s.w, rows: s.h, cells };
}

/** Pastes a block (clipped). `transparent` skips -1 cells of the block. */
export function putBlock(p: GridPage, b: Block, c0: number, r0: number, transparent = false): GridPage {
  const cells = p.cells.slice();
  for (let r = 0; r < b.rows; r++) {
    const y = r0 + r;
    if (y < 0 || y >= p.rows) continue;
    for (let c = 0; c < b.cols; c++) {
      const x = c0 + c;
      if (x < 0 || x >= p.cols) continue;
      const v = b.cells[r * b.cols + c];
      if (transparent && v < 0) continue;
      cells[y * p.cols + x] = v;
    }
  }
  return { ...p, cells };
}

export function fillRect(p: GridPage, s: Rect, v: number): GridPage {
  const cells = p.cells.slice();
  for (let r = Math.max(0, s.r); r < Math.min(p.rows, s.r + s.h); r++)
    for (let c = Math.max(0, s.c); c < Math.min(p.cols, s.c + s.w); c++) cells[r * p.cols + c] = v;
  return { ...p, cells };
}

export const flipBlockH = (b: Block): Block => ({
  ...b,
  cells: b.cells.map((_, i) => b.cells[Math.floor(i / b.cols) * b.cols + (b.cols - 1 - (i % b.cols))]),
});
export const flipBlockV = (b: Block): Block => ({
  ...b,
  cells: b.cells.map((_, i) => b.cells[(b.rows - 1 - Math.floor(i / b.cols)) * b.cols + (i % b.cols)]),
});
/** Rotates 90°. cw: new[r][c] = old[rows-1-c][r] */
export function rotateBlock(b: Block, cw: boolean): Block {
  const cols = b.rows;
  const rows = b.cols;
  const cells = new Array(cols * rows);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const src = cw ? (b.rows - 1 - c) * b.cols + r : c * b.cols + (b.cols - 1 - r);
      cells[r * cols + c] = b.cells[src];
    }
  return { cols, rows, cells };
}

export function transformPage(p: GridPage, op: "flipH" | "flipV" | "cw" | "ccw"): GridPage {
  const b: Block = { cols: p.cols, rows: p.rows, cells: p.cells };
  const out = op === "flipH" ? flipBlockH(b) : op === "flipV" ? flipBlockV(b) : rotateBlock(b, op === "cw");
  return { ...p, ...out };
}

/** Transforms only the selected rect. Rotation keeps the centre; returns the new rect. */
export function transformSelection(p: GridPage, s: Rect, op: "flipH" | "flipV" | "cw" | "ccw"): { page: GridPage; sel: Rect } {
  const b = getBlock(p, s);
  if (op === "flipH" || op === "flipV") return { page: putBlock(p, op === "flipH" ? flipBlockH(b) : flipBlockV(b), s.c, s.r), sel: s };
  const rb = rotateBlock(b, op === "cw");
  const c = Math.round(s.c + s.w / 2 - rb.cols / 2);
  const r = Math.round(s.r + s.h / 2 - rb.rows / 2);
  const cleared = fillRect(p, s, -1);
  return { page: putBlock(cleared, rb, c, r), sel: clipRect({ c, r, w: rb.cols, h: rb.rows }, p.cols, p.rows) };
}

export function clipRect(s: Rect, cols: number, rows: number): Rect {
  const c0 = clamp(s.c, 0, cols);
  const r0 = clamp(s.r, 0, rows);
  const c1 = clamp(s.c + s.w, 0, cols);
  const r1 = clamp(s.r + s.h, 0, rows);
  return { c: c0, r: r0, w: c1 - c0, h: r1 - r0 };
}

export const rectFrom = (a: { c: number; r: number }, b: { c: number; r: number }): Rect => ({
  c: Math.min(a.c, b.c),
  r: Math.min(a.r, b.r),
  w: Math.abs(a.c - b.c) + 1,
  h: Math.abs(a.r - b.r) + 1,
});

export function floodFill(p: GridPage, c0: number, r0: number, v: number): GridPage {
  const { cols, rows } = p;
  const target = eff(p.cells[r0 * cols + c0]);
  if (target === eff(v)) return p;
  const cells = p.cells.slice();
  const stack = [r0 * cols + c0];
  while (stack.length) {
    const i = stack.pop()!;
    if (eff(cells[i]) !== target) continue;
    cells[i] = v;
    const c = i % cols;
    const r = (i - c) / cols;
    if (c > 0) stack.push(i - 1);
    if (c < cols - 1) stack.push(i + 1);
    if (r > 0) stack.push(i - cols);
    if (r < rows - 1) stack.push(i + cols);
  }
  return { ...p, cells };
}

/** Bresenham cells between two points (inclusive). */
export function lineCells(a: { c: number; r: number }, b: { c: number; r: number }) {
  const out: { c: number; r: number }[] = [];
  let x = a.c;
  let y = a.r;
  const dx = Math.abs(b.c - x);
  const dy = -Math.abs(b.r - y);
  const sx = x < b.c ? 1 : -1;
  const sy = y < b.r ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    out.push({ c: x, r: y });
    if (x === b.c && y === b.r) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
  return out;
}

/** Grows (positive) or crops (negative) each side of a page. */
export function padPage(p: GridPage, left: number, top: number, right: number, bottom: number): GridPage {
  const cols = clamp(p.cols + left + right, 1, MAX_DIM);
  const rows = clamp(p.rows + top + bottom, 1, MAX_DIM);
  const cells = Array(cols * rows).fill(-1);
  for (let r = 0; r < rows; r++) {
    const sr = r - top;
    if (sr < 0 || sr >= p.rows) continue;
    for (let c = 0; c < cols; c++) {
      const sc = c - left;
      if (sc < 0 || sc >= p.cols) continue;
      cells[r * cols + c] = p.cells[sr * p.cols + sc];
    }
  }
  return { ...p, cols, rows, cells };
}

export type AnchorH = "left" | "center" | "right";
export type AnchorV = "top" | "middle" | "bottom";
export function resizePage(p: GridPage, cols: number, rows: number, h: AnchorH, v: AnchorV) {
  const dc = cols - p.cols;
  const dr = rows - p.rows;
  const left = h === "left" ? 0 : h === "right" ? dc : Math.floor(dc / 2);
  const top = v === "top" ? 0 : v === "bottom" ? dr : Math.floor(dr / 2);
  return padPage(p, left, top, dc - left, dr - top);
}

// ---------- palette ----------

export function stitchCounts(p: GridPage, n: number) {
  const out = Array(n).fill(0);
  for (const v of p.cells) out[eff(v)] = (out[eff(v)] ?? 0) + 1;
  return out as number[];
}

export function removeYarn(d: GridDoc, idx: number): GridDoc {
  const fix = (v: number) => (v === idx ? -1 : v > idx ? v - 1 : v);
  return {
    ...d,
    yarns: d.yarns.filter((_, i) => i !== idx),
    pages: d.pages.map((p) => ({ ...p, cells: p.cells.map(fix) })),
  };
}

// ---------- checks ----------

export type FloatRun = { r: number; c0: number; c1: number }; // c1 exclusive

/** Runs where a colour used in the row is carried behind more than `limit` stitches. */
export function findFloats(p: GridPage, limit: number): FloatRun[] {
  const runs: FloatRun[] = [];
  const last = new Map<number, number>();
  for (let r = 0; r < p.rows; r++) {
    last.clear();
    for (let c = 0; c < p.cols; c++) {
      const k = eff(p.cells[r * p.cols + c]);
      const prev = last.get(k);
      if (prev !== undefined && c - prev - 1 > limit) runs.push({ r, c0: prev + 1, c1: c });
      last.set(k, c);
    }
  }
  return runs;
}

/** Cells with no same-coloured 4-neighbour. */
export function isolatedCells(p: GridPage): number[] {
  const out: number[] = [];
  const { cols, rows, cells } = p;
  if (cols * rows < 2) return out;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const v = eff(cells[i]);
      if (
        (c > 0 && eff(cells[i - 1]) === v) ||
        (c < cols - 1 && eff(cells[i + 1]) === v) ||
        (r > 0 && eff(cells[i - cols]) === v) ||
        (r < rows - 1 && eff(cells[i + cols]) === v)
      )
        continue;
      out.push(i);
    }
  return out;
}

/** Replaces single isolated cells with their most common neighbour colour. */
export function cleanupCells(cells: number[], cols: number, rows: number): number[] {
  const p: GridPage = { id: "", name: "", cols, rows, cells };
  const iso = isolatedCells(p);
  if (!iso.length) return cells;
  const out = cells.slice();
  for (const i of iso) {
    const c = i % cols;
    const r = (i - c) / cols;
    const tally = new Map<number, number>();
    const add = (j: number) => tally.set(cells[j] < 0 ? -1 : cells[j], (tally.get(cells[j] < 0 ? -1 : cells[j]) ?? 0) + 1);
    if (c > 0) add(i - 1);
    if (c < cols - 1) add(i + 1);
    if (r > 0) add(i - cols);
    if (r < rows - 1) add(i + cols);
    let best = out[i];
    let n = 0;
    tally.forEach((cnt, v) => {
      if (cnt > n) {
        n = cnt;
        best = v;
      }
    });
    out[i] = best;
  }
  return out;
}

/** True if any patterned cell sits inside the safe band. */
export function safeZoneHit(p: GridPage, safe: { sts: number; rows: number }) {
  if (!safe.sts && !safe.rows) return false;
  for (let r = 0; r < p.rows; r++)
    for (let c = 0; c < p.cols; c++) {
      const inBand = c < safe.sts || c >= p.cols - safe.sts || r < safe.rows || r >= p.rows - safe.rows;
      if (inBand && p.cells[r * p.cols + c] > 0) return true;
    }
  return false;
}

/** Wraps freshly converted cells with the safe-zone margin. */
export function withSafe(cells: number[], cols: number, rows: number, safe: { sts: number; rows: number }) {
  const p = padPage({ id: "", name: "", cols, rows, cells }, safe.sts, safe.rows, safe.sts, safe.rows);
  return { cols: p.cols, rows: p.rows, cells: p.cells };
}

// ---------- numbering ----------

/** Which side the row number goes on. Row 1 is the bottom row. */
export function rowSide(rowNo: number, working: "flat" | "round", hand: "right" | "left"): "right" | "left" {
  const first = hand === "right" ? "right" : "left";
  if (working === "round") return first;
  return rowNo % 2 === 1 ? first : first === "right" ? "left" : "right";
}

export const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((x) => x + x).join("") : h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const rgbToHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("");
export const luminance = (hex: string) => {
  const [r, g, b] = hexToRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b;
};
/** Thread colour used for filet blocks. */
export const filetInk = (yarns: string[]) => yarns[1] ?? "#24365c";
