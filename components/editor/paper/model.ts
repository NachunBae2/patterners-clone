// 페이퍼 document helpers: block factories, table border rules and the standalone HTML export.
import { uid } from "@/lib/id";
import type { PaperBlock, PaperBorder, PaperData } from "@/lib/types";

export type BlockType = PaperBlock["type"];
type TableBlock = Extract<PaperBlock, { type: "table" }>;

export const DEFAULT_BORDER: PaperBorder = { style: "solid", width: 1, color: "#c9ccd1" };

export type NewKind = "h1" | "h2" | "h3" | "paragraph" | "bullet" | "ordered" | "table" | "image" | "divider" | "embed";

export function newBlock(kind: NewKind, extra: { workId?: string; src?: string; name?: string } = {}): PaperBlock {
  const id = uid();
  switch (kind) {
    case "h1":
    case "h2":
    case "h3":
      return { id, type: "heading", level: Number(kind[1]) as 1 | 2 | 3, text: "" };
    case "paragraph":
      return { id, type: "paragraph", text: "" };
    case "bullet":
      return { id, type: "list", ordered: false, items: [""] };
    case "ordered":
      return { id, type: "list", ordered: true, items: [""] };
    case "table":
      return {
        id,
        type: "table",
        header: true,
        preset: "basic",
        border: { ...DEFAULT_BORDER },
        rows: [
          ["단", "코수", "설명"],
          ["", "", ""],
          ["", "", ""],
        ],
      };
    case "image":
      return { id, type: "image", src: extra.src ?? "", caption: "", width: 100, name: extra.name };
    case "divider":
      return { id, type: "divider" };
    case "embed":
      return { id, type: "embed", workId: extra.workId ?? "", caption: "", width: 70 };
  }
}

export function normalizePaper(data: PaperData): PaperData {
  const d = structuredClone(data);
  if (!Array.isArray(d.blocks)) d.blocks = [];
  d.showTitle ??= true;
  d.blocks = d.blocks.map((b) => (b.type === "table" ? { ...b, border: b.border ?? { ...DEFAULT_BORDER }, preset: b.preset ?? "basic" } : b));
  return d;
}

// ---------- table borders ----------

const line = (b: PaperBorder, w = b.width) => (b.style === "none" || w <= 0 ? "none" : `${b.style === "double" ? Math.max(3, w) : w}px ${b.style} ${b.color}`);

/** Per-cell border + background following the table's style preset. */
export function cellStyle(t: TableBlock, r: number, c: number): Record<string, string> {
  const rows = t.rows.length;
  const cols = t.rows[0]?.length ?? 0;
  const b = t.border;
  const top = r === 0;
  const bottom = r === rows - 1;
  const left = c === 0;
  const right = c === cols - 1;
  const head = t.header && r === 0;
  const s: Record<string, string> = {};
  const set = (side: "Top" | "Right" | "Bottom" | "Left", v: string) => (s[`border${side}`] = v);
  const all = line(b);
  const bold = line(b, b.width * 2);
  switch (t.preset) {
    case "none":
      ["Top", "Right", "Bottom", "Left"].forEach((x) => set(x as "Top", "none"));
      break;
    case "rowsOnly":
      set("Top", top ? all : "none");
      set("Bottom", all);
      set("Left", "none");
      set("Right", "none");
      break;
    case "outerBold":
      set("Top", top ? bold : all);
      set("Bottom", bottom ? bold : all);
      set("Left", left ? bold : all);
      set("Right", right ? bold : all);
      break;
    case "header":
      set("Top", all);
      set("Left", all);
      set("Right", all);
      set("Bottom", head ? bold : all);
      if (head) s.background = "#f2f3f5";
      break;
    default:
      set("Top", all);
      set("Right", all);
      set("Bottom", all);
      set("Left", all);
  }
  if (head) s.fontWeight = "700";
  return s;
}

