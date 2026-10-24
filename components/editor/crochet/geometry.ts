// Pure geometry + serialisation helpers for the crochet whiteboard.
import { uid } from "@/lib/id";
import type { CrochetItem, CrochetLayer, GatherItem, StitchHeights, StitchItem, StrokeItem, TextItem } from "@/lib/types";
import { INK, STROKE_WIDTH, gatherGeom, getSymbol, primsToSvg, symbolSize, type CrochetSymbol, type Prim } from "@/lib/symbols/crochet";

export type Pt = { x: number; y: number };
export type Box = { x0: number; y0: number; x1: number; y1: number };

export const SNAP = 10;
export const snap = (v: number, on = true) => (on ? Math.round(v / SNAP) * SNAP : v);
const RAD = Math.PI / 180;
const r2 = (n: number) => Math.round(n * 100) / 100;

// ---------- 기호 높이 (doc-level tall-stitch heights) ----------

/** Height classes shown in the 기호 높이 dialog: chain units → label. */
export const HEIGHT_CLASSES: { units: number; label: string }[] = [
  { units: 2, label: "긴뜨기" },
  { units: 3, label: "한길긴뜨기" },
  { units: 4, label: "두길긴뜨기" },
  { units: 5, label: "세길긴뜨기" },
  { units: 6, label: "네길긴뜨기" },
  { units: 7, label: "다섯길긴뜨기" },
];

let heights: StitchHeights | undefined;
let heightsKey = "";

/**
 * Sets the heights every geometry call uses (one editor is mounted at a time).
 * Returns a key that changes whenever the heights do (used to re-render memoised items).
 */
export function setStitchHeights(h: StitchHeights | undefined): string {
  const key = h ? JSON.stringify(h) : "";
  if (key !== heightsKey) {
    heights = h;
    heightsKey = key;
  }
  return heightsKey;
}

/** True for symbols drawn N chains tall that follow the 기호 높이 setting. */
export const followsHeights = (s: CrochetSymbol) => s.units >= 2 && !s.gather && (!!s.tall || s.stretch === "v");

/** Vertical factor the doc's 기호 높이 applies to a symbol (1 = its own height). */
export function heightFactor(id: string): number {
  if (!heights) return 1;
  const s = getSymbol(id);
  if (!s || !followsHeights(s)) return 1;
  const u = heights.units?.[String(s.units)];
  const k = (u && u > 0 ? u / s.units : 1) * (heights.scale && heights.scale > 0 ? heights.scale : 1);
  return Math.round(k * 1000) / 1000;
}

// ---------- symbol geometry ----------

/**
 * `oy`: local y of the box centre when 기호 높이 stretched the symbol. Stretching keeps the foot where the
 * unstretched foot was, so the drawing moves up by half the extra height (0 / absent otherwise).
 */
export type Geom = { w: number; h: number; prims: Prim[]; oy?: number };
/** Local y of the foot (bottom centre) of a geometry. */
export const geomFoot = (g: Geom) => g.h / 2 + (g.oy ?? 0);
const lift = (prims: Prim[], oy: number): Prim[] => [{ t: "g", transform: `translate(0 ${r2(oy)})`, children: prims }];
const stitchCache = new Map<string, Geom>();
const MISSING: Prim[] = [{ t: "path", d: "M-6 -6H6V6H-6ZM-6 -6L6 6" }];

export function stitchGeom(it: StitchItem): Geom {
  const hk = heightFactor(it.symbol);
  const key = `${it.symbol}|${it.scale ?? 1}|${hk}`;
  const hit = stitchCache.get(key);
  if (hit) return hit;
  const s = getSymbol(it.symbol);
  let g: Geom;
  if (!s) g = { w: 14, h: 14, prims: MISSING };
  else {
    const { w, h } = symbolSize(s, (it.scale ?? 1) * hk);
    if (hk === 1) g = { w, h, prims: s.draw({ w, h }) };
    else {
      const oy = -(h - symbolSize(s, it.scale ?? 1).h) / 2;
      g = { w, h, prims: lift(s.draw({ w, h }), oy), oy };
    }
  }
  stitchCache.set(key, g);
  return g;
}

