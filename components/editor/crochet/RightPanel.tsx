"use client";

import { memo, useMemo, useState } from "react";
import { Button, ColorSwatches, ContextMenu, Dialog, IconButton, Menu, NumberField, Segmented, cx, type MenuItem } from "@/components/app/ui";
import type { CrochetFolder, CrochetItem, CrochetLayer, GatherItem, StitchItem, StrokeItem, TextItem } from "@/lib/types";
import { INK, getSymbol } from "@/lib/symbols/crochet";
import { BackgroundPopover } from "./PanelDialogs";
import { BTN, el, sab } from "./seed";
import { ChevronDown, ChevronRight, ChevronUp, Ellipsis, Eye, EyeOff, FlipHorizontal, FlipVertical, Folder, FolderPlus, Group as GroupIcon, Plus, RotateCcwClock, Ruler, Trash2, Ungroup } from "./uiIcons";

export const SWATCHES = ["#1f1f1f", "#d64545", "#e8833a", "#d9a400", "#4f9d2d", "#2e86c1", "#6c4bc4", "#c2408f", "#8a6a4f", "#9aa0a6"];

export type LayerActions = {
  add: () => void;
  rename: (id: string, name: string) => void;
  toggle: (id: string) => void;
  remove: (id: string) => void;
  move: (id: string, toIndex: number) => void;
  activate: (id: string) => void;
  setColor: (id: string, color: string) => void;
  /** moves a layer to a list index and into a folder (null = no folder) in one step */
  place: (id: string, toIndex: number, folderId: string | null) => void;
  addFolder: () => void;
  renameFolder: (id: string, name: string) => void;
  toggleFolder: (id: string) => void;
  collapseFolder: (id: string) => void;
  ungroupFolder: (id: string) => void;
  deleteFolder: (id: string) => void;
  moveToFolder: (layerId: string, folderId: string | null) => void;
  newFolderWith: (layerId: string) => void;
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
  folders: CrochetFolder[];
  activeLayerId: string;
  activeOnly: boolean;
  onActiveOnly: (v: boolean) => void;
  layer: LayerActions;
  selected: Sel[];
  props: PropActions;
  savedAt: number;
  zoom: number;
  zoomItems: MenuItem[];
  background: string;
  backgroundOpacity: number;
  onBackground: (color: string) => void;
  onBackgroundOpacity: (pct: number) => void;
  onVersions: () => void;
  onHeights: () => void;
  heightsOn: boolean;
};

const savedFmt = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });

/** Right panel: save time + zoom, selection properties, layers (단) and the layer bar. */
export const RightPanel = memo(function RightPanel(p: Props) {
  const active = p.layers.find((l) => l.id === p.activeLayerId);
  const [bgOpen, setBgOpen] = useState(false);
  const [opacityDraft, setOpacityDraft] = useState<string | null>(null);
  const commitOpacity = () => {
    if (opacityDraft === null) return;
    const v = Number(opacityDraft.replace(/[^\d.]/g, ""));
    if (Number.isFinite(v) && opacityDraft.trim() !== "") p.onBackgroundOpacity(Math.max(0, Math.min(100, Math.round(v))));
    setOpacityDraft(null);
  };
  return (
    <aside data-tour="layer-panel" aria-label="레이어와 속성" className="relative flex h-full w-60 shrink-0 flex-col overflow-hidden border-l border-stroke-neutral-muted bg-bg-layer-default">
      <div className="flex max-h-[60%] min-h-0 shrink-0 flex-col">
        <div className="flex h-10 shrink-0 items-center justify-between gap-x2 border-b border-stroke-neutral-muted px-x3">
          <button
            type="button"
            title="버전 기록"
            aria-label="버전 기록"
            onClick={p.onVersions}
            aria-haspopup="dialog"
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
            <button type="button" aria-label="배경색" title="배경색" aria-expanded={bgOpen} onClick={() => setBgOpen((v) => !v)} className="relative size-4 shrink-0 overflow-hidden rounded border border-stroke-neutral-muted/80 shadow-sm">
              <span className="absolute inset-0 bg-white" style={p.background !== "#ffffff" ? { background: p.background } : undefined} aria-hidden="true" />
            </button>
            {bgOpen && (
              <BackgroundPopover
                value={p.background}
                onPick={(c) => p.onBackground(c)}
                onClose={() => setBgOpen(false)}
              />
            )}
          </div>
          <div className="flex h-7 w-16 min-w-0 items-center gap-1 rounded-r2 bg-bg-layer-fill px-1.5 select-none" title="배경 투명도">
            <input
              inputMode="decimal"
              aria-label="배경 투명도"
              value={opacityDraft ?? String(p.backgroundOpacity)}
              onChange={(e) => setOpacityDraft(e.target.value)}
              onBlur={commitOpacity}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitOpacity();
                if (e.key === "Escape") setOpacityDraft(null);
                if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                  e.preventDefault();
                  p.onBackgroundOpacity(Math.max(0, Math.min(100, p.backgroundOpacity + (e.key === "ArrowUp" ? 5 : -5))));
                }
              }}
              className="w-full min-w-0 flex-1 bg-transparent text-right text-[12px] leading-none text-fg-neutral tabular-nums outline-none"
              type="text"
            />
            {/* layout-audit-ignore: tiny-text — unit suffix next to a 12px value, as in the reference */}
            <span className="shrink-0 text-[10px] text-fg-neutral-muted" aria-hidden="true">%</span>
          </div>
        </div>
        <button type="button" aria-label="기호 높이" title="기호 높이" aria-haspopup="dialog" onClick={p.onHeights} className={cx(sab("ghost"), BTN, "relative size-8 px-0")} style={el(32, 32)}>
          <Ruler className="size-4" />
          {p.heightsOn && <span aria-hidden="true" className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-bg-brand-solid" />}
        </button>
        <div className="ml-auto flex items-center gap-0.5">
          <button type="button" aria-label="폴더 추가" title="폴더 추가" onClick={p.layer.addFolder} className={cx(sab("ghost"), BTN, "size-8 px-0")} style={el(32, 32)}>
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

/** Keeps a 200px-wide menu inside the window. */
const menuAt = (x: number, y: number) => ({ x: Math.max(8, Math.min(x, window.innerWidth - 228)), y: Math.max(8, Math.min(y, window.innerHeight - 220)) });

type Row = { kind: "folder"; f: CrochetFolder; members: { l: CrochetLayer; i: number }[] } | { kind: "layer"; l: CrochetLayer; i: number; inFolder: boolean };

function LayerList({ layers, folders, activeLayerId, layer }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [overFolder, setOverFolder] = useState<string | null>(null);
  const [overLoose, setOverLoose] = useState(false);
  const [colorFor, setColorFor] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; layerId?: string; folderId?: string } | null>(null);
  const [deleting, setDeleting] = useState<CrochetFolder | null>(null);

  // displayed top-most first; a folder appears where its top-most layer is, empty folders first
  const rows = useMemo(() => {
    const known = new Map(folders.map((f) => [f.id, f]));
    const byFolder = new Map<string, { l: CrochetLayer; i: number }[]>();
    layers.forEach((l, i) => {
      if (l.folderId && known.has(l.folderId)) {
        const list = byFolder.get(l.folderId) ?? [];
        list.push({ l, i });
        byFolder.set(l.folderId, list);
      }
    });
    const out: Row[] = folders.filter((f) => !byFolder.has(f.id)).map((f) => ({ kind: "folder" as const, f, members: [] }));
    const done = new Set<string>();
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i];
      const f = l.folderId ? known.get(l.folderId) : undefined;
      if (!f) {
        out.push({ kind: "layer", l, i, inFolder: false });
        continue;
      }
      if (done.has(f.id)) continue;
      done.add(f.id);
      const members = [...byFolder.get(f.id)!].reverse();
      out.push({ kind: "folder", f, members });
      if (!f.collapsed) members.forEach((m) => out.push({ kind: "layer", l: m.l, i: m.i, inFolder: true }));
    }
    return out;
  }, [layers, folders]);

  const commit = () => {
    if (editing && draft.trim()) {
      if (folders.some((f) => f.id === editing)) layer.renameFolder(editing, draft.trim().slice(0, 30));
      else layer.rename(editing, draft.trim().slice(0, 30));
    }
    setEditing(null);
  };
  const endDrag = () => {
    setDragId(null);
    setOverIdx(null);
    setOverFolder(null);
    setOverLoose(false);
  };

  const menuItems: MenuItem[] = (() => {
    if (!menu) return [];
    if (menu.folderId) {
      const f = folders.find((x) => x.id === menu.folderId);
      if (!f) return [];
      return [
        { label: "이름 바꾸기", onSelect: () => (setDraft(f.name), setEditing(f.id)) },
        { label: f.collapsed ? "펼치기" : "접기", onSelect: () => layer.collapseFolder(f.id) },
        "separator",
        { label: "폴더 해제", onSelect: () => layer.ungroupFolder(f.id) },
        { label: "폴더 삭제", danger: true, onSelect: () => setDeleting(f) },
      ];
    }
    const l = layers.find((x) => x.id === menu.layerId);
    if (!l) return [];
    const items: MenuItem[] = folders.filter((f) => f.id !== l.folderId).map((f) => ({ label: `‘${f.name}’ 폴더로 옮기기`, onSelect: () => layer.moveToFolder(l.id, f.id) }));
    if (l.folderId) items.push({ label: "폴더에서 빼기", onSelect: () => layer.moveToFolder(l.id, null) });
    items.push({ label: "새 폴더로 묶기", onSelect: () => layer.newFolderWith(l.id) });
    return items;
  })();

  if (!rows.length) return null;
  const deletingCount = deleting ? layers.filter((l) => l.folderId === deleting.id).length : 0;
  return (
    <>
      <ul role="listbox" aria-label="레이어 목록">
        {rows.map((row) => {
          if (row.kind === "folder") {
            const f = row.f;
            const anyVisible = row.members.some((m) => m.l.visible);
            const hasActive = row.members.some((m) => m.l.id === activeLayerId);
            return (
              <li
                key={`f:${f.id}`}
                role="option"
                aria-selected={false}
                aria-expanded={!f.collapsed}
                data-folder-row={f.name}
                onDragOver={(e) => {
                  if (!dragId) return;
                  e.preventDefault();
                  setOverFolder(f.id);
                  setOverIdx(null);
                }}
                onDragLeave={() => setOverFolder((v) => (v === f.id ? null : v))}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragId) layer.moveToFolder(dragId, f.id);
                  endDrag();
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenu({ ...menuAt(e.clientX, e.clientY), folderId: f.id });
                }}
                onClick={() => layer.collapseFolder(f.id)}
                className={cx(
                  "group/folder relative flex h-10 cursor-pointer items-center gap-x1 border-b border-stroke-neutral-muted bg-bg-layer-fill/60 pr-x2 pl-x1 hover:bg-bg-layer-default-pressed/50",
                  overFolder === f.id && "ring-2 ring-stroke-brand-solid ring-inset",
                )}
              >
                <IconButton
                  label={anyVisible ? "폴더 숨기기" : "폴더 표시"}
                  size="sm"
                  disabled={!row.members.length}
                  onClick={(e) => {
                    e.stopPropagation();
                    layer.toggleFolder(f.id);
                  }}
                  className={cx("[&_svg]:size-4", anyVisible ? "text-fg-neutral-muted" : "text-fg-neutral-subtle")}
                >
                  {anyVisible || !row.members.length ? <Eye /> : <EyeOff />}
                </IconButton>
                <ChevronRight className={cx("size-3.5 shrink-0 text-fg-neutral-muted transition-transform", !f.collapsed && "rotate-90")} />
                <Folder className="size-3.5 shrink-0 text-fg-neutral-muted" />
                {editing === f.id ? (
                  <input
                    autoFocus
                    aria-label="폴더 이름"
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
                    className={cx("min-w-0 flex-1 truncate text-[13px] font-semibold", hasActive ? "text-fg-neutral" : "text-fg-neutral-muted", !anyVisible && row.members.length > 0 && "text-fg-neutral-subtle")}
                    title="더블클릭으로 이름 변경"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setDraft(f.name);
                      setEditing(f.id);
                    }}
                  >
                    {f.name}
                  </span>
                )}
                <span className="text-[12px] text-fg-neutral-subtle tabular-nums group-hover/folder:hidden">{row.members.length || ""}</span>
                <button
                  type="button"
                  aria-label={`${f.name} 폴더 메뉴`}
                  title="폴더 메뉴"
                  onClick={(e) => {
                    e.stopPropagation();
                    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setMenu({ ...menuAt(r.right - 200, r.bottom + 2), folderId: f.id });
                  }}
                  className="hidden size-6 items-center justify-center rounded-r1_5 text-fg-neutral-muted group-hover/folder:inline-flex hover:bg-bg-layer-default"
                >
                  <Ellipsis className="size-3.5" />
                </button>
              </li>
            );
          }
          const { l, i } = row;
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
                setOverFolder(null);
              }}
              onDragLeave={() => setOverIdx((v) => (v === i ? null : v))}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) {
                  const from = layers.find((x) => x.id === dragId);
                  // dropping on a row joins that row's folder (or leaves folders for a loose row)
                  if (from && (from.folderId ?? null) !== (l.folderId ?? null)) layer.place(dragId, i, l.folderId ?? null);
                  else layer.move(dragId, i);
                }
                endDrag();
              }}
              onDragEnd={endDrag}
              onContextMenu={(e) => {
                e.preventDefault();
                layer.activate(l.id);
                setMenu({ ...menuAt(e.clientX, e.clientY), layerId: l.id });
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
              {row.inFolder && <span aria-hidden="true" className="w-x4 shrink-0" />}
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
      {dragId && folders.length > 0 && layers.find((x) => x.id === dragId)?.folderId && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setOverLoose(true);
          }}
          onDragLeave={() => setOverLoose(false)}
          onDrop={(e) => {
            e.preventDefault();
            if (dragId) layer.moveToFolder(dragId, null);
            endDrag();
          }}
          className={cx("m-x2 rounded-r2 border border-dashed border-stroke-neutral-weak px-x2 py-x3 text-center text-[12px] text-fg-neutral-muted", overLoose && "border-stroke-brand-solid bg-bg-brand-weak")}
        >
          여기에 놓으면 폴더 밖으로 빠져요
        </div>
      )}
      <ContextMenu at={menu} items={menuItems} onClose={() => setMenu(null)} />
      <Dialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="폴더 삭제"
        width={380}
        footer={
          <>
            <Button onClick={() => setDeleting(null)}>취소</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (deleting) layer.deleteFolder(deleting.id);
                setDeleting(null);
              }}
            >
              삭제
            </Button>
          </>
        }
      >
        <p className="text-[14px] text-fg-neutral-muted">폴더와 내부 레이어 {deletingCount}개가 함께 삭제돼요. 계속할까요?</p>
      </Dialog>
    </>
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
