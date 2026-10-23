// Knitting chart symbols (Japanese/Korean chart convention), drawn as SVG markup.
// Every symbol draws into a box of `w × h` world units, where `w` already covers
// `width` cells. Strokes use currentColor so the caller can switch black/white.

export type KnitGroupId =
  | "basic"
  | "inc"
  | "twist"
  | "cross1"
  | "cross2"
  | "cross3"
  | "special"
  | "dec2"
  | "dec3"
  | "markers"
  | "chars";

export const KNIT_GROUPS: { id: KnitGroupId; label: string }[] = [
  { id: "basic", label: "기본" },
  { id: "inc", label: "코 늘리기" },
  { id: "twist", label: "꼬아뜨기" },
  { id: "cross1", label: "교차 2·3코 너비" },
  { id: "cross2", label: "교차 4·5코 너비 (꽈배기)" },
  { id: "cross3", label: "교차 6코 너비" },
  { id: "special", label: "특수 뜨기" },
  { id: "dec2", label: "2코 모아뜨기" },
  { id: "dec3", label: "3코 모아뜨기" },
  { id: "markers", label: "마커" },
  { id: "chars", label: "글자·숫자" },
];

export type KnitSymbol = {
  id: string;
  name: string;
  group: KnitGroupId;
  /** cells this symbol spans horizontally */
  width: number;
  /** symbol that this one becomes when the chart is flipped left↔right */
  mirror?: string;
  /** extra search words */
  keywords?: string;
  draw: (w: number, h: number) => string;
};

const f = (n: number) => Math.round(n * 100) / 100;
const line = (x1: number, y1: number, x2: number, y2: number) =>
  `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"/>`;
/** part of a segment between t0 and t1 (0..1) */
const part = (x1: number, y1: number, x2: number, y2: number, t0: number, t1: number) =>
  line(x1 + (x2 - x1) * t0, y1 + (y2 - y1) * t0, x1 + (x2 - x1) * t1, y1 + (y2 - y1) * t1);

/** inner box of one cell (padding) */
const box = (w: number, h: number) => {
  const px = Math.min(w, h * 1.6) * 0.2;
  const py = h * 0.16;
  return { l: px, r: w - px, t: py, b: h - py, cx: w / 2, cy: h / 2 };
};

const text = (w: number, h: number, s: string) =>
  `<text x="${f(w / 2)}" y="${f(h / 2)}" text-anchor="middle" dominant-baseline="central" font-size="${f(
    Math.min(h * 0.72, w * 0.7),
  )}" font-family="Pretendard, Arial, sans-serif" font-weight="600" fill="currentColor" stroke="none">${s}</text>`;

// ---------- drawing helpers ----------

const knit = (w: number, h: number) => {
  const b = box(w, h);
  return line(b.cx, b.t, b.cx, b.b);
};
const purl = (w: number, h: number) => {
  const b = box(w, h);
  return line(b.l, b.cy, b.r, b.cy);
};
const twistedLoop = (w: number, h: number) => {
  const b = box(w, h);
  const a = (b.r - b.l) * 0.42;
  const r = a * 0.95;
  const mid = b.cy - (b.b - b.t) * 0.02;
  return `<path d="M${f(b.cx - a)} ${f(b.b)} L${f(b.cx + a * 0.62)} ${f(mid)} A${f(r)} ${f(r)} 0 1 0 ${f(b.cx - a * 0.62)} ${f(mid)} L${f(
    b.cx + a,
  )} ${f(b.b)}"/>`;
};
/** k2tog-like decrease. `over` = which leg is on top, `legs` = 2 or 3 */
const decrease = (w: number, h: number, over: "left" | "right" | "center", legs: 2 | 3) => {
  const b = box(w, h);
  const apexY = b.t + (b.b - b.t) * 0.12;
  let s = "";
  if (over === "center") {
    s += line(b.l, b.b, b.cx, apexY) + line(b.r, b.b, b.cx, apexY) + line(b.cx, b.b, b.cx, b.t - (b.b - b.t) * 0.05);
    return s;
  }
  const ext = 0.32;
  if (over === "left") {
    // left leg continues past the apex
    s += line(b.l, b.b, b.cx + (b.cx - b.l) * ext, apexY - (b.b - apexY) * ext) + line(b.r, b.b, b.cx, apexY);
  } else {
    s += line(b.r, b.b, b.cx - (b.r - b.cx) * ext, apexY - (b.b - apexY) * ext) + line(b.l, b.b, b.cx, apexY);
  }
  if (legs === 3) s += line(b.cx, b.b, b.cx, apexY + (b.b - apexY) * 0.2);
  return s;
};
const lift = (w: number, h: number, side: "left" | "right") => {
  const b = box(w, h);
  const dir = side === "right" ? 1 : -1;
  return line(b.cx, b.t, b.cx, b.b) + line(b.cx, b.cy, b.cx + dir * (b.r - b.l) * 0.5, b.b);
};
/**
 * Cable cross over `a + c` cells: `a` stitches on the left travel right, `c` on the right travel left.
 * over = "right": the stitches that start on the right lie on top (오른코 위, they lean left).
 * over = "left": the stitches that start on the left lie on top (왼코 위, they lean right).
 */
