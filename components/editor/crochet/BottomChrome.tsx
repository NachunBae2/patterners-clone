"use client";

import { memo, useState } from "react";
import { cx } from "@/components/app/ui";
import { SymbolIcon } from "@/lib/symbols/crochet";
import { BTN, BTN_TOOL, el, sab } from "./seed";
import { ArrowRightLeft, BookmarkPlus, ChevronDown, CircleQuestionMark, Group, Hand, Hash, MousePointer2, PenTool, Pencil, Plus, Redo2, Undo2, Ungroup, X } from "./uiIcons";

export type Mode = "select" | "insert" | "pan" | "pen" | "linear" | "radial" | "number";

export type Slot = { label: string; filled: boolean; active: boolean; render: () => React.ReactNode };

/** Dots-on-a-circle icon of 원형 만들기 (drawn on a 20-unit grid like the reference). */
export function RadialIcon({ className }: { className?: string }) {
  const dots = [0, 60, 120, 180, 240, 300].map((a) => {
    const t = ((a - 90) * Math.PI) / 180;
    return [10 + Math.cos(t) * 7.5, 10 + Math.sin(t) * 7.5];
  });
  return (
    <svg viewBox="0 0 20 20" className={className ?? "size-4"} aria-hidden="true">
      <circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.25" strokeDasharray="1.5 2" />
      {dots.map(([x, y], i) => (
        <circle key={i} cx={Math.round(x * 100) / 100} cy={Math.round(y * 100) / 100} r="1.5" fill="currentColor" />
      ))}
    </svg>
  );
}

function ToolButton({ label, active, disabled, onClick, children, tool }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode; tool?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cx(sab(active ? "brandSolid" : "ghost"), tool ? BTN_TOOL : BTN, "w-x8 px-0", tool && "touch-manipulation")}
      style={el(32, 32)}
    >
      {children}
    </button>
  );
}

type QuickProps = {
  slots: Slot[];
  onTake: (i: number) => void;
  onEdit: (i: number) => void;
  onClear: (i: number) => void;
  onContext: (i: number, e: React.MouseEvent) => void;
};

