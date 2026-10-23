// Pure helpers for the knitting chart document: geometry, cell edits, block ops.
import { uid } from "@/lib/id";
import { knitSymbol } from "@/lib/symbols/knitting";
import type { KnitCell, KnitData, KnitGrid } from "@/lib/types";

/** chart cell: 28px tall; stitches are 37px wide unless the gauge sets the aspect */
export const CELL_H = 28;
export const CELL_W = 37;
export const BIG_GRID = 20000;

/**
 * Row/stitch numbers. Each side holds its label interval (0 = hidden); 1 is always labelled.
 * reverseRows: row 1 is the bottom row; reverseCols: stitch 1 is the right-most column.
 */
export type Numbering = { left: number; top: number; right: number; bottom: number; offset: number; reverseRows: boolean; reverseCols: boolean };
export const DEFAULT_NUMBERING: Numbering = { left: 0, top: 0, right: 5, bottom: 5, offset: 0, reverseRows: true, reverseCols: true };
type LegacyNumbering = { side?: "left" | "right"; alternate?: boolean; interval?: number };
export function numberingOf(n: unknown): Numbering {
  if (!n || typeof n !== "object") return DEFAULT_NUMBERING;
  const o = n as Partial<Numbering> & LegacyNumbering;
  if (typeof o.right === "number" || typeof o.left === "number") return { ...DEFAULT_NUMBERING, ...o };
  // documents saved with { side, alternate, interval }
  const iv = Math.max(1, o.interval ?? 1);
  return { ...DEFAULT_NUMBERING, left: o.alternate || o.side === "left" ? iv : 0, right: o.alternate || o.side !== "left" ? iv : 0, bottom: iv };
}

export type RowSides = { worked: "flat" | "round"; firstRowSide: "RS" | "WS" };
export const DEFAULT_ROW_SIDES: RowSides = { worked: "flat", firstRowSide: "RS" };

// Optional fields this editor stores alongside the shared types.
export type KGrid = KnitGrid & { numbering?: Numbering; sides?: RowSides };
export type KDoc = Omit<KnitData, "grids"> & { grids: KGrid[]; gaugeOn?: boolean; bg?: { color: string; opacity: number } };

export type Geo = { cw: number; ch: number };
/** gauge off: fixed 37 × 28 cells; gauge on: the cell aspect follows stitches/rows per 10cm */
export const geoOf = (d: { gauge: KnitData["gauge"]; gaugeOn?: boolean }): Geo =>
  d.gaugeOn ? { cw: Math.round(((CELL_H * d.gauge.rows) / d.gauge.sts) * 100) / 100, ch: CELL_H } : { cw: CELL_W, ch: CELL_H };

export type Rect = { c0: number; r0: number; c1: number; r1: number };
export type Sel = Rect & { gridId: string };
export type Block = { cols: number; rows: number; cells: KnitCell[] };

export const symWidth = (id?: string) => knitSymbol(id)?.width ?? 1;
export const mod = (a: number, n: number) => ((a % n) + n) % n;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function normRect(a: { c: number; r: number }, b: { c: number; r: number }): Rect {
  return { c0: Math.min(a.c, b.c), r0: Math.min(a.r, b.r), c1: Math.max(a.c, b.c), r1: Math.max(a.r, b.r) };
}
export const rectW = (r: Rect) => r.c1 - r.c0 + 1;
export const rectH = (r: Rect) => r.r1 - r.r0 + 1;
export function clipRect(r: Rect, g: { cols: number; rows: number }): Rect | null {
  const c0 = Math.max(0, r.c0);
  const r0 = Math.max(0, r.r0);
  const c1 = Math.min(g.cols - 1, r.c1);
  const r1 = Math.min(g.rows - 1, r.r1);
  return c0 > c1 || r0 > r1 ? null : { c0, r0, c1, r1 };
}

/** builds a cell, dropping empty keys */
export function mk(symbol?: string, color?: string): KnitCell {
  if (!symbol && !color) return null;
  const c: { symbol?: string; color?: string } = {};
  if (symbol) c.symbol = symbol;
  if (color) c.color = color;
  return c;
}

export function newGrid(name: string, x: number, y: number, cols: number, rows: number): KGrid {
  return { id: uid(), name, x: Math.round(x), y: Math.round(y), cols, rows, cells: Array(cols * rows).fill(null), visible: true };
}