const cable = (a: number, c: number, over: "right" | "left", purlUnder = false) => (w: number, h: number) => {
  const n = a + c;
  const cw = w / n;
  const t = h * 0.12;
  const bt = h * 0.88;
  let top = "";
  let under = "";
  const gap = (x1: number, x2: number) => part(x1, bt, x2, t, 0, 0.36) + part(x1, bt, x2, t, 0.64, 1);
  for (let i = 0; i < a; i++) {
    const x1 = (i + 0.5) * cw;
    const x2 = (c + i + 0.5) * cw;
    if (over === "left") top += line(x1, bt, x2, t);
    else under += gap(x1, x2);
  }
  for (let j = 0; j < c; j++) {
    const x1 = (a + j + 0.5) * cw;
    const x2 = (j + 0.5) * cw;
    if (over === "right") top += line(x1, bt, x2, t);
    else under += gap(x1, x2);
  }
  if (purlUnder) {
    // a short bar marks the stitches that are purled underneath (they end up on the far side)
    const xs = over === "right" ? Array.from({ length: a }, (_, i) => (c + i + 0.5) * cw) : Array.from({ length: c }, (_, j) => (j + 0.5) * cw);
    xs.forEach((x) => (under += line(x - cw * 0.22, t, x + cw * 0.22, t)));
  }
  return under + top;
};

const star = (w: number, h: number) => {
  const b = box(w, h);
  const R = Math.min(b.r - b.l, b.b - b.t) * 0.62;
  const r = R * 0.45;
  const pts = Array.from({ length: 10 }, (_, i) => {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r : R;
    return `${f(b.cx + Math.cos(ang) * rr)},${f(b.cy + Math.sin(ang) * rr)}`;
  }).join(" ");
  return `<polygon points="${pts}" fill="#d64545" stroke="none"/>`;
};

// ---------- catalogue ----------

