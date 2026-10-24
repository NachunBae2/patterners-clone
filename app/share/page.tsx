"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, useToast } from "@/components/app/ui";
import { LocalNote, Tag } from "@/components/app/form";
import { WorkPreview, workFacts } from "@/components/app/WorkPreview";
import { Wordmark } from "@/components/Wordmark";
import { notifications } from "@/lib/notifications";
import { decodeShare, type SharedWork } from "@/lib/share";
import { works } from "@/lib/store";
import { CRAFT_LABEL, type GridData } from "@/lib/types";
import { gridDoc, workThumb } from "@/lib/workSvg";

/** 공유 보기: read-only viewer for a work carried in the URL hash. */
export default function SharePage() {
  const toast = useToast();
  const router = useRouter();
  const [shared, setShared] = useState<SharedWork | null | undefined>(undefined);

  useEffect(() => {
    const load = () => decodeShare(window.location.hash).then(setShared);
    load();
    window.addEventListener("hashchange", load);
    return () => window.removeEventListener("hashchange", load);
  }, []);

  const clone = () => {
    if (!shared) return;
    const w = works.create(shared.craft, `${shared.title} (사본)`, structuredClone(shared.data));
    try {
      works.update(w.id, { thumbnail: workThumb(shared.craft, shared.data) });
    } catch {}
    notifications.add({ kind: "share_import", title: `공유받은 ‘${shared.title}’ 도안을 내 도안으로 복제했어요`, href: `/maker/${w.id}` });
    toast("내 도안으로 복제했어요", { label: "열기", run: () => router.push(`/maker/${w.id}`) });
  };

  let yarns: string[] = [];
  try {
    if (shared?.craft === "grid") yarns = gridDoc(shared.data as GridData).yarns;
  } catch {}

  return (
    <div className="min-h-dvh bg-bg-layer-default text-fg-neutral" data-own-chrome="true">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-x3 border-b border-stroke-neutral-muted bg-bg-layer-default px-x4 sm:px-x6">
        <Link href="/" aria-label="PATTERNERS" className="text-fg-neutral">
          <Wordmark className="h-6" />
        </Link>
        <Tag>공유 보기</Tag>
        <span className="flex-1" />
        <Link href="/home" className="t3-medium text-fg-neutral-muted hover:text-fg-neutral">
          내 작업으로
        </Link>
      </header>

      <main className="mx-auto max-w-[1200px] px-x4 py-x6 sm:px-x6 sm:py-x8">
        {shared === undefined ? (
          <p className="py-x16 text-center t4-regular text-fg-neutral-muted">불러오는 중…</p>
        ) : shared === null ? (
          <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-x3 text-center">
            <p className="t6-bold">공유 도안을 찾을 수 없어요.</p>
            <p className="t4-regular text-fg-neutral-muted">링크가 잘렸거나 올바르지 않아요. 받은 링크 전체를 복사했는지 확인해 주세요.</p>
            <Link href="/home" className="lp-btn lp-btn-secondary">
              홈으로
            </Link>
          </div>
        ) : (
          <div className="grid gap-x6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <WorkPreview craft={shared.craft} data={shared.data} />
            <aside className="flex flex-col gap-x4">
              <div>
                <div className="flex items-center gap-x1_5">
                  <Tag tone="brand">{CRAFT_LABEL[shared.craft]}</Tag>
                  <Tag>읽기 전용</Tag>
                </div>
                <h1 className="mt-x2 t7-bold break-keep">{shared.title}</h1>
                <p className="mt-x1 t2-regular text-fg-neutral-subtle">{new Date(shared.at).toLocaleDateString("ko-KR")}에 공유한 도안</p>
              </div>
              <Button variant="primary" onClick={clone}>
                내 도안으로 복제
              </Button>
              <dl className="flex flex-col gap-x2 border-t border-stroke-neutral-muted pt-x4">
                {workFacts(shared.craft, shared.data).map((f) => (
                  <div key={f.label} className="flex justify-between gap-x3 t3-regular">
                    <dt className="text-fg-neutral-muted">{f.label}</dt>
                    <dd className="text-fg-neutral">{f.value}</dd>
                  </div>
                ))}
              </dl>
              {yarns.length > 0 && (
                <div className="border-t border-stroke-neutral-muted pt-x4">
                  <h2 className="t3-bold">사용한 실</h2>
                  <ul className="mt-x2 flex flex-col gap-x1_5">
                    {yarns.map((c, i) => (
                      <li key={i} className="flex items-center gap-x2 t3-regular">
                        <span className="size-5 rounded-r1 border border-black/10" style={{ background: /^#[0-9a-f]{3,8}$/i.test(c) ? c : "#ccc" }} />
                        {i === 0 ? "배경 실" : `실 ${i}`}
                        <span className="text-fg-neutral-subtle">{c.toUpperCase()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <LocalNote>이 도안은 링크 안에 들어 있어서 서버에 저장되지 않았어요. 복제하면 지금 쓰는 브라우저의 내 도안에 사본이 생겨요.</LocalNote>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
