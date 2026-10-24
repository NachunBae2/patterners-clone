"use client";

// Read-only renderings of any work, reusing each editor's own SVG builders.
// Used by the share viewer and the local atelier (thumbnails + detail view).
import { buildSvg as crochetSvg } from "@/components/editor/crochet/geometry";
import { activePage, blankPage, cellAspect, type GridDoc } from "@/components/editor/grid/model";
import { chartSvg, thumbSvg } from "@/components/editor/grid/render";
import { geoOf, type KDoc } from "@/components/editor/knitting/model";
import { buildSvg as knitSvg, buildThumb as knitThumb } from "@/components/editor/knitting/render";
import { canonicalSymbol } from "@/lib/symbols/knitting";
import { svgThumbnail } from "./export";
import type { Craft, CrochetData, GridData, KnitData, WorkData } from "./types";

const EMPTY_THUMB = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><rect width="320" height="240" fill="#ffffff"/></svg>`;

export function gridDoc(data: GridData): GridDoc {
  const d = structuredClone(data) as GridDoc;
  if (!d.yarns?.length) d.yarns = ["#f4f1ea", "#2b2b2b"];
  if (d.yarns.length < 2) d.yarns.push("#2b2b2b");
  if (!d.pages?.length) d.pages = [blankPage("페이지 1", 40, 30)];
  if (!d.pages.some((p) => p.id === d.activePageId)) d.activePageId = d.pages[0].id;
  d.mode ??= "knit";
  d.gauge ??= { sts: 20, rows: 22 };
  return d;
}

export function knitDoc(d: KnitData & Partial<KDoc>): KDoc {
  return {
    grids: (d.grids ?? []).map((g) => ({
      ...g,
      cells:
        g.cells?.length === g.cols * g.rows
          ? g.cells.map((c) => (c?.symbol && canonicalSymbol(c.symbol) !== c.symbol ? { ...c, symbol: canonicalSymbol(c.symbol) } : c))
          : Array(g.cols * g.rows).fill(null),
    })),
    activeGridId: d.activeGridId ?? null,
    colors: d.colors?.length ? d.colors : ["#24365c", "#efe7d6", "#c47a5c"],
    gauge: d.gauge ?? { sts: 22, rows: 30 },
    gaugeOn: d.gaugeOn ?? false,
    bg: d.bg,
    view: d.view ?? { x: 0, y: 0, zoom: 1 },
  };
}

/** Full-size chart SVG (numbers, labels). `pageId` picks a page of a 배색·방안 work. Null when the work is empty. */
export function workSvg(craft: Craft, data: WorkData, pageId?: string): string | null {
  if (craft === "crochet") return crochetSvg((data as CrochetData).layers ?? [], { background: "#ffffff" });
  if (craft === "knitting") {
    const doc = knitDoc(data as KnitData);
    return knitSvg(doc, geoOf(doc), { numbers: true, labels: true, legend: true, background: "#ffffff" });
  }
  const doc = gridDoc(data as GridData);
  const page = doc.pages.find((p) => p.id === pageId) ?? activePage(doc);
  return chartSvg(doc, page, cellAspect(doc.mode, doc.gauge));
}

/** 320×240 thumbnail as a data URL (same look as the home cards). */
export function workThumb(craft: Craft, data: WorkData): string {
  let svg: string | null | undefined = null;
  if (craft === "crochet") svg = crochetSvg((data as CrochetData).layers ?? [], { fit: { w: 320, h: 240 }, margin: 16, background: "#ffffff" });
  else if (craft === "knitting") {
    const doc = knitDoc(data as KnitData);
    svg = knitThumb(doc, geoOf(doc));
  } else {
    const doc = gridDoc(data as GridData);
    svg = thumbSvg(doc, activePage(doc), cellAspect(doc.mode, doc.gauge));
  }
  return svgThumbnail(svg ?? EMPTY_THUMB);
}
