"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Button, useToast } from "@/components/app/ui";
import { Chip, LocalNote, Tag } from "@/components/app/form";
import { ShareDialog } from "@/components/app/ShareDialog";
import { WorkPreview, workFacts } from "@/components/app/WorkPreview";
import { SearchIcon, XIcon } from "@/components/home/icons";
import { Wordmark } from "@/components/Wordmark";
import { TAXONOMY, atelier, tagsOf, useAtelier, type AtelierEntry } from "@/lib/atelier";
import { notifications } from "@/lib/notifications";
import { CRAFT_LABEL, type Craft } from "@/lib/types";

type CraftFilter = Craft | "all";
const FILTERS: { id: CraftFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "crochet", label: "코바늘" },
  { id: "knitting", label: "대바늘" },
  { id: "grid", label: "배색·방안" },
];

const day = (ts: number) => new Date(ts).toLocaleDateString("ko-KR");

export default function AtelierPage() {
  return (
    <Suspense fallback={null}>
      <Atelier />
    </Suspense>
  );
}

function Atelier() {
  const params = useSearchParams();
  const id = params.get("id");
  const list = useAtelier();
  const entry = id ? list.find((e) => e.id === id) : null;

  return (
    <div className="min-h-dvh bg-bg-layer-default text-fg-neutral" data-own-chrome="true">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-x3 border-b border-stroke-neutral-muted bg-bg-layer-default px-x4 sm:px-x6">
        <Link href="/home" aria-label="PATTERNERS" className="text-fg-neutral">
          <Wordmark className="h-6" />
        </Link>
        <Tag tone="brand">아뜰리에 (beta)</Tag>
        <span className="flex-1" />
        <Link href="/home" className="t3-medium text-fg-neutral-muted hover:text-fg-neutral">
          작업실로
        </Link>
      </header>
      <main className="mx-auto max-w-[1200px] px-x4 py-x6 sm:px-x6 sm:py-x8">
        {id ? entry ? <Detail e={entry} /> : <Missing /> : <Catalog list={list} />}
      </main>
    </div>
  );
}

function Missing() {
  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-x3 text-center">
      <p className="t6-bold">도안을 찾을 수 없어요.</p>
      <p className="t4-regular text-fg-neutral-muted">아뜰리에에서 내렸거나, 다른 브라우저에서 올린 도안이에요.</p>
      <Link href="/atelier" className="lp-btn lp-btn-secondary">
        아뜰리에로
      </Link>
    </div>
  );
}

