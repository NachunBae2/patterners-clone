"use client";

// Small controls shared by the 배색·방안 panels. Markup and class names follow the
// reference editor (SEED action buttons, switches, checkboxes and scrub fields).
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cx } from "@/components/app/ui";

// ---------- SEED action button ----------

type AbVariant = "ghost" | "brandSolid" | "neutralOutline" | "neutralWeak";
type AbSize = "xsmall" | "small";
type AbLayout = "withText" | "iconOnly";

export const ab = (variant: AbVariant, size: AbSize, layout: AbLayout = "withText") =>
  `seed-action-button seed-action-button--variant_${variant} seed-action-button--size_${size} seed-action-button--layout_${layout} seed-action-button--size_${size}-layout_${layout} seed-scale-feedback`;

/** Extra utilities the reference puts on shadcn-style buttons. */
export const abBase = "shrink-0 touch-manipulation select-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

export const el = (w: number, h: number) => ({ "--seed-element-width": String(w), "--seed-element-height": String(h) }) as CSSProperties;

// ---------- Segmented radio group ----------

export function Seg<T extends string>({
  value,
  options,
  onChange,
  label,
  variant = "panel",
}: {
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (v: T) => void;
  label: string;
  variant?: "panel" | "floating";
}) {
  const floating = variant === "floating";
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx(
        "flex items-center gap-0.5 rounded-r2 p-0.5",
        floating ? "h-9 border border-stroke-neutral-muted bg-bg-layer-default shadow-s2" : "h-7 w-full bg-bg-layer-fill",
      )}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cx(
              "inline-flex h-full min-w-0 items-center justify-center whitespace-nowrap rounded-r1 px-x2 text-[12px] font-medium leading-none transition-colors disabled:cursor-default",
              !floating && "flex-1",
              on
                ? floating
                  ? "bg-bg-brand-solid text-fg-neutral-inverted"
                  : "bg-bg-layer-default text-fg-neutral shadow-s1"
                : "text-fg-neutral-muted hover:text-fg-neutral",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Switch / checkbox ----------

const srOnly: CSSProperties = {
  border: 0,
  clip: "rect(0px, 0px, 0px, 0px)",
  height: 1,
  margin: -1,
  overflow: "hidden",
  padding: 0,
  position: "absolute",
  whiteSpace: "nowrap",
  width: 1,
};

export function Switch({ checked, onChange, size = 24, label }: { checked: boolean; onChange: (v: boolean) => void; size?: 16 | 24; label?: string }) {
  const d = checked ? { "data-checked": "" } : {};
  return (
    <label {...d} className={`seed-switch__root seed-switch__root--size_${size} peer shrink-0`}>
      <div {...d} aria-hidden="true" className={`seed-switchmark__root seed-switchmark__root--tone_brand seed-switchmark__root--size_${size} seed-scale-feedback`} style={size === 24 ? el(38, 24) : el(26, 16)}>
        <div {...d} aria-hidden="true" className={`seed-switchmark__thumb seed-switchmark__thumb--tone_brand seed-switchmark__thumb--size_${size}`} />
      </div>
      <input role="switch" aria-label={label} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={srOnly} />
    </label>
  );
}

export function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  const d = checked ? { "data-checked": "" } : {};
  const mark = "seed-checkmark__root seed-checkmark__root--variant_square seed-checkmark__root--tone_brand seed-checkmark__root--size_medium seed-checkmark__root--variant_square-tone_brand seed-checkmark__root--size_medium-variant_square seed-scale-feedback";
  const icon = "seed-checkmark__icon seed-checkmark__icon--variant_square seed-checkmark__icon--tone_brand seed-checkmark__icon--size_medium seed-checkmark__icon--variant_square-tone_brand seed-checkmark__icon--size_medium-variant_square";
  return (
    <label className="t2-regular flex min-h-8 cursor-pointer items-center gap-x2 text-fg-neutral">
      <label {...d} className="seed-checkbox__root seed-checkbox__root--size_medium seed-checkbox__root--weight_regular peer shrink-0">
        <div {...d} aria-hidden="true" className={mark} style={el(20, 20)}>
          {checked && (
            <svg viewBox="0 0 24 24" fill="none" width="24" height="24" aria-hidden="true" data-checked="" className={icon}>
              <path
                d="M22.5517 3.16422C21.8141 2.5834 20.7452 2.71054 20.1644 3.4482L9.56331 16.9118L3.72729 10.8235C3.07759 10.1457 2.00145 10.1229 1.32367 10.7726C0.645881 11.4223 0.623111 12.4985 1.27281 13.1763L8.462 20.6763C8.80254 21.0315 9.28032 21.2218 9.77186 21.1979C10.2634 21.174 10.7205 20.9382 11.0249 20.5516L22.8357 5.55155C23.4165 4.81389 23.2894 3.74505 22.5517 3.16422Z"
                fill="currentColor"
              />
            </svg>
          )}
        </div>
        <span {...d} className="seed-checkbox__label seed-checkbox__label--size_medium seed-checkbox__label--weight_regular" />
        <input role="checkbox" type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={srOnly} />
      </label>
      <span>{children}</span>
    </label>
  );
}

