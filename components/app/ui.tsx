"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
export { cx };

// ---------- Buttons ----------

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
};

export function Button({ variant = "secondary", size = "md", className, ...rest }: BtnProps) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        "inline-flex shrink-0 items-center justify-center gap-x1_5 rounded-r2 font-semibold whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-40",
        size === "sm" ? "h-8 px-x3 text-[0.8125rem]" : "h-10 px-x4 text-[0.875rem]",
        variant === "primary" && "bg-bg-brand-solid-pressed text-fg-neutral-inverted hover:bg-[var(--seed-color-fg-brand-contrast)]",
        variant === "secondary" && "border border-stroke-neutral-weak bg-bg-layer-default text-fg-neutral hover:bg-bg-layer-fill",
        variant === "ghost" && "text-fg-neutral hover:bg-bg-layer-fill",
        variant === "danger" && "bg-bg-critical-solid text-fg-neutral-inverted hover:opacity-90",
        className,
      )}
    />
  );
}

type IconBtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  shortcut?: string;
  active?: boolean;
  size?: "sm" | "md";
};

/** Square icon button with a hover tooltip (label + shortcut). */
export function IconButton({ label, shortcut, active, size = "md", className, children, ...rest }: IconBtnProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      {...rest}
      className={cx(
        "group/ib relative inline-flex shrink-0 items-center justify-center rounded-r2 transition-colors disabled:pointer-events-none disabled:opacity-35 [&_svg]:size-[18px]",
        size === "sm" ? "size-8" : "size-9",
        active ? "bg-bg-neutral-inverted text-fg-neutral-inverted" : "text-fg-neutral hover:bg-bg-layer-fill",
        className,
      )}
    >
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-50 hidden -translate-x-1/2 items-center gap-x1_5 rounded-r1_5 bg-bg-neutral-inverted px-x2 py-x1 text-[0.75rem] font-medium whitespace-nowrap text-fg-neutral-inverted group-hover/ib:flex"
      >
        {label}
        {shortcut && <kbd className="rounded-[4px] bg-white/20 px-1 font-sans text-[0.6875rem]">{shortcut}</kbd>}
      </span>
    </button>
  );
}