const gatherCache = new Map<string, Geom>();
export function gatherItemGeom(it: GatherItem): Geom {
  const k = heightFactor(it.symbol);
  if (k === 1) return gatherGeom(it.kind, it.symbol, it.count, it.spread);
  const key = `${it.kind}|${it.symbol}|${it.count}|${it.spread}|${k}`;
  const hit = gatherCache.get(key);
  if (hit) return hit;
  const g = gatherGeom(it.kind, it.symbol, it.count, it.spread, false, k);
  const base = gatherGeom(it.kind, it.symbol, it.count, it.spread);
  const oy = -(g.h - base.h) / 2;
  const out: Geom = { w: g.w, h: g.h, prims: lift(g.prims, oy), oy };
  gatherCache.set(key, out);
  return out;
}

/** World point of an item's local (0, ly) (before flips). */
export function itemLocal(it: StitchItem | GatherItem, ly: number): Pt {
  const y = it.type === "stitch" && it.flipV ? -ly : ly;
  const r = (it.rotation * Math.PI) / 180;
  return { x: it.x - Math.sin(r) * y, y: it.y + Math.cos(r) * y };
}
/** Where a stitch is worked into (bottom centre), and its head (top centre), in world units. */
export const itemFoot = (it: StitchItem | GatherItem) => itemLocal(it, geomFoot(itemGeom(it)));
export const itemHead = (it: StitchItem | GatherItem) => {
  const g = itemGeom(it);
  return itemLocal(it, (g.oy ?? 0) - g.h / 2);
};

export function itemGeom(it: StitchItem | GatherItem): Geom {
  return it.type === "stitch" ? stitchGeom(it) : gatherItemGeom(it);
}

export const textWidth = (t: TextItem) => Math.max(t.size * 0.62 * [...t.text].length, t.size * 0.6);

// ---------- bounds ----------

function rotBox(cx: number, cy: number, w: number, h: number, deg: number): Box {
  const c = Math.cos(deg * RAD), s = Math.sin(deg * RAD);
  const hw = (Math.abs(w * c) + Math.abs(h * s)) / 2;
  const hh = (Math.abs(w * s) + Math.abs(h * c)) / 2;
  return { x0: cx - hw, y0: cy - hh, x1: cx + hw, y1: cy + hh };
}

export function itemBounds(it: CrochetItem): Box {
  switch (it.type) {
    case "stitch":
    case "gather": {
      const { w, h, oy } = itemGeom(it);
      const c = oy ? itemLocal(it, oy) : it;
      return rotBox(c.x, c.y, w, h, it.rotation);
    }
    case "text": {
      const w = textWidth(it);
      return { x0: it.x - w / 2, y0: it.y - it.size / 2, x1: it.x + w / 2, y1: it.y + it.size / 2 };
    }
    case "stroke": {
      const pad = (it.width ?? STROKE_WIDTH) / 2 + 1;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const [x, y] of it.points) {
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
      return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
    }
  }
}

export function unionBounds(items: Iterable<CrochetItem>): Box | null {
  let b: Box | null = null;
  for (const it of items) {
    const c = itemBounds(it);
    b = b ? { x0: Math.min(b.x0, c.x0), y0: Math.min(b.y0, c.y0), x1: Math.max(b.x1, c.x1), y1: Math.max(b.y1, c.y1) } : c;
  }
  return b;
}

export const boxCenter = (b: Box): Pt => ({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 });

/** A representative point of an item (used for snapping and marquee hit). */
export function itemAnchor(it: CrochetItem): Pt {
  if (it.type === "stroke") return { x: it.points[0][0], y: it.points[0][1] };
  return { x: it.x, y: it.y };
}

// ---------- transforms ----------

export function moveItem<T extends CrochetItem>(it: T, dx: number, dy: number): T {
  if (it.type === "stroke") return { ...it, points: it.points.map(([x, y]) => [r2(x + dx), r2(y + dy)] as [number, number]) };
  return { ...it, x: r2((it as StitchItem).x + dx), y: r2((it as StitchItem).y + dy) };
}

const rotPt = (x: number, y: number, c: Pt, deg: number): [number, number] => {
  const cs = Math.cos(deg * RAD), sn = Math.sin(deg * RAD);
  const dx = x - c.x, dy = y - c.y;
  return [r2(c.x + dx * cs - dy * sn), r2(c.y + dx * sn + dy * cs)];
};

