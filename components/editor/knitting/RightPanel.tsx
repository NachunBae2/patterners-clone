"use client";

import { useRef, useState, type ReactNode } from "react";
import { Menu, cx } from "@/components/app/ui";
import { AB_TAIL, ab, seedSize } from "./ab";
import { ChevronDown, Eye, EyeOff, FolderPlus, Pencil, Plus, RotateCcwClock, Trash2 } from "./icons";
import { DEFAULT_ROW_SIDES, numberingOf, type KDoc, type KGrid, type Numbering, type RowSides } from "./model";

/* layout-audit-ignore: tiny-text — this panel reproduces the reference editor, whose settings use 10–12px type */

type Props = {
  doc: KDoc;
  activeId: string | null;
  zoom: number;
  savedAt: number | null;
  practice: boolean;
  onZoom: (action: "in" | "out" | "reset" | "fit") => void;
  onHistory: () => void;
  onActivate: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onAddGrid: () => void;
  onAddFolder: () => void;
  onNumbering: (n: Numbering) => void;
  onSides: (s: RowSides) => void;
  onGaugeOn: (on: boolean) => void;
  onGauge: (g: KDoc["gauge"]) => void;
  onClearRows: (odd: boolean) => void;
  onBg: (bg: { color: string; opacity: number }) => void;
};