export const KNIT_SYMBOLS: KnitSymbol[] = [
  // 기본
  { id: "k", name: "겉뜨기", group: "basic", width: 1, keywords: "knit 메리야스", draw: knit },
  { id: "k0", name: "겉뜨기 (빈칸)", group: "basic", width: 1, keywords: "knit blank", draw: () => "" },
  { id: "p", name: "안뜨기", group: "basic", width: 1, keywords: "purl", draw: purl },
  {
    id: "sl",
    name: "걸러뜨기",
    group: "basic",
    width: 1,
    keywords: "slip 걸러",
    draw: (w, h) => {
      const b = box(w, h);
      return `<polyline points="${f(b.l)},${f(b.t)} ${f(b.cx)},${f(b.b)} ${f(b.r)},${f(b.t)}"/>`;
    },
  },
  {
    id: "yo",
    name: "바늘비우기",
    group: "basic",
    width: 1,
    keywords: "yarn over 구멍",
    draw: (w, h) => {
      const b = box(w, h);
      return `<circle cx="${f(b.cx)}" cy="${f(b.cy)}" r="${f(Math.min(b.r - b.l, b.b - b.t) * 0.48)}"/>`;
    },
  },
  {
    id: "bo",
    name: "코막음",
    group: "basic",
    width: 1,
    keywords: "bind off 덮어씌우기",
    draw: (w, h) => {
      const b = box(w, h);
      return `<circle cx="${f(b.cx)}" cy="${f(b.cy)}" r="${f(Math.min(b.r - b.l, b.b - b.t) * 0.42)}" fill="currentColor" stroke="none"/>`;
    },
  },
  {
    id: "ns",
    name: "없는 코",
    group: "basic",
    width: 1,
    keywords: "no stitch 회색",
    draw: (w, h) => `<rect x="0" y="0" width="${f(w)}" height="${f(h)}" fill="#c9c9c9" stroke="none"/>`,
  },

  // 코 늘리기
  { id: "m1r", name: "오른코 늘리기", group: "inc", width: 1, mirror: "m1l", keywords: "increase", draw: (w, h) => lift(w, h, "right") },
  { id: "m1l", name: "왼코 늘리기", group: "inc", width: 1, mirror: "m1r", keywords: "increase", draw: (w, h) => lift(w, h, "left") },
  {
    id: "co",
    name: "감아코",
    group: "inc",
    width: 1,
    keywords: "cast on 감아 늘리기",
    draw: (w, h) => {
      const b = box(w, h);
      const a = (b.r - b.l) * 0.45;
      return `<path d="M${f(b.cx - a)} ${f(b.b)} C${f(b.cx + a * 1.5)} ${f(b.cy)} ${f(b.cx + a * 0.9)} ${f(b.t)} ${f(b.cx)} ${f(b.t)} C${f(
        b.cx - a * 0.9,
      )} ${f(b.t)} ${f(b.cx - a * 0.5)} ${f(b.cy)} ${f(b.cx + a)} ${f(b.b)}"/>`;
    },
  },

  // 꼬아뜨기
  { id: "ktbl", name: "꼬아뜨기", group: "twist", width: 1, keywords: "twisted knit tbl", draw: twistedLoop },
  {
    id: "ptbl",
    name: "안 꼬아뜨기",
    group: "twist",
    width: 1,
    keywords: "twisted purl",
    draw: (w, h) => {
      const b = box(w, h);
      return twistedLoop(w, h * 0.86) + line(b.l, h * 0.86, b.r, h * 0.86);
    },
  },

  // 교차 2·3코
  { id: "c1r", name: "1/1 교차 (오른코 위)", group: "cross1", width: 2, mirror: "c1l", keywords: "cable cross RT", draw: cable(1, 1, "right") },
  { id: "c1l", name: "1/1 교차 (왼코 위)", group: "cross1", width: 2, mirror: "c1r", keywords: "cable cross LT", draw: cable(1, 1, "left") },
  {
    id: "c1rp",
    name: "1/1 교차 (오른코 위, 아래 안뜨기)",
    group: "cross1",
    width: 2,
    mirror: "c1lp",
    keywords: "cable purl",
    draw: cable(1, 1, "right", true),
  },
  {
    id: "c1lp",
    name: "1/1 교차 (왼코 위, 아래 안뜨기)",
    group: "cross1",
    width: 2,
    mirror: "c1rp",
    keywords: "cable purl",
    draw: cable(1, 1, "left", true),
  },
  { id: "c21r", name: "2/1 교차 (오른코 위)", group: "cross1", width: 3, mirror: "c21l", keywords: "cable", draw: cable(1, 2, "right") },
  { id: "c21l", name: "2/1 교차 (왼코 위)", group: "cross1", width: 3, mirror: "c21r", keywords: "cable", draw: cable(2, 1, "left") },

  // 교차 4·5코 (꽈배기)
  { id: "c2r", name: "2/2 교차 (오른코 위)", group: "cross2", width: 4, mirror: "c2l", keywords: "cable 꽈배기", draw: cable(2, 2, "right") },
  { id: "c2l", name: "2/2 교차 (왼코 위)", group: "cross2", width: 4, mirror: "c2r", keywords: "cable 꽈배기", draw: cable(2, 2, "left") },
  { id: "c32r", name: "3/2 교차 (오른코 위)", group: "cross2", width: 5, mirror: "c32l", keywords: "cable 꽈배기", draw: cable(2, 3, "right") },
  { id: "c32l", name: "3/2 교차 (왼코 위)", group: "cross2", width: 5, mirror: "c32r", keywords: "cable 꽈배기", draw: cable(3, 2, "left") },

  // 교차 6코
  { id: "c3r", name: "3/3 교차 (오른코 위)", group: "cross3", width: 6, mirror: "c3l", keywords: "cable 꽈배기", draw: cable(3, 3, "right") },
  { id: "c3l", name: "3/3 교차 (왼코 위)", group: "cross3", width: 6, mirror: "c3r", keywords: "cable 꽈배기", draw: cable(3, 3, "left") },

  // 특수 뜨기
  {
    id: "bob",
    name: "방울뜨기",
    group: "special",
    width: 1,
    keywords: "bobble 방울",
    draw: (w, h) => {
      const b = box(w, h);
      const rx = (b.r - b.l) * 0.42;
      const ry = (b.b - b.t) * 0.58;
      return `<ellipse cx="${f(b.cx)}" cy="${f(b.cy)}" rx="${f(rx)}" ry="${f(ry)}"/>` + line(b.cx, b.cy - ry * 0.45, b.cx, b.cy + ry * 0.45);
    },
  },
  {
    id: "slp",
    name: "걸러뜨기 (실 앞)",
    group: "special",
    width: 1,
    keywords: "slip wyif",
    draw: (w, h) => {
      const b = box(w, h);
      return `<polyline points="${f(b.l)},${f(b.t)} ${f(b.cx)},${f(b.b - (b.b - b.t) * 0.25)} ${f(b.r)},${f(b.t)}"/>` + line(b.l, b.b, b.r, b.b);
    },
  },
  {
    id: "wrap3",
    name: "3코 감아뜨기",
    group: "special",
    width: 3,
    keywords: "wrap",
    draw: (w, h) => {
      const cw = w / 3;
      let s = "";
      for (let i = 0; i < 3; i++) s += line((i + 0.5) * cw, h * 0.18, (i + 0.5) * cw, h * 0.82);
      return s + `<ellipse cx="${f(w / 2)}" cy="${f(h / 2)}" rx="${f(w * 0.42)}" ry="${f(h * 0.16)}"/>`;
    },
  },

  // 2코 모아뜨기
  { id: "k2tog", name: "왼코 겹쳐 2코 모아뜨기", group: "dec2", width: 1, mirror: "ssk", keywords: "k2tog decrease", draw: (w, h) => decrease(w, h, "left", 2) },
  { id: "ssk", name: "오른코 겹쳐 2코 모아뜨기", group: "dec2", width: 1, mirror: "k2tog", keywords: "ssk decrease", draw: (w, h) => decrease(w, h, "right", 2) },
  {
    id: "p2tog",
    name: "안뜨기 2코 모아뜨기",
    group: "dec2",
    width: 1,
    keywords: "p2tog decrease",
    draw: (w, h) => decrease(w, h * 0.84, "left", 2) + line(box(w, h).l, h * 0.86, box(w, h).r, h * 0.86),
  },

  // 3코 모아뜨기
  { id: "cdd", name: "중심 3코 모아뜨기", group: "dec3", width: 1, keywords: "centered double decrease", draw: (w, h) => decrease(w, h, "center", 3) },
  { id: "k3tog", name: "왼코 겹쳐 3코 모아뜨기", group: "dec3", width: 1, mirror: "sssk", keywords: "k3tog decrease", draw: (w, h) => decrease(w, h, "left", 3) },
  { id: "sssk", name: "오른코 겹쳐 3코 모아뜨기", group: "dec3", width: 1, mirror: "k3tog", keywords: "sssk decrease", draw: (w, h) => decrease(w, h, "right", 3) },

  // 마커
  {
    id: "mkv",
    name: "마커 줄 (세로)",
    group: "markers",
    width: 1,
    keywords: "marker",
    draw: (w, h) => `<line x1="${f(w - 1)}" y1="0" x2="${f(w - 1)}" y2="${f(h)}" stroke="#d64545" stroke-width="${f(Math.max(1.6, w * 0.1))}"/>`,
  },
  {
    id: "mkh",
    name: "마커 줄 (가로)",
    group: "markers",
    width: 1,
    keywords: "marker",
    draw: (w, h) => `<line x1="0" y1="${f(h - 1)}" x2="${f(w)}" y2="${f(h - 1)}" stroke="#d64545" stroke-width="${f(Math.max(1.6, h * 0.1))}"/>`,
  },
  { id: "mks", name: "별 마커", group: "markers", width: 1, keywords: "marker star", draw: star },
  {
    id: "mkc",
    name: "원 마커",
    group: "markers",
    width: 1,
    keywords: "marker circle",
    draw: (w, h) => `<circle cx="${f(w / 2)}" cy="${f(h / 2)}" r="${f(Math.min(w, h) * 0.36)}" stroke="#d64545"/>`,
  },

  // 글자·숫자
  ...Array.from({ length: 9 }, (_, i): KnitSymbol => ({
    id: `n${i + 1}`,
    name: `숫자 ${i + 1}`,
    group: "chars",
    width: 1,
    keywords: String(i + 1),
    draw: (w, h) => text(w, h, String(i + 1)),
  })),
  { id: "chx", name: "엑스", group: "chars", width: 1, keywords: "x", draw: (w, h) => text(w, h, "×") },
];

