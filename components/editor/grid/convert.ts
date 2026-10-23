"use client";

// Text → cells and image → yarn colours. Runs in the browser (offscreen canvas).
import { MAX_COLORS, MAX_DIM, clamp, cleanupCells, rgbToHex } from "./model";

export type FontKey = "sans" | "serif" | "mono";
export const FONTS: { value: FontKey; label: string; css: string }[] = [
  { value: "sans", label: "Pretendard", css: '"Pretendard Variable", Pretendard, sans-serif' },
  { value: "serif", label: "명조", css: '"Noto Serif KR", "Nanum Myeongjo", "AppleMyungjo", serif' },
  { value: "mono", label: "고정폭", css: 'ui-monospace, "SF Mono", Menlo, monospace' },
];

export type TextOpts = {
  text: string;
  font: FontKey;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  cols: number;
  rows: number;
  lockHeight: boolean;
  margin: number;
  border: number;
  threshold: number; // 0–255, cell filled when its brightness is below this
  invert: boolean;
};

export type Converted = { cols: number; rows: number; cells: number[]; yarns?: string[] };

const canvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
};

const fontString = (o: Pick<TextOpts, "font" | "bold" | "italic">, px: number) =>
  `${o.italic ? "italic " : ""}${o.bold ? 800 : 400} ${px}px ${FONTS.find((f) => f.value === o.font)!.css}`;

export async function ensureFont(o: Pick<TextOpts, "font" | "bold" | "italic">) {
  try {
    await document.fonts.load(fontString(o, 64), "가A");
  } catch {
    /* fall back to whatever is available */
  }
}

/**
 * Renders text into a cols×rows grid. `aspect` = cell height / width.
 * When height is not locked, rows are derived from the text's proportions.
 * Filled cells get value `fg`, empty cells -1.
 */
export function textToCells(o: TextOpts, aspect: number, fg: number): Converted {
  const text = o.text.trim() || " ";
  const pad = Math.max(0, o.margin) + Math.max(0, o.border);
  const cols = clamp(Math.round(o.cols), 1, MAX_DIM);
  const innerCols = Math.max(1, cols - pad * 2);

  // measure
  const PX = 200;
  const mctx = canvas(8, 8).getContext("2d")!;
  mctx.font = fontString(o, PX);
  const m = mctx.measureText(text);
  const left = m.actualBoundingBoxLeft ?? 0;
  const tw = Math.max(1, (m.actualBoundingBoxRight ?? m.width) + left);
  const asc = m.actualBoundingBoxAscent || PX * 0.75;
  const desc = Math.max(m.actualBoundingBoxDescent || 0, o.underline ? PX * 0.16 : 0);
  const th = Math.max(1, asc + desc);

  let rows: number;
  if (o.lockHeight) rows = clamp(Math.round(o.rows), 1, MAX_DIM);
  else {
    const innerRows = Math.max(1, Math.round((innerCols * th) / tw / aspect));
    rows = clamp(innerRows + pad * 2, 1, MAX_DIM);
  }
  const innerRows = Math.max(1, rows - pad * 2);

  // raster at K samples per cell width; physical (square) pixels
  const K = 10;
  const W = innerCols * K;
  const H = Math.max(1, Math.round(innerRows * K * aspect));
  const cv = canvas(W, H);
  const ctx = cv.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);
  const s = Math.min(W / tw, H / th);
  ctx.save();
  ctx.translate((W - tw * s) / 2 + left * s, (H - th * s) / 2 + asc * s);
  ctx.scale(s, s);
  ctx.font = fontString(o, PX);
  ctx.fillStyle = "#000";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, 0, 0);
  if (o.underline) ctx.fillRect(-left, PX * 0.08, tw, PX * 0.07);
  ctx.restore();

  const img = ctx.getImageData(0, 0, cv.width, cv.height).data;
  const cells = Array(cols * rows).fill(-1);
  const cw = cv.width / innerCols;
  const ch = cv.height / innerRows;
  for (let r = 0; r < innerRows; r++)
    for (let c = 0; c < innerCols; c++) {
      let sum = 0;
      let n = 0;
      const x0 = Math.floor(c * cw);
      const x1 = Math.max(x0 + 1, Math.floor((c + 1) * cw));
      const y0 = Math.floor(r * ch);
      const y1 = Math.max(y0 + 1, Math.floor((r + 1) * ch));
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          sum += img[(y * cv.width + x) * 4];
          n++;
        }
      const filled = sum / n < o.threshold;
      if (filled) cells[(r + pad) * cols + c + pad] = fg;
    }
  if (o.invert)
    for (let r = o.border; r < rows - o.border; r++)
      for (let c = o.border; c < cols - o.border; c++) {
        const i = r * cols + c;
        cells[i] = cells[i] === -1 ? fg : -1;
      }
  if (o.border > 0)
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if (c < o.border || c >= cols - o.border || r < o.border || r >= rows - o.border) cells[r * cols + c] = fg;
  return { cols, rows, cells };
}

