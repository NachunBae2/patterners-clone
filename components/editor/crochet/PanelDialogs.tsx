"use client";

// Dialogs and popovers opened from the right panel: 버전 기록, 기호 높이, 배경색.
import { useRef, useState } from "react";
import { Button, ColorSwatches, Dialog, IconButton, NumberField, cx, useOutside } from "@/components/app/ui";
import type { CrochetData, CrochetItem, StitchHeights } from "@/lib/types";
import { useVersions, type Version } from "@/lib/versions";
import { layerStitches } from "./chart";
import { HEIGHT_CLASSES } from "./geometry";
import { ChartPreview } from "./render";
import { Pencil, Trash2 } from "./uiIcons";

// ---------- 버전 기록 ----------

const timeFmt = new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "2-digit", hour12: true });
const dayFmt = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" });
export function versionTime(at: number) {
  const d = new Date(at);
  const today = new Date();
  const y = new Date(today);
  y.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const day = same(d, today) ? "오늘" : same(d, y) ? "어제" : dayFmt.format(d);
  return `${day} ${timeFmt.format(d)}`;
}

const versionItems = (v: Version): CrochetItem[] => ((v.data as CrochetData).layers ?? []).filter((l) => l.visible !== false).flatMap((l) => l.items ?? []);

export function VersionDialog({
  open,
  onClose,
  workId,
  currentItems,
  savedAt,
  onSave,
  onRestore,
  onRename,
  onRemove,
}: {
  open: boolean;
  onClose: () => void;
  workId: string;
  currentItems: CrochetItem[];
  savedAt: number;
  onSave: (label: string) => void;
  onRestore: (v: Version) => void;
  onRename: (id: string, label: string) => void;
  onRemove: (id: string) => void;
}) {
  const list = useVersions(workId);
  const [label, setLabel] = useState("");
  const [viewing, setViewing] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);
  const view = list.find((v) => v.id === viewing) ?? null;
  const autoCount = list.filter((v) => v.auto).length;
  const close = () => {
    setViewing(null);
    setEditing(null);
    setConfirmDel(null);
    setConfirmRestore(null);
    onClose();
  };
  const save = () => {
    onSave(label);
    setLabel("");
  };

  return (
    <Dialog open={open} onClose={close} title="버전 기록" width={560}>
      <div className="flex flex-col gap-x4" data-testid="version-dialog">
        <div className="flex items-stretch gap-x3 rounded-r3 border border-stroke-neutral-muted p-x3">
          <span className="flex size-[88px] shrink-0 items-center justify-center rounded-r2 border border-stroke-neutral-muted bg-white">
            <ChartPreview items={view ? versionItems(view) : currentItems} width={84} height={84} pad={6} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-x1_5">
            {view ? (
              <>
                <p className="t3-bold text-fg-neutral">{versionTime(view.at)} 버전을 보는 중</p>
                <p className="text-[12px] text-fg-neutral-muted">{view.label ?? (view.auto ? "자동 저장" : "이름 없는 버전")} · 기호 {versionItems(view).length}개 · {layerStitches(versionItems(view))}코</p>
                <div className="mt-auto flex flex-wrap gap-x1_5">
                  <Button size="sm" variant="primary" onClick={() => setConfirmRestore(view.id)}>
                    이 버전으로 복원
                  </Button>
                  <Button size="sm" onClick={() => setViewing(null)}>
                    현재로 돌아가기
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="t3-bold text-fg-neutral">현재 버전</p>
                <p className="text-[12px] text-fg-neutral-muted">
                  {versionTime(savedAt)} 저장됨 · 기호 {currentItems.length}개 · 자동 저장 {autoCount}개
                </p>
                <div className="mt-auto flex gap-x1_5">
                  <input
                    value={label}
                    onChange={(e) => setLabel(e.target.value.slice(0, 40))}
                    onKeyDown={(e) => e.key === "Enter" && save()}
                    placeholder="버전 이름 (선택)"
                    aria-label="버전 이름"
                    className="h-8 min-w-0 flex-1 rounded-r2 border border-stroke-neutral-weak bg-bg-layer-default px-x2 text-[13px] outline-none focus:border-stroke-neutral-contrast"
                  />
                  <Button size="sm" variant="primary" onClick={save}>
                    지금 버전 저장
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
        {confirmRestore && (
          <div className="flex flex-col gap-x2 rounded-r3 bg-bg-layer-fill p-x3" role="alertdialog" aria-label="이 버전으로 복원할까요?">
            <p className="t3-bold">이 버전으로 복원할까요?</p>
            <p className="text-[13px] text-fg-neutral-muted">{versionTime(list.find((v) => v.id === confirmRestore)?.at ?? 0)} 버전으로 바뀌어요. 지금 내용은 기록에 남아 있어서 다시 돌아올 수 있어요. 실행 취소(⌘Z)로도 되돌릴 수 있어요.</p>
            <div className="flex justify-end gap-x1_5">
              <Button size="sm" onClick={() => setConfirmRestore(null)}>
                취소
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  const v = list.find((x) => x.id === confirmRestore);
                  setConfirmRestore(null);
                  setViewing(null);
                  if (v) onRestore(v);
                }}
              >
                복원
              </Button>
            </div>
          </div>
        )}
        {list.length === 0 ? (
          <p className="rounded-r2 bg-bg-layer-fill px-x3 py-x4 text-center text-[13px] leading-relaxed text-fg-neutral-muted">아직 기록이 없어요. 편집하는 동안 5분마다 자동으로 남아요.</p>
        ) : (
          <ul className="flex flex-col" aria-label="버전 목록">
            {list.map((v) => {
              const items = versionItems(v);
              return (
                <li key={v.id} data-version={v.id} className={cx("flex items-center gap-x3 border-b border-stroke-neutral-muted py-x2 last:border-b-0", viewing === v.id && "bg-bg-brand-weak")}>
                  <button type="button" onClick={() => setViewing(v.id)} title="미리보기" aria-label={`${versionTime(v.at)} 미리보기`} className="flex size-12 shrink-0 items-center justify-center rounded-r2 border border-stroke-neutral-muted bg-white hover:border-stroke-neutral-contrast">
                    {items.length ? <ChartPreview items={items} width={44} height={44} pad={3} /> : <span className="text-[11px] text-fg-neutral-subtle">빈 도안</span>}
                  </button>
                  <div className="min-w-0 flex-1">
                    {editing === v.id ? (
                      <input
                        autoFocus
                        value={draft}
                        aria-label="버전 이름"
                        onChange={(e) => setDraft(e.target.value.slice(0, 40))}
                        onBlur={() => {
                          onRename(v.id, draft);
                          setEditing(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          if (e.key === "Escape") setEditing(null);
                        }}
                        className="h-7 w-full rounded-r1_5 border border-stroke-neutral-contrast bg-bg-layer-default px-x1_5 text-[13px] outline-none"
                      />
                    ) : (
                      <p className="truncate text-[13px] font-semibold text-fg-neutral">{v.label ?? (v.auto ? "자동 저장" : "이름 없는 버전")}</p>
                    )}
                    <p className="text-[12px] text-fg-neutral-muted tabular-nums">
                      {versionTime(v.at)} · 기호 {items.length}개
                    </p>
                  </div>
                  {confirmDel === v.id ? (
                    <span className="flex items-center gap-x1">
                      <Button size="sm" onClick={() => setConfirmDel(null)}>
                        취소
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          onRemove(v.id);
                          setConfirmDel(null);
                          if (viewing === v.id) setViewing(null);
                        }}
                      >
                        삭제
                      </Button>
                    </span>
                  ) : (
                    <span className="flex items-center gap-0.5">
                      <Button size="sm" variant="ghost" onClick={() => setConfirmRestore(v.id)}>
                        복원
                      </Button>
                      <IconButton
                        label="이름 바꾸기"
                        size="sm"
                        onClick={() => {
                          setDraft(v.label ?? "");
                          setEditing(v.id);
                        }}
                      >
                        <Pencil />
                      </IconButton>
                      <IconButton label="버전 삭제" size="sm" className="hover:text-fg-critical" onClick={() => setConfirmDel(v.id)}>
                        <Trash2 />
                      </IconButton>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Dialog>
  );
}

// ---------- 기호 높이 ----------

export function HeightsDialog({ open, onClose, heights, onChange, onBegin }: { open: boolean; onClose: () => void; heights?: StitchHeights; onChange: (h: StitchHeights | undefined, merge?: boolean) => void; onBegin: () => void }) {
  const scale = heights?.scale ?? 1;
  const units = heights?.units ?? {};
  const clean = (h: StitchHeights): StitchHeights | undefined => {
    const u = Object.fromEntries(Object.entries(h.units ?? {}).filter(([k, v]) => v && v !== Number(k)));
    const s = h.scale && Math.abs(h.scale - 1) > 1e-6 ? h.scale : undefined;
    if (!s && !Object.keys(u).length) return undefined;
    return { ...(s ? { scale: s } : {}), ...(Object.keys(u).length ? { units: u } : {}) };
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="기호 높이"
      width={420}
      footer={
        <>
          <Button onClick={() => onChange(undefined)} disabled={!heights}>
            기본으로
          </Button>
          <Button variant="primary" onClick={onClose}>
            완료
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-x4" data-testid="heights-dialog">
        <p className="text-[13px] leading-relaxed text-fg-neutral-muted">사슬 1개 높이를 기준으로 각 기호를 몇 사슬 높이로 그릴지 정해요. 같은 높이의 늘리기·모으기·걸어뜨기도 따라가요.</p>
        <div className="flex flex-col gap-x1_5">
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-semibold text-fg-neutral">전체 배율</span>
            <span className="text-fg-neutral-muted tabular-nums">×{scale.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.05}
            value={scale}
            aria-label="긴뜨기 기호 전체 배율"
            onPointerDown={onBegin}
            onKeyDown={onBegin}
            onChange={(e) => onChange(clean({ ...heights, scale: Number(e.target.value) }), true)}
            className="accent-[var(--seed-color-fg-neutral)]"
          />
        </div>
        <ul className="flex flex-col gap-x2">
          {HEIGHT_CLASSES.map((c) => (
            <li key={c.units} className="flex items-center justify-between gap-x3">
              <span className="text-[13px] text-fg-neutral">
                {c.label} <span className="text-[12px] text-fg-neutral-subtle">기본 {c.units}</span>
              </span>
              <NumberField
                label=""
                suffix="사슬"
                value={units[String(c.units)] ?? c.units}
                min={1}
                max={12}
                step={0.25}
                onChange={(v) => onChange(clean({ ...heights, units: { ...units, [String(c.units)]: Math.round(v * 4) / 4 } }))}
              />
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  );
}

// ---------- 배경색 ----------

export const BACKGROUNDS = ["#ffffff", "#faf7f2", "#fdf2e6", "#fff8d9", "#eef6e9", "#e9f3fa", "#f1ecfa", "#fbebf3", "#f1f1f1", "#2b2b2b"];

export function BackgroundPopover({ value, onPick, onClose }: { value: string; onPick: (c: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, true, onClose);
  return (
    <div ref={ref} role="dialog" aria-label="캔버스 배경" data-testid="bg-popover" className="absolute bottom-[calc(100%+8px)] left-0 z-50 w-[220px] rounded-r3 border border-stroke-neutral-muted bg-bg-layer-floating p-x3 shadow-s3">
      <p className="mb-x2 text-[12px] font-semibold text-fg-neutral-muted">배경색</p>
      <ColorSwatches colors={BACKGROUNDS} value={value} onPick={onPick} onAdd={onPick} />
    </div>
  );
}
