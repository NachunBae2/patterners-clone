"use client";

import { useState } from "react";
import { Button, Dialog, Segmented, useToast } from "@/components/app/ui";

export type Shortcut = { keys: string; label: string };
export type ShortcutGroup = { title: string; items: Shortcut[] };
export type ExportFormat = "png" | "jpg" | "svg";

export function ExportDialog({ open, onClose, onExport }: { open: boolean; onClose: () => void; onExport: (f: ExportFormat) => Promise<boolean> | boolean }) {
  const [format, setFormat] = useState<ExportFormat>("png");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="내보내기"
      footer={
        <>
          <Button onClick={onClose}>취소</Button>
          <Button
            variant="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const ok = await onExport(format);
                if (ok === false) toast("내보낼 격자가 없어요.");
                else onClose();
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
        {format === "svg" ? "확대해도 선명한 벡터 파일이에요." : "고화질(2배)로 저장해요. 인쇄용이면 PNG를 추천해요."} 보이는 격자가 번호와 함께 한 장에 담겨요.
      </p>
    </Dialog>
  );
}

export function ShortcutDialog({ open, onClose, groups }: { open: boolean; onClose: () => void; groups: ShortcutGroup[] }) {
  return (
    <Dialog open={open} onClose={onClose} title="단축키" width={560}>
      <div className="grid gap-x5 sm:grid-cols-2">
        {groups.map((g) => (
          <section key={g.title}>
            <h3 className="mb-x2 text-[0.8125rem] font-semibold text-fg-neutral-muted">{g.title}</h3>
            <ul className="flex flex-col gap-x1_5">
              {g.items.map((s) => (
                <li key={s.label} className="flex items-center justify-between gap-x3 text-[0.875rem]">
                  <span>{s.label}</span>
                  <kbd className="rounded-r1_5 border border-stroke-neutral-muted bg-bg-layer-fill px-x1_5 py-0.5 font-sans text-[0.75rem] text-fg-neutral-muted">{s.keys}</kbd>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