// ---------- Dialog ----------

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  width = 440,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto max-h-[85vh] rounded-r4 border border-stroke-neutral-muted bg-bg-layer-floating p-0 text-fg-neutral shadow-s3 backdrop:bg-black/30"
      style={{ width: `min(${width}px, calc(100vw - 32px))` }}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between px-x5 pt-x5 pb-x3">
            <h2 className="t6-bold">{title}</h2>
            <IconButton label="닫기" size="sm" onClick={onClose}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </IconButton>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-x5 pb-x5">{children}</div>
          {footer && <div className="flex justify-end gap-x2 border-t border-stroke-neutral-muted px-x5 py-x3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

// ---------- Popover menu ----------

export type MenuItem =
  | { label: string; onSelect: () => void; danger?: boolean; disabled?: boolean; shortcut?: string }
  | "separator";

export function MenuList({ items, onClose }: { items: MenuItem[]; onClose: () => void }) {
  return (
    <div role="menu" className="min-w-[180px] rounded-r3 border border-stroke-neutral-muted bg-bg-layer-floating p-x1 shadow-s3">
      {items.map((it, i) =>
        it === "separator" ? (
          <div key={i} className="my-x1 border-t border-stroke-neutral-muted" />
        ) : (
          <button
            key={i}
            type="button"
            role="menuitem"
            disabled={it.disabled}
            onClick={() => {
              it.onSelect();
              onClose();
            }}
            className={cx(
              "flex h-9 w-full items-center justify-between gap-x4 rounded-r2 px-x3 text-left text-[0.875rem] hover:bg-bg-layer-fill disabled:opacity-40",
              it.danger ? "text-fg-critical" : "text-fg-neutral",
            )}
          >
            {it.label}
            {it.shortcut && <span className="text-[0.75rem] text-fg-neutral-subtle">{it.shortcut}</span>}
          </button>
        ),
      )}
    </div>
  );
}

/** Button that opens a menu below it. */
export function Menu({ trigger, items, align = "start" }: { trigger: (p: { open: boolean; toggle: () => void }) => ReactNode; items: MenuItem[]; align?: "start" | "end" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, open, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      {open && (
        <div className={cx("absolute top-[calc(100%+4px)] z-50", align === "end" ? "right-0" : "left-0")}>
          <MenuList items={items} onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

/** Menu at a screen position (right-click). */
export function ContextMenu({ at, items, onClose }: { at: { x: number; y: number } | null; items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, !!at, onClose);
  if (!at) return null;
  return (
    <div ref={ref} className="fixed z-50" style={{ left: at.x, top: at.y }}>
      <MenuList items={items} onClose={onClose} />
    </div>
  );
}

export function useOutside(ref: React.RefObject<HTMLElement | null>, active: boolean, onOutside: () => void) {
  useEffect(() => {
    if (!active) return;
    const down = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && onOutside();
    const key = (e: KeyboardEvent) => e.key === "Escape" && onOutside();
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [active, onOutside, ref]);
}

// ---------- Toast ----------

type Toast = { id: number; text: string; action?: { label: string; run: () => void } };
const ToastCtx = createContext<(text: string, action?: Toast["action"]) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, action?: Toast["action"]) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-x6 z-[60] flex flex-col items-center gap-x2">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto flex items-center gap-x3 rounded-r3 bg-bg-neutral-inverted px-x4 py-x2_5 text-[0.875rem] text-fg-neutral-inverted shadow-s3">
            {t.text}
            {t.action && (
              <button type="button" className="font-semibold text-[var(--seed-color-palette-lime-300)]" onClick={t.action.run}>
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ---------- Small form pieces ----------

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  className,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  className?: string;
}) {
  return (
    <label className={cx("flex items-center gap-x2 text-[0.8125rem] text-fg-neutral-muted", className)}>
      <span className="shrink-0">{label}</span>
      <span className="flex h-8 items-center rounded-r2 border border-stroke-neutral-weak bg-bg-layer-default pr-x2 focus-within:border-stroke-neutral-contrast">
        <input
          type="number"
          value={Number.isFinite(value) ? value : ""}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) onChange(max !== undefined || min !== undefined ? Math.min(max ?? v, Math.max(min ?? v, v)) : v);
          }}
          className="h-full w-14 bg-transparent pl-x2 text-[0.875rem] text-fg-neutral tabular-nums outline-none"
        />
        {suffix && <span className="text-[0.75rem] text-fg-neutral-subtle">{suffix}</span>}
      </span>
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange, className }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; className?: string }) {
  return (
    <div role="group" className={cx("flex rounded-r2 bg-bg-layer-fill p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            "h-8 min-w-0 flex-1 truncate rounded-r1_5 px-x2 text-[0.8125rem] font-semibold",
            o.value === value ? "bg-bg-layer-default text-fg-neutral shadow-s1" : "text-fg-neutral-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Swatch row with a native colour input at the end. */
export function ColorSwatches({ colors, value, onPick, onAdd }: { colors: string[]; value?: string | null; onPick: (c: string) => void; onAdd?: (c: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x1_5">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`색 ${c}`}
          aria-pressed={value === c}
          onClick={() => onPick(c)}
          className={cx("size-7 rounded-full border border-black/10", value === c && "ring-2 ring-stroke-neutral-contrast ring-offset-2")}
          style={{ background: c }}
        />
      ))}
      {onAdd && (
        <label className="relative flex size-7 cursor-pointer items-center justify-center rounded-full border border-dashed border-stroke-neutral-weak text-fg-neutral-muted" title="직접 색 고르기">
          +
          <input type="color" className="absolute inset-0 cursor-pointer opacity-0" onChange={(e) => onAdd(e.target.value)} />
        </label>
      )}
    </div>
  );
}

// ---------- Hotkeys ----------

/** Global keydown handler that ignores typing in inputs. */
export function useHotkeys(handler: (e: KeyboardEvent) => void, deps: unknown[]) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      handler(e);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export const isMod = (e: KeyboardEvent | React.MouseEvent | React.PointerEvent | WheelEvent) => e.metaKey || e.ctrlKey;
