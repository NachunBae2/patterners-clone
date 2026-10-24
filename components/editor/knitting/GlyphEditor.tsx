"use client";

// 내 기호 만들기: draw a chart symbol on a small snapping grid (24 units per stitch, like the catalogue glyphs).
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button, Dialog, cx, useToast } from "@/components/app/ui";
import { CUSTOM_PREFIX, sanitizeGlyphSvg, type CustomGlyph } from "@/lib/symbols/knitting";
import { uid } from "@/lib/id";
import { Circle, Eraser, PaintBucket, PenLine, Redo2, Slash, Square, Triangle, Type, Undo2 } from "./icons";

/* layout-audit-ignore: tiny-text — editor captions follow the palette's 11–12px type */

export type Shape =
  | { t: "pen"; pts: [number, number][] }
  | { t: "line"; x1: number; y1: number; x2: number; y2: number }
  | { t: "rect"; x: number; y: number; w: number; h: number; fill?: boolean }
  | { t: "ellipse"; cx: number; cy: number; rx: number; ry: number; fill?: boolean }
  | { t: "tri"; x: number; y: number; w: number; h: number; fill?: boolean }
  | { t: "text"; x: number; y: number; text: string; size: number };
export type MyGlyph = CustomGlyph & { shapes?: Shape[] };
type Tool = "pen" | "line" | "rect" | "ellipse" | "tri" | "text" | "eraser";

