"use client";

// "무엇으로 시작할까요?" chooser shown over a dimmed editor for brand-new charts.
import { useEffect, useRef, type ReactNode } from "react";
import { LGrid3x3, LImagePlus, LType } from "./icons";
import type { MakeKind } from "./MakePanel";

const CARDS: { kind: MakeKind; title: string; desc: string; icon: ReactNode }[] = [
  { kind: "text", title: "글자", desc: "이름·문구를 격자로", icon: <LType className="size-5" /> },
  { kind: "image", title: "이미지", desc: "사진·그림을 실 색으로", icon: <LImagePlus className="size-5" /> },
  { kind: "blank", title: "빈 격자", desc: "연필로 한 칸씩 칠하기", icon: <LGrid3x3 className="size-5" /> },
];

export function StartDialog({ open, onPick, onClose }: { open: boolean; onPick: (k: MakeKind) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[70] max-lg:z-[100] flex items-center justify-center bg-bg-layer-default/55 p-x4 backdrop-blur-[1px]"
      data-grid-start-backdrop="true"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="grid-start-title" className="w-full max-w-md rounded-r3 border border-stroke-neutral-muted bg-bg-layer-floating p-x5 shadow-s3">
        <h2 id="grid-start-title" className="t5-bold text-fg-neutral">
          무엇으로 시작할까요?
        </h2>
        <p className="t3-regular mt-x1 text-fg-neutral-muted">글자나 그림을 격자로 바꾸거나, 빈 격자에 바로 칠해요.</p>
        <div className="mt-x4 grid grid-cols-3 gap-x2">
          {CARDS.map((c) => (
            <button
              key={c.kind}
              type="button"
              data-grid-start={c.kind}
              onClick={() => onPick(c.kind)}
              className="flex flex-col items-start gap-x2 rounded-r2 border border-stroke-neutral-muted bg-bg-layer-default p-x3 text-left transition-colors hover:border-stroke-brand-solid/60 hover:bg-bg-brand-solid/5 focus-visible:outline-2 focus-visible:outline-stroke-focus-ring"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-r2 bg-bg-brand-weak text-fg-brand">{c.icon}</span>
              <span className="contents">
                <span className="t3-bold text-fg-neutral">{c.title}</span>
                <span className="t1-regular leading-snug text-fg-neutral-muted">{c.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
