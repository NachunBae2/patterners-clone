"use client";

// 서술도안: written pattern read back from the chart (floating panel under the top-left toggle).
import { useMemo, useState } from "react";
import { Segmented, cx, useToast } from "@/components/app/ui";
import type { CrochetFolder, CrochetLayer } from "@/lib/types";
import { BTN, el, sab } from "./seed";
import { X } from "./uiIcons";
import { writtenPattern, writtenText, type Notation } from "./written";

export function WrittenPanel({ layers, folders, onClose }: { layers: CrochetLayer[]; folders: CrochetFolder[]; onClose: () => void }) {
  const toast = useToast();
  const [nt, setNt] = useState<Notation>("ko");
  const w = useMemo(() => writtenPattern(layers, folders, nt), [layers, folders, nt]);
  const copy = async () => {
    const text = writtenText(w, nt);
    try {
      await navigator.clipboard.writeText(text);
      toast("서술도안을 복사했어요");
    } catch {
      // clipboard blocked: select a hidden textarea instead
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      toast(ok ? "서술도안을 복사했어요" : "복사하지 못했어요");
    }
  };
  return (
    <section
      role="dialog"
      aria-label="서술도안"
      data-testid="written-panel"
      className="pointer-events-auto absolute top-[52px] left-3 flex max-h-[calc(100%-240px)] min-h-[160px] w-[340px] max-w-[calc(100%-24px)] flex-col overflow-hidden rounded-r3 border border-stroke-neutral-muted bg-bg-layer-floating shadow-s3"
    >
      <header className="flex h-10 shrink-0 items-center gap-x2 border-b border-stroke-neutral-muted pr-x1 pl-x3">
        <h2 className="t3-bold min-w-0 flex-1 text-fg-neutral">서술도안</h2>
        <Segmented
          value={nt}
          onChange={setNt}
          className="w-[104px]"
          options={[
            { value: "ko", label: "한글" },
            { value: "en", label: "EN" },
          ]}
        />
        <button type="button" aria-label="서술도안 숨기기" title="서술도안 숨기기" onClick={onClose} className={cx(sab("ghost"), BTN, "size-7 shrink-0 px-0")} style={el(28, 28)}>
          <X className="size-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-x3 [scrollbar-width:thin] select-text">
        {w.empty ? (
          <p className="py-x6 text-center text-[13px] leading-relaxed text-fg-neutral-subtle">기호를 놓으면 놓은 순서대로 여기에 표시돼요</p>
        ) : (
          <div className="flex flex-col gap-x3">
            {w.sections.map((s, i) => (
              <div key={i} className="flex flex-col gap-x1">
                {s.title && <h3 className="text-[12px] font-semibold text-fg-neutral-muted">{s.title}</h3>}
                <ol className="flex flex-col gap-1">
                  {s.rounds.map((r, j) => (
                    <li key={j} className="text-[13px] leading-relaxed text-fg-neutral" data-written-round={r.label}>
                      <b className="font-semibold">{r.label}:</b> {r.text}{" "}
                      <span className="text-fg-neutral-muted tabular-nums">
                        ({r.count}
                        {nt === "en" ? "" : "코"})
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
            <div className="border-t border-stroke-neutral-muted pt-x2">
              <h3 className="mb-x1 text-[12px] font-semibold text-fg-neutral-muted">{nt === "en" ? "Stitches" : "기호별 개수"}</h3>
              <ul className="flex flex-wrap gap-x1" data-testid="written-symbols">
                {w.perSymbol.map((s) => (
                  <li key={s.name} className="rounded-r1_5 bg-bg-layer-fill px-x2 py-0.5 text-[12px] text-fg-neutral-muted">
                    {s.name} <span className="font-semibold text-fg-neutral tabular-nums">{s.count}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-x2 text-[13px] font-semibold text-fg-neutral" data-testid="written-total">
                {nt === "en" ? `Total ${w.total} sts` : `모두 ${w.total}코`}
              </p>
            </div>
          </div>
        )}
      </div>
      <footer className="flex shrink-0 justify-end border-t border-stroke-neutral-muted px-x2 py-x1_5">
        <button type="button" disabled={w.empty} onClick={copy} className={cx(sab("neutralOutline"), BTN, "h-8 !rounded-r2 px-x3 text-[12px] disabled:opacity-40")} style={el(110, 32)}>
          서술도안 복사
        </button>
      </footer>
    </section>
  );
}