const U = 24;
const f = (n: number) => Math.round(n * 100) / 100;
const esc = (s: string) => s.replace(/[<>&"]/g, "");

export function shapeMarkup(s: Shape): string {
  const fill = "fill" in s && s.fill ? ' fill="currentColor"' : "";
  switch (s.t) {
    case "pen":
      return s.pts.length > 1 ? `<path d="M${s.pts.map(([x, y]) => `${f(x)} ${f(y)}`).join("L")}"/>` : "";
    case "line":
      return `<path d="M${f(s.x1)} ${f(s.y1)}L${f(s.x2)} ${f(s.y2)}"/>`;
    case "rect":
      return `<rect x="${f(s.x)}" y="${f(s.y)}" width="${f(s.w)}" height="${f(s.h)}"${fill}/>`;
    case "ellipse":
      return `<ellipse cx="${f(s.cx)}" cy="${f(s.cy)}" rx="${f(s.rx)}" ry="${f(s.ry)}"${fill}/>`;
    case "tri":
      return `<path d="M${f(s.x + s.w / 2)} ${f(s.y)}L${f(s.x + s.w)} ${f(s.y + s.h)}L${f(s.x)} ${f(s.y + s.h)}Z"${fill}/>`;
    case "text":
      return `<text x="${f(s.x)}" y="${f(s.y)}" font-size="${f(s.size)}" font-weight="600" text-anchor="middle" dominant-baseline="central" fill="currentColor" stroke="none">${esc(s.text)}</text>`;
  }
}

const TOOLS: [Tool, string, ReactNode][] = [
  ["pen", "펜", <PenLine key="p" className="size-4" />],
  ["line", "직선", <Slash key="l" className="size-4" />],
  ["rect", "사각형", <Square key="r" className="size-4" />],
  ["ellipse", "원", <Circle key="e" className="size-4" />],
  ["tri", "세모", <Triangle key="t" className="size-4" />],
  ["text", "글자", <Type key="x" className="size-4" />],
  ["eraser", "지우개", <Eraser key="z" className="size-4" />],
];

export function GlyphEditor({ open, initial, onClose, onSave }: { open: boolean; initial: MyGlyph | null; onClose: () => void; onSave: (g: MyGlyph) => void }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [width, setWidth] = useState(1);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [past, setPast] = useState<Shape[][]>([]);
  const [future, setFuture] = useState<Shape[][]>([]);
  const [tool, setTool] = useState<Tool>("line");
  const [fill, setFill] = useState(false);
  const [label, setLabel] = useState("A");
  const [draft, setDraft] = useState<Shape | null>(null);
  const [nameError, setNameError] = useState(false);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setWidth(initial?.width ?? 1);
    setShapes(initial?.shapes ?? []);
    setPast([]);
    setFuture([]);
    setDraft(null);
    setNameError(false);
    setTool("line");
  }, [open, initial]);

  const W = U * width;
  // drawing area ≈ 288px tall, at most 640px wide
  const scale = Math.min(288 / U, 640 / W);
  const commit = (next: Shape[]) => {
    setPast((p) => [...p.slice(-60), shapes]);
    setFuture([]);
    setShapes(next);
  };
  const undo = () => {
    const p = past[past.length - 1];
    if (!p) return;
    setFuture((fu) => [shapes, ...fu]);
    setPast((pp) => pp.slice(0, -1));
    setShapes(p);
  };
  const redo = () => {
    const n = future[0];
    if (!n) return;
    setPast((p) => [...p, shapes]);
    setFuture((fu) => fu.slice(1));
    setShapes(n);
  };

  /** pointer → glyph units, snapped to 1 unit (pen: 0.5) inside the box */
  const toUnit = (e: { clientX: number; clientY: number }, snap = 1) => {
    const r = svgRef.current!.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const y = ((e.clientY - r.top) / r.height) * U;
    const s = (v: number, max: number) => Math.max(0, Math.min(max, Math.round(v / snap) * snap));
    return { x: s(x, W), y: s(y, U) };
  };

  const shapeFrom = (a: { x: number; y: number }, b: { x: number; y: number }): Shape | null => {
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const w = Math.abs(a.x - b.x);
    const h = Math.abs(a.y - b.y);
    switch (tool) {
      case "line":
        return { t: "line", x1: a.x, y1: a.y, x2: b.x, y2: b.y };
      case "rect":
        return { t: "rect", x, y, w, h, fill };
      case "ellipse":
        return { t: "ellipse", cx: x + w / 2, cy: y + h / 2, rx: w / 2, ry: h / 2, fill };
      case "tri":
        return { t: "tri", x, y, w, h, fill };
      default:
        return null;
    }
  };

  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (tool === "eraser") return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    if (tool === "text") {
      const p = toUnit(e);
      if (label.trim()) commit([...shapes, { t: "text", x: p.x, y: p.y, text: label.trim().slice(0, 3), size: 11 }]);
      return;
    }
    const p = toUnit(e, tool === "pen" ? 0.5 : 1);
    drag.current = p;
    setDraft(tool === "pen" ? { t: "pen", pts: [[p.x, p.y]] } : shapeFrom(p, p));
  };
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const a = drag.current;
    if (!a || !draft) return;
    if (draft.t === "pen") {
      const p = toUnit(e, 0.5);
      const last = draft.pts[draft.pts.length - 1];
      if (last[0] !== p.x || last[1] !== p.y) setDraft({ ...draft, pts: [...draft.pts, [p.x, p.y]] });
      return;
    }
    setDraft(shapeFrom(a, toUnit(e)));
  };
  const onUp = () => {
    const d = draft;
    drag.current = null;
    setDraft(null);
    if (!d) return;
    const tiny = (d.t === "line" && d.x1 === d.x2 && d.y1 === d.y2) || ((d.t === "rect" || d.t === "tri") && (!d.w || !d.h)) || (d.t === "ellipse" && (!d.rx || !d.ry)) || (d.t === "pen" && d.pts.length < 2);
    if (!tiny) commit([...shapes, d]);
  };

  const markup = useMemo(() => shapes.map(shapeMarkup).join(""), [shapes]);
  const save = () => {
    const n = name.trim().slice(0, 40);
    if (!n) {
      setNameError(true);
      toast("이름을 입력해 주세요");
      return;
    }
    if (!shapes.length) {
      toast("기호를 먼저 그려 주세요");
      return;
    }
    onSave({ id: initial?.id ?? `${CUSTOM_PREFIX}${uid()}`, name: n, width, svg: sanitizeGlyphSvg(markup), shapes, createdAt: initial?.createdAt ?? Date.now() });
  };

  // guide lines: every unit faint, every 6 units darker, stitch borders solid
  const guides = useMemo(() => {
    const out: ReactNode[] = [];
    for (let x = 0; x <= W; x += 2) out.push(<line key={`v${x}`} x1={x} y1={0} x2={x} y2={U} stroke={x % U === 0 ? "#a1a1aa" : x % 6 === 0 ? "#d4d4d8" : "#ececef"} strokeWidth={x % U === 0 ? 1.2 : 0.8} vectorEffect="non-scaling-stroke" />);
    for (let y = 0; y <= U; y += 2) out.push(<line key={`h${y}`} x1={0} y1={y} x2={W} y2={y} stroke={y % U === 0 ? "#a1a1aa" : y % 6 === 0 ? "#d4d4d8" : "#ececef"} strokeWidth={y % U === 0 ? 1.2 : 0.8} vectorEffect="non-scaling-stroke" />);
    return out;
  }, [W]);

  const all = draft ? markup + shapeMarkup(draft) : markup;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial ? "내 기호 편집" : "내 기호 만들기"}
      width={760}
      footer={
        <>
          <Button onClick={onClose}>닫기</Button>
          <Button variant="primary" onClick={save}>
            저장
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-x3">
        <div className="flex flex-wrap items-center gap-x3">
          <input
            autoFocus
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameError(false);
            }}
            placeholder="기호 이름"
            aria-label="기호 이름"
            aria-invalid={nameError}
            className={cx(
              "h-10 min-w-0 flex-1 rounded-r2 border bg-bg-layer-default px-x3 text-[16px] outline-none focus:border-stroke-neutral-contrast md:text-[14px]",
              nameError ? "border-stroke-critical-solid" : "border-stroke-neutral-weak",
            )}
          />
          <label className="flex items-center gap-x2 text-[13px] text-fg-neutral-muted">
            가로
            <select
              value={width}
              aria-label="기호 너비 (코)"
              onChange={(e) => setWidth(Number(e.target.value))}
              className="h-10 rounded-r2 border border-stroke-neutral-weak bg-bg-layer-default px-x2 text-[14px] text-fg-neutral"
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}코
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-x1 rounded-r2 bg-bg-layer-fill p-x1" role="toolbar" aria-label="그리기 도구">
          {TOOLS.map(([t, label, icon]) => (
            <button
              key={t}
              type="button"
              aria-label={label}
              title={label}
              aria-pressed={tool === t}
              onClick={() => setTool(t)}
              className={cx("flex h-8 items-center gap-x1 rounded-r1_5 px-x2 text-[12px] font-medium", tool === t ? "bg-bg-layer-default text-fg-neutral shadow-s1" : "text-fg-neutral-muted hover:text-fg-neutral")}
            >
              {icon}
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
          <span className="mx-x1 h-5 w-px bg-stroke-neutral-muted" />
          <button
            type="button"
            aria-pressed={fill}
            title="채우기 (사각형·원·세모)"
            onClick={() => setFill((v) => !v)}
            className={cx("flex h-8 items-center gap-x1 rounded-r1_5 px-x2 text-[12px] font-medium", fill ? "bg-bg-layer-default text-fg-neutral shadow-s1" : "text-fg-neutral-muted hover:text-fg-neutral")}
          >
            <PaintBucket className="size-4" />
            채우기
          </button>
          {tool === "text" && (
            <input
              value={label}
              maxLength={3}
              onChange={(e) => setLabel(e.target.value)}
              aria-label="넣을 글자"
              placeholder="글자"
              className="h-8 w-16 rounded-r1_5 border border-stroke-neutral-weak bg-bg-layer-default px-x2 text-[16px] md:text-[13px]"
            />
          )}
          <span className="ml-auto flex items-center gap-0.5">
            <button type="button" aria-label="실행 취소" title="실행 취소" disabled={!past.length} onClick={undo} className="flex size-8 items-center justify-center rounded-r1_5 text-fg-neutral-muted hover:text-fg-neutral disabled:opacity-35">
              <Undo2 className="size-4" />
            </button>
            <button type="button" aria-label="다시 실행" title="다시 실행" disabled={!future.length} onClick={redo} className="flex size-8 items-center justify-center rounded-r1_5 text-fg-neutral-muted hover:text-fg-neutral disabled:opacity-35">
              <Redo2 className="size-4" />
            </button>
            <button type="button" disabled={!shapes.length} onClick={() => commit([])} className="h-8 rounded-r1_5 px-x2 text-[12px] text-fg-neutral-muted hover:text-fg-critical disabled:opacity-35">
              모두 지우기
            </button>
          </span>
        </div>

        <div className="flex flex-wrap items-start gap-x4">
          <div className="overflow-hidden rounded-r2 border border-stroke-neutral-muted bg-white" style={{ width: W * scale + 2 }}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${U}`}
              width={W * scale}
              height={U * scale}
              className={cx("block touch-none", tool === "eraser" ? "cursor-pointer" : "cursor-crosshair")}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              aria-label="기호 그리는 칸"
              role="img"
            >
              {guides}
              <g fill="none" stroke="#222" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" color="#222">
                <g dangerouslySetInnerHTML={{ __html: all.replace(/<(path|rect|ellipse|line)\b/g, '<$1 vector-effect="non-scaling-stroke"') }} style={{ pointerEvents: "none" }} />
              </g>
              {tool === "eraser" &&
                shapes.map((s, i) => (
                  <g
                    key={i}
                    className="cursor-pointer [&:hover>*]:stroke-[#e5484d]"
                    fill="transparent"
                    stroke="transparent"
                    strokeWidth={6}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      commit(shapes.filter((_, k) => k !== i));
                    }}
                    dangerouslySetInnerHTML={{ __html: shapeMarkup(s).replace(/<(path|rect|ellipse|text)\b/g, '<$1 pointer-events="all" vector-effect="non-scaling-stroke" fill="transparent"') }}
                  />
                ))}
            </svg>
          </div>
          <div className="flex min-w-36 flex-col gap-x2">
            <span className="text-[12px] font-semibold text-fg-neutral-muted">차트에서</span>
            <div className="flex items-end gap-x3">
              <svg viewBox={`0 0 ${W} ${U}`} width={37 * width} height={28} preserveAspectRatio={width > 1 ? "none" : "xMidYMid meet"} className="rounded-[2px] border border-[#a1a1a1] bg-white" aria-hidden="true">
                <g fill="none" stroke="#222" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: markup.replace(/<(path|rect|ellipse|line)\b/g, '<$1 vector-effect="non-scaling-stroke"') }} />
              </svg>
              <svg viewBox={`0 0 ${W} ${U}`} width={width > 2 ? 52 : 22 * width} height={width > 2 ? 52 / width : 22} aria-hidden="true">
                <g fill="none" stroke="#222" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: markup.replace(/<(path|rect|ellipse|line)\b/g, '<$1 vector-effect="non-scaling-stroke"') }} />
              </svg>
            </div>
            <p className="max-w-52 text-[11px] leading-[1.5] text-fg-neutral-muted">
              {tool === "pen"
                ? "끌어서 자유롭게 그려요."
                : tool === "text"
                  ? "칸을 누르면 그 자리에 글자를 넣어요."
                  : tool === "eraser"
                    ? "지울 선이나 도형을 누르세요."
                    : "끌어서 그려요. 점은 칸 눈금에 맞춰져요."}{" "}
              저장하면 기호 팔레트의 「내 기호」에 담겨 다른 기호처럼 놓을 수 있어요. 이 브라우저에 저장돼요.
            </p>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
