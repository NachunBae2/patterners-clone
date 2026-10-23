"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { ChevronRight } from "@/components/app/icons";
import { cx, useOutside } from "@/components/app/ui";

export type CtxItem =
  | { label: string; onSelect?: () => void; shortcut?: string; danger?: boolean; disabled?: boolean; children?: CtxItem[] }
  | "separator";

/** Right-click menu with one level of submenus (opens on hover / focus). */
export function CtxMenu({ at, items, onClose }: { at: { x: number; y: number } | null; items: CtxItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(at);
  useOutside(ref, !!at, onClose);
  useLayoutEffect(() => {
    if (!at || !ref.current) return setPos(at);
    const r = ref.current.getBoundingClientRect();
    setPos({ x: Math.min(at.x, window.innerWidth - r.width - 8), y: Math.min(at.y, window.innerHeight - r.height - 8) });
  }, [at]);
  if (!at) return null;
  return (
    <div ref={ref} className="fixed z-50" style={{ left: (pos ?? at).x, top: (pos ?? at).y }} onContextMenu={(e) => e.preventDefault()}>
      <List items={items} onClose={onClose} />
    </div>
  );
}

function List({ items, onClose }: { items: CtxItem[]; onClose: () => void }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div role="menu" className="min-w-[200px] rounded-r3 border border-stroke-neutral-muted bg-bg-layer-floating p-x1 shadow-s3">
      {items.map((it, i) =>
        it === "separator" ? (
          <div key={i} className="my-x1 border-t border-stroke-neutral-muted" />
        ) : (
          <div key={i} className="relative" onPointerEnter={() => setOpen(it.children ? i : null)}>
            <button
              type="button"
              role="menuitem"
              aria-haspopup={it.children ? "menu" : undefined}
              aria-expanded={it.children ? open === i : undefined}
              disabled={it.disabled}
              onFocus={() => setOpen(it.children ? i : null)}
              onClick={() => {
                if (it.children) return setOpen(i);
                it.onSelect?.();
                onClose();
              }}
              className={cx(
                "flex h-9 w-full items-center justify-between gap-x4 rounded-r2 px-x3 text-left text-[0.875rem] hover:bg-bg-layer-fill disabled:opacity-40",
                it.danger ? "text-fg-critical" : "text-fg-neutral",
                open === i && "bg-bg-layer-fill",
              )}
            >
              {it.label}
              {it.children ? (
                <ChevronRight className="size-4 text-fg-neutral-subtle" />
              ) : (
                it.shortcut && <span className="text-[0.75rem] text-fg-neutral-subtle">{it.shortcut}</span>
              )}
            </button>
            {it.children && open === i && (
              <div className="absolute top-[-5px] left-[calc(100%+2px)]">
                <List items={it.children} onClose={onClose} />
              </div>
            )}
          </div>
        ),
      )}
    </div>
  );
}