/** Quick-slot strip (1–5) with its hide/show chevron. */
export const QuickSlots = memo(function QuickSlots(p: QuickProps) {
  const [shown, setShown] = useState(true);
  return (
    <div data-tour="quick-slots" className="pointer-events-none flex flex-col items-center">
      <button
        type="button"
        aria-expanded={shown}
        aria-label={shown ? "퀵 슬롯 숨기기" : "퀵 슬롯 보이기"}
        title={shown ? "퀵 슬롯 숨기기" : "퀵 슬롯 보이기"}
        onClick={() => setShown((v) => !v)}
        className="pointer-events-auto mb-1.5 flex h-4 w-8 shrink-0 items-center justify-center rounded-md border border-stroke-neutral-muted bg-bg-layer-default text-fg-neutral-muted shadow-s1 transition-colors hover:bg-bg-layer-default-pressed/50 hover:text-fg-neutral"
      >
        <ChevronDown className={cx("size-3 stroke-[2] transition-transform", !shown && "rotate-180")} />
      </button>
      <div className={cx("grid w-full transition-[grid-template-rows,opacity] duration-200 ease-out", shown ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-col items-center gap-1.5">
            <div role="group" aria-label="퀵 슬롯" className="pointer-events-auto flex items-end gap-1 rounded-lg border border-stroke-neutral-muted bg-bg-layer-default p-1.5 shadow-s3">
              {p.slots.map((s, i) => (
                <div key={i} className="group relative">
                  <button
                    type="button"
                    aria-label={s.filled ? `슬롯 ${i + 1} · ${s.label}` : `슬롯 ${i + 1} 등록`}
                    title={s.filled ? `${i + 1} · ${s.label}` : `슬롯 ${i + 1}에 기호 등록`}
                    onClick={() => p.onTake(i)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (s.filled) p.onContext(i, e);
                    }}
                    className={cx(
                      "relative flex size-11 flex-col items-center justify-center rounded-md border transition-colors",
                      s.active ? "border-stroke-brand-solid bg-bg-brand-weak" : "border-stroke-neutral-muted bg-bg-layer-fill/30 hover:bg-bg-layer-default-pressed/60",
                      !s.filled && "border-dashed text-fg-neutral-subtle",
                    )}
                  >
                    {/* layout-audit-ignore: tiny-text — slot number badge inside a 44px key, label also in aria-label/title */}
                    <span className="absolute bottom-0.5 left-0.5 flex size-3.5 items-center justify-center rounded-sm bg-bg-neutral-inverted/80 text-[9px] font-medium leading-none text-fg-neutral-inverted">{i + 1}</span>
                    {s.filled ? s.render() : <Plus className="size-3.5" />}
                  </button>
                  {s.filled && (
                    <>
                      <button
                        type="button"
                        aria-label="슬롯 수정"
                        title="슬롯 수정"
                        onClick={() => p.onEdit(i)}
                        className="pointer-events-none absolute top-0 left-0 z-[1] flex size-4 items-center justify-center rounded-full bg-bg-layer-fill text-fg-neutral-muted opacity-0 transition-opacity group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 hover:bg-bg-brand-solid hover:text-fg-neutral-inverted"
                      >
                        <Pencil className="size-2.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="슬롯 해제"
                        title="슬롯 해제"
                        onClick={() => p.onClear(i)}
                        className="pointer-events-none absolute top-0 right-0 z-[1] flex size-4 items-center justify-center rounded-full bg-bg-layer-fill text-fg-neutral-muted opacity-0 transition-opacity group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 hover:bg-bg-critical-solid hover:text-fg-neutral-inverted"
                      >
                        <X className="size-2.5" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

/** Slot glyph: the stitch icon drawn a little bolder, like the reference slots. */
export const slotGlyph = (id: string) => <SymbolIcon id={id} strokeWidth={1.75} className="mt-0.5 shrink-0 overflow-visible text-fg-neutral" />;

type ToolbarProps = {
  mode: Mode;
  spaceHeld: boolean;
  onMode: (m: Mode) => void;
  onUndo: () => void;
  onRedo: () => void;
  canEditPath: boolean;
  onEditPath: () => void;
  canGroup: boolean;
  canUngroup: boolean;
  onGroup: () => void;
  onUngroup: () => void;
  canRegister: boolean;
  onRegister: () => void;
  onHelp: () => void;
};

const Sep = () => <div className="mx-x0_5 h-6 w-px shrink-0 bg-stroke-neutral-muted @max-[38rem]/maker-canvas:hidden" />;

/** Floating bottom toolbar (order and labels from the reference). */
export const Toolbar = memo(function Toolbar(p: ToolbarProps) {
  const on = (m: Mode) => p.mode === m && !(m !== "pan" && p.spaceHeld);
  return (
    <div
      role="toolbar"
      aria-label="도구"
      className="maker-bottom-tools pointer-events-auto flex items-center gap-x1 rounded-r4 border border-stroke-neutral-muted bg-bg-layer-floating/95 p-x1_5 shadow-s3 backdrop-blur-md @max-[38rem]/maker-canvas:max-w-full @max-[38rem]/maker-canvas:flex-wrap @max-[38rem]/maker-canvas:justify-center"
    >
      <div className="flex items-center gap-0.5">
        <ToolButton label="실행 취소" onClick={p.onUndo}>
          <Undo2 />
        </ToolButton>
        <ToolButton label="다시 실행" onClick={p.onRedo}>
          <Redo2 />
        </ToolButton>
      </div>
      <Sep />
      <div className="relative h-8 @max-[38rem]/maker-canvas:order-first">
        <div className="flex h-8 w-max items-center gap-0.5">
          <div data-tour="toolbar-tools" className="flex h-8 items-center gap-0.5">
            <ToolButton tool label="선택 (V)" active={on("select")} onClick={() => p.onMode("select")}>
              <MousePointer2 />
            </ToolButton>
            <ToolButton tool label="삽입 (E)" active={on("insert")} onClick={() => p.onMode("insert")}>
              <Pencil />
            </ToolButton>
            <ToolButton tool label="이동" active={p.mode === "pan" || p.spaceHeld} onClick={() => p.onMode("pan")}>
              <Hand />
            </ToolButton>
            <ToolButton label="펜 도구 (P)" active={on("pen")} onClick={() => p.onMode("pen")}>
              <PenTool />
            </ToolButton>
            <ToolButton label={p.canEditPath ? "경로 편집" : "편집할 기호를 하나 선택한 뒤 경로 편집을 눌러 주세요."} disabled={!p.canEditPath} onClick={p.onEditPath}>
              <Pencil />
            </ToolButton>
          </div>
          <div data-tour="toolbar-repeat" className="flex h-8 items-center gap-0.5">
            <ToolButton label="평면 만들기 (L)" active={on("linear")} onClick={() => p.onMode("linear")}>
              <ArrowRightLeft className="size-4" />
            </ToolButton>
            <ToolButton label="원형 만들기 (O)" active={on("radial")} onClick={() => p.onMode("radial")}>
              <RadialIcon className="size-4" />
            </ToolButton>
          </div>
          <ToolButton label="단 숫자 넣기" active={on("number")} onClick={() => p.onMode("number")}>
            <Hash className="size-4" />
          </ToolButton>
          <div className="mx-x0_5 h-6 w-px shrink-0 bg-stroke-neutral-muted" />
          <div data-tour="toolbar-group" className="flex h-8 items-center gap-0.5">
            <ToolButton label="그룹 만들기 (⌘G)" disabled={!p.canGroup} onClick={p.onGroup}>
              <Group />
            </ToolButton>
            <ToolButton label="그룹 해제 (⇧⌘G)" disabled={!p.canUngroup} onClick={p.onUngroup}>
              <Ungroup />
            </ToolButton>
          </div>
        </div>
      </div>
      <Sep />
      <div data-tour="register-icon" className="flex items-center gap-0.5">
        <ToolButton label="내 기호로 등록 (M)" disabled={!p.canRegister} onClick={p.onRegister}>
          <BookmarkPlus />
        </ToolButton>
      </div>
      <Sep />
      <div data-tour="help">
        <ToolButton label="단축키 도움말" onClick={p.onHelp}>
          <CircleQuestionMark />
        </ToolButton>
      </div>
    </div>
  );
});