/** For one row: owner[c] = column of the symbol drawn over c (or -1). Wide symbols hide what they cover. */
export function rowOwners(g: KnitGrid, r: number): Int16Array {
  const out = new Int16Array(g.cols).fill(-1);
  let skip = 0;
  let owner = -1;
  for (let c = 0; c < g.cols; c++) {
    if (skip > 0) {
      out[c] = owner;
      skip--;
      continue;
    }
    const s = g.cells[r * g.cols + c]?.symbol;
    if (s) {
      owner = c;
      out[c] = c;
      skip = symWidth(s) - 1;
    }
  }
  return out;
}

const withCells = (g: KGrid, cells: KnitCell[]): KGrid => ({ ...g, cells });

/** Places a symbol with its left edge at (r, c). Returns null when a wide symbol does not fit. */
export function placeSymbol(g: KGrid, r: number, c: number, id: string): KGrid | null {
  const w = symWidth(id);
  if (c + w > g.cols) return null;
  const owners = rowOwners(g, r);
  const cells = g.cells.slice();
  // clear anything currently drawn over the target span
  for (let k = c; k < c + w; k++) {
    const o = owners[k];
    if (o >= 0) {
      const cell = cells[r * g.cols + o];
      cells[r * g.cols + o] = mk(undefined, cell?.color);
    }
    const cell = cells[r * g.cols + k];
    cells[r * g.cols + k] = mk(undefined, cell?.color);
  }
  const at = r * g.cols + c;
  cells[at] = mk(id, cells[at]?.color);
  return withCells(g, cells);
}

export function eraseSymbol(g: KGrid, r: number, c: number): KGrid {
  const o = rowOwners(g, r)[c];
  if (o < 0) return g;
  const cells = g.cells.slice();
  const i = r * g.cols + o;
  cells[i] = mk(undefined, cells[i]?.color);
  return withCells(g, cells);
}

export function symbolAt(g: KnitGrid, r: number, c: number): { id: string; c: number } | null {
  const o = rowOwners(g, r)[c];
  const id = o >= 0 ? g.cells[r * g.cols + o]?.symbol : undefined;
  return id ? { id, c: o } : null;
}

export function paintCells(g: KGrid, list: { r: number; c: number }[], color: string | null): KGrid {
  let changed = false;
  const cells = g.cells.slice();
  for (const { r, c } of list) {
    if (r < 0 || c < 0 || r >= g.rows || c >= g.cols) continue;
    const i = r * g.cols + c;
    const cur = cells[i];
    if ((cur?.color ?? null) === color) continue;
    cells[i] = mk(cur?.symbol, color ?? undefined);
    changed = true;
  }
  return changed ? withCells(g, cells) : g;
}

export function readBlock(g: KnitGrid, r: Rect): Block {
  const cols = rectW(r);
  const rows = rectH(r);
  const cells: KnitCell[] = [];
  for (let y = r.r0; y <= r.r1; y++) for (let x = r.c0; x <= r.c1; x++) cells.push(g.cells[y * g.cols + x] ?? null);
  return { cols, rows, cells };
}

export function clearRect(g: KGrid, r: Rect): KGrid {
  const cells = g.cells.slice();
  for (let y = r.r0; y <= r.r1; y++) for (let x = r.c0; x <= r.c1; x++) cells[y * g.cols + x] = null;
  return withCells(g, cells);
}

/**
 * Writes a block with its top-left at (c, r), clipped to the grid.
 * merge: keep destination colours where the block has none (used for stamping patterns).
 */
export function writeBlock(g: KGrid, b: Block, c: number, r: number, merge = false): KGrid {
  const cells = g.cells.slice();
  for (let y = 0; y < b.rows; y++) {
    const ry = r + y;
    if (ry < 0 || ry >= g.rows) continue;
    for (let x = 0; x < b.cols; x++) {
      const cx = c + x;
      if (cx < 0 || cx >= g.cols) continue;
      const src = b.cells[y * b.cols + x];
      const i = ry * g.cols + cx;
      cells[i] = merge ? mk(src?.symbol, src?.color ?? cells[i]?.color) : src ? { ...src } : null;
    }
  }
  return withCells(g, cells);
}

/** Repeats `b` over `region`, aligned so that block (0,0) sits at `origin`. */
export function tileBlock(g: KGrid, b: Block, region: Rect, origin: { c: number; r: number }, merge = false): KGrid {
  const cells = g.cells.slice();
  for (let y = region.r0; y <= region.r1; y++) {
    if (y < 0 || y >= g.rows) continue;
    for (let x = region.c0; x <= region.c1; x++) {
      if (x < 0 || x >= g.cols) continue;
      const src = b.cells[mod(y - origin.r, b.rows) * b.cols + mod(x - origin.c, b.cols)];
      const i = y * g.cols + x;
      cells[i] = merge ? mk(src?.symbol, src?.color ?? cells[i]?.color) : src ? { ...src } : null;
    }
  }
  return withCells(g, cells);
}