export const normDeg = (d: number) => {
  let a = ((d % 360) + 360) % 360;
  if (a > 180) a -= 360;
  return r2(a);
};

export function rotateItem<T extends CrochetItem>(it: T, c: Pt, deg: number): T {
  if (it.type === "stroke") return { ...it, points: it.points.map(([x, y]) => rotPt(x, y, c, deg)) };
  const [x, y] = rotPt((it as TextItem).x, (it as TextItem).y, c, deg);
  if (it.type === "text") return { ...it, x, y };
  return { ...it, x, y, rotation: normDeg((it as StitchItem).rotation + deg) };
}

export function flipItem<T extends CrochetItem>(it: T, axis: "h" | "v", c: Pt): T {
  const fx = (x: number) => (axis === "h" ? r2(2 * c.x - x) : x);
  const fy = (y: number) => (axis === "v" ? r2(2 * c.y - y) : y);
  if (it.type === "stroke") return { ...it, points: it.points.map(([x, y]) => [fx(x), fy(y)] as [number, number]) };
  if (it.type === "text") return { ...it, x: fx(it.x), y: fy(it.y) };
  if (it.type === "stitch") {
    const s: StitchItem = { ...it, x: fx(it.x), y: fy(it.y), rotation: normDeg(-it.rotation) };
    if (axis === "h") s.flipH = !it.flipH;
    else s.flipV = !it.flipV;
    return s as T;
  }
  const g = it as GatherItem;
  return { ...g, x: fx(g.x), y: fy(g.y), rotation: normDeg(axis === "h" ? -g.rotation : 180 - g.rotation) } as T;
}

/** Deep copies with fresh ids; items sharing a group get a fresh shared group. */
export function cloneItems(items: CrochetItem[], dx = 0, dy = 0): CrochetItem[] {
  const groups = new Map<string, string>();
  return items.map((it) => {
    const c = moveItem(structuredClone(it), dx, dy);
    c.id = uid();
    if (c.groupId) {
      if (!groups.has(c.groupId)) groups.set(c.groupId, uid());
      c.groupId = groups.get(c.groupId);
    }
    return c;
  });
}

// ---------- templates & repeats ----------

export type Placement = { x: number; y: number; rotation: number };

/** Instantiates a template (items centred on 0,0) at a point, rotated. */
export function placeTemplate(template: CrochetItem[], p: Placement): CrochetItem[] {
  const origin = { x: 0, y: 0 };
  const copies = cloneItems(template);
  const groupId = copies.length > 1 ? uid() : undefined;
  return copies.map((it) => {
    let c = p.rotation ? rotateItem(it, origin, p.rotation) : it;
    c = moveItem(c, p.x, p.y);
    if (groupId) c.groupId = groupId;
    return c;
  });
}

/** Foot-on-the-line placements along A→B. Stitches stay upright-ish whichever way the line is drawn. */
export function linearPlacements(a: Pt, b: Pt, count: number, h: number): Placement[] {
  const dx = b.x - a.x, dy = b.y - a.y;
  let rot = Math.atan2(dy, dx) / RAD;
  if (rot > 90) rot -= 180;
  if (rot <= -90) rot += 180;
  const up = { x: Math.sin(rot * RAD), y: -Math.cos(rot * RAD) };
  const n = Math.max(1, Math.round(count));
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    return { x: r2(a.x + dx * t + (up.x * h) / 2), y: r2(a.y + dy * t + (up.y * h) / 2), rotation: normDeg(rot) };
  });
}

export const linearAutoCount = (a: Pt, b: Pt, w: number) => Math.max(2, Math.floor(Math.hypot(b.x - a.x, b.y - a.y) / Math.max(4, w)) + 1);

