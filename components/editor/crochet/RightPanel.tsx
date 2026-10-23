"use client";

import { memo, useMemo, useState } from "react";
import { ChevronDown, Eye, EyeOff, FlipH, FlipV, Group as GroupIcon, Plus, Trash } from "@/components/app/icons";
import { ColorSwatches, IconButton, NumberField, Segmented, cx } from "@/components/app/ui";
import type { CrochetItem, CrochetLayer, GatherItem, StitchItem, StrokeItem, TextItem } from "@/lib/types";
import { INK, getSymbol } from "@/lib/symbols/crochet";
import { ChevronUp, Ungroup } from "./icons";

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
};

export const RightPanel = memo(function RightPanel(p: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <Layers {...p} />
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-stroke-neutral-muted">
        <Properties {...p} />
      </div>
    </div>
  );
});

// ---------- layers ----------

function Layers({ layers, activeLayerId, activeOnly, onActiveOnly, layer }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  // displayed top-most first
  const rows = useMemo(() => layers.map((l, i) => ({ l, i })).reverse(), [layers]);

  const commit = () => {
    if (editing && draft.trim()) layer.rename(editing, draft.trim().slice(0, 30));
    setEditing(null);
  };

  return (
    <section className="flex max-h-[46%] min-h-[150px] flex-col" aria-label="레이어">
      <div className="flex items-center justify-between px-x3 pt-x3 pb-x1_5">
        <h2 className="text-[0.8125rem] font-bold text-fg-neutral">레이어</h2>
        <IconButton label="레이어 추가" size="sm" onClick={layer.add}>
          <Plus />
        </IconButton>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto px-x2" role="listbox" aria-label="레이어 목록">
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
                "group/layer relative flex h-10 cursor-pointer items-center gap-x1 rounded-r2 pr-x1 pl-x0_5",
                active ? "bg-bg-layer-fill" : "hover:bg-bg-layer-fill/60",
                dragId === l.id && "opacity-40",
                overIdx === i && dragId !== l.id && "ring-2 ring-stroke-neutral-contrast",
              )}
            >
              {active && <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-full bg-[var(--seed-color-palette-lime-500,#7cc522)]" />}
              <IconButton
                label={l.visible ? "레이어 숨기기" : "레이어 표시"}
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  layer.toggle(l.id);
                }}
                className={cx("ml-x1", !l.visible && "text-fg-neutral-subtle")}
              >
                {l.visible ? <Eye /> : <EyeOff />}
              </IconButton>
              {l.color && <span className="size-2.5 shrink-0 rounded-full border border-black/10" style={{ background: l.color }} />}
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
                  className="h-7 min-w-0 flex-1 rounded-r1_5 border border-stroke-neutral-contrast bg-bg-layer-default px-x1_5 text-[0.8125rem] outline-none"
                />
              ) : (
                <span
                  className={cx("min-w-0 flex-1 truncate text-[0.8125rem]", active ? "font-semibold text-fg-neutral" : "text-fg-neutral", !l.visible && "text-fg-neutral-subtle")}
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
              <span className="text-[0.6875rem] text-fg-neutral-subtle tabular-nums group-hover/layer:hidden">{l.items.length || ""}</span>
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
                <button
                  type="button"
                  aria-label="레이어 삭제"
                  title="레이어 삭제"
                  disabled={layers.length <= 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    layer.remove(l.id);
                  }}
                  className="inline-flex size-6 items-center justify-center rounded-r1_5 text-fg-neutral-muted hover:bg-bg-layer-default hover:text-fg-critical disabled:opacity-30"
                >
                  <Trash className="size-3.5" />
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      <label className="flex cursor-pointer items-center gap-x2 px-x3 py-x2 text-[0.75rem] text-fg-neutral-muted">
        <input type="checkbox" checked={activeOnly} onChange={(e) => onActiveOnly(e.target.checked)} className="size-3.5 accent-[var(--seed-color-fg-neutral)]" />
        활성 단만 편집
      </label>
    </section>
  );
}

// ---------- properties ----------

function Properties({ selected, props, layers, activeLayerId, layer }: Props) {
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

  const active = layers.find((l) => l.id === activeLayerId);

  if (!selected.length) {
    return (
      <div className="flex flex-col gap-x4 p-x3">
        <h2 className="text-[0.8125rem] font-bold">속성</h2>
        <div className="rounded-r3 bg-bg-layer-fill px-x3 py-x3">
          <p className="text-[0.8125rem] font-semibold text-fg-neutral">선택된 요소가 없어요.</p>
          <p className="mt-x1 text-[0.75rem] leading-relaxed text-fg-neutral-muted">기호를 클릭하거나 드래그로 여러 개를 선택하면 색·회전·늘리기를 바꿀 수 있어요.</p>
        </div>
        {active && (
          <Field label={`새로 놓는 코 색 · ${active.name}`}>
            <ColorSwatches colors={SWATCHES} value={active.color ?? INK} onPick={(c) => layer.setColor(active.id, c)} onAdd={(c) => layer.setColor(active.id, c)} />
          </Field>
        )}
      </div>
    );
  }

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
          <FlipH />
        </IconButton>
        <IconButton label="상하 반전" shortcut="⇧V" size="sm" onClick={() => props.flip("v")}>
          <FlipV />
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
          <Trash />
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