const BY_ID = new Map(KNIT_SYMBOLS.map((s) => [s.id, s]));
export const knitSymbol = (id: string | undefined) => (id ? BY_ID.get(id) : undefined);
export const MAX_SYMBOL_WIDTH = Math.max(...KNIT_SYMBOLS.map((s) => s.width));

/** stroke width for a cell size */
export const symbolStroke = (cw: number, ch: number) => Math.max(0.9, Math.min(cw, ch) * 0.075);

/** `<g id>` definitions for <use href="#prefix-id">, sized to one cell of cw × ch. */
export function symbolDefs(cw: number, ch: number, prefix = "ks", only?: Set<string>) {
  const sw = f(symbolStroke(cw, ch));
  let out = "";
  for (const s of KNIT_SYMBOLS) {
    if (only && !only.has(s.id)) continue;
    out += `<g id="${prefix}-${s.id}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${s.draw(
      cw * s.width,
      ch,
    )}</g>`;
  }
  return out;
}

/** Standalone SVG string of one symbol (for raster caches). */
export function symbolSvg(id: string, cw: number, ch: number, color = "#222") {
  const s = BY_ID.get(id);
  if (!s) return "";
  const w = cw * s.width;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${f(w)}" height="${f(ch)}" viewBox="0 0 ${f(w)} ${f(ch)}" color="${color}"><g fill="none" stroke="currentColor" stroke-width="${f(
    symbolStroke(cw, ch),
  )}" stroke-linecap="round" stroke-linejoin="round">${s.draw(w, ch)}</g></svg>`;
}

/** Palette preview of a symbol. Cells keep the knitting aspect (wider than tall). */
export function KnitSymbolIcon({ id, cell = 22, ratio = 0.78, className }: { id: string; cell?: number; ratio?: number; className?: string }) {
  const s = BY_ID.get(id);
  if (!s) return null;
  const w = cell * s.width;
  const h = cell * ratio;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className={className} aria-hidden="true">
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth={symbolStroke(cell, h)}
        strokeLinecap="round"
        strokeLinejoin="round"
        dangerouslySetInnerHTML={{ __html: s.draw(w, h) }}
      />
    </svg>
  );
}
