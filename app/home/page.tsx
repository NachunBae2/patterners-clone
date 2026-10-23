"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Files, Folder, Grid, Menu as MenuIcon, More, Pin, Plus, Search, Trash, X } from "@/components/app/icons";
import { Button, Dialog, Menu, cx, useToast } from "@/components/app/ui";
import { Wordmark } from "@/components/Wordmark";
import { useWorkList, works } from "@/lib/store";
import { CRAFT_LABEL, type Craft, type Work } from "@/lib/types";

type Entry = Omit<Work, "data">;
type View = "all" | Craft | "trash";

const NAV: { id: View; label: string }[] = [
  { id: "all", label: "모든 파일" },
  { id: "crochet", label: "코바늘 도안" },
  { id: "knitting", label: "대바늘 도안" },
  { id: "grid", label: "배색·방안 도안" },
];

const EMPTY: Record<View, string> = {
  all: "아직 파일이 없어요.",
  crochet: "아직 코바늘 도안이 없어요.",
  knitting: "아직 대바늘 도안이 없어요.",
  grid: "아직 배색·방안 도안이 없어요.",
  trash: "휴지통이 비어 있어요.",
};

const CRAFTS: { craft: Craft; title: string; desc: string }[] = [
  { craft: "crochet", title: "코바늘", desc: "기호 도안을 화이트보드에서 그려요." },
  { craft: "knitting", title: "대바늘", desc: "격자에 기호를 채워 차트를 만들어요." },
  { craft: "grid", title: "배색·방안", desc: "글자·이미지를 배색 도안으로 바꿔요." },
];

// Korean initial-consonant search (e.g. ㅋㅂㄴ → 코바늘)
const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const initials = (s: string) =>
  [...s].map((ch) => {
    const c = ch.charCodeAt(0) - 0xac00;
    return c >= 0 && c < 11172 ? CHO[Math.floor(c / 588)] : ch;
  }).join("");
const matches = (title: string, q: string) => {
  const t = title.toLowerCase();
  const query = q.toLowerCase().trim();
  return !query || t.includes(query) || initials(t).includes(query);
};