function Catalog({ list }: { list: AtelierEntry[] }) {
  const [query, setQuery] = useState("");
  const [craft, setCraft] = useState<CraftFilter>("all");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter(
      (e) =>
        (craft === "all" || e.craft === craft) &&
        (!q || [e.title, e.description, e.author, ...tagsOf(e.meta)].some((s) => s.toLowerCase().includes(q))),
    );
  }, [list, query, craft]);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-x3 border-b border-stroke-neutral-muted pb-x4">
        <div>
          <h1 className="t7-bold">아뜰리에</h1>
          <p className="mt-x1 t4-regular text-fg-neutral-muted">내가 올린 도안을 모아 보는 곳이에요.</p>
        </div>
        <label className="relative block w-full sm:w-64">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-neutral-subtle" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="도안, 작가, 태그 검색"
            aria-label="도안, 작가, 태그 검색"
            className="h-x9 w-full rounded-full border border-stroke-neutral-muted bg-bg-layer-default pr-x8 pl-x8 text-[1rem] text-fg-neutral outline-none placeholder:text-fg-neutral-subtle focus:border-stroke-neutral-contrast [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              aria-label="지우기"
              onClick={() => setQuery("")}
              className="absolute top-1/2 right-2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-fg-neutral-subtle hover:bg-bg-layer-fill"
            >
              <XIcon className="size-3.5" />
            </button>
          )}
        </label>
      </div>
      <LocalNote className="mt-x4">
        이 아뜰리에는 이 브라우저에만 저장돼요. 서버가 없어서 다른 사람이나 다른 기기에서는 보이지 않아요. 도안 편집기 왼쪽 아래 ‘아뜰리에에 올리기’로 올릴 수 있어요.
      </LocalNote>
      <div className="mt-x4 flex flex-wrap gap-x1_5" role="group" aria-label="종류">
        {FILTERS.map((f) => (
          <Chip key={f.id} on={craft === f.id} onClick={() => setCraft(f.id)}>
            {f.label}
          </Chip>
        ))}
      </div>
      {shown.length === 0 ? (
        <div className="flex min-h-[40dvh] flex-col items-center justify-center gap-x2 text-center">
          <p className="t6-bold">{list.length ? "조건에 맞는 도안이 없어요." : "아직 올라온 도안이 없어요."}</p>
          {!list.length && <p className="t4-regular text-fg-neutral-muted">도안을 열고 왼쪽 아래 ‘아뜰리에에 올리기’(가게 아이콘)를 눌러 첫 도안을 올려 보세요.</p>}
        </div>
      ) : (
        <ul className="mt-x6 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x5">
          {shown.map((e) => (
            <li key={e.id}>
              <Link href={`/atelier?id=${e.id}`} className="group block">
                <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-r3 border border-stroke-neutral-muted bg-bg-layer-fill transition-colors group-hover:border-stroke-neutral-weak">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={e.thumbnail} alt="" className="h-full w-full object-contain p-x3" />
                </div>
                <p className="mt-x2_5 truncate t4-bold">{e.title}</p>
                <p className="mt-x0_5 t2-regular text-fg-neutral-subtle">
                  {CRAFT_LABEL[e.craft]} · {e.author} · {day(e.publishedAt)}
                </p>
                {tagsOf(e.meta).length > 0 && (
                  <span className="mt-x1_5 flex flex-wrap gap-x1">
                    {tagsOf(e.meta)
                      .slice(0, 3)
                      .map((t) => (
                        <Tag key={t}>{t}</Tag>
                      ))}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Detail({ e }: { e: AtelierEntry }) {
  const toast = useToast();
  const router = useRouter();
  const [share, setShare] = useState(false);

  const take = () => {
    const w = atelier.importToWorks(e.id);
    if (!w) return;
    notifications.add({ kind: "atelier_import", title: `아뜰리에의 ‘${e.title}’ 도안을 내 도안으로 가져왔어요`, href: `/maker/${w.id}` });
    toast("내 도안으로 가져왔어요", { label: "열기", run: () => router.push(`/maker/${w.id}`) });
  };
  const remove = () => {
    if (!confirm(`‘${e.title}’ 도안을 아뜰리에에서 내릴까요? 내 도안에는 영향이 없어요.`)) return;
    atelier.remove(e.id);
    toast("아뜰리에에서 내렸어요");
    router.push("/atelier");
  };

  const info: { label: string; value?: string }[] = [
    { label: "종류", value: CRAFT_LABEL[e.craft] },
    { label: "카테고리", value: e.meta.category && TAXONOMY.category[e.meta.category] },
    { label: "난이도", value: e.meta.difficulty && TAXONOMY.difficulty[e.meta.difficulty] },
    { label: "실 굵기", value: e.meta.yarnWeight && TAXONOMY.yarnWeight[e.meta.yarnWeight] },
    { label: "기법", value: e.meta.techniques.map((t) => TAXONOMY.technique[t]).join(", ") || undefined },
    ...workFacts(e.craft, e.data),
  ];

  return (
    <>
      <Link href="/atelier" className="t3-medium text-fg-neutral-muted hover:text-fg-neutral">
        ← 목록으로
      </Link>
      <div className="mt-x4 grid gap-x6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <WorkPreview craft={e.craft} data={e.data} />
        <aside className="flex flex-col gap-x4">
          <div>
            <div className="flex flex-wrap gap-x1">
              {tagsOf(e.meta).map((t) => (
                <Tag key={t}>{t}</Tag>
              ))}
            </div>
            <h1 className="mt-x2 t7-bold break-keep">{e.title}</h1>
            <p className="mt-x1 t2-regular text-fg-neutral-subtle">
              {e.author} · {day(e.publishedAt)} 올림
            </p>
          </div>
          <div className="flex flex-col gap-x2">
            <Button variant="primary" onClick={take}>
              내 도안으로 가져오기
            </Button>
            <Button onClick={() => setShare(true)}>링크로 공유</Button>
          </div>
          <section className="border-t border-stroke-neutral-muted pt-x4">
            <h2 className="t3-bold">도안 소개</h2>
            <p className="mt-x1_5 t3-regular whitespace-pre-wrap text-fg-neutral-muted">{e.description || "아직 도안 소개가 없어요."}</p>
          </section>
          <section className="border-t border-stroke-neutral-muted pt-x4">
            <h2 className="t3-bold">도안 정보</h2>
            <dl className="mt-x2 flex flex-col gap-x2">
              {info
                .filter((i) => i.value)
                .map((i) => (
                  <div key={i.label} className="flex justify-between gap-x3 t3-regular">
                    <dt className="shrink-0 text-fg-neutral-muted">{i.label}</dt>
                    <dd className="text-right text-fg-neutral">{i.value}</dd>
                  </div>
                ))}
            </dl>
          </section>
          <section className="border-t border-stroke-neutral-muted pt-x4">
            <h2 className="t3-bold">라이선스 · {TAXONOMY.license[e.meta.license]}</h2>
            <p className="mt-x1_5 t3-regular text-fg-neutral-muted">{TAXONOMY.licenseDesc[e.meta.license]}</p>
          </section>
          <LocalNote>이 도안은 이 브라우저의 아뜰리에에만 있어요. 가져오면 올릴 때의 모습 그대로 내 도안에 사본이 생겨요.</LocalNote>
          <button type="button" onClick={remove} className="h-10 rounded-r2 text-[0.875rem] font-semibold text-fg-critical hover:bg-bg-layer-fill">
            아뜰리에에서 내리기
          </button>
        </aside>
      </div>
      <ShareDialog open={share} onClose={() => setShare(false)} work={{ title: e.title, craft: e.craft, data: e.data }} />
    </>
  );
}