export function flipBlockH(b: Block): Block {
  const cells: KnitCell[] = Array(b.cols * b.rows).fill(null);
  for (let y = 0; y < b.rows; y++) {
    // colours mirror cell by cell
    for (let x = 0; x < b.cols; x++) {
      const col = b.cells[y * b.cols + x]?.color;
      if (col) cells[y * b.cols + (b.cols - 1 - x)] = mk(undefined, col);
    }
    // symbols keep their left anchor, so wide ones shift by their width
    for (let x = 0; x < b.cols; x++) {
      const s = b.cells[y * b.cols + x]?.symbol;
      if (!s) continue;
      const sym = knitSymbol(s);
      const w = sym?.width ?? 1;
      const nx = b.cols - 1 - x - (w - 1);
      if (nx < 0) continue;
      const i = y * b.cols + nx;
      cells[i] = mk(sym?.mirror ?? s, cells[i]?.color);
    }
  }
  return { ...b, cells };
}

export function flipBlockV(b: Block): Block {
  const cells: KnitCell[] = [];
  for (let y = b.rows - 1; y >= 0; y--) cells.push(...b.cells.slice(y * b.cols, (y + 1) * b.cols));
  return { ...b, cells };
}

export function rotateBlockCW(b: Block): Block {
  const cols = b.rows;
  const rows = b.cols;
  const cells: KnitCell[] = Array(cols * rows).fill(null);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) cells[y * cols + x] = b.cells[(b.rows - 1 - x) * b.cols + y] ?? null;
  return { cols, rows, cells };
}

/** Adds (positive) or removes (negative) whole columns/rows on each side. */
export function resizeGrid(g: KGrid, d: { left: number; right: number; top: number; bottom: number }, geo: Geo): KGrid {
  const cols = Math.max(1, g.cols + d.left + d.right);
  const rows = Math.max(1, g.rows + d.top + d.bottom);
  const cells: KnitCell[] = Array(cols * rows).fill(null);
  for (let y = 0; y < rows; y++) {
    const sy = y - d.top;
    if (sy < 0 || sy >= g.rows) continue;
    for (let x = 0; x < cols; x++) {
      const sx = x - d.left;
      if (sx < 0 || sx >= g.cols) continue;
      cells[y * cols + x] = g.cells[sy * g.cols + sx];
    }
  }
  return { ...g, cols, rows, cells, x: g.x - d.left * geo.cw, y: g.y - d.top * geo.ch };
}

/** cells that hold a symbol or colour (cells covered by a wide symbol count too) */
export function filledCount(g: KnitGrid) {
  let n = 0;
  for (let r = 0; r < g.rows; r++) {
    const owners = rowOwners(g, r);
    for (let c = 0; c < g.cols; c++) if (owners[c] >= 0 || g.cells[r * g.cols + c]?.color) n++;
  }
  return n;
}

export function colorCounts(g: KnitGrid): { color: string; count: number }[] {
  const m = new Map<string, number>();
  for (const c of g.cells) if (c?.color) m.set(c.color, (m.get(c.color) ?? 0) + 1);
  return [...m.entries()].map(([color, count]) => ({ color, count })).sort((a, b) => b.count - a.count);
}

/** cells along a line (for fast drags) */
export function cellLine(a: { c: number; r: number }, b: { c: number; r: number }) {
  const out: { c: number; r: number }[] = [];
  let x = a.c;
  let y = a.r;
  const dx = Math.abs(b.c - a.c);
  const dy = -Math.abs(b.r - a.r);
  const sx = a.c < b.c ? 1 : -1;
  const sy = a.r < b.r ? 1 : -1;
  let err = dx + dy;
  for (let guard = 0; guard < 10000; guard++) {
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

/** perceived lightness 0..1 of a #rrggbb colour */
export function lightness(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function gridBounds(grids: KnitGrid[], geo: Geo) {
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
  return Number.isFinite(x0) ? { x0, y0, x1, y1 } : null;
}

export function nextGridName(grids: KnitGrid[]) {
  let n = grids.length + 1;
  const names = new Set(grids.map((g) => g.name));
  while (names.has(`격자 ${n}`)) n++;
  return `격자 ${n}`;
}
