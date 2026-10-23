// Generates the knitted-swatch placeholders in public/landing/ (stand-ins for the
// original swatch photos). Each swatch is a stitch chart drawn as knit "V"s.
// Run: node scripts/gen-swatches.mjs
import { writeFileSync, mkdirSync } from "node:fs";

const S = 14; // stitch cell size (px)
const out = new URL("../public/landing/", import.meta.url);
mkdirSync(out, { recursive: true });

// Deterministic jitter so every build produces identical files.
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * k))));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
}

/** cell(c, r) -> { color, purl? } */
function swatch(name, w, h, cell) {
  const cols = Math.floor(w / S);
  const rows = Math.floor(h / (S * 0.8));
  const ox = (w - cols * S) / 2;
  const sh = S * 0.8;
  const oy = (h - rows * sh) / 2;
  const parts = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const { color, purl } = cell(c, r, cols, rows);
      const x = (ox + c * S).toFixed(1);
      const y = (oy + r * sh).toFixed(1);
      const k = 0.92 + rnd() * 0.14;
      parts.push(`<use href="#${purl ? "p" : "k"}" x="${x}" y="${y}" fill="${shade(color, k)}"/>`);
    }
  }
  const bg = shade(cell(0, 0, cols, rows).color, 0.7);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<defs>
<g id="k"><path d="M1 1.5C3.2 1.2 6.4 4 7 ${sh - 1}C4.4 ${sh - 2} 1.2 5.6 1 1.5Z"/><path d="M13 1.5C10.8 1.2 7.6 4 7 ${sh - 1}C9.6 ${sh - 2} 12.8 5.6 13 1.5Z"/></g>
<g id="p"><ellipse cx="7" cy="${sh / 2}" rx="6" ry="${sh / 2 - 1.5}"/></g>
<filter id="soft"><feDropShadow dx="0" dy="1" stdDeviation="0.6" flood-opacity="0.35"/></filter>
</defs>
<rect x="${ox}" y="${oy}" width="${cols * S}" height="${rows * sh}" rx="6" fill="${bg}"/>
<g filter="url(#soft)">${parts.join("")}</g>
</svg>
`;
  writeFileSync(new URL(`swatch-${name}.svg`, out), svg);
  console.log(name, cols, "x", rows, Math.round(svg.length / 1024) + "KB");
}

const NAVY = "#24365c", CREAM = "#efe7d6", GREEN = "#6d9c1c", BLUE = "#5d8aa1", OAT = "#d8c8ad", CLAY = "#c47a5c";

// 11x11 snowflake motif
const flake = [
  ".....X.....",
  "..X..X..X..",
  "...X.X.X...",
  "X...XXX...X",
  ".X..X.X..X.",
  "XXXXX.XXXXX",
  ".X..X.X..X.",
  "X...XXX...X",
  "...X.X.X...",
  "..X..X..X..",
  ".....X.....",
];

swatch("star", 580, 421, (c, r, cols, rows) => {
  const cw = Math.floor(cols / 2), rh = Math.floor(rows / 2);
  const mc = c % cw - Math.floor((cw - 11) / 2), mr = r % rh - Math.floor((rh - 11) / 2);
  const on = mc >= 0 && mc < 11 && mr >= 0 && mr < 11 && flake[mr][mc] === "X";
  return { color: on ? CREAM : NAVY };
});

swatch("cable", 580, 648, (c, r) => {
  const band = c % 10;
  const purl = band === 0 || band === 1 || band === 8 || band === 9;
  const cross = !purl && r % 12 < 2;
  return { color: cross ? shade(GREEN, 0.75) : GREEN, purl };
});

swatch("checks", 580, 452, (c, r) => ({ color: (Math.floor(c / 4) + Math.floor(r / 4)) % 2 ? CREAM : BLUE }));

swatch("rib", 580, 480, (c) => ({ color: OAT, purl: c % 4 >= 2 }));

swatch("seed", 580, 480, (c, r) => ({ color: CLAY, purl: (c + r) % 2 === 1 }));

const bandColors = [NAVY, CREAM, CLAY, CREAM, GREEN, CREAM, BLUE, CREAM];
swatch("bands", 580, 480, (c, r) => {
  const b = Math.floor(r / 4) % bandColors.length;
  const accent = r % 4 === 1 || r % 4 === 2 ? (c + Math.floor(r / 4)) % 4 === 0 : false;
  return { color: accent ? CREAM : bandColors[b] === CREAM ? (c % 6 === 3 ? NAVY : CREAM) : bandColors[b] };
});