function timeAgo(ts: number) {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}일 전`;
  return new Date(ts).toLocaleDateString("ko-KR");
}

export default function HomePage() {
  const list = useWorkList();
  const router = useRouter();
  const toast = useToast();
  const [view, setView] = useState<View>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"updated" | "created">("updated");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [renaming, setRenaming] = useState<Entry | null>(null);
  const [navOpen, setNavOpen] = useState(false);

  const visible = useMemo(() => {
    const live = list.filter((w) => (view === "trash" ? !!w.deletedAt : !w.deletedAt));
    const byView = view === "all" || view === "trash" ? live : live.filter((w) => w.craft === view);
    return byView
      .filter((w) => matches(w.title, query))
      .sort((a, b) => (sort === "updated" ? b.updatedAt - a.updatedAt : b.createdAt - a.createdAt));
  }, [list, view, query, sort]);
  const pinned = view === "trash" ? [] : visible.filter((w) => w.pinned);
  const rest = view === "trash" ? visible : visible.filter((w) => !w.pinned);

  const create = (craft: Craft) => {
    const w = works.create(craft);
    router.push(`/maker/${w.id}`);
  };

  const count = (v: View) =>
    list.filter((w) => (v === "trash" ? w.deletedAt : !w.deletedAt && (v === "all" || w.craft === v))).length;

  const nav = (
    <nav className="flex flex-col gap-x0_5">
      {NAV.map((n) => (
        <NavItem key={n.id} active={view === n.id} onClick={() => (setView(n.id), setNavOpen(false))} count={count(n.id)} icon={n.id === "all" ? <Files /> : <Folder />}>
          {n.label}
        </NavItem>
      ))}
      <div className="my-x2 border-t border-stroke-neutral-muted" />
      <NavItem active={view === "trash"} onClick={() => (setView("trash"), setNavOpen(false))} count={count("trash")} icon={<Trash />}>
        휴지통
      </NavItem>
    </nav>
  );

  return (
    <div className="landing flex min-h-dvh bg-bg-layer-default text-fg-neutral">
      {/* sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-r border-stroke-neutral-muted bg-bg-layer-fill px-x3 py-x4 md:flex">
        <Link href="/" className="mb-x6 flex px-x2" aria-label="PATTERNERS">
          <Wordmark className="h-6" />
        </Link>
        <Button variant="primary" className="mb-x5 w-full" onClick={() => setPickerOpen(true)}>
          <Plus className="size-4" />새 도안
        </Button>
        {nav}
        <p className="mt-auto px-x2 text-[0.75rem] leading-[1.5] text-fg-neutral-subtle">
          도안은 이 브라우저에 저장돼요.
        </p>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 flex h-16 items-center gap-x3 border-b border-stroke-neutral-muted bg-bg-layer-default/90 px-x4 backdrop-blur md:px-x8">
          <button type="button" aria-label="메뉴" className="inline-flex size-9 items-center justify-center rounded-r2 hover:bg-bg-layer-fill md:hidden" onClick={() => setNavOpen((v) => !v)}>
            {navOpen ? <X /> : <MenuIcon />}
          </button>
          <h1 className="t7-bold">{view === "trash" ? "휴지통" : NAV.find((n) => n.id === view)?.label ?? "내 도안"}</h1>
          <label className="ml-auto flex h-9 w-full max-w-[280px] items-center gap-x2 rounded-r2 border border-stroke-neutral-weak bg-bg-layer-default px-x3 focus-within:border-stroke-neutral-contrast">
            <Search className="size-4 shrink-0 text-fg-neutral-subtle" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="제목으로 검색"
              aria-label="제목으로 검색"
              className="min-w-0 flex-1 bg-transparent text-[0.875rem] outline-none placeholder:text-fg-placeholder"
            />
            {query && (
              <button type="button" aria-label="검색어 지우기" onClick={() => setQuery("")} className="text-fg-neutral-subtle">
                <X className="size-4" />
              </button>
            )}
          </label>
          <Button variant="primary" size="sm" className="md:hidden" onClick={() => setPickerOpen(true)} aria-label="새 도안">
            <Plus className="size-4" />
          </Button>
        </header>

        {navOpen && <div className="border-b border-stroke-neutral-muted bg-bg-layer-fill p-x3 md:hidden">{nav}</div>}

        <div className="px-x4 py-x6 md:px-x8">
          <div className="mb-x4 flex items-center gap-x2 text-[0.8125rem] text-fg-neutral-muted">
            {view === "trash" ? (
              <>
                <span>삭제한 작업은 30일 동안 여기에 보관된 뒤 자동으로 지워져요.</span>
                {visible.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto text-fg-critical"
                    onClick={() => {
                      if (confirm("휴지통의 모든 항목을 영구적으로 삭제할까요? 이 작업은 되돌릴 수 없어요.")) {
                        visible.forEach((w) => works.destroy(w.id));
                        toast("휴지통을 비웠어요");
                      }
                    }}
                  >
                    휴지통 비우기
                  </Button>
                )}
              </>
            ) : (
              <>
                <span>{visible.length}개</span>
                <select
                  aria-label="정렬"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as "updated" | "created")}
                  className="ml-auto h-8 rounded-r2 border border-stroke-neutral-weak bg-bg-layer-default px-x2 text-[0.8125rem] text-fg-neutral"
                >
                  <option value="updated">최근 편집순</option>
                  <option value="created">생성일 순</option>
                </select>
              </>
            )}
          </div>

          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-stroke-neutral-weak px-x6 py-x16 text-center">
              <p className="t5-bold">{query ? `‘${query}’에 맞는 파일이 없어요` : EMPTY[view]}</p>
              <p className="mt-x2 text-[0.875rem] text-fg-neutral-muted">
                {query ? "다른 낱말이나 초성(예: ㅋㅂㄴ)으로 찾아보세요." : view === "trash" ? "" : "새 도안을 눌러 시작해 보세요."}
              </p>
              {!query && view !== "trash" && (
                <Button variant="primary" className="mt-x5" onClick={() => (view === "all" ? setPickerOpen(true) : create(view))}>
                  <Plus className="size-4" />새 도안
                </Button>
              )}
            </div>
          ) : (
            <>
              {pinned.length > 0 && (
                <>
                  <h2 className="mb-x3 text-[0.8125rem] font-semibold text-fg-neutral-muted">고정됨</h2>
                  <CardGrid items={pinned} onRename={setRenaming} />
                  <div className="h-x8" />
                </>
              )}
              <CardGrid items={rest} trash={view === "trash"} onRename={setRenaming} />
            </>
          )}
        </div>
      </main>

      <Dialog open={pickerOpen} onClose={() => setPickerOpen(false)} title="어떤 도안을 만들까요?" width={560}>
        <p className="-mt-x2 mb-x4 text-[0.875rem] text-fg-neutral-muted">만들고 싶은 종류를 선택해 주세요.</p>
        <div className="grid gap-x3 sm:grid-cols-3">
          {CRAFTS.map((c) => (
            <button
              key={c.craft}
              type="button"
              onClick={() => create(c.craft)}
              className="flex flex-col items-start gap-x2 rounded-r3 border border-stroke-neutral-muted bg-bg-layer-fill p-x4 text-left transition-colors hover:border-stroke-neutral-contrast"
            >
              <CraftGlyph craft={c.craft} />
              <span className="t5-bold">{c.title}</span>
              <span className="text-[0.8125rem] leading-[1.45] text-fg-neutral-muted">{c.desc}</span>
            </button>
          ))}
        </div>
      </Dialog>

      <RenameDialog entry={renaming} onClose={() => setRenaming(null)} />
    </div>
  );
}

function NavItem({ active, onClick, count, icon, children }: { active: boolean; onClick: () => void; count: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex h-10 items-center gap-x2_5 rounded-r2 px-x3 text-[0.875rem] font-medium transition-colors [&_svg]:size-4",
        active ? "bg-bg-layer-default text-fg-neutral shadow-s1" : "text-fg-neutral-muted hover:bg-bg-layer-default/60 hover:text-fg-neutral",
      )}
    >
      {icon}
      {children}
      <span className="ml-auto text-[0.75rem] text-fg-neutral-subtle tabular-nums">{count || ""}</span>
    </button>
  );
}

function CraftGlyph({ craft }: { craft: Craft }) {
  const common = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, className: "size-7 text-fg-brand", "aria-hidden": true };
  if (craft === "crochet")
    return (
      <svg {...common}>
        <path d="M6.8 20.6c-1.1.3-2-.7-1.5-1.7L14.2 5.8c.5-1 1.9-1.4 2.9-.7.8.5 1 1.6.4 2.3-.6.8-1.8.9-2.5.2l-.9-.8" />
        <path d="M9.2 16.2h2.4" />
      </svg>
    );
  if (craft === "knitting")
    return (
      <svg {...common}>
        <path d="M5.2 18.8 16.6 6.6" />
        <circle cx="18" cy="5.1" r="1.55" />
        <path d="M18.8 18.8 7.4 6.6" />
        <circle cx="6" cy="5.1" r="1.55" />
      </svg>
    );
  return <Grid className="size-7 text-fg-brand" />;
}

function CardGrid({ items, trash, onRename }: { items: Entry[]; trash?: boolean; onRename: (e: Entry) => void }) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-x5">
      {items.map((w) => (
        <WorkCard key={w.id} w={w} trash={trash} onRename={onRename} />
      ))}
    </ul>
  );
}

function WorkCard({ w, trash, onRename }: { w: Entry; trash?: boolean; onRename: (e: Entry) => void }) {
  const toast = useToast();
  const router = useRouter();
  const open = () => !trash && router.push(`/maker/${w.id}`);
  const daysLeft = w.deletedAt ? Math.max(0, 30 - Math.floor((Date.now() - w.deletedAt) / 864e5)) : 0;

  return (
    <li className="group relative">
      <button type="button" onClick={open} disabled={trash} className="block w-full text-left">
        <div className="lp-panel flex aspect-[4/3] items-center justify-center overflow-hidden transition-colors group-hover:border-stroke-neutral-weak">
          {w.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={w.thumbnail} alt="" className="h-full w-full object-contain p-x3" />
          ) : (
            <span className="text-[0.8125rem] text-fg-neutral-subtle">빈 도안</span>
          )}
        </div>
        <p className="mt-x2_5 flex items-center gap-x1_5 truncate pr-x8 text-[0.9375rem] font-semibold">
          {w.pinned && <Pin className="size-3.5 shrink-0 text-fg-brand" />}
          <span className="truncate">{w.title}</span>
        </p>
        <p className="lp-caption">
          {CRAFT_LABEL[w.craft]} · {trash ? (daysLeft ? `${daysLeft}일 후 삭제` : "오늘 삭제") : `수정됨 ${timeAgo(w.updatedAt)}`}
        </p>
      </button>
      <div className="absolute right-0 bottom-x1">
        <Menu
          align="end"
          trigger={({ toggle }) => (
            <button type="button" aria-label={`${w.title} 메뉴`} onClick={toggle} className="inline-flex size-8 items-center justify-center rounded-r2 text-fg-neutral-muted hover:bg-bg-layer-fill">
              <More />
            </button>
          )}
          items={
            trash
              ? [
                  { label: "복원", onSelect: () => (works.restore(w.id), toast("복원했어요.")) },
                  {
                    label: "영구 삭제",
                    danger: true,
                    onSelect: () => {
                      if (confirm("이 작업은 되돌릴 수 없어요. 영구적으로 삭제할까요?")) {
                        works.destroy(w.id);
                        toast("영구 삭제했어요");
                      }
                    },
                  },
                ]
              : [
                  { label: "열기", onSelect: open },
                  { label: "이름 변경", onSelect: () => onRename(w) },
                  { label: "복제", onSelect: () => (works.duplicate(w.id), toast("복제했어요")) },
                  { label: w.pinned ? "고정 해제" : "고정", onSelect: () => works.update(w.id, { pinned: !w.pinned }) },
                  "separator",
                  {
                    label: "삭제",
                    danger: true,
                    onSelect: () => {
                      works.trash(w.id);
                      toast("휴지통으로 옮겼어요", { label: "실행 취소", run: () => works.restore(w.id) });
                    },
                  },
                ]
          }
        />
      </div>
    </li>
  );
}

function RenameDialog({ entry, onClose }: { entry: Entry | null; onClose: () => void }) {
  const [value, setValue] = useState("");
  const toast = useToast();
  const [lastId, setLastId] = useState<string | null>(null);
  if (entry && entry.id !== lastId) {
    setLastId(entry.id);
    setValue(entry.title);
  }
  const save = () => {
    if (!entry) return;
    works.update(entry.id, { title: value.trim().slice(0, 60) || "제목 없음", updatedAt: Date.now() });
    toast("이름을 바꿨어요");
    onClose();
  };
  return (
    <Dialog
      open={!!entry}
      onClose={() => (onClose(), setLastId(null))}
      title="이름 변경"
      footer={
        <>
          <Button onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={save}>
            저장
          </Button>
        </>
      }
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && save()}
        aria-label="도안 제목"
        className="h-11 w-full rounded-r2 border border-stroke-neutral-weak bg-bg-layer-default px-x3 text-[1rem] outline-none focus:border-stroke-neutral-contrast"
      />
    </Dialog>
  );
}