// ---------- image ----------

export type ImageOpts = { cols: number; colors: number; dither: boolean; cleanup: boolean };
export type LoadedImage = { width: number; height: number; pixels: (cols: number, rows: number) => Uint8ClampedArray; name: string };

export async function loadImage(file: Blob, name = "image"): Promise<LoadedImage> {
  const bmp = await createImageBitmap(file);
  const width = bmp.width;
  const height = bmp.height;
  const cache = new Map<string, Uint8ClampedArray>();
  return {
    width,
    height,
    name,
    pixels(cols, rows) {
      const key = `${cols}x${rows}`;
      const hit = cache.get(key);
      if (hit) return hit;
      // draw at 4× then box-average for a clean area sample
      const S = 4;
      const cv = canvas(cols * S, rows * S);
      const ctx = cv.getContext("2d", { willReadFrequently: true })!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bmp, 0, 0, cv.width, cv.height);
      const src = ctx.getImageData(0, 0, cv.width, cv.height).data;
      const out = new Uint8ClampedArray(cols * rows * 3);
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          let R = 0,
            G = 0,
            B = 0;
          for (let y = 0; y < S; y++)
            for (let x = 0; x < S; x++) {
              const i = ((r * S + y) * cv.width + c * S + x) * 4;
              R += src[i];
              G += src[i + 1];
              B += src[i + 2];
            }
          const o = (r * cols + c) * 3;
          out[o] = R / (S * S);
          out[o + 1] = G / (S * S);
          out[o + 2] = B / (S * S);
        }
      cache.set(key, out);
      return out;
    },
  };
}

export function imageRows(img: LoadedImage, cols: number, aspect: number) {
  return clamp(Math.round((cols * img.height) / img.width / aspect), 1, MAX_DIM);
}

type RGB = [number, number, number];
const dist2 = (a: RGB, b: RGB) => {
  // weighted RGB distance (cheap perceptual approximation)
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return 2 * dr * dr + 4 * dg * dg + 3 * db * db;
};

/** Median-cut seed palette. */
function medianCut(px: RGB[], k: number): RGB[] {
  type Box = RGB[];
  const boxes: Box[] = [px];
  const range = (b: Box) => {
    const lo = [255, 255, 255];
    const hi = [0, 0, 0];
    for (const p of b)
      for (let i = 0; i < 3; i++) {
        if (p[i] < lo[i]) lo[i] = p[i];
        if (p[i] > hi[i]) hi[i] = p[i];
      }
    const d = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
    const ch = d[1] >= d[0] && d[1] >= d[2] ? 1 : d[0] >= d[2] ? 0 : 2;
    return { ch, span: d[ch] };
  };
  while (boxes.length < k) {
    let bi = -1;
    let best = 0;
    boxes.forEach((b, i) => {
      if (b.length < 2) return;
      const { span } = range(b);
      const score = span * Math.sqrt(b.length);
      if (score > best) {
        best = score;
        bi = i;
      }
    });
    if (bi < 0) break;
    const b = boxes[bi];
    const { ch } = range(b);
    b.sort((x, y) => x[ch] - y[ch]);
    const mid = b.length >> 1;
    boxes.splice(bi, 1, b.slice(0, mid), b.slice(mid));
  }
  return boxes.map((b) => {
    const s = [0, 0, 0];
    for (const p of b) for (let i = 0; i < 3; i++) s[i] += p[i];
    return [s[0] / b.length, s[1] / b.length, s[2] / b.length] as RGB;
  });
}

type Bin = { c: RGB; n: number };

/** 5-bit-per-channel histogram so palette search runs on distinct colours, weighted by count. */
function histogram(px: RGB[]): Bin[] {
  const m = new Map<number, { s: [number, number, number]; n: number }>();
  for (const p of px) {
    const key = ((p[0] >> 3) << 10) | ((p[1] >> 3) << 5) | (p[2] >> 3);
    const b = m.get(key);
    if (b) {
      b.s[0] += p[0];
      b.s[1] += p[1];
      b.s[2] += p[2];
      b.n++;
    } else m.set(key, { s: [p[0], p[1], p[2]], n: 1 });
  }
  return [...m.values()].map((b) => ({ c: [b.s[0] / b.n, b.s[1] / b.n, b.s[2] / b.n] as RGB, n: b.n }));
}

/** Farthest-point seeds weighted by how common a colour is (ignores thin anti-aliasing fringes). */
function maximinSeeds(bins: Bin[], k: number): RGB[] {
  const sorted = bins.slice().sort((a, b) => b.n - a.n);
  const seeds: RGB[] = [sorted[0].c];
  const minD = sorted.map((b) => dist2(b.c, seeds[0]));
  while (seeds.length < Math.min(k, sorted.length)) {
    let bi = -1;
    let best = -1;
    for (let i = 0; i < sorted.length; i++) {
      const score = minD[i] * Math.sqrt(sorted[i].n);
      if (score > best) {
        best = score;
        bi = i;
      }
    }
    if (bi < 0 || minD[bi] === 0) break;
    seeds.push(sorted[bi].c);
    for (let i = 0; i < sorted.length; i++) minD[i] = Math.min(minD[i], dist2(sorted[i].c, sorted[bi].c));
  }
  return seeds;
}

