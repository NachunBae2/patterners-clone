"use client";

import { useMemo, useState } from "react";
import { Segmented } from "./ui";
import { svgThumbnail } from "@/lib/export";
import type { Craft, CrochetData, GridData, KnitData, WorkData } from "@/lib/types";
import { gridDoc, knitDoc, workSvg } from "@/lib/workSvg";

/** Facts shown next to a read-only work (size, yarns). */
export function workFacts(craft: Craft, data: WorkData): { label: string; value: string }[] {
  try {
    if (craft === "grid") {
      const d = gridDoc(data as GridData);
      const p = d.pages.find((x) => x.id === d.activePageId) ?? d.pages[0];
      return [
        { label: "크기", value: `${p.cols}코 × ${p.rows}단` },
        { label: "페이지", value: `${d.pages.length}장` },
        { label: "게이지 (10cm)", value: `${d.gauge.sts}코 × ${d.gauge.rows}단` },
      ];
    }
    if (craft === "knitting") {
      const d = knitDoc(data as KnitData);
      const facts = [{ label: "차트", value: `${d.grids.length}개` }];
      if (d.grids[0]) facts.push({ label: "첫 차트 크기", value: `${d.grids[0].cols}코 × ${d.grids[0].rows}단` });
      return facts;
    }
    const layers = (data as CrochetData).layers ?? [];
    return [
      { label: "레이어", value: `${layers.length}개` },
      { label: "기호", value: `${layers.reduce((n, l) => n + l.items.filter((i) => i.type !== "stroke" && i.type !== "text").length, 0)}개` },
    ];
  } catch {
    return [];
  }
}

/** Read-only rendering of a work: the editor's own SVG export shown as an image (no script can run). */
export function WorkPreview({ craft, data, className }: { craft: Craft; data: WorkData; className?: string }) {
  const pages = craft === "grid" ? gridDoc(data as GridData).pages : [];
  const [pageId, setPageId] = useState<string | undefined>(undefined);
  const src = useMemo(() => {
    try {
      const svg = workSvg(craft, data, pageId);
      return svg ? svgThumbnail(svg) : null;
    } catch {
      return undefined;
    }
  }, [craft, data, pageId]);

  return (
    <div className={className}>
      {pages.length > 1 && (
        <Segmented
          className="mb-x3 max-w-full overflow-x-auto"
          value={pageId ?? (data as GridData).activePageId ?? pages[0].id}
          onChange={setPageId}
          options={pages.map((p) => ({ value: p.id, label: p.name }))}
        />
      )}
      <div className="flex min-h-64 items-center justify-center overflow-hidden rounded-r3 border border-stroke-neutral-muted bg-bg-layer-fill p-x4">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="도안 미리보기" className="h-auto max-h-[70vh] w-full max-w-[880px] object-contain" />
        ) : (
          <p className="t4-regular text-fg-neutral-muted">{src === null ? "아직 비어 있는 도안이에요." : "도안을 그리지 못했어요."}</p>
        )}
      </div>
    </div>
  );
}