// ---------- Scrub number field ----------

const fmt = (v: number, decimals: number) => (Number.isFinite(v) ? String(Math.round(v * 10 ** decimals) / 10 ** decimals) : "");

/**
 * Number box that changes by dragging sideways, or by clicking and typing.
 * `onChange` fires live while dragging; `onCommit` (optional) once when the drag or edit ends.
 */
export function ScrubField({
  label,
  value,
  onChange,
  onCommit,
  min = -Infinity,
  max = Infinity,
  step = 1,
  decimals = 0,
  prefix,
  suffix,
  align = "left",
  height = 7,
  tone = "fill",
  disabled,
  title,
  className,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  onCommit?: () => void;
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
  prefix?: ReactNode;
  suffix?: string;
  align?: "left" | "center";
  height?: 7 | 8;
  tone?: "fill" | "soft";
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const drag = useRef<{ x: number; v: number; moved: boolean; id: number } | null>(null);
  const clampV = (v: number) => Math.min(max, Math.max(min, Math.round(v * 10 ** decimals) / 10 ** decimals));

  useEffect(() => {
    if (editing) {
      input.current?.focus();
      input.current?.select();
    }
  }, [editing]);

  const startEdit = () => {
    setText(fmt(value, decimals));
    setEditing(true);
  };
  const commitText = () => {
    const v = Number(text.replace(/,/g, "."));
    if (text.trim() !== "" && Number.isFinite(v) && clampV(v) !== value) onChange(clampV(v));
    setEditing(false);
    onCommit?.();
  };

  const soft = tone === "soft";
  return (
    <div
      aria-label={title}
      title={title}
      onPointerDown={(e) => {
        if (disabled || editing || e.button !== 0) return;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, v: value, moved: false, id: e.pointerId };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.x;
        if (!d.moved && Math.abs(dx) < 3) return;
        d.moved = true;
        const k = e.shiftKey ? 0.1 : 1;
        const v = clampV(d.v + Math.round(dx / 4) * step * k);
        if (v !== value) onChange(v);
      }}
      onPointerUp={() => {
        const d = drag.current;
        drag.current = null;
        if (!d) return;
        if (d.moved) onCommit?.();
        else startEdit();
      }}
      onPointerCancel={() => (drag.current = null)}
      className={cx(
        "flex min-w-0 items-center gap-1 rounded-r2 px-1.5 select-none",
        disabled ? "cursor-default opacity-50" : "touch-none hover:bg-bg-neutral-weak-pressed",
        !disabled && !editing && "cursor-ew-resize",
        height === 8 ? "h-8 w-full" : "h-7",
        soft ? (disabled ? "bg-bg-layer-fill/55" : "bg-bg-layer-fill/55") : "bg-bg-layer-fill",
        className,
      )}
    >
      {/* layout-audit-ignore: tiny-text — unit captions are 10px in the reference editor this screen reproduces */}
      {prefix !== undefined && (
        <span className={cx("flex shrink-0 items-center justify-center text-fg-neutral-muted", typeof prefix === "string" ? "text-[10px]" : "size-3.5")} aria-hidden="true">
          {prefix}
        </span>
      )}
      <input
        ref={input}
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        aria-label={label}
        type="text"
        value={editing ? text : fmt(value, decimals)}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => !editing && startEdit()}
        onBlur={commitText}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          else if (e.key === "Escape") {
            setText(fmt(value, decimals));
            setEditing(false);
          } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const v = clampV(Number(text) + (e.key === "ArrowUp" ? step : -step));
            if (Number.isFinite(v)) setText(fmt(v, decimals));
          }
        }}
        className={cx(
          "w-full min-w-0 flex-1 bg-transparent text-[12px] leading-none tabular-nums text-fg-neutral outline-none disabled:cursor-not-allowed",
          !editing && !disabled && "pointer-events-none",
          align === "center" ? "text-center" : "text-left",
        )}
      />
      {/* layout-audit-ignore: tiny-text — unit captions are 10px in the reference editor this screen reproduces */}
      {suffix && (
        <span className="shrink-0 text-[10px] text-fg-neutral-muted" aria-hidden="true">
          {suffix}
        </span>
      )}
    </div>
  );
}

/** Small caption + control column used by the left panel. */
export const Labeled = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex min-w-0 flex-col gap-x1">
    <span className="t1-regular min-w-0 truncate text-fg-neutral-muted">{label}</span>
    {children}
  </div>
);
