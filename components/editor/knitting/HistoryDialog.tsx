"use client";

// 버전 기록: named and automatic versions of this work (lib/versions), with preview, restore, rename and delete.
import { useEffect, useMemo, useState } from "react";
import { Button, Dialog, cx, useToast } from "@/components/app/ui";
import type { WorkData } from "@/lib/types";
import { useVersions, versions, type Version } from "@/lib/versions";
import { savedLabel } from "./RightPanel";
import { Pencil, Trash2 } from "./icons";

/* layout-audit-ignore: tiny-text — list captions follow the editor's 11–12px type */

export function HistoryDialog({
  open,
  onClose,
  workId,
  current,
  render,
  onRestore,
}: {
  open: boolean;
  onClose: () => void;
  workId: string;
  /** the document as it is now (saved as a version on request) */
  current: () => WorkData;
  /** preview SVG markup of a version, or null when it has nothing to draw */
  render: (data: WorkData) => string | null;
  onRestore: (v: Version) => void;
}) {
  const toast = useToast();
  const list = useVersions(workId);
  const [pick, setPick] = useState<string | "current">("current");
  const [label, setLabel] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (open) {
      setPick("current");
      setConfirm(false);
      setRenaming(null);
      setLabel("");
    }
  }, [open]);

  const picked = pick === "current" ? null : (list.find((v) => v.id === pick) ?? null);
  const previewSvg = useMemo(() => {
    if (!open) return null;
    try {
      return render(picked ? picked.data : current());
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, picked, render]);
  const src = previewSvg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(previewSvg)}` : null;

  const saveNamed = () => {
    const name = label.trim() || `${savedLabel(Date.now())} 버전`;
    if (!versions.save(workId, current(), name)) {
      toast("저장 공간이 부족해 버전을 저장하지 못했어요");
      return;
    }
    setLabel("");
    toast(`「${name}」 버전을 저장했어요`);
  };

  const restore = () => {
    if (!picked) return;
    // keep what is there now, so the restore can be taken back from here too
    versions.save(workId, current(), `${savedLabel(picked.at)} 버전에서 복원 전`);
    onRestore(picked);
    toast(`${savedLabel(picked.at)} 버전으로 복원했어요`);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="버전 기록" width={820}>
      <div className="flex flex-col gap-x3">
        <form
          className="flex items-center gap-x2"
          onSubmit={(e) => {
            e.preventDefault();
            saveNamed();
          }}
        >
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={40}
            placeholder="버전 이름 (예: 소매 줄이기 전)"
            aria-label="버전 이름"
            className="h-10 min-w-0 flex-1 rounded-r2 border border-stroke-neutral-weak bg-bg-layer-default px-x3 text-[16px] outline-none focus:border-stroke-neutral-contrast md:text-[14px]"
          />
          <Button type="submit" variant="primary">
            지금 버전 저장
          </Button>
        </form>
        <div className="grid min-h-0 gap-x4 md:grid-cols-[17rem_minmax(0,1fr)]">
          <ul className="flex max-h-[52vh] flex-col overflow-y-auto rounded-r2 border border-stroke-neutral-muted" aria-label="버전 목록">
            <li>
              <button
                type="button"
                aria-current={pick === "current"}
                onClick={() => {
                  setPick("current");
                  setConfirm(false);
                }}
                className={cx("flex w-full flex-col items-start gap-0.5 border-b border-stroke-neutral-muted px-x3 py-x2 text-left", pick === "current" ? "bg-sky-500/15" : "hover:bg-bg-layer-default-pressed")}
              >
                <span className="text-[13px] font-semibold text-fg-neutral">현재 버전</span>
                <span className="text-[11px] text-fg-neutral-muted">지금 편집 중인 내용</span>
              </button>
            </li>
            {list.length === 0 && <li className="px-x3 py-x4 text-[12px] leading-[1.5] text-fg-neutral-muted">아직 저장된 버전이 없어요. 편집하면 5분마다 자동으로 남고, 위에서 이름을 붙여 저장할 수도 있어요.</li>}
            {list.map((v) => (
              <li key={v.id} className="group/ver relative border-b border-stroke-neutral-muted last:border-b-0">
                {renaming === v.id ? (
                  <input
                    autoFocus
                    defaultValue={v.label ?? ""}
                    maxLength={40}
                    aria-label="버전 이름 변경"
                    onBlur={(e) => {
                      versions.rename(workId, v.id, e.target.value);
                      setRenaming(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      if (e.key === "Escape") setRenaming(null);
                    }}
                    className="m-x2 h-8 w-[calc(100%-1rem)] rounded-r1_5 border border-stroke-neutral-weak bg-bg-layer-default px-x2 text-[16px] outline-none md:text-[13px]"
                  />
                ) : (
                  <button
                    type="button"
                    aria-current={pick === v.id}
                    onClick={() => {
                      setPick(v.id);
                      setConfirm(false);
                    }}
                    className={cx("flex w-full flex-col items-start gap-0.5 px-x3 py-x2 pr-x16 text-left", pick === v.id ? "bg-sky-500/15" : "hover:bg-bg-layer-default-pressed")}
                  >
                    <span className="w-full truncate text-[13px] font-medium text-fg-neutral">{v.label ?? "자동 저장"}</span>
                    <span className="text-[11px] text-fg-neutral-muted tabular-nums">{savedLabel(v.at)}</span>
                  </button>
                )}
                {renaming !== v.id && (
                  <span className="absolute top-1/2 right-x1_5 flex -translate-y-1/2 items-center gap-0.5 opacity-0 group-focus-within/ver:opacity-100 group-hover/ver:opacity-100">
                    <button type="button" aria-label="이름 바꾸기" title="이름 바꾸기" onClick={() => setRenaming(v.id)} className="flex size-7 items-center justify-center rounded-r1_5 text-fg-neutral-muted hover:bg-bg-layer-default-pressed hover:text-fg-neutral">
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="버전 삭제"
                      title="버전 삭제"
                      onClick={() => {
                        versions.remove(workId, v.id);
                        if (pick === v.id) setPick("current");
                      }}
                      className="flex size-7 items-center justify-center rounded-r1_5 text-fg-neutral-muted hover:bg-bg-layer-default-pressed hover:text-fg-critical"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
          <div className="flex min-w-0 flex-col gap-x3">
            <div className="flex h-[min(46vh,22rem)] items-center justify-center overflow-hidden rounded-r2 border border-stroke-neutral-muted bg-bg-layer-fill p-x3">
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt={picked ? `${savedLabel(picked.at)} 버전 미리보기` : "현재 버전 미리보기"} className="max-h-full max-w-full object-contain" />
              ) : (
                <p className="text-[12px] text-fg-neutral-muted">{previewSvg === null && picked ? "이 버전에는 보이는 격자가 없어요." : "보이는 격자가 없어요."}</p>
              )}
            </div>
            {picked ? (
              confirm ? (
                <div className="flex flex-col gap-x2 rounded-r2 border border-stroke-neutral-muted p-x3">
                  <p className="text-[13px] font-semibold text-fg-neutral">이 버전으로 복원할까요?</p>
                  <p className="text-[12px] leading-[1.5] text-fg-neutral-muted">{savedLabel(picked.at)} 버전으로 바뀌어요. 지금 내용은 기록에 남아 있어서 다시 돌아올 수 있어요. 실행 취소(Ctrl(Cmd) + Z)로도 되돌릴 수 있어요.</p>
                  <div className="flex justify-end gap-x2">
                    <Button size="sm" onClick={() => setConfirm(false)}>
                      취소
                    </Button>
                    <Button size="sm" variant="primary" onClick={restore}>
                      복원
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-x2">
                  <span className="min-w-0 truncate text-[12px] text-fg-neutral-muted">{savedLabel(picked.at)} 버전을 보는 중</span>
                  <Button size="sm" variant="primary" onClick={() => setConfirm(true)}>
                    이 버전으로 복원
                  </Button>
                </div>
              )
            ) : (
              <p className="text-[12px] text-fg-neutral-muted">목록에서 버전을 고르면 미리 보고 복원할 수 있어요.</p>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
