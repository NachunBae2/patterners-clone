"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button, Dialog, cx, isMod, useToast } from "@/components/app/ui";
import { PanelSection, Row, headBtn } from "@/components/editor/apparel/Panels";
import { PrintPortal } from "@/components/editor/apparel/PrintPortal";
import {
  LAlignCenter,
  LAlignLeft,
  LAlignRight,
  LChevronDown,
  LChevronUp,
  LCopyPlus,
  LFileCode,
  LHeading,
  LImage,
  LList,
  LListOrdered,
  LMinus,
  LPilcrow,
  LPlus,
  LPrinter,
  LShapes,
  LTable,
  LTrash,
  LZoomIn,
  LZoomOut,
} from "@/components/editor/apparel/icons";
import { ScrubField, Seg, Switch, ab, abBase, el } from "@/components/editor/grid/fields";
import { BrandMark, LCloud, LCloudAlert, LCloudCheck, LDownload, LPanelLeft, LRedo2, LUndo2, PanelRight } from "@/components/editor/grid/icons";
import { download, safeName, svgThumbnail } from "@/lib/export";
import { useWorkList, works } from "@/lib/store";
import { useAutosave } from "@/lib/useAutosave";
import { useHistory } from "@/lib/useHistory";
import { CRAFT_LABEL, type PaperBlock, type PaperData, type Work } from "@/lib/types";
import { DEFAULT_BORDER, PAPER_CSS, cellStyle, fmtBytes, newBlock, normalizePaper, paperBodyHtml, paperHtml, readImage, type EmbedInfo, type NewKind } from "./model";
import "./paper.css";

type Tab = "add" | "patterns" | "outline";
const TAB_LABEL: Record<Tab, string> = { add: "컴포넌트", patterns: "내 도안", outline: "목차" };
const PANEL_W = 296;
const MAX_IMAGE = 5 * 1024 * 1024;
const WARN_IMAGE = 1024 * 1024;
const STORAGE_HINT = 5 * 1024 * 1024;

type TableBlock = Extract<PaperBlock, { type: "table" }>;
type Cell = { id: string; r: number; c: number };

const ADD: { kind: NewKind; label: string; Icon: (p: { className?: string }) => ReactNode }[] = [
  { kind: "h1", label: "제목 1", Icon: LHeading },
  { kind: "h2", label: "제목 2", Icon: LHeading },
  { kind: "h3", label: "제목 3", Icon: LHeading },
  { kind: "paragraph", label: "본문", Icon: LPilcrow },
  { kind: "bullet", label: "글머리 기호", Icon: LList },
  { kind: "ordered", label: "번호 목록", Icon: LListOrdered },
  { kind: "table", label: "표", Icon: LTable },
  { kind: "image", label: "이미지", Icon: LImage },
  { kind: "divider", label: "구분선", Icon: LMinus },
  { kind: "embed", label: "도안", Icon: LShapes },
];

function RailButton(p: { label: string; active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={p.label}
      title={p.label}
      aria-pressed={p.active}
      onClick={p.onClick}
      className={cx(ab(p.active ? "brandSolid" : "ghost", "small", "iconOnly"), !p.active && "text-fg-neutral-muted")}
      style={el(36, 36)}
    >
      {p.children}
    </button>
  );
}

function TB(p: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <span className="inline-flex">
      <button
        type="button"
        className={cx(ab(p.active ? "brandSolid" : "ghost", "xsmall"), abBase, "w-x8 px-0")}
        aria-label={p.label}
        title={p.label}
        aria-pressed={p.active}
        disabled={p.disabled}
        data-disabled={p.disabled ? "" : undefined}
        onClick={p.onClick}
        style={el(32, 32)}
      >
        {p.children}
      </button>
    </span>
  );
}

/** Auto-growing plain textarea that looks like the text around it. */
function AutoText({
  value,
  onChange,
  placeholder,
  onKeyDown,
  label,
  onFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  label: string;
  onFocus?: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const t = ref.current;
    if (!t) return;
    t.style.height = "0px";
    t.style.height = `${t.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      aria-label={label}
      className="pp-input"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      spellCheck={false}
    />
  );
}

/** Small home-list thumbnail: a page with the document's shape (no embedded images, keeps the index small). */
function thumbSvg(d: PaperData, title: string) {
  const out: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><rect width="300" height="400" fill="#fff"/>`];
  let y = 36;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  if (d.showTitle) {
    out.push(`<text x="28" y="${y + 14}" font-family="sans-serif" font-size="20" font-weight="700" fill="#1a1c20">${esc(title.slice(0, 16))}</text>`);
    y += 36;
  }
  for (const b of d.blocks) {
    if (y > 370) break;
    if (b.type === "heading") {
      out.push(`<rect x="28" y="${y}" width="${Math.min(200, 60 + b.text.length * 8)}" height="${12 - b.level * 2 + 6}" rx="3" fill="#3a3d42"/>`);
      y += 26;
    } else if (b.type === "paragraph") {
      const lines = Math.min(4, Math.max(1, Math.ceil(b.text.length / 40)));
      for (let i = 0; i < lines; i++) out.push(`<rect x="28" y="${y + i * 12}" width="${i === lines - 1 ? 150 : 244}" height="6" rx="3" fill="#cfd2d6"/>`);
      y += lines * 12 + 10;
    } else if (b.type === "list") {
      b.items.slice(0, 4).forEach((_, i) => out.push(`<circle cx="32" cy="${y + i * 12 + 3}" r="2.5" fill="#9a9ea5"/><rect x="40" y="${y + i * 12}" width="170" height="6" rx="3" fill="#cfd2d6"/>`));
      y += Math.min(4, b.items.length) * 12 + 10;
    } else if (b.type === "table") {
      const rows = Math.min(5, b.rows.length);
      const cols = b.rows[0]?.length ?? 1;
      for (let r = 0; r <= rows; r++) out.push(`<line x1="28" x2="272" y1="${y + r * 14}" y2="${y + r * 14}" stroke="#b9bcc1"/>`);
      for (let c = 0; c <= cols; c++) out.push(`<line x1="${28 + (244 * c) / cols}" x2="${28 + (244 * c) / cols}" y1="${y}" y2="${y + rows * 14}" stroke="#b9bcc1"/>`);
      y += rows * 14 + 14;
    } else if (b.type === "image" || b.type === "embed") {
      const w = (244 * b.width) / 100;
      out.push(`<rect x="${150 - w / 2}" y="${y}" width="${w}" height="${Math.min(110, w * 0.66)}" rx="6" fill="${b.type === "embed" ? "#eef3e4" : "#e7eef8"}"/>`);
      y += Math.min(110, w * 0.66) + 14;
    } else if (b.type === "divider") {
      out.push(`<line x1="28" x2="272" y1="${y + 4}" y2="${y + 4}" stroke="#d5d8dc"/>`);
      y += 16;
    }
  }
  out.push(`</svg>`);
  return out.join("");
}

