"use client";

import { memo, useMemo, useState } from "react";
import { ColorSwatches, IconButton, Menu, NumberField, Segmented, cx, type MenuItem } from "@/components/app/ui";
import type { CrochetItem, CrochetLayer, GatherItem, StitchItem, StrokeItem, TextItem } from "@/lib/types";
import { INK, getSymbol } from "@/lib/symbols/crochet";
import { BTN, el, sab } from "./seed";
import { ChevronDown, ChevronUp, Eye, EyeOff, FlipHorizontal, FlipVertical, FolderPlus, Group as GroupIcon, Plus, RotateCcwClock, Ruler, Trash2, Ungroup } from "./uiIcons";

export const SWATCHES = ["#1f1f1f", "#d64545", "#e8833a", "#d9a400", "#4f9d2d", "#2e86c1", "#6c4bc4", "#c2408f", "#8a6a4f", "#9aa0a6"];

export type LayerActions = {
  add: () => void;
  rename: (id: string, name: string) => void;
  toggle: (id: string) => void;
  remove: (id: string) => void;
  move: (id: string, toIndex: number) => void;
  activate: (id: string) => void;
  setColor: (id: string, color: string) => void;
};

export type PropActions = {
  recolor: (color: string, onlyFrom?: string) => void;
  setRotation: (deg: number) => void;
  setScale: (s: number) => void;
  setGather: (patch: Partial<Pick<GatherItem, "kind" | "count" | "spread">>) => void;
  setText: (patch: Partial<Pick<TextItem, "text" | "size">>) => void;
  setStroke: (patch: Partial<Pick<StrokeItem, "width" | "dash">>) => void;
  flip: (axis: "h" | "v") => void;
  remove: () => void;
  group: () => void;
  ungroup: () => void;
};

type Sel = { item: CrochetItem; fallback: string };

type Props = {
  layers: CrochetLayer[];
  activeLayerId: string;
  activeOnly: boolean;
  onActiveOnly: (v: boolean) => void;
  layer: LayerActions;
  selected: Sel[];
  props: PropActions;
  savedAt: number;
  zoom: number;
  zoomItems: MenuItem[];
  onSoon: (what: string) => void;
};

const savedFmt = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });

/** Right panel: save time + zoom, selection properties, layers (단) and the layer bar. */
export const RightPanel = memo(function RightPanel(p: Props) {
  const active = p.layers.find((l) => l.id === p.activeLayerId);
  return (
    <aside data-tour="layer-panel" aria-label="레이어와 속성" className="relative flex h-full w-60 shrink-0 flex-col overflow-hidden border-l border-stroke-neutral-muted bg-bg-layer-default">
      <div className="flex max-h-[60%] min-h-0 shrink-0 flex-col">
        <div className="flex h-10 shrink-0 items-center justify-between gap-x2 border-b border-stroke-neutral-muted px-x3">
          <button
            type="button"
            title="버전 기록"
            aria-label="버전 기록"
            onClick={() => p.onSoon("버전 기록")}
            className="flex max-w-[10rem] min-w-0 items-center gap-1 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-bg-layer-default-pressed/70"
          >
            <RotateCcwClock className="size-3.5 shrink-0 text-fg-neutral-muted" />
            {/* layout-audit-ignore: tiny-text — reference save-time label is 11px */}
            <span className="min-w-0 truncate text-[11px] leading-tight text-fg-neutral-muted" data-testid="saved-at">{savedFmt.format(p.savedAt)}</span>
          </button>
          <Menu
            align="end"
            items={p.zoomItems}
            trigger={({ open, toggle }) => (
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label="배율"
                title="배율"
                onClick={toggle}
                data-testid="zoom-level"
                className="t2-medium flex h-7 shrink-0 items-center gap-x0_5 rounded-r1 px-x1_5 text-fg-neutral-muted tabular-nums hover:bg-bg-layer-default-pressed hover:text-fg-neutral focus-visible:outline-2 focus-visible:outline-stroke-focus-ring"
              >
                {Math.round(p.zoom * 100)}%
                <ChevronDown className="size-3" />
              </button>
            )}
          />
        </div>
        {p.selected.length > 0 && (
          <div className="min-h-0 overflow-y-auto overscroll-contain border-b border-stroke-neutral-muted [scrollbar-width:thin]">
            <Properties {...p} />
          </div>
        )}
      </div>
      <div className="flex h-10 shrink-0 items-center gap-x2 border-b border-stroke-neutral-muted px-x3">
        <span className="t2-bold text-fg-neutral">레이어</span>
        <div className="ml-auto" title="활성 폴더·단만 편집">
          <label className="seed-switch__root seed-switch__root--size_16 peer shrink-0" data-slot="switch" data-size="sm" data-checked={p.activeOnly ? "" : undefined}>
            <div
              aria-hidden="true"
              className="seed-switchmark__root seed-switchmark__root--tone_brand seed-switchmark__root--size_16 seed-scale-feedback"
              data-checked={p.activeOnly ? "" : undefined}
              style={el(26, 16)}
            >
              <div aria-hidden="true" className="seed-switchmark__thumb seed-switchmark__thumb--tone_brand seed-switchmark__thumb--size_16" data-checked={p.activeOnly ? "" : undefined} />
            </div>
            <input role="switch" type="checkbox" aria-label="활성 폴더·단만 편집" checked={p.activeOnly} onChange={(e) => p.onActiveOnly(e.target.checked)} className="sr-only" />
          </label>
        </div>
      </div>
      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <LayerList {...p} />
        <div className="h-10" aria-hidden="true" />
      </div>
      <div className="flex h-10 items-center gap-1 border-t border-stroke-neutral-muted px-2">
        <div className="flex items-center gap-1.5">
          <div className="relative flex">
            <button type="button" aria-label="배경색" title="배경색" onClick={() => p.onSoon("배경색")} className="relative size-4 shrink-0 overflow-hidden rounded border border-stroke-neutral-muted/80 shadow-sm">
              <span className="absolute inset-0 bg-white" aria-hidden="true" />
            </button>
          </div>
          <div className="flex h-7 w-16 min-w-0 items-center gap-1 rounded-r2 bg-bg-layer-fill px-1.5 select-none" title="배경 투명도">
            <input readOnly inputMode="decimal" aria-label="배경 투명도" value="100" className="pointer-events-none w-full min-w-0 flex-1 bg-transparent text-right text-[12px] leading-none text-fg-neutral tabular-nums outline-none" type="text" />
            {/* layout-audit-ignore: tiny-text — unit suffix next to a 12px value, as in the reference */}
            <span className="shrink-0 text-[10px] text-fg-neutral-muted" aria-hidden="true">%</span>
          </div>
        </div>
        <button type="button" aria-label="기호 높이" title="기호 높이" onClick={() => p.onSoon("기호 높이")} className={cx(sab("ghost"), BTN, "relative size-8 px-0")} style={el(32, 32)}>
          <Ruler className="size-4" />
        </button>
        <div className="ml-auto flex items-center gap-0.5">
          <button type="button" aria-label="폴더 추가" title="폴더 추가" onClick={() => p.onSoon("폴더")} className={cx(sab("ghost"), BTN, "size-8 px-0")} style={el(32, 32)}>
            <FolderPlus className="size-4" />
          </button>
          <button type="button" aria-label="레이어 추가" title="레이어(단) 추가" onClick={p.layer.add} className={cx(sab("ghost"), BTN, "size-8 px-0")} style={el(32, 32)}>
            <Plus className="size-4" />
          </button>
          <button
            type="button"
            aria-label="레이어 삭제"
            title="선택한 레이어 삭제"
            disabled={!active || p.layers.length <= 1}
            onClick={() => active && p.layer.remove(active.id)}
            className="flex size-8 items-center justify-center rounded-md text-fg-neutral-muted transition-colors hover:bg-bg-layer-default-pressed hover:text-fg-critical disabled:opacity-40"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  );
});

// ---------- layers ----------

