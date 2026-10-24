"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { cx, useOutside } from "@/components/app/ui";
import { BellIcon } from "@/components/home/icons";
import { notifications, useNotifications } from "@/lib/notifications";

function ago(ts: number) {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return new Date(ts).toLocaleDateString("ko-KR");
}

/** Home bell "알림": local notifications from lib/notifications. */
export function NotificationsBell() {
  const list = useNotifications();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, open, () => setOpen(false));
  const unread = list.filter((n) => !n.read).length;

  return (
    <div ref={ref} className="relative flex">
      <button
        type="button"
        aria-label={unread ? `알림 · 읽지 않음 ${unread}` : "알림"}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="seed-action-button seed-action-button--variant_ghost seed-action-button--size_small seed-action-button--layout_iconOnly seed-action-button--size_small-layout_iconOnly seed-scale-feedback relative rounded-full"
      >
        <BellIcon className="seed-icon" />
        {unread > 0 && <span className="absolute top-1.5 right-1.5 size-x1_5 rounded-full bg-bg-critical-solid" aria-hidden="true" />}
      </button>
      {open && (
        <div role="dialog" aria-label="알림" className="absolute top-[calc(100%+6px)] right-0 z-50 w-[min(360px,calc(100vw-32px))] rounded-r3 border border-stroke-neutral-muted bg-bg-layer-floating shadow-s3">
          <div className="flex items-center justify-between border-b border-stroke-neutral-muted px-x4 py-x3">
            <h2 className="t4-bold text-fg-neutral">알림</h2>
            <button
              type="button"
              disabled={!unread}
              onClick={() => notifications.markAllRead()}
              className="t2-medium text-fg-neutral-muted hover:text-fg-neutral disabled:opacity-40"
            >
              모두 읽음
            </button>
          </div>
          {list.length === 0 ? (
            <p className="px-x4 py-x8 text-center t3-regular text-fg-neutral-muted">새로운 알림이 없어요</p>
          ) : (
            <ul className="max-h-[360px] overflow-y-auto p-x1">
              {list.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      notifications.markRead(n.id);
                      if (n.href) {
                        setOpen(false);
                        router.push(n.href);
                      }
                    }}
                    className="flex w-full items-start gap-x2 rounded-r2 px-x3 py-x2_5 text-left hover:bg-bg-layer-fill"
                  >
                    <span className={cx("mt-1.5 size-x1_5 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-bg-brand-solid")} aria-label={n.read ? undefined : "읽지 않음"} />
                    <span className="min-w-0 flex-1">
                      <span className="block t3-medium text-fg-neutral">{n.title}</span>
                      {n.body && <span className="block truncate t2-regular text-fg-neutral-muted">{n.body}</span>}
                      <span className="block t1-regular text-fg-neutral-subtle">{ago(n.at)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-stroke-neutral-muted px-x4 py-x2 t1-regular text-fg-neutral-subtle">이 브라우저에서 일어난 일만 알림으로 남아요.</p>
        </div>
      )}
    </div>
  );
}
