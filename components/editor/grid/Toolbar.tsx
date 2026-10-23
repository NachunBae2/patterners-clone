"use client";

// Floating bottom toolbar: history | drawing tools | mirror & flips | rotations | yarn swatch.
import { useRef, useState, type ReactNode } from "react";
import { cx, useOutside } from "@/components/app/ui";
import type { Tool } from "./GridCanvas";
import { ab, abBase, el } from "./fields";
import { LFlipH, LFlipV, LHand, LPaintBucket, LPencil, LPipette, LPlus, LRedo2, LRotateCcw, LRotateCw, LSplitH, LSquare, LSquareDashed, LUndo2, LX } from "./icons";
import { MAX_COLORS, filetInk } from "./model";

export const yarnName = (i: number) => (i === 0 ? "배경 실" : `실 ${i}`);

function TB(p: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode; tool?: string; wrap?: boolean }) {
  const btn = (
    <button
      type="button"
      className={cx(ab(p.active ? "brandSolid" : "ghost", "xsmall"), abBase, "w-x8 px-0")}
      aria-label={p.label}
      title={p.label}
      aria-pressed={p.tool || p.active !== undefined ? !!p.active : undefined}
      data-grid-tool={p.tool}
      data-disabled={p.disabled ? "" : undefined}
      disabled={p.disabled}
      onClick={p.onClick}
      style={el(32, 32)}
    >
      {p.children}
    </button>
  );
  return p.wrap ? <span className="inline-flex">{btn}</span> : btn;
}

const Sep = () => <div className="mx-x0_5 h-6 w-px bg-stroke-neutral-muted @max-[40rem]/grid-tools:hidden" />;

type Props = {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  tool: Tool;
  spaceHeld: boolean;
  setTool: (t: Tool) => void;
  mirror: boolean;
  setMirror: (v: boolean) => void;
  hasSel: boolean;
  transform: (op: "flipH" | "flipV" | "cw" | "ccw") => void;
  yarns: string[];
  filet: boolean;
  current: number;
  counts: number[];
  setCurrent: (i: number) => void;
  onAddYarn: (c: string) => void;
  onRecolor: (i: number, c: string) => void;
  onRemoveYarn: (i: number) => void;
};

export function Toolbar(p: Props) {
  const tools: { t: Tool; label: string; icon: ReactNode }[] = [
    { t: "pencil", label: "연필 (B) · Shift+드래그로 네모 칠하기", icon: <LPencil /> },
    { t: "rect", label: "사각형 (U)", icon: <LSquare /> },
    { t: "fill", label: "채우기 (G)", icon: <LPaintBucket /> },
    { t: "pick", label: "스포이트 (I)", icon: <LPipette /> },
    { t: "select", label: "선택 (M)", icon: <LSquareDashed /> },
    { t: "pan", label: "화면 이동 (H)", icon: <LHand /> },
  ];
  const flipHint = p.hasSel ? "" : " · 먼저 영역을 선택하세요";
  return (
    <div
      className="@container/grid-tools pointer-events-none absolute inset-x-0 bottom-0 z-50 flex overflow-x-auto overscroll-x-contain px-3 pt-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] [scrollbar-width:none]"
      data-grid-toolbar-scroll="true"
    >
      <div
        role="toolbar"
        aria-label="도구"
        data-grid-toolbar="true"
        className="maker-bottom-tools pointer-events-auto mx-auto flex shrink-0 items-center gap-x1 rounded-r4 border border-stroke-neutral-muted bg-bg-layer-floating/95 p-x1_5 shadow-s3 backdrop-blur-md @max-[40rem]/grid-tools:max-w-full @max-[40rem]/grid-tools:flex-wrap @max-[40rem]/grid-tools:justify-center @max-[40rem]/grid-tools:gap-x-x3 @max-[40rem]/grid-tools:gap-y-x1"
      >
        <div className="flex items-center gap-0.5">
          <TB wrap label="실행 취소" disabled={!p.canUndo} onClick={p.onUndo}>
            <LUndo2 />
          </TB>
          <TB wrap label="다시 실행" disabled={!p.canRedo} onClick={p.onRedo}>
            <LRedo2 />
          </TB>
        </div>
        <Sep />
        <div className="flex items-center gap-0.5">
          {tools.map((x) => (
            <TB key={x.t} tool={x.t} label={x.label} active={p.tool === x.t || (x.t === "pan" && p.spaceHeld)} onClick={() => p.setTool(x.t)}>
              {x.icon}
            </TB>
          ))}
        </div>
        <Sep />
        <div className="flex items-center gap-0.5">
          <TB label="좌우 대칭 그리기" active={p.mirror} onClick={() => p.setMirror(!p.mirror)}>
            <LSplitH />
          </TB>
          <TB wrap label={`좌우 반전${flipHint}`} disabled={!p.hasSel} onClick={() => p.transform("flipH")}>
            <LFlipH />
          </TB>
          <TB wrap label={`상하 반전${flipHint}`} disabled={!p.hasSel} onClick={() => p.transform("flipV")}>
            <LFlipV />
          </TB>
        </div>
        <Sep />
        <div className="flex items-center gap-0.5">
          <TB label={p.hasSel ? "선택 영역 반시계 방향으로 90° 회전" : "반시계 방향으로 90° 회전"} onClick={() => p.transform("ccw")}>
            <LRotateCcw />
          </TB>
          <TB label={p.hasSel ? "선택 영역 시계 방향으로 90° 회전" : "시계 방향으로 90° 회전"} onClick={() => p.transform("cw")}>
            <LRotateCw />
          </TB>
        </div>
        <Sep />
        <Swatch {...p} />
      </div>
    </div>
  );
}

