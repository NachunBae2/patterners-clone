"use client";

import type { ReactNode } from "react";
import { cx } from "./ui";

/** Same text field look as the rename dialog. */
export const inputCls =
  "h-11 w-full rounded-r2 border border-stroke-neutral-weak bg-bg-layer-default px-x3 text-[1rem] text-fg-neutral outline-none placeholder:text-fg-neutral-subtle focus:border-stroke-neutral-contrast";
export const textareaCls =
  "min-h-28 w-full resize-y rounded-r2 border border-stroke-neutral-weak bg-bg-layer-default px-x3 py-x2_5 text-[1rem] leading-[1.5] text-fg-neutral outline-none placeholder:text-fg-neutral-subtle focus:border-stroke-neutral-contrast";

export function Field({ label, hint, required, children, className }: { label: string; hint?: ReactNode; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <label className={cx("flex flex-col gap-x1_5", className)}>
      <span className="t3-bold text-fg-neutral">
        {label}
        {required && <span className="ml-0.5 text-fg-critical">*</span>}
      </span>
      {children}
      {hint && <span className="t2-regular text-fg-neutral-subtle">{hint}</span>}
    </label>
  );
}

/** Toggle chip (tags, categories). */
export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cx(
        "inline-flex h-8 items-center rounded-full border px-x3 text-[0.8125rem] font-medium whitespace-nowrap transition-colors",
        on ? "border-transparent bg-bg-neutral-inverted text-fg-neutral-inverted" : "border-stroke-neutral-weak bg-bg-layer-default text-fg-neutral hover:bg-bg-layer-fill",
      )}
    >
      {children}
    </button>
  );
}

/** Small static tag. */
export function Tag({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "brand" }) {
  return (
    <span
      className={cx(
        "inline-flex h-6 items-center rounded-r1_5 px-x2 text-[0.75rem] font-medium whitespace-nowrap",
        tone === "brand" ? "bg-bg-brand-weak text-fg-brand" : "bg-bg-layer-fill text-fg-neutral-muted",
      )}
    >
      {children}
    </span>
  );
}

/** Informative callout used to say "this runs locally". */
export function LocalNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cx("rounded-r2 bg-bg-informative-weak px-x3 py-x2_5 t3-regular text-fg-informative-contrast", className)}>{children}</p>
  );
}