export default function PaperEditor({ work, data }: { work: Work; data: PaperData }) {
  const toast = useToast();
  const h = useHistory<PaperData>(useMemo(() => normalizePaper(data), [data]));
  const d = h.state;
  const list = useWorkList();

  const [tab, setTab] = useState<Tab | null>("add");
  const [rightOpen, setRightOpen] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [cell, setCell] = useState<Cell | null>(null);
  const [title, setTitle] = useState(work.title);
  const [renaming, setRenaming] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [exportOpen, setExportOpen] = useState(false);
  const [q, setQ] = useState("");
  const focusNext = useRef<{ id: string; item?: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<string | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  // ---- doc edits ----
  const lastKey = useRef<{ key: string; t: number } | null>(null);
  const set = useCallback(
    (fn: (x: PaperData) => PaperData, key?: string) => {
      const now = Date.now();
      const merge = !!key && lastKey.current?.key === key && now - lastKey.current.t < 1200;
      lastKey.current = key ? { key, t: now } : null;
      h.set(fn, { merge });
    },
    [h],
  );
  const update = useCallback(
    (id: string, fn: (b: PaperBlock) => PaperBlock, key?: string) => set((x) => ({ ...x, blocks: x.blocks.map((b) => (b.id === id ? fn(b) : b)) }), key),
    [set],
  );

  // ---- works that can be embedded ----
  const embeddable = useMemo(() => list.filter((w) => !w.deletedAt && w.id !== work.id && w.craft !== "paper"), [list, work.id]);
  const embedInfo = useCallback(
    (id: string): EmbedInfo | null => {
      const w = list.find((x) => x.id === id && !x.deletedAt);
      return w ? { title: w.title, craft: CRAFT_LABEL[w.craft], thumbnail: w.thumbnail } : null;
    },
    [list],
  );

  // ---- autosave ----
  const status = useAutosave(work.id, d, () => svgThumbnail(thumbSvg(d, title)));
  const bytes = useMemo(() => JSON.stringify(d).length, [d]);

  // ---- focus after structural edits ----
  useEffect(() => {
    const f = focusNext.current;
    if (!f) return;
    focusNext.current = null;
    const root = pageRef.current?.querySelector(`[data-block-id="${f.id}"]`);
    const inputs = root?.querySelectorAll<HTMLTextAreaElement>("textarea.pp-input");
    const t = inputs?.[f.item ?? 0] ?? inputs?.[0];
    if (t) {
      t.focus();
      t.setSelectionRange(t.value.length, t.value.length);
    }
  });

  // ---- block operations ----
  const insert = (b: PaperBlock, after: string | null = sel) => {
    set((x) => {
      const i = after ? x.blocks.findIndex((y) => y.id === after) : -1;
      const at = i >= 0 ? i + 1 : x.blocks.length;
      return { ...x, blocks: [...x.blocks.slice(0, at), b, ...x.blocks.slice(at)] };
    });
    setSel(b.id);
    focusNext.current = { id: b.id };
  };
  const remove = (id: string) => {
    const i = d.blocks.findIndex((b) => b.id === id);
    set((x) => ({ ...x, blocks: x.blocks.filter((b) => b.id !== id) }));
    const prev = d.blocks[i - 1] ?? d.blocks[i + 1];
    setSel(prev?.id ?? null);
    if (prev) focusNext.current = { id: prev.id, item: prev.type === "list" ? prev.items.length - 1 : undefined };
  };
  const move = (id: string, dir: -1 | 1) =>
    set((x) => {
      const i = x.blocks.findIndex((b) => b.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= x.blocks.length) return x;
      const blocks = x.blocks.slice();
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
      return { ...x, blocks };
    });
  const duplicate = (id: string) => {
    const b = d.blocks.find((x) => x.id === id);
    if (!b) return;
    insert({ ...structuredClone(b), id: newBlock("paragraph").id }, id);
  };

  const pickImage = (replaceId: string | null = null) => {
    replaceRef.current = replaceId;
    fileRef.current?.click();
  };
  const addImageFile = async (file: File, replaceId: string | null = null) => {
    if (!file.type.startsWith("image/")) return toast("이미지 파일을 읽을 수 없어요. JPG, PNG, WEBP 파일을 올려 주세요.");
    if (file.size > MAX_IMAGE) return toast("5MB 이하 이미지만 올릴 수 있어요.");
    try {
      const img = await readImage(file);
      if (replaceId) update(replaceId, (b) => (b.type === "image" ? { ...b, src: img.src, name: file.name } : b));
      else insert(newBlock("image", { src: img.src, name: file.name }));
      if (img.bytes > WARN_IMAGE) toast(`이미지가 커서(${fmtBytes(img.bytes)}) 저장 공간을 많이 차지해요. 브라우저 저장 공간은 약 5MB예요.`);
      else if (img.resized) toast(`큰 이미지는 줄여서 넣었어요 (${fmtBytes(img.bytes)})`);
    } catch {
      toast("이미지를 올리지 못했어요.");
    }
  };

  const addKind = (kind: NewKind) => {
    if (kind === "image") return pickImage();
    if (kind === "embed") {
      setTab("patterns");
      return;
    }
    insert(newBlock(kind));
  };

  // ---- table ops ----
  const tableOp = (op: "rowBefore" | "rowAfter" | "colBefore" | "colAfter" | "delRow" | "delCol") => {
    const t = d.blocks.find((b) => b.id === sel) as TableBlock | undefined;
    if (!t || t.type !== "table") return;
    const r = cell?.id === t.id ? cell.r : t.rows.length - 1;
    const c = cell?.id === t.id ? cell.c : (t.rows[0]?.length ?? 1) - 1;
    const cols = t.rows[0]?.length ?? 1;
    update(t.id, (b) => {
      if (b.type !== "table") return b;
      let rows = b.rows.map((x) => x.slice());
      if (op === "rowBefore") rows.splice(r, 0, Array(cols).fill(""));
      if (op === "rowAfter") rows.splice(r + 1, 0, Array(cols).fill(""));
      if (op === "colBefore") rows = rows.map((x) => [...x.slice(0, c), "", ...x.slice(c)]);
      if (op === "colAfter") rows = rows.map((x) => [...x.slice(0, c + 1), "", ...x.slice(c + 1)]);
      if (op === "delRow" && rows.length > 1) rows.splice(r, 1);
      if (op === "delCol" && cols > 1) rows = rows.map((x) => x.filter((_, j) => j !== c));
      return { ...b, rows };
    });
  };

  // ---- export / print ----
  const exportHtml = () => {
    download(new Blob([paperHtml(d, title, embedInfo)], { type: "text/html;charset=utf-8" }), `${safeName(title)}.html`);
    setExportOpen(false);
  };
  const print = () => {
    setExportOpen(false);
    requestAnimationFrame(() => window.print());
  };

  const commitTitle = (v: string) => {
    const t = v.trim().slice(0, 60) || "제목 없음";
    setTitle(t);
    works.update(work.id, { title: t, updatedAt: Date.now() });
    setRenaming(false);
  };

  // ---- keyboard: undo/redo also while typing (the document owns the text) ----
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (!isMod(e)) return;
      const k = e.key.toLowerCase();
      if (k === "z") {
        e.preventDefault();
        if (e.shiftKey) h.redo();
        else h.undo();
      } else if (k === "y") {
        e.preventDefault();
        h.redo();
      } else if (k === "p") {
        e.preventDefault();
        print();
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  });

  const selected = d.blocks.find((b) => b.id === sel) ?? null;
  const outline = d.blocks.filter((b): b is Extract<PaperBlock, { type: "heading" }> => b.type === "heading" && b.level <= 2);
  const filtered = embeddable.filter((w) => !q.trim() || w.title.toLowerCase().includes(q.trim().toLowerCase()));
  const StatusIcon = status === "error" ? LCloudAlert : status === "saving" ? LCloud : LCloudCheck;
  const statusText = status === "error" ? "저장에 실패했어요" : status === "saving" ? "저장 중…" : "저장됨";
  const onTab = (t: Tab) => setTab((v) => (v === t ? null : t));

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-bg-layer-fill text-fg-neutral" data-editor-shell data-paper-editor="">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) addImageFile(f, replaceRef.current);
        }}
      />
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <nav aria-label="페이퍼 메뉴" className="relative z-[90] flex h-full w-14 shrink-0 flex-col items-center border-r border-stroke-neutral-muted bg-bg-layer-default px-x1 py-x2">
          <Link
            href="/home"
            aria-label="PATTERNERS"
            className="mb-x3 flex size-x9 items-center justify-center rounded-r2 text-fg-neutral hover:bg-bg-layer-default-pressed focus-visible:outline-2 focus-visible:outline-stroke-focus-ring"
          >
            <BrandMark className="size-8 overflow-hidden rounded-md" />
          </Link>
          <div className="flex flex-col items-center gap-x1">
            <RailButton label="컴포넌트" active={tab === "add"} onClick={() => onTab("add")}>
              <LPlus className="seed-icon" />
            </RailButton>
            <RailButton label="내 도안" active={tab === "patterns"} onClick={() => onTab("patterns")}>
              <LShapes className="seed-icon" />
            </RailButton>
            <RailButton label="목차" active={tab === "outline"} onClick={() => onTab("outline")}>
              <LList className="seed-icon" />
            </RailButton>
          </div>
          <div className="mt-auto flex flex-col items-center gap-x1 pb-x2">
            <div className="mb-x1 h-px w-7 bg-stroke-neutral-muted" />
            <RailButton label="인쇄" onClick={print}>
              <LPrinter className="seed-icon" />
            </RailButton>
            <RailButton label="내보내기" onClick={() => setExportOpen(true)}>
              <LDownload className="seed-icon" />
            </RailButton>
          </div>
        </nav>

        {tab && (
          <div className="absolute inset-y-0 left-14 z-[60] h-full shadow-s3 lg:relative lg:left-0 lg:z-auto lg:shadow-none">
            <aside className="flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-r border-stroke-neutral-muted bg-bg-layer-default" style={{ width: PANEL_W }}>
              <div className="flex h-11 shrink-0 items-center gap-x1 border-b border-stroke-neutral-muted px-x2">
                {renaming ? (
                  <input
                    autoFocus
                    aria-label="문서 제목"
                    defaultValue={title}
                    onFocus={(e) => e.target.select()}
                    onBlur={(e) => commitTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      if (e.key === "Escape") setRenaming(false);
                    }}
                    className="t4-medium h-8 min-w-0 flex-1 rounded-r2 bg-bg-layer-fill px-x2 text-[1rem] outline-none md:text-size-t4"
                  />
                ) : (
                  <button
                    type="button"
                    title={title}
                    aria-label="문서 제목"
                    onClick={() => setRenaming(true)}
                    className="t4-medium h-8 min-w-0 flex-1 truncate rounded-r2 px-x2 text-left text-fg-neutral enabled:hover:bg-bg-layer-default-pressed"
                  >
                    {title}
                  </button>
                )}
                <span className="inline-flex" title={statusText}>
                  <span role="status" aria-label={statusText} className={cx("flex size-7 shrink-0 items-center justify-center rounded-r2", status === "error" ? "text-fg-critical" : "text-fg-neutral-subtle")}>
                    <StatusIcon className="size-3.5" />
                  </span>
                </span>
                <button type="button" className={cx(ab("ghost", "xsmall"), abBase, "w-x8 px-0")} aria-label="패널 접기" title="패널 접기" onClick={() => setTab(null)} style={el(32, 32)}>
                  <LPanelLeft className="size-4" />
                </button>
              </div>
              <div className="flex h-10 shrink-0 items-center justify-between border-b border-stroke-neutral-muted px-x3">
                <span className="t3-bold text-fg-neutral">{TAB_LABEL[tab]}</span>
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                {tab === "add" && (
                  <PanelSection title="블록">
                    <ul className="grid grid-cols-2 gap-x1_5">
                      {ADD.map(({ kind, label, Icon }) => (
                        <li key={kind}>
                          <button
                            type="button"
                            onClick={() => addKind(kind)}
                            className="t2-medium flex h-10 w-full items-center gap-x2 rounded-r2 border border-stroke-neutral-muted px-x2_5 text-left text-fg-neutral hover:bg-bg-layer-fill"
                          >
                            <Icon className="size-4 shrink-0 text-fg-neutral-muted" />
                            {label}
                          </button>
                        </li>
                      ))}
                    </ul>
                    <p className="t1-regular text-fg-neutral-muted">왼쪽에서 블록을 고르면 고른 블록 아래(없으면 맨 끝)에 들어가요. 준비물, 게이지, 단별 설명을 문서처럼 정리해요.</p>
                  </PanelSection>
                )}
                {tab === "patterns" && (
                  <PanelSection title="도안 삽입">
                    <input
                      type="search"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="도안 검색"
                      aria-label="도안 검색"
                      className="t3-regular h-8 w-full rounded-r2 bg-bg-layer-fill px-x2 text-fg-neutral outline-none placeholder:text-fg-neutral-subtle"
                    />
                    {filtered.length === 0 ? (
                      <p className="t1-regular text-fg-neutral-muted">{embeddable.length ? "검색 결과가 없어요." : "삽입할 도안이 없어요."}</p>
                    ) : (
                      <ul className="grid grid-cols-2 gap-x2">
                        {filtered.map((w) => (
                          <li key={w.id}>
                            <button
                              type="button"
                              onClick={() => insert(newBlock("embed", { workId: w.id }))}
                              className="flex w-full flex-col gap-x1 rounded-r2 border border-stroke-neutral-muted p-x1_5 text-left hover:bg-bg-layer-fill"
                            >
                              <span className="flex aspect-square items-center justify-center overflow-hidden rounded-r1 bg-bg-layer-fill">
                                {w.thumbnail ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={w.thumbnail} alt="" className="h-full w-full object-contain" />
                                ) : (
                                  <span className="t1-regular text-fg-neutral-subtle">미리보기 없음</span>
                                )}
                              </span>
                              <span className="t1-medium truncate">{w.title}</span>
                              <span className="t1-regular text-fg-neutral-muted">{CRAFT_LABEL[w.craft]}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </PanelSection>
                )}
                {tab === "outline" && (
                  <PanelSection title="목차">
                    {outline.length === 0 ? (
                      <p className="t1-regular text-fg-neutral-muted">제목 1·2를 넣으면 여기에 보여요.</p>
                    ) : (
                      <ul className="flex flex-col">
                        {outline.map((b) => (
                          <li key={b.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setSel(b.id);
                                pageRef.current?.querySelector(`[data-block-id="${b.id}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
                              }}
                              className={cx("t2-regular flex h-8 w-full items-center truncate rounded-r1 px-x2 text-left hover:bg-bg-layer-fill", b.level === 2 && "pl-x5 text-fg-neutral-muted")}
                            >
                              {b.text || "제목 없음"}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </PanelSection>
                )}
              </div>
            </aside>
          </div>
        )}

        {/* page */}
        <div className="relative min-h-0 min-w-0 flex-1">
        <div
          className="h-full w-full overflow-auto"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) setSel(null);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            const f = e.dataTransfer.files?.[0];
            if (f) {
              e.preventDefault();
              addImageFile(f);
            }
          }}
          data-paper-scroll=""
        >
          <style>{PAPER_CSS}</style>
          <div className="flex justify-center px-x6 pt-x16 pb-x24" onPointerDown={(e) => e.target === e.currentTarget && setSel(null)}>
            <div
              ref={pageRef}
              className="pp-doc relative min-h-[1123px] w-[794px] shrink-0 rounded-r1 bg-[#ffffff] px-[72px] py-[64px] shadow-s2"
              style={{ zoom }}
              data-paper-page=""
            >
              {d.showTitle && (
                <h1 className="pp-title">
                  <AutoText
                    label="문서 제목"
                    value={title}
                    placeholder="제목"
                    onChange={(v) => {
                      setTitle(v);
                      works.update(work.id, { title: v.slice(0, 60), updatedAt: Date.now() });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const first = d.blocks[0];
                        if (first) focusNext.current = { id: first.id };
                        else insert(newBlock("paragraph"), null);
                        setSel(first?.id ?? null);
                      }
                    }}
                  />
                </h1>
              )}
              {d.blocks.length === 0 && (
                <button type="button" onClick={() => insert(newBlock("paragraph"), null)} className="t3-regular w-full rounded-r2 border border-dashed border-[#d5d8dc] py-x6 text-[#9a9ea5]">
                  내용을 입력하세요…
                </button>
              )}
              {d.blocks.map((b, i) => (
                <BlockView
                  key={b.id}
                  b={b}
                  first={i === 0}
                  last={i === d.blocks.length - 1}
                  selected={sel === b.id}
                  onSelect={() => setSel(b.id)}
                  update={(fn, key) => update(b.id, fn, key)}
                  onEnter={() => insert(newBlock("paragraph"), b.id)}
                  onRemove={() => remove(b.id)}
                  onMove={(dir) => move(b.id, dir)}
                  onDuplicate={() => duplicate(b.id)}
                  onCell={(r, c) => setCell({ id: b.id, r, c })}
                  onPickImage={() => pickImage(b.id)}
                  embed={b.type === "embed" ? embedInfo(b.workId) : null}
                  focusItem={(item) => (focusNext.current = { id: b.id, item })}
                />
              ))}
            </div>
          </div>
        </div>

        {/* floating toggles */}
        <div className="pointer-events-none absolute top-3 right-3 z-50 lg:hidden">
          <button
            type="button"
            className={cx(ab("neutralOutline", "xsmall"), abBase, "pointer-events-auto h-8 gap-1.5 !rounded-r2 border-stroke-neutral-muted bg-bg-layer-default px-2.5 text-fg-neutral shadow-s2")}
            aria-pressed={rightOpen}
            onClick={() => setRightOpen((v) => !v)}
          >
            <span className="text-[11px] leading-none font-medium">블록 설정</span>
            <PanelRight className="size-3.5" />
          </button>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-50 flex px-3 pt-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div role="toolbar" aria-label="도구" className="maker-bottom-tools pointer-events-auto mx-auto flex shrink-0 items-center gap-x1 rounded-r4 border border-stroke-neutral-muted bg-bg-layer-floating/95 p-x1_5 shadow-s3 backdrop-blur-md">
            <div className="flex items-center gap-0.5">
              <TB label="실행 취소 (Ctrl(Cmd) + Z)" disabled={!h.canUndo} onClick={h.undo}>
                <LUndo2 />
              </TB>
              <TB label="다시 실행 (Ctrl(Cmd) + Shift + Z)" disabled={!h.canRedo} onClick={h.redo}>
                <LRedo2 />
              </TB>
            </div>
            <div className="mx-x0_5 h-6 w-px bg-stroke-neutral-muted" />
            <div className="flex items-center gap-0.5">
              <TB label="축소" onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))}>
                <LZoomOut />
              </TB>
              <button type="button" title="확대 초기화" onClick={() => setZoom(1)} className="t2-medium h-8 min-w-12 rounded-r2 px-x1 tabular-nums text-fg-neutral hover:bg-bg-layer-default-pressed">
                {Math.round(zoom * 100)}%
              </button>
              <TB label="확대" onClick={() => setZoom((z) => Math.min(2, Math.round((z + 0.1) * 10) / 10))}>
                <LZoomIn />
              </TB>
            </div>
          </div>
        </div>
        </div>

        <aside
          aria-label="블록 설정"
          className={cx(
            "h-full w-72 shrink-0 flex-col border-l border-stroke-neutral-muted bg-bg-layer-default",
            rightOpen ? "absolute inset-y-0 right-0 z-[60] flex shadow-s3 lg:static lg:shadow-none" : "hidden lg:flex",
          )}
        >
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-stroke-neutral-muted px-x3">
            <span className="t3-bold text-fg-neutral">{selected ? "블록 설정" : "설정"}</span>
            {selected && (
              <button type="button" className={headBtn} onClick={() => setSel(null)}>
                설정 목록
              </button>
            )}
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {selected ? (
              <BlockSettings
                b={selected}
                update={(fn, key) => update(selected.id, fn, key)}
                onRemove={() => remove(selected.id)}
                onMove={(dir) => move(selected.id, dir)}
                onDuplicate={() => duplicate(selected.id)}
                tableOp={tableOp}
                cell={cell?.id === selected.id ? cell : null}
                onPickImage={() => pickImage(selected.id)}
                embeddable={embeddable}
                embed={selected.type === "embed" ? embedInfo(selected.workId) : null}
              />
            ) : (
              <>
                <PanelSection title="페이지">
                  <Row label="문서 제목 표시">
                    <Switch checked={d.showTitle} onChange={(showTitle) => set((x) => ({ ...x, showTitle }))} label="문서 제목 표시" />
                  </Row>
                  <Row label="용지">
                    <span className="t2-medium">A4 세로</span>
                  </Row>
                  <Row label="블록">
                    <span className="t2-medium tabular-nums">{d.blocks.length}개</span>
                  </Row>
                  <Row label="저장 용량">
                    <span className={cx("t2-medium tabular-nums", bytes > STORAGE_HINT * 0.6 && "text-fg-critical")}>{fmtBytes(bytes)} / 약 5MB</span>
                  </Row>
                  <p className="t1-regular text-fg-neutral-muted">이 페이퍼는 브라우저에 저장돼요. 이미지를 많이 넣으면 저장 공간이 모자랄 수 있어요.</p>
                </PanelSection>
                <PanelSection title="내보내기">
                  <div className="flex gap-x2">
                    <Button size="sm" onClick={print}>
                      <LPrinter className="size-4" />
                      인쇄
                    </Button>
                    <Button size="sm" onClick={exportHtml}>
                      <LFileCode className="size-4" />
                      HTML
                    </Button>
                  </div>
                  <p className="t1-regular text-fg-neutral-muted">PDF가 필요하면 인쇄에서 ‘PDF로 저장’을 고르세요.</p>
                </PanelSection>
              </>
            )}
          </div>
        </aside>
      </div>

      <Dialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="내보내기"
        footer={
          <>
            <Button onClick={() => setExportOpen(false)}>취소</Button>
            <Button onClick={print}>
              <LPrinter className="size-4" />
              인쇄 · PDF
            </Button>
            <Button variant="primary" onClick={exportHtml}>
              <LFileCode className="size-4" />
              HTML로 저장
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-x2">
          <p className="t3-regular">페이퍼를 한 장짜리 HTML 파일로 저장해요. 이미지와 도안 미리보기가 파일 안에 들어가서 인터넷 없이도 열려요.</p>
          <p className="t2-regular text-fg-neutral-muted">PDF가 필요하면 ‘인쇄 · PDF’를 누르고 인쇄 창에서 ‘PDF로 저장’을 고르세요.</p>
        </div>
      </Dialog>

      <PrintPortal>
        <style>{`${PAPER_CSS}@page{size:A4;margin:16mm 18mm}`}</style>
        <div className="pp-doc" dangerouslySetInnerHTML={{ __html: paperBodyHtml(d, title, embedInfo) }} />
      </PrintPortal>
    </div>
  );
}

// ---------- one block on the page ----------

type BlockProps = {
  b: PaperBlock;
  first: boolean;
  last: boolean;
  selected: boolean;
  onSelect: () => void;
  update: (fn: (b: PaperBlock) => PaperBlock, key?: string) => void;
  onEnter: () => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onCell: (r: number, c: number) => void;
  onPickImage: () => void;
  embed: EmbedInfo | null;
  focusItem: (i: number) => void;
};

const gutterBtn = "flex size-7 items-center justify-center rounded-r1 text-[#8a8e95] hover:bg-[#f0f1f3] hover:text-[#1a1c20] disabled:opacity-30";

function BlockView(p: BlockProps) {
  const { b } = p;
  const textKeys = (e: React.KeyboardEvent<HTMLTextAreaElement>, value: string) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      p.onEnter();
    } else if (e.key === "Backspace" && value === "" && !p.first) {
      e.preventDefault();
      p.onRemove();
    }
  };
  let body: ReactNode = null;
  switch (b.type) {
    case "heading": {
      const Tag = (`h${b.level + 1}` as "h2" | "h3" | "h4");
      body = (
        <Tag className={`pp-h${b.level}`} style={{ textAlign: b.align }}>
          <AutoText label={`제목 ${b.level}`} value={b.text} placeholder={`제목 ${b.level}`} onChange={(text) => p.update((x) => ({ ...x, text }) as PaperBlock, `t-${b.id}`)} onKeyDown={(e) => textKeys(e, b.text)} />
        </Tag>
      );
      break;
    }
    case "paragraph":
      body = (
        <p style={{ textAlign: b.align }}>
          <AutoText label="본문" value={b.text} placeholder="내용을 입력하세요…" onChange={(text) => p.update((x) => ({ ...x, text }) as PaperBlock, `t-${b.id}`)} onKeyDown={(e) => textKeys(e, b.text)} />
        </p>
      );
      break;
    case "list": {
      const Tag = b.ordered ? "ol" : "ul";
      body = (
        <Tag>
          {b.items.map((it, i) => (
            <li key={i}>
              <AutoText
                label={`${b.ordered ? "번호 목록" : "글머리 기호"} ${i + 1}`}
                value={it}
                placeholder="목록"
                onChange={(v) => p.update((x) => (x.type === "list" ? { ...x, items: x.items.map((y, j) => (j === i ? v : y)) } : x), `t-${b.id}-${i}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    if (it === "" && i === b.items.length - 1 && b.items.length > 1) {
                      // empty last item: leave the list
                      p.update((x) => (x.type === "list" ? { ...x, items: x.items.slice(0, -1) } : x));
                      p.onEnter();
                      return;
                    }
                    p.update((x) => (x.type === "list" ? { ...x, items: [...x.items.slice(0, i + 1), "", ...x.items.slice(i + 1)] } : x));
                    p.focusItem(i + 1);
                  } else if (e.key === "Backspace" && it === "") {
                    e.preventDefault();
                    if (b.items.length === 1) p.onRemove();
                    else {
                      p.update((x) => (x.type === "list" ? { ...x, items: x.items.filter((_, j) => j !== i) } : x));
                      p.focusItem(Math.max(0, i - 1));
                    }
                  }
                }}
              />
            </li>
          ))}
        </Tag>
      );
      break;
    }
    case "table":
      body = (
        <table className="pp-table">
          <tbody>
            {b.rows.map((row, r) => (
              <tr key={r}>
                {row.map((v, c) => {
                  const Cell = b.header && r === 0 ? "th" : "td";
                  return (
                    <Cell key={c} style={cellStyle(b, r, c)}>
                      <AutoText
                        label={`${r + 1}행 ${c + 1}열`}
                        value={v}
                        onFocus={() => p.onCell(r, c)}
                        onChange={(nv) => p.update((x) => (x.type === "table" ? { ...x, rows: x.rows.map((rr, i) => (i === r ? rr.map((cc, j) => (j === c ? nv : cc)) : rr)) } : x), `t-${b.id}-${r}-${c}`)}
                      />
                    </Cell>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      );
      break;
    case "image":
      body = b.src ? (
        <figure style={{ width: `${b.width}%` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={b.src} alt={b.caption} />
          <figcaption>
            <AutoText label="이미지 설명" value={b.caption} placeholder="설명을 입력하세요" onChange={(caption) => p.update((x) => ({ ...x, caption }) as PaperBlock, `t-${b.id}`)} />
          </figcaption>
        </figure>
      ) : (
        <button type="button" onClick={p.onPickImage} className="w-full rounded-[6px] border border-dashed border-[#d5d8dc] py-10 text-[14px] text-[#9a9ea5]">
          사진을 끌어다 놓거나 클릭
        </button>
      );
      break;
    case "divider":
      body = <hr />;
      break;
    case "embed":
      body = (
        <figure className="pp-embed" style={{ width: `${b.width}%` }}>
          {p.embed?.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.embed.thumbnail} alt={p.embed.title} />
          ) : (
            <div className="pp-noimg">{p.embed ? "미리보기 없음" : "원본 도안을 찾을 수 없어요"}</div>
          )}
          <figcaption>
            <AutoText label="도안 설명" value={b.caption} placeholder={p.embed ? `${p.embed.title} · ${p.embed.craft}` : "설명"} onChange={(caption) => p.update((x) => ({ ...x, caption }) as PaperBlock, `t-${b.id}`)} />
          </figcaption>
        </figure>
      );
      break;
  }
  return (
    <div className="pp-block group/block" data-block-id={b.id} data-block-type={b.type} data-selected={p.selected ? "" : undefined} onPointerDownCapture={p.onSelect} onFocusCapture={p.onSelect}>
      <div className={cx("absolute top-0 -left-[64px] flex items-center opacity-0 transition-opacity group-hover/block:opacity-100", p.selected && "opacity-100")} data-block-gutter="">
        <button type="button" aria-label="위로" title="위로" className={gutterBtn} disabled={p.first} onClick={() => p.onMove(-1)}>
          <LChevronUp className="size-4" />
        </button>
        <button type="button" aria-label="아래로" title="아래로" className={gutterBtn} disabled={p.last} onClick={() => p.onMove(1)}>
          <LChevronDown className="size-4" />
        </button>
      </div>
      <div className={cx("absolute top-0 -right-[64px] flex items-center opacity-0 transition-opacity group-hover/block:opacity-100", p.selected && "opacity-100")}>
        <button type="button" aria-label="복사" title="복사" className={gutterBtn} onClick={p.onDuplicate}>
          <LCopyPlus className="size-4" />
        </button>
        <button type="button" aria-label="삭제" title="삭제" className={gutterBtn} onClick={p.onRemove}>
          <LTrash className="size-4" />
        </button>
      </div>
      {body}
    </div>
  );
}

// ---------- right panel: settings for the selected block ----------

function AlignRow({ value, onChange }: { value?: "left" | "center" | "right"; onChange: (v: "left" | "center" | "right") => void }) {
  const opts = [
    { v: "left" as const, label: "왼쪽", Icon: LAlignLeft },
    { v: "center" as const, label: "가운데", Icon: LAlignCenter },
    { v: "right" as const, label: "오른쪽", Icon: LAlignRight },
  ];
  return (
    <Row label="정렬">
      <div className="flex gap-0.5 rounded-r2 bg-bg-layer-fill p-0.5">
        {opts.map(({ v, label, Icon }) => (
          <button
            key={v}
            type="button"
            aria-label={label}
            title={label}
            aria-pressed={(value ?? "left") === v}
            onClick={() => onChange(v)}
            className={cx("flex size-7 items-center justify-center rounded-r1", (value ?? "left") === v ? "bg-bg-layer-default text-fg-neutral shadow-s1" : "text-fg-neutral-muted hover:text-fg-neutral")}
          >
            <Icon className="size-4" />
          </button>
        ))}
      </div>
    </Row>
  );
}

const WIDTHS = [25, 50, 75, 100];

function BlockSettings({
  b,
  update,
  onRemove,
  onMove,
  onDuplicate,
  tableOp,
  cell,
  onPickImage,
  embeddable,
  embed,
}: {
  b: PaperBlock;
  update: (fn: (b: PaperBlock) => PaperBlock, key?: string) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  tableOp: (op: "rowBefore" | "rowAfter" | "colBefore" | "colAfter" | "delRow" | "delCol") => void;
  cell: Cell | null;
  onPickImage: () => void;
  embeddable: Omit<Work, "data">[];
  embed: EmbedInfo | null;
}) {
  const kindLabel: Record<PaperBlock["type"], string> = { heading: "제목", paragraph: "본문", list: "목록", table: "표", image: "이미지", divider: "구분선", embed: "도안" };
  const widthSeg = (value: number, onChange: (v: number) => void) => (
    <Seg label="너비" value={String(value)} onChange={(v) => onChange(Number(v))} options={WIDTHS.map((w) => ({ value: String(w), label: `${w}%` }))} />
  );
  return (
    <>
      <PanelSection title={kindLabel[b.type]}>
        <div className="flex flex-wrap gap-x1">
          <Button size="sm" onClick={() => onMove(-1)}>
            <LChevronUp className="size-4" />
            위로
          </Button>
          <Button size="sm" onClick={() => onMove(1)}>
            <LChevronDown className="size-4" />
            아래로
          </Button>
          <Button size="sm" onClick={onDuplicate}>
            <LCopyPlus className="size-4" />
            복사
          </Button>
          <Button size="sm" variant="ghost" className="text-fg-critical" onClick={onRemove}>
            <LTrash className="size-4" />
            삭제
          </Button>
        </div>
      </PanelSection>

      {(b.type === "heading" || b.type === "paragraph") && (
        <PanelSection title="스타일">
          <Seg
            label="스타일"
            value={b.type === "paragraph" ? "p" : `h${b.level}`}
            onChange={(v) => update((x) => (x.type === "heading" || x.type === "paragraph" ? (v === "p" ? { id: x.id, type: "paragraph", text: x.text, align: x.align } : { id: x.id, type: "heading", level: Number(v[1]) as 1 | 2 | 3, text: x.text, align: x.align }) : x))}
            options={[
              { value: "h1", label: "제목 1" },
              { value: "h2", label: "제목 2" },
              { value: "h3", label: "제목 3" },
              { value: "p", label: "본문" },
            ]}
          />
          <AlignRow value={b.align} onChange={(align) => update((x) => ({ ...x, align }) as PaperBlock)} />
          <button
            type="button"
            className={headBtn}
            onClick={() => update((x) => (x.type === "heading" || x.type === "paragraph" ? { id: x.id, type: "list", ordered: false, items: x.text.split("\n").length ? x.text.split("\n") : [""] } : x))}
          >
            <LList className="size-3.5" />
            글머리 기호로 변환
          </button>
        </PanelSection>
      )}

      {b.type === "list" && (
        <PanelSection title="목록">
          <Seg
            label="목록 종류"
            value={b.ordered ? "ol" : "ul"}
            onChange={(v) => update((x) => (x.type === "list" ? { ...x, ordered: v === "ol" } : x))}
            options={[
              { value: "ul", label: "글머리 기호" },
              { value: "ol", label: "번호 목록" },
            ]}
          />
          <Row label="항목">
            <span className="t2-medium tabular-nums">{b.items.length}개</span>
          </Row>
          <button type="button" className={headBtn} onClick={() => update((x) => (x.type === "list" ? { id: x.id, type: "paragraph", text: x.items.join("\n") } : x))}>
            <LPilcrow className="size-3.5" />
            본문으로 변환
          </button>
        </PanelSection>
      )}

      {b.type === "table" && <TableSettings b={b} update={update} tableOp={tableOp} cell={cell} />}

      {b.type === "image" && (
        <PanelSection title="이미지">
          {widthSeg(b.width, (width) => update((x) => (x.type === "image" ? { ...x, width } : x)))}
          {b.src && (
            <Row label="크기">
              <span className="t2-medium tabular-nums">{fmtBytes(Math.round(b.src.length * 0.75))}</span>
            </Row>
          )}
          <Button size="sm" onClick={onPickImage}>
            <LImage className="size-4" />
            {b.src ? "사진 바꾸기" : "사진 올리기"}
          </Button>
          <p className="t1-regular text-fg-neutral-muted">5MB 이하 이미지를 올릴 수 있어요. 큰 사진은 1600px로 줄여서 저장해요.</p>
        </PanelSection>
      )}

      {b.type === "embed" && (
        <PanelSection title="도안">
          <p className="t2-medium truncate">{embed ? `${embed.title} · ${embed.craft}` : "원본 도안을 찾을 수 없어요"}</p>
          {widthSeg(b.width, (width) => update((x) => (x.type === "embed" ? { ...x, width } : x)))}
          <label className="flex flex-col gap-x1">
            <span className="t1-regular text-fg-neutral-muted">다른 도안으로 바꾸기</span>
            <select
              value={b.workId}
              onChange={(e) => update((x) => (x.type === "embed" ? { ...x, workId: e.target.value } : x))}
              className="t2-regular h-8 rounded-r2 bg-bg-layer-fill px-x2 text-fg-neutral outline-none"
            >
              {!embed && <option value={b.workId}>찾을 수 없음</option>}
              {embeddable.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.title} · {CRAFT_LABEL[w.craft]}
                </option>
              ))}
            </select>
          </label>
          {embed && (
            <Link href={`/maker/${b.workId}`} className={headBtn}>
              도안 수정하기
            </Link>
          )}
          <p className="t1-regular text-fg-neutral-muted">메이커에서 도안을 고치면 저장된 미리보기가 이 페이퍼에도 바로 반영돼요.</p>
        </PanelSection>
      )}
    </>
  );
}

const PRESETS: { value: TableBlock["preset"]; label: string }[] = [
  { value: "basic", label: "기본" },
  { value: "outerBold", label: "바깥 굵게" },
  { value: "rowsOnly", label: "가로줄만" },
  { value: "header", label: "머리글 강조" },
  { value: "none", label: "선 없음" },
];

function TableSettings({ b, update, tableOp, cell }: { b: TableBlock; update: (fn: (b: PaperBlock) => PaperBlock, key?: string) => void; tableOp: (op: "rowBefore" | "rowAfter" | "colBefore" | "colAfter" | "delRow" | "delCol") => void; cell: Cell | null }) {
  const setT = (patch: Partial<TableBlock>, key?: string) => update((x) => (x.type === "table" ? { ...x, ...patch } : x), key);
  const ops: { op: Parameters<typeof tableOp>[0]; label: string }[] = [
    { op: "rowBefore", label: "위에 행 추가" },
    { op: "rowAfter", label: "아래에 행 추가" },
    { op: "colBefore", label: "왼쪽에 열 추가" },
    { op: "colAfter", label: "오른쪽에 열 추가" },
    { op: "delRow", label: "행 삭제" },
    { op: "delCol", label: "열 삭제" },
  ];
  return (
    <>
      <PanelSection title="표">
        <Row label="헤더 행">
          <Switch checked={b.header} onChange={(header) => setT({ header })} label="헤더 행" />
        </Row>
        <Row label="크기">
          <span className="t2-medium tabular-nums">
            {b.rows.length}×{b.rows[0]?.length ?? 0}칸
          </span>
        </Row>
        <p className="t1-regular text-fg-neutral-muted">{cell ? `${cell.r + 1}행 ${cell.c + 1}열 기준이에요.` : "칸을 누르면 그 칸 기준으로 행·열을 넣고 지워요."}</p>
        <div className="grid grid-cols-2 gap-x1">
          {ops.map((o) => (
            <button key={o.op} type="button" onClick={() => tableOp(o.op)} className={cx(headBtn, "justify-center border border-stroke-neutral-muted", o.op.startsWith("del") && "text-fg-critical")}>
              {o.label}
            </button>
          ))}
        </div>
      </PanelSection>
      <PanelSection title="테두리">
        <span className="t1-regular text-fg-neutral-muted">표 스타일</span>
        <div className="grid grid-cols-5 gap-x1">
          {PRESETS.map((pr) => (
            <button
              key={pr.value}
              type="button"
              aria-pressed={b.preset === pr.value}
              title={pr.label}
              onClick={() => setT({ preset: pr.value })}
              className={cx("flex flex-col items-center gap-x1 rounded-r2 border p-x1", b.preset === pr.value ? "border-stroke-brand-solid bg-bg-brand-weak" : "border-stroke-neutral-muted hover:bg-bg-layer-fill")}
            >
              <PresetIcon preset={pr.value} />
              <span className="t1-regular w-full truncate text-center">{pr.label}</span>
            </button>
          ))}
        </div>
        <span className="t1-regular text-fg-neutral-muted">선 모양</span>
        <Seg
          label="선 모양"
          value={b.border.style}
          onChange={(style) => setT({ border: { ...b.border, style } })}
          options={[
            { value: "solid", label: "실선" },
            { value: "dashed", label: "파선" },
            { value: "dotted", label: "점선" },
            { value: "double", label: "이중선" },
            { value: "none", label: "없음" },
          ]}
        />
        <div className="grid grid-cols-2 gap-1.5">
          <div className="flex flex-col gap-x1">
            <span className="t1-regular text-fg-neutral-muted">굵기</span>
            <ScrubField label="테두리 굵기" value={b.border.width} min={1} max={6} suffix="px" height={8} onChange={(width) => setT({ border: { ...b.border, width } }, `bw-${b.id}`)} />
          </div>
          <label className="flex flex-col gap-x1">
            <span className="t1-regular text-fg-neutral-muted">색</span>
            <span className="relative flex h-8 items-center gap-x2 rounded-r2 bg-bg-layer-fill px-x2">
              <span className="size-4 rounded-r1 border border-black/15" style={{ background: b.border.color }} />
              <span className="t2-regular tabular-nums">{b.border.color}</span>
              <input type="color" aria-label="테두리 색" value={b.border.color} onChange={(e) => setT({ border: { ...b.border, color: e.target.value } }, `bc-${b.id}`)} className="absolute inset-0 cursor-pointer opacity-0" />
            </span>
          </label>
        </div>
        <button type="button" className={headBtn} onClick={() => setT({ border: { ...DEFAULT_BORDER }, preset: "basic" })}>
          기본 선으로
        </button>
      </PanelSection>
    </>
  );
}

function PresetIcon({ preset }: { preset: TableBlock["preset"] }) {
  const thin = "#9a9ea5";
  const thick = "#3a3d42";
  const outer = preset === "outerBold" ? thick : preset === "none" ? "transparent" : thin;
  return (
    <svg viewBox="0 0 24 18" className="h-[18px] w-6" aria-hidden="true">
      {preset === "header" && <rect x="1" y="1" width="22" height="5" fill="#e3e5e8" />}
      <rect x="1" y="1" width="22" height="16" fill="none" stroke={preset === "rowsOnly" ? "transparent" : outer} strokeWidth={preset === "outerBold" ? 2 : 1} />
      {[6, 12].map((y) => (
        <line key={y} x1="1" x2="23" y1={y} y2={y} stroke={preset === "none" ? "transparent" : preset === "header" && y === 6 ? thick : thin} strokeWidth={preset === "header" && y === 6 ? 1.6 : 1} />
      ))}
      {preset === "rowsOnly" && (
        <>
          <line x1="1" x2="23" y1="1" y2="1" stroke={thin} />
          <line x1="1" x2="23" y1="17" y2="17" stroke={thin} />
        </>
      )}
      {preset !== "rowsOnly" && preset !== "none" && <line x1="12" x2="12" y1="1" y2="17" stroke={thin} />}
    </svg>
  );
}