function LayerList({ layers, activeLayerId, layer }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [colorFor, setColorFor] = useState<string | null>(null);
  // displayed top-most first
  const rows = useMemo(() => layers.map((l, i) => ({ l, i })).reverse(), [layers]);

  const commit = () => {
    if (editing && draft.trim()) layer.rename(editing, draft.trim().slice(0, 30));
    setEditing(null);
  };

  if (!rows.length) return null;
  return (
    <ul role="listbox" aria-label="레이어 목록">
      {rows.map(({ l, i }) => {
        const active = l.id === activeLayerId;
        return (
          <li
            key={l.id}
            role="option"
            aria-selected={active}
            draggable={editing !== l.id}
            onDragStart={(e) => {
              setDragId(l.id);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", l.id);
            }}
            onDragOver={(e) => {
              if (!dragId) return;
              e.preventDefault();
              setOverIdx(i);
            }}
            onDragLeave={() => setOverIdx((v) => (v === i ? null : v))}
            onDrop={(e) => {
              e.preventDefault();
              if (dragId) layer.move(dragId, i);
              setDragId(null);
              setOverIdx(null);
            }}
            onDragEnd={() => {
              setDragId(null);
              setOverIdx(null);
            }}
            onClick={() => layer.activate(l.id)}
            data-layer-row={l.name}
            className={cx(
              "group/layer relative flex h-10 cursor-pointer items-center gap-x1 border-b border-stroke-neutral-muted pr-x2 pl-x1",
              active ? "bg-bg-brand-weak" : "hover:bg-bg-layer-default-pressed/50",
              dragId === l.id && "opacity-40",
              overIdx === i && dragId !== l.id && "ring-2 ring-stroke-brand-solid ring-inset",
            )}
          >
            <IconButton
              label={l.visible ? "레이어 숨기기" : "레이어 표시"}
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                layer.toggle(l.id);
              }}
              className={cx("[&_svg]:size-4", l.visible ? "text-fg-neutral-muted" : "text-fg-neutral-subtle")}
            >
              {l.visible ? <Eye /> : <EyeOff />}
            </IconButton>
            <button
              type="button"
              aria-label={`${l.name} 새로 놓는 코 색`}
              title="새로 놓는 코 색"
              onClick={(e) => {
                e.stopPropagation();
                layer.activate(l.id);
                setColorFor((v) => (v === l.id ? null : l.id));
              }}
              className="size-3 shrink-0 rounded-full border border-black/10"
              style={{ background: l.color ?? INK }}
            />
            {editing === l.id ? (
              <input
                autoFocus
                aria-label="레이어 이름"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit();
                  if (e.key === "Escape") setEditing(null);
                  e.stopPropagation();
                }}
                className="h-7 min-w-0 flex-1 rounded-r1_5 border border-stroke-neutral-contrast bg-bg-layer-default px-x1_5 text-[13px] outline-none"
              />
            ) : (
              <span
                className={cx("min-w-0 flex-1 truncate text-[13px]", active ? "font-bold text-fg-neutral" : "text-fg-neutral", !l.visible && "text-fg-neutral-subtle")}
                title="더블클릭으로 이름 변경"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setDraft(l.name);
                  setEditing(l.id);
                }}
              >
                {l.name}
              </span>
            )}
            <span className="text-[12px] text-fg-neutral-subtle tabular-nums group-hover/layer:hidden">{l.items.length || ""}</span>
            <span className="hidden items-center group-hover/layer:flex">
              <button
                type="button"
                aria-label="위로"
                title="위로"
                disabled={i === layers.length - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  layer.move(l.id, i + 1);
                }}
                className="inline-flex size-6 items-center justify-center rounded-r1_5 text-fg-neutral-muted hover:bg-bg-layer-default disabled:opacity-30"
              >
                <ChevronUp className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label="아래로"
                title="아래로"
                disabled={i === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  layer.move(l.id, i - 1);
                }}
                className="inline-flex size-6 items-center justify-center rounded-r1_5 text-fg-neutral-muted hover:bg-bg-layer-default disabled:opacity-30"
              >
                <ChevronDown className="size-3.5" />
              </button>
            </span>
            {colorFor === l.id && (
              <div className="absolute top-full right-x2 left-x2 z-10 rounded-r2 border border-stroke-neutral-muted bg-bg-layer-floating p-x2 shadow-s2" onClick={(e) => e.stopPropagation()}>
                <ColorSwatches colors={SWATCHES} value={l.color ?? INK} onPick={(c) => (layer.setColor(l.id, c), setColorFor(null))} onAdd={(c) => layer.setColor(l.id, c)} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ---------- properties ----------

function Properties({ selected, props }: Props) {
  const summary = useMemo(() => {
    const byName = new Map<string, number>();
    const colors = new Map<string, number>();
    for (const { item, fallback } of selected) {
      const name =
        item.type === "stitch"
          ? getSymbol(item.symbol)?.name ?? "기호"
          : item.type === "gather"
            ? `${getSymbol(item.symbol)?.name ?? "기호"} ${item.count}코 ${item.kind === "increase" ? "늘려뜨기" : "모아뜨기"}`
            : item.type === "stroke"
              ? "펜 선"
              : "글자";
      byName.set(name, (byName.get(name) ?? 0) + 1);
      const c = (item.color ?? fallback).toLowerCase();
      colors.set(c, (colors.get(c) ?? 0) + 1);
    }
    return { byName: [...byName], colors: [...colors] };
  }, [selected]);

  if (!selected.length) return null;

  const items = selected.map((s) => s.item);
  const placed = items.filter((i): i is StitchItem | GatherItem => i.type === "stitch" || i.type === "gather");
  const stretchable = items.filter((i): i is StitchItem => i.type === "stitch" && !!getSymbol(i.symbol)?.stretch);
  const gathers = items.filter((i): i is GatherItem => i.type === "gather");
  const texts = items.filter((i): i is TextItem => i.type === "text");
  const strokes = items.filter((i): i is StrokeItem => i.type === "stroke");
  const grouped = items.some((i) => i.groupId);

  return (
    <div className="flex flex-col gap-x4 p-x3">
      <div className="flex items-center justify-between">
        <h2 className="text-[0.8125rem] font-bold">속성</h2>
        <span className="rounded-full bg-bg-neutral-inverted px-x2 py-0.5 text-[0.6875rem] font-semibold text-fg-neutral-inverted" data-testid="selected-count">
          {selected.length}개 선택
        </span>
      </div>

      <ul className="flex flex-wrap gap-x1">
        {summary.byName.map(([name, n]) => (
          <li key={name} className="rounded-r1_5 bg-bg-layer-fill px-x2 py-0.5 text-[0.75rem] text-fg-neutral-muted">
            {name} <span className="font-semibold text-fg-neutral tabular-nums">{n}개</span>
          </li>
        ))}
      </ul>

      {summary.colors.length > 1 && (
        <Field label="선택 색상">
          <div className="flex flex-wrap gap-x1_5">
            {summary.colors.map(([c, n]) => (
              <span key={c} className="flex items-center gap-x1 rounded-full bg-bg-layer-fill py-0.5 pr-x2 pl-0.5 text-[0.6875rem] text-fg-neutral-muted">
                <span className="size-4 rounded-full border border-black/10" style={{ background: c }} />
                {n}개
              </span>
            ))}
          </div>
        </Field>
      )}

      <Field label="색상 변경">
        <ColorSwatches
          colors={SWATCHES}
          value={summary.colors.length === 1 ? summary.colors[0][0] : null}
          onPick={(c) => props.recolor(c)}
          onAdd={(c) => props.recolor(c)}
        />
      </Field>

      {placed.length > 0 && (
        <NumberField label="회전" suffix="°" value={Math.round(placed[0].rotation * 10) / 10} min={-180} max={180} onChange={props.setRotation} />
      )}

      {stretchable.length > 0 && stretchable.length === placed.length && (
        <Field label="늘리기 / 줄이기">
          <div className="flex items-center gap-x2">
            <input
              type="range"
              min={0.5}
              max={4}
              step={0.05}
              value={stretchable[0].scale ?? 1}
              onChange={(e) => props.setScale(Number(e.target.value))}
              aria-label="늘리기 / 줄이기"
              className="min-w-0 flex-1 accent-[var(--seed-color-fg-neutral)]"
            />
            <span className="w-10 text-right text-[0.75rem] text-fg-neutral-muted tabular-nums">×{(stretchable[0].scale ?? 1).toFixed(2)}</span>
          </div>
        </Field>
      )}

      {gathers.length > 0 && (
        <Field label="늘려뜨기 · 모아뜨기">
          <div className="flex flex-col gap-x2">
            <Segmented
              value={gathers[0].kind}
              onChange={(kind) => props.setGather({ kind })}
              options={[
                { value: "increase", label: "늘려뜨기" },
                { value: "decrease", label: "모아뜨기" },
              ]}
            />
            <div className="flex flex-wrap gap-x3">
              <NumberField label="코 수" value={gathers[0].count} min={2} max={9} onChange={(count) => props.setGather({ count })} />
              <NumberField label="벌림" suffix="°" value={gathers[0].spread} min={0} max={80} onChange={(spread) => props.setGather({ spread })} />
            </div>
            <input
              type="range"
              min={0}
              max={80}
              step={1}
              value={gathers[0].spread}
              onChange={(e) => props.setGather({ spread: Number(e.target.value) })}
              aria-label="벌림 각도"
              className="accent-[var(--seed-color-fg-neutral)]"
            />
          </div>
        </Field>
      )}

      {texts.length > 0 && (
        <Field label="글자">
          <div className="flex flex-col gap-x2">
            {texts.length === 1 && (
              <input
                aria-label="글자 내용"
                value={texts[0].text}
                onChange={(e) => props.setText({ text: e.target.value })}
                className="h-8 rounded-r2 border border-stroke-neutral-weak bg-bg-layer-default px-x2 text-[0.875rem] outline-none focus:border-stroke-neutral-contrast"
              />
            )}
            <NumberField label="크기" value={texts[0].size} min={6} max={120} onChange={(size) => props.setText({ size })} />
          </div>
        </Field>
      )}

      {strokes.length > 0 && (
        <Field label="펜 선">
          <div className="flex flex-col gap-x2">
            <Segmented
              value={strokes[0].dash ?? "solid"}
              onChange={(dash) => props.setStroke({ dash })}
              options={[
                { value: "solid", label: "실선" },
                { value: "dashed", label: "파선" },
                { value: "dotted", label: "점선" },
              ]}
            />
            <NumberField label="굵기" value={strokes[0].width ?? 1.6} min={0.5} max={12} step={0.1} onChange={(width) => props.setStroke({ width })} />
          </div>
        </Field>
      )}

      <div className="flex flex-wrap items-center gap-x1 border-t border-stroke-neutral-muted pt-x3">
        <IconButton label="좌우 반전" shortcut="⇧H" size="sm" onClick={() => props.flip("h")}>
          <FlipHorizontal />
        </IconButton>
        <IconButton label="상하 반전" shortcut="⇧V" size="sm" onClick={() => props.flip("v")}>
          <FlipVertical />
        </IconButton>
        {grouped ? (
          <IconButton label="그룹 해제" shortcut="⇧⌘G" size="sm" onClick={props.ungroup}>
            <Ungroup />
          </IconButton>
        ) : (
          <IconButton label="그룹 만들기" shortcut="⌘G" size="sm" disabled={items.length < 2} onClick={props.group}>
            <GroupIcon />
          </IconButton>
        )}
        <IconButton label="삭제하기" shortcut="Del" size="sm" className="ml-auto hover:text-fg-critical" onClick={props.remove}>
          <Trash2 />
        </IconButton>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-x2">
      <span className="text-[0.75rem] font-semibold text-fg-neutral-muted">{label}</span>
      {children}
    </div>
  );
}