function kmeansBins(bins: Bin[], seed: RGB[], iters = 10): { pal: RGB[]; err: number } {
  let cent = seed.map((c) => [...c] as RGB);
  let err = 0;
  for (let it = 0; it <= iters; it++) {
    const sum = cent.map(() => [0, 0, 0, 0]);
    err = 0;
    for (const b of bins) {
      let bi = 0;
      let bd = Infinity;
      for (let j = 0; j < cent.length; j++) {
        const d = dist2(b.c, cent[j]);
        if (d < bd) {
          bd = d;
          bi = j;
        }
      }
      err += bd * b.n;
      const s = sum[bi];
      s[0] += b.c[0] * b.n;
      s[1] += b.c[1] * b.n;
      s[2] += b.c[2] * b.n;
      s[3] += b.n;
    }
    if (it < iters) cent = cent.map((c, j) => (sum[j][3] ? ([sum[j][0] / sum[j][3], sum[j][1] / sum[j][3], sum[j][2] / sum[j][3]] as RGB) : c));
  }
  return { pal: cent, err };
}

/** Median cut and weighted farthest-point seeds, each refined by k-means; keeps the better one. */
function buildPalette(px: RGB[], k: number): RGB[] {
  const bins = histogram(px);
  if (bins.length <= k) return bins.map((b) => b.c);
  const a = kmeansBins(bins, medianCut(px.slice(), k));
  const b = kmeansBins(bins, maximinSeeds(bins, k));
  return (a.err <= b.err ? a : b).pal;
}

const nearest = (p: RGB, pal: RGB[]) => {
  let bi = 0;
  let bd = Infinity;
  for (let j = 0; j < pal.length; j++) {
    const d = dist2(p, pal[j]);
    if (d < bd) {
      bd = d;
      bi = j;
    }
  }
  return bi;
};

/** Rough count of colours that really matter in the image (for advice). */
export function distinctColors(img: LoadedImage): number {
  const cols = Math.min(64, img.width);
  const rows = Math.max(1, Math.round((cols * img.height) / img.width));
  const px = img.pixels(cols, rows);
  const n = cols * rows;
  const buckets = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    const k = ((px[i * 3] >> 5) << 6) | ((px[i * 3 + 1] >> 5) << 3) | (px[i * 3 + 2] >> 5);
    buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  let count = 0;
  buckets.forEach((v) => v >= n * 0.01 && count++);
  return clamp(count, 1, 99);
}

export function imageToCells(img: LoadedImage, o: ImageOpts, aspect: number): Converted {
  const cols = clamp(Math.round(o.cols), 1, MAX_DIM);
  const rows = imageRows(img, cols, aspect);
  const k = clamp(Math.round(o.colors), 2, MAX_COLORS);
  const raw = img.pixels(cols, rows);
  const px: RGB[] = [];
  for (let i = 0; i < cols * rows; i++) px.push([raw[i * 3], raw[i * 3 + 1], raw[i * 3 + 2]]);

  const pal = buildPalette(px, k);
  let idx: number[];
  if (o.dither) {
    const buf = px.map((p) => [...p] as RGB);
    idx = Array(cols * rows);
    const spread = (i: number, e: RGB, f: number) => {
      const t = buf[i];
      t[0] += e[0] * f;
      t[1] += e[1] * f;
      t[2] += e[2] * f;
    };
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const p = buf[i].map((v) => clamp(v, 0, 255)) as RGB;
        const j = nearest(p, pal);
        idx[i] = j;
        const e: RGB = [p[0] - pal[j][0], p[1] - pal[j][1], p[2] - pal[j][2]];
        if (c < cols - 1) spread(i + 1, e, 7 / 16);
        if (r < rows - 1) {
          if (c > 0) spread(i + cols - 1, e, 3 / 16);
          spread(i + cols, e, 5 / 16);
          if (c < cols - 1) spread(i + cols + 1, e, 1 / 16);
        }
      }
  } else idx = px.map((p) => nearest(p, pal));
  if (o.cleanup) idx = cleanupCells(idx, cols, rows);

  // order palette: most used first (becomes the background yarn), drop unused
  const count = pal.map(() => 0);
  idx.forEach((j) => count[j]++);
  const order = pal.map((_, j) => j).filter((j) => count[j] > 0).sort((a, b) => count[b] - count[a]);
  const remap = new Map(order.map((j, n) => [j, n]));
  const yarns = order.map((j) => rgbToHex(pal[j][0], pal[j][1], pal[j][2]));
  const cells = idx.map((j) => {
    const n = remap.get(j)!;
    return n === 0 ? -1 : n;
  });
  return { cols, rows, cells, yarns };
}
