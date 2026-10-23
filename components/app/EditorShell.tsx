"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { works } from "@/lib/store";
import type { SaveStatus } from "@/lib/useAutosave";
import { ArrowLeft, Download, Help, Redo, Undo } from "./icons";
import { Button, Dialog, IconButton, Segmented, cx, useToast } from "./ui";

export type Shortcut = { keys: string; label: string };
export type ShortcutGroup = { title: string; items: Shortcut[] };

type Props = {
  workId: string;
  title: string;
  craftLabel: string;
  status: SaveStatus;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  /** returns false when there is nothing to export */
  onExport: (format: "png" | "jpg" | "svg") => Promise<boolean> | boolean;
  shortcuts: ShortcutGroup[];
  /** extra controls placed in the top bar before undo/redo */
  actions?: ReactNode;
  children: ReactNode;
};

const statusText: Record<SaveStatus, string> = { saved: "저장됨", saving: "저장 중…", error: "저장 실패" };

export function EditorShell(p: Props) {
  const [title, setTitle] = useState(p.title);
  const [exportOpen, setExportOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [format, setFormat] = useState<"png" | "jpg" | "svg">("png");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const commitTitle = () => {
    const t = title.trim().slice(0, 60) || "제목 없음";
    setTitle(t);
    works.update(p.workId, { title: t, updatedAt: Date.now() });
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg-layer-basement text-fg-neutral select-none" data-editor-shell>
      <header className="flex h-14 shrink-0 items-center gap-x2 border-b border-stroke-neutral-muted bg-bg-layer-default px-x3">
        <Link href="/home" aria-label="내 도안 보기" className="inline-flex size-9 items-center justify-center rounded-r2 text-fg-neutral hover:bg-bg-layer-fill">
          <ArrowLeft />
        </Link>
        <span className="hidden rounded-full bg-bg-layer-fill px-x2_5 py-x1 text-[0.75rem] font-semibold text-fg-neutral-muted sm:inline">{p.craftLabel}</span>
        <input
          aria-label="도안 제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="h-9 min-w-0 max-w-[320px] flex-1 rounded-r2 bg-transparent px-x2 text-[0.9375rem] font-semibold outline-none hover:bg-bg-layer-fill focus:bg-bg-layer-fill"
        />
        <span
          className={cx("hidden text-[0.75rem] md:inline", p.status === "error" ? "text-fg-critical" : "text-fg-neutral-subtle")}
          aria-live="polite"
        >
          {statusText[p.status]}
        </span>
        <div className="ml-auto flex items-center gap-x1">
          {p.actions}
          <IconButton label="실행 취소" shortcut="⌘Z" disabled={!p.canUndo} onClick={p.onUndo}>
            <Undo />
          </IconButton>
          <IconButton label="다시 실행" shortcut="⇧⌘Z" disabled={!p.canRedo} onClick={p.onRedo}>
            <Redo />
          </IconButton>
          <IconButton label="단축키" shortcut="?" onClick={() => setHelpOpen(true)}>
            <Help />
          </IconButton>
          <Button variant="primary" size="sm" className="ml-x1" onClick={() => setExportOpen(true)}>
            <Download className="size-4" />
            내보내기
          </Button>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">{p.children}</div>

      <Dialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="내보내기"
        footer={
          <>
            <Button onClick={() => setExportOpen(false)}>취소</Button>
            <Button
              variant="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const ok = await p.onExport(format);
                  if (ok === false) toast("내보낼 내용이 없어요.");
                  else setExportOpen(false);
                } catch {
                  toast("내보내기에 실패했어요");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "내보내는 중" : "내보내기"}
            </Button>
          </>
        }
      >
        <p className="mb-x2 text-[0.8125rem] font-semibold text-fg-neutral-muted">형식</p>
        <Segmented
          value={format}
          onChange={setFormat}
          options={[
            { value: "png", label: "PNG" },
            { value: "jpg", label: "JPG" },
            { value: "svg", label: "SVG" },
          ]}
        />
        <p className="mt-x3 text-[0.8125rem] text-fg-neutral-muted">
          {format === "svg" ? "확대해도 선명한 벡터 파일이에요." : "고화질(2배)로 저장해요. 인쇄용이면 PNG를 추천해요."}
        </p>
      </Dialog>

      <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} title="단축키" width={560}>
        <div className="grid gap-x5 sm:grid-cols-2">
          {p.shortcuts.map((g) => (
            <section key={g.title}>
              <h3 className="mb-x2 text-[0.8125rem] font-semibold text-fg-neutral-muted">{g.title}</h3>
              <ul className="flex flex-col gap-x1_5">
                {g.items.map((s) => (
                  <li key={s.label} className="flex items-center justify-between gap-x3 text-[0.875rem]">
                    <span>{s.label}</span>
                    <kbd className="rounded-r1_5 border border-stroke-neutral-muted bg-bg-layer-fill px-x1_5 py-0.5 font-sans text-[0.75rem] text-fg-neutral-muted">
                      {s.keys}
                    </kbd>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Dialog>
    </div>
  );
}

/** Opens the shortcut dialog from a keyboard handler: dispatches a click on the help button. */
export function openShortcutHelp() {
  document.querySelector<HTMLButtonElement>('[data-editor-shell] header button[aria-label="단축키"]')?.click();
}