const two = (n: number) => String(n).padStart(2, "0");
export function savedLabel(t: number) {
  const d = new Date(t);
  const h = d.getHours();
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${h < 12 ? "오전" : "오후"} ${two(h % 12 === 0 ? 12 : h % 12)}:${two(d.getMinutes())}`;
}

/** number field adjusted by dragging sideways (click to type) */
function Scrub({
  value,
  onChange,
  min,
  max,
  label,
  ariaLabel,
  icon,
  align = "center",
  suffix,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  label: string;
  ariaLabel: string;
  icon?: ReactNode;
  align?: "center" | "left" | "right";
  suffix?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const drag = useRef<{ x: number; v: number; moved: boolean } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      aria-label={ariaLabel}
      className={cx("flex min-w-0 cursor-ew-resize touch-none items-center gap-1 rounded-r2 px-1.5 select-none hover:bg-bg-neutral-weak-pressed", className)}
      onPointerDown={(e) => {
        if (editing) return;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, v: value, moved: false };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.x;
        if (Math.abs(dx) > 3) d.moved = true;
        if (d.moved) onChange(Math.max(min, Math.min(max, d.v + Math.round(dx / (e.shiftKey ? 24 : 8)))));
      }}
      onPointerUp={() => {
        const d = drag.current;
        drag.current = null;
        if (d && !d.moved) {
          setEditing(true);
          requestAnimationFrame(() => inputRef.current?.select());
        }
      }}
    >
      {icon && (
        <span aria-hidden="true" className="flex size-3.5 shrink-0 items-center justify-center text-fg-neutral-muted">
          {icon}
        </span>
      )}
      <input
        ref={inputRef}
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        aria-label={label}
        key={editing ? "e" : String(value)}
        defaultValue={String(value)}
        readOnly={!editing}
        onBlur={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, Math.round(v))));
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setEditing(false);
        }}
        className={cx(
          "w-full min-w-0 flex-1 bg-transparent text-[12px] leading-none text-fg-neutral tabular-nums outline-none disabled:cursor-not-allowed",
          !editing && "pointer-events-none",
          align === "center" ? "text-center" : align === "right" ? "text-right" : "",
        )}
        type="text"
      />
      {suffix && (
        <span aria-hidden="true" className="shrink-0 text-[10px] text-fg-neutral-muted">
          {suffix}
        </span>
      )}
    </div>
  );
}

function Seg<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2">
      <span className="truncate text-[11px] text-fg-neutral-muted">{label}</span>
      <div className="grid shrink-0 grid-cols-2 gap-0.5 rounded-r1_5 bg-bg-layer-fill/55 p-0.5" role="radiogroup" aria-label={label}>
        {options.map(([v, l]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(v)}
            className={cx(
              "h-6 min-w-10 rounded-r1 px-x2 text-[11px] font-medium transition-colors disabled:opacity-50",
              value === v ? "bg-bg-layer-default text-fg-neutral shadow-s1" : "text-fg-neutral-muted hover:text-fg-neutral",
            )}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

const SideIcon = ({ side, on }: { side: "left" | "top" | "right" | "bottom"; on: boolean }) => {
  const l = { left: [5, 5, 5, 19], top: [5, 5, 19, 5], right: [19, 5, 19, 19], bottom: [5, 19, 19, 19] }[side];
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cx("size-3.5 shrink-0", on && "text-fg-neutral")} aria-hidden="true">
      <rect x="5" y="5" width="14" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.5 2" className={on ? "opacity-80" : "opacity-70"} />
      <line x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" className={on ? "opacity-100" : "opacity-75"} />
    </svg>
  );
};

function Detail(p: Props & { grid: KGrid }) {
  const g = p.grid;
  const n = numberingOf(g.numbering);
  const sides = g.sides ?? DEFAULT_ROW_SIDES;
  const set = (patch: Partial<Numbering>) => p.onNumbering({ ...n, ...patch });
  const sideNames = { left: "왼쪽", top: "위", right: "오른쪽", bottom: "아래" } as const;
  return (
    <section className="shrink-0 border-b border-stroke-neutral-muted">
      <div className="flex h-10 items-center justify-between gap-x2 px-x3">
        <span className="t2-bold text-fg-neutral">상세설정</span>
      </div>
      <div className="flex flex-col gap-x2 px-x3 pb-x4">
        <div className="flex min-w-0 flex-col gap-x3">
          <div className="flex min-w-0 flex-col gap-x2 border-b border-stroke-neutral-muted pb-x3" title="차트는 겉면에서 본 모양이에요. 평면뜨기는 안면 단을 뜨는 대로 바꿔 적어요.">
            <Seg
              label="뜨는 방식"
              value={sides.worked}
              options={[
                ["flat", "평면"],
                ["round", "원통"],
              ]}
              onChange={(worked) => p.onSides({ ...sides, worked })}
            />
            <Seg
              label="1단"
              value={sides.firstRowSide}
              options={[
                ["RS", "겉면"],
                ["WS", "안면"],
              ]}
              onChange={(firstRowSide) => p.onSides({ ...sides, firstRowSide })}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-x2 border-b border-stroke-neutral-muted pb-x3">
            <div className="flex min-w-0 items-center justify-between gap-2">
              <span className="truncate text-[11px] text-fg-neutral-muted">게이지</span>
              <label className="seed-switch__root seed-switch__root--size_24 peer shrink-0" data-slot="switch">
                <div
                  aria-hidden="true"
                  className="seed-switchmark__root seed-switchmark__root--tone_brand seed-switchmark__root--size_24 seed-scale-feedback"
                  data-checked={p.doc.gaugeOn ? "" : undefined}
                  style={seedSize(38, 24)}
                >
                  <div aria-hidden="true" className="seed-switchmark__thumb seed-switchmark__thumb--tone_brand seed-switchmark__thumb--size_24" data-checked={p.doc.gaugeOn ? "" : undefined} />
                </div>
                <input
                  role="switch"
                  aria-label="게이지"
                  type="checkbox"
                  checked={!!p.doc.gaugeOn}
                  onChange={(e) => p.onGaugeOn(e.target.checked)}
                  style={{ border: 0, clip: "rect(0px, 0px, 0px, 0px)", height: 1, margin: -1, overflow: "hidden", padding: 0, position: "absolute", whiteSpace: "nowrap", width: 1 }}
                />
              </label>
            </div>
            {p.doc.gaugeOn && (
              <div className="grid grid-cols-2 gap-x2">
                <Scrub
                  value={p.doc.gauge.sts}
                  min={4}
                  max={60}
                  label="10cm 코 수"
                  ariaLabel="10cm 코 수 · 드래그로 조절"
                  onChange={(sts) => p.onGauge({ ...p.doc.gauge, sts })}
                  className="h-8 w-full bg-bg-layer-fill/55"
                />
                <Scrub
                  value={p.doc.gauge.rows}
                  min={4}
                  max={80}
                  label="10cm 단 수"
                  ariaLabel="10cm 단 수 · 드래그로 조절"
                  onChange={(rows) => p.onGauge({ ...p.doc.gauge, rows })}
                  className="h-8 w-full bg-bg-layer-fill/55"
                />
              </div>
            )}
            {/* layout-audit-ignore: tiny-text — the reference shows the grid size at 10px */}
            <span className="text-[10px] text-fg-neutral-muted tabular-nums">
              {g.cols}코 × {g.rows}단
              {p.doc.gaugeOn && ` · 약 ${((g.cols * 10) / p.doc.gauge.sts).toFixed(1)} × ${((g.rows * 10) / p.doc.gauge.rows).toFixed(1)}cm`}
            </span>
          </div>
          <p className="text-[11px] font-medium tracking-tight">단수 표시</p>
          <div className="grid min-w-0 grid-cols-2 gap-x-x2 gap-y-x1_5 [&>*]:min-w-0">
            {(["left", "top", "right", "bottom"] as const).map((side) => (
              <div key={side} className="flex min-w-0 flex-col items-stretch gap-x0_5">
                <Scrub
                  value={n[side]}
                  min={0}
                  max={99}
                  label={sideNames[side]}
                  ariaLabel={`단수 표시 간격 · ${sideNames[side]} · 드래그로 조절`}
                  icon={<SideIcon side={side} on={n[side] > 0} />}
                  onChange={(v) => set({ [side]: v })}
                  className="h-8 w-full bg-bg-layer-fill/55"
                />
                <span aria-hidden="true" className="t1-regular truncate text-center text-fg-neutral-muted">
                  {sideNames[side]}
                </span>
              </div>
            ))}
            <div className="flex min-w-0 flex-col items-stretch gap-x0_5">
              <button
                type="button"
                aria-pressed={n.reverseRows}
                aria-label="단 순서 뒤집기"
                onClick={() => set({ reverseRows: !n.reverseRows })}
                className={cx(
                  "flex h-8 w-full min-w-0 items-center justify-center rounded-r2 border transition-colors disabled:opacity-50",
                  n.reverseRows ? "border-stroke-neutral-weak bg-bg-layer-default-pressed text-fg-neutral" : "border-stroke-neutral-muted bg-bg-layer-default text-fg-neutral-muted",
                )}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
                  <rect x="8.5" y="4.5" width="10" height="15" rx="1.5" />
                  <circle cy={n.reverseRows ? 15.5 : 5.5} cx="8.5" r="1.7" fill="currentColor" />
                  <circle cy="10.5" cx="8.5" r="1.15" fill="none" />
                  <circle cy={n.reverseRows ? 5.5 : 15.5} cx="8.5" r="1.15" fill="none" />
                  <path d={n.reverseRows ? "M4 15.5 V6.5 M2.2 8.5 L4 6.5 L5.8 8.5" : "M4 5.5 V14.5 M2.2 12.5 L4 14.5 L5.8 12.5"} />
                </svg>
              </button>
              <span aria-hidden="true" className="t1-regular truncate text-center text-fg-neutral-muted">
                단 순서 뒤집기
              </span>
            </div>
            <div className="flex min-w-0 flex-col items-stretch gap-x0_5">
              <button
                type="button"
                aria-pressed={n.reverseCols}
                aria-label="코 순서 뒤집기"
                onClick={() => set({ reverseCols: !n.reverseCols })}
                className={cx(
                  "flex h-8 w-full min-w-0 items-center justify-center rounded-r2 border transition-colors disabled:opacity-50",
                  n.reverseCols ? "border-stroke-neutral-weak bg-bg-layer-default-pressed text-fg-neutral" : "border-stroke-neutral-muted bg-bg-layer-default text-fg-neutral-muted",
                )}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
                  <rect x="4.5" y="5.5" width="15" height="10" rx="1.5" />
                  <circle cx={n.reverseCols ? 17 : 7} cy="5.5" r="1.7" fill="currentColor" />
                  <circle cx="12" cy="5.5" r="1.15" fill="none" />
                  <circle cx={n.reverseCols ? 7 : 17} cy="5.5" r="1.15" fill="none" />
                  <path d={n.reverseCols ? "M16.5 20 H7.5 M9.5 18.2 L7.5 20 L9.5 21.8" : "M7.5 20 H16.5 M14.5 18.2 L16.5 20 L14.5 21.8"} />
                </svg>
              </button>
              <span aria-hidden="true" className="t1-regular truncate text-center text-fg-neutral-muted">
                코 순서 뒤집기
              </span>
            </div>
          </div>
          <Scrub
            value={n.offset}
            min={0}
            max={60}
            label="도안과 거리"
            ariaLabel="번호와 도안 사이 여백 · 드래그로 조절 · Shift 정밀"
            align="left"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-3.5 shrink-0" aria-hidden="true">
                <rect x="8" y="7" width="8" height="10" rx="1.2" strokeDasharray="2.2 1.8" className="opacity-80" />
                <path d="M6 12H3.5M3.5 12l1.4-1.4M3.5 12l1.4 1.4" />
                <path d="M18 12h2.5M20.5 12l-1.4-1.4M20.5 12l-1.4 1.4" />
              </svg>
            }
            onChange={(offset) => set({ offset })}
            className="h-8 w-full bg-bg-layer-fill/55"
          />
          <div className="border-t border-stroke-neutral-muted pt-x3">
            <p className="mb-x2 text-[11px] font-medium tracking-tight">일괄 조정</p>
            <div className="grid grid-cols-2 gap-x2">
              <button className={cx(ab("neutralOutline"), AB_TAIL, "h-8 px-2 text-[11px] font-medium md:!rounded-r2")} type="button" style={seedSize(98, 32)} onClick={() => p.onClearRows(true)}>
                홀수단 비우기
              </button>
              <button className={cx(ab("neutralOutline"), AB_TAIL, "h-8 px-2 text-[11px] font-medium md:!rounded-r2")} type="button" style={seedSize(98, 32)} onClick={() => p.onClearRows(false)}>
                짝수단 비우기
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function RightPanel(p: Props) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [bgOpen, setBgOpen] = useState(false);
  const active = p.doc.grids.find((g) => g.id === p.activeId) ?? null;
  const bg = p.doc.bg ?? { color: "#ffffff", opacity: 100 };

  return (
    <div className="h-full shrink-0">
      <aside data-tour="layer-panel" aria-label="레이어" className="relative flex h-full w-60 shrink-0 flex-col overflow-hidden border-l border-stroke-neutral-muted bg-bg-layer-default">
        <div className="flex max-h-[60%] min-h-0 shrink-0 flex-col">
          <div className="flex h-10 shrink-0 items-center justify-between gap-x2 border-b border-stroke-neutral-muted px-x3">
            {!p.practice && p.savedAt != null && (
              <button
                type="button"
                className="flex max-w-[10rem] min-w-0 items-center gap-1 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-bg-layer-default-pressed/70"
                title="버전 기록"
                aria-label="버전 기록"
                onClick={p.onHistory}
              >
                <RotateCcwClock className="size-3.5 shrink-0 text-fg-neutral-muted" />
                <span className="min-w-0 truncate text-[11px] leading-tight text-fg-neutral-muted">{savedLabel(p.savedAt)}</span>
              </button>
            )}
            <Menu
              align="end"
              trigger={({ toggle }) => (
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-label="배율"
                  onClick={toggle}
                  className="t2-medium flex h-7 shrink-0 items-center gap-x0_5 rounded-r1 px-x1_5 text-fg-neutral-muted tabular-nums hover:bg-bg-layer-default-pressed hover:text-fg-neutral focus-visible:outline-2 focus-visible:outline-stroke-focus-ring"
                >
                  {Math.round(p.zoom * 100)}%
                  <ChevronDown className="size-3" />
                </button>
              )}
              items={[
                { label: "확대", shortcut: "⌘+", onSelect: () => p.onZoom("in") },
                { label: "축소", shortcut: "⌘−", onSelect: () => p.onZoom("out") },
                { label: "100%로 보기", shortcut: "⌘0", onSelect: () => p.onZoom("reset") },
                { label: "화면에 맞추기", shortcut: "⇧1", onSelect: () => p.onZoom("fit") },
              ]}
            />
          </div>
          <div className="[scrollbar-width:thin] min-h-0 overflow-y-auto overscroll-contain border-b border-stroke-neutral-muted empty:hidden [&>section:last-child]:border-b-0">
            {active && <Detail {...p} grid={active} />}
          </div>
        </div>
        <div className="flex h-10 shrink-0 items-center gap-x2 border-b border-stroke-neutral-muted px-x3">
          <span className="t2-bold text-fg-neutral">레이어</span>
        </div>
        <div className="[scrollbar-width:none] min-h-0 flex-1 overflow-y-auto overscroll-contain [&::-webkit-scrollbar]:hidden">
          <div>
            <div className="relative z-10 h-0">
              <div className="absolute inset-x-0 -top-1.5 h-3" />
            </div>
            {[...p.doc.grids].reverse().map((g) => (
              <div
                key={g.id}
                className={cx(
                  "group/row flex h-9 items-center gap-1.5 border-b border-stroke-neutral-muted px-1.5",
                  g.id === p.activeId ? "bg-sky-500/25" : "hover:bg-bg-layer-default-pressed/50",
                )}
              >
                {renaming === g.id ? (
                  <input
                    autoFocus
                    defaultValue={g.name}
                    aria-label="이름 변경"
                    onBlur={(e) => {
                      p.onRename(g.id, e.target.value.trim().slice(0, 40) || g.name);
                      setRenaming(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      if (e.key === "Escape") setRenaming(null);
                    }}
                    className="h-6 min-w-0 flex-1 rounded-sm bg-bg-layer-default px-1.5 text-[11px] outline-1 outline-stroke-neutral-weak"
                  />
                ) : (
                  <button
                    type="button"
                    className={cx("min-w-0 flex-1 truncate px-1.5 text-left text-[11px]", !g.visible && "text-fg-neutral-subtle")}
                    title={g.name}
                    onClick={() => p.onActivate(g.id)}
                    onDoubleClick={() => setRenaming(g.id)}
                  >
                    {g.name}
                  </button>
                )}
                <button
                  aria-label={g.visible ? "숨기기" : "보이기"}
                  type="button"
                  onClick={() => p.onToggle(g.id)}
                  className={cx(
                    "size-5 shrink-0 items-center justify-center rounded-sm text-fg-neutral-muted group-focus-within/row:flex group-hover/row:flex hover:bg-bg-layer-default-pressed hover:text-fg-neutral",
                    g.visible ? "hidden" : "flex",
                  )}
                >
                  {g.visible ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
                </button>
                <button
                  aria-label="이름 변경"
                  type="button"
                  onClick={() => setRenaming(g.id)}
                  className="hidden size-5 shrink-0 items-center justify-center rounded-sm text-fg-neutral-muted group-focus-within/row:flex group-hover/row:flex hover:bg-bg-layer-default-pressed hover:text-fg-neutral"
                >
                  <Pencil className="size-3" />
                </button>
                <button
                  aria-label="격자 삭제"
                  type="button"
                  onClick={() => p.onDelete(g.id)}
                  className="mr-0.5 hidden size-5 shrink-0 items-center justify-center rounded-sm text-fg-neutral-muted group-focus-within/row:flex group-hover/row:flex hover:bg-bg-layer-default-pressed hover:text-fg-critical"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))}
          </div>
          <div className="relative z-10 h-3">
            <div className="absolute inset-0" />
          </div>
        </div>
        <div className="flex h-10 items-center gap-1 border-t border-stroke-neutral-muted px-2">
          <div className="flex items-center gap-1.5">
            <div className="relative flex">
              <button
                type="button"
                aria-label="배경색"
                aria-haspopup="dialog"
                aria-expanded={bgOpen}
                onClick={() => setBgOpen((v) => !v)}
                className="relative size-4 shrink-0 overflow-hidden rounded border border-stroke-neutral-muted/80 shadow-sm"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(${hexA(bg.color, bg.opacity)}, ${hexA(bg.color, bg.opacity)}), repeating-conic-gradient(rgb(212, 212, 216) 0deg, rgb(212, 212, 216) 25%, rgb(255, 255, 255) 0deg, rgb(255, 255, 255) 50%) 0px 0px / 10px 10px`,
                  }}
                />
              </button>
              {bgOpen && (
                <div className="absolute bottom-[calc(100%+8px)] left-0 z-50 flex w-44 flex-col gap-x2 rounded-r3 border border-stroke-neutral-muted bg-bg-layer-floating p-x3 shadow-s3">
                  <span className="text-[12px] font-medium text-fg-neutral">배경색</span>
                  <div className="flex flex-wrap gap-x1_5">
                    {["#ffffff", "#f5f1ea", "#eef3f8", "#f3f3f1", "#1f1f1f"].map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`배경 ${c}`}
                        onClick={() => p.onBg({ ...bg, color: c })}
                        className={cx("size-6 rounded-full border border-black/10", bg.color === c && "ring-2 ring-stroke-neutral-contrast ring-offset-1")}
                        style={{ background: c }}
                      />
                    ))}
                    <label className="relative size-6 cursor-pointer rounded-full border border-dashed border-stroke-neutral-weak" title="직접 고르기">
                      <input type="color" aria-label="배경색 직접 고르기" value={bg.color} onChange={(e) => p.onBg({ ...bg, color: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" />
                    </label>
                  </div>
                </div>
              )}
            </div>
            <Scrub
              value={bg.opacity}
              min={0}
              max={100}
              label="배경 투명도"
              ariaLabel="배경 투명도 · 드래그로 조절"
              align="right"
              suffix="%"
              onChange={(opacity) => p.onBg({ ...bg, opacity })}
              className="h-7 w-16 bg-bg-layer-fill"
            />
          </div>
          <div className="ml-auto flex items-center gap-0.5">
            <button className={cx(ab("ghost"), AB_TAIL, "size-8 px-0")} aria-label="폴더 추가" style={seedSize(32, 32)} onClick={p.onAddFolder}>
              <FolderPlus className="size-4" />
            </button>
            <button className={cx(ab("ghost"), AB_TAIL, "size-8 px-0")} aria-label="레이어 추가" style={seedSize(32, 32)} onClick={p.onAddGrid}>
              <Plus className="size-4" />
            </button>
            <button
              aria-label="격자 삭제"
              type="button"
              disabled={!active}
              onClick={() => active && p.onDelete(active.id)}
              className="flex size-8 items-center justify-center rounded-md text-fg-neutral-muted transition-colors hover:bg-bg-layer-default-pressed hover:text-fg-critical"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

/** #rrggbb + percent → rgba() */
export function hexA(hex: string, pct: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(100, pct)) / 100})`;
}