const checker = "repeating-conic-gradient(rgb(212, 212, 216) 0deg, rgb(212, 212, 216) 25%, rgb(255, 255, 255) 0deg, rgb(255, 255, 255) 50%) 0px 0px / 10px 10px";

function Swatch(p: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, open, () => setOpen(false));
  const color = p.filet ? (p.current >= 1 ? filetInk(p.yarns) : "#ffffff") : p.yarns[p.current] ?? p.yarns[0];
  const list = p.filet
    ? [
        { i: 1, c: filetInk(p.yarns), label: "채운칸" },
        { i: 0, c: "#ffffff", label: "빈칸" },
      ]
    : p.yarns.map((c, i) => ({ i, c, label: yarnName(i) }));
  return (
    <span className="mx-x0_5 inline-flex" data-grid-swatch="">
      <div ref={ref} className="relative">
        <button
          type="button"
          aria-label="새 실 색 추가"
          title={`${p.filet ? (p.current >= 1 ? "채운칸" : "빈칸") : yarnName(p.current)} · 실 고르기`}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="relative block shrink-0 overflow-hidden rounded border border-stroke-neutral-muted/80 shadow-sm size-6 rounded-r1"
        >
          <span className="absolute inset-0" aria-hidden="true" style={{ background: `linear-gradient(${color}, ${color}), ${checker}` }} />
        </button>
        {open && (
          <div role="dialog" aria-label="실" className="absolute right-0 bottom-[calc(100%+12px)] z-50 w-60 rounded-r3 border border-stroke-neutral-muted bg-bg-layer-floating p-x2 shadow-s3">
            <ul className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
              {list.map(({ i, c, label }) => (
                <li key={i} className={cx("group flex items-center gap-x1 rounded-r2 pr-x1", p.current === i ? "bg-bg-layer-fill" : "hover:bg-bg-layer-fill")}>
                  <button type="button" aria-pressed={p.current === i} onClick={() => p.setCurrent(i)} className="flex h-9 min-w-0 flex-1 items-center gap-x2 px-x2 text-left">
                    <span className="size-5 shrink-0 rounded-r1 border border-black/15" style={{ background: c }} />
                    <span className={cx("t2-regular min-w-0 flex-1 truncate", p.current === i && "font-semibold")}>{label}</span>
                    <span className="t1-regular shrink-0 tabular-nums text-fg-neutral-muted">
                      {p.counts[i] ?? 0}
                      {p.filet ? "칸" : "코"}
                    </span>
                  </button>
                  {(!p.filet || i === 1) && (
                    <label className="relative flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-r1 text-[11px] text-fg-neutral-muted hover:bg-bg-layer-default" title={`${label} 색 바꾸기`}>
                      <span className="size-3 rounded-full border border-black/20" style={{ background: c }} />
                      <input type="color" aria-label={`${label} 색 바꾸기`} value={c} onChange={(e) => p.onRecolor(i, e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
                    </label>
                  )}
                  {!p.filet && i > 0 && p.yarns.length > 2 && (
                    <button type="button" aria-label={`${label} 지우기`} title={`${label} 지우기`} onClick={() => p.onRemoveYarn(i)} className="flex size-7 shrink-0 items-center justify-center rounded-r1 text-fg-neutral-muted hover:bg-bg-layer-default">
                      <LX className="size-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {!p.filet && p.yarns.length < MAX_COLORS && (
              <label className="t2-medium relative mt-x1 flex h-9 cursor-pointer items-center gap-x2 rounded-r2 px-x2 text-fg-neutral hover:bg-bg-layer-fill">
                <LPlus className="size-4" />
                새 실 색 추가
                <input type="color" aria-label="새 실 색 추가" defaultValue="#c47a5c" className="absolute inset-0 cursor-pointer opacity-0" onChange={(e) => p.onAddYarn(e.target.value)} />
              </label>
            )}
          </div>
        )}
      </div>
    </span>
  );
}
