"use client";

import { useEffect, useState } from "react";
import { LocalNote, inputCls } from "./form";
import { Button, Dialog, useToast } from "./ui";
import { LONG_LINK, shareUrl } from "@/lib/share";
import type { Craft, WorkData } from "@/lib/types";

/**
 * 공유하기: builds a link that carries the whole work in its #hash (nothing is uploaded),
 * with "copy link" and "open viewer".
 */
export function ShareDialog({ open, onClose, work }: { open: boolean; onClose: () => void; work: { title: string; craft: Craft; data: WorkData } }) {
  const toast = useToast();
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  // Build the link from the work as it is when the dialog opens.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setUrl(null);
    setFailed(false);
    shareUrl(work)
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast("공유 링크를 복사했어요");
    } catch {
      toast("복사하지 못했어요. 링크를 직접 선택해 복사해 주세요.");
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="공유"
      width={480}
      footer={
        <>
          <Button onClick={() => url && window.open(url, "_blank", "noopener")} disabled={!url}>
            보기 열기
          </Button>
          <Button variant="primary" onClick={copy} disabled={!url}>
            링크 복사
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-x3">
        <p className="t4-regular text-fg-neutral-muted">
          ‘{work.title}’ 도안을 읽기 전용으로 볼 수 있는 링크예요. 받은 사람은 ‘내 도안으로 복제’로 자기 브라우저에 사본을 만들 수 있어요.
        </p>
        <input
          readOnly
          aria-label="공유 링크"
          value={failed ? "링크를 만들지 못했어요" : url ?? "링크를 만드는 중…"}
          onFocus={(e) => e.target.select()}
          className={`${inputCls} text-fg-neutral-muted`}
        />
        <LocalNote>
          링크 안에 도안이 통째로 압축돼 들어 있어요. 서버에 올리지 않아서, 링크를 가진 사람은 누구나 볼 수 있고 나중에 도안을 고쳐도 이 링크에는 반영되지 않아요.
        </LocalNote>
        {url && (
          <p className="t2-regular text-fg-neutral-subtle">
            링크 길이 {url.length.toLocaleString("ko-KR")}자
            {url.length > LONG_LINK && " · 링크가 길어서 일부 메신저에서는 잘릴 수 있어요. 그럴 때는 내보내기로 이미지를 보내 주세요."}
          </p>
        )}
      </div>
    </Dialog>
  );
}