const cssText = (o: Record<string, string>) =>
  Object.entries(o)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${v}`)
    .join(";");

// ---------- export ----------

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const br = (s: string) => esc(s).replace(/\n/g, "<br>");

export type EmbedInfo = { title: string; craft: string; thumbnail?: string };

/** Body markup shared by the HTML export and the print sheet. */
export function paperBodyHtml(d: PaperData, title: string, embeds: (id: string) => EmbedInfo | null) {
  const out: string[] = [];
  if (d.showTitle) out.push(`<h1 class="pp-title">${esc(title)}</h1>`);
  for (const b of d.blocks) {
    const align = "align" in b && b.align ? ` style="text-align:${b.align}"` : "";
    switch (b.type) {
      case "heading":
        out.push(`<h${b.level + 1} class="pp-h${b.level}"${align}>${br(b.text)}</h${b.level + 1}>`);
        break;
      case "paragraph":
        out.push(b.text.trim() ? `<p${align}>${br(b.text)}</p>` : `<p class="pp-empty"></p>`);
        break;
      case "list": {
        const tag = b.ordered ? "ol" : "ul";
        out.push(`<${tag}>${b.items.map((it) => `<li>${br(it)}</li>`).join("")}</${tag}>`);
        break;
      }
      case "table":
        out.push(
          `<table class="pp-table">${b.rows
            .map((row, r) => `<tr>${row.map((cell, c) => `<${b.header && r === 0 ? "th" : "td"} style="${cssText(cellStyle(b, r, c))}">${cell ? br(cell) : "&nbsp;"}</${b.header && r === 0 ? "th" : "td"}>`).join("")}</tr>`)
            .join("")}</table>`,
        );
        break;
      case "image":
        if (b.src) out.push(`<figure style="width:${b.width}%"><img src="${esc(b.src)}" alt="${esc(b.caption)}">${b.caption ? `<figcaption>${br(b.caption)}</figcaption>` : ""}</figure>`);
        break;
      case "divider":
        out.push(`<hr>`);
        break;
      case "embed": {
        const e = embeds(b.workId);
        if (!e) break;
        out.push(
          `<figure class="pp-embed" style="width:${b.width}%">${e.thumbnail ? `<img src="${esc(e.thumbnail)}" alt="${esc(e.title)}">` : `<div class="pp-noimg">미리보기 없음</div>`}<figcaption>${b.caption ? br(b.caption) : `${esc(e.title)} · ${esc(e.craft)}`}</figcaption></figure>`,
        );
        break;
      }
    }
  }
  return out.join("\n");
}

/** Styles for exported / printed papers (scoped under .pp-doc). */
export const PAPER_CSS = `
.pp-doc{font-family:Pretendard,-apple-system,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;color:#1a1c20;line-height:1.7;font-size:15px;word-break:keep-all;overflow-wrap:anywhere}
.pp-doc .pp-title{font-size:30px;font-weight:700;line-height:1.3;margin:0 0 20px}
.pp-doc h2.pp-h1{font-size:24px;font-weight:700;line-height:1.35;margin:28px 0 10px}
.pp-doc h3.pp-h2{font-size:19px;font-weight:700;line-height:1.4;margin:22px 0 8px}
.pp-doc h4.pp-h3{font-size:16px;font-weight:700;line-height:1.45;margin:18px 0 6px}
.pp-doc p{margin:0 0 10px}
.pp-doc p.pp-empty{min-height:1em}
.pp-doc ul,.pp-doc ol{margin:0 0 10px;padding-left:1.5em}
.pp-doc ul{list-style:disc}
.pp-doc ol{list-style:decimal}
.pp-doc li{margin:2px 0}
.pp-doc hr{border:0;border-top:1px solid #d5d8dc;margin:20px 0}
.pp-doc table.pp-table{width:100%;border-collapse:collapse;margin:6px 0 14px;font-size:14px}
.pp-doc table.pp-table td,.pp-doc table.pp-table th{padding:6px 10px;text-align:left;vertical-align:top}
.pp-doc figure{margin:8px auto 16px;text-align:center;break-inside:avoid}
.pp-doc figure img{max-width:100%;height:auto;display:block;margin:0 auto;border-radius:6px}
.pp-doc figure.pp-embed img{width:100%;background:#f6f6f7;border:1px solid #e3e5e8;padding:12px;box-sizing:border-box}
.pp-doc figcaption{font-size:13px;color:#6b6f76;margin-top:6px}
.pp-doc .pp-noimg{padding:40px;background:#f6f6f7;color:#9a9ea5;border-radius:6px}
`;

export function paperHtml(d: PaperData, title: string, embeds: (id: string) => EmbedInfo | null) {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
body{margin:0;background:#f4f4f5}
.pp-page{max-width:794px;margin:32px auto;background:#fff;padding:64px 72px;box-sizing:border-box;box-shadow:0 1px 4px rgba(0,0,0,.08)}
@media print{body{background:#fff}.pp-page{margin:0;padding:0;box-shadow:none;max-width:none}}
${PAPER_CSS}
</style>
</head>
<body>
<main class="pp-page pp-doc">
${paperBodyHtml(d, title, embeds)}
</main>
</body>
</html>
`;
}

/** Reads an image file as a data URL, shrinking big photos so they fit in local storage. */
export async function readImage(file: File): Promise<{ src: string; bytes: number; resized: boolean }> {
  const raw = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error("read failed"));
    r.readAsDataURL(file);
  });
  const img = new Image();
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("decode failed"));
    img.src = raw;
  });
  const MAX = 1600;
  const big = Math.max(img.naturalWidth, img.naturalHeight) > MAX || file.size > 600 * 1024;
  if (!big || file.type === "image/gif" || file.type === "image/svg+xml") return { src: raw, bytes: Math.round(raw.length * 0.75), resized: false };
  const k = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * k));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * k));
  const ctx = canvas.getContext("2d")!;
  const png = file.type === "image/png";
  if (!png) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  let src = canvas.toDataURL(png ? "image/png" : "image/jpeg", 0.85);
  if (png && src.length > raw.length) src = raw;
  return { src, bytes: Math.round(src.length * 0.75), resized: true };
}

export const fmtBytes = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);
