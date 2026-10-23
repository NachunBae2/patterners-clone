"use client";

import { memo } from "react";
import type { CrochetItem, CrochetLayer } from "@/lib/types";
import { INK, STROKE_WIDTH, renderPrims } from "@/lib/symbols/crochet";
import { FONT, dashArray, itemGeom, stitchTransform, strokePath } from "./geometry";

/** One item. Memoised by object identity: unchanged items never re-render. */
export const ItemView = memo(function ItemView({ item, fallback, bare }: { item: CrochetItem; fallback: string; bare?: boolean }) {
  const color = item.color ?? fallback;
  const id = bare ? undefined : item.id;
  switch (item.type) {
    case "stitch":
    case "gather": {
      const { w, h, prims } = itemGeom(item);
      const hw = Math.max(w, 14), hh = Math.max(h, 14);
      return (
        <g data-id={id} transform={stitchTransform(item)} stroke={color}>
          {!bare && <rect x={-hw / 2} y={-hh / 2} width={hw} height={hh} fill="transparent" stroke="none" />}
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

export const LayerView = memo(function LayerView({ layer, dim }: { layer: CrochetLayer; dim: boolean }) {
  if (!layer.visible) return null;
  const fallback = layer.color ?? INK;
  return (
    <g data-layer={layer.id} opacity={dim ? 0.28 : 1} style={dim ? { pointerEvents: "none" } : undefined}>
      {layer.items.map((it) => (
        <ItemView key={it.id} item={it} fallback={fallback} />
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
