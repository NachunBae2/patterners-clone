"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { GridMode, GridPage, View } from "@/lib/types";
import {
  type Block,
  type FloatRun,
  type Numbering,
  type Rect,
  clamp,
  clipRect,
  fillRect,
  floodFill,
  getBlock,
  lineCells,
  putBlock,
  rectFrom,
} from "./model";
import { CELL, drawChart } from "./render";

export type Tool = "pencil" | "rect" | "fill" | "pick" | "select" | "pan";
type Cell = { c: number; r: number };

type Props = {
  page: GridPage;
  yarns: string[];
  mode: GridMode;
  aspect: number;
  safe: { sts: number; rows: number };
  numbering: Numbering;
  floats: FloatRun[] | null;
  view: View;
  setView: (v: View | ((v: View) => View)) => void;
  tool: Tool;
  spaceHeld: boolean;
  paintValue: number;
  mirror: boolean;
  sel: Rect | null;
  setSel: (s: Rect | null) => void;
  hover: Cell | null;
  setHover: (c: Cell | null) => void;
  checkpoint: () => void;
  commit: (p: GridPage, merge: boolean) => void;
  onPick: (v: number) => void;
  onSize: (s: { w: number; h: number }) => void;
  /** Grows (+) or crops (−) the page on one side, live while dragging an edge handle. */
  onEdge: (side: Side, n: number, base: GridPage) => void;
};

type Side = "left" | "right" | "top" | "bottom";

type Drag =
  | { kind: "pan"; sx: number; sy: number; view: View }
  | { kind: "paint"; last: Cell; value: number; page: GridPage }
  | { kind: "rect"; start: Cell; cur: Cell; value: number }
  | { kind: "select"; start: Cell }
  | { kind: "move"; start: Cell; base: GridPage; block: Block; sel: Rect };

export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 8;