/** Feet on the ellipse, heads pointing outward, starting at the top going clockwise. */
export function radialPlacements(c: Pt, rx: number, ry: number, count: number, h: number): Placement[] {
  const n = Math.max(1, Math.round(count));
  const RX = Math.max(rx, 0.5), RY = Math.max(ry, 0.5);
  return Array.from({ length: n }, (_, i) => {
    const t = (-90 + (i * 360) / n) * RAD;
    const px = c.x + RX * Math.cos(t), py = c.y + RY * Math.sin(t);
    let nx = Math.cos(t) / RX, ny = Math.sin(t) / RY;
    const len = Math.hypot(nx, ny) || 1;
    nx /= len; ny /= len;
    const rot = Math.atan2(nx, -ny) / RAD;
    return { x: r2(px + (nx * h) / 2), y: r2(py + (ny * h) / 2), rotation: normDeg(rot) };
  });
}

export function ellipsePerimeter(rx: number, ry: number) {
  // Ramanujan
  const a = Math.max(rx, 0.01), b = Math.max(ry, 0.01);
  return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
}
export const radialAutoCount = (rx: number, ry: number, w: number) => Math.max(3, Math.round(ellipsePerimeter(rx, ry) / Math.max(4, w)));

// ---------- SVG serialisation ----------

const escAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const escText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function strokePath(it: StrokeItem) {
  return it.points.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join("") + (it.closed ? "Z" : "");
}
export function dashArray(it: StrokeItem) {
  const w = it.width ?? STROKE_WIDTH;
  return it.dash === "dashed" ? `${w * 4} ${w * 3}` : it.dash === "dotted" ? `0.01 ${w * 2.6}` : undefined;
}

export function stitchTransform(it: StitchItem | GatherItem) {
  let t = `translate(${it.x} ${it.y})`;
  if (it.rotation) t += ` rotate(${it.rotation})`;
  if (it.type === "stitch" && (it.flipH || it.flipV)) t += ` scale(${it.flipH ? -1 : 1} ${it.flipV ? -1 : 1})`;
  return t;
}

export const FONT = "Pretendard, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";

export function itemToSvg(it: CrochetItem, fallback = INK): string {
  const color = escAttr(it.color ?? fallback);
  switch (it.type) {
    case "stitch":
    case "gather":
      return `<g transform="${stitchTransform(it)}" stroke="${color}">${primsToSvg(itemGeom(it).prims, it.color ?? fallback)}</g>`;
    case "stroke": {
      const da = dashArray(it);
      return `<path d="${strokePath(it)}" fill="none" stroke="${color}" stroke-width="${it.width ?? STROKE_WIDTH}"${da ? ` stroke-dasharray="${da}"` : ""}/>`;
    }
    case "text":
      return `<text x="${it.x}" y="${it.y}" font-size="${it.size}" font-family="${escAttr(FONT)}" font-weight="600" text-anchor="middle" dominant-baseline="central" fill="${color}" stroke="none">${escText(it.text)}</text>`;
  }
}

/**
 * Standalone SVG of the visible layers. Tight bounds + margin.
 * With `fit`, the output is scaled to fit that pixel box (thumbnails).
 */
export function buildSvg(layers: CrochetLayer[], opts: { margin?: number; fit?: { w: number; h: number }; background?: string; backgroundOpacity?: number } = {}): string | null {
  const visible = layers.filter((l) => l.visible && l.items.length);
  const all = visible.flatMap((l) => l.items);
  const b = unionBounds(all);
  if (!b) return null;
  const m = opts.margin ?? 24;
  const vx = b.x0 - m, vy = b.y0 - m, vw = b.x1 - b.x0 + m * 2, vh = b.y1 - b.y0 + m * 2;
  let W = vw, H = vh;
  if (opts.fit) {
    const k = Math.min(opts.fit.w / vw, opts.fit.h / vh);
    W = vw * k;
    H = vh * k;
  }
  const body = visible
    .map((l) => `<g>${l.items.map((it) => itemToSvg(it, l.color ?? INK)).join("")}</g>`)
    .join("");
  const bg = opts.background ? `<rect x="${r2(vx)}" y="${r2(vy)}" width="${r2(vw)}" height="${r2(vh)}" fill="${escAttr(opts.background)}"${opts.backgroundOpacity !== undefined && opts.backgroundOpacity < 1 ? ` fill-opacity="${r2(opts.backgroundOpacity)}"` : ""}/>` : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(W)}" height="${r2(H)}" viewBox="${r2(vx)} ${r2(vy)} ${r2(vw)} ${r2(vh)}">` +
    bg +
    `<g fill="none" stroke-width="${STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`
  );
}
