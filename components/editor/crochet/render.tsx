"use client";

import { memo } from "react";
import type { CrochetItem, CrochetLayer } from "@/lib/types";
import { INK, STROKE_WIDTH, renderPrims } from "@/lib/symbols/crochet";
import { FONT, dashArray, itemGeom, stitchTransform, strokePath, unionBounds } from "./geometry";

/** One item. Memoised by object identity: unchanged items never re-render. */
// `hk` (기호 높이 key) only exists so memoised items re-render when the doc's stitch heights change.
export const ItemView = memo(function ItemView({ item, fallback, bare }: { item: CrochetItem; fallback: string; bare?: boolean; hk?: string }) {
  const color = item.color ?? fallback;
  const id = bare ? undefined : item.id;
  switch (item.type) {
    case "stitch":
    case "gather": {
      const { w, h, prims, oy = 0 } = itemGeom(item);
      const hw = Math.max(w, 14), hh = Math.max(h, 14);
      return (
        <g data-id={id} transform={stitchTransform(item)} stroke={color}>
          {!bare && <rect x={-hw / 2} y={oy - hh / 2} width={hw} height={hh} fill="transparent" stroke="none" />}
          {renderPrims(prims, color)}
        </g>
      );
    }
    case "stroke": {
      const d = strokePath(item);
      return (
        <g data-id={id}>
          {!bare && <path d={d} stroke="transparent" strokeWidth={Math.max(10, (item.width ?? STROKE_WIDTH) + 8)} fill="none" />}
          <path d={d} stroke={color} strokeWidth={item.width ?? STROKE_WIDTH} strokeDasharray={dashArray(item)} fill="none" />
        </g>
      );
    }
    case "text":
      return (
        <text
          data-id={id}
          x={item.x}
          y={item.y}
          fontSize={item.size}
          fontFamily={FONT}
          fontWeight={600}
          textAnchor="middle"
          dominantBaseline="central"
          fill={color}
          stroke="none"
        >
          {item.text}
        </text>
      );
  }
});

export const LayerView = memo(function LayerView({ layer, dim, hk }: { layer: CrochetLayer; dim: boolean; hk?: string }) {
  if (!layer.visible) return null;
  const fallback = layer.color ?? INK;
  return (
    <g data-layer={layer.id} opacity={dim ? 0.28 : 1} style={dim ? { pointerEvents: "none" } : undefined}>
      {layer.items.map((it) => (
        <ItemView key={it.id} item={it} fallback={fallback} hk={hk} />
      ))}
    </g>
  );
});

/** Non-interactive preview of items (ghosts, palette thumbnails). */
export function ItemsPreview({ items, color }: { items: CrochetItem[]; color?: string }) {
  return (
    <>
      {items.map((it) => (
        <ItemView key={it.id} item={color ? { ...it, color } : it} fallback={INK} bare />
      ))}
    </>
  );
}

/** Fitted, non-interactive picture of some items (template cards, import / version previews). */
export function ChartPreview({ items, width, height, className, pad = 10 }: { items: CrochetItem[]; width: number; height: number; className?: string; pad?: number }) {
  const b = unionBounds(items);
  if (!b) return <svg width={width} height={height} className={className} aria-hidden="true" />;
  const bw = Math.max(b.x1 - b.x0, 30), bh = Math.max(b.y1 - b.y0, 30);
  const k = Math.min((width - pad * 2) / bw, (height - pad * 2) / bh);
  const vw = width / k, vh = height / k;
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`${cx - vw / 2} ${cy - vh / 2} ${vw} ${vh}`}
      className={className}
      aria-hidden="true"
      fill="none"
      strokeWidth={Math.max(STROKE_WIDTH, 1.1 / k)}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ pointerEvents: "none" }}
    >
      <ItemsPreview items={items} />
    </svg>
  );
}