export function GridCanvas(p: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [overlay, setOverlay] = useState<{ block: Block; c: number; r: number } | null>(null);
  const drag = useRef<Drag | null>(null);
  const [dragKind, setDragKind] = useState<Drag["kind"] | null>(null);
  const props = useRef(p);
  props.current = p;

  // size
  useLayoutEffect(() => {
    const el = wrapRef.current!;
    const ro = new ResizeObserver(() => {
      const s = { w: el.clientWidth, h: el.clientHeight };
      setSize(s);
      props.current.onSize(s);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // draw (coalesced to one frame)
  const raf = useRef(0);
  useLayoutEffect(() => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const cv = cvRef.current;
      if (!cv || !size.w) return;
      const dpr = window.devicePixelRatio || 1;
      const W = Math.round(size.w * dpr);
      const H = Math.round(size.h * dpr);
      if (cv.width !== W) cv.width = W;
      if (cv.height !== H) cv.height = H;
      const ctx = cv.getContext("2d")!;
      drawChart(ctx, {
        width: size.w,
        height: size.h,
        dpr,
        view: p.view,
        page: p.page,
        yarns: p.yarns,
        mode: p.mode,
        aspect: p.aspect,
        safe: p.safe,
        numbering: p.numbering,
        floats: p.floats,
        hover: p.hover,
        sel: p.sel,
        overlay,
      });
    });
  });

  // re-render when the device pixel ratio changes (browser zoom / moving screens)
  const [, bump] = useState(0);
  useEffect(() => {
    const mq = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    const on = () => bump((n) => n + 1);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  });

  const toCell = (e: { clientX: number; clientY: number }): Cell => {
    const rect = cvRef.current!.getBoundingClientRect();
    const { view, aspect } = props.current;
    const x = (e.clientX - rect.left - view.x) / view.zoom / CELL;
    const y = (e.clientY - rect.top - view.y) / view.zoom / (CELL * aspect);
    return { c: Math.floor(x), r: Math.floor(y) };
  };
  const inside = (c: Cell) => c.c >= 0 && c.r >= 0 && c.c < props.current.page.cols && c.r < props.current.page.rows;
  const inSel = (c: Cell, s: Rect | null) => !!s && c.c >= s.c && c.c < s.c + s.w && c.r >= s.r && c.r < s.r + s.h;

  const paintCells = (page: GridPage, cells: Cell[], v: number) => {
    const { cols, rows } = page;
    let out: number[] | null = null;
    const put = (c: number, r: number) => {
      if (c < 0 || r < 0 || c >= cols || r >= rows) return;
      const i = r * cols + c;
      if (page.cells[i] === v && !out) return;
      if (!out) out = page.cells.slice();
      out[i] = v;
    };
    for (const { c, r } of cells) {
      put(c, r);
      if (props.current.mirror) put(cols - 1 - c, r);
    }
    return out ? { ...page, cells: out } : page;
  };

  // wheel: scroll pans, ⌘/Ctrl (and pinch) zooms around the pointer
  useEffect(() => {
    const el = wrapRef.current!; // includes the edge handles
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      if (e.ctrlKey || e.metaKey) {
        const k = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0025) * (e.ctrlKey && !e.metaKey ? 2.5 : 1));
        props.current.setView((v) => {
          const z = clamp(v.zoom * k, ZOOM_MIN, ZOOM_MAX);
          return { zoom: z, x: mx - ((mx - v.x) * z) / v.zoom, y: my - ((my - v.y) * z) / v.zoom };
        });
      } else {
        const m = e.deltaMode === 1 ? 16 : 1;
        props.current.setView((v) => ({ ...v, x: v.x - e.deltaX * m, y: v.y - e.deltaY * m }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const begin = (d: Drag) => {
    drag.current = d;
    setDragKind(d.kind);
  };

  const onDown = (e: React.PointerEvent) => {
    if (drag.current) return;
    const P = props.current;
    (e.target as Element).setPointerCapture(e.pointerId);
    if (e.button === 1 || P.spaceHeld || P.tool === "pan") {
      e.preventDefault();
      begin({ kind: "pan", sx: e.clientX, sy: e.clientY, view: P.view });
      return;
    }
    const cell = toCell(e);
    const erase = e.button === 2;
    const value = erase ? -1 : P.paintValue;
    const tool = erase && P.tool !== "pencil" && P.tool !== "rect" ? "pencil" : P.tool;

    if (tool === "pencil" && e.altKey && !erase) {
      if (inside(cell)) P.onPick(P.page.cells[cell.r * P.page.cols + cell.c]);
      return;
    }
    if ((tool === "pencil" && e.shiftKey) || tool === "rect") {
      begin({ kind: "rect", start: cell, cur: cell, value });
      setOverlay(rectOverlay(cell, cell, value));
      return;
    }
    if (tool === "pencil") {
      P.checkpoint();
      const page = paintCells(P.page, [cell], value);
      if (page !== P.page) P.commit(page, true);
      begin({ kind: "paint", last: cell, value, page });
      return;
    }
    if (tool === "fill") {
      if (inside(cell)) {
        const page = floodFill(P.page, cell.c, cell.r, value);
        if (page !== P.page) P.commit(page, false);
      }
      return;
    }
    if (tool === "pick") {
      if (inside(cell)) P.onPick(P.page.cells[cell.r * P.page.cols + cell.c]);
      return;
    }
    if (tool === "select") {
      if (P.sel && inSel(cell, P.sel)) {
        P.checkpoint();
        const block = getBlock(P.page, P.sel);
        const base = e.altKey ? P.page : fillRect(P.page, P.sel, -1);
        begin({ kind: "move", start: cell, base, block, sel: P.sel });
      } else {
        P.setSel(null);
        begin({ kind: "select", start: cell });
      }
    }
  };

  const rectOverlay = (a: Cell, b: Cell, v: number) => {
    const r = rectFrom(a, b);
    return { block: { cols: r.w, rows: r.h, cells: Array(r.w * r.h).fill(v) }, c: r.c, r: r.r };
  };

  const onMove = (e: React.PointerEvent) => {
    const P = props.current;
    const cell = toCell(e);
    const h = inside(cell) ? cell : null;
    if (h?.c !== P.hover?.c || h?.r !== P.hover?.r) P.setHover(h);
    const d = drag.current;
    if (!d) return;
    if (d.kind === "pan") {
      P.setView({ ...d.view, x: d.view.x + e.clientX - d.sx, y: d.view.y + e.clientY - d.sy });
    } else if (d.kind === "paint") {
      if (cell.c === d.last.c && cell.r === d.last.r) return;
      const page = paintCells(d.page, lineCells(d.last, cell), d.value);
      d.last = cell;
      if (page !== d.page) {
        d.page = page;
        P.commit(page, true);
      }
    } else if (d.kind === "rect") {
      if (cell.c === d.cur.c && cell.r === d.cur.r) return;
      d.cur = cell;
      setOverlay(rectOverlay(d.start, cell, d.value));
    } else if (d.kind === "select") {
      const s = clipRect(rectFrom(d.start, cell), P.page.cols, P.page.rows);
      P.setSel(s.w > 0 && s.h > 0 ? s : null);
    } else if (d.kind === "move") {
      const dc = cell.c - d.start.c;
      const dr = cell.r - d.start.r;
      const s = { ...d.sel, c: d.sel.c + dc, r: d.sel.r + dr };
      if (P.sel && s.c === P.sel.c && s.r === P.sel.r) return;
      P.commit(putBlock(d.base, d.block, s.c, s.r), true);
      P.setSel(s);
    }
  };

  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    setDragKind(null);
    const P = props.current;
    if (!d) return;
    if (d.kind === "rect") {
      setOverlay(null);
      const r = rectFrom(d.start, d.cur);
      const page = fillRect(P.page, r, d.value);
      if (page.cells.some((v, i) => v !== P.page.cells[i])) P.commit(page, false);
    } else if (d.kind === "move" && P.sel) {
      const s = clipRect(P.sel, P.page.cols, P.page.rows);
      P.setSel(s.w > 0 && s.h > 0 ? s : null);
    }
  };

  const cursor =
    dragKind === "pan"
      ? "grabbing"
      : p.spaceHeld || p.tool === "pan"
        ? "grab"
        : p.tool === "select"
          ? p.hover && inSel(p.hover, p.sel)
            ? "move"
            : "default"
          : p.tool === "pick"
            ? "copy"
            : "cell";

  const cw = CELL * p.view.zoom;
  const ch = CELL * p.aspect * p.view.zoom;
  const W = p.page.cols * cw;
  const H = p.page.rows * ch;
  const edge = useRef<{ side: Side; start: number; base: GridPage; n: number } | null>(null);
  const edgeDown = (side: Side) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    props.current.checkpoint();
    edge.current = { side, start: side === "left" || side === "right" ? e.clientX : e.clientY, base: props.current.page, n: 0 };
  };
  const edgeMove = (e: React.PointerEvent) => {
    const d = edge.current;
    if (!d) return;
    const horiz = d.side === "left" || d.side === "right";
    const delta = (horiz ? e.clientX : e.clientY) - d.start;
    const out = d.side === "left" || d.side === "top" ? -delta : delta;
    const n = Math.round(out / (horiz ? cw : ch));
    if (n === d.n) return;
    d.n = n;
    props.current.onEdge(d.side, n, d.base);
  };
  const edgeUp = () => (edge.current = null);
  const handle = (side: Side, style: React.CSSProperties) => {
    const v = side === "left" || side === "right";
    return (
      <div
        key={side}
        data-grid-edge={side}
        onPointerDown={edgeDown(side)}
        onPointerMove={edgeMove}
        onPointerUp={edgeUp}
        onPointerCancel={edgeUp}
        title={v ? "끌어서 코 수 바꾸기" : "끌어서 단 수 바꾸기"}
        className={
          v
            ? `group absolute z-10 flex cursor-ew-resize items-center ${side === "left" ? "justify-start" : "justify-end"}`
            : `group absolute z-10 flex cursor-ns-resize justify-center ${side === "top" ? "items-start" : "items-end"}`
        }
        style={style}
      >
        <span
          aria-hidden="true"
          className={`flex items-center justify-center gap-0.5 rounded-full border border-stroke-neutral-muted bg-bg-layer-floating text-fg-neutral-muted shadow-s2 transition-colors group-hover:border-stroke-brand-solid group-hover:bg-bg-brand-solid group-hover:text-fg-neutral-inverted m-0.5 ${v ? "h-12 w-3 flex-col" : "h-3 w-12"}`}
        >
          <span className="size-[3px] rounded-full bg-current" />
          <span className="size-[3px] rounded-full bg-current" />
          <span className="size-[3px] rounded-full bg-current" />
        </span>
      </div>
    );
  };

  return (
    <div
      ref={wrapRef}
      data-canvas-surface="true"
      className="relative h-full w-full touch-none select-none overflow-hidden bg-bg-layer-default"
      style={{
        cursor,
        backgroundImage: "radial-gradient(oklch(0.78 0.01 260 / 0.35) 1px, transparent 1px)",
        backgroundSize: "20px 20px",
        backgroundPosition: `${p.view.x}px ${p.view.y}px`,
      }}
    >
      <canvas
        ref={cvRef}
        aria-label="배색 도안 격자"
        className="absolute inset-0 block h-full w-full"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={() => !drag.current && props.current.setHover(null)}
        onContextMenu={(e) => e.preventDefault()}
        onAuxClick={(e) => e.preventDefault()}
      />
      {size.w > 0 && (
        <>
          {handle("left", { left: p.view.x - 34, top: p.view.y, width: 34, height: H })}
          {handle("right", { left: p.view.x + W, top: p.view.y, width: 34, height: H })}
          {handle("top", { left: p.view.x, top: p.view.y - 34, width: W, height: 34 })}
          {handle("bottom", { left: p.view.x, top: p.view.y + H, width: W, height: 34 })}
        </>
      )}
    </div>
  );
}
