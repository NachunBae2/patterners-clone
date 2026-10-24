"use client";

import { Button, Dialog } from "@/components/app/ui";
import { Tag } from "@/components/app/form";
import { AREA_LABEL, KIND_LABEL, NOTICES } from "@/lib/notices";

/**
 * 공지사항: list → detail. `openId` is the notice to show (null = list).
 * The parent keeps `openId` so the home banner's "보기" can open its notice directly.
 */
export function NoticesDialog({ open, openId, onOpenId, onClose }: { open: boolean; openId: string | null; onOpenId: (id: string | null) => void; onClose: () => void }) {
  const n = openId ? NOTICES.find((x) => x.id === openId) : null;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="공지사항"
      width={560}
      footer={
        n ? (
          <>
            <Button onClick={() => onOpenId(null)}>목록으로</Button>
            <Button variant="primary" onClick={onClose}>
              닫기
            </Button>
          </>
        ) : undefined
      }
    >
      {n ? (
        <article aria-label={n.title}>
          <p className="t2-regular text-fg-neutral-subtle">{n.date.replace(/-/g, ".")}</p>
          <h3 className="mt-x1 t5-bold text-fg-neutral">
            [{n.tag}] {n.title}
          </h3>
          <p className="mt-x3 t4-regular text-fg-neutral-muted">{n.lead}</p>
          <ul className="mt-x4 flex flex-col gap-x3">
            {n.items.map((it, i) => (
              <li key={i} className="flex flex-col gap-x1_5 rounded-r3 border border-stroke-neutral-muted p-x3">
                <span className="flex gap-x1">
                  <Tag tone={it.kind === "new" ? "brand" : "neutral"}>{KIND_LABEL[it.kind]}</Tag>
                  <Tag>{AREA_LABEL[it.area]}</Tag>
                </span>
                <span className="t4-regular text-fg-neutral">{it.text}</span>
              </li>
            ))}
          </ul>
          {n.tryIt && (
            <div className="mt-x4 rounded-r3 bg-bg-layer-fill p-x3">
              <p className="t3-bold text-fg-neutral">이렇게 써 보세요</p>
              <p className="mt-x1 t3-regular text-fg-neutral-muted">{n.tryIt}</p>
            </div>
          )}
        </article>
      ) : NOTICES.length === 0 ? (
        <p className="py-x8 text-center t4-regular text-fg-neutral-muted">등록된 공지가 없어요.</p>
      ) : (
        <ul className="-mx-x2 flex flex-col">
          {[...NOTICES]
            .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned))
            .map((x) => (
              <li key={x.id}>
                <button type="button" onClick={() => onOpenId(x.id)} className="flex w-full flex-col gap-x1 rounded-r2 px-x2 py-x3 text-left hover:bg-bg-layer-fill">
                  <span className="flex items-center gap-x1_5">
                    {x.pinned && <Tag tone="brand">고정</Tag>}
                    <span className="truncate t4-bold text-fg-neutral">
                      [{x.tag}] {x.title}
                    </span>
                  </span>
                  <span className="truncate t3-regular text-fg-neutral-muted">{x.lead}</span>
                  <span className="t2-regular text-fg-neutral-subtle">{x.date.replace(/-/g, ".")}</span>
                </button>
              </li>
            ))}
        </ul>
      )}
    </Dialog>
  );
}
